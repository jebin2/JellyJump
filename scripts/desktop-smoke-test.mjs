/**
 * The packaged app, actually launched.
 *
 * Everything else here tests the web build; the desktop app is the same code
 * behind a different front door -- loadFile, so file://, with node turned off
 * and a preload bridge. The things that break are the things that differ:
 * a page that never loads, a feature that assumed http(s), a module the
 * bundler kept out of the desktop copy.
 *
 * Run headless so it does not throw a window onto whoever is at the keyboard.
 *
 *   npm run build && cp -r dist desktop/build && node scripts/desktop-smoke-test.mjs
 */
import { _electron as electron } from 'playwright-core';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
let pass = 0, fail = 0;
const check = (ok, label) => { if (ok) { pass++; console.log(`  PASS  ${label}`); } else { fail++; console.log(`  FAIL  ${label}`); } };

if (!existsSync(resolve(ROOT, 'desktop/build/player.html'))) {
    console.error('desktop/build is missing. Run: npm run build && rm -rf desktop/build && cp -r dist desktop/build');
    process.exit(1);
}

// --ozone-platform=headless segfaults the moment a debugger attaches, so the
// window is real; it is closed again as soon as the checks are done.
// ── what the package says about itself ──
// electron-builder copies these straight into the .deb's Maintainer, Vendor
// and Homepage fields and into the installer metadata on every platform, so a
// placeholder here is not a note to self -- it is published. The repository
// this one named for three releases was a 404.
{
    const pkg = JSON.parse(readFileSync(resolve(ROOT, 'desktop/package.json'), 'utf8'));
    const blob = JSON.stringify(pkg);
    check(!/example\.com|example\.org|your-?name|TODO|FIXME/i.test(blob),
        `the package names a real author, not a placeholder (${pkg.author})`);
    const urls = [pkg.homepage, pkg.repository?.url].filter(Boolean);
    check(urls.length === 2 && urls.every(u => u.includes('github.com/jebin2/JellyJump')),
        `and points at the repository that exists (${urls.join(', ')})`);
}

// Started the way a person starts it -- no flags. Every other check here passes
// --no-sandbox itself, which is how the sandbox switches the app sets in code
// went unnoticed: appended after the zygote had started, they left some
// renderers sandboxed and unable to make shared memory, and a plain launch
// printed hundreds of thousands of "Creating shared memory ... failed" lines a
// second and never painted a window. Counted, not just looked at: a handful
// of lines is noise, a flood is a hung app.
if (process.platform === 'linux') {
    const { spawn } = await import('node:child_process');
    const child = spawn(resolve(ROOT, 'desktop/node_modules/electron/dist/electron'), ['.'], {
        cwd: resolve(ROOT, 'desktop'), stdio: ['ignore', 'ignore', 'pipe'],
        env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
    });
    let flood = 0;
    child.stderr.on('data', d => { flood += (String(d).match(/platform_shared_memory_region/g) || []).length; });
    await new Promise(r => setTimeout(r, 8000));
    child.kill();
    await new Promise(r => setTimeout(r, 1500));
    check(flood < 10, `a plain launch is not stuck failing to make shared memory (${flood} errors in 8s)`);
}

const app = await electron.launch({
    args: ['.', '--no-sandbox'],
    cwd: resolve(ROOT, 'desktop'),
    executablePath: resolve(ROOT, 'desktop/node_modules/electron/dist/electron'),
    env: { ...process.env, ELECTRON_DISABLE_SECURITY_WARNINGS: '1' },
});

const page = await app.firstWindow({ timeout: 60000 });
const errs = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
page.on('console', m => { if (m.type() === 'error') errs.push(`console: ${m.text().slice(0, 200)}`); });

await page.waitForLoadState('domcontentloaded');
check(/file:\/\/.*player\.html$/.test(page.url()), `the window opens the player from disk (${page.url().split('/').slice(-1)[0]})`);

await page.waitForFunction(() => !!window.player, null, { timeout: 60000 });
check(true, 'and the player comes up inside it');

// The bridge the renderer reaches the machine through. Without it the desktop
// build is the web build in a frame: no local library, no scanning, no share.
const bridge = await page.evaluate(() => Object.keys(window.desktop || window.electronAPI || {}).length);
check(bridge > 0, `the preload bridge is there (${bridge} entries)`);

// ── Watch Together, which has never been opened from a packaged build ──
// It is the one feature that cannot work the way it does on the web: a link
// "beside this page" resolves to a path on the host's own disk under file://,
// which is not a thing anyone else can open.
const party = await page.evaluate(async () => {
    const p = window.player;
    if (!p?.watchParty) return { missing: true };
    // A canvas to capture: the party refuses without something playing.
    return { supported: typeof RTCPeerConnection === 'function',
             viewerPage: p.watchParty._viewerPageUrl(window.location.href) };
});
check(!party.missing && party.supported, 'a watch party can be started from the desktop app');
check(/^https:\/\//.test(party.viewerPage || ''),
    `and the link it sends points at the web, not at this machine's disk (${party.viewerPage})`);

const real = await page.evaluate(() => fetch('assets/icons/sprite.svg').then(r => r.ok).catch(() => false));
check(real, 'assets load over file:// as well, so the icons are not blank');

check(errs.length === 0, `nothing failed quietly${errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''}`);

console.log(`\n${pass} passed, ${fail} failed\n`);
await app.close();
process.exit(fail ? 1 : 0);
