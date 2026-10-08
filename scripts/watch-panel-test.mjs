/**
 * The Watch Together panel, driven the way a host drives it.
 *
 * watch-party-test.mjs covers the protocol: two pages, two codes, a picture at
 * the other end. This covers the panel around it, which is where every bug a
 * host has actually hit has been -- a blank link box, a friend numbered 4 at
 * the start of a party, a row for a reply that is never coming. None of those
 * break a connection, so none of them fail a protocol test; they just make the
 * panel unusable until it is closed and opened again.
 *
 *   npm run build && node scripts/watch-panel-test.mjs
 */
import { chromium } from 'playwright-core';
import { packSignal, unpackSignal } from '../assets/js/core/streaming/SignalCodec.js';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon', '.webm': 'video/webm' };
const srv = createServer(async (req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]);
    const f = u.startsWith('/__fixtures__/')
        ? join(ROOT, 'scripts/fixtures', u.slice(14))
        : join(ROOT, 'dist', u === '/' ? '/index.html' : u);
    try {
        const i = await stat(f);
        res.writeHead(200, { 'Content-Type': MIME[extname(f)] || 'application/octet-stream', 'Content-Length': i.size, 'Accept-Ranges': 'bytes' });
        res.end(await readFile(f));
    } catch { res.writeHead(404); res.end(); }
});
let pass = 0, fail = 0;
const check = (ok, label) => { if (ok) { pass++; console.log(`  PASS  ${label}`); } else { fail++; console.log(`  FAIL  ${label}`); } };
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${srv.address().port}`;

const CANDIDATES = [process.env.CHROMIUM_PATH, process.env.CHROME_PATH,
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const browserPath = CANDIDATES.find(p => existsSync(p));
if (!browserPath) { console.error('No Chromium or Chrome found. Set CHROMIUM_PATH.'); process.exit(1); }
const b = await chromium.launch({ executablePath: browserPath, args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await b.newContext();
const host = await ctx.newPage();
const errs = [];
host.on('pageerror', e => errs.push(String(e).slice(0, 140)));

await host.goto(`${origin}/player.html`);
await host.waitForFunction(() => !!window.player, null, { timeout: 60000 });
// Looped: a short fixture must not run out mid-negotiation.
await host.evaluate(async url => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const p = window.player;
    await p.load(url);
    for (let i = 0; i < 120 && !(p.duration > 0); i++) await sleep(100);
    p.loopMode = 'one';
    await p.play().catch(() => {});
    await sleep(800);
}, process.env.SRC || '/__fixtures__/smoke-av.webm');

const openPanel = async () => {
    await host.click('#mb-tools');
    await host.waitForSelector('[data-action="watch-party"]', { timeout: 15000 });
    await host.click('[data-action="watch-party"]');
    await host.waitForFunction(() => {
        const i = document.querySelector('.wp-link');
        return i && i.value.length > 0;
    }, null, { timeout: 30000 });
};
const closePanel = async () => {
    await host.click('.mb-modal-overlay .mb-modal-close');
    await host.waitForFunction(() => !document.querySelector('.mb-modal-overlay'), null, { timeout: 10000 });
};
const read = () => host.evaluate(() => ({
    whose: document.querySelector('.wp-whose')?.textContent,
    link: document.querySelector('.wp-link')?.value || '',
    copy: !document.querySelector('.wp-copy')?.disabled,
    viewers: document.querySelector('.wp-viewers')?.textContent?.replace(/\s+/g, ' ').trim(),
    ids: window.player.watchParty.invites.map(i => i.id),
}));
/** The humans' job: carry the code from the viewer page back to the panel. */
const connectGuest = async () => {
    const link = await host.evaluate(() => document.querySelector('.wp-link').value);
    const guest = await ctx.newPage();
    await guest.goto(link, { waitUntil: 'domcontentloaded' });
    await guest.waitForFunction(() => {
        const t = document.getElementById('code');
        return t && t.value.length > 0;
    }, null, { timeout: 40000 });
    await host.fill('.wp-answer', await guest.evaluate(() => document.getElementById('code').value));
    await host.click('.wp-accept');
    await host.waitForFunction(() => window.player.watchParty.viewerCount > 0, null, { timeout: 40000 });
    return guest;
};

// ── a panel is ready the moment it opens ──
await openPanel();
const first = await read();
check(first.whose === 'Friend 1' && first.link.length > 100,
    `the panel opens with Friend 1's link ready (${first.whose}, ${first.link.length} chars)`);

