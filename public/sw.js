// JellyJump Service Worker for PWA installability
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Only handle requests to the same origin
    if (new URL(event.request.url).origin !== self.location.origin) {
        return;
    }

    // Network-only strategy - always fetch fresh content
    // This ensures pull-to-refresh works and avoids stale cache issues
    event.respondWith(fetch(event.request));
});
