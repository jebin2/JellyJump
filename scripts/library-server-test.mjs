/**
 * Tests the library server's contract, with emphasis on the parts that would be
 * a security hole if wrong: auth, what is addressable, and Range handling.
 *
 * Plain Node, no Electron — the server and index are ordinary modules, and
 * keeping this out of the Electron harness makes it fast enough to run often.
 *
 *   node scripts/library-server-test.mjs
 */
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
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

// A scan root with a file inside, plus a secret outside it that a symlink
// points at — the classic way a media server leaks arbitrary files.
const tmp = mkdtempSync(path.join(tmpdir(), 'jj-srv-'));
const root = path.join(tmp, 'media');
const outside = path.join(tmp, 'outside');
mkdirSync(root); mkdirSync(outside);

const clipPath = path.join(root, 'clip.mp4');
const body = Buffer.from('0123456789abcdefghijklmnopqrstuvwxyz');
writeFileSync(clipPath, body);

const secretPath = path.join(outside, 'secret.mp4');
writeFileSync(secretPath, 'TOP SECRET');
const escapePath = path.join(root, 'escape.mp4');
symlinkSync(secretPath, escapePath);

index.setRoots([root]);
index.addBatch([
    { path: clipPath, name: 'clip.mp4', size: body.length, mtime: Date.now(), ext: '.mp4' },
    { path: escapePath, name: 'escape.mp4', size: 10, mtime: Date.now(), ext: '.mp4' },
]);

const listPath = path.join(root, 'songs.jjlist');
index.addLinkList({
    path: listPath,
    name: 'songs.jjlist',
    mtime: Date.now(),
    text: 'A Song : https://www.youtube.com/watch?v=8scL5oJX6CM\nhttps://youtu.be/1PukR-byRZg\n',
});

const TOKEN = 'a'.repeat(64);
const { port } = await server.start({ token: TOKEN, origins: ['https://jellyjump.voidall.com'] });
const base = `http://127.0.0.1:${port}`;
const auth = { Authorization: `Bearer ${TOKEN}` };

console.log('auth');
check((await fetch(`${base}/api/library`)).status === 401, 'no token is rejected');
check((await fetch(`${base}/api/library`, { headers: { Authorization: 'Bearer wrong' } })).status === 401,
    'a wrong token is rejected');
check((await fetch(`${base}/api/library?token=${TOKEN}`)).status === 200,
    'the token is accepted in the query string (UrlSource cannot set headers)');
check((await fetch(`${base}/api/library`, { headers: auth })).status === 200,
    'the token is accepted as a bearer header');

console.log('\nthe share link itself');
// The generated link points at "/", so this is the path a user hits first.
// It 404'd before, which read as the whole feature being broken.
const landing = await fetch(`${base}/?token=${TOKEN}`);
check(landing.status === 200, `opening the link works (${landing.status})`);
check((landing.headers.get('content-type') || '').includes('text/html'),
    'the link renders a page rather than JSON');
const landingBody = await landing.text();
check(landingBody.includes('Add Link'), 'the page says what to do with the link');
check((await fetch(`${base}/`)).status === 401, 'the link still requires the token');

console.log('\nlisting');
const listing = await (await fetch(`${base}/api/library`, { headers: auth })).json();
check(Array.isArray(listing.items) && listing.items.length === 2, `lists the indexed files (${listing.items.length})`);
check(listing.items.every(i => !JSON.stringify(i).includes(tmp)),
    'no absolute paths are leaked to the client');
check(listing.items.every(i => /^[a-f0-9]{16}$/.test(i.id)), 'every item has an opaque id');

console.log('\nwhat is addressable');
const clip = listing.items.find(i => i.name === 'clip.mp4');
const escape = listing.items.find(i => i.name === 'escape.mp4');
check((await fetch(`${base}/api/stream/${clip.id}`, { headers: auth })).status === 200,
    'an indexed file streams');
check((await fetch(`${base}/api/stream/${escape.id}`, { headers: auth })).status === 404,
    'a symlink escaping the scan root is refused');
check((await fetch(`${base}/api/stream/${'0'.repeat(16)}`, { headers: auth })).status === 404,
    'an unknown id is refused');
check((await fetch(`${base}/api/stream/../../etc/passwd`, { headers: auth })).status === 404,
    'a path instead of an id is refused');

console.log('\nrange requests (seeking depends on these)');
const whole = await fetch(`${base}/api/stream/${clip.id}`, { headers: auth });
check(whole.headers.get('accept-ranges') === 'bytes', 'advertises byte ranges');
check(Number(whole.headers.get('content-length')) === body.length, 'full request sends the whole file');

const partial = await fetch(`${base}/api/stream/${clip.id}`, { headers: { ...auth, Range: 'bytes=4-9' } });
check(partial.status === 206, 'a range request returns 206');
check(partial.headers.get('content-range') === `bytes 4-9/${body.length}`, 'reports the right Content-Range');
check(await partial.text() === '456789', 'returns exactly the requested bytes');

const openEnded = await fetch(`${base}/api/stream/${clip.id}`, { headers: { ...auth, Range: 'bytes=30-' } });
check(await openEnded.text() === 'uvwxyz', 'an open-ended range runs to the end');

const suffix = await fetch(`${base}/api/stream/${clip.id}`, { headers: { ...auth, Range: 'bytes=-6' } });
check(await suffix.text() === 'uvwxyz', 'a suffix range returns the last bytes');

const bad = await fetch(`${base}/api/stream/${clip.id}`, { headers: { ...auth, Range: 'bytes=999-1200' } });
check(bad.status === 416, 'an unsatisfiable range returns 416');

console.log('\nCORS (the hosted page is a different origin)');
const cors = await fetch(`${base}/api/library`, {
    headers: { ...auth, Origin: 'https://jellyjump.voidall.com' },
});
check(cors.headers.get('access-control-allow-origin') === 'https://jellyjump.voidall.com',
    'allows the hosted origin');
check((cors.headers.get('access-control-expose-headers') || '').includes('Content-Range'),
    'exposes Content-Range, without which seeking cannot work');
const foreign = await fetch(`${base}/api/library`, { headers: { ...auth, Origin: 'https://evil.example' } });
check(!foreign.headers.get('access-control-allow-origin'), 'does not allow an unknown origin');

console.log('link lists travel with the listing');
const withLists = await (await fetch(`${base}/api/library`, { headers: auth })).json();
check(Array.isArray(withLists.linkLists) && withLists.linkLists.length === 1,
    'a .jjlist appears in the listing');
check(withLists.linkLists[0].name === 'songs.jjlist' && withLists.linkLists[0].text.includes('8scL5oJX6CM'),
    'as its name and its text, for the client to parse');
check(!withLists.linkLists[0].path, 'without its path, which is not the client\'s business');
check(!withLists.items.some(i => i.name.endsWith('.jjlist')),
    'and never as a file in the listing');

const streamed = await (await fetch(`${base}/api/library/stream`, { headers: auth })).text();
const lines = streamed.trim().split('\n').map(JSON.parse);
check(lines.filter(l => l.kind === 'linklist').length === 1, 'and on its own line when streamed');
check(lines[1]?.kind === 'linklist', 'ahead of the files, so it lands with the first batch');

// The point of keeping link lists out of the file index: a playlist file is not
// something to serve, and the index is what /api/stream answers from.
console.log('a link list is not fetchable');
check((await fetch(`${base}/api/stream/${index.idFor(listPath)}`, { headers: auth })).status === 404,
    'its id resolves to nothing, so it cannot be downloaded');

await server.stop();
rmSync(tmp, { recursive: true, force: true });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
