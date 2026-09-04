/**
 * Tests the client half of library sharing against a real server: that a share
 * link is recognised as a library rather than fed to the demuxer as a media
 * file, and that the items it produces point at streamable URLs.
 *
 * The failure this guards against is specific and was reported from the app:
 * pasting a share link into Add Link fetched the server's HTML page and died
 * with "unsupported or unrecognizable format".
 *
 *   node scripts/remote-library-test.mjs
 */
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const server = require('../desktop/library-server.js');
const index = require('../desktop/library-index.js');

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

const tmp = mkdtempSync(path.join(tmpdir(), 'jj-remote-'));
const root = path.join(tmp, 'media');
mkdirSync(path.join(root, 'Series'), { recursive: true });
const body = Buffer.from('0123456789abcdefghijklmnopqrstuvwxyz');
const clip = path.join(root, 'Series', 'ep1.mp4');
writeFileSync(clip, body);

index.setRoots([root]);
index.addBatch([{ path: clip, name: 'ep1.mp4', size: body.length, mtime: Date.now(), ext: '.mp4' }]);

const TOKEN = 'c'.repeat(64);
const { port } = await server.start({ token: TOKEN, name: 'testbox' });
const shareLink = `http://127.0.0.1:${port}/?token=${TOKEN}`;

// The browser module expects fetch and a location; Node has fetch already.
globalThis.location = { protocol: 'http:' };
const remote = await import('../assets/js/shared/services/RemoteLibrary.js');

console.log('recognising a share link');
check(remote.looksLikeShareLink(shareLink), 'a share link is recognised');
check(!remote.looksLikeShareLink('https://example.com/video.mp4'),
    'an ordinary media URL is not mistaken for one');
check(!remote.looksLikeShareLink('not a url'), 'garbage is not mistaken for one');

console.log('\nprobing');
const info = await remote.probe(shareLink);
check(info.ok && info.count === 1, `probe reports the library (${info.count} item)`);
check(info.name === 'testbox', `probe reports the server name (${info.name})`);

const wrongToken = await remote.probe(`http://127.0.0.1:${port}/?token=${'d'.repeat(64)}`);
check(!wrongToken.ok, 'a revoked or wrong token is rejected');
check(/no longer valid/i.test(wrongToken.error), `and says so (${wrongToken.error})`);

const notLibrary = await remote.probe('http://127.0.0.1:1/?token=x');
check(!notLibrary.ok, 'an unreachable host fails cleanly rather than throwing');

console.log('\nbuilding items');
const items = await remote.fetchItems(shareLink);
check(items.length === 1, `one item per file (${items.length})`);

const [item] = items;
check(item.isRemoteLibrary === true, 'flagged so it is neither cached nor persisted');
check(item.isLocal === false && item.isStream === false,
    'shaped for the direct-URL path, which uses range requests');
check(item.path === 'testbox/Series/ep1.mp4', `grouped under the server (${item.path})`);
check(item.url.includes('/api/stream/'), 'points at the stream endpoint');
check(item.url.includes(`token=${TOKEN}`), 'carries the token, which UrlSource cannot send as a header');

console.log('\nthe item actually streams');
const full = await fetch(item.url);
check(full.status === 200, 'the stream URL resolves');
check(await full.text() === body.toString(), 'and returns the file');

const ranged = await fetch(item.url, { headers: { Range: 'bytes=4-9' } });
check(ranged.status === 206 && await ranged.text() === '456789',
    'and serves ranges, so seeking works');

console.log('\nreloading a library');
// The listing is a snapshot; the other machine keeps scanning. Reload must pick
// up new files without disturbing what is already listed or playing.
const before = await remote.fetchItems(shareLink);
const ep2 = path.join(root, 'Series', 'ep2.mp4');
writeFileSync(ep2, body);
index.addBatch([{ path: ep2, name: 'ep2.mp4', size: body.length, mtime: Date.now(), ext: '.mp4' }]);

const after = await remote.fetchItems(shareLink);
check(after.length === before.length + 1, `a new file shows up on reload (${before.length} -> ${after.length})`);

const stableIds = before.every(b => after.some(a => a.remoteId === b.remoteId));
check(stableIds, 'existing items keep their remoteId, so playback is not torn out');
check(before.every(b => b.remoteSource === shareLink),
    'items carry the source, which is what the folder reload button uses');

console.log('\na .jjlist inside a shared library');
// Its entries are YouTube items rather than files on the other machine, which
// is what made them slip past the rule that a shared library is never saved
// locally. Saved, they came back on the next launch and were then fetched
// again: the folder was on screen before the listing began, with no loading
// row, and every entry in it listed twice.
const listPath = path.join(root, 'Watch later.jjlist');
const listText = 'Clip one : https://www.youtube.com/watch?v=dQw4w9WgXcQ\n'
    + 'https://youtu.be/9bZkp7q19f0\n';
writeFileSync(listPath, listText);
// Kept apart from the indexed files on purpose: a .jjlist is served as text and
// must never be fetchable through /api/stream.
index.addLinkList({
    path: listPath, name: 'Watch later.jjlist', text: listText, mtime: Date.now(),
});

const withList = await remote.fetchItems(shareLink);
const fromList = withList.filter(i => i.isYouTube);
check(fromList.length === 2, `both entries arrive as items (${fromList.length})`);
check(fromList.every(i => i.remoteSource === shareLink),
    'they carry the source, so the folder acts on them too');
check(fromList.every(i => i.isRemoteLibrary === true),
    'and are marked as the shared library they came from, which is what keeps them unsaved');

// The rule they have to satisfy, stated the way PlaylistStorage states it.
const persisted = withList.filter(i => !i.isWebcam && !i.isDiscovered && !i.isRemoteLibrary);
check(persisted.length === 0,
    `nothing from a shared library is written to local storage (${persisted.length} would be)`);

console.log('\nthe reported failure');
// Pasting the link previously fetched this and handed it to the demuxer.
const asMedia = await fetch(shareLink);
check((asMedia.headers.get('content-type') || '').includes('text/html'),
    'the link itself returns HTML, which is why it must never reach the demuxer');

await server.stop();
rmSync(tmp, { recursive: true, force: true });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
