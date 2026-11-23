import { defineConfig } from 'vite';
import { resolve, basename } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';
import { cspFor } from './assets/js/shared/config/csp.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// A build id for cache-busting (the commit, or the time when there is no
// git), and the version: VITE_APP_VERSION (the release job sets it from the
// tag), else the newest release tag this commit is built on, else
// package.json. The site is deployed from main, not from a tag, and used to
// report whatever package.json said, which nobody bumped (BUG-11).
// Read by shared/config/index.js.
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8'));
const buildId = process.env.VITE_BUILD_ID || (() => {
    try { return execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim(); }
    catch { return String(Date.now()); }
})();
const versionFromTag = () => {
    try {
        return execSync('git describe --tags --match "v[0-9]*" --abbrev=0', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] })
            .toString().trim().replace(/^v/, '');
    } catch { return ''; }
};
const appVersion = process.env.VITE_APP_VERSION || versionFromTag() || pkg.version;

/**
 * Each page's Content-Security-Policy from shared/config/csp.js, written into
 * its <meta> tag (the pages carry a %JJ_CSP% placeholder), in dev and build.
 */
const contentSecurityPolicy = {
    name: 'jellyjump-csp',
    transformIndexHtml(html, ctx) {
        if (!html.includes('%JJ_CSP%')) return html;
        return html.replace('%JJ_CSP%', cspFor(basename(ctx.filename, '.html')));
    },
};

/**
 * version.json next to the pages, so an open tab can tell a newer build went
 * live (shared/utils/UpdateCheck.js, plan P6).
 */
const versionFile = {
    name: 'jellyjump-version',
    generateBundle() {
        this.emitFile({
            type: 'asset',
            fileName: 'version.json',
            source: JSON.stringify({ version: appVersion, build: buildId }) + '\n',
        });
    },
};

export default defineConfig({
    root: '.',
    plugins: [contentSecurityPolicy, versionFile],

    define: {
        'import.meta.env.VITE_BUILD_ID': JSON.stringify(buildId),
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
    },
    publicDir: 'public',
    base: './',

    resolve: {
        // Array form so the jsDelivr specifier can be matched by pattern. The
        // @mediabunny/* plugin bundles pin their peer import to whatever
        // mediabunny version was current when jsDelivr built them, which lags
        // the plugin's own version — the 1.55.2 plugins import mediabunny@1.55.0.
        // That peer specifier is the one that has to resolve to our copy, and
        // matching it by version meant adding a line for every release and a
        // failed build for whichever one was forgotten.
        alias: [
            { find: /^\/npm\/mediabunny@[^/]+\/\+esm$/, replacement: resolve(__dirname, 'assets/js/lib/mediabunny.js') },
            { find: /^\/npm\/worker_threads\/\+esm$/, replacement: resolve(__dirname, 'assets/js/lib/worker-threads-stub.js') },
            { find: /^mediabunny$/, replacement: resolve(__dirname, 'assets/js/lib/mediabunny.js') },
        ]
    },

    // The media worker uses dynamic import() for the lazy encoder plugins,
    // which requires ES module output (the default iife format cannot code-split).
    worker: {
        format: 'es',
    },

    build: {
        outDir: 'dist',
        emptyOutDir: true,
        target: 'es2020',
        sourcemap: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                player: resolve(__dirname, 'player.html'),
                embed: resolve(__dirname, 'embed.html'),
                watch: resolve(__dirname, 'watch.html'),
            },
        },
    },

    server: {
        port: 8080,
        open: '/player.html',
        // Cross-origin isolation unlocks multi-threaded WASM (SharedArrayBuffer),
        // which speeds up onnxruntime-web (subtitle transcription) and mediabunny.
        // `credentialless` keeps cross-origin CDN/model loads working.
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'credentialless',
        },
    },

    preview: {
        port: 8080,
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin',
            'Cross-Origin-Embedder-Policy': 'credentialless',
        },
    },
});
