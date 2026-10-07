/**
 * Measures the broadcast path end to end: the player's canvas and audio out
 * through two real RTCPeerConnections, with the viewer's resolution, frame rate
 * and bitrate sampled as the encoder ramps.
 *
 * Separate from the smoke suite on purpose. The suite asserts that the capture
 * produces frames and that a peer connection carries both tracks, which is
 * reliable there; sustained frame rate is not -- by the time that section runs,
 * the encoder is starved and reports a fraction of what the same code does on a
 * freshly opened page. This measures it on a quiet page instead.
 *
 * A two-second fixture cannot outlast a negotiation, so point SRC at something
 * longer for a useful reading:
 *
 *   npm run build
 *   SRC=/fx/movie.webm FX=/path/to/dir node scripts/broadcast-loopback.mjs
 */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
const ROOT=resolve(import.meta.dirname,'..');
const MIME={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.ttf':'font/ttf','.ico':'image/x-icon','.webm':'video/webm','.m3u8':'application/vnd.apple.mpegurl','.ts':'video/mp2t'};
const srv=createServer(async(req,res)=>{const u=decodeURIComponent(req.url.split('?')[0]);
  const f=u.startsWith('/fx/')?join((process.env.FX || join(ROOT,'scripts/fixtures')),u.slice(4)):u.startsWith('/__fixtures__/')?join(ROOT,'scripts/fixtures',u.slice(14)):join(ROOT,'dist',u==='/'?'/index.html':u);
  try{const i=await stat(f);res.writeHead(200,{'Content-Type':MIME[extname(f)]||'application/octet-stream','Content-Length':i.size,'Accept-Ranges':'bytes'});res.end(await readFile(f));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));
const origin=`http://127.0.0.1:${srv.address().port}`;
const b=await chromium.launch({executablePath:'/usr/bin/chromium',
  args:['--no-sandbox','--no-proxy-server','--autoplay-policy=no-user-gesture-required']});
const page=await b.newPage();
const errs=[]; page.on('pageerror',e=>errs.push(String(e).slice(0,160)));
await page.goto(`${origin}/player.html`);
await page.waitForFunction(()=>!!window.player,null,{timeout:60000});

const out=await page.evaluate(async (url)=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const p=window.player;
  await p.load(url);
  for(let i=0;i<120&&!(p.duration>0);i++) await sleep(100);

  const r={};
  r.canvasAtLoad = p.canvas.width+'x'+p.canvas.height;
  // ── Phase 0: the outgoing stream ──
  const beforePlay = p.broadcast.open({fps:15});
  r.trackSettingsAtOpen = beforePlay?.getVideoTracks()[0]?.getSettings?.() ?? null;
  r.openedWhilePaused = { video: beforePlay?.getVideoTracks().length ?? -1,
                          audio: beforePlay?.getAudioTracks().length ?? -1,
                          hasAudio: p.broadcast.hasAudio };
  await p.play().catch(()=>{});
  await sleep(600);
  r.audioAttachedAfterPlay = p.broadcast.attachAudio();
  const s = p.broadcast.stream;
  r.tracks = { video: s.getVideoTracks().length, audio: s.getAudioTracks().length,
               videoState: s.getVideoTracks()[0]?.readyState,
               audioState: s.getAudioTracks()[0]?.readyState };
  // the player must still be audible: the gain node keeps its own output edge
  r.stillConnectedToSpeakers = !!p.gainNode && !!p.audioContext;
  r.canvasAfterPlay = p.canvas.width+'x'+p.canvas.height;
  r.trackSettingsAfterPlay = s.getVideoTracks()[0]?.getSettings?.() ?? null;

  // ── Phase 1: loopback over two real RTCPeerConnections ──
  const host = new RTCPeerConnection();
  const viewer = new RTCPeerConnection();
  host.onicecandidate = e => e.candidate && viewer.addIceCandidate(e.candidate);
  viewer.onicecandidate = e => e.candidate && host.addIceCandidate(e.candidate);
  const received = new Promise(res => { viewer.ontrack = e => res(e.streams[0]); });
  for (const t of s.getTracks()) host.addTrack(t, s);
  const offer = await host.createOffer();
  await host.setLocalDescription(offer);
  await viewer.setRemoteDescription(offer);
  const answer = await viewer.createAnswer();
  await viewer.setLocalDescription(answer);
  await host.setRemoteDescription(answer);

  const inbound = await Promise.race([received, sleep(8000).then(()=>null)]);
  r.viewerGotStream = !!inbound;
  if (inbound) {
    r.viewerTracks = { video: inbound.getVideoTracks().length, audio: inbound.getAudioTracks().length };
    const el = document.createElement('video');
    el.srcObject = inbound; el.muted = true; el.autoplay = true; el.playsInline = true;
    document.body.appendChild(el);
    await el.play().catch(()=>{});
    // wait for real frames
    for (let i=0;i<60 && !(el.videoWidth>0);i++) await sleep(100);
    await sleep(1500);
    r.viewerVideo = { w: el.videoWidth, h: el.videoHeight, time: +el.currentTime.toFixed(2) };
    // is the viewer's picture non-blank and changing?
    const grab=()=>{ const c=document.createElement('canvas'); c.width=el.videoWidth; c.height=el.videoHeight;
      const x=c.getContext('2d'); x.drawImage(el,0,0);
      const d=x.getImageData(0,0,c.width,c.height).data;
      let h=0,lit=0; for(let i=0;i<d.length;i+=97){h=(h*31+d[i])>>>0; if(d[i]!==0)lit++;} return {h,lit}; };
    const hostGrab=()=>{ const c=document.createElement('canvas'); c.width=p.canvas.width; c.height=p.canvas.height;
      const x=c.getContext('2d'); x.drawImage(p.canvas,0,0);
      const d=x.getImageData(0,0,c.width,c.height).data;
      let h=0,lit=0; for(let i=0;i<d.length;i+=97){h=(h*31+d[i])>>>0; if(d[i]!==0)lit++;} return {h,lit}; };
    // make sure the source is definitely playing, then sample both together
    await p._seekTo(1).catch(()=>{});
    await p.play().catch(()=>{});
    await sleep(800);
    const samples=[];
    for (let i=0;i<16;i++){
      const st=[...(await host.getStats()).values()];
      const o=st.find(x=>x.type==='outbound-rtp'&&x.kind==='video');
      samples.push({ host: hostGrab(), viewer: grab(), t:+p.currentTime.toFixed(2),
                     vw: el.videoWidth, vh: el.videoHeight,
                     kbps: o? Math.round(o.bytesSent*8/1000) : null,
                     fps: o?.framesPerSecond ?? null });
      await sleep(1000);
    }
    r.playingDuringSample = p.isPlaying;
    r.samples = samples.map(x=>({ t:x.t, res:x.vw+'x'+x.vh, kbitsTotal:x.kbps, fps:x.fps, viewerHash:x.viewer.h }));
    r.hostChanged = new Set(samples.map(x=>x.host.h)).size > 1;
    r.viewerChanged = new Set(samples.map(x=>x.viewer.h)).size > 1;
    r.viewerDistinctFrames = new Set(samples.map(x=>x.viewer.h)).size;
    const st=[...(await host.getStats()).values()].filter(x=>x.type==='outbound-rtp');
    r.outbound = st.map(x=>({kind:x.kind, packets:x.packetsSent, bytes:x.bytesSent}));
    r.iceState = { host: host.iceConnectionState, viewer: viewer.iceConnectionState };
  }
  host.close(); viewer.close(); p.broadcast.close(); p.pause();
  r.closedCleanly = !p.broadcast.isOpen;
  return r;
}, process.env.SRC || '/__fixtures__/smoke.webm');
console.log(JSON.stringify({...out, pageErrors:errs}, null, 2));
await b.close(); srv.close();
