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
const { isTerminalInvocation, USAGE } = require('../desktop/cli.js');

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
check(isTerminalInvocation(argv('--stop')) === true, 'a flag from a newer build does not try to open a window');

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

console.log('\nusage text stays in step with what is classified');
for (const flag of ['--no-gui', '--share-status', '--version', '--help']) {
    check(USAGE.includes(flag), `${flag} is documented in --help`);
}
check(!USAGE.includes('--share-link'), 'a removed flag is not advertised');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
