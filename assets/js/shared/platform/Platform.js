// @ts-check
/**
 * Where the app is running: the browser, or the desktop app.
 *
 * The desktop app exposes a bridge to the computer (desktop/preload.js) as
 * `window.electronAPI`. This module is the only one that looks for it;
 * everything else asks here, so "what does the desktop app do differently"
 * has one answer to search for.
 */

/**
 * The desktop app's bridge, or null in a browser.
 * @returns {any}
 */
export function desktopBridge() {
    return /** @type {any} */ (globalThis).window?.electronAPI ?? null;
}

/** Whether this is the desktop app. */
export function isDesktop() {
    return Boolean(desktopBridge()?.isElectron);
}
