// @ts-check
import { Logger } from '../utils/Logger.js';
import { isCancellation } from '../utils/Cancellation.js';
import { AppError } from '../errors/AppError.js';
import { Metrics } from '../diagnostics/Metrics.js';

/**
 * JobQueue - processing jobs that run behind the app, one at a time.
 *
 * A tool used to run its job inside its own dialog, locked shut until the job
 * was done, and the result was only to be seen after closing it and finding
 * the new playlist item. Now a tool hands its job here and gets out of the
 * way: the user can keep watching, open another tool, or queue another job.
 * The job tray shows what is running and what is done, with Play and Download
 * on each result.
 *
 * One at a time on purpose. Two encodes in one browser each run at half speed
 * and together can run it out of memory, so a second job waits its turn.
 */

/**
 * @typedef {'queued'|'running'|'done'|'failed'|'cancelled'} JobStatus
 *
 * @typedef {Object} JobResult
 * @property {Object} item - The playlist item the job added
 * @property {string} url - Its blob URL, for Download
 * @property {string} filename
 * @property {File} [file] - Its file as made; the playlist lets go of the
 *   item's own once the file is stored
 *
 * @typedef {Object} Job
 * @property {number} id
 * @property {string} name - What the job does: "Cut", "Convert"
 * @property {string} subject - What it does it to, usually the item's title
 * @property {JobStatus} status
 * @property {number} progress - 0 to 1
 * @property {string} [label] - The work's own word for where it is
 * @property {string} [error]
 * @property {string} [errorCode] - the AppError code of the failure (shared/errors/codes.js)
 * @property {JobResult[]} results
 * @property {number} [startedAt] - performance.now() when it started running
 * @property {number} [finishedAt] - and when it stopped, however it ended
 * @property {() => void} cancel
 *
 * @typedef {Object} JobSpec
 * @property {string} name
 * @property {string} subject
 * @property {(api: {signal: AbortSignal, onProgress: (fraction: number, label?: string) => void}) => Promise<*>} work
 * @property {(result: *) => (void|Promise<void>)} [done] - Adds the result to the playlist
 * @property {(error: Error) => string} [failureText]
 */

/** Fired by Playlist.insertProcessedItem; a job's results are read off it. */
export const PROCESSED_ITEM_EVENT = 'jellyjump:processed-item';

/** @type {Job[]} */
const jobs = [];
/** @type {Set<(jobs: Job[]) => void>} */
const listeners = new Set();
/** @type {Map<number, {spec: JobSpec, controller: AbortController, resolve: (outcome: *) => void}>} */
const pending = new Map();
let nextId = 1;
let running = false;

function emit() {
    const snapshot = jobs.slice();
    for (const listener of listeners) {
        try { listener(snapshot); } catch (e) { Logger.warn('JobQueue listener failed:', e); }
    }
}

async function pump() {
    if (running) return;
    const job = jobs.find(j => j.status === 'queued');
    if (!job) return;
    const entry = pending.get(job.id);
    if (!entry) return;
    const { spec, controller, resolve } = entry;

    running = true;
    job.status = 'running';
    job.startedAt = performance.now();
    emit();

    // Progress arrives far more often than it can be seen; a whole percent
    // is the smallest change worth a repaint.
    let shown = -1;
    const onProgress = (/** @type {number} */ fraction, /** @type {string|undefined} */ label) => {
        job.progress = Math.max(0, Math.min(1, fraction));
        const pct = Math.round(job.progress * 100);
        if (pct === shown && (!label || label === job.label)) return;
        shown = pct;
        if (label) job.label = label;
        emit();
    };

    /** @param {Event} e */
    const collect = (e) => {
        const detail = /** @type {CustomEvent} */ (e).detail;
        if (detail?.item) job.results.push({ item: detail.item, url: detail.url, filename: detail.item.title, file: detail.item.file });
    };

    Logger.setTrace('job', job.id);
    try {
        const result = await spec.work({ signal: controller.signal, onProgress });
        // Whatever done() adds to the playlist is this job's result.
        window.addEventListener(PROCESSED_ITEM_EVENT, collect);
        try { await spec.done?.(result); } finally { window.removeEventListener(PROCESSED_ITEM_EVENT, collect); }
        job.status = 'done';
        job.progress = 1;
        // How long each tool takes, for Diagnostics (plan P3).
        Metrics.record(`job:${spec.name}`, performance.now() - (job.startedAt ?? 0));
        resolve({ ok: true, result });
    } catch (failure) {
        const error = /** @type {Error} */ (failure);
        if (controller.signal.aborted && isCancellation(error)) {
            job.status = 'cancelled';
            resolve({ ok: false, cancelled: true, error });
        } else {
            Logger.error(`${spec.name} failed:`, error);
            job.status = 'failed';
            job.errorCode = AppError.from(error).code;
            job.error = spec.failureText ? spec.failureText(error) : `${spec.name} failed: ${error?.message ?? error}`;
            resolve({ ok: false, cancelled: false, error });
        }
    } finally {
        Logger.setTrace('job', null);
        job.finishedAt = performance.now();
        pending.delete(job.id);
        running = false;
        emit();
        pump();
    }
}

export const JobQueue = {
    /**
     * Queue a job. It starts now if nothing else is running.
     * @param {JobSpec} spec
     * @returns {{job: Job, finished: Promise<{ok: boolean, cancelled?: boolean, result?: *, error?: Error}>}}
     */
    add(spec) {
        const controller = new AbortController();
        /** @type {Job} */
        const job = {
            id: nextId++,
            name: spec.name,
            subject: spec.subject,
            status: 'queued',
            progress: 0,
            results: [],
            cancel: () => {
                if (job.status === 'queued') {
                    // Never started, so there is nothing to stop: it just
                    // leaves the queue.
                    job.status = 'cancelled';
                    pending.get(job.id)?.resolve({ ok: false, cancelled: true });
                    pending.delete(job.id);
                    emit();
                } else if (job.status === 'running') {
                    controller.abort();
                }
            },
        };
        /** @type {(outcome: *) => void} */
        let resolve = () => {};
        const finished = new Promise(r => { resolve = r; });
        jobs.push(job);
        pending.set(job.id, { spec, controller, resolve });
        emit();
        pump();
        return { job, finished };
    },

    /** @returns {Job[]} */
    list() { return jobs.slice(); },

    /** Jobs still to finish, queued or running. */
    activeCount() { return jobs.filter(j => j.status === 'queued' || j.status === 'running').length; },

    /**
     * Take a finished job off the list.
     * @param {number} id
     */
    dismiss(id) {
        const i = jobs.findIndex(j => j.id === id);
        if (i === -1 || jobs[i].status === 'queued' || jobs[i].status === 'running') return;
        jobs.splice(i, 1);
        emit();
    },

    /** Take every finished job off the list. */
    clearFinished() {
        for (let i = jobs.length - 1; i >= 0; i--) {
            if (jobs[i].status !== 'queued' && jobs[i].status !== 'running') jobs.splice(i, 1);
        }
        emit();
    },

    /**
     * @param {(jobs: Job[]) => void} listener - Called on every change
     * @returns {() => void} unsubscribe
     */
    subscribe(listener) {
        listeners.add(listener);
        return () => { listeners.delete(listener); };
    },
};

// Leaving the page loses a job half done, and its result with it.
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', (e) => {
        if (JobQueue.activeCount() > 0) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}
