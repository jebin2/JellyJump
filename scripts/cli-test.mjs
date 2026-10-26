/**
 * Tests the argument classification that decides, before Electron picks a
 * windowing backend, whether this run wants a terminal answer or a window.
 *
 * The failure this guards against was reported over SSH: `jellyjump
 * --share-link` on a display-less machine segfaulted in aura before any of our
 * code ran, because Electron had already chosen the X11 backend. Getting this
 * wrong in the other direction is just as bad — classifying an ordinary launch
 * as terminal would start the real app with no window backend.
 *
 *   node scripts/cli-test.mjs
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isTerminalInvocation, isQueryInvocation, stopHeadless, USAGE } = require('../desktop/cli.js');

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

// argv[0] is the executable, which is why the implementation slices it off.
const argv = (...args) => ['/opt/JellyJump/jellyjump', ...args];

console.log('\nflags that need a terminal, not a display');
for (const flag of ['--no-gui', '--headless', '--share-status', '--version', '--help', '-h', '-v']) {
    check(isTerminalInvocation(argv(flag)) === true, `${flag} is a terminal invocation`);
}
// Removed, but it shipped — it must print an explanation, not open a window.
check(isTerminalInvocation(argv('--share-link')) === true, '--share-link still answers on the terminal');

console.log('\nan unknown option prints an error, which needs no display either');
check(isTerminalInvocation(argv('--share-lnik')) === true, 'a typo does not try to open a window');
check(isTerminalInvocation(argv('--rescan')) === true, 'a flag from a newer build does not try to open a window');

console.log('\nordinary launches still want a window');
check(isTerminalInvocation(argv()) === false, 'no arguments');
check(isTerminalInvocation(argv('/home/me/video.mkv')) === false, 'a file to open');
check(isTerminalInvocation(argv('-remote')) === false, 'a single-dash argument that is not -h');

console.log('\nruntime switches are not ours and must not suppress the window');
for (const flag of ['--no-sandbox', '--disable-gpu', '--ozone-platform=wayland', '--user-data-dir=/tmp/x', '--lang=en-GB']) {
    check(isTerminalInvocation(argv(flag)) === false, `${flag} still opens the app`);
}
check(isTerminalInvocation(argv('--no-sandbox', '--share-link')) === true,
    'a passthrough switch alongside a real flag still answers on the terminal');

console.log('\nthe executable path itself is never read as a flag');
check(isTerminalInvocation(['--headless-looking-name']) === false,
    'argv[0] is skipped even when it looks like a flag');

// Read-only flags run as plain Node, with no Chromium. Misclassifying --no-gui
// as one of them would strand it without utilityProcess, app, or IPC.
console.log('\nread-only flags need no browser process');
for (const flag of ['--version', '-v', '--share-status', '--stop', '--help', '-h', '--bogus']) {
    check(isQueryInvocation(argv(flag)) === true, `${flag} can answer as plain Node`);
}
for (const flag of ['--no-gui', '--headless']) {
    check(isQueryInvocation(argv(flag)) === false, `${flag} still needs Electron`);
}
check(isQueryInvocation(argv('--no-gui', '--share-status')) === false,
    'a run that shares is never treated as read-only, whatever else is passed');
check(isQueryInvocation(argv()) === false, 'an ordinary launch is not a query');

console.log('\nusage text stays in step with what is classified');
for (const flag of ['--no-gui', '--share-status', '--stop', '--version', '--help']) {
    check(USAGE.includes(flag), `${flag} is documented in --help`);
}
check(!USAGE.includes('--share-link'), 'a removed flag is not advertised');

// --stop signals a pid recorded in the config. The pid can be stale or reused,
// and the cost of getting that wrong is a SIGTERM to an unrelated process.
console.log('\n--stop only ever signals a live process of ours');
{
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const { spawn } = require('node:child_process');

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jj-stop-'));
    const configPath = path.join(dir, 'jellyjump.json');
    const write = (data) => fs.writeFileSync(configPath, JSON.stringify(data));
    const read = () => JSON.parse(fs.readFileSync(configPath, 'utf8'));

    let result = await stopHeadless(path.join(dir, 'nothing-here.json'));
    check(result.ok && /Not running/.test(result.message), 'no config at all: says nothing is running');

    write({ shareToken: 'abc' });
    result = await stopHeadless(configPath);
    check(result.ok && /Not running/.test(result.message), 'no recorded pid: says nothing is running');

    // A pid that cannot exist: Linux caps at 2^22, and this is past any default.
    write({ shareToken: 'abc', headlessPid: 4194303 });
    result = await stopHeadless(configPath);
    check(result.ok && /stale/.test(result.message), 'a dead pid is reported as stale, not stopped');
    check(read().headlessPid === null, 'the stale pid is cleared from the config');
    check(read().shareToken === 'abc', 'clearing the pid leaves the rest of the config alone');

    // The dangerous case: the recorded pid was reused by something else. This
    // test process is a live pid that is demonstrably not JellyJump.
    if (fs.existsSync(`/proc/${process.pid}/cmdline`)) {
        write({ shareToken: 'abc', headlessPid: process.pid });
        result = await stopHeadless(configPath);
        check(result.ok && /something else/.test(result.message),
            'a live pid belonging to another program is not signalled');
        check(read().headlessPid === null, 'the reused pid is cleared too');
    } else {
        console.log('  SKIP  reused-pid check needs procfs');
    }

    // End to end against a real process that handles SIGTERM the way the
    // headless one does. Named so the procfs identity check recognises it.
    const scriptPath = path.join(dir, 'jellyjump-fake.js');
    fs.writeFileSync(scriptPath, 'process.on("SIGTERM", () => process.exit(0)); setInterval(() => {}, 1000);');
    const child = spawn(process.execPath, [scriptPath], { stdio: 'ignore' });
    await new Promise((resolve) => setTimeout(resolve, 300));

    write({ shareToken: 'abc', headlessPid: child.pid });
    const exited = new Promise((resolve) => child.on('exit', resolve));
    result = await stopHeadless(configPath);
    check(result.ok && /Stopped/.test(result.message), 'a live instance is stopped');
    await exited;
    check(child.exitCode === 0, 'it was asked to stop rather than killed outright');

    fs.rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
