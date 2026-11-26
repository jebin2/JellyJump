/**
 * The remote buffer's store (shared/media/buffer/PieceStore.js), on the
 * memory backend with a fake server: what it fetches, keeps, lets go of and
 * refuses. ARCHITECTURE_PLAN.md U1. The disk backend is checked in a browser
 * by piece-store-opfs-test.
 *
 *   node scripts/piece-store-test.mjs
 */
import { PieceStore, remoteFileKey, hashKey } from '../assets/js/shared/media/buffer/PieceStore.js';
import { MemoryBackend } from '../assets/js/shared/media/buffer/MemoryBackend.js';
import { Downloader } from '../assets/js/shared/media/buffer/Downloader.js';
import { downloadedTimeRanges, watchDownloadedRanges, stopDownloadedRanges, ByteClock, THROTTLE_MS, SAMPLE_MS } from '../assets/js/core/playback/DownloadedRanges.js';

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
    if (ok) { passed++; console.log(`  PASS  ${name}`); }
    else { failed++; console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ''}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PIECE = 1000;

/**
 * A server for one or more files: answers range requests (206, Content-Range,
 * ETag), sends bodies in chunks with an optional delay between them, and
 * records every request and whether it was aborted.
 */
function fakeServer(files) {
    const server = { requests: [], ranges: true, down: false, chunk: 250, delay: 0 };
    server.fetch = async (url, init = {}) => {
        if (server.down) throw new TypeError('Failed to fetch');
        const file = files[url];
        const range = /bytes=(\d+)-(\d+)/.exec(new Headers(init.headers).get('range') || '');
        const request = { url, range: range ? [Number(range[1]), Number(range[2])] : null, aborted: false, delivered: 0, started: Date.now(), ended: null };
        server.requests.push(request);
        init.signal?.addEventListener('abort', () => { request.aborted = true; });
        if (!file) return new Response('', { status: 404 });
        const headers = { 'Content-Type': 'video/mp4' };
        if (file.etag) headers.ETag = file.etag;
        if (!server.ranges || !range) {
            return new Response(file.bytes, { status: 200, headers: { ...headers, 'Content-Length': String(file.bytes.length) } });
        }
        const start = Number(range[1]);
        const end = Math.min(Number(range[2]), file.bytes.length - 1);
        const body = file.bytes.slice(start, end + 1);
        const stream = new ReadableStream({
            async start(controller) {
                for (let at = 0; at < body.length; at += server.chunk) {
                    if (request.aborted) { request.ended ??= Date.now(); controller.error(new DOMException('Aborted', 'AbortError')); return; }
                    if (server.delay) await sleep(server.delay);
                    if (request.aborted) { request.ended ??= Date.now(); controller.error(new DOMException('Aborted', 'AbortError')); return; }
                    const piece = body.slice(at, at + server.chunk);
                    request.delivered += piece.length;
                    controller.enqueue(piece);
                }
                request.ended = Date.now();
                controller.close();
            },
            cancel() { request.aborted = true; request.ended = Date.now(); },
        });
        return new Response(stream, {
            status: 206,
            headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${file.bytes.length}`, 'Content-Length': String(body.length) },
        });
    };
    return server;
}

const bytesOf = (n, seed = 0) => new Uint8Array(n).map((_, i) => (i * 7 + seed) % 251);
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

let clock = 1000;
const makeStore = (server, { backend = new MemoryBackend(), budget = 1e9, retryDelays = [] } = {}) =>
    new PieceStore({ backend, budget, fetchFn: server.fetch, pieceSize: PIECE, now: () => clock++, retryDelays });

console.log('\nfile keys\n');
{
    const { pieceSizeFor } = await import('../assets/js/shared/media/buffer/PieceStore.js');
    check('a film is cut into 4 MB pieces', pieceSizeFor(6e9) === 4 * 1024 * 1024);
    check('a small file finer, never under 64 KB', pieceSizeFor(300 * 1024) === 64 * 1024 && pieceSizeFor(100e6) === 23 * 64 * 1024,
        `${pieceSizeFor(300 * 1024)} ${pieceSizeFor(100e6)}`);
    check('a shared library file is known by server and id, not its URL',
        remoteFileKey('http://h/api/stream/abc?sig=1', { remoteServer: 'home', remoteId: 'abc' }) === 'library:home:abc');
    check('a URL is known without its access parameters',
        remoteFileKey('https://h/v.mp4?sig=aa&token=bb&id=3') === remoteFileKey('https://h/v.mp4?id=3&sig=cc'));
    check('but other parameters still tell files apart',
        remoteFileKey('https://h/v.mp4?id=3') !== remoteFileKey('https://h/v.mp4?id=4'));
    check('the folder name is a fixed-length hash', /^[0-9a-f]{16}$/.test(hashKey('library:home:abc')));
}

console.log('\nreading\n');
{
    const data = bytesOf(3500);
    const server = fakeServer({ 'https://h/a.mp4': { bytes: data, etag: '"v1"' } });
    const store = makeStore(server);
    const file = await store.open({ url: 'https://h/a.mp4', key: 'url:a' });
    check('open asks the server for one byte, to learn the size and version',
        server.requests.length === 1 && server.requests[0].range.join() === '0,0' && file.size === 3500,
        JSON.stringify(server.requests));
    const read = await file.read(900, 2100);
    check('a read across three pieces returns exactly those bytes', same(read, data.slice(900, 2100)));
    await file.ensure(0);
    check('each piece fetched with ranges of its own, from where the reader needed it first; its start after',
        server.requests.slice(1).map((r) => r.range.join('-')).join() === '900-999,1000-1999,2000-2999,0-899',
        server.requests.slice(1).map((r) => r.range.join('-')).join());
    const before = server.requests.length;
    const again = await file.read(0, 3000);
    check('a read of kept pieces asks the network for nothing', server.requests.length === before && same(again, data.slice(0, 3000)));
    const tail = await file.read(3400, 9999);
    await file.ensure(3);
    check('the last piece is shorter, and a read past the end stops at it', same(tail, data.slice(3400)));
    check('the kept bytes, merged', JSON.stringify(file.downloadedRanges()) === '[[0,3500]]', JSON.stringify(file.downloadedRanges()));
    check('and the file is complete', file.isComplete());
    file.close();
}

console.log('\none fetch, many readers\n');
{
    const data = bytesOf(2000, 3);
    const server = fakeServer({ 'https://h/b.mp4': { bytes: data, etag: '"v1"' } });
    server.delay = 20;
    const store = makeStore(server);
    const file = await store.open({ url: 'https://h/b.mp4', key: 'url:b' });
    const [x, y] = await Promise.all([file.read(0, 500), file.read(100, 900)]);
    await file.ensure(0);
    const delivered = server.requests.slice(1).reduce((sum, r) => sum + r.delivered, 0);
    // The first request is cut short where the second began; at most the
    // chunk it was sending when cut comes twice.
    check('two readers of the same piece do not fetch it twice', delivered <= 1000 + server.chunk,
        `${delivered} bytes delivered: ${server.requests.slice(1).map((r) => `${r.range.join('-')} (${r.delivered})`).join()}`);
    check('and both get their bytes', same(x, data.slice(0, 500)) && same(y, data.slice(100, 900)));

    const started = Date.now();
    const early = file.read(1000, 1100);
    const got = await early;
    const waited = Date.now() - started;
    check('a reader gets its bytes as soon as they arrive, not when the whole piece has',
        same(got, data.slice(1000, 1100)) && waited < 4 * server.delay, `${waited} ms; a whole piece takes ${4 * server.delay}+`);
    await file.ensure(1);
    check('and the piece is kept once it is whole', file.has(1));
    file.close();
}

console.log('\na seek into the middle of a piece\n');
{
    const data = bytesOf(4000, 11);
    const server = fakeServer({ 'https://h/m.mp4': { bytes: data, etag: '"v1"' } });
    server.chunk = 100;
    server.delay = 10;
    const store = makeStore(server);
    const file = await store.open({ url: 'https://h/m.mp4', key: 'url:m' });
    file.fetchPiece(1);                       // the downloader working through piece 1
    await sleep(15);
    const started = Date.now();
    const bytes = await file.read(1900, 1950);   // a seek to its end
    const waited = Date.now() - started;
    check('a reader near a piece\'s end does not wait for its beginning',
        same(bytes, data.slice(1900, 1950)) && waited < 8 * server.delay, `${waited} ms; the whole piece takes ${10 * server.delay}+`);
    check('it starts a request where it needs the bytes',
        server.requests.some((r) => r.range?.[0] === 1900), server.requests.map((r) => r.range?.join('-')).join());
    await file.ensure(1);
    check('and the piece is still completed and kept, the request before it stopping where the new one began',
        file.has(1) && same(await file.read(1000, 2000), data.slice(1000, 2000)));
    const piece1 = server.requests.filter((r) => r.range && r.range[0] >= 1000 && r.range[0] < 2000);
    check('without fetching any byte twice from the server... beyond what was in flight',
        piece1.length <= 3, piece1.map((r) => r.range.join('-')).join());
    file.close();
}

console.log('\nthe bytes before a seek point\n');
{
    const data = bytesOf(4000, 23);
    const server = fakeServer({ 'https://h/s.mp4': { bytes: data, etag: '"v1"' } });
    const store = makeStore(server);
    const file = await store.open({ url: 'https://h/s.mp4', key: 'url:s' });
    const bytes = await file.read(1600, 1700);     // a seek lands inside piece 1
    await sleep(30);
    const asked = server.requests.slice(1).map((r) => r.range.join('-'));
    check('the seek\'s bytes come first', same(bytes, data.slice(1600, 1700)) && asked[0] === '1600-1999', asked.join(', '));
    check('the piece\'s start, behind the picture, waits', !asked.includes('1000-1599') && !file.has(1), asked.join(', '));
    check('ahead of the seek point counts from it, not from the piece', file.contiguousFromByte(1650) === 350,
        `${file.contiguousFromByte(1650)}`);
    check('it is fetched once nothing else is', file.resumeBackground() === true);
    await file.ensure(1);
    check('and the piece is then kept whole', file.has(1) && file.contiguousFromByte(1650) === 350);
    file.close();
}

console.log('\nthe downloader\n');
{
    const data = bytesOf(6000, 13);
    const server = fakeServer({ 'https://h/w.mp4': { bytes: data, etag: '"v1"' } });
    server.chunk = 100;
    server.delay = 8;
    const store = makeStore(server);
    const file = await store.open({ url: 'https://h/w.mp4', key: 'url:w' });
    const downloader = new Downloader(file, { budget: 1e9 });
    downloader.start();
    downloader.setDuration(60);           // 100 bytes a second: the whole file is "ahead"
    downloader.loaded();
    // A seek into the middle of piece 2 while the downloader works.
    await sleep(20);
    downloader.noteRead(2500, 2600);
    const bytes = await file.read(2500, 2600);
    check('a reader gets its bytes while the downloader runs', same(bytes, data.slice(2500, 2600)));
    const ahead = () => [2, 3, 4, 5].every((i) => file.has(i));
    for (let i = 0; i < 200 && !ahead(); i++) await sleep(20);
    check('the downloader fetches what is ahead of the seek', ahead());
    check('and finishes the piece it was on when the reader came, keeping the bytes it had', file.has(0),
        server.requests.map((r) => r.range?.join('-')).join(', '));
    const requests = server.requests.slice(1).filter((r) => r.delivered > 0);
    let overlap = null;
    for (const a of requests) for (const b of requests) {
        // An abort takes a moment to reach the server: 20 ms of slack.
        if (a !== b && a.started < b.started && b.started < (a.ended ?? Infinity) - 20) overlap = `${a.range.join('-')} and ${b.range.join('-')}`;
    }
    check('one request at a time: none starts while another is still sending', overlap === null,
        `${overlap}; ${requests.map((r) => `${r.range.join('-')}@${r.started % 100000}-${r.ended % 100000}`).join(', ')}`);
    downloader.stop();
    file.close();
}

console.log('\nphone data\n');
{
    const data = bytesOf(10000, 17);
    const server = fakeServer({ 'https://h/p.mp4': { bytes: data, etag: '"v1"' } });
    const store = makeStore(server);
    const file = await store.open({ url: 'https://h/p.mp4', key: 'url:p' });
    let playing = false;
    const downloader = new Downloader(file, { budget: 1e9, isPlaying: () => playing, metered: () => true });
    downloader.start();
    downloader.setDuration(1000);   // 10 bytes a second: 120 s is 1,200 bytes, two pieces
    downloader.loaded();
    await sleep(150);
    check('on a metered connection nothing is fetched while paused', server.requests.length === 1,
        server.requests.map((r) => r.range?.join('-')).join(', '));
    playing = true;
    for (let i = 0; i < 50 && !file.has(2); i++) await sleep(20);
    await sleep(100);
    const kept = [...file.record.pieces.keys()].sort((a, b) => a - b).join();
    // The piece being read, and two more: 120 s at 10 bytes a second.
    check('and while playing it reads only two minutes ahead', kept === '0,1,2', kept);
    downloader.stop();
    file.close();
}

console.log('\nletting go\n');
{
    const data = bytesOf(10000, 5);
    const server = fakeServer({ 'https://h/c.mp4': { bytes: data, etag: '"v1"' } });
    server.delay = 30;
    const store = makeStore(server);
    const file = await store.open({ url: 'https://h/c.mp4', key: 'url:c' });
    file.fetchPiece(2);
    file.fetchPiece(3);
    const wanted = file.read(4000, 4100);
    await sleep(5);
    file.abortExcept((index) => index === 3 || index === 4);
    await sleep(5);
    const byPiece = (i) => server.requests.find((r) => r.range?.[0] === i * PIECE);
    check('a fetch the jump left behind is aborted', byPiece(2)?.aborted === true && !file.isFetching(2));
    check('one a reader in the window is waiting on is not', byPiece(4)?.aborted === false);
    check('and the reader gets its bytes', same(await wanted, data.slice(4000, 4100)));
    await file.ensure(3);
    check('one still wanted, paused for the reader, is finished after it', file.has(3) && !file.has(2));

    // The reader from before a seek: MediaBunny leaves it waiting.
    server.requests.length = 0;
    let staleDone = false;
    const stale = file.read(8500, 8600).then(() => { staleDone = true; });
    await sleep(15);
    file.abortExcept((index) => index === 9);       // the seek: the window is piece 9 now
    const fresh = file.read(9500, 9600);
    await sleep(5);
    const piece8 = server.requests.find((r) => r.range && r.range[0] >= 8 * PIECE && r.range[0] < 9 * PIECE);
    check('a piece left behind with a reader still waiting on it stops downloading', piece8?.aborted === true,
        server.requests.map((r) => `${r.range?.join('-')}${r.aborted ? ' aborted' : ''}`).join(', '));
    check('so the seek\'s piece has the link to itself', same(await fresh, data.slice(9500, 9600)) && !staleDone);
    await file.whenIdle();
    check('it waits in the background, until the link is idle', !staleDone && file.resumeBackground() === true);
    await stale;
    await file.ensure(8);   // stored just after its reader had the bytes
    check('and finishes when the downloader has nothing else to fetch, keeping the bytes it had', staleDone && file.has(8)
        && server.requests.filter((r) => r.range && r.range[0] >= 8 * PIECE && r.range[0] < 9 * PIECE).length <= 3,
        server.requests.map((r) => r.range?.join('-')).join(', '));

    server.delay = 0;
    for (let i = 0; i < 10; i++) await file.ensure(i);
    file.pin(0);
    await file.keepOnly(5, 7);
    check('the window keeps only its pieces, and the pinned one',
        [...file.record.pieces.keys()].sort((a, b) => a - b).join() === '0,5,6,7', [...file.record.pieces.keys()].join());
    const backendPieces = [...store.backend.files.get(file.id).pieces.keys()].sort((a, b) => a - b).join();
    check('and deletes the rest from storage', backendPieces === '0,5,6,7', backendPieces);
    file.close();
    const closedRead = await file.read(0, 10).then(() => 'read', (e) => e.code);
    check('a closed file refuses reads', closedRead === 'CANCELLED', closedRead);
}

console.log('\nwhat the seek bar shades\n');
{
    const data = bytesOf(9500, 9);
    const server = fakeServer({ 'https://h/s.mkv': { bytes: data, etag: '"v1"' } });
    const store = makeStore(server);
    const file = await store.open({ url: 'https://h/s.mkv', key: 'url:s' });
    for (const i of [0, 1, 2, 5, 8, 9]) await file.ensure(i);
    // The header (piece 0) and the index at the end (8, 9), as a load pins them.
    for (const i of [0, 8, 9]) file.pin(i);
    const ranges = file.playableRanges();
    check('whole pieces kept, merged; a run of only the index at the end is left out',
        JSON.stringify(ranges) === '[[0,3000],[5000,6000]]', JSON.stringify(ranges));
    check('never more than is kept', ranges.every(([a, b]) => file.downloadedRanges().some(([c, d]) => c <= a && b <= d)));
    const times = downloadedTimeRanges(file, 95);
    check('placed in time by the share of the file', JSON.stringify(times) === '[[0,30],[50,60]]', JSON.stringify(times));
    await file.forget([1, 2]);
    check('the first piece alone still shows: it holds the start of the video',
        JSON.stringify(file.playableRanges()) === '[[0,1000],[5000,6000]]', JSON.stringify(file.playableRanges()));
    for (const i of [1, 2]) await file.ensure(i);
    const seen = new ByteClock(file.size);
    seen.note(4500, 45);    // read inside piece 4, before the kept piece 5
    check('only the parts placed: a read in them, or in the piece before',
        JSON.stringify(downloadedTimeRanges(file, 95, seen, { placedOnly: true })) === '[[0,30],[50,60]]'
        && JSON.stringify(downloadedTimeRanges(file, 95, new ByteClock(file.size), { placedOnly: true })) === '[[0,30]]');
    check('nothing before the duration is known', downloadedTimeRanges(file, NaN).length === 0 && downloadedTimeRanges(file, 0).length === 0);

    // A player: announced at once, then at most every THROTTLE_MS as pieces come, and cleared when let go.
    const events = [];
    const downloader = { readByte: 0, loading: false, jumpTo: null };
    const player = { duration: 95, isPlaying: false, currentTime: 0, media: { remote: { file, downloader } },
        trigger: (name, data) => events.push({ name, ...data }) };
    watchDownloadedRanges(player);
    check('announced when the file opens: the start of the file, not yet a part no read has placed',
        events.length === 1 && events[0].name === 'bufferchange'
        && JSON.stringify(events[0].ranges) === '[[0,30]]', JSON.stringify(events));
    await file.ensure(3);
    await file.ensure(4);
    await sleep(THROTTLE_MS + 50);
    check('and again as pieces come, once for several', events.length === 2
        && JSON.stringify(events[1].ranges) === '[[0,60]]', JSON.stringify(events));
    stopDownloadedRanges(player);
    check('cleared when the media is let go', events.length === 3 && events[2].ranges.length === 0);
    await file.ensure(6);
    await sleep(THROTTLE_MS + 50);
    check('and no longer follows the file', events.length === 3);
    stopDownloadedRanges(player);
    check('let go twice: announced once', events.length === 3);

    const local = { duration: 10, media: { remote: null }, trigger: (name, data) => events.push({ name, ...data }) };
    watchDownloadedRanges(local);
    check('a file not played through the buffer shows none', events.length === 4 && events[3].ranges.length === 0);
    file.close();
}

console.log('\nbytes to time, from where the player reads\n');
{
    // A file whose bytes do not follow time evenly, as on a device: 76.5% of the time at 79.2% of the bytes.
    const clock = new ByteClock(1000);
    check('without points, a byte\'s share of the size', clock.timeAt(500, 100) === 50);
    clock.note(792, 76.5);
    check('a point seen places that byte at its time', Math.abs(clock.timeAt(792, 100) - 76.5) < 1e-9);
    check('and the bytes around it between it and the ends',
        Math.abs(clock.timeAt(396, 100) - 38.25) < 1e-9 && Math.abs(clock.timeAt(896, 100) - 88.25) < 1e-9,
        `${clock.timeAt(396, 100)} ${clock.timeAt(896, 100)}`);
    clock.note(300, 40);
    clock.note(500, 30);    // contradicts 300 → 40: the newest wins
    check('a point it contradicts goes', clock.points.map((p) => p.byte).join() === '500,792', clock.points.map((p) => p.byte).join());
    check('a time never past the duration', clock.timeAt(1000, 80) <= 80 && clock.timeAt(900, 80) <= 80);

    // The player: points taken only while the read position and the time are steady.
    const data = bytesOf(10000, 3);
    const server = fakeServer({ 'https://h/t.mkv': { bytes: data, etag: '"v1"' } });
    const store = makeStore(server);
    const file = await store.open({ url: 'https://h/t.mkv', key: 'url:t' });
    // After a seek to 76.5 s, read at byte 7920: the piece it lands in is fetched from
    // there (not kept whole), the next ones whole.
    for (const i of [8, 9]) await file.ensure(i);
    const events = [];
    const downloader = { readByte: 7920, loading: false, jumpTo: null };
    const player = { duration: 100, isPlaying: false, isLoading: false, currentTime: 76.5, playbackRate: 1,
        media: { remote: { file, downloader } }, trigger: (name, data) => events.push({ name, ...data }) };
    watchDownloadedRanges(player);
    check('before any point, not shown (by the share of the file it would be 90 s away on the device)',
        events.at(-1).ranges.length === 0, JSON.stringify(events.at(-1).ranges));
    downloader.jumpTo = 7;                                   // a seek settling: not a point
    await sleep(SAMPLE_MS * 2 + THROTTLE_MS + 100);
    check('no point while a seek settles', events.length === 1, `${events.length}`);
    downloader.jumpTo = null;
    await sleep(SAMPLE_MS * 2 + THROTTLE_MS + 100);         // paused, neither moving: a point
    const placed = events.at(-1).ranges[0];
    check('paused and steady, the read position places the shading at the playhead',
        placed[0] >= 76.5 && placed[0] - 76.5 < 2 && placed[1] === 100, JSON.stringify(placed));
    const count = events.length;
    await sleep(SAMPLE_MS * 2 + 100);
    check('and paused, it is not redrawn every second', events.length === count, `${events.length - count} more`);

    // Playing: the time moves with the clock, the reads with it.
    player.isPlaying = true;
    const started = performance.now();
    const tick = setInterval(() => {
        player.currentTime = 76.5 + (performance.now() - started) / 1000;
        downloader.readByte = 7920 + Math.round((performance.now() - started) / 1000 * 30);
    }, 50);
    await sleep(SAMPLE_MS * 3);
    check('playing on at the clock\'s pace, points are taken', events.length > count);
    clearInterval(tick);
    await sleep(THROTTLE_MS + 100);
    const before = events.at(-1).ranges[0];
    player.currentTime = 20;                                // a jump in time between samples: not steady
    await sleep(SAMPLE_MS * 2 + THROTTLE_MS + 100);
    const after = events.at(-1).ranges[0];
    check('a jump between two samples is not a point (the shading stays where it was)',
        JSON.stringify(after) === JSON.stringify(before), `${JSON.stringify(before)} → ${JSON.stringify(after)}`);
    stopDownloadedRanges(player);
    file.close();
}

console.log('\nthe budget\n');
{
    const server = fakeServer({
        'https://h/1.mp4': { bytes: bytesOf(3000, 1), etag: '"1"' },
        'https://h/2.mp4': { bytes: bytesOf(3000, 2), etag: '"2"' },
        'https://h/3.mp4': { bytes: bytesOf(3000, 3), etag: '"3"' },
    });
    const store = makeStore(server, { budget: 7000 });
    const one = await store.open({ url: 'https://h/1.mp4', key: 'k1' });
    await one.read(0, 3000);
    one.close();
    const two = await store.open({ url: 'https://h/2.mp4', key: 'k2' });
    await two.read(0, 3000);
    two.close();
    const three = await store.open({ url: 'https://h/3.mp4', key: 'k3' });
    await three.read(0, 3000);
    await store.settled();
    check('over the budget, the least recently played file goes, whole',
        !store.files.has(hashKey('k1')) && store.files.has(hashKey('k2')) && store.usage() <= 7000,
        `${[...store.files.values()].map((r) => r.meta.key)} ${store.usage()}`);
    check('the file playing is never the one let go', three.isComplete());
    three.close();
    await store.drop('k2');
    check('a removed item\'s pieces are deleted', !store.files.has(hashKey('k2')) && !store.backend.files.has(hashKey('k2')));
}

console.log('\nthe file changed on the server\n');
{
    const file1 = { bytes: bytesOf(2500, 1), etag: '"v1"' };
    const server = fakeServer({ 'https://h/d.mp4': file1 });
    const backend = new MemoryBackend();
    const store = makeStore(server, { backend });
    let file = await store.open({ url: 'https://h/d.mp4', key: 'kd' });
    await file.read(0, 2500);
    file.close();

    file1.etag = '"v2"';
    file1.bytes = bytesOf(2500, 9);
    file = await store.open({ url: 'https://h/d.mp4', key: 'kd' });
    check('reopened with a new ETag: what was kept is dropped', file.downloadedRanges().length === 0);
    check('and what is read is the new file', same(await file.read(0, 100), file1.bytes.slice(0, 100)));

    file1.etag = '"v3"';
    const midPlay = await file.read(1000, 1100).then(() => 'read', (e) => e.code);
    check('changed while playing: the read fails as SOURCE_CHANGED', midPlay === 'SOURCE_CHANGED', midPlay);
    check('and its pieces are dropped', !store.files.has(file.id));
    file.close();
}

console.log('\nservers and networks\n');
{
    const server = fakeServer({ 'https://h/e.mp4': { bytes: bytesOf(2000), etag: '"v1"' } });
    server.ranges = false;
    const store = makeStore(server);
    const refused = await store.open({ url: 'https://h/e.mp4', key: 'ke' }).then(() => 'opened', (e) => e.code);
    check('a server that ignores ranges is refused as NO_RANGES (played the old way)', refused === 'NO_RANGES', refused);

    server.ranges = true;
    const file = await store.open({ url: 'https://h/e.mp4', key: 'ke' });
    await file.read(0, 1000);
    file.close();
    server.down = true;
    const offline = await store.open({ url: 'https://h/e.mp4', key: 'ke' }).then((f) => f, (e) => e);
    check('offline, a file with pieces kept still opens', offline.size === 2000, String(offline?.code));
    check('and plays what was kept', same(await offline.read(0, 1000), bytesOf(2000).slice(0, 1000)));
    const missing = await offline.read(1000, 1100).then(() => 'read', (e) => e.code);
    check('a piece not kept fails as NETWORK', missing === 'NETWORK', missing);
    offline.close();
    server.down = false;
    const retrying = makeStore(server, { retryDelays: [0.02, 0.02] });
    const flaky = await retrying.open({ url: 'https://h/e.mp4', key: 'flaky' });
    server.down = true;
    setTimeout(() => { server.down = false; }, 30);
    const recovered = await flaky.read(1000, 1100).then((b) => same(b, bytesOf(2000).slice(1000, 1100)), (e) => e.code);
    check('a reader\'s piece is retried after a blip on the link', recovered === true, String(recovered));
    flaky.close();
    server.down = true;
    const never = await store.open({ url: 'https://h/e.mp4', key: 'never' }).then(() => 'opened', (e) => e.code);
    check('offline, a file never fetched cannot open', never === 'NETWORK', never);
}

console.log('\nwhat survives a reload\n');
{
    const server = fakeServer({
        'https://h/f.mp4': { bytes: bytesOf(2000), etag: '"v1"' },
        'https://h/g.mp4': { bytes: bytesOf(2000) },   // no ETag, no Last-Modified
    });
    const backend = new MemoryBackend();
    const store = makeStore(server, { backend });
    const kept = await store.open({ url: 'https://h/f.mp4', key: 'kf' });
    await kept.read(0, 2000);
    kept.close();
    const unversioned = await store.open({ url: 'https://h/g.mp4', key: 'kg' });
    await unversioned.read(0, 2000);
    unversioned.close();

    const reloaded = await makeStore(server, { backend }).load();
    check('a file with a validator is there after a reload', reloaded.files.get(hashKey('kf'))?.pieces.size === 2);
    check('one without is not: it may have changed unseen', !reloaded.files.has(hashKey('kg')));

    // The browser cleared a piece behind the store's back.
    await backend.deletePiece(hashKey('kf'), 1);
    const before = server.requests.length;
    const file = await reloaded.open({ url: 'https://h/f.mp4', key: 'kf' });
    const bytes = await file.read(1500, 1600);
    check('a piece gone from storage is fetched again, not trusted from the list',
        same(bytes, bytesOf(2000).slice(1500, 1600)) && server.requests.length > before + 1);
    file.close();
}

console.log('\nthe link\n');
{
    const server = fakeServer({ 'https://h/r.mp4': { bytes: bytesOf(800000), etag: '"v1"' } });
    server.chunk = 10000;
    server.delay = 30;
    const store = new PieceStore({ backend: new MemoryBackend(), budget: 1e9, fetchFn: server.fetch, pieceSize: 100000 });
    const file = await store.open({ url: 'https://h/r.mp4', key: 'kr' });
    check('no rate before anything is fetched', file.linkRate() === null);
    for (let i = 0; i < 4; i++) await file.ensure(i);
    const rate = file.linkRate();
    // 10 KB every ~30 ms is ~330 KB/s, over more than the second it needs;
    // timers are coarse, so a wide band.
    check('the rate is measured from the time spent receiving', rate > 150000 && rate < 700000, `${Math.round(rate)} B/s`);
    // The link drops: a few seconds later the measure says so, not the
    // fast seconds before it.
    server.delay = 200;                // 10 KB every 200 ms: 50 KB/s
    for (let i = 4; i < 8; i++) await file.ensure(i);
    const dropped = file.linkRate();
    check('when the link drops, the measure follows within seconds', dropped < 100000, `${Math.round(dropped)} B/s`);
    file.close();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
