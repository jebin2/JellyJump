/**
 * How long playing backwards takes to start and to stop, and what the picture
 * does in between -- a measurement, not a test.
 *
 *   npm run build && node scripts/demo/reverse-timing.mjs [clip.mp4 seconds]...
 *
 * Clips come from scripts/demo/out/clips (see harness.mjs).
 */
import { serve, openBrowser } from './harness.mjs';

const runs = process.argv.length > 2
    ? process.argv.slice(2).reduce((a, v, i, all) => (i % 2 ? a : [...a, [v, Number(all[i + 1])]]), [])
    : [['longgop.mp4', 7.5], ['longgop.mp4', 15.5], ['Aurora.mp4', 6.5]];

const { server, origin } = await serve();
const { browser } = await openBrowser();
try {
    for (const [name, at] of runs) {
        // A context each, so no playlist or position carries over.
        const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
        const page = await context.newPage();
        const logs = [];
        page.on('console', (m) => { const s = m.text(); if (/\[Reverse\]|\[Seek\]|\[VideoIterator\]/.test(s)) logs.push(s); });
        await page.route('**/*', (r) => (r.request().url().startsWith(origin) || /^(blob|data):/.test(r.request().url()) ? r.continue() : r.abort()));
        await page.goto(`${origin}/player.html`);
        await page.waitForFunction(() => !!window.player && !!window.playlist, null, { timeout: 60000 });
        const out = await page.evaluate(async ({ name, at }) => {
            const pl = window.playlist;
            while (pl.items.length) pl.removeItem(0);
            const blob = await (await fetch(`/__clips__/${encodeURIComponent(name)}`)).blob();
            await pl.handleFiles([new File([blob], name, { type: 'video/mp4' })]);
            await pl.selectItem(0, false);
            const p = pl.player;
            const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
            for (let i = 0; i < 100 && !(p.duration > 0 && !p.isLoading); i++) await sleep(100);
            p.pause();
            await p.seek(at);
            const look = () => {
                const g = document.createElement('canvas'); g.width = 32; g.height = 18;
                const x = g.getContext('2d'); x.drawImage(p.canvas, 0, 0, 32, 18);
                const d = x.getImageData(0, 0, 32, 18).data;
                let h = 0; for (let i = 0; i < d.length; i += 4) h = (h * 31 + d[i] + d[i + 1] * 7 + d[i + 2] * 13) >>> 0;
                return h;
            };
            /** ms from now until the picture changes from what it is, polled each frame. */
            const untilChange = async (limit = 8000) => {
                const t0 = performance.now(), was = look();
                while (performance.now() - t0 < limit) {
                    await new Promise((r) => requestAnimationFrame(r));
                    if (look() !== was) return Math.round(performance.now() - t0);
                }
                return Infinity;
            };
            const res = {};
            await p.play();
            await sleep(1000);
            // 1. Playing forwards, switch to backwards.
            let t0 = performance.now();
            const changeA = untilChange();
            await p.toggleDirection();
            res.toBackwardResolve = Math.round(performance.now() - t0);
            const fromA = p.currentTime;
            await sleep(400);
            res.toBackwardMoving = p.currentTime < fromA - 0.1;
            await changeA;
            await sleep(1600);
            // 2. Backwards, switch to forwards.
            t0 = performance.now();
            await p.toggleDirection();
            res.toForwardResolve = Math.round(performance.now() - t0);
            const fromB = p.currentTime;
            await sleep(400);
            res.toForwardMoving = p.currentTime > fromB + 0.1;
            await sleep(600);
            p.pause();
            await sleep(300);
            // 3. Paused: Play backwards.
            await p.toggleDirection();
            t0 = performance.now();
            const r3 = await p.play();
            res.playBackwardResolve = Math.round(performance.now() - t0);
            res.started3 = r3?.started;
            await sleep(1500);
            // 4. Pause while backwards; how long until it is settled.
            t0 = performance.now();
            p.pause();
            for (let i = 0; i < 200 && (p.reverse.active || p.isLoading || p.frames?.fetching); i++) await sleep(10);
            await sleep(0);
            res.pauseSettled = Math.round(performance.now() - t0);
            const stoppedAt = p.currentTime;
            // 5. Paused again: Play backwards from the same place.
            t0 = performance.now();
            await p.play();
            res.replayBackwardResolve = Math.round(performance.now() - t0);
            await sleep(800);
            p.pause();
            for (let i = 0; i < 200 && (p.reverse.active || p.isLoading); i++) await sleep(10);
            await p.toggleDirection();
            res.stoppedAt = +stoppedAt.toFixed(2);
            return res;
        }, { name, at });
        console.log(`\n${name} from ${at}s`);
        for (const [k, v] of Object.entries(out)) console.log(`  ${k.padEnd(22)} ${v}`);
        for (const l of logs) console.log(`    ${l.replace(/ \{load \d+\}$/, '')}`);
        await context.close();
    }
} finally {
    await browser.close();
    server.close();
}
