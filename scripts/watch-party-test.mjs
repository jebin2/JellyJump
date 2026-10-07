/**
 * A watch party end to end, across two pages and no server.
 *
 * The host opens a film, makes an invitation, and the viewer page answers it;
 * this script plays the part the humans play, carrying the two codes between
 * them. That is the whole of the signalling design -- there is nothing in the
 * middle to test, which is the point.
 *
 * A two-second fixture cannot outlast a negotiation, so playback is looped.
 *
 *   npm run build && node scripts/watch-party-test.mjs
 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
const ROOT=resolve(import.meta.dirname,'..');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.ttf':'font/ttf','.ico':'image/x-icon','.webm':'video/webm'};
const srv=createServer(async(req,res)=>{const u=decodeURIComponent(req.url.split('?')[0]);
  const f=u.startsWith('/fx/')?join(process.env.FX || join(ROOT,'scripts/fixtures'),u.slice(4)):u.startsWith('/__fixtures__/')?join(ROOT,'scripts/fixtures',u.slice(14)):join(ROOT,'dist',u==='/'?'/index.html':u);
  try{const i=await stat(f);res.writeHead(200,{'Content-Type':MIME[extname(f)]||'application/octet-stream','Content-Length':i.size,'Accept-Ranges':'bytes'});res.end(await readFile(f));}catch{res.writeHead(404);res.end();}});
let pass=0, fail=0;
const check=(ok,label)=>{ if(ok){pass++;console.log(`  PASS  ${label}`);} else {fail++;console.log(`  FAIL  ${label}`);} };
await new Promise(r=>srv.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${srv.address().port}`;
const CANDIDATES=[process.env.CHROMIUM_PATH, process.env.CHROME_PATH,
    '/usr/bin/chromium','/usr/bin/chromium-browser','/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const browserPath=CANDIDATES.find(p=>existsSync(p));
if(!browserPath){ console.error('No Chromium or Chrome found. Set CHROMIUM_PATH.'); process.exit(1); }
const b=await chromium.launch({executablePath:browserPath,args:['--no-sandbox','--no-proxy-server','--autoplay-policy=no-user-gesture-required']});

const hostPage=await b.newPage();
const hostErr=[]; hostPage.on('pageerror',e=>hostErr.push(String(e).slice(0,140)));
await hostPage.goto(`${origin}/player.html`);
await hostPage.waitForFunction(()=>!!window.player,null,{timeout:60000});
await hostPage.evaluate(async url=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const p=window.player;
  await p.load(url);
  for(let i=0;i<120&&!(p.duration>0);i++) await sleep(100);
  p.loopMode='one';
  await p.play().catch(()=>{});
  await sleep(600);
}, process.env.SRC || '/__fixtures__/smoke.webm');

// ── the host makes an invitation ──
const invite=await hostPage.evaluate(async base=>{
  const r=await window.player.watchParty.invite({ baseUrl: base });
  return { id:r.id, link:r.link, codeLen:r.code.length };
}, `${origin}/watch.html`);
check(invite.codeLen > 100, `the host produces an invitation (${invite.codeLen} chars)`);
check(invite.link.includes('#'), 'carried in the fragment, which never reaches a server');
check(!invite.link.split('#')[0].includes(invite.code ?? '\u0000'), 'and not in the path or query');

// ── a friend opens it in a different page ──
const viewPage=await b.newPage();
const viewErr=[]; viewPage.on('pageerror',e=>viewErr.push(String(e).slice(0,140)));
await viewPage.goto(invite.link);
await viewPage.waitForFunction(()=>{
  const c=document.getElementById('code'); return c && c.value.length>0;
},null,{timeout:30000});
const reply=await viewPage.evaluate(()=>({
  code: document.getElementById('code').value,
  replyShown: !document.getElementById('reply').hidden,
}));
check(reply.code.length > 100, `the viewer answers it (${reply.code.length} chars)`);
check(reply.replyShown, 'and is told to send that answer back');

// ── the human carries it back ──
const accepted=await hostPage.evaluate(async code=>{
  try { return { id: await window.player.watchParty.accept(code) }; }
  catch (e) { return { error: String(e.message) }; }
}, reply.code);
check(!accepted.error, `the host accepts the answer${accepted.error ? ': ' + accepted.error : ''}`);

// ── does the friend actually see it? ──
await viewPage.waitForFunction(()=>{
  const v=document.getElementById('video'); return v && v.videoWidth>0;
},null,{timeout:30000}).catch(()=>{});
await viewPage.waitForTimeout(4000);
const watching=await viewPage.evaluate(async()=>{
  const v=document.getElementById('video');
  const stage=document.getElementById('stage');
  const grab=()=>{ if(!v.videoWidth) return {h:0,lit:0};
    const c=document.createElement('canvas'); c.width=v.videoWidth; c.height=v.videoHeight;
    const x=c.getContext('2d'); x.drawImage(v,0,0);
    const d=x.getImageData(0,0,c.width,c.height).data;
    let h=0,lit=0; for(let i=0;i<d.length;i+=97){h=(h*31+d[i])>>>0; if(d[i]!==0)lit++;} return {h,lit}; };
  const a=grab(); await new Promise(r=>setTimeout(r,1200)); const c2=grab();
  return { w:v.videoWidth, h:v.videoHeight, stageLive:stage.classList.contains('live'),
           replyHidden: document.getElementById('reply').hidden,
           lit:c2.lit, moved:a.h!==c2.h, audioTracks: v.srcObject?.getAudioTracks().length ?? 0 };
});
const hostSide=await hostPage.evaluate(()=>({ viewers: window.player.watchParty.viewerCount,
                                              invites: window.player.watchParty.invites }));
// The control must not exist before there is a picture. It appeared on the
// "send your code back" step, where there is nothing to make fullscreen, and
// the id selector styling it beat the browser's own [hidden] rule -- so the
// attribute left it in the layout and in the tab order regardless.
const beforePicture = await (async () => {
  const inv = await hostPage.evaluate(async base => {
    const r = await window.player.watchParty.invite({ baseUrl: base });
    return { id: r.id, link: r.link };
  }, `${origin}/watch.html`);
  const g = await b.newPage();
  await g.goto(inv.link);
  await g.waitForFunction(() => {
    const c = document.getElementById('code'); return c && c.value.length > 0;
  }, null, { timeout: 40000 });
  const state = await g.evaluate(() => {
    const f = document.getElementById('full');
    const box = f.getBoundingClientRect();
    f.focus();
    return {
      onCodeStep: !document.getElementById('reply').hidden,
      display: getComputedStyle(f).display,
      takesSpace: box.width > 0 || box.height > 0,
      focusable: document.activeElement === f,
    };
  });
  await g.close();
  return state;
})();

check(beforePicture.onCodeStep && beforePicture.display === 'none',
  `no fullscreen control while the code is being sent (display ${beforePicture.display})`);
check(!beforePicture.takesSpace, 'and it takes up no space');
check(!beforePicture.focusable, 'and a keyboard cannot reach it');

// ── fullscreen, which a viewer gets because it is not playback control ──
await viewPage.click('#full');
await viewPage.waitForTimeout(700);
const fsOn=await viewPage.evaluate(()=>{
  const v=document.getElementById('video');
  return { on: !!document.fullscreenElement, element: document.fullscreenElement?.id ?? null,
           label: document.getElementById('full').getAttribute('aria-label'),
           fills: v.getBoundingClientRect().height > innerHeight*0.8, playing: !v.paused };
});
await viewPage.dblclick('#video');
await viewPage.waitForTimeout(700);
const fsOff=await viewPage.evaluate(()=>({ on: !!document.fullscreenElement,
  label: document.getElementById('full').getAttribute('aria-label'),
  playing: !document.getElementById('video').paused }));

check(watching.w > 0, `the viewer receives a picture (${watching.w}x${watching.h})`);
check(watching.lit > 0, `which is not blank (${watching.lit} lit samples)`);
check(watching.moved, 'and is moving');
check(watching.audioTracks === 1, 'with audio');
check(watching.stageLive && watching.replyHidden, 'the page switches from asking to watching');
check(hostSide.viewers === 1, `the host counts the viewer (${hostSide.viewers})`);
check(hostSide.invites[0]?.state === 'connected', `the connection reports connected (${hostSide.invites[0]?.state})`);
check(fsOn.on && fsOn.element === 'stage', `fullscreen fills the screen (${fsOn.element})`);
check(fsOn.fills, 'and the picture fills it rather than sitting in a 16:9 box');
check(fsOn.label === 'Exit fullscreen', `the button says what it will do now (${fsOn.label})`);
check(!fsOff.on && fsOff.label === 'Fullscreen', 'double-clicking the picture comes back out');
check(fsOn.playing && fsOff.playing, 'and the stream never stops for either');

// ── a friend joining while the host is paused ──
// captureStream only emits when the canvas is modified, so a paused player
// produces nothing and a viewer who joins sees black until playback resumes.
// There is no "current frame" to send -- only a history of modifications.
const paused = await (async () => {
  await hostPage.evaluate(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const p = window.player;
    await p._seekTo(0.8).catch(() => {});
    await sleep(500);
    p.pause();
    await sleep(400);
  });
  const inv = await hostPage.evaluate(async base => {
    const r = await window.player.watchParty.invite({ baseUrl: base });
    return { id: r.id, link: r.link };
  }, `${origin}/watch.html`);
  const g = await b.newPage();
  await g.goto(inv.link);
  await g.waitForFunction(() => {
    const c = document.getElementById('code'); return c && c.value.length > 0;
  }, null, { timeout: 40000 });
  const c = await g.evaluate(() => document.getElementById('code').value);
  await hostPage.evaluate(async code => window.player.watchParty.accept(code), c);
  await g.waitForTimeout(6000);           // the host never presses play
  const seen = await g.evaluate(() => {
    const el = document.getElementById('video');
    if (!el.videoWidth) return { w: 0, lit: 0 };
    const cv = document.createElement('canvas');
    cv.width = el.videoWidth; cv.height = el.videoHeight;
    const x = cv.getContext('2d');
    x.drawImage(el, 0, 0);
    const d = x.getImageData(0, 0, cv.width, cv.height).data;
    let lit = 0;
    for (let i = 0; i < d.length; i += 97) if (d[i] !== 0) lit++;
    return { w: el.videoWidth, lit };
  });
  const stillPaused = !(await hostPage.evaluate(() => window.player.isPlaying));
  await g.close();
  return { seen, stillPaused };
})();

check(paused.stillPaused, 'the host stayed paused throughout');
check(paused.seen.w > 0,
  `a friend joining a paused host still gets the picture (${paused.seen.w}px, ${paused.seen.lit} lit)`);

// ── one link, two people: the mistake this panel invites ──
// Sending a single link to a group is the obvious thing to do and the one
// thing that does not work: a second answer to the same offer is refused, and
// the first answerer's connection is spoiled too, staying at `connecting`
// rather than failing. So the refusal has to say what to do instead.
const reuse = await hostPage.evaluate(async base => {
  const r = await window.player.watchParty.invite({ baseUrl: base });
  return { id: r.id, link: r.link };
}, `${origin}/watch.html`);
const twoTabs = [];
for (let i = 0; i < 2; i++) {
  const t = await b.newPage();
  await t.goto(reuse.link);
  await t.waitForFunction(() => {
    const c = document.getElementById('code'); return c && c.value.length > 0;
  }, null, { timeout: 40000 });
  twoTabs.push(await t.evaluate(() => document.getElementById('code').value));
  await t.close();
}
const firstUse = await hostPage.evaluate(async code => {
  try { return { id: await window.player.watchParty.accept(code) }; }
  catch (e) { return { error: String(e.message) }; }
}, twoTabs[0]);
const secondUse = await hostPage.evaluate(async code => {
  try { return { id: await window.player.watchParty.accept(code) }; }
  catch (e) { return { error: String(e.message) }; }
}, twoTabs[1]);

check(firstUse.id === reuse.id, `the first answer to a link is taken (${firstUse.id ?? firstUse.error})`);
check(!!secondUse.error, 'a second answer to the same link is refused');
check(/own link/.test(secondUse.error ?? ''),
  `and the refusal says what to do instead ("${(secondUse.error ?? '').slice(0, 60)}…")`);
// The invitation that was used twice can never connect, and is dropped after
// CONNECT_TIMEOUT_MS. Verified by measurement rather than here: waiting thirty
// seconds on every run to watch a zombie disappear is not worth the minute.

// ── several friends, with the replies coming back in the wrong order ──
// This is the case that matters once there is more than one guest. Each reply
// carries the id of the invitation it answers; without that the host has to
// guess from arrival order, and guessing wrong does not raise anything --
// setRemoteDescription accepts the mismatched answer and the connection simply
// never completes. Measured: two of three friends on a black screen, no error.
const many = [];
for (let i = 0; i < 3; i++) {
  many.push(await hostPage.evaluate(async base => {
    const r = await window.player.watchParty.invite({ baseUrl: base });
    return { id: r.id, link: r.link };
  }, `${origin}/watch.html`));
}
const guests = [], guestCodes = [];
for (const inv of many) {
  const g = await b.newPage();
  await g.goto(inv.link);
  await g.waitForFunction(() => {
    const c = document.getElementById('code'); return c && c.value.length > 0;
  }, null, { timeout: 40000 });
  guestCodes.push(await g.evaluate(() => document.getElementById('code').value));
  guests.push(g);
}
const routed = [];
for (const idx of [2, 0, 1]) {            // deliberately not 0, 1, 2
  const r = await hostPage.evaluate(async code => {
    try { return { id: await window.player.watchParty.accept(code) }; }
    catch (e) { return { error: String(e.message) }; }
  }, guestCodes[idx]);
  // Compared against the id the invitation was actually issued with, not the
  // guest's position: one invitation was already handed out above, so this
  // batch is numbered from two.
  routed.push({ guest: idx + 1, expected: many[idx].id, got: r.id ?? r.error });
}
await hostPage.waitForTimeout(5000);
const watchingAll = [];
for (const g of guests) {
  watchingAll.push(await g.evaluate(() => {
    const v = document.getElementById('video');
    return { w: v.videoWidth, playing: !v.paused };
  }));
}
// The states of these three invitations, not a global count: guests from
// earlier phases are still attached, and a closed page's connection lingers a
// while, so a total is brittle in a way that says nothing about this case.
const manyState = await hostPage.evaluate(ids => {
  const all = window.player.watchParty.invites;
  return ids.map(id => all.find(i => i.id === id)?.state ?? 'gone');
}, many.map(m => m.id));

check(routed.every(r => r.got === r.expected),
  `each reply reaches its own invitation whatever order they arrive in `
  + `(${routed.map(r => 'guest' + r.guest + '->invite' + r.got).join(', ')})`);
check(watchingAll.every(w => w.w > 0 && w.playing),
  `all three friends get a picture (${watchingAll.map(w => w.w).join(', ')})`);
check(manyState.every(state => state === 'connected'),
  `and the host has all three connected (${manyState.join(', ')})`);
for (const g of guests) await g.close();

// ── and it can be stopped, which is the part a host has to be able to trust ──
const beforeStop=await hostPage.evaluate(()=>({ active:window.player.watchParty.isActive,
  broadcasting:window.player.broadcast.isOpen }));
await hostPage.evaluate(()=>window.player.watchParty.stop());
await hostPage.waitForTimeout(800);
const afterStop=await hostPage.evaluate(()=>({ active:window.player.watchParty.isActive,
  broadcasting:window.player.broadcast.isOpen, invites:window.player.watchParty.invites.length }));
// Timed, not merely awaited. The host sends a goodbye over a control channel
// before tearing the connection down, so this should be immediate; without it
// the viewer waits for ICE to give up, measured at about eight seconds of
// frozen picture. The threshold is what distinguishes the two.
const toldAt = await (async () => {
  const started = Date.now();
  for (let i = 0; i < 120; i++) {
    const shown = await viewPage.evaluate(() => !document.getElementById('problem').hidden);
    if (shown) return Date.now() - started;
    await viewPage.waitForTimeout(100);
  }
  return null;
})();
const told = toldAt !== null;
check(beforeStop.active && beforeStop.broadcasting, 'a party reports itself active while running');
check(!afterStop.active && !afterStop.broadcasting,
  `stopping releases the capture (active=${afterStop.active} broadcasting=${afterStop.broadcasting})`);
check(afterStop.invites === 0, `and forgets its invitations (${afterStop.invites} left)`);
check(told, 'and the viewer is told the host stopped');
check(told && toldAt < 1500,
  `told at once rather than when ICE notices (${toldAt}ms; about 8000ms without the goodbye)`);

// The numbers name this party's links. A host who stops and starts again is
// on their first friend, so the panel must not greet them as Friend 4.
const restartId = await hostPage.evaluate(async () => {
  const r = await window.player.watchParty.invite({ baseUrl: location.origin + '/watch.html' });
  return r.id;
});
check(restartId === 1, `a party started after stopping begins at Friend 1 (got Friend ${restartId})`);
await hostPage.evaluate(()=>window.player.watchParty.stop());
await hostPage.waitForTimeout(400);

check(hostErr.length === 0 && viewErr.length === 0,
    `no page errors${hostErr.length || viewErr.length ? ': ' + [...hostErr, ...viewErr].join('; ') : ''}`);
console.log(`\n${pass} passed, ${fail} failed\n`);
await b.close(); srv.close();
process.exit(fail ? 1 : 0);
