/**
 * Offline (ARCHITECTURE_PLAN.md Q4), in the built app in a real browser: after
 * one visit, with the network off, the player page opens from the service
 * worker's cache and plays a local file.
 *
 * Also checks what the build gives the worker: a precache list whose files
 * all exist, and no media or source maps in it.
 *
 *   npm run build && node scripts/offline-test.mjs
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const FIXTURE = join(ROOT, 'scripts/fixtures/smoke.webm');   // 2 s, 320x180, no audio

const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.gif': 'image/gif', '.jpg': 'image/jpeg', '.webp': 'image/webp',
    '.webm': 'video/webm', '.wasm': 'application/wasm', '.txt': 'text/plain',
    '.map': 'application/json', '.ico': 'image/x-icon', '.ttf': 'font/ttf',
};

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
    if (ok) { passed++; console.log(`  PASS  ${name}`); }
    else { failed++; console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ''}`); }
}

if (!existsSync(join(DIST, 'player.html'))) {
    console.error('No build found. Run `npm run build` first.');
    process.exit(1);
}

// --- what the build wrote into the worker -------------------------------------

console.log('\nthe service worker in the build\n');
const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
const match = sw.match(/const BUILD = (\{.*?\});\n/);
check('dist/sw.js carries the build manifest', !!match);
const manifest = match ? JSON.parse(match[1]) : { precache: [], files: [], id: '' };
check('it names the build', typeof manifest.id === 'string' && manifest.id.length > 0);
check('the precache holds the player page and the landing page',
    manifest.precache.includes('player.html') && manifest.precache.includes('index.html'));
check('every precached file is in the build', manifest.precache.every((file) => existsSync(join(DIST, file))),
    manifest.precache.filter((file) => !existsSync(join(DIST, file))).join(', '));
check('no media, source maps, version.json or sw.js precached',
    !manifest.precache.some((file) => /\.(mp4|map)$/.test(file) || file === 'version.json' || file === 'sw.js'));
check('the on-demand DTS and TrueHD decoders are precached',
    manifest.precache.some((file) => /mediabunny-dts-/.test(file)) && manifest.precache.some((file) => /mediabunny-truehd-/.test(file)));
check('the subtitle runtime (26 MB of WASM) is not precached', !manifest.precache.some((file) => file.endsWith('.wasm')));
check('hashed files are listed, none of them a page', manifest.files.length > 20 && !manifest.files.some((file) => file.endsWith('.html')));

// --- the browser ----------------------------------------------------------------

async function serve() {
    const server = createServer(async (req, res) => {
        try {
            const path = decodeURIComponent(req.url.split('?')[0]);
            const file = join(DIST, path === '/' ? 'index.html' : path);
            if (!file.startsWith(DIST)) { res.writeHead(403).end(); return; }
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
    return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

function findBrowser() {
    return [process.env.CHROMIUM_PATH, process.env.CHROME_PATH,
        '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ].filter(Boolean).find((p) => existsSync(p));
}

const browserPath = findBrowser();
if (!browserPath) {
    console.error('No Chromium or Chrome found. Set CHROMIUM_PATH to a browser binary.');
    process.exit(1);
}

const { chromium } = await import('playwright-core');
const { server, origin } = await serve();
const browser = await chromium.launch({
    executablePath: browserPath,
    // Nothing leaves the machine (the analytics embed would count test runs).
    // Not page.route: routing takes requests away from the service worker.
    args: ['--no-sandbox', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
        '--autoplay-policy=no-user-gesture-required'],
});

/** Load the fixture's bytes into the player as a local file and wait for its first frame. */
async function playLocalFile(page, bytes) {
    return page.evaluate(async (data) => {
        const p = window.player;
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const file = new File([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], 'local.webm', { type: 'video/webm' });
        await p.load(URL.createObjectURL(file));
        for (let i = 0; i < 400 && p.timing.pending; i++) await sleep(10);
        return { framed: !p.timing.pending, duration: p.duration };
    }, bytes);
}

try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const bytes = (await readFile(FIXTURE)).toString('base64');

    console.log('\nfirst visit, online\n');
    await page.goto(`${origin}/player.html`);
    await page.waitForFunction(() => !!window.player && !!window.playlist, null, { timeout: 60000 });
    const controlled = await page.waitForFunction(() => !!navigator.serviceWorker?.controller, null, { timeout: 30000 })
        .then(() => true, () => false);
    check('the service worker controls the page', controlled);

    // Installing stores the precache; wait until all of it is there.
    const stored = await page.waitForFunction(async (count) => {
        for (const name of await caches.keys()) {
            if (name.includes(':precache:') && (await (await caches.open(name)).keys()).length >= count) return true;
        }
        return false;
    }, manifest.precache.length, { timeout: 60000, polling: 250 }).then(() => true, () => false);
    check(`the precache holds all ${manifest.precache.length} files`, stored);

    const online = await playLocalFile(page, bytes);
    check('a local file plays online', online.framed && online.duration > 1.5, JSON.stringify(online));

    // A tool's code is not precached; fetched once, it is kept.
    const tool = manifest.files.find((file) => /InfoMenu-/.test(file) && !manifest.precache.includes(file));
    check('a tool chunk is left out of the precache', !!tool);
    const fetchedOnline = await page.evaluate((file) => fetch(file).then((r) => r.ok, () => false), tool);
    check('it loads online', fetchedOnline);

    console.log('\nreopened with the network off\n');
    await context.setOffline(true);
    const reachable = await page.evaluate(() => fetch('https://example.com/', { mode: 'no-cors' }).then(() => true, () => false));
    check('the network is off', !reachable);

    errors.length = 0;
    const response = await page.reload({ waitUntil: 'load' }).catch((error) => error);
    check('the player page opens offline', !(response instanceof Error) && response?.ok(),
        response instanceof Error ? response.message : `status ${response?.status()}`);
    const booted = await page.waitForFunction(() => !!window.player && !!window.playlist, null, { timeout: 30000 })
        .then(() => true, () => false);
    check('the player and the playlist start offline', booted);
    check('the controls are there', await page.locator('.play-pause-btn, [data-action="play"], button[aria-label*="Play" i]').count() > 0);

    const offline = await playLocalFile(page, bytes);
    check('a local file plays offline', offline.framed && offline.duration > 1.5, JSON.stringify(offline));
    check('no uncaught errors offline', errors.length === 0, errors.join(' | '));

    check('the tool fetched once online loads offline',
        await page.evaluate((file) => fetch(file).then((r) => r.ok, () => false), tool));
    const toolNeverFetched = manifest.files.find((file) => /GifMenu-/.test(file) && !manifest.precache.includes(file));
    check('a tool never fetched does not (it was not stored)',
        !(await page.evaluate((file) => fetch(file).then((r) => r.ok, () => false), toolNeverFetched)));
    check('version.json is never answered from the cache',
        !(await page.evaluate(() => fetch('version.json', { cache: 'no-store' }).then((r) => r.ok, () => false))));

    // A query on the page is the same page (player.html?debug=1).
    const withQuery = await page.goto(`${origin}/player.html?from=offline-test`).catch((error) => error);
    check('the page with a query opens offline too', !(withQuery instanceof Error) && withQuery?.ok());

    await context.setOffline(false);
} catch (error) {
    failed++;
    console.log(`  FAIL  the run itself threw: ${error.stack || error.message}`);
} finally {
    await browser.close();
    server.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
