/**
 * Encryption round trip, and playing a carrier without leaving the player.
 *
 * Covers the two halves that have no other coverage: PlatformCrypto giving
 * back exactly what it was given (and refusing a wrong password), and the
 * decrypt-on-play path, where pressing play on a carrier asks for the password
 * and then plays the file hidden inside instead of the placeholder.
 *
 * Runs against the vite dev server rather than dist, because it imports
 * PlatformCrypto by path to build a carrier to play -- the same reason
 * scripts/jjc3-sim.sh does. Re-encode survival is that simulator's job; this
 * one is about the app around the format.
 *
 * Usage: node scripts/encrypt-test.mjs
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const PORT = Number(process.env.PORT || 8188);
const PASSWORD = 'open-sesame';
const HINT = 'say friend';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

function findBrowser() {
    return [
        process.env.CHROMIUM_PATH, process.env.CHROME_PATH,
        '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ].filter(Boolean).find(p => existsSync(p));
}

async function waitForServer(origin) {
    for (let i = 0; i < 90; i++) {
        try { if ((await fetch(`${origin}/player.html`)).ok) return true; } catch { /* starting */ }
        await new Promise(r => setTimeout(r, 1000));
    }
    return false;
}

async function run(page, origin) {
    await page.goto(`${origin}/player.html`);
    await page.waitForFunction(() => !!window.player && !!window.playlist, null, { timeout: 60000 });

    // ── Round trip, straight through the module ──────────────────────────
    const trip = await page.evaluate(async ({ origin, password }) => {
        const { PlatformCrypto } = await import(`${origin}/assets/js/shared/utils/PlatformCrypto.js`);
        const { ensureEncoders } = await import(`${origin}/assets/js/core/MediaBunny.js`);
        await ensureEncoders();

        // Seeded, so a failure is reproducible rather than a one-off.
        const payload = new Uint8Array(32 * 1024);
        let s = 0x1234567;
        for (let i = 0; i < payload.length; i++) {
            s ^= (s << 13) >>> 0; s ^= s >>> 17; s ^= (s << 5) >>> 0; payload[i] = s & 0xFF;
        }

        const carrier = await PlatformCrypto.encrypt(new Blob([payload]), password, { filename: 'payload.bin' });
        const { blob } = await PlatformCrypto.decrypt(carrier, password);
        const back = new Uint8Array(await blob.arrayBuffer());
        let identical = back.length === payload.length;
        if (identical) for (let i = 0; i < payload.length; i++) if (back[i] !== payload[i]) { identical = false; break; }

        let refused = null;
        try { await PlatformCrypto.decrypt(carrier, 'not-the-password'); }
        catch (e) { refused = String(e?.message || e); }

        // The carrier's length used to be set by the audio header, which held a
        // small payload's carrier at ~30s however little it carried. It is set
        // by the payload now, so a small file makes a short carrier.
        const carrierSeconds = PlatformCrypto.estimatedDuration(payload.length);

        const detected = await PlatformCrypto.looksLikeCarrier(carrier);
        const plainVideo = await (await fetch(`${origin}/scripts/fixtures/smoke.webm`)).blob();
        const falsePositive = await PlatformCrypto.looksLikeCarrier(plainVideo);

        return { identical, refused, detected, falsePositive, carrierSeconds, carrierBytes: carrier.size };
    }, { origin, password: PASSWORD });

    console.log('\nit gives back exactly what it was given');
    check(trip.identical, 'a 32 KB payload survives encrypt -> decrypt byte for byte');
    check(/integrity|password/i.test(trip.refused || ''),
        `a wrong password is refused by the HMAC, not by guesswork: ${JSON.stringify(trip.refused)}`);

    console.log('\nthe payload sets the carrier length, not the header');
    check(trip.carrierSeconds < 5,
        `32 KB makes a carrier of ${trip.carrierSeconds.toFixed(1)}s, not the ~30s the audio header used to force`);

    console.log('\nit can tell a carrier from an ordinary video');
    check(trip.detected, 'a carrier is recognised');
    check(!trip.falsePositive, 'an ordinary video is not');

    // ── Decrypt on play ──────────────────────────────────────────────────
    const prep = await page.evaluate(async ({ origin, password, hint }) => {
        const { PlatformCrypto } = await import(`${origin}/assets/js/shared/utils/PlatformCrypto.js`);
        const original = await (await fetch(`${origin}/scripts/fixtures/smoke.webm`)).blob();
        const carrier = await PlatformCrypto.encrypt(original, password, {
            filename: 'smoke.webm', mimeType: 'video/webm', hint,
        });
        await window.playlist.handleFiles([new File([carrier], 'secret-carrier.mp4', { type: 'video/mp4' })]);
        return { index: window.playlist.items.findIndex(i => i.title?.includes('secret-carrier')) };
    }, { origin, password: PASSWORD, hint: HINT });

    // Deliberately not awaited: selecting a carrier now waits on the password
    // dialog, so awaiting it here would deadlock against the thing under test.
    await page.evaluate((i) => { window.__playing = window.playlist.selectItem(i, false); }, prep.index);

    const dialogShown = await page.waitForSelector('.unlock-password', { timeout: 60000 })
        .then(() => true).catch(() => false);
    console.log('\nplaying a carrier asks for the password');
    check(dialogShown, 'the unlock dialog opens instead of the placeholder playing');

    const shownHint = await page.waitForFunction(() => {
        const el = document.querySelector('.unlock-hint-display');
        return el && !el.classList.contains('hidden')
            ? document.querySelector('.unlock-hint-value')?.textContent : null;
    }, null, { timeout: 30000 }).then(h => h.jsonValue()).catch(() => null);
    check(shownHint === HINT, `the carrier's own hint is shown (${JSON.stringify(shownHint)})`);

    const dialogCount = await page.evaluate(() => document.querySelectorAll('.unlock-password').length);
    check(dialogCount === 1, `one dialog, not one per attempt to play (${dialogCount})`);

    // Clicked through the DOM: the button's own <svg><use> is the hit target,
    // which an actionable click refuses to go through.
    const press = () => page.evaluate(() => document.querySelector('.unlock-btn')?.click());
    const type = (value) => page.evaluate((v) => {
        const el = document.querySelector('.unlock-password');
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);

    await type('not-the-password');
    await press();
    const refused = await page.waitForFunction(() => {
        const e = document.querySelector('.error-message');
        return e && !e.classList.contains('hidden') ? e.textContent : null;
    }, null, { timeout: 120000 }).then(h => h.jsonValue()).catch(() => null);

    console.log('\na wrong password is survivable');
    check(/integrity|password/i.test(refused || ''), `it says so: ${JSON.stringify(refused)}`);
    check(await page.isVisible('.unlock-password'), 'and the dialog stays open to try again');

    await type(PASSWORD);
    await press();
    const played = await page.waitForFunction(() => {
        const p = window.player;
        return p && p.duration > 0 ? { duration: p.duration, canvas: `${p.canvas.width}x${p.canvas.height}` } : null;
    }, null, { timeout: 180000 }).then(h => h.jsonValue()).catch(() => null);

    console.log('\nthe right password plays the hidden video');
    // The carrier is ~40s of 1280x720 placeholder; the file inside is 2s of
    // 320x180. Checking both says it is the payload playing, not the carrier.
    check(played !== null && Math.abs(played.duration - 2) < 0.2,
        `the 2s original plays, not the carrier (duration ${played?.duration})`);
    check(played?.canvas === '320x180', `at the original's size, not 1280x720 (${played?.canvas})`);
    check(!(await page.isVisible('.unlock-password').catch(() => false)), 'and the dialog closes');

    // Playing it again must not ask again. The playlist rebuilds blob_url from
    // the file on disk between plays -- which is the carrier -- so an item can
    // arrive back at the player pointing at its own placeholder.
    await page.evaluate(() => {
        window.player.duration = 0;
        window.__replay = window.playlist.selectItem(
            window.playlist.items.findIndex(i => i.title?.includes('secret-carrier')), false);
    });
    const replayed = await page.waitForFunction(() => {
        const p = window.player;
        return p && p.duration > 0 ? { duration: p.duration, asked: !!document.querySelector('.unlock-password') } : null;
    }, null, { timeout: 120000 }).then(h => h.jsonValue()).catch(() => null);

    console.log('\nplaying it again does not ask again');
    check(replayed?.asked === false, 'no second password prompt');
    check(replayed !== null && Math.abs(replayed.duration - 2) < 0.2,
        `and it is still the payload playing, not the carrier (duration ${replayed?.duration})`);
}

// --- harness ----------------------------------------------------------------

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

const origin = `http://127.0.0.1:${PORT}`;
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: ROOT, stdio: 'ignore' });
if (!await waitForServer(origin)) {
    console.error(`vite did not come up on :${PORT}`);
    vite.kill();
    process.exit(1);
}

const browser = await chromium.launch({
    executablePath: browserPath,
    args: ['--no-sandbox', '--no-proxy-server', '--autoplay-policy=no-user-gesture-required'],
});
try {
    const page = await browser.newPage();
    page.on('pageerror', e => { fail++; console.log(`  FAIL  page error: ${String(e.message).slice(0, 160)}`); });
    await run(page, origin);
} catch (error) {
    fail++;
    console.log(`  FAIL  the run itself threw: ${error.message}`);
} finally {
    await browser.close();
    vite.kill();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
