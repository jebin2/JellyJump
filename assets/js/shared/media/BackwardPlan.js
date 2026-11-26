// @ts-check
/**
 * Which frames to hold when playing backwards (BackwardFrames,
 * ReversePlayback): plain arithmetic, apart from the decoding, so it can be
 * tested on its own (scripts/backward-plan-test.mjs).
 */

/** Decoding a stretch may take at most this share of the time it plays for. */
const DECODE_BUDGET = 0.75;

/** Never fewer frames than one in this many (a picture every ~0.3 s at 30 fps). */
const MAX_STEP = 8;

/**
 * Up to `count` of `stamps` (ascending), every `step`-th one back from the
 * last, ascending. When the step would pass over the first one, the key
 * frame, with room to spare, it is taken too: otherwise it is left as a
 * stretch of one frame.
 * @param {number[]} stamps
 * @param {number} count
 * @param {number} step
 */
export function pickBack(stamps, count, step) {
    const picked = [];
    let i = stamps.length - 1;
    for (; i >= 0 && picked.length < count; i -= step) picked.push(stamps[i]);
    if (picked.length < count && i < 0 && picked.at(-1) !== stamps[0] && stamps.length) picked.push(stamps[0]);
    return picked.reverse();
}

/**
 * Which frames a stretch holds: every `step`-th one back from its end,
 * `count` of them.
 *
 * The step is the smallest that lets decoding the stretch (all `frames`,
 * from the key frame) take no more than DECODE_BUDGET of the time it plays
 * for. And if that would leave the chunk's first few frames for a stretch of
 * their own -- too short to watch while the chunk before decodes, about
 * `chunkFrames` of them -- this stretch takes them too, holding up to twice
 * `capacity`, or stepping further.
 *
 * @param {{frames: number, decodeFps: number, frameDuration: number, capacity: number, rate: number, chunkFrames?: number}} p
 *   frames: from the key frame to the end of the stretch, all decoded;
 *   decodeFps: frames this device decodes a second; frameDuration: seconds
 *   between frames; capacity: frames a stretch usually holds; rate: playback
 *   speed; chunkFrames: frames in a chunk (key frame to key frame), as seen
 * @returns {{step: number, count: number}}
 */
export function planStretch({ frames, decodeFps, frameDuration, capacity, rate, chunkFrames = frames }) {
    if (!(frames > 0) || !(decodeFps > 0) || !(frameDuration > 0) || !(rate > 0)) return { step: 1, count: capacity };
    // Frames of video a stretch must play for while `n` frames decode, for
    // the decoding to take DECODE_BUDGET of that time.
    const cover = (/** @type {number} */ n) => ((n / decodeFps) / DECODE_BUDGET) * rate / frameDuration;
    let step = Math.ceil(cover(frames) / capacity);
    // Past covering the whole way back to the key frame, a bigger step only
    // drops frames.
    step = Math.max(1, Math.min(MAX_STEP, step, Math.ceil(frames / capacity)));
    let count = capacity;
    const left = frames - step * count;
    // `left` frames would be the next stretch, shown while the chunk before
    // decodes; too few to hide that behind, so they are taken now.
    if (left > 0 && left < cover(chunkFrames)) {
        // One more than the steps, for the key frame (pickBack).
        count = Math.ceil(frames / step) + 1;
        if (count > 2 * capacity) {
            step = Math.min(MAX_STEP, Math.ceil(frames / (2 * capacity - 1)));
            count = Math.ceil(frames / step) + 1;
        }
    }
    return { step, count: Math.min(count, 2 * capacity) };
}
