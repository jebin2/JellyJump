import { Logger } from '../../shared/utils/Logger.js';

/**
 * The audio buffer queue: where decoded audio comes from, and the close that
 * may still be running after the queue has already been handed on.
 *
 * The video side of this is VideoFrameQueue, and the two are deliberately not
 * the same shape. Video keeps one decoded frame waiting for its turn and a
 * latch saying a pump is in flight, because frames are drawn when the clock
 * reaches them. Audio has neither: buffers are scheduled into the AudioContext
 * the moment they arrive, so there is nothing to hold and nothing to pump.
 *
 * What audio has instead is a close that outlives the queue. Returning an
 * audio iterator can take long enough to matter, and a load or a seek must not
 * block on it, so closeSoon() detaches the iterator immediately and lets
 * return() finish in the background -- while anything that must not start
 * before the old audio has stopped awaits `closing`. That promise was a bare
 * field two files reached into, read in one place and nulled in a `finally` in
 * another; here it is what the queue hands out.
 */
export class AudioBufferQueue {
    constructor() {
        this._iterator = null;
        this._closing = null;
    }

    /** True while there is a buffer source to pull from. */
    get isOpen() { return this._iterator !== null; }

    /** The live iterator, for the pump that drives next() itself. */
    get iterator() { return this._iterator; }

    /** A close still running in the background, or null. */
    get closing() { return this._closing; }

    /** True while `iterator` is still the source this queue is serving. */
    holds(iterator) { return this._iterator === iterator; }

    /**
     * Point the queue at a fresh run of buffers from `startTime`.
     * @returns {AsyncIterator|null} null when there is no sink to read from,
     *          which the live path relies on to mean "no audio for this item".
     */
    open(sink, startTime) {
        this._iterator = sink ? sink.buffers(startTime) : null;
        return this._iterator;
    }

    /** Detach and close the iterator, waiting for it to finish. */
    async close() {
        const iterator = this._iterator;
        if (!iterator) return;
        this._iterator = null;
        await iterator.return();
    }

    /**
     * Detach the iterator now and close it in the background.
     *
     * The caller carries on immediately; whoever must not run until the old
     * audio has actually stopped awaits `closing` instead.
     */
    closeSoon() {
        const iterator = this._iterator;
        if (!iterator) return;
        this._iterator = null;
        this._closing = iterator.return()
            .catch(e => { Logger.debug('Error closing audio iterator:', e); })
            .finally(() => { this._closing = null; });
    }

    /** Wait for a background close, if one is running. */
    async settle() {
        if (this._closing) await this._closing;
    }

    /**
     * Close `iterator`, but only if this queue is still serving it -- the pump
     * tidying up after itself without stepping on a newer one.
     *
     * The field is deliberately left pointing at the finished iterator, which
     * is what this did as loose fields: return() on a completed generator is a
     * no-op, so a later close() is harmless, and changing it would alter what
     * isOpen reports after a pump ends.
     */
    async closeIfHeld(iterator) {
        if (!this.holds(iterator)) return;
        try { await iterator.return(); } catch (e) { /* already finished */ }
    }
}
