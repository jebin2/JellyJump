/**
 * After a deploy, pages that were loaded (or HTTP-cached) before it still
 * reference the previous build's hashed chunks, so lazy imports 404 with
 * "Failed to fetch dynamically imported module". Vite fires vite:preloadError
 * for exactly this case — reload once to pick up the new build instead of
 * leaving dead menus. Rate-limited so a genuinely broken deploy cannot cause
 * a reload loop.
 */
const LAST_RELOAD_KEY = 'jj-stale-chunk-reload-at';
const MIN_RELOAD_INTERVAL_MS = 30_000;

window.addEventListener('vite:preloadError', (event) => {
    const last = Number(sessionStorage.getItem(LAST_RELOAD_KEY) || 0);
    if (Date.now() - last < MIN_RELOAD_INTERVAL_MS) return; // let the error propagate

    event.preventDefault();
    sessionStorage.setItem(LAST_RELOAD_KEY, String(Date.now()));
    console.warn('[App] Build changed underneath us — reloading to fetch new chunks');
    window.location.reload();
});
