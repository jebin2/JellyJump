/**
 * Drives the edit panel in the built app: editing a video in the sidebar,
 * with the main player as the preview, and edits stacking on each other.
 *
 * What it guards is the flow, which no unit test sees: Apply locks the panel
 * until the job is done, then the result opens in the same player and the
 * same tool to go on from; the playlist keeps the original and one edited
 * copy; Undo and Reset walk back; a tool that draws on the video leaves
 * nothing behind; and the player's own settings (filters, speed, loop, the
 * buttons for them) are put away while editing and come back after.
 *
 * It needs a Chromium or Chrome binary. Point CHROMIUM_PATH at one if it is
 * somewhere unusual.
 *
 *   npm run build && node scripts/edit-panel-test.mjs
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const FIXTURES = join(ROOT, 'scripts/fixtures');
const FIXTURE_URL = '/__fixtures__/smoke-av.webm';

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
};

async function serveDist() {
    const server = createServer(async (req, res) => {
        try {
            const path = decodeURIComponent(req.url.split('?')[0]);
            const file = path.startsWith('/__fixtures__/')
                ? join(FIXTURES, path.slice('/__fixtures__/'.length))
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
    // Nothing may leave this machine (the analytics embed would record a visit).
    await page.route('**/*', route => {
        const url = route.request().url();
        if (url.startsWith(origin) || url.startsWith('blob:') || url.startsWith('data:')) return route.continue();
        return route.abort();
    });

    await page.goto(`${origin}/player.html`);
    await page.waitForFunction(() => !!window.player && !!window.playlist, null, { timeout: 60000 });
    await page.evaluate(async (url) => {
        const blob = await (await fetch(url)).blob();
        await window.playlist.handleFiles([new File([blob], 'holiday-clip.webm', { type: 'video/webm' })]);
        await window.playlist.selectItem(0, false);
        const p = window.playlist.player;
        for (let i = 0; i < 100 && !(p.duration > 0); i++) await new Promise(r => setTimeout(r, 100));
    }, FIXTURE_URL);

    const state = () => page.evaluate(() => {
        const p = window.playlist.player, pl = window.playlist;
        const shown = (id) => { const el = document.getElementById(id); return !!el && getComputedStyle(el).display !== 'none'; };
        return {
            title: document.querySelector('.edit-panel-title')?.textContent,
            playing: pl.items[pl.activeIndex]?.title,
            duration: Math.round(p.duration * 10) / 10,
            playlist: pl.items.map(i => i.title),
            steps: document.querySelector('.edit-panel-history:not(.hidden) .edit-panel-steps:not(.hidden)')?.textContent ?? null,
            busy: !document.querySelector('.edit-panel-busy').classList.contains('hidden'),
            toolInert: document.querySelector('.edit-panel-tool')?.inert ?? null,
            note: document.querySelector('.edit-panel-note:not(.hidden)')?.textContent ?? '',
            layers: document.querySelectorAll('.jellyjump-video-wrapper > .jj-edit-layer').length,
            players: document.querySelectorAll('canvas.jellyjump-video').length,
            loop: [p.loopMode, p.loopStart, p.loopEnd],
            filters: p.videoFilters?.isActive() ?? false,
            rate: p.playbackRate,
            savedRate: localStorage.getItem('jellyjump-speed'),
            buttons: Object.fromEntries(['mb-play-btn', 'mb-prev-btn', 'mb-loop-btn', 'mb-filters-btn',
                'mb-speed-btn', 'mb-cc-btn', 'mb-audio-settings-btn', 'mb-fullscreen-btn'].map(id => [id, shown(id)])),
        };
    });
    const seek = (t) => page.evaluate(async (t) => {
        window.playlist.player.pause();
        await window.playlist.player.seek(t);
        await new Promise(r => setTimeout(r, 200));
    }, t);
    const settled = () => page.waitForFunction(
        () => document.querySelector('.edit-panel-busy').classList.contains('hidden'), null, { timeout: 300000 });
    const loaded = () => page.waitForFunction(() => {
        const p = window.playlist.player;
        return !p.isLoading && p.duration > 0;
    }, null, { timeout: 30000 }).then(() => page.waitForTimeout(500));
    const picture = () => page.evaluate(() => {
        const c = window.playlist.player.canvas, r = c.getBoundingClientRect();
        const s = Math.min(r.width / c.width, r.height / c.height);
        const w = c.width * s, h = c.height * s;
        return { x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, w, h };
    });

    // The viewer's own settings, which editing must put away and give back.
    await page.evaluate(async () => {
        const p = window.playlist.player;
        p.videoFilters.setBrightness(150);
        await p.setPlaybackRate(1.5);
    });
    const before = await state();

    console.log('\nediting leaves the player only what editing needs');
    await page.click('.playlist-settings-btn');
    await page.waitForSelector('.edit-panel:not(.hidden)');
    await page.waitForTimeout(300);
    let s = await state();
    check(s.title === 'Edit', `the panel opens on the tool list (${s.title})`);
    check(s.buttons['mb-play-btn'] && s.buttons['mb-fullscreen-btn'] && s.buttons['mb-audio-settings-btn'],
        'play, fullscreen and volume stay');
    check(!s.buttons['mb-prev-btn'] && !s.buttons['mb-loop-btn'] && !s.buttons['mb-filters-btn']
        && !s.buttons['mb-speed-btn'] && !s.buttons['mb-cc-btn'],
        'next/previous, loop, filters, speed and subtitles are put away');
    check(!s.filters, 'filters are off while editing');
    check(s.rate === 1, `it plays at normal speed (${s.rate})`);
    check(s.savedRate === '1.5', `the saved speed is still the user's (${s.savedRate})`);

    console.log('\nkeys for what is put away do nothing');
    await page.evaluate(() => document.activeElement?.blur());
    await seek(3);
    await page.keyboard.press('i');
    await page.keyboard.press('.');
    await page.waitForTimeout(400);
    s = await state();
    check(s.loop[0] === before.loop[0] && s.loop[1] === before.loop[1], `I does not set a loop start (${JSON.stringify(s.loop)})`);
    const stepped = await page.evaluate(() => window.playlist.player.currentTime);
    // One frame at the fixture's 15 fps.
    check(Math.abs(stepped - 3 - 1 / 15) < 0.02, `. steps one frame (${stepped.toFixed(3)})`);

    console.log('\napplying a cut opens the result to go on from');
    await page.click('.edit-panel .tools-tile[data-action=trim]');
    await page.waitForTimeout(800);
    await seek(2);
    await page.click('.edit-panel #trim-set-start-btn');
    await seek(6);
    await page.click('.edit-panel #trim-set-end-btn');
    s = await state();
    check(s.loop[0] === 'one' && s.loop[1] === 2 && s.loop[2] === 6, `the range loops on the main player (${JSON.stringify(s.loop)})`);
    await page.click('.edit-panel .trim-btn');
    await page.waitForTimeout(100);
    s = await state();
    check(s.busy && s.toolInert === true, 'the panel waits for the job, the tool locked');
    await settled();
    await loaded();
    s = await state();
    check(s.playing === 'holiday-clip-trimmed-2-6.mp4', `the player is on the result (${s.playing})`);
    check(Math.abs(s.duration - 4) < 0.3, `which is 4s long (${s.duration})`);
    check(s.title === 'Cut', `the same tool is open on it (${s.title})`);
    check(s.steps === 'Cut', `the edits so far: ${s.steps}`);
    check(s.playlist.length === 2, `the playlist has the original and the copy (${s.playlist.join(', ')})`);

    console.log('\na crop on top replaces the copy');
    await page.click('.edit-panel-back');
    await page.click('.edit-panel .tools-tile[data-action=crop]');
    await page.waitForSelector('.jellyjump-video-wrapper > .jj-edit-layer .crop-handle-se');
    await page.waitForTimeout(400);
    const pic = await picture();
    const se = await page.locator('.jellyjump-video-wrapper .crop-handle-se').boundingBox();
    await page.mouse.move(se.x + se.width / 2, se.y + se.height / 2);
    await page.mouse.down();
    await page.mouse.move(pic.x + pic.w * 0.6, pic.y + pic.h * 0.7, { steps: 6 });
    await page.mouse.up();
    const size = await page.evaluate(() => [document.querySelector('#crop-width').value, document.querySelector('#crop-height').value]);
    check(Math.abs(size[0] - 192) <= 4 && Math.abs(size[1] - 126) <= 4, `dragging the corner on the player sizes the crop (${size})`);
    await page.click('.edit-panel .crop-btn');
    await settled();
    await loaded();
    s = await state();
    check(s.steps === 'Cut → Crop', `the edits so far: ${s.steps}`);
    check(s.playlist.length === 2 && /crop/.test(s.playlist[1]), `still one copy (${s.playlist.join(', ')})`);
    check(s.layers === 1 && s.players === 1, `one crop layer, one player (${s.layers}, ${s.players})`);

    console.log('\nundo goes one step back');
    await page.click('.edit-panel-undo');
    await loaded();
    s = await state();
    check(s.playing === 'holiday-clip-trimmed-2-6.mp4' && Math.abs(s.duration - 4) < 0.3, `the cut copy is back (${s.playing}, ${s.duration})`);
    check(s.steps === 'Cut' && s.playlist.length === 2, `edits: ${s.steps}; playlist: ${s.playlist.join(', ')}`);
    await page.locator('.job-tray .job-row', { hasText: 'Crop' }).locator('[data-job-action=download]').click();
    await page.waitForTimeout(300);
    const toast = await page.evaluate(() => [...document.querySelectorAll('.mb-toast')].map(t => t.textContent).join(' | '));
    check(/no longer be downloaded/.test(toast), 'the undone copy\'s Download says it is gone');

    console.log('\nreset asks, then goes back to the original');
    await page.click('.edit-panel-reset');
    s = await state();
    check(await page.isVisible('.edit-panel-confirm'), 'Reset asks first');
    await page.click('.edit-panel-confirm-no');
    s = await state();
    check(s.steps === 'Cut' && s.playlist.length === 2, 'Keep keeps the edits');
    await page.click('.edit-panel-reset');
    await page.click('.edit-panel-confirm-yes');
    await loaded();
    s = await state();
    check(s.playing === 'holiday-clip.webm' && s.duration > 11, `the original is back (${s.playing}, ${s.duration})`);
    check(s.steps === null && s.playlist.length === 1, `no edits, no copy (${s.playlist.join(', ')})`);

    console.log('\na GIF is a result of its own, not a step');
    await page.click('.edit-panel-back');
    await page.click('.edit-panel .tools-tile[data-action=create-gif]');
    await page.waitForTimeout(800);
    await page.click('.edit-panel .create-gif-btn');
    await page.waitForTimeout(200);
    s = await state();
    check(!s.busy && /added to Jobs/.test(s.note), `it goes to the jobs (${s.note})`);
    await page.waitForFunction(() => !document.querySelector('.job-tray [data-job-action=cancel]'), null, { timeout: 300000 });
    await page.waitForTimeout(300);
    s = await state();
    check(s.playing === 'holiday-clip.webm' && s.playlist.length === 2, `the player stays on the video (${s.playing})`);

    console.log('\nleaving gives the player back');
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    s = await state();
    check(await page.isHidden('.edit-panel'), 'the panel is closed');
    check(s.layers === 0, 'nothing is left over the picture');
    check(JSON.stringify(s.loop) === JSON.stringify(before.loop), `the loop is as it was (${JSON.stringify(s.loop)})`);
    check(s.filters && s.rate === 1.5, `filters and speed are back (${s.filters}, ${s.rate})`);
    check(s.buttons['mb-loop-btn'] && s.buttons['mb-filters-btn'] && s.buttons['mb-speed-btn'], 'every button is back');

    console.log('\nno errors');
    check(errors.length === 0, `no page errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
}

// --- the harness --------------------------------------------------------------

if (!existsSync(join(DIST, 'player.html'))) {
    console.error('dist/ is missing. Run `npm run build` first.');
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
const browser = await chromium.launch({ executablePath: browserPath, args: ['--no-sandbox', '--no-proxy-server'] });
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await run(page, origin);
} catch (error) {
    fail++;
    console.log(`  FAIL  the run itself threw: ${error.message}`);
} finally {
    await browser.close();
    server.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
