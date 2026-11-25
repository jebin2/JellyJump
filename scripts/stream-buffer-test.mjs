/**
 * Remote playback through the buffer (ARCHITECTURE_PLAN.md U2, ADR 0013), in
 * the built player against a server the test controls: what it fetches, when
 * it stops fetching, and what it plays without the network.
 *
 * - a remote file plays through the buffer, and keeps downloading while paused;
 * - a seek aborts the fetch it left behind (the server sees the connection close);
 * - a seek back into downloaded bytes asks the server for nothing;
 * - after a reload, what was kept plays with the server gone;
 * - a server that ignores ranges, and a browser without file storage, still play.
 *
 *   npm run build && node scripts/stream-buffer-test.mjs
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const FIXTURE = join(ROOT, 'scripts/fixtures/stall-av.mp4');   // 12 s, 15 fps, H.264 + AAC, ~24 KB/s, faststart

const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
    '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.webm': 'video/webm',
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

const video = await readFile(FIXTURE);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The remote side. `rate` is bytes per second (0: as fast as it goes);
 * `mode` 'ranges' answers ranges, 'whole' ignores them (200), 'down' drops
 * every connection. Each request is recorded with its range, the bytes sent,
 * and whether the client closed it before the end.
 */
const remote = { rate: 0, mode: 'ranges', requests: [] };