// ── and reopening it has not sent anybody a new link, so it must not mint one ──
await closePanel();
await openPanel();
const again = await read();
check(JSON.stringify(again.ids) === '[1]' && again.whose === 'Friend 1',
    `reopening shows the outstanding invitation rather than a new one (ids ${JSON.stringify(again.ids)}, ${again.whose})`);
check(again.link === first.link, 'and it is the same link, so the friend holding it still matches');

const guest = await connectGuest();
await host.waitForTimeout(1200);
const live = await read();
check(live.viewers.includes('watching'), `a connected friend reads as watching (${live.viewers})`);
check(live.whose === 'Friend 2', `and the next link is waiting as Friend 2 (${live.whose})`);

// ── and both ends can say how the connection is carrying itself ──
// A party that will not connect is indistinguishable from a broken feature
// without this, and the two people who can act on it are the two looking at
// these two screens.
const hostRoute = await host.evaluate(() => {
    const rows = [...document.querySelectorAll('.wp-viewer-row')].map(r => r.textContent);
    return rows.find(r => r.includes('Friend 1')) || '';
});
check(/\((direct|relayed)\)/.test(hostRoute),
    `the host's panel says how a friend is connected (${hostRoute.trim()})`);
const guestRoute = await guest.evaluate(() => {
    const line = document.getElementById('route');
    return { hidden: line.hidden, text: line.textContent };
});
check(!guestRoute.hidden && /Connected (direct|relayed)/.test(guestRoute.text),
    `and the friend's page says the same from their side ("${guestRoute.text}")`);
// Pasteable, so neither end has to describe it: types, never addresses.
check(!/\b\d{1,3}(\.\d{1,3}){3}\b/.test(guestRoute.text) && !/[0-9a-f]{1,4}:[0-9a-f]{1,4}:/i.test(guestRoute.text),
    'without putting anybody\'s address in a line meant for a chat');

// ── and how much is actually reaching them ──
// "It looks blurry" has two causes that look identical: an encoder that has
// not finished climbing, and a network that is the ceiling. Only the numbers
// tell them apart, so both screens carry them.
await host.waitForTimeout(2600);   // a rate needs two readings
const flow = await host.evaluate(async () => {
    const rows = [...document.querySelectorAll('.wp-viewer-why')].map(p => p.textContent);
    const invites = await window.player.watchParty.invitesWithRoutes();
    return { rows, detail: invites.find(i => i.route)?.detail || '' };
});
check(/\d+×\d+/.test(flow.detail),
    `the host is told the size a connected friend is getting (${flow.detail})`);
check(flow.rows.some(r => /\d+×\d+/.test(r)),
    'and it is on the panel, not just in the object behind it');
const guestFlow = await guest.evaluate(() => {
    const line = document.getElementById('flow');
    return { hidden: line.hidden, text: line.textContent };
});
check(!guestFlow.hidden && /\d+×\d+/.test(guestFlow.text),
    `and the friend sees the same from their side ("${guestFlow.text}")`);
check(/fps/.test(guestFlow.text), 'with the frame rate, which is what softness shows up in');

