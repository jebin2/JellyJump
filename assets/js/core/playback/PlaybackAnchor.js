/**
 * An anchor: the point where a wall clock and the content clock were last
 * agreed to be the same moment.
 *
 * Playback position is not read from the media. It is computed -- the content
 * time of the anchor, plus however much the AudioContext's clock has advanced
 * since. Two of these exist: one for VOD, set when play() prefetches its first
 * audio buffer, and one for live, set to the live edge and then snapped to the
 * first frame that actually arrives.
 *
 * Both were pairs of loose fields, and the only question anyone ever asked of
 * them -- "is there an anchor yet?" -- was asked four different ways:
 *
 *   PlaybackState   anchorWall !== undefined
 *   AudioEngine     wall === undefined || content === undefined || wall === null
 *   PlayerStream    if (this._liveAnchorWall)        // truthiness
 *   AudioEngine     player.stream?._liveAnchorWall ?? anchorWall
 *
 * They do not agree, and two of them are wrong. The VOD fields are unset to
 * `undefined` while the live ones are initialised to `null`, so the first
 * check read a never-anchored live stream as anchored at wall 0 / content 0 --
 * which made the position come out as the AudioContext's entire age and sent a
 * live stream to a start far past its edge. The truthiness check has the
 * opposite flaw: a genuine anchor at wall 0, which happens when the context is
 * fresh, reads as no anchor at all and the live badge quietly stops measuring
 * drift.
 *
 * So there is one state, named once, and `isAnchored` is the only way to ask.
 */
export class PlaybackAnchor {
    constructor() {
        this._wall = null;
        this._content = null;
        this._snapped = false;
    }

    /** True once both halves are set. 0 is a real value for either. */
    get isAnchored() { return this._wall !== null && this._content !== null; }

    /** The wall-clock reading (AudioContext.currentTime) at the anchor. */
    get wall() { return this._wall; }

    /** The content timestamp at the anchor. */
    get content() { return this._content; }

    /**
     * Live only: whether the anchor has been moved onto a frame that really
     * arrived, as opposed to the estimated edge it started at. The audio pump
     * waits for this before trusting a timestamp.
     */
    get hasSnapped() { return this._snapped; }

    set(wall, content) {
        this._wall = wall ?? null;
        this._content = content ?? null;
    }

    /** Move the anchor onto a frame that actually arrived. */
    snapTo(wall, content) {
        this.set(wall, content);
        this._snapped = true;
    }

    /** Forget the anchor, but not that a snap has happened. */
    clear() {
        this._wall = null;
        this._content = null;
    }

    /** Forget everything, for a new item. */
    reset() {
        this.clear();
        this._snapped = false;
    }

    /**
     * Where playback is now, given the current wall clock.
     *
     * Never behind the anchor itself: a clock that has not advanced past it
     * yet would otherwise read as playback running backwards.
     * @param {number} now - AudioContext.currentTime
     * @param {number} [rate] - playback rate
     */
    positionAt(now, rate = 1) {
        const position = this._content + ((now - this._wall) * rate);
        return position >= this._content - 0.1 ? position : this._content;
    }
}
