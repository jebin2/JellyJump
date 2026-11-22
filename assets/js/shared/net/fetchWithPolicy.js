// @ts-check
/**
 * `fetch` for the app's small requests to other servers: a shared library's
 * listing, an M3U or link list, a YouTube title (ARCHITECTURE_PLAN.md, N5).
 *
 * A bare `fetch` waits as long as the browser lets it (minutes, for a host
 * that accepts the connection and says nothing), gives up at the first
 * hiccup, and fails with a TypeError whose message differs per browser. Here:
 *
 * - a time limit for the answer to start (`timeoutMs`); reading the body is
 *   not limited, so a streamed listing can take as long as it takes;
 * - for GET, a retry or two after a dropped connection or a 5xx / 429, with
 *   a growing wait between them;
 * - failures as AppError codes: TIMEOUT, OFFLINE, NETWORK. An HTTP status is
 *   not a failure here: the response comes back, and the caller decides
 *   what a 401 or a 404 means to it.
 * - Cancelling through `signal` stops at once, with no retry, as a
 *   cancellation (AbortError).
 *
 * Not for media: a video is read in ranges by MediaBunny, which has its own
 * retry policy (MediaLifecycle).
 */
import { AppError } from '../errors/AppError.js';

/**
 * @typedef {RequestInit & {
 *   timeoutMs?: number,
 *   retries?: number,
 *   backoffMs?: number,
 * }} FetchPolicy
 */

const RETRY_STATUS = new Set([429, 500, 502, 503, 504]);

/** @param {number} ms @param {AbortSignal|null|undefined} signal */
function wait(ms, signal) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
        }, { once: true });
    });
}

function isOffline() {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * @param {string|URL} url
 * @param {FetchPolicy} [policy]
 * @returns {Promise<Response>}
 */
export async function fetchWithPolicy(url, policy = {}) {
    const { timeoutMs = 15000, retries: retriesAsked, backoffMs = 500, signal, ...init } = policy;
    const method = (init.method || 'GET').toUpperCase();
    // Only a request that changes nothing is safe to send again.
    const retries = method === 'GET' || method === 'HEAD' ? (retriesAsked ?? 2) : 0;

    for (let attempt = 0; ; attempt++) {
        if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
        const controller = new AbortController();
        let timedOut = false;
        const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
        const onAbort = () => controller.abort(signal?.reason);
        signal?.addEventListener('abort', onAbort, { once: true });

        /** @type {Response|null} */
        let response = null;
        /** @type {AppError|null} */
        let failure = null;
        try {
            response = await fetch(url, { ...init, signal: controller.signal });
        } catch (error) {
            if (signal?.aborted) throw error; // cancelled by the caller
            if (timedOut) {
                failure = new AppError('TIMEOUT', { message: `No answer from ${hostOf(url)} within ${timeoutMs / 1000}s`, cause: error });
            } else if (isOffline()) {
                failure = new AppError('OFFLINE', { message: 'The device is offline', cause: error });
            } else {
                // A TypeError: refused, dropped, blocked (CORS, mixed content)
                // — the browser does not say which.
                failure = new AppError('NETWORK', { message: `Could not reach ${hostOf(url)}`, cause: error });
            }
        } finally {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
        }

        const retryable = failure ? failure.code !== 'OFFLINE' : RETRY_STATUS.has(/** @type {Response} */ (response).status);
        if (!retryable || attempt >= retries) {
            if (failure) throw failure;
            return /** @type {Response} */ (response);
        }
        // An answer not used is let go of, so its connection is freed.
        response?.body?.cancel().catch(() => {});
        await wait(backoffMs * 2 ** attempt, signal);
    }
}

/** @param {string|URL} url */
function hostOf(url) {
    try { return new URL(String(url), globalThis.location?.href).host || 'the server'; } catch { return 'the server'; }
}
