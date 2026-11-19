import { MediaBunny } from '../../core/MediaBunny.js';

/**
 * BackwardFrames - video frames in reverse order, at the speed of forward
 * decoding.
 *
 * Video decodes only forwards from a key frame. Asked for frames backwards
 * one at a time -- samplesAtTimestamps with falling timestamps, which is what
 * the reverse export did -- Mediabunny has to re-decode from the key frame
 * for every frame, because its reuse of decoded frames only works going
 * forwards. Measured on a 10s 720p clip: 39 frames a second with a key frame
 * every 2s, 16 with one every 5s.
 *
 * Here, the frames just before the requested time are decoded once, forwards,
 * with Mediabunny's own pipelined range iteration (samples(start, end)), and
 * held; later requests, which go backwards, are answered from them until they
 * run out, and then the next stretch back is decoded the same way. The same
 * clip gave 561 frames a second either way.
 *
 * How many frames are held is capped, by count and by memory: decoders --
 * hardware ones especially -- keep a small pool of frames, and a 4K chunk
 * between key frames can run to gigabytes. When a chunk is longer than the
 * cap, only its tail is held, and the part before is decoded again from the
 * key frame when it is reached. That still costs a fraction of decoding each
 * frame from the key frame separately.
 */

/**
 * How far apart two timestamps can be and still be the same instant. Asked
 * for 9.399999999999999 -- 9.4 after floating-point arithmetic -- Mediabunny
 * answers with the frame at 9.4, and so must this, or it hands back the frame
 * before it.
 */
const SAME_INSTANT = 1e-6;

/** Held frames at most, whatever their size. */
const MAX_HELD_FRAMES = 48;
/** Held frames at most, by their decoded size (4:2:0, 1.5 bytes a pixel). */
const MAX_HELD_BYTES = 256 * 1024 * 1024;

export class BackwardFrameReader {
    /**
     * @param {Object} videoTrack - a Mediabunny InputVideoTrack
     * @param {Object} [options]
     * @param {Object} [options.decoderOptions] - passed to VideoSampleSink
     * @param {number} [options.maxFrames] - hold fewer than the default, for
     *   a caller that keeps two readers going at once
     * @param {(sample: Object) => Promise<{timestamp: number, close: () => void}>} [options.toHeld]
     *   turn each decoded frame into what is held, so the decoder's own frame
     *   can be released at once. Hardware decoders keep only a small pool of
     *   frames and can stall while too many are held; a caller that only needs
     *   to draw a frame can hold a copy instead. sampleAt() and
     *   backwardSamples() clone what is held, so for them the copy must itself
     *   be a VideoSample.
     */
    constructor(videoTrack, { decoderOptions, maxFrames = MAX_HELD_FRAMES, toHeld = null } = {}) {
        this.toHeld = toHeld;
        this.track = videoTrack;
        this.sink = new MediaBunny.VideoSampleSink(videoTrack, decoderOptions);
        this.packets = new MediaBunny.EncodedPacketSink(videoTrack);
        const frameBytes = Math.max(1, (videoTrack.codedWidth || 1920) * (videoTrack.codedHeight || 1080) * 1.5);
        this.capacity = Math.max(4, Math.min(maxFrames, Math.floor(MAX_HELD_BYTES / frameBytes)));
        /** Frames held, ascending by timestamp, all at or before `heldUntil`. */
        this.held = [];
        this.heldUntil = -Infinity;
        /** How many frames have been decoded, for the curious. */
        this.decodedFrames = 0;
        /** Whether a fill is under way. */
        this.busy = false;
    }

    /** The earliest held timestamp, or null when nothing is held. */
    get oldest() {
        return this.held.length ? this.held[0].timestamp : null;
    }

    /**
     * The held frame for a time, without decoding: the frame itself (not a
     * clone, so draw it and let it be), null if the held stretch covers the
     * time but has no frame for it, or undefined if it does not cover it.
     * For a caller that cannot wait, such as a render loop.
     * @param {number} timestamp
     */
    peek(timestamp) {
        return this._fromHeld(timestamp);
    }

    /**
     * Decode and hold the stretch ending at `timestamp`. Resolves once held;
     * a call while one is under way waits for that one instead.
     * @param {number} timestamp
     */
    async fill(timestamp) {
        if (this.busy) return this._filling;
        this.busy = true;
        this._filling = this._fill(timestamp).finally(() => { this.busy = false; });
        return this._filling;
    }

    /**
     * The frame shown at `timestamp`: the last one at or before it. A clone,
     * which the caller closes; null before the first frame.
     *
     * Fast when successive calls move backwards, as reverse playback does.
     * Any order works, but a jump forwards re-decodes.
     *
     * @param {number} timestamp - seconds, on the track's timeline
     * @returns {Promise<Object|null>} a Mediabunny VideoSample
     */
    async sampleAt(timestamp) {
        let frame = this._fromHeld(timestamp);
        if (frame === undefined) {
            await this.fill(timestamp);
            frame = this._fromHeld(timestamp);
        }
        if (frame === undefined || frame === null) {
            // Nothing in this stretch at or before the time: a frame from the
            // stretch before is shown there (an open GOP, or the time falls
            // before a stretch's first frame). Rare enough to ask directly.
            return this.sink.getSample(timestamp);
        }
        return frame.clone();
    }

    /**
     * Frames for a falling sequence of timestamps, as samplesAtTimestamps
     * yields them: a VideoSample (or null) per timestamp, owned by the caller.
     * @param {Iterable<number>|AsyncIterable<number>} timestamps
     */
    async *samplesAt(timestamps) {
        for await (const t of timestamps) yield await this.sampleAt(t);
    }

