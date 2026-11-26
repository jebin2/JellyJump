/**
 * Records the real app for the demo: a 1920×1080 Chromium, driven like a
 * person would (a cursor that moves and clicks), with a caption per scene.
 * Frames come from the browser's own screencast (sharp, not a re-encoded
 * stream) and are written to scripts/demo/out/frames/ with their times, for
 * compose.mjs. Waiting on a background job is left out of the recording.
 *
 *   npm run build && bash scripts/demo/make-clips.sh && node scripts/demo/record.mjs
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { serve, openBrowser, openPlayerWithClips, OUT } from './harness.mjs';

const FRAMES = join(OUT, 'frames');
const CLIPS = ['Aurora.mp4', 'Fractal Dive.mp4', 'City of Life.mp4'];

rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

const { server, origin } = await serve();
const { browser, context } = await openBrowser();
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await openPlayerWithClips(page, origin, CLIPS);

// Off camera: each clip played a moment, so the playlist shows thumbnails.
for (let i = CLIPS.length - 1; i >= 0; i--) {
    await page.evaluate(async (i) => {
        await window.playlist.selectItem(i, true);
        await new Promise((r) => setTimeout(r, 1500));
    }, i);
}
await page.evaluate(async () => {
    const p = window.playlist.player;
    p.pause();
    await p.seek(0);
});

// The cursor and the caption, drawn into the page (never clickable).
await page.addStyleTag({ content: `
    #demo-cursor { position: fixed; left: 0; top: 0; width: 28px; height: 28px; z-index: 2147483647; pointer-events: none;
        transform: translate(-3px, -2px); filter: drop-shadow(2px 3px 2px rgba(0,0,0,.6)); }
    #demo-cursor .ring { position: absolute; left: -16px; top: -16px; width: 32px; height: 32px; border-radius: 50%;
        border: 3px solid #00ff88; opacity: 0; transform: scale(.4); }
    #demo-cursor.click .ring { animation: demo-ring .45s ease-out; }
    @keyframes demo-ring { 0% { opacity: 1; transform: scale(.4); } 100% { opacity: 0; transform: scale(1.6); } }
    #demo-caption { position: fixed; left: 40px; top: 36px; z-index: 2147483646; pointer-events: none;
        font: 700 40px/1.15 'Space Grotesk', sans-serif; color: #fff; background: #0a0a0a; border: 4px solid #00ff88;
        box-shadow: 8px 8px 0 #00ff88; padding: 16px 26px; max-width: 1180px;
        opacity: 0; transform: translateY(-12px); transition: opacity .35s ease, transform .35s ease; }
    #demo-caption.on { opacity: 1; transform: none; }
    #demo-caption small { display: block; font: 400 24px/1.4 'Space Mono', monospace; color: #00ff88; margin-top: 6px; }
` });
await page.evaluate(() => {
    const cursor = document.createElement('div');
    cursor.id = 'demo-cursor';
    cursor.innerHTML = '<div class="ring"></div><svg width="28" height="28" viewBox="0 0 28 28"><path d="M3 2 L3 23 L9 17.5 L13 26 L17 24.2 L13 16 L21 16 Z" fill="#fff" stroke="#0a0a0a" stroke-width="2" stroke-linejoin="round"/></svg>';
    document.body.append(cursor);
    document.addEventListener('mousemove', (e) => { cursor.style.left = `${e.clientX}px`; cursor.style.top = `${e.clientY}px`; }, true);
    const caption = document.createElement('div');
    caption.id = 'demo-caption';
    document.body.append(caption);
});

// --- recording -----------------------------------------------------------------
const cdp = await context.newCDPSession(page);
/** @type {Array<{file: string, t: number}>} */
const frames = [];
let paused = false;
let pausedFor = 0;
let pausedAt = 0;
let count = 0;
cdp.on('Page.screencastFrame', ({ data, sessionId }) => {
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
    if (paused) return;
    const file = `f${String(count++).padStart(6, '0')}.jpg`;
    writeFileSync(join(FRAMES, file), Buffer.from(data, 'base64'));
    frames.push({ file, t: (Date.now() - pausedFor) / 1000 });
});
const pause = () => { if (!paused) { paused = true; pausedAt = Date.now(); } };
const resume = () => { if (paused) { pausedFor += Date.now() - pausedAt; paused = false; } };

