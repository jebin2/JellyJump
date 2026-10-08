/**
 * What actually helps a watch party on a slow link, measured on a slow link.
 *
 * The complaint this answers is "some delay and quality" with the viewer on
 * mobile data, and it has two possible causes that look identical from a
 * chair: the encoder starts low and climbs for the better part of a minute,
 * or the network is the ceiling. Guessing between them is how the three
 * tunings before this one got measured as "no change" -- there was no ceiling
 * to tune against, so there was nothing for a tuning to do.
 *
 * So this runs inside its own network namespace and puts a real one there:
 *
 *   unshare -r -n node scripts/broadcast-tuning.mjs
 *
 * netem on the namespace's loopback is a genuine token bucket -- packets are
 * really delayed and really dropped -- so the encoder's bandwidth estimator
 * sees a real constraint rather than a declared one. RATE/DELAY/LIMIT set it;
 * VARIANTS picks which tunings to compare.
 *
 * The namespace needs a veth pair before any of that works. With only a
 * loopback interface Chromium considers itself offline, gathers no candidates
 * at all and the connection sits in `new` for ever -- which looks exactly like
 * a broken harness. Both ends of the pair live here, so the addresses are
 * local and the packets still travel over lo, where the shaping is.
 *
 * It is a measurement, not a test. Nothing here asserts; it prints a table.
 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SRC = process.env.SRC || '/__fixtures__/.tune-720p30.webm';
const RATE = process.env.RATE || '2000kbit';
const DELAY = process.env.DELAY || '50ms';
const LIMIT = process.env.LIMIT || '100';
const SECONDS = Number(process.env.SECONDS || 60);
const VARIANTS = (process.env.VARIANTS || 'baseline,start,maintain,start+maintain').split(',');
const START = Number(process.env.START || 2000);   // kbps, for the 'start' variants
// REAL=1 drives the shipped pages -- player.html inviting watch.html, codes
// carried by hand -- instead of two connections built here. The variants do
// not apply to it: what it measures is whatever the product currently does.
const REAL = process.env.REAL === '1';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.ttf': 'font/ttf', '.webm': 'video/webm' };
const srv = createServer(async (req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const f = u.startsWith('/__fixtures__/') ? join(ROOT, 'scripts/fixtures', u.slice(14))
        : join(ROOT, 'dist', u === '/' ? '/index.html' : u);
    try {
        const i = await stat(f);
        res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Content-Length': i.size, 'Accept-Ranges': 'bytes' });
        res.end(await readFile(f));
    } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${srv.address().port}`;

const ip = (...args) => { try { execFileSync('ip', args, { stdio: 'pipe' }); return true; } catch { return false; } };
const tc = (...args) => { try { execFileSync('tc', args, { stdio: 'pipe' }); return true; } catch (e) { return false; } };

// A network for Chromium to believe in. Without it there is no gathering.
ip('link', 'set', 'lo', 'up');
if (!ip('link', 'show', 'veth0')) {
    ip('link', 'add', 'veth0', 'type', 'veth', 'peer', 'name', 'veth1');
    ip('addr', 'add', '10.0.0.1/24', 'dev', 'veth0');
    ip('addr', 'add', '10.0.0.2/24', 'dev', 'veth1');
    ip('link', 'set', 'veth0', 'up');
    ip('link', 'set', 'veth1', 'up');
    // The default route is not decoration. Without one Chromium decides it is
    // offline, gathers zero candidates and every connection stays in `new`
    // for ever -- with addresses and interfaces that all look correct.
    ip('route', 'add', 'default', 'via', '10.0.0.2', 'dev', 'veth0');
}
// UDP only, under a prio qdisc. Shaping all of lo throttles Playwright's own
// connection to the browser as well, which ends the run with "target closed"
// rather than a measurement. WebRTC is the UDP here; the control channel is
// TCP and stays out of it.
const shape = () =>
    tc('qdisc', 'add', 'dev', 'lo', 'root', 'handle', '1:', 'prio')
    && tc('qdisc', 'add', 'dev', 'lo', 'parent', '1:3', 'handle', '30:',
        'netem', 'rate', RATE, 'delay', DELAY, 'limit', LIMIT)
    && tc('filter', 'add', 'dev', 'lo', 'parent', '1:', 'protocol', 'ip',
        'prio', '1', 'u32', 'match', 'ip', 'protocol', '17', '0xff', 'flowid', '1:3');
const unshape = () => tc('qdisc', 'del', 'dev', 'lo', 'root');
unshape();
if (!shape()) {
    console.error('Cannot shape lo. Run inside:  unshare -r -n node scripts/broadcast-tuning.mjs');
    process.exit(1);
}
unshape();   // put it back until each run needs it

try { console.log('interfaces:', execFileSync('ip', ['-br', 'addr'], { encoding: 'utf8' }).trim().replace(/\n/g, ' | ')); } catch {}

// Made on demand rather than carried in the repo: it is five megabytes of
// synthetic motion, and the point of it is only that it is genuinely 720p30
// and genuinely hard to compress, which ffmpeg can restate any time.
const fixture = join(ROOT, 'scripts/fixtures/.tune-720p30.webm');
if (SRC.endsWith('.tune-720p30.webm') && !existsSync(fixture)) {
    console.log('making the 720p30 fixture…');
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i',
        'testsrc2=size=1280x720:rate=30:duration=20', '-c:v', 'libvpx', '-b:v', '1800k',
        '-cpu-used', '8', '-deadline', 'realtime', '-an', fixture], { stdio: 'inherit' });
}

const browserPath = ['/usr/bin/chromium', '/usr/bin/google-chrome'].find(existsSync);
let disconnected = false;
const b = await chromium.launch({ executablePath: browserPath, args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required',
    // Both ends of the pair are on this machine, so the pairs ICE settles on
    // are loopback ones; Chromium will not use them without this.
    '--allow-loopback-in-peer-connection'] });

b.on('disconnected', () => { disconnected = true; console.error('BROWSER DISCONNECTED'); });
console.log(`link: ${RATE} ${DELAY} limit ${LIMIT}   source: ${SRC}   ${SECONDS}s per variant   start=${START}k\n`);
const results = {};

if (REAL) {
    const host = await b.newPage();
    await host.goto(`${origin}/player.html`);
    await host.waitForFunction(() => !!window.player, null, { timeout: 60000 });
    await host.evaluate(async url => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const p = window.player;
        await p.load(url);
        for (let i = 0; i < 300 && !(p.duration > 0); i++) await sleep(100);
        p.loopMode = 'one';
        await p.play().catch(() => {});
        await sleep(1500);
    }, SRC);
    const link = await host.evaluate(async () => (await window.player.watchParty.invite()).link);
    const guest = await b.newPage();
    await guest.goto(link, { waitUntil: 'domcontentloaded' });
    await guest.waitForFunction(() => document.getElementById('code')?.value.length > 0,
        null, { timeout: 40000 });
    const code = await guest.evaluate(() => document.getElementById('code').value);
    await host.evaluate(async c => { await window.player.watchParty.accept(c); }, code);
    await host.waitForFunction(() => window.player.watchParty.viewerCount > 0, null, { timeout: 40000 });
    const told = await host.evaluate(() => {
        const peer = [...window.player.watchParty._peers.values()].find(x => x.accepted);
        return /x-google-start-bitrate=(\d+)/.exec(peer?.connection?.remoteDescription?.sdp || '')?.[1] || null;
    });
    console.log(`── the product, on this link   (start bitrate in the accepted reply: ${told || 'none'})`);
    shape();
    const started = Date.now();
    while (Date.now() - started < SECONDS * 1000) {
        const s = await host.evaluate(async () => {
            const peer = [...window.player.watchParty._peers.values()].find(x => x.accepted);
            const stats = [...(await peer.connection.getStats()).values()];
            const o = stats.find(x => x.type === 'outbound-rtp' && x.kind === 'video');
            return { w: o?.frameWidth || 0, h: o?.frameHeight || 0, fps: o?.framesPerSecond ?? null,
                limitedBy: o?.qualityLimitationReason ?? null };
        });
        console.log(`   ${String(Math.round((Date.now() - started) / 1000)).padStart(3)}s  `
            + `${String(s.w + '×' + s.h).padStart(9)}  ${String(s.fps ?? '?').padStart(3)} fps  ${s.limitedBy ?? ''}`);
        await new Promise(r => setTimeout(r, 2500));
    }
    unshape();
    await b.close(); srv.close();
    process.exit(0);
}

for (const variant of VARIANTS) {
    const page = await b.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e).slice(0, 160)));
    page.on('crash', () => errs.push('RENDERER CRASHED'));
    page.on('close', () => errs.push('PAGE CLOSED'));
    await page.goto(`${origin}/player.html`);
    await page.waitForFunction(() => !!window.player, null, { timeout: 60000 });

    // Loaded and playing before the link is squeezed, so the fixture's own
    // download is not part of what is being measured.
    await page.evaluate(async url => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const p = window.player;
        await p.load(url);
        for (let i = 0; i < 300 && !(p.duration > 0); i++) await sleep(100);
        p.loopMode = 'one';
        await p.play().catch(() => {});
        await sleep(1500);
    }, SRC);

    console.log(`   [${variant}] loaded, connecting…`);
    await page.evaluate(([v, start]) => { window.__variant = v; window.__start = start; },
        [variant, START]);
    // Connect first, unshaped: negotiation is not what is being measured.
    try {
    await page.evaluate(async () => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const p = window.player;
        const stream = p.broadcast.open({ fps: 30 });
        p.broadcast.attachAudio();
        const host = new RTCPeerConnection();
        const viewer = new RTCPeerConnection();
        host.onicecandidate = e => e.candidate && viewer.addIceCandidate(e.candidate);
        viewer.onicecandidate = e => e.candidate && host.addIceCandidate(e.candidate);
        const got = new Promise(r => { viewer.ontrack = e => r(e.streams[0]); });
        for (const t of stream.getTracks()) host.addTrack(t, stream);

        const sender = host.getSenders().find(s => s.track?.kind === 'video');
        if (window.__variant.includes('detail')) stream.getVideoTracks()[0].contentHint = 'detail';
        if (window.__variant.includes('motion')) stream.getVideoTracks()[0].contentHint = 'motion';

        await host.setLocalDescription(await host.createOffer());
        await viewer.setRemoteDescription(host.localDescription);
        const answer = await viewer.createAnswer();
        await viewer.setLocalDescription(answer);

        // The encoder is constrained by the description it RECEIVES, so a
        // start bitrate has to be written into the answer, not the offer.
        let sdp = viewer.localDescription.sdp;
        if (window.__variant.includes('start')) {
            sdp = sdp.replace(/^(a=fmtp:(\d+) .*)$/gm, (line, whole, pt) =>
                /x-google-start-bitrate/.test(line) ? line
                    : `${line};x-google-start-bitrate=${window.__start}`);
        }
        await host.setRemoteDescription({ type: 'answer', sdp });

        if (window.__variant.includes('maintain') && sender) {
            const params = sender.getParameters();
            params.degradationPreference = 'maintain-resolution';
            await sender.setParameters(params).catch(e => { window.__setParamsError = String(e); });
        }

        const inbound = await Promise.race([got, sleep(10000).then(() => null)]);
        const el = document.createElement('video');
        el.srcObject = inbound; el.muted = true; el.autoplay = true; el.playsInline = true;
        document.body.appendChild(el);
        // Not awaited. play() on a live stream has no point of completion and
        // its promise can stay pending for good -- awaiting it hung this
        // harness for the length of every run before the markers found it.
        el.play().catch(() => {});
        for (let i = 0; i < 80 && !(el.videoWidth > 0); i++) await sleep(100);
        window.__rig = { host, viewer, el, p };
    });
    } catch (e) {
        console.error(`   [${variant}] connect failed: ${String(e).slice(0, 200)}`);
        console.error(`   page notes: ${errs.join('; ') || 'none'}`);
        throw e;
    }

    console.log(`   [${variant}] connected, shaping…`);
    shape();
    const started = Date.now();
    const samples = [];
    // Sampled from node so the shaping is live while the page is measured.
    while (Date.now() - started < SECONDS * 1000) {
        const s = await page.evaluate(async () => {
            const { host, el, p } = window.__rig;
            const stats = [...(await host.getStats()).values()];
            const o = stats.find(x => x.type === 'outbound-rtp' && x.kind === 'video');
            const pair = stats.find(x => x.type === 'candidate-pair' && (x.selected || x.nominated) && x.state === 'succeeded');
            return {
                w: o?.frameWidth || 0, h: o?.frameHeight || 0,
                fps: o?.framesPerSecond ?? null,
                bytes: o?.bytesSent ?? 0, ts: o?.timestamp ?? 0,
                limitedBy: o?.qualityLimitationReason ?? null,
                rtt: pair?.currentRoundTripTime ?? null,
                vw: el.videoWidth, vh: el.videoHeight,
                canvas: `${p.canvas.width}x${p.canvas.height}`,
                playing: p.isPlaying,
                ice: host.iceConnectionState, conn: host.connectionState,
            };
        });
        samples.push({ at: Math.round((Date.now() - started) / 1000), ...s });
        await new Promise(r => setTimeout(r, 2500));
    }
    unshape();

    // kbps from the deltas; the first reading has nothing to subtract from.
    for (let i = 1; i < samples.length; i++) {
        const dt = (samples[i].ts - samples[i - 1].ts) / 1000;
        samples[i].kbps = dt > 0 ? Math.round((samples[i].bytes - samples[i - 1].bytes) * 8 / dt / 1000) : null;
    }
    const setParamsError = await page.evaluate(() => window.__setParamsError || null);
    results[variant] = { samples, errs, setParamsError };

    console.log(`── ${variant}${setParamsError ? `  (setParameters refused: ${setParamsError})` : ''}`);
    for (const s of samples.slice(1)) {
        console.log(`   ${String(s.at).padStart(3)}s  ${String(s.w + '×' + s.h).padStart(9)}  `
            + `${String(s.fps ?? '?').padStart(3)} fps  ${String(s.kbps ?? '?').padStart(5)} kbps  `
            + `${String(Math.round((s.rtt ?? 0) * 1000)).padStart(4)} ms  ${s.limitedBy ?? ''} ${s.conn !== 'connected' ? '[' + s.conn + ']' : ''}`);
    }
    const settled = samples.slice(Math.ceil(samples.length / 2));
    const avg = k => Math.round(settled.reduce((t, s) => t + (s[k] || 0), 0) / settled.length);
    const pixels = settled.map(s => s.w * s.h);
    console.log(`   settled: ${Math.max(...settled.map(s => s.w))}×${Math.max(...settled.map(s => s.h))} `
        + `avg ${avg('fps')} fps, ${avg('kbps')} kbps, ${Math.round(avg('rtt') * 1000) || '?'} ms`
        + (errs.length ? `  page errors: ${errs.join('; ')}` : '') + '\n');
    await page.close();
}
await b.close(); srv.close();
