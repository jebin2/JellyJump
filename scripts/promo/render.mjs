/**
 * The promo video: promo.html drawn frame by frame in Chromium, with
 * music.mjs's track. Writes public/promo.mp4 (1920×1080, 30 fps, H.264 +
 * AAC), which the dashboard and the player's first-visit sample both play.
 *
 *   node scripts/promo/render.mjs [--still 12.3]
 *
 * --still t writes one frame, scripts/promo/out/still.png, for checking a
 * moment without rendering the whole thing.
 */
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openBrowser } from '../demo/harness.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const OUT = join(import.meta.dirname, 'out');
const TARGET = join(ROOT, 'public/promo.mp4');
const FPS = 30;
const SECONDS = 30;
mkdirSync(OUT, { recursive: true });

const stillAt = process.argv.indexOf('--still');
const { browser, context } = await openBrowser();
const page = await context.newPage();
await page.goto(pathToFileURL(join(import.meta.dirname, 'promo.html')).href);
await page.evaluate(() => window.ready);
const cdp = await context.newCDPSession(page);
const frame = async (t) => {
    await page.evaluate((t) => window.seek(t), t);
    const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
    return Buffer.from(data, 'base64');
};

if (stillAt > 0) {
    const t = Number(process.argv[stillAt + 1]);
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(OUT, 'still.png'), await frame(t));
    console.log(`${join(OUT, 'still.png')} at ${t}s`);
    await browser.close();
    process.exit(0);
}

// Music first: the length is fixed, the beat lines up with the scenes.
const music = join(OUT, 'music.wav');
execFileSync(process.execPath, [join(ROOT, 'scripts/demo/music.mjs'), String(SECONDS + 1), music], { stdio: 'inherit' });

// Frames straight into the encoder. A key frame every second, so the player
// seeks, steps and plays it backwards quickly.
const ff = spawn('ffmpeg', ['-v', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-i', music,
    '-filter_complex', `[1:a]atrim=0:${SECONDS},afade=in:st=0:d=0.3,afade=out:st=${SECONDS - 2}:d=2,volume=0.85[m]`,
    '-map', '0:v', '-map', '[m]',
    '-c:v', 'libx264', '-preset', 'slow', '-tune', 'animation', '-crf', '22', '-pix_fmt', 'yuv420p',
    '-g', String(FPS), '-keyint_min', String(FPS), '-profile:v', 'high',
    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-shortest', TARGET,
], { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => ff.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`)))));

const total = SECONDS * FPS;
for (let i = 0; i < total; i++) {
    const png = await frame(i / FPS);
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % 150 === 0) console.log(`  frame ${i} / ${total}`);
}
ff.stdin.end();
await done;
await browser.close();
const mb = statSync(TARGET).size / 1048576;
console.log(`public/promo.mp4: ${SECONDS} s, ${mb.toFixed(1)} MB`);
