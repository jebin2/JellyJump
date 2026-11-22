/**
 * Tests how things get into the playlist (ui/player/PlaylistIngest.js): a
 * URL routed to the right place, an M3U list added and synced, a link list
 * read without duplicates, and a tool's result placed after its source.
 *
 * The methods run on a stand-in playlist (a real PlaylistState, with
 * saving, rendering and playing recorded instead of done), in a real
 * browser, so the modules load as the app loads them.
 *
 * Runs against the vite dev server, importing the module itself, on the
 * landing page (which does not use the playlist's storage).
 *
 *   node scripts/ingest-test.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = Number(process.env.PORT || 8190);

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
 * Runs in the page with `p`, a stand-in playlist with the ingest methods, and
 * `calls`, what it was asked to do. `processor` replaces the network side.
 */
const withPlaylist = (origin, body) => async (page) => page.evaluate(async ({ origin, body }) => {
    const { PlaylistIngest } = await import(`${origin}/assets/js/ui/player/PlaylistIngest.js`);
    const { PlaylistState } = await import(`${origin}/assets/js/ui/player/PlaylistState.js`);
    const calls = [];
    const record = (name) => (...args) => { calls.push([name, ...args]); };
    const p = Object.assign({
        state: new PlaylistState(),
        processor: {},
        remoteLibraries: { add: record('remoteLibraries.add') },
        save: record('save'),
        render: record('render'),
        selectItem: record('selectItem'),
        processMetadata: record('processMetadata'),
        _updatePlayerNavigationState: record('nav'),
        _renderDiscoveredSoon: record('renderDiscoveredSoon'),
    }, PlaylistIngest, {
        // An ingest method itself, but one that goes to the network.
        _fillMissingYouTubeTitles: record('fillTitles'),
    });
    Object.defineProperty(p, 'items', { get() { return this.state.items; } });
    return new Function('p', 'calls', 'record', `return (async () => { ${body} })()`)(p, calls, record);
}, { origin, body });

async function run(page, origin) {
    await page.goto(`${origin}/index.html`);

    console.log('\na URL goes to the right place');
    const routed = await withPlaylist(origin, `
        p._addYouTubeVideo = record('youtube');
        let first = 0;
        await p.handleUrlUpload('https://www.youtube.com/watch?v=dQw4w9WgXcQ', () => first++);
        const youtube = calls.filter(c => c[0] === 'youtube').length;

        p.processor.processUrl = async (url) => ({ title: 'clip.mp4', url, isLocal: false });
        await p.handleUrlUpload('https://media.example/clip.mp4');
        const added = p.items[0];
        const selected = calls.find(c => c[0] === 'selectItem');
        const probed = calls.some(c => c[0] === 'processMetadata');

        p.processor.processUrl = async (url) => ({ title: 'Live', url, isStream: true });
        const before = calls.filter(c => c[0] === 'processMetadata').length;
        await p.handleUrlUpload('https://media.example/live.m3u8');
        const streamProbed = calls.filter(c => c[0] === 'processMetadata').length > before;
        return { youtube, first, added, selected, probed, streamProbed, count: p.items.length };
    `)(page);
    check(routed.youtube === 1 && routed.first === 1, 'a YouTube link is added as a YouTube video, and the caller is told');
    check(routed.added?.title === 'clip.mp4' && !!routed.added?.id, 'a media URL is added, with an id');
    check(routed.selected?.[1] === 0, 'and played');
    check(routed.probed, 'its details are read');
    check(!routed.streamProbed && routed.count === 2, 'a stream is added without reading a file\'s details');

    console.log('\nan M3U list');
    const m3u = await withPlaylist(origin, `
        const src = 'https://iptv.example/list.m3u';
        let round = 0;
        p.processor.processUrl = async (url) => ({ type: 'm3u', url });
        p.processor.importM3U = async (url) => {
            round++;
            const names = round === 1 ? ['News', 'Sport'] : ['News', 'Music', 'Film'];
            return names.map((n, i) => ({ id: url + round + i, title: n, url: 'https://iptv.example/' + n, isStream: true, m3uSource: url, path: 'list/' + n }));
        };
        p.state.addItem({ id: 'mine', title: 'mine.mp4' });
        await p.handleUrlUpload(src);
        const firstTitles = p.items.map(i => i.title);
        await p._syncM3UPlaylist('list', src);
        const synced = p.items.map(i => i.title);
        return { firstTitles, synced, saved: calls.filter(c => c[0] === 'save').length };
    `)(page);
    check(m3u.firstTitles.join() === 'mine.mp4,News,Sport', `its channels are added (${m3u.firstTitles})`);
    check(m3u.synced.join() === 'mine.mp4,News,Music,Film', `a sync replaces them with the list as it is now, and keeps the rest (${m3u.synced})`);
    check(m3u.saved >= 2, 'and the playlist is saved each time');

    console.log('\na link list');
    const links = await withPlaylist(origin, `
        const file = {
            name: 'Favourites.jjlist', path: '/home/me/Favourites.jjlist',
            text: 'https://youtu.be/dQw4w9WgXcQ\\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ\\nGangnam Style : https://www.youtube.com/watch?v=9bZkp7q19f0',
        };
        p.addLinkListItems(file);
        const first = p.items.map(i => ({ path: i.path, id: i.youtubeId, needsTitle: i.needsTitle }));
        p.addLinkListItems(file);
        return { first, again: p.items.length, filled: calls.filter(c => c[0] === 'fillTitles').length };
    `)(page);
    check(links.first.length === 2, `the same video written two ways is one entry (${links.first.length})`);
    check(links.first.every(i => i.path.startsWith('Favourites/')), 'in a folder named after the file');
    check(links.first.filter(i => i.needsTitle).length === 1, 'an unnamed entry is marked to look its title up');
    check(links.again === 2 && links.filled === 1, `reading the file again adds nothing (${links.again} items, ${links.filled} title lookups)`);

    console.log('\na tool\'s result');
    const result = await withPlaylist(origin, `
        const a = { id: 'a', title: 'a.mp4', path: 'a.mp4', duration: '0:10' };
        const b = { id: 'b', title: 'b.mp4', path: 'b.mp4' };
        p.state.addItems([a, b]);
        let event = null;
        const on = (e) => { event = e.detail; };
        window.addEventListener('jellyjump:processed-item', on);
        const { item } = p.insertProcessedItem(a, new Blob([new Uint8Array(4)], { type: 'video/mp4' }), 'a-cut.mp4');
        window.removeEventListener('jellyjump:processed-item', on);
        p.nameProcessedItem = () => ({ title: 'a-edited.mp4', path: 'a.mp4/a-edited.mp4' });
        const { item: named } = p.insertProcessedItem(a, new Blob([new Uint8Array(4)]), 'a-crop.mp4');
        return {
            order: p.items.map(i => i.title), path: item.path, duration: item.duration,
            stored: item.isLocal && item.file instanceof File, event: event?.item?.id === item.id,
            named: named.title, namedPath: named.path,
        };
    `)(page);
    check(result.order.join() === 'a.mp4,a-edited.mp4,a-cut.mp4,b.mp4', `placed right after its source (${result.order})`);
    check(result.path === 'a.mp4/a-cut.mp4' && result.duration === '0:10', 'under its source, with its duration until read');
    check(result.stored, 'as a local file, to be stored');
    check(result.named === 'a-edited.mp4' && result.namedPath === 'a.mp4/a-edited.mp4', 'the edit panel can name it');
    check(result.event, 'and the job that made it is told');
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
