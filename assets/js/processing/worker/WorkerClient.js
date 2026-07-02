/**
 * Client for the media processing worker.
 * Lazily spawns a single shared worker, correlates requests by id, relays
 * progress callbacks, and distinguishes processing errors (rethrown to the
 * caller) from worker crashes (flagged so the caller can fall back to
 * running inline on the main thread).
 */
import { Logger } from '../../shared/utils/Logger.js';

let worker = null;
let nextId = 1;
const pending = new Map();

function handleMessage(event) {
    const { id, type, value, error } = event.data;
    const entry = pending.get(id);
    if (!entry) return;

    if (type === 'progress') {
        entry.onProgress?.(value);
    } else if (type === 'done') {
        pending.delete(id);
        entry.resolve(value);
    } else if (type === 'error') {
        pending.delete(id);
        entry.reject(new Error(error));
    }
}

function handleCrash(event) {
    Logger.error('[MediaWorker] Worker crashed:', event.message || event);
    const crashError = new Error('Media worker crashed' + (event.message ? `: ${event.message}` : ''));
    crashError.isWorkerCrash = true;

    for (const entry of pending.values()) {
        entry.reject(crashError);
    }
    pending.clear();

    worker?.terminate();
    worker = null; // next request spawns a fresh worker
}

function getWorker() {
    if (!worker) {
        worker = new Worker(new URL('./media-worker.js', import.meta.url), { type: 'module' });
        worker.onmessage = handleMessage;
        worker.onerror = handleCrash;
    }
    return worker;
}

/**
 * Whether processing should be offloaded to the worker.
 * Desktop runs processing in the renderer: @mediabunny/server needs Node,
 * which is unavailable inside a web worker.
 */
export function canUseWorker() {
    const isDesktop = typeof window !== 'undefined' && window.electronAPI?.isElectron;
    return !isDesktop && typeof Worker !== 'undefined';
}

/**
 * Run a processing operation in the worker.
 * @param {string} op - Operation name registered in media-worker.js
 * @param {Object} options - Service options; onProgress is relayed, the rest
 *   must be structured-cloneable (Blob/File/string sources all are)
 * @returns {Promise<*>}
 */
export function runInWorker(op, options = {}) {
    const { onProgress, ...cloneable } = options;
    const id = nextId++;

    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, onProgress });
        try {
            getWorker().postMessage({ id, op, options: cloneable });
        } catch (error) {
            pending.delete(id);
            error.isWorkerCrash = true; // e.g. non-cloneable options, CSP-blocked worker
            reject(error);
        }
    });
}
