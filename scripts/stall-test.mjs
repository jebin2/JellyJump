/**
 * A source slower than the video (a remote file on a slow link): the player
 * waits for data instead of playing on without it (core/playback/BufferingGuard).
 *
 * Before, the clock ran on while the sound and the picture had run out, and
 * every buffer that then arrived was already late and dropped: the timer
 * reached the end with the picture stuck a few seconds in. Here the fixture
 * (12 s, 180 frames, ~24 KB/s) is served at a quarter of its bitrate after the first
 * 40 KB, and played through: nearly every frame must be shown, the spinner
 * must have come up while waiting, and the clock must never run far past the
 * picture.
 *
 *   npm run build && node scripts/stall-test.mjs
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
// An MP4 with its index first (faststart), so it is read as it plays, as a
// remote file is; a WebM without cues is read whole before it starts.
const FIXTURE = join(ROOT, 'scripts/fixtures/stall-av.mp4');   // 12 s, 15 fps, H.264 + AAC, ~24 KB/s
const FRAMES = 180;
const FAST_BYTES = 40 * 1024;
const SLOW_BYTES_PER_SEC = 6 * 1024;

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

/** Bytes of the fixture already sent, across requests: the link is slow, not each request. */
let sent = 0;
/** When the shared link is next free (ms): requests made side by side share the rate. */
let linkFreeAt = 0;
async function takeTurn(bytes) {
    const now = Date.now();
    const at = Math.max(now, linkFreeAt);
    linkFreeAt = at + (bytes / SLOW_BYTES_PER_SEC) * 1000;
    await sleep(at - now);
}
/** The fixture with Range support, fast for its first FAST_BYTES and then at SLOW_BYTES_PER_SEC. */
async function serveSlow(req, res) {
    const range = /bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
    const start = range ? Number(range[1]) : 0;
    const end = range && range[2] ? Math.min(Number(range[2]), video.length - 1) : video.length - 1;
    res.writeHead(range ? 206 : 200, {
        'Content-Type': 'video/mp4',
        'Content-Length': end - start + 1,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
        ...(range ? { 'Content-Range': `bytes ${start}-${end}/${video.length}` } : {}),
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin',
    });
    const CHUNK = 1024;
    for (let at = start; at <= end; at += CHUNK) {
        if (res.destroyed) return;
        const piece = video.subarray(at, Math.min(at + CHUNK, end + 1));
        if (sent > FAST_BYTES) await takeTurn(piece.length);
        if (res.destroyed) return;
        res.write(piece);
        sent += piece.length;
    }
    res.end();
}

