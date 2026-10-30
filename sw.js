// JellyJump Service Worker
//  - PWA installability
//  - Injects Cross-Origin-Opener/Embedder-Policy headers so the page becomes
//    cross-origin isolated even on static hosts that can't set headers
//    (e.g. GitHub Pages). Isolation unlocks multi-threaded WASM
//    (SharedArrayBuffer), which roughly halves CPU subtitle transcription time
//    and speeds up mediabunny. `credentialless` keeps cross-origin CDN/model
//    downloads working without needing CORP headers on them.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Range/`only-if-cached` requests in non-same-origin mode must pass through.
    if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

    const url = new URL(req.url);

    // Only touch real network (http/https) responses. Never intercept blob:/data:
    // etc. — mediabunny reads video data through those and must not be re-wrapped.
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    // Cross-origin requests (HF model, CDN wasm, remote video) are left alone;
    // `credentialless` COEP lets them load without CORP headers.
    if (url.origin !== self.location.origin) return;

    event.respondWith((async () => {
        const res = await fetch(req);
        // Redirects / opaque responses can't be reconstructed — pass through.
        if (res.status === 0 || res.type === 'opaqueredirect' || res.type === 'opaque') {
            return res;
        }
        const headers = new Headers(res.headers);
        headers.set('Cross-Origin-Opener-Policy', 'same-origin');
        headers.set('Cross-Origin-Embedder-Policy', 'credentialless');
        return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    })());
});