// ── and the picture gets the window, the way the player's does ──
// This page is a player once there is something to play, so a 16:9 card in
// the middle of a dark page is wrong: the film should fill what is there and
// letterbox itself, exactly as .jellyjump-container does. It also has to look
// like ours before it has connected to anything -- the link arrives in a chat,
// and a stranger's unbranded page asking you to paste a code back is the
// shape of a scam.
const look = await guest.evaluate(async () => {
    await document.fonts.ready;
    const box = document.getElementById('video').getBoundingClientRect();
    const sprite = await fetch('assets/icons/sprite.svg').then(r => r.text()).catch(() => '');
    return {
        vw: window.innerWidth, vh: window.innerHeight,
        w: Math.round(box.width), h: Math.round(box.height),
        watching: document.body.classList.contains('watching'),
        brand: getComputedStyle(document.querySelector('.brand')).display,
        loader: getComputedStyle(document.getElementById('page-loader')).visibility,
        font: getComputedStyle(document.body).fontFamily,
        themed: getComputedStyle(document.documentElement)
            .getPropertyValue('--accent-primary').trim(),
        grotesk: document.fonts.check('16px "Space Grotesk"'),
        icon: /icon-fullscreen/.test(sprite),
        // The two diagnostic lines ride over the film as one strip; pinned
        // separately they land on top of each other as soon as one wraps.
        readout: (() => {
            const r = document.getElementById('route').getBoundingClientRect();
            const f = document.getElementById('flow').getBoundingClientRect();
            return { clear: r.bottom <= f.top + 1, over: f.bottom <= window.innerHeight + 1 };
        })(),
    };
});
check(look.watching && look.w >= look.vw - 2 && look.h >= look.vh - 2,
    `the film fills the window (${look.w}×${look.h} of ${look.vw}×${look.vh})`);
