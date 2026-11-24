/**
 * Runtime benchmarks (ARCHITECTURE_PLAN.md Q5), in the built app in a real
 * browser: time to the first frame, seek latency, dropped frames, memory
 * after 20 loads, and drawing a 2,000-item playlist.
 *
 * Every run prints the numbers (and adds them to the GitHub job summary when
 * there is one), so a trend shows up in CI history. Each has a budget, set
 * from the first runs with room for a slower CI machine: a number over its
 * budget fails the suite, because that is a regression worth a look, not
 * noise. Headless Chromium on a two-second fixture says nothing about how a
 * phone feels; it says whether a change made the same work slower.
 *
 *   npm run build && node scripts/bench-test.mjs
 */
import { createServer } from 'node:http';
import { readFile, stat, appendFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const FIXTURES = join(ROOT, 'scripts/fixtures');
const FIXTURE_PREFIX = '/__fixtures__/';
const VIDEO_URL = `${FIXTURE_PREFIX}smoke.webm`;     // 2 s, 320x180, 15 fps, no audio
const AV_URL = `${FIXTURE_PREFIX}smoke-av.webm`;     // 6 s, with an audio track

/**
 * Ceilings, from local and CI baselines with room to spare. Lower one when a
 * change makes the work cheaper for good; raising one needs a reason in the
 * PR that does it.
 */
const BUDGETS = {
    // Local baseline (Nov 2026, headless Chromium on the dev box) in brackets.
    firstFrameMs: 150,        // load() of a local file to its first frame, median of 5 [14]
    seekMs: 100,              // seek() to the frame shown, median of 10 [12]
    seekMaxMs: 300,           // the slowest of those 10 [15]
    droppedFrames: 3,         // late frames skipped while playing the 6 s A/V file [0]
    heapGrowthMb: 10,         // JS heap after 20 loads, minus after the first, after GC [0];
                              // decoder and GPU memory are outside the JS heap and not seen here
    playlistRenderMs: 400,    // render() of 2,000 top-level items (first batch of rows), laid out [65]
    playlistRerenderMs: 300,  // the same again after one item changed [20]
};

const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.gif': 'image/gif', '.jpg': 'image/jpeg',
    '.webm': 'video/webm', '.wasm': 'application/wasm', '.txt': 'text/plain',
    '.map': 'application/json', '.ico': 'image/x-icon',
};

