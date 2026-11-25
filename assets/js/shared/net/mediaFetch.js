// @ts-check
/**
 * A `fetchFn` for MediaBunny's UrlSource that, with logging on (?debug=1),
 * writes one line per range request a remote video makes: who asked
 * (playback, thumbnails, metadata), which bytes, how long until the answer
 * started, and how long the body took at what rate.
 *
 * Several readers open the same remote file side by side, and on a slow
 * link they compete; without this a log shows playback starving but not what
 * took the bandwidth. With logging off it is plain `fetch`: nothing wrapped.
 */
import { Logger } from '../utils/Logger.js';

/**
 * @param {string} label - who reads: 'playback', 'thumbnails', 'metadata'
 * @returns {typeof fetch}
 */
export function mediaFetchFn(label) {
    return async (input, init) => {
        if (!Logger.isEnabled()) return fetch(input, init);
        const range = new Headers(init?.headers).get('Range') || 'whole file';
        const started = performance.now();
        let response;
        try {
            response = await fetch(input, init);
        } catch (error) {
            Logger.log(`[Net:${label}] ${range} failed after ${(performance.now() - started).toFixed(0)}ms:`,
                /** @type {Error} */ (error)?.message || error);
            throw error;
        }
        const firstByteMs = performance.now() - started;
        if (!response.body) {
            Logger.log(`[Net:${label}] ${range} → ${response.status} in ${firstByteMs.toFixed(0)}ms (no body)`);
            return response;
        }
        let bytes = 0;
        let reported = false;
        const report = (/** @type {string} */ how) => {
            if (reported) return;
            reported = true;
            const totalMs = performance.now() - started;
            const kbps = bytes / 1024 / Math.max(0.001, (totalMs - firstByteMs) / 1000);
            Logger.log(`[Net:${label}] ${range} → ${response.status}, ${(bytes / 1024).toFixed(0)} KB ${how}, `
                + `first byte ${firstByteMs.toFixed(0)}ms, total ${totalMs.toFixed(0)}ms (${kbps.toFixed(0)} KB/s)`);
        };
        const counted = response.body.pipeThrough(new TransformStream({
            transform(chunk, controller) {
                bytes += chunk.byteLength;
                controller.enqueue(chunk);
            },
            flush() { report('read'); },
        }));
        // MediaBunny aborts a read it no longer needs (a seek); say how far it got.
        init?.signal?.addEventListener('abort', () => report('read, then aborted'), { once: true });
        return new Response(counted, { status: response.status, statusText: response.statusText, headers: response.headers });
    };
}
