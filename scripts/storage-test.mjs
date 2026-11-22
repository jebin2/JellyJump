/**
 * Tests the browser's storage of the playlist and its files (IndexedDBService),
 * in a real browser, across a page reload.
 *
 * Nothing tested this before, and the next changes to storage (deleting a
 * removed item's file, sweeping orphans, handling a full disk — phase G of
 * ARCHITECTURE_PLAN.md) need it: a mistake there loses the user's videos.
 *
 * Runs against the vite dev server, importing the module itself, on the
 * landing page (which does not use the playlist's storage).
 *
 *   node scripts/storage-test.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
        try { if ((await fetch(`${origin}/index.html`)).ok) return true; } catch { /* starting */ }
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
    await page.goto(`${origin}/index.html`);

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
        const items = await db.loadPlaylist();
        await db.savePlaylist(items.filter(i => i.id !== 'a'));
        const ids = (await db.loadPlaylist()).map(i => i.id);
        const fileStillStored = !!(await db.loadFile('a'));
        return { ids, fileStillStored };
    `)(page);
    check(removed.ids.join() === 'b', 'the item is gone from the saved playlist');
    // BUG-4: nothing deletes a removed item's file. Phase G1 changes this
    // check to expect it gone.
    check(removed.fileStillStored, 'its file is still stored (BUG-4, until phase G1 deletes it)');

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

const browser = await chromium.launch({ executablePath: browserPath, args: ['--no-sandbox', '--no-proxy-server'] });
try {
    // The page's CSP forbids building functions from strings, which is how
    // the steps above reach the module; the test opens it with CSP off.
    const page = await browser.newPage({ bypassCSP: true });
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
