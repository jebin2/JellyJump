/**
 * Drives the built app in a real browser and checks the things a change to
 * the core could break without any unit test noticing.
 *
 * Every browser check in this project has so far been written ad hoc in a
 * scratch directory and thrown away. That is fine for investigating a bug and
 * useless as a safety net: the core player is about to be taken apart into
 * components, and the parts most likely to break quietly -- opening a file,
 * seeking, the camera, recording -- have no coverage at all. This is the net.
 *
 * It needs a Chromium or Chrome binary. Point CHROMIUM_PATH at one if it is
 * somewhere unusual.
 *
 *   npm run build && npm run test:smoke
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const FIXTURES = join(ROOT, 'scripts/fixtures');
// Served under a prefix rather than one mapped file: HLS is a playlist plus
// its segments, so it needs a directory.
const FIXTURE_PREFIX = '/__fixtures__/';
const FIXTURE_URL = `${FIXTURE_PREFIX}smoke.webm`;
const HLS_URL = `${FIXTURE_PREFIX}hls/stream.m3u8`;
// A live playlist cannot be a file: what makes a stream live is the absence of
// #EXT-X-ENDLIST, and mediabunny then re-reads the playlist every
// TARGETDURATION seconds expecting the window to have moved on. So it is
// generated per request, with a media sequence that advances with the clock.
const LIVE_PREFIX = '/__live__/';
const LIVE_URL = `${LIVE_PREFIX}stream.m3u8`;

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
    '.m3u8': 'application/vnd.apple.mpegurl', '.ts': 'video/mp2t',
};

// Reuses the HLS fixture's three one-second segments as a sliding window. The
// sequence advances for the first few seconds and then settles, so the stream
// keeps answering refreshes without this test having to generate media.
const live = {
    startedAt: 0,
    playlistRequests: 0,
    segmentRequests: [],
    reset() { this.startedAt = Date.now(); this.playlistRequests = 0; this.segmentRequests = []; },
    playlist() {
        this.playlistRequests++;
        const elapsed = this.startedAt ? (Date.now() - this.startedAt) / 1000 : 0;
        const sequence = Math.min(Math.floor(elapsed), 6);
        const lines = [
            '#EXTM3U', '#EXT-X-VERSION:3', '#EXT-X-TARGETDURATION:1',
            `#EXT-X-MEDIA-SEQUENCE:${sequence}`,
        ];
        // No #EXT-X-ENDLIST and no #EXT-X-PLAYLIST-TYPE: either one tells
        // mediabunny the stream has ended, and isLive goes false.
        for (let i = 0; i < 3; i++) {
            lines.push('#EXTINF:1.000000,', `seg${(sequence + i) % 3}.ts`);
        }
        return lines.join('\n') + '\n';
    },
};

async function serveDist() {
    const server = createServer(async (req, res) => {
        try {
            const path = decodeURIComponent(req.url.split('?')[0]);
            if (path === LIVE_URL) {
                const body = live.playlist();
                res.writeHead(200, {
                    'Content-Type': TYPES['.m3u8'],
                    'Content-Length': Buffer.byteLength(body),
                    // Without this the refreshes come from the cache and the
                    // window never appears to move.
                    'Cache-Control': 'no-store',
                    'Cross-Origin-Opener-Policy': 'same-origin',
                    'Cross-Origin-Embedder-Policy': 'require-corp',
                });
                res.end(body);
                return;
            }
            if (path.startsWith(LIVE_PREFIX)) live.segmentRequests.push(path.slice(LIVE_PREFIX.length));
            const file = path.startsWith(LIVE_PREFIX)
                ? join(FIXTURES, 'hls', path.slice(LIVE_PREFIX.length))
                : path.startsWith(FIXTURE_PREFIX)
                ? join(FIXTURES, path.slice(FIXTURE_PREFIX.length))
                : join(DIST, path === '/' ? 'index.html' : path);
            // Nothing outside dist or the fixtures, whatever the request says.
            if (!file.startsWith(DIST) && !file.startsWith(FIXTURES)) { res.writeHead(403).end(); return; }
            const info = await stat(file);
            if (!info.isFile()) { res.writeHead(404).end(); return; }
            res.writeHead(200, {
                'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
                'Content-Length': info.size,
                // The app wants these for its workers; without them the
                // player falls back and the test measures the wrong thing.
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
    page.on('console', m => {
        if (m.type() !== 'error') return;
        const text = m.text();
        // Request failures are already covered by the response handler below,
        // which knows which URL they came from.
        if (text.includes('Failed to load resource')) return;
        errors.push(`console: ${text.slice(0, 160)}`);
    });
    page.on('response', r => {
        if (r.status() >= 400) errors.push(`${r.status()} ${r.url().replace(origin, '')}`);
    });
    // Nothing may leave this machine. The analytics embed is real now, and it
    // posts an event per page load, so without this every run would write test
    // traffic into the project's live analytics. Blocking all non-local
    // requests also means an accidental new third-party dependency shows up
    // here as a blocked URL instead of quietly working on the author's
    // machine and failing on someone else's.
    const blocked = new Set();
    await page.route('**/*', route => {
        const url = route.request().url();
        if (url.startsWith(origin) || url.startsWith('blob:') || url.startsWith('data:')) {
            return route.continue();
        }
        blocked.add(url);
        return route.abort();
    });

    // A request that never gets a response is invisible to the handler above.
    // The analytics embed used to 404 here and was excluded by name; when it
    // was briefly pointed at another origin it failed on CSP, which is not a
    // status code at all and so would have gone unnoticed too.
    page.on('requestfailed', r => {
        const url = r.url();
        if (url.startsWith('blob:') || url.startsWith('data:')) return;
        if (blocked.has(url)) return;                 // deliberately cut off
        // The live playlist is polled for as long as the stream is open, so
        // whichever poll is in flight when the run moves on is cancelled.
        if (url.includes(LIVE_URL) && r.failure()?.errorText === 'net::ERR_ABORTED') return;
        errors.push(`${r.failure()?.errorText ?? 'failed'} ${url.replace(origin, '')}`);
    });

    await page.goto(`${origin}/player.html`);
    await page.waitForFunction(() => !!window.player && !!window.playlist, null, { timeout: 60000 });

    console.log('\nit boots');
    check(true, 'player.html loads and exposes the player');

    const opened = await page.evaluate(async (url) => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const blob = await (await fetch(url)).blob();
        const p = window.player;
        await p.load(URL.createObjectURL(new File([blob], 'smoke.webm', { type: 'video/webm' })));
        for (let i = 0; i < 120 && !(p.duration > 0); i++) await sleep(100);
        return { duration: p.duration, canvas: `${p.canvas.width}x${p.canvas.height}`, frameRate: p.frameRate };
    }, FIXTURE_URL);

    console.log('\nit opens a file');
    check(Math.abs(opened.duration - 2) < 0.2, `duration is 2s (${opened.duration})`);
    check(opened.canvas === '320x180', `canvas matches the file (${opened.canvas})`);
    check(opened.frameRate === 15, `frame rate is exactly 15 (${opened.frameRate})`);

    const seeks = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const p = window.player, c = p.canvas;
        const hash = () => {
            const q = document.createElement('canvas');
            q.width = c.width; q.height = c.height;
            q.getContext('2d').drawImage(c, 0, 0);
            const d = q.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) >>> 0;
            return h;
        };
        const at = async t => { await p._seekTo(t); await sleep(400); return hash(); };
        const a = await at(0.4), b = await at(1.6), again = await at(0.4);
        await p.play().catch(() => {});
        await sleep(600);
        const advanced = p.currentTime > 0.6;
        p.pause();
        return { a, b, again, advanced };
    });

    console.log('\nit seeks and plays');
    check(seeks.a !== seeks.b, 'different timestamps draw different frames');
    check(seeks.a === seeks.again, 'seeking back to a timestamp reproduces the frame exactly');
    check(seeks.advanced, 'playback advances the clock');

    // Clicks on the progress bar can arrive faster than a seek completes. The
    // clock always ends up on the last one; the canvas used to be free to keep
    // a frame decoded for an earlier one, so the picture disagreed with the
    // reported position. Measured at 7 failures in 12 before the input paths
    // were coalesced, so a handful of attempts is enough to catch a regression.
    const bar = await page.evaluate(() => {
        const r = window.player.ui.progressContainer.getBoundingClientRect();
        window.__frameHash = () => {
            const c = window.player.canvas;
            const q = document.createElement('canvas');
            q.width = c.width; q.height = c.height;
            q.getContext('2d').drawImage(c, 0, 0);
            const d = q.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let h = 0; for (let i = 0; i < d.length; i += 97) h = (h * 31 + d[i]) >>> 0;
            return h;
        };
        return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
    const clickBar = frac => page.mouse.click(bar.x + bar.w * frac, bar.y + bar.h / 2);
    const settleBar = async frac => {
        await clickBar(frac);
        await page.waitForTimeout(500);
        return page.evaluate(() => window.__frameHash());
    };

    await settleBar(0.95);
    const quietClick = await settleBar(0.20);
    let stormsAgreeing = 0;
    const storms = 5;
    for (let i = 0; i < storms; i++) {
        await settleBar(0.95);
        for (const f of [0.80, 0.45, 0.60]) await clickBar(f);
        await clickBar(0.20);
        await page.waitForTimeout(1800);
        const h = await page.evaluate(() => window.__frameHash());
        if (h === quietClick) stormsAgreeing++;
    }

    check(stormsAgreeing === storms,
        `rapid bar clicks leave the frame for the last one (${stormsAgreeing}/${storms})`);

    // isPlaying is written by four engines in five files, and the play/pause
    // button has to follow every one. The pairing is structural now rather
    // than remembered, so this checks the two cannot drift apart.
    //
    // It runs here, on the ordinary fixture, rather than after the live
    // section: play() does not resolve while a live stream is playing, so
    // awaiting it there hangs the whole run.
    const button = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const p = window.player;
        const agrees = () => {
            const b = p.ui.playBtn;
            if (!b) return null;
            const saysPlaying = b.getAttribute('aria-label') === 'Pause';
            return saysPlaying === !!p.isPlaying;
        };
        const results = [];
        await p.play().catch(() => {}); await sleep(500); results.push(agrees());
        p.pause(); await sleep(300); results.push(agrees());
        await p._seekTo(0.4).catch(() => {}); await sleep(450); results.push(agrees());
        await p.play().catch(() => {}); await sleep(450); results.push(agrees());
        await p._seekTo(1.9).catch(() => {}); await sleep(300);
        await p.play().catch(() => {}); await sleep(1500); results.push(agrees());
        p.pause();
        return results;
    });

    console.log('\nthe button never disagrees with the player');
    check(button.every(ok => ok === true),
        `play, pause, seek, resume and reaching the end all agree (${button.filter(Boolean).length}/${button.length})`);

    const overlays = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const p = window.player;
        p.videoFilters.applyPreset('grayscale');
        await sleep(150);
        const colourOnly = p.videoFilters.canvasMode;
        const s = p.stickers.addEmoji('x');
        s.x = 0.05; s.y = 0.05; s.w = 0.3;
        await p._seekTo(0.4); await sleep(350);
        const withSticker = p.videoFilters.canvasMode;
        let shot = false;
        try { await p.screenshotManager.capture(); await sleep(350);
              shot = (p.screenshotManager.screenshotDataUrl || '').startsWith('data:image/png'); } catch { /* reported below */ }
        p.stickers.clear();
        await sleep(150);
        const cleared = p.videoFilters.canvasMode;
        p.videoFilters.reset();
        return { colourOnly, withSticker, cleared, shot };
    });

    // Reaching the end of a file leaves the playback clock at the end, and the
    // fallback clock's origin has to move with it. When it did not, the next
    // play() read a position of roughly the duration, decided to reset to the
    // start, and then opened the video iterator at that stale position --
    // past the end of the file. It yielded a frame or two, the pump saw `done`
    // and dropped the queue, and nothing reopened it, because the render loop
    // only pumps while the queue is open. isPlaying stayed true and the clock
    // kept running, so nothing looked wrong except that the picture had stopped.
    const afterEnd = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const p = window.player;
        let draws = 0;
        const paint = p.presentFrame.bind(p);
        p.presentFrame = (...args) => { draws++; return paint(...args); };

        // Play to the end and wait until it has actually stopped, then press
        // play again WITHOUT seeking. Seeking first is what used to hide this:
        // it sets the position itself, so the stale clock was never read.
        // Pressing play on a finished video is the path a person takes.
        await p._seekTo(1.0).catch(() => {});
        await sleep(300);
        p.play().catch(() => {});
        // Wait for it to start before waiting for it to stop: play() is async,
        // so isPlaying is still false on the first check and the wait below
        // would fall straight through.
        for (let i = 0; i < 40 && !p.isPlaying; i++) await sleep(50);
        for (let i = 0; i < 80 && p.isPlaying; i++) await sleep(100);
        const endedAt = +p.currentTime.toFixed(2);
        draws = 0;
        p.play().catch(() => {});
        await sleep(1600);
        const resumed = { draws, playing: p.isPlaying, t: +p.currentTime.toFixed(2) };
        p.pause();

        // And loop-one, measured after several loops rather than one. The
        // breakage is cumulative: each loop opened an iterator past the end and
        // dropped it, so only the seek's own frames were ever drawn.
        const previousLoop = p.loopMode;
        p.loopMode = 'one';
        await p._seekTo(0).catch(() => {});
        p.play().catch(() => {});
        await sleep(5000);          // three loop boundaries on a 2s file
        draws = 0;
        await sleep(1500);
        const looped = { draws, playing: p.isPlaying, t: +p.currentTime.toFixed(2) };
        p.loopMode = previousLoop;
        p.pause();
        p.presentFrame = paint;
        return { endedAt, resumed, looped };
    });

    console.log('\nit keeps drawing after the end');
    check(afterEnd.resumed.draws > 8,
        `pressing play on a finished video draws again `
        + `(${afterEnd.resumed.draws} frames in 1.6s, ended at ${afterEnd.endedAt})`);
    check(afterEnd.looped.draws > 8,
        `and loop-one keeps drawing past the loop (${afterEnd.looped.draws} frames in 1.5s)`);

    // Broadcasting the player to someone else. The canvas is the only place
    // every source ends up -- file, HLS, camera, with effects already
    // composited -- so capturing it needs no knowledge of what is playing.
    // Audio comes off the gain node because the ordinary playback path has no
    // video element to capture from.
    //
    // The loopback is two real RTCPeerConnections in this page. No signalling
    // and no network, which is the point: it proves the media path survives
    // WebRTC before any of that exists.
    const broadcast = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const p = window.player;
        const out = {};

        // The fixture is two seconds long, and negotiating a peer connection
        // plus the encoder's ramp-up takes longer than that. Without looping,
        // playback ends before the viewer sees anything and the capture
        // correctly produces nothing -- a canvas nobody paints emits no frames.
        // That is what made this pass early in the run and fail later on, when
        // less of the fixture was left to play.
        const previousLoopMode = p.loopMode;
        p.loopMode = 'one';

        // Opened while playback is running, not while paused. A canvas nobody
        // draws to produces no frames, and a track opened in that state was
        // observed never to begin producing once drawing resumed -- the viewer
        // decoded one frame in two and a half seconds while the host's clock
        // advanced normally.
        await p._seekTo(0.2).catch(() => {});
        await p.play().catch(() => {});
        await sleep(600);
        const opened = p.broadcast.open({ fps: 15 });
        out.videoAtOpen = opened?.getVideoTracks().length ?? -1;
        await sleep(400);

        // Is captureStream itself producing? Attach the track to a local
        // element with no peer connection in the way, so WebRTC cannot be
        // blamed for a source that was never alive.
        {
            const probe = document.createElement('video');
            probe.srcObject = new MediaStream([opened.getVideoTracks()[0]]);
            probe.muted = true; probe.playsInline = true;
            document.body.appendChild(probe);
            probe.play().catch(() => {});
            for (let i = 0; i < 40 && !(probe.videoWidth > 0); i++) await sleep(100);
            out.localProbe = {
                width: probe.videoWidth,
                trackState: opened.getVideoTracks()[0].readyState,
                trackMuted: opened.getVideoTracks()[0].muted,
            };
            probe.remove();
        }
        out.audioAttached = p.broadcast.attachAudio();
        const stream = p.broadcast.stream;
        out.tracks = {
            video: stream.getVideoTracks().length,
            audio: stream.getAudioTracks().length,
        };
        const settings = stream.getVideoTracks()[0].getSettings?.() ?? {};
        out.capturedAtCanvasSize = settings.width === p.canvas.width
            && settings.height === p.canvas.height;

        const host = new RTCPeerConnection();
        const viewer = new RTCPeerConnection();
        host.onicecandidate = e => e.candidate && viewer.addIceCandidate(e.candidate);
        viewer.onicecandidate = e => e.candidate && host.addIceCandidate(e.candidate);
        const arrival = new Promise(res => { viewer.ontrack = e => res(e.streams[0]); });
        for (const t of stream.getTracks()) host.addTrack(t, stream);
        await host.setLocalDescription(await host.createOffer());
        await viewer.setRemoteDescription(host.localDescription);
        await viewer.setLocalDescription(await viewer.createAnswer());
        await host.setRemoteDescription(viewer.localDescription);

        const inbound = await Promise.race([arrival, sleep(10000).then(() => null)]);
        out.viewerGotStream = !!inbound;
        if (inbound) {
            out.viewerTracks = {
                video: inbound.getVideoTracks().length,
                audio: inbound.getAudioTracks().length,
            };
            const el = document.createElement('video');
            el.srcObject = inbound; el.muted = true; el.autoplay = true; el.playsInline = true;
            document.body.appendChild(el);
            // Not awaited. play() on a live MediaStream has no defined point
            // of completion -- there is no duration to reach and no data to
            // finish buffering -- and its promise can stay pending for good.
            // What matters is whether frames arrive, which the poll below
            // checks on a bound.
            el.play().catch(() => {});
            for (let i = 0; i < 80 && !(el.videoWidth > 0); i++) await sleep(100);

            const frame = () => {
                // A zero-sized canvas makes getImageData throw, which would
                // take the whole run with it if no frame has arrived yet.
                if (!el.videoWidth || !el.videoHeight) return { h: 0, lit: 0 };
                const c = document.createElement('canvas');
                c.width = el.videoWidth; c.height = el.videoHeight;
                const x = c.getContext('2d');
                x.drawImage(el, 0, 0);
                const d = x.getImageData(0, 0, c.width, c.height).data;
                let h = 0, lit = 0;
                for (let i = 0; i < d.length; i += 97) { h = (h * 31 + d[i]) >>> 0; if (d[i] !== 0) lit++; }
                return { h, lit };
            };
            // framesDecoded from the receiver, not pixel hashes. Hashing a
            // synthetic fixture is unreliable -- consecutive frames can differ
            // in bytes this stride steps over, which reads as a frozen picture
            // when it is not. The decoder's own count cannot be fooled that way.
            const decoded = async () => {
                const stats = [...(await viewer.getStats()).values()];
                return stats.find(x => x.type === 'inbound-rtp' && x.kind === 'video')?.framesDecoded ?? 0;
            };
            const first = await decoded();
            const seen = [], clock = [];
            for (let i = 0; i < 6; i++) {
                seen.push(frame());
                clock.push(+p.currentTime.toFixed(2));
                await sleep(400);
            }
            out.viewerLit = seen.reduce((m, f) => Math.max(m, f.lit), 0);
            out.framesDecodedGrewBy = (await decoded()) - first;
            out.clock = clock;
            out.clockAdvanced = Math.max(...clock) > Math.min(...clock);
            el.remove();
        }
        host.close(); viewer.close();
        p.broadcast.close();
        out.closedCleanly = !p.broadcast.isOpen;
        p.loopMode = previousLoopMode;
        p.pause();
        return out;
    });

    console.log('\nit broadcasts the player to a viewer');
    check(broadcast.videoAtOpen === 1, 'opening the capture yields the canvas as a video track');
    check(broadcast.audioAttached && broadcast.tracks.audio === 1,
        'audio attaches off the gain node once playback has started');
    check(broadcast.capturedAtCanvasSize,
        'the capture is the canvas\'s own size');
    check(broadcast.viewerGotStream && broadcast.viewerTracks?.video === 1
        && broadcast.viewerTracks?.audio === 1,
        'a viewer receives both tracks over a real peer connection');
    check(broadcast.viewerLit > 0, `the viewer's picture is not blank (${broadcast.viewerLit} lit samples)`);
    check(broadcast.localProbe?.width > 0,
        `the capture produces frames (a local sink saw ${broadcast.localProbe?.width}px wide)`);
    // Deliberately not asserted here: sustained frame rate through the peer
    // connection. Measured in this position it comes out at 3 frames in 7
    // seconds, against 15fps and a 320->960 resolution ramp for the same code
    // on a freshly opened page. The encoder is starved by everything this run
    // has already done, so the number says more about the harness than the
    // feature. scripts/broadcast-loopback.mjs measures it properly.
    check(broadcast.framesDecodedGrewBy >= 1,
        `and they reach the viewer (${broadcast.framesDecodedGrewBy} decoded)`);
    check(broadcast.clockAdvanced, `the host kept playing throughout (clock ${JSON.stringify(broadcast.clock)})`);
    check(broadcast.closedCleanly, 'closing releases the capture');

    console.log('\nit composites overlays and screenshots');
    check(overlays.colourOnly === false, 'a colour effect alone does not bake into the frame');
    check(overlays.withSticker === true, 'a sticker switches baking on, so it keeps its own colour');
    check(overlays.cleared === false, 'and removing it switches baking back off');
    check(overlays.shot === true, 'a screenshot of a filtered, stickered frame is produced');

    const camera = await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const p = window.player;
        const out = {};
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        await p.loadWebcamStream(stream);
        await sleep(500);
        out.cameraBakes = p.videoFilters.canvasMode;

        await p.startCanvasRecording({});
        const wall0 = performance.now();
        await sleep(800);
        p.pause();
        await sleep(800);                       // this gap must not reach the file
        await p.play().catch(() => {});
        await sleep(800);
        out.played = p.stream.recorder.clock.videoSeconds;
        out.wall = (performance.now() - wall0) / 1000;

        const blob = await p.stopCanvasRecording();
        out.bytes = blob ? blob.size : 0;
        p.stopWebcamStreamMode();
        stream.getTracks().forEach(t => t.stop());
        return out;
    });

    console.log('\nit records the camera, and a pause stays out of the file');
    check(camera.cameraBakes === true, 'the camera bakes effects so the recorder can see them');
    check(camera.bytes > 1000, `a recording comes back with content (${camera.bytes} bytes)`);
    check(camera.wall > 2.2, `wall time across the run was ${camera.wall.toFixed(2)}s`);
    check(camera.played < camera.wall - 0.5,
        `recorded time follows played time, not wall time (${camera.played.toFixed(2)}s)`);

    const hls = await page.evaluate(async (url) => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const p = window.player, o = {};
        await p.load(`${location.origin}${url}`);
        for (let i = 0; i < 100 && !(p.duration > 0); i++) await sleep(100);
        o.duration = p.duration;
        o.videoTrack = !!p.videoTrack;
        o.audioTrack = !!p.audioTrack;
        await p.play().catch(() => {});
        await sleep(1200);
        const c = p.canvas;
        const probe = document.createElement('canvas');
        probe.width = c.width; probe.height = c.height;
        probe.getContext('2d').drawImage(c, 0, 0);
        const d = probe.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let ink = 0;
        for (let i = 0; i < d.length; i += 997) if (d[i] > 8) ink++;
        o.framesDrawn = ink > 0;
        p.pause();
        return o;
    }, HLS_URL);

    console.log('\nit plays an HLS playlist');
    // Every one of these was wrong before the DTS codec read was fixed: setup
    // aborted, so the duration stayed 0 and the audio track never existed,
    // while frames still reached the canvas and made it look half-working.
    check(Math.abs(hls.duration - 3) < 0.3, `duration is 3s (${hls.duration})`);
    check(hls.videoTrack, 'the video track is there');
    check(hls.audioTrack, 'and so is the audio track');
    check(hls.framesDrawn, 'frames reach the canvas');

    // A live stream is a different code path from the VOD one above, not a
    // variation on it: a separate loop in PlayerStream with its own iterators,
    // its own anchor and its own audio pump. The HLS fixture above does not
    // reach it -- it carries #EXT-X-ENDLIST, so isLive is false and playback
    // goes through the ordinary render loop.
    //
    // play() is deliberately not awaited. For a live stream the loop runs
    // inside play()'s own promise chain and does not resolve while the stream
    // is playing, so awaiting it hangs until the test times out.
    live.reset();
    const liveResult = await page.evaluate(async (url) => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const p = window.player;
        await p.load(url);
        for (let i = 0; i < 80 && !p.isLive; i++) await sleep(100);

        const c = p.canvas;
        const hash = () => {
            const q = document.createElement('canvas');
            q.width = c.width; q.height = c.height;
            const x = q.getContext('2d');
            x.drawImage(c, 0, 0);
            const d = x.getImageData(0, 0, c.width, c.height).data;
            let h = 0, lit = 0;
            for (let i = 0; i < d.length; i += 97) { h = (h * 31 + d[i]) >>> 0; if (d[i] !== 0) lit++; }
            return { h, lit };
        };

        const isLive = p.isLive;
        p.play().catch(() => {});

        const frames = [];
        let loopRan = false;
        for (let i = 0; i < 16; i++) {
            await sleep(400);
            loopRan = loopRan || !!p.stream?._isLiveLoopActive;
            frames.push(hash());
        }
        p.pause();
        return {
            isLive, loopRan,
            distinctFrames: new Set(frames.map(f => f.h)).size,
            litPixels: frames[frames.length - 1].lit,
        };
    }, `${origin}${LIVE_URL}`);

    console.log('\nit plays a live stream');
    check(liveResult.isLive, `a playlist with no #EXT-X-ENDLIST is live (isLive=${liveResult.isLive})`);
    check(liveResult.loopRan, 'the live loop runs, rather than the VOD render loop');
    check(liveResult.distinctFrames > 1,
        `live frames keep reaching the canvas (${liveResult.distinctFrames} distinct)`);
    check(liveResult.litPixels > 0, `the picture is not blank (${liveResult.litPixels} lit samples)`);
    check(live.playlistRequests > 1,
        `the playlist is re-read as the window moves (${live.playlistRequests} requests)`);
    check(new Set(live.segmentRequests).size >= 3,
        `segments are fetched as they appear (${new Set(live.segmentRequests).size} distinct)`);

    console.log('\nnothing failed quietly');
    check(errors.length === 0, `no page errors or bad responses${errors.length ? `: ${errors.slice(0, 3).join('; ')}` : ''}`);
}

// --- harness ----------------------------------------------------------------

if (!existsSync(join(DIST, 'player.html'))) {
    console.error('No build found. Run `npm run build` first.');
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
// launch() already gives each run its own throwaway profile, so nothing is
// shared between runs. What does interfere is a browser left alive by a run
// that was killed before its cleanup: several headed instances on one display
// slow the boot enough to trip the wait below, which looks like the app
// failing and is not.
const browser = await chromium.launch({
    executablePath: browserPath,
    args: ['--no-sandbox', '--no-proxy-server',
        '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
try {
    const context = await browser.newContext({ permissions: ['camera'], viewport: { width: 1280, height: 800 } });
    await run(await context.newPage(), origin);
} catch (error) {
    fail++;
    console.log(`  FAIL  the run itself threw: ${error.message}`);
} finally {
    await browser.close();
    server.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
