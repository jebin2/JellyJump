/**
 * Drives the built app in a real browser and checks the things a change to
 * the core could break without any unit test noticing.
 *
 * Every browser check in this project has so far been written ad hoc in a
 * scratch directory and thrown away. That is fine for investigating a bug and
 * useless as a safety net: the core player is about to be taken apart into
 * components, and the parts most likely to break quietly -- opening a file,
 * seeking, the camera, recording -- have no coverage at all. This is the net.
 *
 * It needs a Chromium or Chrome binary. Point CHROMIUM_PATH at one if it is
 * somewhere unusual.
 *
 *   npm run build && npm run test:smoke
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const FIXTURES = join(ROOT, 'scripts/fixtures');
// Served under a prefix rather than one mapped file: HLS is a playlist plus
// its segments, so it needs a directory.
const FIXTURE_PREFIX = '/__fixtures__/';
const FIXTURE_URL = `${FIXTURE_PREFIX}smoke.webm`;
const HLS_URL = `${FIXTURE_PREFIX}hls/stream.m3u8`;

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.gif': 'image/gif', '.jpg': 'image/jpeg',
    '.webm': 'video/webm', '.mp4': 'video/mp4', '.wasm': 'application/wasm',
    '.txt': 'text/plain', '.map': 'application/json', '.ico': 'image/x-icon',
    '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t',
};

async function serveDist() {
    const server = createServer(async (req, res) => {
        try {
            const path = decodeURIComponent(req.url.split('?')[0]);
            const file = path.startsWith(FIXTURE_PREFIX)
                ? join(FIXTURES, path.slice(FIXTURE_PREFIX.length))
                : join(DIST, path === '/' ? 'index.html' : path);
            // Nothing outside dist or the fixtures, whatever the request says.
            if (!file.startsWith(DIST) && !file.startsWith(FIXTURES)) { res.writeHead(403).end(); return; }
            const info = await stat(file);
            if (!info.isFile()) { res.writeHead(404).end(); return; }
            res.writeHead(200, {
                'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
                'Content-Length': info.size,
                // The app wants these for its workers; without them the
                // player falls back and the test measures the wrong thing.
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Cross-Origin-Embedder-Policy': 'require-corp',
            });
            res.end(await readFile(file));
        } catch { res.writeHead(404).end(); }
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

function findBrowser() {
    const candidates = [
        process.env.CHROMIUM_PATH, process.env.CHROME_PATH,
        '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ].filter(Boolean);
    return candidates.find(p => existsSync(p));
}

// --- the checks -------------------------------------------------------------

async function run(page, origin) {
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => {
        if (m.type() !== 'error') return;
        const text = m.text();
        // Request failures are already covered by the response handler below,
        // which knows which URL they came from.
        if (text.includes('Failed to load resource')) return;
        errors.push(`console: ${text.slice(0, 160)}`);
    });
    page.on('response', r => {
        // The analytics embed is absent from the build and always 404s.
        if (r.status() >= 400 && !r.url().includes('analytics')) {
            errors.push(`${r.status()} ${r.url().replace(origin, '')}`);
        }
    });

    await page.goto(`${origin}/player.html`);
    await page.waitForFunction(() => !!window.player && !!window.playlist, null, { timeout: 60000 });

    console.log('\nit boots');
    check(true, 'player.html loads and exposes the player');

    const opened = await page.evaluate(async (url) => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const blob = await (await fetch(url)).blob();
        const p = window.player;
        await p.load(URL.createObjectURL(new File([blob], 'smoke.webm', { type: 'video/webm' })));
        for (let i = 0; i < 120 && !(p.duration > 0); i++) await sleep(100);
        return { duration: p.duration, canvas: `${p.canvas.width}x${p.canvas.height}`, frameRate: p.frameRate };
    }, FIXTURE_URL);

    console.log('\nit opens a file');
    check(Math.abs(opened.duration - 2) < 0.2, `duration is 2s (${opened.duration})`);
    check(opened.canvas === '320x180', `canvas matches the file (${opened.canvas})`);
    check(opened.frameRate === 15, `frame rate is exactly 15 (${opened.frameRate})`);

    const seeks = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const p = window.player, c = p.canvas;
        const hash = () => {
            const q = document.createElement('canvas');
            q.width = c.width; q.height = c.height;
            q.getContext('2d').drawImage(c, 0, 0);
            const d = q.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) >>> 0;
            return h;
        };
        const at = async t => { await p._seekTo(t); await sleep(400); return hash(); };
        const a = await at(0.4), b = await at(1.6), again = await at(0.4);
        await p.play().catch(() => {});
        await sleep(600);
        const advanced = p.currentTime > 0.6;
        p.pause();
        return { a, b, again, advanced };
    });

    console.log('\nit seeks and plays');
    check(seeks.a !== seeks.b, 'different timestamps draw different frames');
    check(seeks.a === seeks.again, 'seeking back to a timestamp reproduces the frame exactly');
    check(seeks.advanced, 'playback advances the clock');

    // Clicks on the progress bar can arrive faster than a seek completes. The
    // clock always ends up on the last one; the canvas used to be free to keep
    // a frame decoded for an earlier one, so the picture disagreed with the
    // reported position. Measured at 7 failures in 12 before the input paths
    // were coalesced, so a handful of attempts is enough to catch a regression.
    const bar = await page.evaluate(() => {
        const r = window.player.ui.progressContainer.getBoundingClientRect();
        window.__frameHash = () => {
            const c = window.player.canvas;
            const q = document.createElement('canvas');
            q.width = c.width; q.height = c.height;
            q.getContext('2d').drawImage(c, 0, 0);
            const d = q.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) >>> 0;
            return h;
        };
        return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const clickBar = frac => page.mouse.click(bar.x + bar.w * frac, bar.y + bar.h / 2);
    const settleBar = async frac => {
        await clickBar(frac);
        await page.waitForTimeout(500);
        return page.evaluate(() => window.__frameHash());
    };

    await settleBar(0.95);
    const quietClick = await settleBar(0.20);
    let stormsAgreeing = 0;
    const storms = 5;
    for (let i = 0; i < storms; i++) {
        await settleBar(0.95);
        for (const f of [0.80, 0.45, 0.60]) await clickBar(f);
        await clickBar(0.20);
        await page.waitForTimeout(1800);
        const h = await page.evaluate(() => window.__frameHash());
        if (h === quietClick) stormsAgreeing++;
    }

    check(stormsAgreeing === storms,
        `rapid bar clicks leave the frame for the last one (${stormsAgreeing}/${storms})`);

    const overlays = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const p = window.player;
        p.videoFilters.applyPreset('grayscale');
        await sleep(150);
        const colourOnly = p.videoFilters.canvasMode;
        const s = p.stickers.addEmoji('x');
        s.x = 0.05; s.y = 0.05; s.w = 0.3;
        await p._seekTo(0.4); await sleep(350);
        const withSticker = p.videoFilters.canvasMode;
        let shot = false;
        try { await p.screenshotManager.capture(); await sleep(350);
              shot = (p.screenshotManager.screenshotDataUrl || '').startsWith('data:image/png'); } catch { /* reported below */ }
        p.stickers.clear();
        await sleep(150);
        const cleared = p.videoFilters.canvasMode;
        p.videoFilters.reset();
        return { colourOnly, withSticker, cleared, shot };
    });

    console.log('\nit composites overlays and screenshots');
    check(overlays.colourOnly === false, 'a colour effect alone does not bake into the frame');
    check(overlays.withSticker === true, 'a sticker switches baking on, so it keeps its own colour');
    check(overlays.cleared === false, 'and removing it switches baking back off');
    check(overlays.shot === true, 'a screenshot of a filtered, stickered frame is produced');

    const camera = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const p = window.player;
        const out = {};
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        await p.loadWebcamStream(stream);
        await sleep(500);
        out.cameraBakes = p.videoFilters.canvasMode;

        await p.startCanvasRecording({});
        const wall0 = performance.now();
        await sleep(800);
        p.pause();
        await sleep(800);                       // this gap must not reach the file
        await p.play().catch(() => {});
        await sleep(800);
        out.played = p.stream.recorder.clock.videoSeconds;
        out.wall = (performance.now() - wall0) / 1000;

        const blob = await p.stopCanvasRecording();
        out.bytes = blob ? blob.size : 0;
        p.stopWebcamStreamMode();
        stream.getTracks().forEach(t => t.stop());
        return out;
    });

    console.log('\nit records the camera, and a pause stays out of the file');
    check(camera.cameraBakes === true, 'the camera bakes effects so the recorder can see them');
    check(camera.bytes > 1000, `a recording comes back with content (${camera.bytes} bytes)`);
    check(camera.wall > 2.2, `wall time across the run was ${camera.wall.toFixed(2)}s`);
    check(camera.played < camera.wall - 0.5,
        `recorded time follows played time, not wall time (${camera.played.toFixed(2)}s)`);

    const hls = await page.evaluate(async (url) => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const p = window.player, o = {};
        await p.load(`${location.origin}${url}`);
        for (let i = 0; i < 100 && !(p.duration > 0); i++) await sleep(100);
        o.duration = p.duration;
        o.videoTrack = !!p.videoTrack;
        o.audioTrack = !!p.audioTrack;
        await p.play().catch(() => {});
        await sleep(1200);
        const c = p.canvas;
        const probe = document.createElement('canvas');
        probe.width = c.width; probe.height = c.height;
        probe.getContext('2d').drawImage(c, 0, 0);
        const d = probe.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let ink = 0;
        for (let i = 0; i < d.length; i += 997) if (d[i] > 8) ink++;
        o.framesDrawn = ink > 0;
        p.pause();
        return o;
    }, HLS_URL);

    console.log('\nit plays an HLS playlist');
    // Every one of these was wrong before the DTS codec read was fixed: setup
    // aborted, so the duration stayed 0 and the audio track never existed,
    // while frames still reached the canvas and made it look half-working.
    check(Math.abs(hls.duration - 3) < 0.3, `duration is 3s (${hls.duration})`);
    check(hls.videoTrack, 'the video track is there');
    check(hls.audioTrack, 'and so is the audio track');
    check(hls.framesDrawn, 'frames reach the canvas');

    console.log('\nnothing failed quietly');
    check(errors.length === 0, `no page errors or bad responses${errors.length ? `: ${errors.slice(0, 3).join('; ')}` : ''}`);
}

// --- harness ----------------------------------------------------------------

if (!existsSync(join(DIST, 'player.html'))) {
    console.error('No build found. Run `npm run build` first.');
    process.exit(1);
}
const browserPath = findBrowser();
if (!browserPath) {
    console.error('No Chromium or Chrome found. Set CHROMIUM_PATH to a browser binary.');
    process.exit(1);
}

let chromium;
try {
    ({ chromium } = await import('playwright-core'));
} catch {
    console.error('playwright-core is missing. Run `npm install`.');
    process.exit(1);
}

const { server, origin } = await serveDist();
// launch() already gives each run its own throwaway profile, so nothing is
// shared between runs. What does interfere is a browser left alive by a run
// that was killed before its cleanup: several headed instances on one display
// slow the boot enough to trip the wait below, which looks like the app
// failing and is not.
const browser = await chromium.launch({
    executablePath: browserPath,
    args: ['--no-sandbox', '--no-proxy-server',
        '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
try {
    const context = await browser.newContext({ permissions: ['camera'], viewport: { width: 1280, height: 800 } });
    await run(await context.newPage(), origin);
} catch (error) {
    fail++;
    console.log(`  FAIL  the run itself threw: ${error.message}`);
} finally {
    await browser.close();
    server.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