// --- acting --------------------------------------------------------------------
let mouse = { x: 960, y: 600 };
const wait = (ms) => page.waitForTimeout(ms);
/** Glide the cursor to (x, y) over `ms`, eased. */
async function glide(x, y, ms = 700) {
    // By the clock, not by steps: each move is a round trip to the browser.
    const from = { ...mouse };
    const start = Date.now();
    for (;;) {
        const k = Math.min(1, (Date.now() - start) / ms);
        const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
        await page.mouse.move(from.x + (x - from.x) * e, from.y + (y - from.y) * e);
        if (k >= 1) break;
        await wait(10);
    }
    mouse = { x, y };
}
async function centerOf(selector) {
    const box = await page.locator(selector).first().boundingBox();
    if (!box) throw new Error(`not on screen: ${selector}`);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}
async function click(selector, { ms = 700, after = 500 } = {}) {
    const started = Date.now();
    const { x, y } = await centerOf(selector).catch((e) => { console.log(`  skipped ${selector} after ${Date.now() - started} ms`); throw e; });
    await glide(x, y, ms);
    await page.evaluate(() => {
        const c = document.getElementById('demo-cursor');
        c.classList.remove('click'); void c.offsetWidth; c.classList.add('click');
    });
    await page.mouse.click(x, y);
    await wait(after);
}
async function caption(title, sub = '') {
    await page.evaluate(({ title, sub }) => {
        const c = document.getElementById('demo-caption');
        c.classList.remove('on');
        setTimeout(() => {
            c.innerHTML = '';
            c.append(title);
            if (sub) { const s = document.createElement('small'); s.textContent = sub; c.append(s); }
            if (title) c.classList.add('on');
        }, title ? 350 : 0);
    }, { title, sub });
}
/** Leave out the moment a clip reloads (a black picture), until it shows again. */
async function settledPicture({ play = false } = {}) {
    pause();
    await page.waitForFunction(() => !window.playlist.player.isLoading && window.playlist.player.duration > 0, null, { timeout: 30000 });
    if (play) {
        await page.evaluate(() => window.playlist.player.play()).catch(() => {});
        await page.waitForFunction(() => window.playlist.player.isPlaying, null, { timeout: 10000 }).catch(() => {});
    }
    await wait(700);
    resume();
}
/** The clip just clicked is open and playing; its load is left out of the video. */
async function playing(title) {
    pause();
    await page.waitForFunction((title) => {
        const pl = window.playlist;
        return pl.items[pl.activeIndex]?.title.toLowerCase().startsWith(title.toLowerCase()) && !pl.player.isLoading && pl.player.duration > 0;
    }, title, { timeout: 30000 });
    await page.evaluate(() => { if (!window.playlist.player.isPlaying) return window.playlist.player.play(); });
    await page.waitForFunction(() => window.playlist.player.isPlaying && window.playlist.player.currentTime > 0.15, null, { timeout: 10000 });
    resume();
}

// A step that cannot be done is skipped quickly, not after 30 s.
page.setDefaultTimeout(4000);
await page.mouse.move(mouse.x, mouse.y);
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 85, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 });
const scenes = [];
const scene = (name) => scenes.push({ name, t: (Date.now() - pausedFor) / 1000 });

// 1. Playing, from a playlist.
scene('play');
await caption('Plays your videos, right in the browser', 'local files · streams · your own library');
await click('#mb-play-btn', { after: 3600 });
await click('.playlist-item:has-text("Fractal Dive")', { after: 0 });
await playing('Fractal Dive');
await wait(2400);

