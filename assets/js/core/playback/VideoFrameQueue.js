/**
 * The video frame queue: where decoded frames come from, and the one frame
 * waiting its turn to be drawn.
 *
 * This was three loose fields on the player — `videoFrameIterator`, `nextFrame`
 * and an `_isFetchingFrame` latch that was never even declared, it just
 * appeared on first assignment. They are one mechanism, and every site that
 * touched one touched at least two: five files opened, closed, emptied and
 * re-opened the queue by assigning to the fields directly.
 *
 * The teardowns were the real cost. Four of them, and no two alike — one
 * awaited return() and swallowed the error, one awaited and let it through,
 * one dropped the iterator without ever returning it, and one deliberately
 * refused to await because a wedged generator queues return() behind a next()
 * that will never resolve. Each difference is correct for where it sits, but
 * written as bare assignments they looked like four copies of the same four
 * lines, and a reader had no way to tell which differences were deliberate.
 * They are named here instead: close, discard, abandon, dropIterator.
 *
 * Staleness is two mechanisms, not one, and both are kept. The epoch covers
 * everything in flight; the iterator identity check (`holds`) covers the
 * narrower case of this queue being re-opened while a pump is mid-await, where
 * the epoch may be untouched but the frames are from a source nobody wants.
 */
export class VideoFrameQueue {
    /** @param {import('./PlaybackEpoch.js').PlaybackEpoch} epoch */
    constructor(epoch) {
        this._epoch = epoch;
        this._iterator = null;
        this._pending = null;
        this._fetching = false;
    }

    /** True while there is a frame source to pull from. */
    get isOpen() { return this._iterator !== null; }

    /** True while a pump is in flight; a second one must not start. */
    get isFetching() { return this._fetching; }

    /** The frame waiting to be drawn, or null when the queue is empty. */
    get pending() { return this._pending; }

    /** The live iterator, for a caller that drives next() on its own. */
    get iterator() { return this._iterator; }

    /** True while `iterator` is still the source this queue is serving. */
    holds(iterator) { return this._iterator === iterator; }

    /**
     * Point the queue at a fresh run of frames from `startTime`.
     * @returns {AsyncIterator|null} the new iterator, or null if the sink
     *          refused — which callers check rather than assuming success.
     */
    open(sink, startTime) {
        this._iterator = sink.canvases(startTime) ?? null;
        return this._iterator;
    }

    setPending(frame) { this._pending = frame; }
    clearPending() { this._pending = null; }

    beginFetch() { this._fetching = true; }

    /**
     * Finish a pump, but only if it is still the live generation: a newer
     * open() has taken ownership of the latch and must not have it cleared
     * out from under it.
     * @param {number} epoch - captured by the pump before it started
     */
    endFetch(epoch) {
        if (!this._epoch.isStale(epoch)) this._fetching = false;
    }

    /** Release the frame source but keep the frame already waiting. */
    dropIterator() { this._iterator = null; }

    /** Empty the queue without returning the iterator — for a source that is
     *  already gone, such as a reclaimed codec. */
    discard() {
        this._iterator = null;
        this._pending = null;
    }

    /**
     * Empty the queue and close the iterator, waiting for it to finish.
     *
     * The iterator is detached before the await, not after, so a return()
     * that throws cannot leave a dead source installed for the next open()
     * to try to close all over again.
     */
    async close() {
        const iterator = this._iterator;
        this._iterator = null;
        this._pending = null;
        if (iterator) await iterator.return();
    }

    /**
     * Empty the queue and close the iterator without waiting for it.
     *
     * For an iterator that may be wedged: an async generator stuck in next()
     * queues return() behind it, so awaiting here would hang the caller. The
     * latch is forced open rather than epoch-checked because the pump still
     * sitting on that stuck next() will never reach its own endFetch.
     */
    abandon() {
        const iterator = this._iterator;
        this.discard();
        this._fetching = false;
        Promise.resolve(iterator?.return?.()).catch(() => {});
    }
}
