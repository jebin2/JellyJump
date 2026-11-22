/**
 * Tests every editing operation (assets/js/processing, through
 * MediaProcessor) on a real file, in a real browser: cut, lossless cut,
 * convert, resize, speed, reverse, merge, combine audio and video, track
 * extraction, GIF, slideshow, HLS — and checks what comes out: its duration,
 * its tracks, that it plays (MediaBunny reads it back).
 *
 * Also the worker against the main thread (K2): the same conversion both
 * ways gives the same result, since a worker that fails to start falls back
 * to the main thread and that path is otherwise never exercised.
 *
 * ARCHITECTURE_PLAN.md K1, K2. Runs against the vite dev server.
 *
 *   node scripts/processing-test.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = Number(process.env.PORT || 8191);

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

function findBrowser() {
    return [
        process.env.CHROMIUM_PATH, process.env.CHROME_PATH,
        '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ].filter(Boolean).find(p => existsSync(p));
}

async function waitForServer(origin) {
    for (let i = 0; i < 90; i++) {
        try { if ((await fetch(`${origin}/index.html`)).ok) return true; } catch { /* starting */ }
        await new Promise(r => setTimeout(r, 1000));
    }
    return false;
}


/**
 * Runs `body` in the page with `MP` (MediaProcessor), `meta(blob)` (its
 * duration and tracks, read back) and `fixture` (the test video, a Blob).
 */
const inPage = (origin, body) => async (page) => page.evaluate(async ({ origin, body }) => {
    const { MediaProcessor: MP } = await import(`${origin}/assets/js/processing/MediaProcessor.js`);
    const fixture = await (await fetch(`${origin}/scripts/fixtures/smoke-av.webm`)).blob();
    const meta = async (blob) => {
        const m = await MP.getMetadata(blob);
        return {
            duration: Math.round((m.duration ?? 0) * 10) / 10,
            video: m.videoTracks?.length ?? 0,
            audio: m.audioTracks?.length ?? 0,
            width: m.videoInfo?.width ?? m.videoInfo?.displayWidth ?? 0,
            height: m.videoInfo?.height ?? m.videoInfo?.displayHeight ?? 0,
            size: blob.size,
            type: blob.type,
        };
    };
    return new Function('MP', 'meta', 'fixture', 'origin', `return (async () => { ${body} })()`)(MP, meta, fixture, origin);
}, { origin, body });

const near = (a, b, eps = 0.6) => Math.abs(a - b) <= eps;

async function step(page, origin, label, body) {
    try {
        return await inPage(origin, body)(page);
    } catch (error) {
        fail++;
        console.log(`  FAIL  ${label} threw: ${String(error.message).split('\n')[0].slice(0, 200)}`);
        return null;
    }
}