async function serve() {
    const server = createServer(async (req, res) => {
        try {
            const path = decodeURIComponent(req.url.split('?')[0]);
            const file = path.startsWith(FIXTURE_PREFIX)
                ? join(FIXTURES, path.slice(FIXTURE_PREFIX.length))
                : join(DIST, path === '/' ? 'index.html' : path);
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
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

function findBrowser() {
    return [process.env.CHROMIUM_PATH, process.env.CHROME_PATH,
        '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ].filter(Boolean).find(p => existsSync(p));
}

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

// --- the measurements ---------------------------------------------------------

async function measure(page, origin) {
    await page.route('**/*', route => {
        const url = route.request().url();
        // Nothing leaves the machine (the analytics embed would count test runs).
        return url.startsWith(origin) || url.startsWith('blob:') || url.startsWith('data:')
            ? route.continue() : route.abort();
    });
    await page.goto(`${origin}/player.html`);
    await page.waitForFunction(() => !!window.player && !!window.playlist, null, { timeout: 60000 });

    // Each load gets a fresh blob URL, as opening a file does.
    await page.evaluate(async ([video, av]) => {
        const blobOf = async (url) => (await fetch(url)).blob();
        window.__bench = { video: await blobOf(video), av: await blobOf(av) };
        window.__bench.open = async (blob, name = 'bench.webm') => {
            const p = window.player;
            const sleep = ms => new Promise(r => setTimeout(r, ms));
            const t0 = performance.now();
            await p.load(URL.createObjectURL(new File([blob], name, { type: 'video/webm' })));
            // The first frame ends the load's timing (PlayerTiming).
            for (let i = 0; i < 300 && p.timing.pending; i++) await sleep(5);
            return performance.now() - t0;
        };
    }, [VIDEO_URL, AV_URL]);

    const results = {};

    // Time to first frame.
    const firstFrames = [];
    for (let i = 0; i < 5; i++) firstFrames.push(await page.evaluate(() => window.__bench.open(window.__bench.video)));
    results.firstFrameMs = round(median(firstFrames));

    // Seek latency: seek() resolves once the frame there is on screen.
    const seeks = await page.evaluate(async () => {
        const p = window.player;
        const times = [];
        for (const t of [0.2, 1.6, 0.8, 1.9, 0.1, 1.2, 0.5, 1.7, 0.9, 0.3]) {
            const t0 = performance.now();
            await p.seek(t);
            times.push(performance.now() - t0);
        }
        return times;
    });
    results.seekMs = round(median(seeks));
    results.seekMaxMs = round(Math.max(...seeks));

    // Dropped frames: play the A/V file through, counting the late frames
    // PlayerTiming would count (not the catch-up after the start).
    const playback = await page.evaluate(async () => {
        const p = window.player;
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        await window.__bench.open(window.__bench.av, 'bench-av.webm');
        await p.seek(0);
        let dropped = 0, shown = 0;
        const timing = p.timing;
        const framePresented = timing.framePresented.bind(timing);
        timing.framePresented = () => { shown++; framePresented(); };
        const lateFrame = timing.lateFrame.bind(timing);
        timing.lateFrame = () => {
            if (!timing.pending && performance.now() - timing.settledAt >= 500) dropped++;
            lateFrame();
        };
        await p.play();
        for (let i = 0; i < 60 && p.isPlaying; i++) await sleep(100);
        p.pause();
        timing.lateFrame = lateFrame;
        timing.framePresented = framePresented;
        return { dropped, shown, endedAt: p.currentTime };
    });
    results.droppedFrames = playback.dropped;

    // Memory after 20 loads, against after one, with a GC before each reading.
    results.heapGrowthMb = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const heap = async () => {
            for (let i = 0; i < 3; i++) { window.gc?.(); await sleep(100); }
            return performance.memory.usedJSHeapSize / (1024 * 1024);
        };
        await window.__bench.open(window.__bench.video);
        const before = await heap();
        for (let i = 0; i < 20; i++) await window.__bench.open(window.__bench.video);
        await window.player.reset();
        return (await heap()) - before;
    }).then(mb => round(mb, 2));

    // A 2,000-item playlist: drawing it, and drawing it again after a change.
    const playlist = await page.evaluate(async () => {
        const pl = window.playlist;
        const items = [];
        // At the top level, as files added one by one are: the list draws
        // its first batch of rows, not one collapsed folder.
        for (let i = 0; i < 2000; i++) {
            items.push({
                id: `bench-${i}`, title: `Episode ${i}.webm`, path: `Episode ${i}.webm`,
                url: '', duration: '0:42', thumbnail: '', isLocal: true, fileSize: 1e6,
                fileType: 'video/webm', mimeType: 'video/webm',
            });
        }
        pl.state.items.length = 0;
        pl.state.addItems(items);
        const draw = () => {
            const t0 = performance.now();
            pl.render();
            void pl.container.offsetHeight;   // include layout, which is most of a list's cost
            return performance.now() - t0;
        };
        const first = draw();
        pl.state.updateItem(1000, { title: 'Episode 1000 (renamed).webm' });
        const again = draw();
        return { first, again, rows: pl.container.querySelectorAll('*').length, loading: pl.isLoading };
    });
    results.playlistRenderMs = round(playlist.first);
    results.playlistRerenderMs = round(playlist.again);

    return { results, extra: { firstFrames, seeks, rows: playlist.rows, playback } };
}

// --- harness --------------------------------------------------------------------

if (!existsSync(join(DIST, 'player.html'))) {
    console.error('No build found. Run `npm run build` first.');
    process.exit(1);
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
    args: ['--no-sandbox', '--no-proxy-server', '--js-flags=--expose-gc',
        '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required'],
});

let failed = 0;
try {
    const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    const { results, extra } = await measure(page, origin);

    console.log('\nbenchmarks (headless Chromium; budgets in scripts/bench-test.mjs)\n');
    const rows = Object.entries(results).map(([name, value]) => {
        const budget = BUDGETS[name];
        const ok = value <= budget;
        if (!ok) failed++;
        console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(20)} ${String(value).padStart(8)}   budget ${budget}`);
        return `| ${name} | ${value} | ${budget} | ${ok ? 'ok' : '**over**'} |`;
    });
    console.log(`\n  first frames ${extra.firstFrames.map(x => round(x)).join(', ')} ms`);
    console.log(`  seeks ${extra.seeks.map(x => round(x)).join(', ')} ms`);
    console.log(`  playing the A/V file: ${extra.playback.shown} frames shown, stopped at ${round(extra.playback.endedAt, 2)} s`);
    console.log(`  playlist elements in the page after render: ${extra.rows}`);

    if (process.env.GITHUB_STEP_SUMMARY) {
        await appendFile(process.env.GITHUB_STEP_SUMMARY,
            ['', '### Benchmarks', '', '| measure | value | budget | |', '|---|---|---|---|', ...rows, ''].join('\n'));
    }
} catch (error) {
    failed++;
    console.log(`  FAIL  the run itself threw: ${error.stack || error.message}`);
} finally {
    await browser.close();
    server.close();
}

console.log(`\n${Object.keys(BUDGETS).length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
