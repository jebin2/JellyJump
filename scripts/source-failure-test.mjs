/**
 * A source the player can never read must fail, not hang.
 *
 * UrlSource retries a failed fetch with exponential backoff and, left to its
 * default, retries for ever. Two ordinary things can never succeed however
 * long you wait -- an empty file, whose first range request is answered with
 * 416 because there is no byte zero, and a host that accepts the connection
 * and drops it -- and both used to leave load() unsettled with the spinner up
 * and nothing reported. These checks pin the giving-up: the retry policy is
 * one expression in MediaLifecycle, so removing it fails here immediately.
 *
 * Usage: node scripts/source-failure-test.mjs   (after `npm run build`)
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = join(ROOT, 'dist');
const FIXTURES = join(ROOT, 'scripts/fixtures');
const FIXTURE_PREFIX = '/__fixtures__/';
const FIXTURE_URL = `${FIXTURE_PREFIX}smoke.webm`;
// Answered by destroying the socket, so fetch() rejects rather than returning
// a status. That is the shape the library treats as worth retrying -- an HTTP
// error status it gives up on by itself, and would not prove anything here.
const DROP_URL = '/__drop__/movie.webm';
// An HTTP error status, which the library gives up on by itself -- here to
// catch a retry policy so blunt it stops reporting what the server said.
const GONE_URL = '/__gone__/movie.webm';
// Long enough that a bounded retry (about 15s of backoff) finishes inside it,
// short enough that an unbounded one does not.
const PATIENCE_MS = 30000;

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
    '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.webm': 'video/webm', '.mp4': 'video/mp4',
    '.wasm': 'application/wasm', '.map': 'application/json', '.ico': 'image/x-icon',
};

let dropRequests = 0;

async function serveDist() {
    const server = createServer(async (req, res) => {
        const path = decodeURIComponent(req.url.split('?')[0]);
        if (path === DROP_URL) { dropRequests++; req.socket.destroy(); return; }
        if (path === GONE_URL) { res.writeHead(500).end(); return; }
        try {
            const file = path.startsWith(FIXTURE_PREFIX)
                ? join(FIXTURES, path.slice(FIXTURE_PREFIX.length))
                : join(DIST, path === '/' ? 'index.html' : path);
            if (!file.startsWith(DIST) && !file.startsWith(FIXTURES)) { res.writeHead(403).end(); return; }
            const info = await stat(file);
            if (!info.isFile()) { res.writeHead(404).end(); return; }
            res.writeHead(200, {
                'Content-Type': TYPES[extname(file)] || 'application/octet-stream',
                'Content-Length': info.size,
                'Cross-Origin-Opener-Policy': 'same-origin',
                'Cross-Origin-Embedder-Policy': 'require-corp',
            });
            res.end(await readFile(file));
        } catch { res.writeHead(404).end(); }
    });
    await new Promise(r => server.listen(0, '127.0.0.1', r));
    return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

function findBrowser() {
    const candidates = [
        process.env.CHROMIUM_PATH, process.env.CHROME_PATH,
        '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ].filter(Boolean);
    return candidates.find(p => existsSync(p));
}

/**
 * Load one unreadable source and report what came back, capping the wait so a
 * hang is a result rather than a test that never ends.
 * @param {string} kind one of the sources built in the page below
 */
async function attempt(page, kind, patience = PATIENCE_MS) {
    return page.evaluate(async ({ kind, patience }) => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const p = window.player;
        let reported = null;
        p.onStreamError = (_id, message) => { reported = String(message); };
        p.currentVideoId = 'source-failure-test';

        let url;
        if (kind === 'empty') {
            url = URL.createObjectURL(new File([new Blob([])], 'empty.webm', { type: 'video/webm' }));
        } else if (kind === 'revoked') {
            url = URL.createObjectURL(new File([new Uint8Array([1, 2, 3])], 'x.webm', { type: 'video/webm' }));
            URL.revokeObjectURL(url);
        } else {
            url = `${window.location.origin}${kind}`;
        }

        const started = performance.now();
        let settled = false;
        await Promise.race([
            p.load(url).then(() => { settled = true; }, () => { settled = true; }),
            sleep(patience),
        ]);
        for (let i = 0; i < 40 && settled && !(p.duration > 0); i++) await sleep(50);
        return {
            settled,
            ms: Math.round(performance.now() - started),
            reported,
            duration: p.duration || 0,
            spinner: !!document.querySelector('.jellyjump-loading:not([hidden])'),
        };
    }, { kind, patience });
}

async function run(page, origin) {
    await page.goto(`${origin}/player.html`);
    await page.waitForFunction(() => !!window.player && !!window.playlist, null, { timeout: 60000 });

    const empty = await attempt(page, 'empty');
    console.log('\nan empty file');
    check(empty.settled, `load() comes back (${empty.ms}ms)`);
    check(/empty/i.test(empty.reported ?? ''), `and says what is wrong: ${JSON.stringify(empty.reported)}`);
    check(!empty.spinner, 'the spinner is not left running');

    const revoked = await attempt(page, 'revoked');
    console.log('\na blob URL that has been revoked');
    check(revoked.settled, `load() comes back (${revoked.ms}ms)`);
    // Not "empty": nothing was read, so claiming a size would be a guess.
    check(revoked.reported != null && !/empty/i.test(revoked.reported),
        `and reports the real failure rather than guessing: ${JSON.stringify(revoked.reported)}`);

    const gone = await attempt(page, GONE_URL);
    console.log('\na server answering 500');
    check(gone.settled, `load() comes back (${gone.ms}ms)`);
    check(/500/.test(gone.reported ?? ''), `and passes the status on: ${JSON.stringify(gone.reported)}`);

    dropRequests = 0;
    const dropped = await attempt(page, DROP_URL);
    console.log('\na host that drops the connection');
    check(dropped.settled, `load() gives up instead of retrying for ever (${dropped.ms}ms)`);
    check(dropRequests > 1, `after retrying first, so a blip is still survivable (${dropRequests} requests)`);
    check(dropped.reported != null, `and the failure is reported: ${JSON.stringify(dropped.reported)}`);

    const good = await page.evaluate(async (url) => {
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        const p = window.player;
        const blob = await (await fetch(url)).blob();
        await p.load(URL.createObjectURL(new File([blob], 'smoke.webm', { type: 'video/webm' })));
        for (let i = 0; i < 120 && !(p.duration > 0); i++) await sleep(100);
        return { duration: p.duration, spinner: !!document.querySelector('.jellyjump-loading:not([hidden])') };
    }, FIXTURE_URL);

    console.log('\nand the player still works afterwards');
    check(Math.abs(good.duration - 2) < 0.2, `a good file plays again (duration ${good.duration})`);
    check(!good.spinner, 'with no spinner left over from the failures');
}

// --- harness ----------------------------------------------------------------

if (!existsSync(join(DIST, 'player.html'))) {
    console.error('No build found. Run `npm run build` first.');
    process.exit(1);
}
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

const { server, origin } = await serveDist();
const browser = await chromium.launch({
    executablePath: browserPath,
    args: ['--no-sandbox', '--no-proxy-server'],
});
try {
    await run(await browser.newPage(), origin);
} catch (error) {
    fail++;
    console.log(`  FAIL  the run itself threw: ${error.message}`);
} finally {
    await browser.close();
    server.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
