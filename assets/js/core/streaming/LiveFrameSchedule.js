/**
 * When to show a live frame, or whether to show it at all.
 *
 * A live frame is not drawn when it arrives; it is drawn when the audio clock
 * reaches the moment it belongs to. That moment comes from the anchor: the
 * frame's content timestamp, measured from the anchor's content time, laid onto
 * the anchor's wall time, plus the output latency the audio hardware adds.
 *
 * This was twenty-five lines of arithmetic in the middle of a two-hundred-line
 * loop, with five thresholds written as bare numbers -- 0.25, 1.0, 2.0, 30.0,
 * 0.005 -- that no test could reach and nothing explained. Pulling the
 * arithmetic and the decision out leaves the loop doing what loops should do
 * and makes the thresholds something a unit test can hold still.
 *
 * Only the decision is here. Logging, the loading spinner and the live badge
 * stay in the loop, because they also depend on how many frames have gone by.
 */

/** Past this much lateness, stop pacing and start catching up. */
export const DRIFT_CATCHUP = 0.25;
/** Past this, the catch-up is long enough to be worth showing a spinner. */
export const DRIFT_LOADING = 1.0;
/** Past this, say so in the log even between the periodic reports. */
export const DRIFT_LOUD = 2.0;
/** Past this, catching up frame by frame is hopeless; rejoin at the edge. */
export const DRIFT_JUMP = 30.0;
/** How early a frame may be presented, so pacing does not chase microseconds. */
export const PRESENT_SLACK = 0.005;

/**
 * @param {object} args
 * @param {import('../playback/PlaybackAnchor.js').PlaybackAnchor} args.anchor
 * @param {number} args.frameTimestamp - the frame's content time
 * @param {number} args.now - AudioContext.currentTime
 * @param {number} [args.outputLatency] - AudioContext.outputLatency
 * @returns {{kind: 'unanchored'|'jumpToEdge'|'catchUp'|'present',
 *            targetWall?: number, drift?: number,
 *            showLoading?: boolean, loud?: boolean, waitUntil?: number}}
 */
export function scheduleLiveFrame({ anchor, frameTimestamp, now, outputLatency = 0 }) {
    // Without an anchor there is nothing to pace against, and the caller falls
    // back to drawing frames as they arrive.
    if (!anchor?.isAnchored) return { kind: 'unanchored' };

    const targetWall = anchor.wall + (frameTimestamp - anchor.content) + outputLatency;
    const drift = now - targetWall;

    if (drift > DRIFT_CATCHUP) {
        if (drift > DRIFT_JUMP) return { kind: 'jumpToEdge', targetWall, drift };
        return {
            kind: 'catchUp',
            targetWall,
            drift,
            showLoading: drift > DRIFT_LOADING,
            loud: drift > DRIFT_LOUD,
        };
    }

    return { kind: 'present', targetWall, drift, waitUntil: targetWall - PRESENT_SLACK };
}
