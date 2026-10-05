/**
 * PlaybackEpoch - which generation of playback is the live one.
 *
 * Decoding happens across awaits, so by the time a frame arrives the thing
 * that asked for it may be obsolete: the user has seeked, loaded another
 * file, or jumped to the live edge. Every such event bumps the epoch, and
 * work that began under an older one throws its result away instead of
 * drawing a frame from a file that is no longer open.
 *
 * This was a bare counter called `asyncId`, compared by hand in fourteen
 * places. The mechanism was sound; the name said nothing about what it was
 * for, and `player.asyncId !== currentAsyncId` is a statement about equality
 * rather than about staleness.
 */
export class PlaybackEpoch {
    constructor() {
        this._value = 0;
    }

    /**
     * Invalidate everything currently in flight.
     * @returns {number} the new epoch, for the work starting now to carry
     */
    bump() {
        return ++this._value;
    }

    /** The epoch to capture before awaiting anything. */
    get current() {
        return this._value;
    }

    /**
     * @param {number} epoch - what the caller captured before it started
     * @returns {boolean} true once that work is no longer the live generation
     */
    isStale(epoch) {
        return this._value !== epoch;
    }
}
