import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
    root: '.',
    publicDir: 'public',
    base: './',

    resolve: {
        // Array form so the jsDelivr specifier can be matched by pattern. The
        // @mediabunny/* plugin bundles pin their peer import to whatever
        // mediabunny version was current when jsDelivr built them, which lags
        // the plugin's own version — the 1.55.1 plugins import mediabunny@1.55.0.
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
            },
            // @mediabunny/server is a Node.js-only package loaded at runtime via
            // require() in the Electron renderer. Exclude it from the Vite bundle.
            external: ['@mediabunny/server'],
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
