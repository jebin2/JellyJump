/**
 * The remote buffer on disk (shared/media/buffer/OpfsBackend.js and its
 * worker), in a real browser: pieces written to the origin private file
 * system, read back after a reload, deleted, and a second tab on the same
 * file reading what the first keeps without writing over it.
 * ARCHITECTURE_PLAN.md U1; the store's logic is piece-store-test.
 *
 * Runs against the vite dev server, importing the modules themselves; the
 * "remote" file is answered by the test (range requests, ETag).
 *
 *   node scripts/piece-store-opfs-test.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { startCoverage, saveCoverage } from './lib/coverage.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = Number(process.env.PORT || 8191);

let pass = 0, fail = 0;
const check = (ok, label, detail = '') => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`); }
};

const browserPath = [process.env.CHROMIUM_PATH, process.env.CHROME_PATH,
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean).find((p) => existsSync(p));
if (!browserPath) {
    console.error('No Chromium or Chrome found. Set CHROMIUM_PATH to a browser binary.');
    process.exit(1);
}
const { chromium } = await import('playwright-core');

async function waitForServer(origin) {
    for (let i = 0; i < 90; i++) {
        try { if ((await fetch(`${origin}/index.html`)).ok) return true; } catch { /* starting */ }
        await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
}

const SIZE = 10 * 1000 + 500;   // 11 pieces of 1000 bytes, the last one short
const FILE = Buffer.from(Uint8Array.from({ length: SIZE }, (_, i) => (i * 13) % 251));
const SMALL = FILE;
/** A file large enough to be cut into pieces by its own size (64 KB: 5 pieces). */
const BIG = Buffer.from(Uint8Array.from({ length: 300000 }, (_, i) => (i * 13) % 251));
/** Requests the "remote" file got, per page. */
const served = [];

/** Answer the remote file's range requests. */
async function serveRemote(route) {
    const FILE = route.request().url().includes('/big.mp4') ? BIG : SMALL;
    const SIZE = FILE.length;
    const range = /bytes=(\d+)-(\d+)/.exec(route.request().headers().range || '');
    served.push(range ? `${range[1]}-${range[2]}` : 'whole');
    if (!range) return route.fulfill({ status: 200, body: FILE, headers: { ETag: '"v1"', 'Content-Length': String(SIZE) } });
    const start = Number(range[1]);
    const end = Math.min(Number(range[2]), SIZE - 1);
    return route.fulfill({
        status: 206,
        body: FILE.subarray(start, end + 1),
        headers: { ETag: '"v1"', 'Content-Range': `bytes ${start}-${end}/${SIZE}`, 'Accept-Ranges': 'bytes' },
    });
}

/** Runs in the page: a store on disk with 1000-byte pieces, in a folder of its own. */
const inStore = (origin, body) => async (page) => page.evaluate(async ({ origin, body }) => {
    const { PieceStore } = await import(`${origin}/assets/js/shared/media/buffer/PieceStore.js`);
    const { OpfsBackend } = await import(`${origin}/assets/js/shared/media/buffer/OpfsBackend.js`);
    const backend = await OpfsBackend.open('jj-buffer-test');
    const store = await new PieceStore({ backend, budget: 1e9, pieceSize: 1000, lockPrefix: 'jj-buffer-test' }).load();
    const url = `${origin}/__remote__/film.mp4`;
    const expected = (i) => (i * 13) % 251;
    const same = (bytes, start) => bytes.every((b, k) => b === expected(start + k));
    const folderNames = async () => {
        const root = await navigator.storage.getDirectory();
        const base = await root.getDirectoryHandle('jj-buffer-test', { create: true });
        const names = [];
        for await (const [name] of base.entries()) names.push(name);
        return names;
    };
    window.__keep ??= [];
    return new Function('store', 'url', 'same', 'folderNames', 'keep', `return (async () => { ${body} })()`)(
        store, url, same, folderNames, window.__keep);
}, { origin, body });