// 2. Filters and effects, live.
scene('filters');
await caption('Filters and effects, live as it plays', 'presets · fun FX · stickers');
await click('#mb-filters-btn', { after: 500, ms: 600 });
await click('button:has-text("B&W")', { after: 1100, ms: 500 });
await click('button:has-text("Comic")', { after: 1100, ms: 500 });
await click('button:has-text("CRT")', { after: 1100, ms: 500 });
// Reset All sits at the panel's foot: brought into view first.
await page.evaluate(() => document.getElementById('mb-reset-filters-btn')?.scrollIntoView({ block: 'nearest' }));
await wait(300);
await click('#mb-reset-filters-btn', { after: 500, ms: 500 });
await page.evaluate(() => window.playlist.player.videoFilters.reset());   // whatever the click left
await click('#mb-filters-btn', { after: 300, ms: 500 });

// 3. Backwards, and speed.
scene('reverse');
await caption('Play it backwards', 'with sound · any speed from 0.25× to 2×');
// Backwards starts once its first stretch is decoded (about a second, the
// picture still): that wait is left out, like a load.
await click('#mb-direction-btn', { after: 0, ms: 600 });
pause();
const from = await page.evaluate(() => window.playlist.player.currentTime);
await page.waitForFunction((from) => window.playlist.player.currentTime < from - 0.15, from, { timeout: 15000 });
resume();
await wait(2600);
await click('#mb-direction-btn', { after: 600, ms: 300 });

// 4. Editing in the side panel.
scene('edit');
await caption('Edit in a side panel', 'cut · crop · rotate · speed · blur · GIF · and more');
await click('.playlist-item:has-text("City Of Life")', { after: 0, ms: 600 });
await playing('City Of Life');
await wait(900);
await click('.playlist-item:has-text("City Of Life") .playlist-settings-btn', { after: 100, ms: 500 });
await settledPicture({ play: true });
await wait(600);
await glide(...Object.values(await centerOf('.edit-panel .tools-tile[data-action=create-gif]')), 500);
await wait(250);
await glide(...Object.values(await centerOf('.edit-panel .tools-tile[data-action=remove-bg]')), 500);
await wait(250);
await click('.edit-panel .tools-tile[data-action=crop]', { after: 700, ms: 500 });
// Drag the bottom-right corner in.
const corner = await centerOf('.jellyjump-video-wrapper .crop-handle-se');
await glide(corner.x, corner.y, 500);
await page.mouse.down();
await glide(corner.x - 380, corner.y - 200, 800);
await page.mouse.up();
await wait(400);
await click('.edit-panel .crop-btn', { after: 300, ms: 600 });
// The crop runs as a background job: the wait is not in the video.
pause();
await page.waitForFunction(() => document.querySelector('.edit-panel-busy')?.classList.contains('hidden'), null, { timeout: 300000 });
await wait(500);
await settledPicture({ play: true });
await wait(3000);

// 5. Create & share.
scene('create');
await click('.edit-panel-back', { after: 200, ms: 400 }).catch(() => {});
await click('.edit-panel-back', { after: 300, ms: 300 }).catch(() => {});
await caption('Create & share', 'record your screen · merge · slideshow · watch together');
await click('[title="Create & share"]', { after: 500, ms: 600 });
for (const action of ['screen-record', 'merge', 'slideshow', 'watch-party']) {
    const { x, y } = await centerOf(`[data-action="${action}"]`);
    await glide(x, y, 450);
    await wait(350);
}
await page.keyboard.press('Escape');
await wait(400);

// 6. Private.
scene('private');
await caption('Nothing is uploaded', 'it all runs on your device · works offline · free');
await page.evaluate(() => window.playlist.player.play()).catch(() => {});
await glide(1700, 700, 800);
await wait(4200);
await caption('');
await wait(600);
scene('end');

await cdp.send('Page.stopScreencast');
await browser.close();
server.close();

writeFileSync(join(OUT, 'frames.json'), JSON.stringify({ frames, scenes }, null, 1));
const length = frames.at(-1).t - frames[0].t;
console.log(`${frames.length} frames, ${length.toFixed(1)} s; scenes: ${scenes.map((s) => `${s.name}@${(s.t - frames[0].t).toFixed(1)}`).join(' ')}`);
if (errors.length) console.log('page errors:', errors.join(' | '));
