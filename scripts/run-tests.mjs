/**
 * Every test script, one after another, with one summary at the end.
 *
 * The suites were only ever run by hand, a few at a time, so nothing stopped
 * a change that broke one of them from merging as long as it built. This runs
 * them all, the way CI does (`npm test`), and fails if any one fails.
 *
 * Quick, pure-logic suites run first so a plain mistake shows in seconds;
 * the ones that drive a real browser against the built app come after.
 * Those need `dist/` (npm test builds it first) and a Chromium or Chrome,
 * found the way the suites themselves look: CHROMIUM_PATH, CHROME_PATH, or a
 * system install.
 *
 *   npm test
 *   node scripts/run-tests.mjs            (after npm run build)
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

const QUICK = [
    'audio-track-label-test', 'playlist-kind-test', 'subtitle-scan-test', 'subtitle-vtt-test',
    'css-token-test', 'signal-codec-test', 'connection-report-test', 'viewer-view-test',
    'live-schedule-test', 'linklist-test', 'linklist-scan-test', 'youtube-url-test', 'html-escape-test',
    'camera-effects-test', 'sticker-test', 'decoration-test', 'recording-clock-test',
    'cli-test', 'library-server-test', 'remote-library-test', 'remote-library-load-test',
    'rs-selftest', 'shard-pipeline-test',
];
const BROWSER = [
    'encrypt-test', 'source-failure-test', 'youtube-embed-test',
    'smoke-test', 'edit-panel-test', 'watch-panel-test', 'watch-party-test',
];
/** Needs Electron, installed with the desktop app's own dependencies. */
const ELECTRON = ['share-host-test'];

const electronInstalled = existsSync(join(ROOT, 'desktop/node_modules/electron'));
const results = [];

for (const name of [...QUICK, ...BROWSER, ...ELECTRON]) {
    if (ELECTRON.includes(name) && !electronInstalled) {
        results.push({ name, status: 'skipped', note: 'needs desktop/node_modules (npm install in desktop/)' });
        continue;
    }
    const started = Date.now();
    const run = spawnSync(process.execPath, [join(ROOT, 'scripts', `${name}.mjs`)], {
        cwd: ROOT, encoding: 'utf8', timeout: 10 * 60 * 1000,
    });
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
    const summary = output.trim().split('\n').reverse()
        .find(line => /\d+\s*(passed|checks)|\d+\/\d+ passed/.test(line))?.trim() ?? '';
    const passed = run.status === 0;
    results.push({ name, status: passed ? 'passed' : 'FAILED', note: summary, seconds: (Date.now() - started) / 1000 });
    if (!passed) {
        // The failing suite's own output, so CI shows what broke.
        console.log(`\n----- ${name} -----\n${output.trim().split('\n').slice(-40).join('\n')}\n`);
    }
}

console.log('');
for (const r of results) {
    const time = r.seconds === undefined ? '' : `${r.seconds.toFixed(0)}s`.padStart(5);
    console.log(`${r.status.padEnd(8)} ${r.name.padEnd(28)} ${time}  ${r.note}`);
}
const failed = results.filter(r => r.status === 'FAILED');
const ran = results.filter(r => r.status !== 'skipped').length;
console.log(`\n${ran - failed.length}/${ran} suites passed${results.length > ran ? `, ${results.length - ran} skipped` : ''}`);
process.exit(failed.length ? 1 : 0);
