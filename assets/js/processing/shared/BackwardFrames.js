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
     */
    constructor(videoTrack, { decoderOptions } = {}) {
        this.track = videoTrack;
        this.sink = new MediaBunny.VideoSampleSink(videoTrack, decoderOptions);
        this.packets = new MediaBunny.EncodedPacketSink(videoTrack);
        const frameBytes = Math.max(1, (videoTrack.codedWidth || 1920) * (videoTrack.codedHeight || 1080) * 1.5);
        this.capacity = Math.max(4, Math.min(MAX_HELD_FRAMES, Math.floor(MAX_HELD_BYTES / frameBytes)));
        /** Frames held, ascending by timestamp, all at or before `heldUntil`. */
        this.held = [];
        this.heldUntil = -Infinity;
        this.heldKey = null;
        /** How many frames have been decoded, for the curious. */
        this.decodedFrames = 0;
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
            await this._fill(timestamp);
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

    /** Release every held frame. */
    close() {
        for (const frame of this.held) frame.close();
        this.held = [];
        this.heldUntil = -Infinity;
        this.heldKey = null;
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
    async _fill(timestamp) {
        this.close();
        const key = await this.packets.getKeyPacket(timestamp, { metadataOnly: true })
            ?? await this.packets.getFirstPacket({ metadataOnly: true });
        if (!key) return;

        // Up to and including the frame at `timestamp`; a little past it,
        // since the range's end is exclusive.
        const end = timestamp + 2 * SAME_INSTANT;
        const kept = [];
        for await (const sample of this.sink.samples(key.timestamp, end)) {
            this.decodedFrames++;
            if (sample.timestamp > timestamp + SAME_INSTANT) { sample.close(); continue; }
            kept.push(sample);
            if (kept.length > this.capacity) kept.shift().close();
        }
        this.held = kept;
        this.heldUntil = timestamp;
        this.heldKey = key.timestamp;
    }
}