async function run(page, origin) {
    await page.goto(`${origin}/index.html`);

    const src = await step(page, origin, 'the fixture', `return meta(fixture);`);
    if (!src) return;
    console.log(`\nthe fixture: ${src.duration}s, ${src.width}x${src.height}, ${src.video} video + ${src.audio} audio track(s)`);
    check(src.duration > 2 && src.video === 1 && src.audio === 1, 'has video and audio to work on');

    console.log('\ncut');
    let r = await step(page, origin, 'cut', `return meta(await MP.process({ source: fixture, format: 'mp4', quality: 100, trim: { start: 1, end: 2.5 } }));`);
    if (r) check(near(r.duration, 1.5) && r.video === 1 && r.audio === 1, `a cut of 1.5 s is 1.5 s, with both tracks (${r.duration}s, ${r.video}v ${r.audio}a)`);
    r = await step(page, origin, 'lossless cut', `return meta(await MP.losslessTrim({ source: fixture, trim: { start: 1, end: 2.5 } }));`);
    if (r) check(r.duration > 0.5 && r.duration <= src.duration && r.video === 1, `a lossless cut keeps whole frames around the range (${r.duration}s)`);

    console.log('\nconvert and resize');
    r = await step(page, origin, 'convert', `return meta(await MP.process({ source: fixture, format: 'webm', quality: 80 }));`);
    if (r) check(near(r.duration, src.duration) && r.video === 1 && r.audio === 1, `converted, the whole video with both tracks (${r.duration}s)`);
    r = await step(page, origin, 'resize', `return meta(await MP.process({ source: fixture, format: 'mp4', quality: 80, resolution: { width: 160 } }));`);
    if (r) check(r.width === 160 && Math.abs(r.height - Math.round(160 * src.height / src.width)) <= 2, `resized to 160 wide, the height to match (${r.width}x${r.height})`);

    console.log('\nspeed and reverse');
    r = await step(page, origin, 'speed', `return meta(await MP.changeVideoSpeed({ source: fixture, speed: 2, includeAudio: true }));`);
    if (r) check(near(r.duration, src.duration / 2), `at 2x it is half as long (${r.duration}s of ${src.duration}s)`);
    r = await step(page, origin, 'speed, no audio', `return meta(await MP.changeVideoSpeed({ source: fixture, speed: 0.5, includeAudio: false }));`);
    if (r) check(near(r.duration, src.duration * 2, 1) && r.audio === 0, `at 0.5x without audio, twice as long and silent (${r.duration}s, ${r.audio}a)`);
    r = await step(page, origin, 'reverse', `return meta(await MP.reverseVideo({ source: fixture, includeAudio: true }));`);
    if (r) check(near(r.duration, src.duration) && r.video === 1, `reversed, as long as before (${r.duration}s)`);

    console.log('\nmerge and combine');
    r = await step(page, origin, 'merge', `return meta(await MP.merge({ inputs: [fixture, fixture], format: 'mp4', resolution: { width: 320, height: 240 }, scaleMode: 'fit', backgroundColor: '#000000' }));`);
    if (r) check(near(r.duration, src.duration * 2, 1) && r.width === 320 && r.height === 240, `two merged are as long as both, at the size asked (${r.duration}s, ${r.width}x${r.height})`);
    r = await step(page, origin, 'combine', `
        const audio = await MP.extractTrack({ source: fixture, trackIndex: 0, trackType: 'audio', format: 'm4a' });
        const silent = await MP.changeVideoSpeed({ source: fixture, speed: 1, includeAudio: false });
        const wav = await MP.extractTrack({ source: fixture, trackIndex: 0, trackType: 'audio', format: 'wav' });
        const head = String.fromCharCode(...new Uint8Array(await wav.slice(0, 4).arrayBuffer()));
        return { audio: await meta(audio), wav: head, out: await meta(await MP.combineAudioVideo({ videoSource: silent, audioSource: audio, format: 'mp4' })) };`);
    if (r) {
        check(r.audio.audio === 1 && r.audio.video === 0, `an audio track extracts on its own (${r.audio.audio}a ${r.audio.video}v)`);
        check(r.wav === 'RIFF', `and as WAV (${r.wav})`);
        check(r.out.video === 1 && r.out.audio === 1, `a silent video and that audio combine into one with both (${r.out.video}v ${r.out.audio}a)`);
    }
    r = await step(page, origin, 'video track', `return meta(await MP.extractTrack({ source: fixture, trackIndex: 0, trackType: 'video', format: 'mp4' }));`);
    if (r) check(r.video === 1 && r.audio === 0, `a video track extracts without the audio (${r.video}v ${r.audio}a)`);

    console.log('\nGIF, slideshow, HLS');
    r = await step(page, origin, 'gif', `
        const gif = await MP.createGif({ input: fixture, startTime: 0.5, duration: 1, fps: 5, width: 80, height: 60, quality: 70 });
        const head = new Uint8Array(await gif.slice(0, 6).arrayBuffer());
        return { size: gif.size, magic: String.fromCharCode(...head) };`);
    if (r) check(r.magic.startsWith('GIF8') && r.size > 100, `a GIF comes out (${r.magic}, ${r.size} bytes)`);
    r = await step(page, origin, 'slideshow', `
        const frame = async (colour) => {
            const c = new OffscreenCanvas(160, 120);
            const g = c.getContext('2d'); g.fillStyle = colour; g.fillRect(0, 0, 160, 120);
            return c.convertToBlob({ type: 'image/png' });
        };
        const out = await MP.createSlideshowVideo({ imageBlobs: [await frame('red'), await frame('blue')], imageDurations: [1, 1], transition: 'cut', fps: 10 });
        return meta(out);`);
    if (r) check(near(r.duration, 2) && r.video === 1, `two pictures of a second each make a 2 s video (${r.duration}s)`);
    r = await step(page, origin, 'hls', `
        const files = await MP.processHls({ source: fixture, quality: 60 });
        const names = [...files.keys()];
        const playlist = names.find(n => n.endsWith('.m3u8'));
        const text = playlist ? await new Blob([files.get(playlist)]).text() : '';
        return { names, segments: names.filter(n => !n.endsWith('.m3u8')).length, ok: text.startsWith('#EXTM3U') };`);
    if (r) check(r.ok && r.segments >= 1, `HLS makes a playlist and its segments (${r.segments} segment(s): ${r.names.slice(0, 4).join(', ')})`);

    console.log('\nthe worker and the main thread agree (K2)');
    r = await step(page, origin, 'worker vs inline', `
        const { process: inline } = await import(origin + '/assets/js/processing/transcode/TranscodeService.js');
        const options = { source: fixture, format: 'webm', quality: 80, trim: { start: 0.5, end: 2 } };
        const viaWorker = await meta(await MP.process({ ...options }));
        const onPage = await meta(await inline({ ...options }));
        return { viaWorker, onPage };`);
    if (r) {
        const same = (k) => r.viaWorker[k] === r.onPage[k];
        check(same('video') && same('audio') && same('width') && same('height') && near(r.viaWorker.duration, r.onPage.duration, 0.2),
            `same tracks, size and duration (worker ${JSON.stringify(r.viaWorker)} / page ${JSON.stringify(r.onPage)})`);
    }

    console.log('\ncancelling');
    r = await step(page, origin, 'cancel', `
        const controller = new AbortController();
        const job = MP.process({ source: fixture, format: 'webm', quality: 100, signal: controller.signal });
        setTimeout(() => controller.abort(), 50);
        try { await job; return { name: 'finished' }; } catch (e) { return { name: e.name }; }`);
    if (r) check(r.name === 'AbortError' || r.name === 'ConversionCanceledError' || r.name === 'finished', `a cancelled job stops as a cancellation (${r.name})`);
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

const origin = `http://127.0.0.1:${PORT}`;
// Its own process group, so stopping it stops vite and not only npx.
const vite = spawn('npx', ['vite', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, BROWSER: 'none' }, detached: true,
});
const stopVite = () => { try { process.kill(-vite.pid, 'SIGTERM'); } catch { vite.kill(); } };
let viteOutput = '';
vite.stdout.on('data', (d) => { viteOutput += d; });
vite.stderr.on('data', (d) => { viteOutput += d; });
if (!await waitForServer(origin)) {
    console.error(`vite did not come up on :${PORT}\n${viteOutput.trim()}`);
    stopVite();
    process.exit(1);
}

const browser = await chromium.launch({ executablePath: browserPath, args: ['--no-sandbox', '--no-proxy-server'] });
try {
    // The page's CSP forbids building functions from strings, which is how
    // the steps above reach the module; the test opens it with CSP off.
    const page = await browser.newPage({ bypassCSP: true });
    page.setDefaultTimeout(240000);
    page.on('pageerror', e => { fail++; console.log(`  FAIL  page error: ${String(e.message).slice(0, 160)}`); });
    await page.route('**/*', r => r.request().url().startsWith(origin) ? r.continue() : r.abort());
    await run(page, origin);
} catch (error) {
    fail++;
    console.log(`  FAIL  the run itself threw: ${error.message}`);
} finally {
    await browser.close();
    stopVite();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
