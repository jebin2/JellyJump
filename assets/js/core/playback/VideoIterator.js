import { Logger } from '../../shared/utils/Logger.js';
import { getPlayerPlaybackTime } from './PlaybackState.js';

/**
 * (Re)open the video decode at the playback position and show its first
 * frame. Kept apart from MediaLifecycle, which loads MediaBunny, so the
 * clock, the transport and the render loop can use it without that.
 */

// Long enough that a slow decoder spin-up, a large GOP or a sluggish network
// source still lands, short enough that a wedged one does not cost the session.
// player.firstFrameTimeoutMs overrides it, which is how the suite exercises the
// recovery path without waiting half a minute for it.
const FIRST_FRAME_TIMEOUT_MS = 30000;

/**
 * Reject if a promise has not settled in time.
 *
 * The timer is cleared either way, so a settled promise leaves nothing behind.
 * The abandoned promise may still settle later; its iterator is dropped by the
 * caller, which is what stops it being mistaken for the current one.
 */
function _withTimeout(promise, ms, what) {
    let timer;
    return Promise.race([
        promise.finally(() => clearTimeout(timer)),
        new Promise((_, reject) => {
            timer = setTimeout(() => {
                const error = new Error(`timed out waiting for the ${what} after ${ms}ms`);
                error.name = 'FrameWaitTimeout';
                reject(error);
            }, ms);
        }),
    ]);
}

export async function startPlayerVideoIterator(player) {
    if (!player.videoSink) return;

    // Bump the generation first, which is what actually stops whatever else is
    // in flight: every await in here and in updateNextFrame re-checks the epoch
    // and bails when it has moved on.
    //
    // This used to return early while a frame fetch was in flight, which is the
    // one case that matters — a seek arriving mid-catch-up. Refusing to rebuild
    // there left the old iterator sitting at the old position, and the catch-up
    // loop then ground all the way forward to the seek target one frame at a
    // time. That is the "picture keeps fast-forwarding after the key is
    // released" symptom: a seek must always win.
    const epoch = player.epoch.bump();
    player.frames.beginFetch();

    let firstFrame = null;
    let secondFrame = null;
    try {
        await player.frames.close();

        const startTime = getPlayerPlaybackTime(player);
        Logger.log(`[VideoIterator] Initializing canvases at time: ${startTime.toFixed(3)}s (epoch=${epoch})`);
        const iterator = player.frames.open(player.videoSink, startTime);
        if (!iterator) {
            Logger.warn('[VideoIterator] videoSink returned null iterator for time:', getPlayerPlaybackTime(player));
            return;
        }

        try {
            // Bounded, because a decoder that wedges on the seek target never
            // settles these at all. Unbounded, that took the whole player with
            // it: the rebuild never returned, so seekPlayerTo never cleared the
            // loading flag and never released the seek loop, leaving the
            // spinner up and every later seek silently dropped -- recoverable
            // only by restarting. A seek that cannot produce a frame in this
            // long has failed by any measure, and failing is already handled
            // right here: drop the iterator and let the next play or seek try
            // again.
            const limit = player.firstFrameTimeoutMs ?? FIRST_FRAME_TIMEOUT_MS;
            firstFrame = (await _withTimeout(iterator.next(), limit, 'first frame')).value ?? null;
            secondFrame = (await _withTimeout(iterator.next(), limit, 'second frame')).value ?? null;
        } catch (e) {
            if (e && e.name === 'FrameWaitTimeout') {
                // Still sitting on that next(), and it will never finish. This
                // needs abandon(), not dropIterator(): the generator has to be
                // returned so the frames it holds are closed rather than left
                // for the collector to complain about, the pending frame has to
                // go so a stale one is not kept on screen, and the fetch latch
                // has to be forced open because the wedged pump will never
                // reach its own endFetch to clear it.
                Logger.warn(`[VideoIterator] ${e.message} — abandoning this iterator`);
                player.frames.abandon();
                return;
            }
            // A generator that threw is already finished: there is nothing to
            // return and the latch clears normally.
            Logger.warn('[VideoIterator] Failed to get initial frames, will retry on next play:', e);
            player.frames.dropIterator();
            return;
        }

        if (player.epoch.isStale(epoch)) return;

        player.frames.setPending(secondFrame);

        if (firstFrame) {
            player.presentFrame(firstFrame.canvas);
        }
    } finally {
        // Only if we are still the current generation: a newer start has taken
        // ownership of the flag and must not have it cleared out from under it.
        player.frames.endFetch(epoch);
    }
}
