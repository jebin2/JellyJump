// @ts-check
/**
 * The page's one PieceStore for remote files (ARCHITECTURE_PLAN.md phase U).
 *
 * On disk (OPFS) when it can be used and there is room; in memory when not:
 * a private window, OPFS or workers refused, or under MIN_QUOTA free. The
 * same store either way, so nothing else knows which.
 *
 * On disk, the store first asks the browser to keep the site's storage
 * (`navigator.storage.persist()`: Chromium grants it without asking a site
 * the user uses; Firefox asks). Storage that is not kept can be cleared by the
 * browser when the device runs low on space, and with it the playlist and
 * the files added to it, so the buffer stays small then: the smaller of
 * DISK_BUDGET and DISK_SHARE of the space the browser says is free. Kept, it
 * may use more: PERSISTED_BUDGET and PERSISTED_SHARE. In memory,
 * MEMORY_BUDGET.
 */
import { config } from '../../config/index.js';
import { mediaFetchFn } from '../../net/mediaFetch.js';
import { Logger } from '../../utils/Logger.js';
import { MemoryBackend } from './MemoryBackend.js';
import { OpfsBackend } from './OpfsBackend.js';
import { PieceStore } from './PieceStore.js';

const MB = 1024 * 1024;
export const DISK_BUDGET = 2048 * MB;
export const DISK_SHARE = 0.1;
export const PERSISTED_BUDGET = 8192 * MB;
export const PERSISTED_SHARE = 0.5;
export const MEMORY_BUDGET = 256 * MB;
/** Less free than this and the buffer stays in memory. */
export const MIN_QUOTA = 200 * MB;

/** The buffer's folder, and its lock names: a preview keeps its own. */
export const BUFFER_NAME = config.storageNamespace ? `jj-buffer-${config.storageNamespace}` : 'jj-buffer';

/** @type {Promise<PieceStore>|null} */
let opening = null;

/**
 * The store, opened on first use.
 * @returns {Promise<PieceStore>}
 */
export function getRemoteBuffer() {
    opening ??= openStore();
    return opening;
}

/** Whether the browser keeps this site's storage; asked for once. */
async function keepStorage() {
    try {
        if (await navigator.storage.persisted?.()) return true;
        return !!(await navigator.storage.persist?.());
    } catch {
        return false;
    }
}

/**
 * Bytes the buffer may use on disk, from what the browser says is free and
 * whether it keeps the site's storage; null when it does not say.
 * @param {boolean} persisted
 */
async function diskBudget(persisted) {
    try {
        const { quota, usage } = await navigator.storage.estimate();
        if (!quota) return null;
        const free = quota - (usage ?? 0);
        if (free < MIN_QUOTA) return 0;
        return persisted
            ? Math.min(PERSISTED_BUDGET, Math.floor(free * PERSISTED_SHARE))
            : Math.min(DISK_BUDGET, Math.floor(free * DISK_SHARE));
    } catch {
        return null;
    }
}

async function openStore() {
    const persisted = await keepStorage();
    const budget = await diskBudget(persisted);
    if (budget) {
        try {
            const backend = await OpfsBackend.open(BUFFER_NAME);
            const store = await new PieceStore({ backend, budget, lockPrefix: BUFFER_NAME, fetchFn: mediaFetchFn('buffer') }).load();
            Logger.log(`[Buffer] On disk${persisted ? ' (storage kept)' : ' (storage not kept: small budget)'}, `
                + `budget ${(budget / MB).toFixed(0)} MB, ${(store.usage() / MB).toFixed(0)} MB kept`);
            return store;
        } catch (error) {
            Logger.warn('[Buffer] Disk storage not usable; keeping pieces in memory', error);
        }
    } else {
        Logger.log('[Buffer] Too little storage free; keeping pieces in memory');
    }
    return new PieceStore({ backend: new MemoryBackend(), budget: MEMORY_BUDGET, lockPrefix: BUFFER_NAME, fetchFn: mediaFetchFn('buffer') }).load();
}
