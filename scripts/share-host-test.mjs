/**
 * Tests the share host and the watcher it drives -- the parts of sharing that
 * run in the main process around the server rather than inside it.
 *
 * Plain Node: Electron and the tailscale CLI are replaced with stand-ins, since
 * what is under test is this repository's logic, not Electron's or Tailscale's.
 * The watcher is real (chokidar on a temp directory) because "it noticed the
 * file" is the whole point of it.
 *
 *   node scripts/share-host-test.mjs
 */
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, statSync, chmodSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 8000) {
    const end = Date.now() + ms;
    while (Date.now() < end) { if (await fn()) return true; await sleep(100); }
    return false;
}

const tmp = mkdtempSync(path.join(tmpdir(), 'jj-share-'));
const userData = path.join(tmp, 'userData');
mkdirSync(userData);

// ── Stand-ins ────────────────────────────────────────────────────────────────
const listeners = {};
const fakeApp = {
    getPath: () => userData,
    on: (name, fn) => { (listeners[name] ||= []).push(fn); },
    quit: () => { fakeApp.quits++; },
    quits: 0,
};
const electronPath = require.resolve('../desktop/node_modules/electron');
require.cache[electronPath] = { id: electronPath, filename: electronPath, loaded: true,
    exports: { app: fakeApp, ipcMain: { handle() {} } } };

const calls = { startServe: 0, stopServe: 0 };
let releaseStop = null;
const tailscalePath = require.resolve('../desktop/tailscale.js');
require.cache[tailscalePath] = { id: tailscalePath, filename: tailscalePath, loaded: true, exports: {
    status: async () => { await sleep(30); return { available: true, dnsName: 'host.tail.ts.net' }; },
    startServe: async () => { calls.startServe++; await sleep(30); return { ok: true }; },
    stopServe: () => { calls.stopServe++; return new Promise((r) => { releaseStop = r; }); },
    canServeWithoutSudo: async () => true,
    shareUrl: ({ dnsName, token }) => `https://${dnsName}:8443/?token=${token}`,
} };

const index = require('../desktop/library-index.js');
const watcher = require('../desktop/watcher.js');
const share = require('../desktop/share-host.js');
const server = require('../desktop/library-server.js');

let storedToken = null;
share.registerShareIpc({
    assertTrustedIpcEvent() {},
    readShareToken: async () => storedToken,
    writeShareToken: async (t) => { storedToken = t; },
});

const media = path.join(tmp, 'media');
mkdirSync(media);
index.setRoots([media]);

// ── The watcher is only wanted while sharing ─────────────────────────────────
console.log('the watcher');
watcher.rootsChanged();   // what a finished scan does
check(!watcher.isRunning(), 'a scan on its own does not start one');

// ── Two clicks on Share ──────────────────────────────────────────────────────
console.log('\nsharing');
const [one, two] = await Promise.all([share.enable(), share.enable()]);
check(calls.startServe === 1, `two enables at once publish once (${calls.startServe})`);
check(one.enabled && two.enabled && one.url === two.url, 'and agree on the link');
check(watcher.isRunning(), 'enabling starts the watcher');

// ── The token file ───────────────────────────────────────────────────────────
const envPath = path.join(userData, 'jellyjump-share.env');
const mode = statSync(envPath).mode & 0o777;
check(mode === 0o600, `the file holding the link is private to the user (${mode.toString(8)})`);
check(/token=/.test(require('node:fs').readFileSync(envPath, 'utf8')), 'and still holds the link');
chmodSync(envPath, 0o644);        // what an older build left behind
const disabling = share.disable();
await sleep(50); releaseStop(); await disabling;
calls.stopServe = 0;
await share.enable();
check((statSync(envPath).mode & 0o777) === 0o600, 'a file an older build left readable is tightened');

// ── Quitting waits for the mapping to come down ──────────────────────────────
console.log('\nquitting');
const quit = listeners['before-quit'].at(-1);
let prevented = false;
quit({ preventDefault: () => { prevented = true; } });
await sleep(100);
check(prevented, 'quitting is held while the tailnet mapping is still up');
check(calls.stopServe === 1, 'and the mapping is being taken down');
check(fakeApp.quits === 0, 'the app has not exited under it');
releaseStop();
check(await until(() => fakeApp.quits === 1, 3000), 'then it quits, once');
let again = false;
quit({ preventDefault: () => { again = true; } });
check(!again, 'and the resumed quit is not held a second time');
check(!existsSync(envPath), 'the link file is gone');
check(!watcher.isRunning(), 'and the watcher with it');

// ── What the watcher admits ──────────────────────────────────────────────────
console.log('\nwhat the watcher lets in');
const names = () => index.list().map((f) => f.name);
mkdirSync(path.join(media, 'node_modules'), { recursive: true });
mkdirSync(path.join(media, '.hidden'), { recursive: true });
mkdirSync(path.join(media, 'shows'), { recursive: true });
watcher.start();
await sleep(1200); // chokidar's initial walk

writeFileSync(path.join(media, 'node_modules', 'dep.mp4'), 'x'.repeat(2000));
writeFileSync(path.join(media, '.hidden', 'secret.mp4'), 'x'.repeat(2000));
writeFileSync(path.join(media, 'shows', 'compiler_depend.ts'), 'export const a = 1;\n'.repeat(100));
writeFileSync(path.join(media, 'shows', 'ep1.srt'), '1\n00:00:00,000 --> 00:00:01,000\nhi\n');
writeFileSync(path.join(media, 'shows', 'ep1.mp4'), 'x'.repeat(5000));
writeFileSync(path.join(media, 'shows', 'empty.mp4'), '');
const ts = Buffer.alloc(188 * 4); for (let i = 0; i < 4; i++) ts[i * 188] = 0x47;
writeFileSync(path.join(media, 'shows', 'real.ts'), ts);

check(await until(() => names().includes('ep1.mp4')), 'a new video is picked up');
check(await until(() => names().includes('real.ts')), 'and so is a real transport stream');
await sleep(1500); // long enough for anything wrongly admitted to have arrived
check(!names().includes('dep.mp4'), 'but not one inside node_modules, which the scan skips');
check(!names().includes('secret.mp4'), 'nor inside a hidden directory');
check(!names().includes('compiler_depend.ts'), 'nor a TypeScript file with a .ts extension');
check(!names().includes('empty.mp4'), 'nor an empty file');
const ep1 = index.list().find((f) => f.name === 'ep1.mp4');
check(ep1?.subtitles?.length === 1 && ep1.subtitles[0].name === 'ep1.srt',
    'a video arrives with the subtitles beside it');

const before = index.size();
rmSync(path.join(media, 'shows', 'ep1.mp4'));
check(await until(() => !names().includes('ep1.mp4')), 'a deleted video leaves the listing');
check(index.size() === before - 1, 'and the count');

// ── Moving to new roots ──────────────────────────────────────────────────────
console.log('\nafter a rescan');
const media2 = path.join(tmp, 'media2');
mkdirSync(media2);
index.setRoots([media2]);
watcher.rootsChanged();
await sleep(1200);
writeFileSync(path.join(media2, 'new.mp4'), 'x'.repeat(3000));
check(await until(() => names().includes('new.mp4')), 'a watcher that was running follows the scan to its new roots');

watcher.stop();
await sleep(200);
check(!watcher.isRunning(), 'and stops when asked');

await server.stop();
rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