check(look.brand === 'none', 'and nothing else is competing with it for the space');
check(look.loader === 'hidden', 'the loading screen is gone once the page has run');
// #0f8 is the same green: the build minifies the token's value.
check(/^(#00ff88|#0f8)$/.test(look.themed) && /Space Grotesk/.test(look.font) && look.grotesk,
    `the page wears the app's own theme and font (${look.themed}, ${look.font.split(',')[0]})`);
check(look.icon, 'and its fullscreen control comes from the shared icon sprite');
check(look.readout.clear && look.readout.over,
    'the route and the numbers stack over the film instead of on each other');

// ── and when a friend cannot get through, it says why ──
// A reply routed to the wrong invitation is the one way to make a connection
// that is accepted and then silently never completes -- which is exactly the
// shape of the real failure this line exists for.
const stuck = await host.evaluate(async () => {
    const party = window.player.watchParty;
    const spare = await party.invite();
    return spare.id;
});
{
    const wrongLink = await host.evaluate(() => document.querySelector('.wp-link').value);
    const bystander = await ctx.newPage();
    await bystander.goto(wrongLink, { waitUntil: 'domcontentloaded' });
    await bystander.waitForFunction(() => {
        const t = document.getElementById('code');
        return t && t.value.length > 0;
    }, null, { timeout: 40000 });
    const code = await bystander.evaluate(() => document.getElementById('code').value);
    // Deliberately handed to a different invitation than the one it answers.
    await host.evaluate(async ({ code, id }) => {
        await window.player.watchParty.accept(code, id).catch(() => {});
    }, { code, id: stuck });
    await host.waitForTimeout(2500);
    const why = await host.evaluate(() => {
        const lines = [...document.querySelectorAll('.wp-viewer-why')].map(p => p.textContent);
        return lines.join(' || ');
    });
    check(/Still trying|No route|route is open/.test(why),
        `a friend who cannot get through is explained, not just left spinning ("${why}")`);
    check(!/\b\d{1,3}(\.\d{1,3}){3}\b/.test(why),
        'and that explanation is free of addresses too');
    await bystander.close();
}

// ── a connection that gives up before the host has pasted the code ──
// Nothing can connect until the host pastes it, and they take as long as a
// person takes, so ICE giving up first says nothing about whether this will
// work. The page used to replace the code with "Can't watch this", taking
// away the one thing the viewer still had to do. Every candidate here points
// at an address nothing answers on, which is the real failure, not a stub.
{
    const invite = await host.evaluate(async () =>
        await window.player.watchParty.invite({ baseUrl: location.origin + '/watch.html' }));
    const offer = await unpackSignal(invite.code);
    const dead = offer.sdp
        .replace(/^(a=candidate:\S+ \d+ \S+ \d+ )(\S+)/gm, '$1198.51.100.1')
        .replace(/^c=IN IP4 .*$/gm, 'c=IN IP4 198.51.100.1');
    const deadCode = await packSignal({ type: 'offer', sdp: dead }, { invite: offer.invite });
    const stranded = await ctx.newPage();
    await stranded.goto(`${origin}/watch.html#${deadCode}`, { waitUntil: 'domcontentloaded' });
    await stranded.waitForFunction(() => {
        const t = document.getElementById('code');
        return t && t.value.length > 0;
    }, null, { timeout: 40000 });
    // Wait for it to actually give up rather than assuming how long that takes.
    await stranded.waitForFunction(() => !document.getElementById('waiting').hidden
        || !document.getElementById('problem').hidden, null, { timeout: 60000 }).catch(() => {});
    const stateNow = await stranded.evaluate(() => ({
        onReply: !document.getElementById('reply').hidden,
        codeThere: document.getElementById('code').value.length > 100,
        problem: !document.getElementById('problem').hidden,
        waiting: document.getElementById('waiting').hidden ? '' : document.getElementById('waiting').textContent,
        route: document.getElementById('route').textContent,
    }));
    check(stateNow.onReply && stateNow.codeThere,
        'a connection that gives up early leaves the code where the viewer can still send it');
    check(!stateNow.problem, 'and does not announce a failure that has not happened');
    check(/waiting for the host/i.test(stateNow.waiting),
        `saying what is actually going on instead (${stateNow.waiting.slice(0, 60)}…)`);
    check(/No route could be found/.test(stateNow.route) && !/none yet/.test(stateNow.route),
        `with both ends still named after it gave up (${stateNow.route})`);
    await stranded.close();
}

// ── stopping ends the party without closing the door ──
await host.click('.wp-stop');
// Bounded rather than awaited: a panel that never comes back is the bug, and
// it should read as a failure here, not as the script giving up.
await host.waitForFunction(() => {
    const i = document.querySelector('.wp-link');
    return i && i.value.length > 0;
}, null, { timeout: 15000 }).catch(() => {});
const stopped = await read();
check(stopped.link.length > 100 && stopped.copy,
    `stopping leaves a fresh link, not a blank box (${stopped.link.length} chars, copy ${stopped.copy ? 'enabled' : 'disabled'})`);
check(stopped.link !== live.link, 'and it is a new one, since the old invitations are gone');
check(stopped.whose === 'Friend 1',
    `the names reset there and then, without reopening the panel (${stopped.whose})`);
check(!stopped.viewers.includes('watching') && JSON.stringify(stopped.ids) === '[1]',
    `nobody is left watching and one fresh invitation stands (${JSON.stringify(stopped.ids)})`);
check(await guest.evaluate(() => !document.getElementById('problem').hidden),
    'the friend who was watching is told the host stopped');
await guest.close();

// ── and the capture survived being closed and reopened, which is the risk ──
// Guarded, so a panel with no link to give fails the checks above rather than
// breaking this one too.
if (!stopped.link) {
    check(false, 'no link to invite a second friend with, so the capture is untested');
    console.log(`\n${pass} passed, ${fail} failed\n`);
    await b.close(); srv.close();
    process.exit(1);
}
const second = await connectGuest();
await second.waitForTimeout(3000);
const watching = await second.evaluate(() => {
    const v = document.getElementById('video');
    return { w: v.videoWidth, playing: !v.paused && v.currentTime > 0 };
});
check(watching.w > 0 && watching.playing,
    `a friend invited after stopping still gets a picture (${watching.w}px, playing ${watching.playing})`);

// ── a host who closes the tab has stopped sharing too ──
// Timed, like the Stop button: without a goodbye on the way out the friend
// keeps a frozen frame until ICE gives up, about eight seconds later.
check(errs.length === 0, `no page errors${errs.length ? ': ' + errs.join('; ') : ''}`);
const closedAt = await (async () => {
    const started = Date.now();
    await host.close();
    for (let i = 0; i < 120; i++) {
        const shown = await second.evaluate(() => !document.getElementById('problem').hidden)
            .catch(() => false);
        if (shown) return Date.now() - started;
        await second.waitForTimeout(100);
    }
    return null;
})();
check(closedAt !== null && closedAt < 2000,
    `closing the host tab tells the friend at once (${closedAt}ms; about 8000ms with no goodbye)`);
await second.close();

console.log(`\n${pass} passed, ${fail} failed\n`);
await b.close(); srv.close();
process.exit(fail ? 1 : 0);
