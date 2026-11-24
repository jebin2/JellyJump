import { defineConfig } from 'vite';
import { resolve, basename, join, relative } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
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

/** A build file named by its content (assets/name-HASH.ext): never changes. */
const HASHED_FILE = /(^|\/)assets\/[^/]+-[A-Za-z0-9_-]{8}\.[a-z0-9]+$/i;
/** Public files the offline player needs; the rest (media, SEO) are not stored. */
const OFFLINE_PUBLIC = /^(manifest\.json|favicon\.ico|icon-\d+\.png|poster\.webp|assets\/(icons|templates)\/.+|assets\/js\/lib\/.+)$/;
/** Pages stored for offline use: the player, and the landing page. */
const OFFLINE_PAGES = { 'player.html': 'player', 'index.html': 'main' };
/** On-demand decoders a file may need before it plays (plan Q4). */
const OFFLINE_DECODERS = /^mediabunny-(dts|truehd)$/;

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]);

/**
 * The service worker's precache list and the build's hashed files, written
 * into dist/sw.js (public/sw.js carries a placeholder; plan Q4). Precached:
 * the pages, the code each loads at start and the chunks it imports
 * directly (the player, the playlist, MediaBunny), the on-demand decoders,
 * and the public files the player reads. Everything else is stored by the
 * worker the first time it is used.
 */
const serviceWorkerManifest = {
    name: 'jellyjump-sw',
    apply: 'build',
    writeBundle(options, bundle) {
        const outDir = options.dir;
        const chunks = Object.values(bundle).filter((item) => item.type === 'chunk');
        const byFile = new Map(chunks.map((chunk) => [chunk.fileName, chunk]));
        const precache = new Set(Object.keys(OFFLINE_PAGES));
        const addStatic = (chunk) => {
            if (!chunk || precache.has(chunk.fileName)) return;
            precache.add(chunk.fileName);
            for (const css of chunk.viteMetadata?.importedCss ?? []) precache.add(css);
            for (const asset of chunk.viteMetadata?.importedAssets ?? []) precache.add(asset);
            for (const file of chunk.imports) addStatic(byFile.get(file));
        };
        for (const name of Object.values(OFFLINE_PAGES)) {
            const entry = chunks.find((chunk) => chunk.isEntry && chunk.name === name);
            if (!entry) throw new Error(`jellyjump-sw: no entry chunk named ${name}`);
            addStatic(entry);
            for (const file of entry.dynamicImports) addStatic(byFile.get(file));
        }
        for (const chunk of chunks) if (OFFLINE_DECODERS.test(chunk.name)) addStatic(chunk);

        const written = walk(outDir).map((file) => relative(outDir, file).split('\\').join('/'));
        for (const file of written) if (OFFLINE_PUBLIC.test(file)) precache.add(file);
        const missing = [...precache].filter((file) => !written.includes(file));
        if (missing.length) throw new Error(`jellyjump-sw: precache names files the build did not write: ${missing.join(', ')}`);

        const manifest = {
            id: buildId,
            precache: [...precache].sort(),
            files: written.filter((file) => HASHED_FILE.test(file) && !file.endsWith('.map')).sort(),
        };
        const swPath = join(outDir, 'sw.js');
        const source = readFileSync(swPath, 'utf8');
        const placeholder = '/*JJ_SW_BUILD*/null';
        if (!source.includes(placeholder)) throw new Error('jellyjump-sw: sw.js has no /*JJ_SW_BUILD*/ placeholder');
        writeFileSync(swPath, source.replace(placeholder, JSON.stringify(manifest)));
    },
};

export default defineConfig({
    root: '.',
    plugins: [contentSecurityPolicy, versionFile, serviceWorkerManifest],

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
