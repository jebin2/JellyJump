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
 * A browser suite that fails is run once more (ARCHITECTURE_PLAN.md K5).
 * If it passes then, the run passes but the suite is reported as flaky: in
 * the summary, as a warning on the CI run, and in the job summary. A flaky
 * suite is fixed before new work (CONTRIBUTING.md); the retry only stops one
 * timing hiccup from blocking an unrelated PR. Quick suites are not retried:
 * pure logic that fails once is broken. JJ_NO_RETRY=1 turns retries off.
 *
 *   npm test
 *   node scripts/run-tests.mjs            (after npm run build)
 *   node scripts/run-tests.mjs smoke-test edit-panel-test   (only these; no coverage report)
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

const QUICK = [
    'audio-track-label-test', 'playlist-kind-test', 'subtitle-scan-test', 'subtitle-vtt-test',
    'css-token-test', 'signal-codec-test', 'connection-report-test', 'viewer-view-test',
    'live-schedule-test', 'linklist-test', 'linklist-scan-test', 'youtube-url-test', 'html-escape-test',
    'camera-effects-test', 'sticker-test', 'decoration-test', 'recording-clock-test',
    'cli-test', 'library-server-test', 'remote-library-test', 'remote-library-load-test',
    'rs-selftest', 'shard-pipeline-test', 'playback-clock-test', 'errors-test', 'settings-test', 'override-test', 'net-test', 'csp-test', 'read-grants-test', 'template-test', 'desktop-copies-test', 'crypto-vectors-test', 'update-check-test', 'diagnostics-test', 'release-test',
];
const BROWSER = [
    'encrypt-test', 'storage-test', 'ingest-test', 'processing-test', 'source-failure-test', 'youtube-embed-test',
    'smoke-test', 'edit-panel-test', 'watch-panel-test', 'watch-party-test',
];
/** Needs Electron, installed with the desktop app's own dependencies. */
const ELECTRON = ['share-host-test'];

const electronInstalled = existsSync(join(ROOT, 'desktop/node_modules/electron'));

// Coverage (ARCHITECTURE_PLAN.md K3): Node writes its own for the Node suites,
// and the browser suites that load source modules save Chromium's here too
// (scripts/lib/coverage.mjs). Read by coverage-report.mjs at the end.
const COVERAGE_DIR = join(ROOT, '.coverage');
rmSync(COVERAGE_DIR, { recursive: true, force: true });
const results = [];

const only = process.argv.slice(2);
const unknown = only.filter(name => ![...QUICK, ...BROWSER, ...ELECTRON].includes(name));
if (unknown.length) {
    console.error(`Not a suite in run-tests.mjs: ${unknown.join(', ')}`);
    process.exit(2);
}

for (const name of [...QUICK, ...BROWSER, ...ELECTRON].filter(n => !only.length || only.includes(n))) {
    if (ELECTRON.includes(name) && !electronInstalled) {
        results.push({ name, status: 'skipped', note: 'needs desktop/node_modules (npm install in desktop/)' });
        continue;
    }
    const first = runSuite(name);
    let run = first;
    let status = first.passed ? 'passed' : 'FAILED';
    if (!first.passed && BROWSER.includes(name) && !process.env.JJ_NO_RETRY) {
        console.log(`\n----- ${name} failed; running it once more -----\n${tail(first.output)}\n`);
        run = runSuite(name);
        status = run.passed ? 'flaky' : 'FAILED';
    }
    results.push({ name, status, note: run.summary, seconds: first.seconds + (run === first ? 0 : run.seconds) });
    if (status === 'FAILED') {
        // The failing suite's own output, so CI shows what broke.
        console.log(`\n----- ${name} -----\n${tail(run.output)}\n`);
    }
}

/** @param {string} name */
function runSuite(name) {
    const started = Date.now();
    const run = spawnSync(process.execPath, [join(ROOT, 'scripts', `${name}.mjs`)], {
        cwd: ROOT, encoding: 'utf8', timeout: 10 * 60 * 1000,
        env: { ...process.env, NODE_V8_COVERAGE: COVERAGE_DIR, JJ_COVERAGE_DIR: COVERAGE_DIR },
    });
    const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
    const summary = output.trim().split('\n').reverse()
        .find(line => /\d+\s*(passed|checks)|\d+\/\d+ passed/.test(line))?.trim() ?? '';
    return { passed: run.status === 0, output, summary, seconds: (Date.now() - started) / 1000 };
}

/** @param {string} output */
function tail(output) {
    return output.trim().split('\n').slice(-40).join('\n');
}

console.log('');
for (const r of results) {
    const time = r.seconds === undefined ? '' : `${r.seconds.toFixed(0)}s`.padStart(5);
    console.log(`${r.status.padEnd(8)} ${r.name.padEnd(28)} ${time}  ${r.note}`);
}
const failed = results.filter(r => r.status === 'FAILED');
const flaky = results.filter(r => r.status === 'flaky');
const ran = results.filter(r => r.status !== 'skipped').length;
console.log(`\n${ran - failed.length}/${ran} suites passed${flaky.length ? ` (${flaky.length} only on a second run)` : ''}${results.length > ran ? `, ${results.length - ran} skipped` : ''}`);
reportFlaky(flaky);
if (failed.length) process.exit(1);
if (only.length) process.exit(0); // coverage of a few suites says nothing against the baseline

const coverage = spawnSync(process.execPath, [join(ROOT, 'scripts/coverage-report.mjs'), COVERAGE_DIR], { cwd: ROOT, stdio: 'inherit' });
process.exit(coverage.status ?? 1);

/**
 * Make a flaky suite hard to miss on CI: a warning on the run and a line in
 * the job summary. Locally, the summary line above says it.
 * @param {Array<{name: string}>} flaky
 */
function reportFlaky(flaky) {
    if (!flaky.length) return;
    for (const { name } of flaky) {
        console.log(`::warning title=Flaky test suite::${name} failed, then passed when run again. Fix it before new work (CONTRIBUTING.md).`);
    }
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    if (summaryFile) {
        appendFileSync(summaryFile, `### Flaky suites\n\n${flaky.map(({ name }) => `- \`${name}\` failed, then passed on a second run`).join('\n')}\n`);
    }
}
