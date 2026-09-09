/**
 * AnimatedImage - an image that can be drawn onto a canvas, animated ones
 * included.
 *
 * `ctx.drawImage(imgElement)` cannot do this. An <img> with an animated GIF
 * animates on screen, but the canvas takes its first frame and only its first
 * frame: measured in Chromium, 452 draws across three seconds returned one
 * single frame while element screenshots over the same period showed six
 * distinct ones. A sticker drawn that way is frozen, in the preview and in
 * the recording alike.
 *
 * So the frames are decoded up front through WebCodecs' ImageDecoder and held
 * as ImageBitmaps. They are decoded **at the size they will be drawn**, not at
 * source size -- nine 512x512 frames to paint a 128px sticker is 9MB held to
 * show 590KB of it -- and every bitmap is closed on destroy.
 */

/**
 * Frames are decoded at this fraction of the frame's width, capped at the
 * source's own size. Not at the sticker's current size: that is something the
 * user drags, and re-decoding on every resize is exactly the work this avoids.
 * Bounding it by the frame instead keeps the memory predictable — a sticker up
 * to this share of the picture is pixel-exact, and a bigger one is soft rather
 * than expensive.
 */
const DECODE_FRACTION = 0.5;

/**
 * The ceiling on what one animation may hold, decoded.
 *
 * Width alone is not a memory bound: the cost is frames x width x height, and
 * a tall GIF with a long loop sails past a width cap untouched. A real
 * 270x480 GIF of 103 frames is 259KB on disk and 53MB decoded -- and because
 * it is narrower than the width cap, the cap did nothing at all.
 */
const MAX_DECODED_BYTES = 16 * 1024 * 1024;

/**
 * Resolution is given up before frames are: a sticker is small on screen, so
 * softness is much less visible than a stutter. Below this width it stops
 * shrinking and starts dropping frames instead.
 */
const MIN_DECODE_WIDTH = 96;

/** A frame with no stated duration. GIF's own default is 100ms. */
const DEFAULT_FRAME_MS = 100;

/**
 * How to decode an animation so that it fits the budget.
 *
 * Pure arithmetic, kept apart from the decoding so the policy can be tested
 * against awkward real files without a decoder.
 *
 * @param {{frameCount: number, width: number, height: number, frameWidth: number}} source
 * @returns {{scale: number, keepEvery: number, frames: number, bytes: number}}
 */
export function decodePlan({ frameCount, width, height, frameWidth }) {
    const bytesAt = (scale, frames) =>
        Math.max(1, Math.round(width * scale)) * Math.max(1, Math.round(height * scale)) * 4 * frames;

    // Start from the width cap, which is about looking right rather than fitting.
    let scale = Math.min(1, (frameWidth * DECODE_FRACTION) / width);

    // Then shrink -- but only to the point where a sticker would start to look
    // bad. Past that, frames are the cheaper thing to give up.
    if (bytesAt(scale, frameCount) > MAX_DECODED_BYTES) {
        const fitting = Math.sqrt(MAX_DECODED_BYTES / (width * height * 4 * frameCount));
        scale = Math.min(scale, Math.max(fitting, MIN_DECODE_WIDTH / width), 1);
    }

    // Still over: keep every nth frame.
    let keepEvery = 1;
    while (keepEvery < frameCount
        && bytesAt(scale, Math.ceil(frameCount / keepEvery)) > MAX_DECODED_BYTES) {
        keepEvery++;
    }

    const frames = Math.ceil(frameCount / keepEvery);
    return { scale, keepEvery, frames, bytes: bytesAt(scale, frames) };
}

export class AnimatedImage {
    /**
     * @param {ImageBitmap[]} frames
     * @param {number[]} durations - ms per frame, same length as frames
     */
    constructor(frames, durations) {
        this.frames = frames;
        this.durations = durations;
        this.totalMs = durations.reduce((a, b) => a + b, 0);
        this.width = frames[0]?.width || 0;
        this.height = frames[0]?.height || 0;
    }

    get animated() { return this.frames.length > 1; }

    /**
     * Decode a still or animated image.
     *
     * @param {Blob} blob
     * @param {number} frameWidth - the width of the video frame, in canvas px
     * @returns {Promise<AnimatedImage>}
     */
    static async load(blob, frameWidth) {
        const still = async () => {
            const bitmap = await createImageBitmap(blob);
            return new AnimatedImage([bitmap], [DEFAULT_FRAME_MS]);
        };

        // Every animated format arrives through the same door, so this is not
        // a GIF special case; a still PNG simply decodes to one frame.
        if (typeof ImageDecoder === 'undefined') return still();

        let decoder;
        try {
            decoder = new ImageDecoder({ data: await blob.arrayBuffer(), type: blob.type });
            await decoder.tracks.ready;
            await decoder.completed;

            const track = decoder.tracks.selectedTrack;
            if (!track || track.frameCount <= 1) return still();

            // Decoded once to learn the source's size, which the track does
            // not carry and the plan needs.
            const first = await decoder.decode({ frameIndex: 0 });
            const plan = decodePlan({
                frameCount: track.frameCount,
                width: first.image.displayWidth,
                height: first.image.displayHeight,
                frameWidth,
            });
            const resizeWidth = Math.max(1, Math.round(first.image.displayWidth * plan.scale));
            const resizeHeight = Math.max(1, Math.round(first.image.displayHeight * plan.scale));
            first.image.close();

            const frames = [];
            const durations = [];
            let carried = 0;
            for (let i = 0; i < track.frameCount; i++) {
                const { image } = await decoder.decode({ frameIndex: i });
                // VideoFrame durations are microseconds, and may be absent.
                const ms = image.duration ? image.duration / 1000 : DEFAULT_FRAME_MS;
                try {
                    if (i % plan.keepEvery !== 0) {
                        // Dropped, but its time is not: it is carried onto the
                        // frame that is kept, so the loop still runs to length.
                        carried += ms;
                        continue;
                    }
                    frames.push(await createImageBitmap(image, {
                        resizeWidth, resizeHeight, resizeQuality: 'medium',
                    }));
                    durations.push(ms + carried);
                    carried = 0;
                } finally {
                    image.close();
                }
            }
            if (carried > 0 && durations.length > 0) durations[durations.length - 1] += carried;

            return new AnimatedImage(frames, durations);
        } catch {
            // A format ImageDecoder will not take is still worth showing as a
            // still, which is what the browser would have given us anyway.
            return still();
        } finally {
            decoder?.close();
        }
    }

    /**
     * The frame to show at a wall-clock time. Driven by the caller's clock
     * rather than its own timer, so the frames drawn are the frames recorded.
     * @param {number} nowMs
     * @returns {ImageBitmap}
     */
    frameAt(nowMs) {
        if (this.frames.length === 1 || this.totalMs <= 0) return this.frames[0];
        let t = nowMs % this.totalMs;
        for (let i = 0; i < this.frames.length; i++) {
            t -= this.durations[i];
            if (t < 0) return this.frames[i];
        }
        return this.frames[this.frames.length - 1];
    }

    /** Releases every decoded frame. Nothing here survives it. */
    destroy() {
        for (const frame of this.frames) frame.close?.();
        this.frames = [];
        this.durations = [];
        this.totalMs = 0;
    }
}
