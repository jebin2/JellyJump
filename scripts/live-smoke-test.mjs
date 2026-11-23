/**
 * After a deploy: is the site that is live now the build just deployed, and
 * does it work? (ARCHITECTURE_PLAN.md S7; previews too, S6.)
 *
 * A green deploy job used to mean only that files were pushed. Pages can
 * fail to build, the CDN can keep serving the old copy, and a build that
 * passed every test against a local server can still break behind the real
 * domain (the service worker, cross-origin isolation, a sub-path). This
 * waits for the live version.json to name the build, then opens the player
 * there, lets it load the sample video, seeks, and fails on any page error.
 *
 *   node scripts/live-smoke-test.mjs https://jellyjump.voidall.com/ <commit>
 *   node scripts/live-smoke-test.mjs https://jellyjump.voidall.com/previews/81/ <build id>
 *
 * Nothing but the site itself is fetched: the visit counter and every other
 * outside request are blocked, so a test run is not counted as a visitor.
 */
import { existsSync } from 'node:fs';

const [base, expected] = process.argv.slice(2);
if (!base || !expected) {
    console.error('Usage: node scripts/live-smoke-test.mjs <site URL ending in /> <build id or commit>');
    process.exit(2);
}
const site = new URL(base.endsWith('/') ? base : `${base}/`);
const WAIT_FOR_BUILD_MS = Number(process.env.LIVE_WAIT_MS || 12 * 60 * 1000);

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** A build id is the commit's short form; either side may be the longer. */
const sameBuild = (live) => !!live && (expected.startsWith(live) || live.startsWith(expected));

console.log(`\nthe build at ${site.href}`);
let live = null;
const deadline = Date.now() + WAIT_FOR_BUILD_MS;
while (Date.now() < deadline) {
    try {
        const response = await fetch(new URL(`version.json?t=${Date.now()}`, site), { cache: 'no-store' });
        if (response.ok) live = await response.json();
    } catch { /* not answering yet */ }
    if (sameBuild(live?.build)) break;
    console.log(`  … live build is ${live?.build ?? 'not answering'}, waiting for ${expected}`);
    await sleep(20000);
}
check(sameBuild(live?.build), `version.json names the deployed build (${live?.build} ${live?.version ?? ''})`);
if (!sameBuild(live?.build)) {
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(1);
}

const browserPath = [process.env.CHROMIUM_PATH, process.env.CHROME_PATH, '/usr/bin/chromium', '/usr/bin/google-chrome']
    .filter(Boolean).find((p) => existsSync(p));
const { chromium } = await import('playwright-core');
const browser = await chromium.launch({ executablePath: browserPath, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(m.text().slice(0, 200)); });
    page.on('response', (r) => {
        if (r.status() >= 400 && r.url().startsWith(site.origin)) errors.push(`${r.status()} ${r.url()}`);
    });
    await page.route('**/*', (route) => {
        const url = route.request().url();
        const own = url.startsWith(site.origin) || url.startsWith('blob:') || url.startsWith('data:');
        if (!own || url.includes('/js/analytics-embed.js')) return route.abort();
        return route.continue();
    });

    await page.goto(new URL('player.html', site).href);
    // The service worker reloads the page once to make it cross-origin
    // isolated, so wait for the player on the page that stays.
    await page.waitForFunction(() => !!window.player && !!window.jellyjump, null, { timeout: 90000 });

    console.log('\nthe player');
    check(true, 'player.html boots');
    const isolated = await page.waitForFunction(() => window.crossOriginIsolated, null, { timeout: 30000 })
        .then(() => true, () => false);
    check(isolated, 'cross-origin isolated (the service worker works at this path)');

    const opened = await page.evaluate(async () => {
        const p = window.player;
        for (let i = 0; i < 600 && !(p.duration > 0); i++) await new Promise((r) => setTimeout(r, 100));
        return { duration: p.duration, items: window.playlist.items?.length ?? 0 };
    });
    check(opened.duration > 0, `a first visit gets the sample video, and it loads (${opened.duration?.toFixed?.(1)} s)`);

    const seeked = await page.evaluate(async () => {
        const p = window.player;
        const target = Math.min(2, p.duration / 2);
        p.pause();
        p.seek(target);
        for (let i = 0; i < 50 && Math.abs(p.currentTime - target) > 0.25; i++) await new Promise((r) => setTimeout(r, 100));
        await new Promise((r) => setTimeout(r, 500));
        const c = p.canvas;
        const copy = document.createElement('canvas');
        copy.width = c.width; copy.height = c.height;
        const ctx = copy.getContext('2d');
        ctx.drawImage(c, 0, 0);
        const px = ctx.getImageData(0, 0, c.width, c.height).data;
        let lit = 0;
        for (let i = 0; i < px.length; i += 4 * 97) if (px[i] + px[i + 1] + px[i + 2] > 30) lit++;
        return { target, at: p.currentTime, lit };
    });
    check(Math.abs(seeked.at - seeked.target) < 0.5, `seeks (to ${seeked.target.toFixed(1)} s, at ${seeked.at.toFixed(2)} s)`);
    check(seeked.lit > 0, 'and draws a picture there');

    const version = await page.evaluate(async () => {
        const modal = await window.jellyjump.openDiagnostics();
        const pre = modal.body.querySelector('.diagnostics-report');
        for (let i = 0; i < 50 && pre.textContent === 'Collecting…'; i++) await new Promise((r) => setTimeout(r, 100));
        const first = pre.textContent.split('\n')[0];
        modal.close();
        return first;
    });
    check(version.includes(live.build), `Diagnostics reports the same build (${version})`);
    check(errors.length === 0, `no page errors or failed requests${errors.length ? `: ${errors.slice(0, 3).join('; ')}` : ''}`);
} catch (error) {
    fail++;
    console.log(`  FAIL  the run threw: ${error.message}`);
} finally {
    await browser.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
