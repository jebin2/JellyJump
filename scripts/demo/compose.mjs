/**
 * Puts the demo together from record.mjs's frames: a title card, the
 * recording, a closing card, crossfaded, with music.mjs's track cut to the
 * length. Writes public/demo.mp4 (1920×1080, H.264 + AAC) and
 * public/demo-poster.webp.
 *
 *   node scripts/demo/compose.mjs
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openBrowser, ROOT, OUT } from './harness.mjs';

const FPS = 30;
const INTRO = 4;
const OUTRO = 6;
const FADE = 0.6;
const ff = (...args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: 'inherit' });

// --- the cards ---------------------------------------------------------------
const font = (file) => `url(file://${ROOT}/assets/fonts/${file})`;
const card = (body) => `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:SG;src:${font('SpaceGrotesk-Bold.ttf')};font-weight:700}
@font-face{font-family:SG;src:${font('SpaceGrotesk-Medium.ttf')};font-weight:500}
@font-face{font-family:SM;src:${font('SpaceMono-Regular.ttf')}}
html,body{margin:0;width:1920px;height:1080px;background:#0a0a0a;overflow:hidden;color:#fff}
.box{position:absolute;left:150px;top:150px;width:1620px;height:780px;box-sizing:border-box;border:6px solid #00ff88;
  box-shadow:18px 18px 0 #00ff88;background:#141414;display:flex;align-items:center;gap:90px;padding:0 110px}
img{width:420px;height:420px;flex:none}
h1{font:700 150px/1 SG;margin:0 0 30px;letter-spacing:-3px}
p{font:500 54px/1.3 SG;color:#e6e6e6;margin:0 0 36px}
.mono{font:400 34px/1.4 SM;color:#00ff88;white-space:nowrap}
.url{font:700 76px/1 SG;color:#00ff88;margin:0 0 34px}
</style></head><body><div class="box"><img src="file://${ROOT}/public/assets/icons/jelly_jump_logo.png"><div>${body}</div></div></body></html>`;

const { browser, context } = await openBrowser();
const page = await context.newPage();
for (const [name, body] of [
    ['intro', '<h1>JellyJump</h1><p>Video player and editor,<br>right in your browser</p><div class="mono">Local files · Your library · Private</div>'],
    ['outro', '<p>Try it free, nothing to install</p><div class="url">jellyjump.voidall.com</div><div class="mono">Desktop app for Linux · macOS · Windows</div>'],
]) {
    writeFileSync(join(OUT, `${name}.html`), card(body));
    await page.goto(`file://${join(OUT, `${name}.html`)}`);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(OUT, `${name}.png`) });
}
await browser.close();

// --- the recording, at a steady frame rate -----------------------------------
const { frames } = JSON.parse(readFileSync(join(OUT, 'frames.json'), 'utf8'));
const list = frames.map((f, i) => {
    const next = frames[i + 1]?.t ?? f.t + 1 / FPS;
    return `file 'frames/${f.file}'\nduration ${Math.max(0.001, next - f.t).toFixed(4)}`;
});
list.push(`file 'frames/${frames.at(-1).file}'`);
writeFileSync(join(OUT, 'frames.txt'), list.join('\n') + '\n');
const recording = frames.at(-1).t - frames[0].t;
ff('-f', 'concat', '-safe', '0', '-i', join(OUT, 'frames.txt'),
    '-vf', `fps=${FPS},format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', join(OUT, 'recording.mp4'));

// --- cards, recording, crossfades, music --------------------------------------
const total = INTRO + recording + OUTRO - 2 * FADE;
execFileSync(process.execPath, [join(import.meta.dirname, 'music.mjs'), String(Math.ceil(total) + 1), join(OUT, 'music.wav')], { stdio: 'inherit' });
ff(
    '-loop', '1', '-t', String(INTRO), '-framerate', String(FPS), '-i', join(OUT, 'intro.png'),
    '-i', join(OUT, 'recording.mp4'),
    '-loop', '1', '-t', String(OUTRO), '-framerate', String(FPS), '-i', join(OUT, 'outro.png'),
    '-i', join(OUT, 'music.wav'),
    '-filter_complex', [
        `[0:v]format=yuv420p,fade=in:st=0:d=0.5,settb=1/${FPS}[a]`,
        `[1:v]format=yuv420p,settb=1/${FPS}[b]`,
        `[2:v]format=yuv420p,settb=1/${FPS}[c]`,
        `[a][b]xfade=transition=fade:duration=${FADE}:offset=${INTRO - FADE}[ab]`,
        `[ab][c]xfade=transition=fade:duration=${FADE}:offset=${(INTRO + recording - 2 * FADE).toFixed(3)},fade=out:st=${(total - 0.8).toFixed(3)}:d=0.8[v]`,
        `[3:a]atrim=0:${total.toFixed(3)},afade=out:st=${(total - 2.5).toFixed(3)}:d=2.5,volume=0.85[m]`,
    ].join(';'),
    '-map', '[v]', '-map', '[m]',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '30', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest',
    join(ROOT, 'public/demo.mp4'),
);
// The poster: the title card, as the page shows before the video plays.
ff('-i', join(OUT, 'intro.png'), '-vf', 'scale=1280:-1', '-quality', '82', join(ROOT, 'public/demo-poster.webp'));
const size = Number(execFileSync('stat', ['-c', '%s', join(ROOT, 'public/demo.mp4')]).toString());
console.log(`public/demo.mp4: ${total.toFixed(1)} s, ${(size / 1048576).toFixed(1)} MB`);
