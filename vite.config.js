import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
    root: '.',
    publicDir: 'public',
    base: './',

    resolve: {
        alias: {
            'mediabunny': resolve(__dirname, 'assets/js/lib/mediabunny.js'),
            '/npm/mediabunny@1.42.0-beta.3/+esm': resolve(__dirname, 'assets/js/lib/mediabunny.js'),
            '/npm/mediabunny@1.42.0-beta.4/+esm': resolve(__dirname, 'assets/js/lib/mediabunny.js'),
            '/npm/mediabunny@1.40.1/+esm': resolve(__dirname, 'assets/js/lib/mediabunny.js'),
            '/npm/mediabunny@1.42.0/+esm': resolve(__dirname, 'assets/js/lib/mediabunny.js'),
            '/npm/mediabunny@1.43.1/+esm': resolve(__dirname, 'assets/js/lib/mediabunny.js'),
            '/npm/mediabunny@1.45.3/+esm': resolve(__dirname, 'assets/js/lib/mediabunny.js'),
            '/npm/mediabunny@1.50.4/+esm': resolve(__dirname, 'assets/js/lib/mediabunny.js'),
            '/npm/mediabunny@1.51.0/+esm': resolve(__dirname, 'assets/js/lib/mediabunny.js'),
            '/npm/worker_threads/+esm': resolve(__dirname, 'assets/js/lib/worker-threads-stub.js'),
        }
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