async function serveRemote(req, res) {
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
    if (remote.mode === 'down') { req.socket.destroy(); return; }
    const useRange = range && remote.mode === 'ranges';
    const start = useRange ? Number(range[1]) : 0;
    const end = useRange && range[2] ? Math.min(Number(range[2]), video.length - 1) : video.length - 1;
    const record = { range: useRange ? [start, end] : null, sent: 0, closedEarly: false, at: Date.now() };
    remote.requests.push(record);
    res.writeHead(useRange ? 206 : 200, {
        'Content-Type': 'video/mp4',
        'Content-Length': end - start + 1,
        'Accept-Ranges': useRange ? 'bytes' : 'none',
        ETag: '"stall-av-1"',
        'Cache-Control': 'no-store',
        ...(useRange ? { 'Content-Range': `bytes ${start}-${end}/${video.length}` } : {}),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Range, Content-Length, ETag',
        'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    res.on('close', () => { if (record.sent < end - start + 1) record.closedEarly = true; });
    const CHUNK = 2048;
    for (let at = start; at <= end; at += CHUNK) {
        if (res.destroyed) return;
        const piece = video.subarray(at, Math.min(at + CHUNK, end + 1));
        if (remote.rate) await sleep((piece.length / remote.rate) * 1000);
        if (res.destroyed) return;
        res.write(piece);
        record.sent += piece.length;
    }
    res.end();
}

const server = createServer(async (req, res) => {
    try {
        const path = decodeURIComponent(req.url.split('?')[0]);
        if (path.startsWith('/__remote__/')) return serveRemote(req, res);
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
const origin = `http://127.0.0.1:${server.address().port}`;

const browserPath = [process.env.CHROMIUM_PATH, process.env.CHROME_PATH,
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean).find((p) => existsSync(p));
if (!browserPath) {
    console.error('No Chromium or Chrome found. Set CHROMIUM_PATH to a browser binary.');
    process.exit(1);
}
const { chromium } = await import('playwright-core');
const browser = await chromium.launch({
    executablePath: browserPath,
    args: ['--no-sandbox', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
        '--autoplay-policy=no-user-gesture-required'],
});

/** A player page; `noDisk` takes the origin private file system away. */
async function openPlayer(context, { noDisk = false } = {}) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    if (process.env.STREAM_DEBUG) {
        page.on('console', (m) => { if (/Buffer|Net:|MediaLifecycle|FrameSync|late|Video way/.test(m.text())) console.log(`    [page] ${m.text().slice(0, 200)}`); });
    }
    if (noDisk) {
        await page.addInitScript(() => {
            navigator.storage.getDirectory = () => Promise.reject(new DOMException('No disk here', 'SecurityError'));
        });
    }
    await page.goto(`${origin}/player.html${process.env.STREAM_DEBUG ? '?debug=1' : ''}`);
    await page.waitForFunction(() => !!window.player, null, { timeout: 60000 });
    return { page, errors };
}

/** Load a URL and wait until it is open. */
const load = (page, url) => page.evaluate(async (url) => {
    const p = window.player;
    await p.load(url);
    for (let i = 0; i < 400 && p.timing.pending; i++) await new Promise((r) => setTimeout(r, 25));
    const remote = p.media.remote;
    return { buffered: !!remote, kind: remote?.file.store.backend.kind ?? null, duration: p.duration };
}, url);

/** What the buffer keeps of the file playing, as [start, end) byte ranges. */
const kept = (page) => page.evaluate(() => window.player.media.remote?.file.downloadedRanges() ?? []);
const keptBytes = (ranges) => ranges.reduce((sum, [a, b]) => sum + b - a, 0);

/** Play until `seconds` of video have been shown, or the end. */
const playUntil = (page, seconds, limitMs = 60000) => page.evaluate(async ({ seconds, limitMs }) => {
    const p = window.player;
    if (!p.isPlaying) await p.play();
    const t0 = performance.now();
    while (p.currentTime < seconds && performance.now() - t0 < limitMs) {
        if (!p.isPlaying && p.currentTime >= p.duration - 0.2) break;
        await new Promise((r) => setTimeout(r, 50));
    }
    return p.currentTime;
}, { seconds, limitMs });

/** Count frames shown while playing to the end. */
const playToEnd = (page, limitMs = 60000) => page.evaluate(async (limitMs) => {
    const p = window.player;
    let shown = 0;
    const present = p.presentFrame.bind(p);
    p.presentFrame = (...args) => { shown++; return present(...args); };
    // From the start: a file played before resumes where it was left.
    await p.seek(0);
    if (!p.isPlaying) await p.play();
    const t0 = performance.now();
    while (performance.now() - t0 < limitMs) {
        await new Promise((r) => setTimeout(r, 50));
        if (!p.isPlaying && p.currentTime >= p.duration - 0.3) break;
    }
    p.presentFrame = present;
    return { shown, at: p.currentTime, duration: p.duration };
}, limitMs);

try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const { page, errors } = await openPlayer(context);
    const url = `${origin}/__remote__/film.mp4`;

    console.log('\nplaying through the buffer, and downloading while paused\n');
    remote.rate = 20 * 1024;   // a little under the video's bitrate
    remote.requests.length = 0;
    const opened = await load(page, url);
    check('a remote file opens through the buffer', opened.buffered && opened.kind === 'opfs', JSON.stringify(opened));
    const atLoad = keptBytes(await kept(page));
    await sleep(4000);
    const paused = keptBytes(await kept(page));
    check('paused, it keeps downloading ahead', paused > atLoad + 40 * 1024, `${atLoad} → ${paused} bytes in 4 s`);

    console.log('\na seek aborts the fetch it left behind\n');
    // A window of 2 s ahead (the setting), so the 12 s file has pieces
    // outside it; at a quarter of the bitrate each piece takes ~10 s.
    await page.evaluate(() => localStorage.setItem('jj:buffer', JSON.stringify({ ahead: 2, behind: 1 })));
    remote.rate = 6 * 1024;
    remote.requests.length = 0;
    await load(page, `${origin}/__remote__/seek.mp4`);
    await page.evaluate(() => window.player.play());
    // Playing, with the next piece on its way.
    const inFlight = () => remote.requests.some((r) => r.range?.[0] > 0 && r.sent < r.range[1] - r.range[0] + 1 && !r.closedEarly);
    for (let i = 0; i < 80 && !inFlight(); i++) await sleep(100);
    const beforeSeek = remote.requests.length;
    await page.evaluate(() => window.player.seek(10));
    await sleep(1500);
    const before = remote.requests.slice(0, beforeSeek);
    check('the fetch in flight before the seek was closed', before.some((r) => r.closedEarly),
        before.map((r) => `${r.range?.join('-')}${r.closedEarly ? ' closed' : ''}`).join(', '));
    const newOnes = remote.requests.slice(beforeSeek);
    check('and new requests start further on, where the seek landed',
        newOnes.length > 0 && newOnes.every((r) => r.range && r.range[0] >= video.length * 0.4),
        newOnes.map((r) => r.range?.join('-')).join(', '));
    await page.evaluate(() => { window.player.pause(); localStorage.removeItem('jj:buffer'); });

    console.log('\na seek back into what was downloaded\n');
    remote.rate = 0;
    await load(page, url);
    const end = await playUntil(page, 11.5);
    await page.evaluate(() => window.player.pause());
    const have = await kept(page);
    const startRange = have.find(([a]) => a === 0);
    const count = remote.requests.length;
    await page.evaluate(() => window.player.seek(1));
    const after = await playUntil(page, 2.5, 10000);
    await page.evaluate(() => window.player.pause());
    const asked = remote.requests.slice(count).filter((r) => r.range && startRange && r.range[0] < startRange[1]);
    check('plays it again', after >= 2.4, `played to ${after.toFixed(2)} s (had reached ${end.toFixed(2)} s)`);
    check('without asking the server for any of it', !!startRange && asked.length === 0,
        `kept ${JSON.stringify(have)}; asked ${asked.map((r) => r.range.join('-')).join(', ')}`);

    console.log('\nafter a reload, with the server gone\n');
    // Let it finish downloading the file, so the whole of it is kept.
    for (let i = 0; i < 40 && keptBytes(await kept(page)) < video.length; i++) await sleep(250);
    const whole = keptBytes(await kept(page));
    check('the whole file ends up kept (it fits the budget)', whole === video.length, `${whole} of ${video.length}`);
    await page.reload();
    await page.waitForFunction(() => !!window.player, null, { timeout: 60000 });
    remote.mode = 'down';
    remote.requests.length = 0;
    const reopened = await load(page, url);
    check('it opens with the server unreachable', reopened.buffered && reopened.duration > 11, JSON.stringify(reopened));
    const offline = await playToEnd(page, 30000);
    check('and plays through from what was kept', offline.shown >= 150 && offline.at >= offline.duration - 0.3,
        `${offline.shown} frames, to ${offline.at.toFixed(2)} s`);
    check('no request reached the server', remote.requests.length === 0, `${remote.requests.length}`);
    remote.mode = 'ranges';

    console.log('\na server that ignores ranges\n');
    remote.mode = 'whole';
    const plain = await load(page, `${origin}/__remote__/plain.mp4`);
    check('is not buffered', !plain.buffered);
    const plainRun = await playToEnd(page, 30000);
    check('but still plays, as before', plainRun.shown >= 150, `${plainRun.shown} frames`);
    remote.mode = 'ranges';

    check('no uncaught errors', errors.length === 0, errors.join(' | '));

    console.log('\na browser without file storage\n');
    const memoryContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const memoryPage = await openPlayer(memoryContext, { noDisk: true });
    const inMemory = await load(memoryPage.page, `${origin}/__remote__/memory.mp4`);
    check('the buffer keeps its pieces in memory', inMemory.buffered && inMemory.kind === 'memory', JSON.stringify(inMemory));
    const memoryRun = await playToEnd(memoryPage.page, 30000);
    check('and plays', memoryRun.shown >= 150, `${memoryRun.shown} frames`);
    check('no uncaught errors there either', memoryPage.errors.length === 0, memoryPage.errors.join(' | '));
} catch (error) {
    failed++;
    console.log(`  FAIL  the run itself threw: ${error.stack || error.message}`);
} finally {
    await browser.close();
    server.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