const server = createServer(async (req, res) => {
    try {
        const path = decodeURIComponent(req.url.split('?')[0]);
        if (path === '/__slow__/stall-av.mp4') return serveSlow(req, res);
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

try {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    // STALL_DEBUG=1 prints the player's own log (buffering, frame sync, audio).
    if (process.env.STALL_DEBUG) {
        page.on('console', (message) => {
            const text = message.text();
            if (/Buffering|FrameSync|Audio\]|Seek|Video way|Net:/.test(text)) console.log(`    [page] ${text.slice(0, 200)}`);
        });
    }
    await page.goto(`${origin}/player.html${process.env.STALL_DEBUG ? '?debug=1' : ''}`);
    await page.waitForFunction(() => !!window.player, null, { timeout: 60000 });

    /** Play the file through from a fresh load; optionally seek once, after `seekAt` s of play. */
    const playThrough = (url, seekAt = null, seekTo = null) => page.evaluate(async ({ url, seekAt, seekTo }) => {
        const p = window.player;
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const loadStart = performance.now();
        await p.load(url);
        for (let i = 0; i < 400 && p.timing.pending; i++) await sleep(25);
        const loadSec = (performance.now() - loadStart) / 1000;

        // Count what reaches the screen, and how far the clock gets ahead of it.
        let shown = 0;
        let shownAfterSeek = 0;
        let seeked = false;
        let lastShownTs = 0;
        const present = p.presentFrame.bind(p);
        p.presentFrame = (...args) => {
            shown++;
            if (seeked) shownAfterSeek++;
            lastShownTs = p.currentTime;
            return present(...args);
        };
        let spinnerSeen = false;
        let waits = 0;
        let wasLoading = false;
        let worstLead = 0;
        let ended = false;
        const onEnded = () => { ended = true; };
        p.on('ended', onEnded);

        await p.play();
        const t0 = performance.now();
        while (!ended && performance.now() - t0 < 90000) {
            await sleep(50);
            if (seekAt !== null && !seeked && p.currentTime >= seekAt) {
                seeked = true;
                await p.seek(seekTo);
                lastShownTs = p.currentTime;
                continue;
            }
            if (p.isLoading) spinnerSeen = true;
            if (p.isPlaying && p.isLoading && !wasLoading) waits++;
            wasLoading = p.isLoading;
            if (p.isPlaying) worstLead = Math.max(worstLead, p.currentTime - lastShownTs);
            if (!p.isPlaying && p.currentTime >= p.duration - 0.2) break;
        }
        p.presentFrame = present;
        p.off?.('ended', onEnded);
        return { loadSec, shown, shownAfterSeek, spinnerSeen, waits, worstLead, ended, at: p.currentTime,
            duration: p.duration, wallSec: (performance.now() - t0) / 1000 };
    }, { url, seekAt, seekTo });

    const report = (run) => {
        console.log(`  load took ${run.loadSec.toFixed(1)} s; ${run.shown} frames shown, clock ${run.at.toFixed(2)} `
            + `of ${run.duration.toFixed(2)} s, ${run.wallSec.toFixed(1)} s of wall time, `
            + `worst lead of the clock over the picture ${run.worstLead.toFixed(2)} s, ${run.waits} waits for data\n`);
    };

    console.log(`\nplaying a 12 s file served at a quarter of its bitrate (after the first ${FAST_BYTES / 1024} KB)\n`);
    const run = await playThrough(`${origin}/__slow__/stall-av.mp4?run=1`);
    report(run);
    check('it plays to the end', run.ended || run.at >= run.duration - 0.3, `at ${run.at.toFixed(2)} s`);
    check('it took longer than the video (it waited for data)', run.wallSec > run.duration + 2, `${run.wallSec.toFixed(1)} s`);
    check('the spinner showed while it waited', run.spinnerSeen);
    check('nearly every frame was shown, none skipped for being late', run.shown >= FRAMES * 0.8, `${run.shown} of ${FRAMES}`);
    check('the clock never ran far past the picture', run.worstLead < 1.0, `${run.worstLead.toFixed(2)} s`);
    // A link at a quarter of the bitrate needs ~3x the video's length of
    // waiting; growing the cushion each time keeps that to a few waits rather
    // than one every second or two.
    check('a few long waits rather than many short ones', run.waits <= 6, `${run.waits} waits`);

    // The case reported: a seek into a part not downloaded yet, then play on.
    sent = 0;
    linkFreeAt = 0;
    const SEEK_TO = 6;
    console.log(`\nthe same, with a seek from 1 s to ${SEEK_TO} s once playing\n`);
    const seekRun = await playThrough(`${origin}/__slow__/stall-av.mp4?run=2`, 1, SEEK_TO);
    report(seekRun);
    const afterSeek = (seekRun.duration - SEEK_TO) * 15;
    check('after the seek it plays to the end', seekRun.ended || seekRun.at >= seekRun.duration - 0.3, `at ${seekRun.at.toFixed(2)} s`);
    check('nearly every frame after the seek was shown', seekRun.shownAfterSeek >= afterSeek * 0.8,
        `${seekRun.shownAfterSeek} of ${afterSeek}`);
    check('the clock never ran far past the picture after the seek', seekRun.worstLead < 1.0, `${seekRun.worstLead.toFixed(2)} s`);
    // Seek-bar thumbnails are not made for a file streamed from the network:
    // they read frames from all over it and starved its playback.
    sent = 0;
    const thumbs = await page.evaluate(async () => {
        const t = window.player.thumbnails;
        t.generationStarted = false;
        await t.startGeneration();
        return { generating: !!t.generator?.isGenerating, made: t.generator?.thumbnails?.length ?? 0 };
    });
    await new Promise((r) => setTimeout(r, 500));
    check('no seek-bar thumbnails are made for a file streamed from the network',
        !thumbs.generating && thumbs.made === 0 && sent === 0, `${JSON.stringify(thumbs)}, ${sent} bytes read`);
    check('no uncaught errors', errors.length === 0, errors.join(' | '));
} catch (error) {
    failed++;
    console.log(`  FAIL  the run itself threw: ${error.stack || error.message}`);
} finally {
    await browser.close();
    server.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