async function run(context, origin) {
    const page = await context.newPage();
    await startCoverage(page);
    page.on('pageerror', (e) => { fail++; console.log(`  FAIL  page error: ${String(e.message).slice(0, 160)}`); });
    await page.goto(`${origin}/index.html`);

    console.log('\nthe page\'s buffer');
    const chosen = await page.evaluate(async (origin) => {
        const { getRemoteBuffer, BUFFER_NAME } = await import(`${origin}/assets/js/shared/media/buffer/RemoteBuffer.js`);
        const store = await getRemoteBuffer();
        return { kind: store.backend.kind, budget: store.budget, name: BUFFER_NAME };
    }, origin);
    check(chosen.kind === 'opfs', `on disk where the browser allows it (${chosen.kind})`);
    check(chosen.budget > 0 && chosen.budget <= 2048 * 1024 * 1024, `with a budget of at most 2 GB (${(chosen.budget / 1048576).toFixed(0)} MB)`);
    check(chosen.name === 'jj-buffer', `in its own folder (${chosen.name}); a preview's is namespaced`);

    console.log('\nwriting and reading back');
    const first = await inStore(origin, `
        await store.clear();
        const file = await store.open({ url, key: 'url:film' });
        const bytes = await file.read(500, 3500);
        await file.ensure(3);   // the read had its bytes before the piece was whole
        await store.settled();
        const result = { ok: same(bytes, 500), kept: [...file.record.pieces.keys()].sort((a, b) => a - b).join(), folders: await folderNames() };
        file.close();
        return result;
    `)(page);
    check(first.ok, 'a read across pieces returns the right bytes');
    check(first.kept === '0,1,2,3', `the pieces read are kept (${first.kept})`);
    check(first.folders.length === 1 && /^[0-9a-f]{16}$/.test(first.folders[0]), `in one folder for the file (${first.folders})`);

    console.log('\nafter a reload');
    await page.reload();
    served.length = 0;
    const reloaded = await inStore(origin, `
        const file = await store.open({ url, key: 'url:film' });
        const ranges = JSON.stringify(file.downloadedRanges());
        const bytes = await file.read(0, 4000);
        file.close();
        return { ranges, ok: same(bytes, 0) };
    `)(page);
    check(reloaded.ranges === '[[0,4000]]', `the kept pieces are found again (${reloaded.ranges})`);
    check(reloaded.ok && served.join() === '0-0', `and read from disk: only the one-byte check went out (${served.join()})`);

    console.log('\ntwo tabs on the same file');
    const holder = await inStore(origin, `
        const file = await store.open({ url, key: 'url:film' });
        keep.push(file);   // held open, as a tab playing it would
        return file.ownsPieces;
    `)(page);
    const other = await context.newPage();
    other.on('pageerror', (e) => { fail++; console.log(`  FAIL  page error (second tab): ${String(e.message).slice(0, 160)}`); });
    await other.goto(`${origin}/index.html`);
    served.length = 0;
    const second = await inStore(origin, `
        const file = await store.open({ url, key: 'url:film' });
        const kept = await file.read(0, 1000);
        const fetched = await file.read(6000, 6500);
        await file.ensure(6);
        await store.settled();
        const result = {
            owns: file.ownsPieces, keptOk: same(kept, 0), fetchedOk: same(fetched, 6000),
            onDisk: [...file.record.pieces.keys()].sort((a, b) => a - b).join(),
            inMemory: [...file.memoryPieces.keys()].join(),
        };
        file.close();
        return result;
    `)(other);
    check(holder === true && second.owns === false, 'the first tab keeps the pieces; the second does not');
    check(second.keptOk && !served.includes('0-999'), 'the second reads what the first kept, from disk');
    check(second.fetchedOk && second.inMemory === '6' && !second.onDisk.split(',').includes('6'),
        `and keeps what it fetches itself in memory, never writing the first's files (disk ${second.onDisk}; memory ${second.inMemory})`);
    await other.close();

    console.log('\nletting go');
    const dropped = await inStore(origin, `
        keep.splice(0).forEach((file) => file.close());
        const file = await store.open({ url, key: 'url:film' });
        await file.keepOnly(1, 2);
        const left = [...file.record.pieces.keys()].sort((a, b) => a - b).join();
        file.close();
        await store.drop('url:film');
        return { left, folders: await folderNames() };
    `)(page);
    check(dropped.left === '1,2', `pieces outside the window are deleted (${dropped.left} left)`);
    check(dropped.folders.length === 0, `a dropped file's folder is gone (${dropped.folders})`);

    console.log('\na tool reading a remote file whole');
    served.length = 0;
    const tool = await page.evaluate(async (origin) => {
        const { getRemoteBuffer } = await import(`${origin}/assets/js/shared/media/buffer/RemoteBuffer.js`);
        const { remoteSourceBlob } = await import(`${origin}/assets/js/shared/media/buffer/RemotePlayback.js`);
        const { remoteFileKey } = await import(`${origin}/assets/js/shared/media/buffer/PieceStore.js`);
        const url = `${origin}/__remote__/big.mp4`;
        const store = await getRemoteBuffer();
        const file = await store.open({ url, key: remoteFileKey(url) });
        // Pieces 0 and 2 kept, as playback would have left them.
        await file.ensure(0);
        await file.ensure(2);
        await store.settled();
        const pieceSize = file.pieceSize;
        file.close();
        const before = performance.now();
        const blob = await remoteSourceBlob(url, { type: 'video/mp4' });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        const ok = bytes.length === 300000 && bytes.every((b, i) => b === (i * 13) % 251);
        return { ok, type: blob.type, pieceSize, ms: performance.now() - before };
    }, origin);
    const afterOpen = served.slice(served.indexOf('0-0', 3));
    check(tool.ok && tool.type === 'video/mp4', 'the whole file comes back, byte for byte');
    check(!afterOpen.includes(`0-${tool.pieceSize - 1}`) && !afterOpen.some((r) => r.startsWith(`${2 * tool.pieceSize}-`)),
        `the kept pieces are not fetched again (requests: ${served.join(', ')})`);

    await saveCoverage(page, 'piece-store-opfs-test');
}

const origin = `http://127.0.0.1:${PORT}`;
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
    // the steps above reach the modules; the test opens it with CSP off.
    const context = await browser.newContext({ bypassCSP: true });
    await context.route('**/__remote__/**', serveRemote);
    await context.route('**/*', (r) => (r.request().url().startsWith(origin) ? r.fallback() : r.abort()));
    await run(context, origin);
} catch (error) {
    fail++;
    console.log(`  FAIL  the run itself threw: ${error.stack || error.message}`);
} finally {
    await browser.close();
    stopVite();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
