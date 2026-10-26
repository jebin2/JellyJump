/**
 * Tests the argument classification that decides, before Electron picks a
 * windowing backend, whether this run wants a terminal answer or a window.
 *
 * The failure this guards against was reported over SSH: a flag on a
 * display-less machine segfaulted in aura before any of our code ran, because
 * Electron had already chosen the X11 backend. Getting this wrong in the other
 * direction is just as bad -- classifying an ordinary launch as terminal would
 * start the real app with no window.
 *
 * The CLI is --version and --help. The headless mode and its flags (--no-gui,
 * --share-status, --stop) were removed, so they are unknown options now and
 * must say so rather than quietly open a window.
 *
 *   node scripts/cli-test.mjs
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const cli = require('../desktop/cli.js');
const { isTerminalInvocation, handleCliArgs, USAGE } = cli;

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};

// argv[0] is the executable, which is why the implementation slices it off.
const argv = (...args) => ['/opt/JellyJump/jellyjump', ...args];

console.log('\nflags that need a terminal, not a display');
for (const flag of ['--version', '--help', '-h', '-v']) {
    check(isTerminalInvocation(argv(flag)) === true, `${flag} is a terminal invocation`);
}

console.log('\nan unknown option prints an error, which needs no display either');
for (const flag of ['--no-gui', '--headless', '--share-status', '--stop', '--share-link', '--share-lnik', '--rescan']) {
    check(isTerminalInvocation(argv(flag)) === true, `${flag} does not try to open a window`);
}

console.log('\nordinary launches still want a window');
check(isTerminalInvocation(argv()) === false, 'no arguments');
check(isTerminalInvocation(argv('/home/me/video.mkv')) === false, 'a file to open');
check(isTerminalInvocation(argv('-remote')) === false, 'a single-dash argument that is not -h');

console.log('\nruntime switches are not ours and must not suppress the window');
for (const flag of ['--no-sandbox', '--disable-gpu', '--ozone-platform=wayland', '--user-data-dir=/tmp/x', '--lang=en-GB']) {
    check(isTerminalInvocation(argv(flag)) === false, `${flag} still opens the app`);
}
check(isTerminalInvocation(argv('--no-sandbox', '--bogus')) === true,
    'a passthrough switch alongside a real flag still answers on the terminal');

console.log('\nthe executable path itself is never read as a flag');
check(isTerminalInvocation(['--headless-looking-name']) === false,
    'argv[0] is skipped even when it looks like a flag');

console.log('\nwhat each answer says');
{
    const logs = [], errs = [];
    const log = console.log, error = console.error;
    console.log = (...a) => logs.push(a.join(' '));
    console.error = (...a) => errs.push(a.join(' '));
    const savedCode = process.exitCode;
    process.env.JELLYJUMP_VERSION = '9.9.9';
    const help = await handleCliArgs(argv('--help'));
    const version = await handleCliArgs(argv('--version'));
    const unknown = await handleCliArgs(argv('--no-gui'));
    const unknownCode = process.exitCode;
    process.exitCode = savedCode;
    console.log = log; console.error = error;

    check(help === 'exit' && logs.includes(USAGE), '--help prints the usage');
    check(version === 'exit' && logs.includes('9.9.9'), '--version prints the build\'s version');
    check(unknown === 'exit' && unknownCode === 1 && errs.some((e) => e.includes('Unknown option: --no-gui')),
        'a removed flag is an error with a non-zero exit, not a silent launch');
}

console.log('\nusage text stays in step with what exists');
for (const flag of ['--version', '--help']) {
    check(USAGE.includes(flag), `${flag} is documented in --help`);
}
for (const gone of ['--no-gui', '--share-status', '--stop', '--share-link']) {
    check(!USAGE.includes(gone), `${gone}, which is gone, is not advertised`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
