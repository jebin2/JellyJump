// Registers the PWA service worker and, on hosts that cannot send COOP/COEP
// headers themselves (e.g. GitHub Pages), reloads once so the SW-injected
// headers take effect and the page becomes cross-origin isolated — which
// unlocks multi-threaded WASM (faster subtitle transcription + video work).
//
// No-op reload when the host already sets the headers (dev/preview server,
// desktop), because crossOriginIsolated is already true on first load.
export function registerServiceWorkerWithCOI() {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('[PWA] Service Worker registered'))
        .catch(err => console.log('[PWA] Service Worker failed', err));

    if (window.crossOriginIsolated) {
        sessionStorage.removeItem('coi-reload');
        return;
    }

    // Wait for the SW to control the page, then reload once so this document is
    // served through it (with the isolation headers). The guard prevents a
    // reload loop if isolation still can't be achieved.
    navigator.serviceWorker.ready.then(() => {
        if (window.crossOriginIsolated || sessionStorage.getItem('coi-reload')) return;
        sessionStorage.setItem('coi-reload', '1');
        window.location.reload();
    });
}
