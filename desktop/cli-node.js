/**
 * Node-mode entry for the flags that only need to read and print.
 *
 * --version and --help read nothing but the build's own version; neither needs Chromium, a window, or a display. Running them under
 * ELECTRON_RUN_AS_NODE skips all of it, which is faster and avoids a failure
 * mode that only appears in the AppImage: the runtime unmounts its squashfs the
 * moment the process exits, and a Chromium child still initializing at that
 * point cannot read icudtl.dat, printing "Invalid file descriptor to ICU data
 * received" after our output.
 *
 * Launched by main.js, which passes down the one thing only Electron knows —
 * what version this build is — so the answer cannot drift from what the app
 * itself would say.
 */
const { handleCliArgs } = require('./cli');

handleCliArgs(process.argv)
    .then(() => process.exit(process.exitCode || 0))
    .catch((error) => {
        console.error(error.message);
        process.exit(1);
    });
