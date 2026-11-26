/**
 * Tests the browser's storage of the playlist and its files (IndexedDBService),
 * in a real browser, across a page reload.
 *
 * Also what phase G of ARCHITECTURE_PLAN.md added: a removed item's file is
 * deleted, files nothing refers to are swept, the Undo history's files are
 * kept, and a full disk keeps the list. A mistake here loses the user's
 * videos.
 *
 * Runs against the vite dev server, importing the module itself, on the
 * landing page (which does not use the playlist's storage).
 *
 *   node scripts/storage-test.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { startCoverage, saveCoverage } from './lib/coverage.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = Number(process.env.PORT || 8189);

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
        try { if ((await fetch(`${origin}/dashboard.html`)).ok) return true; } catch { /* starting */ }
        await new Promise(r => setTimeout(r, 1000));
    }
    return false;
}

/** Runs in the page: the storage module, fresh each call. */
const withStorage = (origin, body) => async (page) => page.evaluate(async ({ origin, body }) => {
    const { IndexedDBService } = await import(`${origin}/assets/js/shared/services/IndexedDBService.js`);
    const db = new IndexedDBService();
    await db.ready();
    return new Function('db', `return (async () => { ${body} })()`)(db);
}, { origin, body });

async function run(page, origin) {
    await page.goto(`${origin}/dashboard.html`);

    console.log('\nsaving a playlist with a file');
    const saved = await withStorage(origin, `
        await db.clear();
        const bytes = new Uint8Array(4096).map((_, i) => i % 251);
        const file = new File([bytes], 'clip.mp4', { type: 'video/mp4' });
        const items = [
            { id: 'a', title: 'clip.mp4', isLocal: true, file, duration: '0:04', path: 'clip.mp4' },
            { id: 'b', title: 'Remote', isLocal: false, url: 'https://example.invalid/v.mp4' },
        ];
        await db.savePlaylist(items);
        return { released: items[0].file === null, remoteKept: items[1].url };
    `)(page);
    check(saved.released, 'a stored file is let go of in memory');
    check(saved.remoteKept === 'https://example.invalid/v.mp4', 'a remote item keeps its URL');

    console.log('\nreading it back after a reload');
    await page.reload();
    const loaded = await withStorage(origin, `
        const items = await db.loadPlaylist();
        const file = await db.loadFile('a');
        const bytes = file ? new Uint8Array(await file.arrayBuffer()) : null;
        const intact = !!bytes && bytes.length === 4096 && bytes.every((b, i) => b === i % 251);
        return {
            ids: items.map(i => i.id),
            local: items.find(i => i.id === 'a'),
            remote: items.find(i => i.id === 'b'),
            name: file?.name, type: file?.type, intact,
        };
    `)(page);
    check(loaded.ids.join() === 'a,b', `both items come back, in order (${loaded.ids})`);
    check(loaded.local?.file === null && loaded.local?.url === null, 'a local item comes back without a file or URL (read on demand)');
    check(loaded.local?.title === 'clip.mp4' && loaded.local?.duration === '0:04', 'with its title and duration');
    check(loaded.remote?.url === 'https://example.invalid/v.mp4', 'a remote item comes back with its URL');
    check(loaded.intact && loaded.name === 'clip.mp4' && loaded.type === 'video/mp4', 'its file reads back byte for byte, with name and type');

    console.log('\nfiles on their own');
    const files = await withStorage(origin, `
        const saved = await db.saveFile('c', new Blob([new Uint8Array(10)]), 'c.mp4', 'video/mp4');
        const there = !!(await db.loadFile('c'));
        await db.deleteFile('c');
        const gone = (await db.loadFile('c')) === null;
        const missing = (await db.loadFile('never-saved')) === null;
        return { saved, there, gone, missing };
    `)(page);
    check(files.saved && files.there, 'saveFile stores a file');
    check(files.gone, 'deleteFile removes it');
    check(files.missing, 'a file never saved reads as null, not an error');

    console.log('\nremoving an item from the playlist');
    const removed = await withStorage(origin, `
        const { discardStoredFiles } = await import('${origin}/assets/js/ui/player/PlaylistFiles.js');
        const items = await db.loadPlaylist();
        const remaining = items.filter(i => i.id !== 'a');
        await db.savePlaylist(remaining);
        discardStoredFiles(db, items.filter(i => i.id === 'a'), remaining);
        await new Promise(r => setTimeout(r, 200));
        const ids = (await db.loadPlaylist()).map(i => i.id);
        const fileStillStored = !!(await db.loadFile('a'));
        return { ids, fileStillStored };
    `)(page);
    check(removed.ids.join() === 'b', 'the item is gone from the saved playlist');
    check(!removed.fileStillStored, 'and so is its file (BUG-4)');

    console.log('\nwhat is kept, and the sweep');
    const swept = await withStorage(origin, `
        const { discardStoredFiles, sweepStoredFiles } = await import('${origin}/assets/js/ui/player/PlaylistFiles.js');
        const { Settings } = await import('${origin}/assets/js/shared/settings/Settings.js');
        const blob = () => new Blob([new Uint8Array(16)]);
        await db.clear();
        // An item in the playlist, an earlier copy kept for Undo, and a file
        // nothing refers to (left from before files were deleted).
        await db.saveFile('kept', blob(), 'kept.mp4', 'video/mp4');
        await db.saveFile('undo-step', blob(), 'step.mp4', 'video/mp4');
        await db.saveFile('orphan', blob(), 'old.mp4', 'video/mp4');
        Settings.set('editHistory', { current: { originalId: 'kept', steps: [{ id: 'undo-step', name: 'Cut' }] } });

        // Removing an item whose file the Undo history still needs keeps it.
        discardStoredFiles(db, [{ id: 'undo-step', isLocal: true }], [{ id: 'kept' }]);
        await new Promise(r => setTimeout(r, 200));
        const stepKeptOnRemove = !!(await db.loadFile('undo-step'));

        const count = await sweepStoredFiles(db, () => [{ id: 'kept' }]);
        const left = (await db.fileIds()).sort();
        Settings.remove('editHistory');
        return { stepKeptOnRemove, count, left };
    `)(page);
    check(swept.stepKeptOnRemove, 'a file the Undo history needs is kept when its item is removed');
    check(swept.count === 1 && swept.left.join() === 'kept,undo-step', `the sweep deletes only the file nothing refers to (${swept.left})`);

    console.log('\na full disk');
    const full = await withStorage(origin, `
        const { savePlaylistItems } = await import('${origin}/assets/js/ui/player/PlaylistStorage.js');
        const told = [];
        const calls = [];
        // Storage that refuses the files, as a full disk does, and takes the list alone.
        const fullStore = {
            async savePlaylist(items, options = {}) {
                calls.push(options.withFiles !== false);
                if (options.withFiles !== false) throw new DOMException('quota', 'QuotaExceededError');
            },
        };
        const file = new File([new Uint8Array(8)], 'big.mp4', { type: 'video/mp4' });
        const items = [{ id: 'big', isLocal: true, file, title: 'big.mp4' }];
        const first = await savePlaylistItems(fullStore, items, (m) => told.push(m));
        const second = await savePlaylistItems(fullStore, items, (m) => told.push(m));
        const other = await savePlaylistItems({ async savePlaylist() { throw new Error('boom'); } }, items, (m) => told.push(m));
        return { first, second, other, calls, told, kept: items[0].file === file };
    `)(page);
    check(full.first === 'without-files' && full.calls.slice(0, 2).join() === 'true,false', 'refused: the list is saved again without its files');
    check(full.kept, 'the file stays in memory, so the video still plays');
    check(full.told.length === 1 && /storage is full/.test(full.told[0]), 'the user is told, once');
    check(full.second === 'without-files', 'later saves still save the list');
    check(full.other === 'failed' && full.told.length === 1, 'another failure is logged, not shown as a full disk');

    console.log('\nplayback state');
    const state = await withStorage(origin, `
        await db.savePlaybackState({ index: 1, activeId: 'b', time: 12.5 });
        return await db.loadPlaybackState();
    `)(page);
    check(state?.activeId === 'b' && state?.time === 12.5 && state?.index === 1, 'the playing item and time round-trip');

    console.log('\nclearing');
    const cleared = await withStorage(origin, `
        await db.clear();
        return { items: (await db.loadPlaylist()).length, file: await db.loadFile('a'), flag: localStorage.getItem(db.DB_NAME + '-playlist') };
    `)(page);
    check(cleared.items === 0 && cleared.file === null, 'clear empties the playlist and the files');
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

let page = null;
const browser = await chromium.launch({ executablePath: browserPath, args: ['--no-sandbox', '--no-proxy-server'] });
try {
    // The page's CSP forbids building functions from strings, which is how
    // the steps above reach the module; the test opens it with CSP off.
    page = await browser.newPage({ bypassCSP: true });
    await startCoverage(page);
    page.on('pageerror', e => { fail++; console.log(`  FAIL  page error: ${String(e.message).slice(0, 160)}`); });
    await page.route('**/*', r => r.request().url().startsWith(origin) ? r.continue() : r.abort());
    await run(page, origin);
} catch (error) {
    fail++;
    console.log(`  FAIL  the run itself threw: ${error.message}`);
} finally {
    if (page) await saveCoverage(page, 'storage-test');
    await browser.close();
    stopVite();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
