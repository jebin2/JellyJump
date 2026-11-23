// @ts-check
/**
 * Tell the user when a newer build is live (ARCHITECTURE_PLAN.md P6).
 *
 * The site is a static deploy, and a tab can stay open for days: it goes on
 * running the build it loaded, and only finds out about a deploy when a lazy
 * import 404s (reload-on-stale-chunks.js reloads then). Each build writes
 * `version.json` ({version, build}) next to the pages; when the tab comes
 * back to the front, this reads it and, if the build differs, offers a
 * reload. Never reloads by itself: the user may be in the middle of an edit.
 *
 * At most one check every few minutes, and one offer per new build.
 */
import { config } from '../config/index.js';
import { ElectronHelper } from '../platform/ElectronHelper.js';
import { Logger } from './Logger.js';

/** How often the file may be read, at most. */
export const MIN_INTERVAL_MS = 5 * 60 * 1000;

/**
 * @typedef {{version: string, build: string}} BuildInfo
 * @typedef {{
 *   currentBuild: string,
 *   fetchInfo: () => Promise<BuildInfo|null>,
 *   onNewBuild: (info: BuildInfo) => void,
 *   now?: () => number,
 *   interval?: number,
 *   checkedAt?: number,
 * }} CheckerOptions
 */

/**
 * The check without the page: when to read, and what counts as new.
 * @param {CheckerOptions} options
 * @returns {{check: () => Promise<BuildInfo|null>}}
 */
export function createUpdateChecker({
    currentBuild, fetchInfo, onNewBuild, now = Date.now, interval = MIN_INTERVAL_MS, checkedAt = -Infinity,
}) {
    let lastCheck = checkedAt;
    let checking = false;
    const offered = new Set();

    return {
        /** @returns {Promise<BuildInfo|null>} the new build, if this check offered one */
        async check() {
            if (checking || now() - lastCheck < interval) return null;
            checking = true;
            lastCheck = now();
            try {
                const info = await fetchInfo();
                if (!info || typeof info.build !== 'string' || !info.build) return null;
                if (info.build === currentBuild || offered.has(info.build)) return null;
                offered.add(info.build);
                onNewBuild(info);
                return info;
            } catch (error) {
                // Offline, or the file is not there (dev server): nothing to say.
                Logger.log('[UpdateCheck] Could not read version.json:', error);
                return null;
            } finally {
                checking = false;
            }
        },
    };
}

/**
 * Check whenever the page comes back to the front. Not in the desktop app,
 * whose pages ship inside it, nor in a dev build.
 * @param {{onNewBuild: (info: BuildInfo) => void}} options
 */
export function startUpdateCheck({ onNewBuild }) {
    if (config.buildId === 'dev' || ElectronHelper.isElectron()) return;
    const url = new URL('version.json', document.baseURI).href;
    const checker = createUpdateChecker({
        currentBuild: config.buildId,
        fetchInfo: async () => {
            const response = await fetch(url, { cache: 'no-store' });
            return response.ok ? response.json() : null;
        },
        onNewBuild,
        // Counted as checked at load: the build just loaded is the newest there is.
        checkedAt: Date.now(),
    });
    const onFront = () => { if (document.visibilityState === 'visible') checker.check(); };
    document.addEventListener('visibilitychange', onFront);
    window.addEventListener('focus', onFront);
}
