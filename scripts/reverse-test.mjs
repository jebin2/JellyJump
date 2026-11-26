/**
 * Playing backwards keeps moving (core/playback/ReversePlayback.js).
 *
 * Every stretch played backwards is decoded from its key frame. The fixture
 * has one key frame for all its 300 frames (ffmpeg's default spacing is 250),
 * so each stretch decodes up to 300 frames to show a few dozen. Before, the
 * stretch before was decoded only half a second before it was needed, and
 * the picture stood still for seconds while the sound went on (measured on
 * a 720p clip: 5.6 s, the picture changing 37 times in 8 s).
 *
 * Here: played backwards from near the end, the picture must change often,
 * never stand still for long, follow the clock down, and hand over to
 * forward playback where it stopped.
 *
 *   npm run build && node scripts/reverse-test.mjs
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const FIXTURES = join(ROOT, 'scripts/fixtures');
const FIXTURE = 'reverse-longgop.mp4';   // 10 s, 30 fps, 480×270, H.264 + AAC, one key frame
const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
    '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.mp4': 'video/mp4',
};

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
    if (ok) { passed++; console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`); }
    else { failed++; console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ''}`); }
}

if (!existsSync(join(DIST, 'player.html'))) {
    console.error('No build found. Run `npm run build` first.');
    process.exit(1);
}

const server = createServer(async (req, res) => {
    try {
        const path = decodeURIComponent(req.url.split('?')[0]);
        const file = path.startsWith('/__fixtures__/') ? join(FIXTURES, path.slice(14)) : join(DIST, path === '/' ? 'index.html' : path);
        if (!file.startsWith(DIST) && !file.startsWith(FIXTURES)) { res.writeHead(403).end(); return; }
        const info = await stat(file);
        if (!info.isFile()) { res.writeHead(404).end(); return; }
        res.writeHead(200, {
            'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
            'Content-Length': info.size,
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'require-corp',
        });
        res.end(await readFile(file));
    } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

const executablePath = [process.env.CHROMIUM_PATH, process.env.CHROME_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome']
    .filter(Boolean).find((p) => existsSync(p));
const { chromium } = await import('playwright-core');
const browser = await chromium.launch({ executablePath, args: ['--autoplay-policy=no-user-gesture-required'] });

try {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const stretches = [];
    page.on('console', (m) => { const s = m.text(); if (/\[Reverse\] Ready up to/.test(s)) stretches.push(s.replace(/.*Ready up to /, '')); });
    await page.route('**/*', (route) => (route.request().url().startsWith(origin) || /^(blob|data):/.test(route.request().url()) ? route.continue() : route.abort()));
    await page.goto(`${origin}/player.html`);
    await page.waitForFunction(() => !!window.player && !!window.playlist, null, { timeout: 60000 });
    await page.evaluate(async (name) => {
        const blob = await (await fetch(`/__fixtures__/${name}`)).blob();
        await window.playlist.handleFiles([new File([blob], name, { type: 'video/mp4' })]);
        await window.playlist.selectItem(0, false);
        const p = window.playlist.player;
        for (let i = 0; i < 100 && !(p.duration > 0 && !p.isLoading); i++) await new Promise((r) => setTimeout(r, 100));
        p.pause();
        await p.seek(9.5);
    }, FIXTURE);
    await page.waitForTimeout(500);
    const ready = await page.evaluate(() => ({ t: window.playlist.player.currentTime, d: window.playlist.player.duration, playing: window.playlist.player.isPlaying }));
    console.log(`  (at ${ready.t.toFixed(2)} of ${ready.d.toFixed(2)} s, ${ready.playing ? 'playing' : 'paused'})`);

    console.log('\nplayed backwards from 9.5 s, one key frame at 0');
    const run = await page.evaluate(async () => {
        const p = window.playlist.player;
        // A small fingerprint of the picture, to see when it changes.
        const look = () => {
            const g = document.createElement('canvas'); g.width = 32; g.height = 18;
            const x = g.getContext('2d'); x.drawImage(p.canvas, 0, 0, 32, 18);
            const d = x.getImageData(0, 0, 32, 18).data;
            let h = 0; for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + d[i + 1] * 7 + d[i + 2] * 13) >>> 0;
            return h;
        };
        // Paused: the direction is set, and Play starts it, as the buttons do.
        await p.toggleDirection();
        const result = await p.play();
        const began = performance.now();
        const from = p.currentTime;
        let last = look(), lastChange = began, still = 0, changes = 0;
        const times = [];
        while (performance.now() - began < 3000) {
            await new Promise((r) => setTimeout(r, 40));
            const now = performance.now(), seen = look();
            times.push(p.currentTime);
            if (seen !== last) { still = Math.max(still, now - lastChange); lastChange = now; last = seen; changes++; }
        }
        still = Math.max(still, performance.now() - lastChange);
        const falling = times.every((t, i) => i === 0 || t <= times[i - 1] + 1e-6);
        const at = p.currentTime;
        p.pause();
        await new Promise((r) => setTimeout(r, 300));
        const stoppedAt = p.currentTime;
        await p.toggleDirection();
        await p.play();
        await new Promise((r) => setTimeout(r, 700));
        const forward = p.currentTime;
        p.pause();
        return { result, from, at, stoppedAt, forward, changes, still: Math.round(still), falling,
            toast: [...document.querySelectorAll('.mb-toast')].map((t) => t.textContent).join(' | ') };
    });
    check('it starts', run.result?.started === true, JSON.stringify(run.result));
    check('the clock runs down, about as fast as it plays', run.from - run.at > 2.2 && run.from - run.at < 3.6, `${run.from.toFixed(2)} -> ${run.at.toFixed(2)}`);
    check('and only down', run.falling);
    check('the picture keeps changing', run.changes >= 20, `${run.changes} changes in 3 s`);
    check('it never stands still for long', run.still < 700, `${run.still} ms at most`);
    check('stopped, it stays where it got to', Math.abs(run.stoppedAt - run.at) < 0.5, `${run.at.toFixed(2)} / ${run.stoppedAt.toFixed(2)}`);
    check('and plays forwards from there', run.forward > run.stoppedAt + 0.2 && run.forward < run.stoppedAt + 1.5, `${run.stoppedAt.toFixed(2)} -> ${run.forward.toFixed(2)}`);
    check('no error shown', !/could not be decoded/i.test(run.toast), run.toast);
    check('no uncaught errors', errors.length === 0, errors.join(' | '));
    console.log(`  stretches: ${stretches.slice(0, 6).join(' | ')}`);
} catch (error) {
    failed++;
    console.log(`  FAIL  the run itself threw: ${error.stack || error.message}`);
} finally {
    await browser.close();
    server.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
