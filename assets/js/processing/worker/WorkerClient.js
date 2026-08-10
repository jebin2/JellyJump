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
let idleTimer = null;
// Whether the current worker instance has ever replied. Separates "the worker
// never came up" (safe to rerun the job on the main thread) from "the worker
// died partway through a job" (usually out of memory on a large payload, where
// rerunning inline would freeze the UI instead).
let workerBooted = false;

// Terminate the worker after it sits idle, releasing its entire heap
// (parsed codec bundles plus any residue from the last conversion).
// It respawns transparently on the next job.
const IDLE_TIMEOUT_MS = 30_000;

function scheduleIdleShutdown() {
    clearTimeout(idleTimer);
    if (!worker || pending.size > 0) return;
    idleTimer = setTimeout(() => {
        if (worker && pending.size === 0) {
            Logger.log('[MediaWorker] Idle — terminating to release memory');
            worker.terminate();
            worker = null;
        }
    }, IDLE_TIMEOUT_MS);
}

function handleMessage(event) {
    workerBooted = true;
    const { id, type, value, error } = event.data;
    const entry = pending.get(id);
    if (!entry) return;

    if (type === 'progress') {
        entry.onProgress?.(value);
    } else if (type === 'done') {
        pending.delete(id);
        entry.resolve(value);
        scheduleIdleShutdown();
    } else if (type === 'error') {
        pending.delete(id);
        const err = new Error(error);
        if (event.data.errorName) err.name = event.data.errorName; // preserve AbortError etc.
        entry.reject(err);
        scheduleIdleShutdown();
    }
}

function handleCrash(event) {
    Logger.error('[MediaWorker] Worker crashed:', event.message || event);
    const crashError = new Error('Media worker crashed' + (event.message ? `: ${event.message}` : ''));
    crashError.isWorkerCrash = true;
    // A worker that never replied failed to start (bad URL, CSP, import error);
    // one that had been answering died mid-job.
    crashError.workerNeverStarted = !workerBooted;

    for (const entry of pending.values()) {
        entry.reject(crashError);
    }
    pending.clear();

    worker?.terminate();
    worker = null; // next request spawns a fresh worker
    workerBooted = false;
}

function getWorker() {
    if (!worker) {
        workerBooted = false;
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
 * @param {Object} options - Service options; onProgress is relayed, signal is
 *   translated into a cancel message, the rest must be structured-cloneable
 *   (Blob/File/string sources all are)
 * @returns {Promise<*>}
 */
export function runInWorker(op, options = {}) {
    const { onProgress, signal, ...cloneable } = options;
    const id = nextId++;

    return new Promise((resolve, reject) => {
        clearTimeout(idleTimer);
        pending.set(id, { resolve, reject, onProgress });

        if (signal) {
            // The worker aborts its own controller for this job; the resulting
            // AbortError comes back through the normal error path.
            signal.addEventListener('abort', () => {
                if (pending.has(id)) worker?.postMessage({ id, type: 'cancel' });
            }, { once: true });
        }

        try {
            getWorker().postMessage({ id, op, options: cloneable });
        } catch (error) {
            pending.delete(id);
            // e.g. non-cloneable options, CSP-blocked worker — nothing ran, so
            // the main thread can safely take over.
            error.isWorkerCrash = true;
            error.workerNeverStarted = true;
            reject(error);
        }
    });
}