    /**
     * Release every held frame. Final: a fill still under way releases what
     * it decoded instead of holding it.
     */
    close() {
        this.closed = true;
        for (const frame of this.held) frame.close();
        this.held = [];
        this.heldUntil = -Infinity;
    }

    /**
     * The held frame for this time, null if the held stretch covers the time
     * but has nothing at or before it, or undefined if it does not cover it.
     * @private
     */
    _fromHeld(timestamp) {
        if (!this.held.length || timestamp > this.heldUntil + SAME_INSTANT) return undefined;
        // Before the held stretch: the earlier stretch is decoded next, from
        // its own key frame (the previous chunk, or the start of this one
        // when only its tail was held).
        if (timestamp < this.held[0].timestamp - SAME_INSTANT) return undefined;
        for (let i = this.held.length - 1; i >= 0; i--) {
            if (this.held[i].timestamp <= timestamp + SAME_INSTANT) return this.held[i];
        }
        return null;
    }

    /**
     * Decode forwards from the key frame at or before `timestamp` up to it,
     * keeping the last `capacity` frames.
     * @private
     */
    async _fill(timestamp, { trustPackets = true } = {}) {
        const key = await this.packets.getKeyPacket(timestamp, { metadataOnly: true })
            ?? await this.packets.getFirstPacket({ metadataOnly: true });
        if (!key) {
            this.close();
            return;
        }

        // Up to and including the frame at `timestamp`; a little past it,
        // since the range's end is exclusive.
        const end = timestamp + 2 * SAME_INSTANT;
        // With a conversion, only the frames that will be kept are converted:
        // which ones that is comes from the packets' timestamps, read without
        // decoding. Converting every decoded frame and dropping most of them
        // cost far more than the decoding did.
        const keep = this.toHeld && trustPackets ? await this._lastTimestamps(key, timestamp) : null;
        let decodedInRange = 0;
        const kept = [];
        for await (const sample of this.sink.samples(key.timestamp, end)) {
            this.decodedFrames++;
            if (sample.timestamp > timestamp + SAME_INSTANT) { sample.close(); continue; }
            decodedInRange++;
            if (keep && !keep.has(Math.round(sample.timestamp * 1e6))) { sample.close(); continue; }
            if (this.toHeld) {
                try {
                    kept.push(await this.toHeld(sample));
                } finally {
                    sample.close();
                }
            } else {
                kept.push(sample);
            }
            if (kept.length > this.capacity) kept.shift().close();
        }
        if (this.closed) {
            for (const frame of kept) frame.close();
            return;
        }
        // Frames were decoded but none matched the packets' timestamps (a
        // container whose timing the two disagree on): decode again,
        // converting as it goes, rather than hold nothing and ask for ever.
        if (keep && kept.length === 0 && decodedInRange > 0) {
            return this._fill(timestamp, { trustPackets: false });
        }
        // Swapped in whole, so the old stretch stays drawable until the new
        // one is ready.
        const previous = this.held;
        this.held = kept;
        this.heldUntil = timestamp;
        for (const frame of previous) frame.close();
    }

    /**
     * The timestamps of the last `capacity` frames from `key` up to
     * `timestamp`, in microseconds, read from the packets alone.
     * @private
     */
    async _lastTimestamps(key, timestamp) {
        const stamps = [];
        for await (const packet of this.packets.packets(key, undefined, { metadataOnly: true })) {
            // Decode order runs a little ahead of presentation order (B-frames),
            // so read a couple of seconds past before stopping.
            if (packet.timestamp > timestamp + 2) break;
            if (packet.timestamp <= timestamp + SAME_INSTANT) stamps.push(packet.timestamp);
        }
        stamps.sort((a, b) => a - b);
        return new Set(stamps.slice(-this.capacity).map(t => Math.round(t * 1e6)));
    }
}

/**
 * Frames for a falling sequence of timestamps, with the stretch before the
 * current one decoded while the current one is being used -- for an export,
 * where the caller is busy encoding each frame and the decoder would
 * otherwise sit idle until it finished. Two readers take turns, as in reverse
 * playback; only one ever decodes at a time.
 *
 * Yields a VideoSample (or null before the first frame) per timestamp,
 * owned by the caller, exactly as samplesAtTimestamps does.
 *
 * @param {Object} videoTrack - a Mediabunny InputVideoTrack
 * @param {Iterable<number>|AsyncIterable<number>} timestamps - falling
 * @param {Object} [options] - passed to each BackwardFrameReader; `toHeld`
 *   must give VideoSamples (it is what gets cloned and handed out)
 */
export async function* backwardSamples(videoTrack, timestamps, options = {}) {
    const readers = [new BackwardFrameReader(videoTrack, options), new BackwardFrameReader(videoTrack, options)];
    let current = readers[0];
    const failed = [];
    // Nothing comes before the first frame, so nothing to decode ahead there.
    const first = await videoTrack.getFirstTimestamp().catch(() => 0);
    try {
        for await (const t of timestamps) {
            let other = current === readers[0] ? readers[1] : readers[0];
            if (current.peek(t) === undefined) {
                // The stretch decoded ahead is waited for, never decoded over.
                if (other.busy) await other.fill(t).catch(() => {});
                if (failed.length) throw failed[0];
                if (other.peek(t) !== undefined) {
                    [current, other] = [other, current];
                } else {
                    await current.fill(t);
                }
            }
            // The stretch before this one, decoded while this one is used.
            const oldest = current.oldest;
            if (oldest !== null && oldest > first + SAME_INSTANT
                && !other.busy && other.peek(oldest - SAME_INSTANT) === undefined) {
                other.fill(oldest - SAME_INSTANT).catch(error => failed.push(error));
            }
            const frame = current.peek(t);
            yield frame ? frame.clone() : await current.sink.getSample(t);
        }
    } finally {
        for (const reader of readers) reader.close();
    }
}
