// @ts-check
import { AnimatedImage, decodePlan } from './AnimatedImage.js';

/**
 * VideoFrames - turns a short video into an animated sticker.
 *
 * Frames are decoded once, up front, into the same AnimatedImage every other
 * sticker uses -- after which the clock, the motions, the recording and the
 * screenshot compositing all work with no knowledge that this one came from a
 * video. A <video> element left playing behind the scenes would undo the
 * property the rest of this is built on: overlays run on the *video's*
 * timeline, so that seeking takes them back with you and a screenshot catches
 * what was on screen. A sticker playing on wall time would not.
 *
 * Alpha is the whole point -- a transparent WebM is what the app's own Remove
 * Background produces (TranscodeService forces WebM precisely because it
 * carries alpha), so this closes the loop: cut a clip out, put it back on
 * another video as a sticker.
 *
 * Frames come from Mediabunny's CanvasSink with `alpha: true`. Without that
 * option the sink draws onto a black bed, which is what an earlier
 * measurement saw and took to mean the alpha could not survive it. With it,
 * transparent VP8 and VP9 WebMs come back with the same clear and partial
 * coverage a <video> element shows. Decoding this way is not tied to
 * playback, so every frame is read and it takes as long as decoding does,
 * not as long as the clip runs.
 */

/** Longer clips are refused rather than quietly truncated. */
const MAX_STICKER_SECONDS = 30;

/**
 * @param {Blob} blob - a video file; WebM if it is to keep transparency
 * @param {number} frameWidth - the width of the video frame, in canvas px
 * @returns {Promise<AnimatedImage>}
 * @throws {Error} with a message meant for the user
 */
export async function decodeVideoSticker(blob, frameWidth) {
    // Loaded here rather than at the top: StickerLayer imports this module for
    // every sticker, and most are images that never need a decoder.
    const { MediaBunny } = await import('../media/MediaBunny.js');
    const input = new MediaBunny.Input({
        source: new MediaBunny.BlobSource(blob),
        formats: MediaBunny.ALL_FORMATS,
    });

    try {
        let track;
        let duration;
        try {
            track = await input.getPrimaryVideoTrack();
            duration = track ? await input.computeDuration() : 0;
        } catch {
            throw new Error('That clip could not be opened.');
        }

        if (!track) throw new Error('That file has no video track in it.');
        if (!(await track.canDecode())) {
            throw new Error('This browser cannot take that clip as a sticker. An image or GIF will work.');
        }
        if (!(duration > 0) || !Number.isFinite(duration)) throw new Error('That clip has no length.');
        if (duration > MAX_STICKER_SECONDS) {
            throw new Error(
                `That clip is ${Math.round(duration)}s. Trim it under ${MAX_STICKER_SECONDS}s to use it as a sticker.`,
            );
        }

        const width = track.displayWidth;
        const height = track.displayHeight;

        // Every frame's timestamp, read from the packets without decoding
        // anything. Sorted, because packets come in decode order.
        const stamps = [];
        /** @type {any} vendored MediaBunny, not type-checked */
        const packetSink = new MediaBunny.EncodedPacketSink(track);
        for await (const packet of packetSink.packets(undefined, undefined, { metadataOnly: true })) {
            stamps.push(packet.timestamp);
        }
        stamps.sort((a, b) => a - b);
        if (stamps.length === 0) throw new Error('No frames could be read from that clip.');

        // The same budget a GIF gets, for the same reason: the cost is frames
        // times width times height, and a video is long in the first of those.
        const frameCount = stamps.length;
        const plan = decodePlan({ frameCount, width, height, frameWidth });
        const targetWidth = Math.max(1, Math.round(width * plan.scale));
        const targetHeight = Math.max(1, Math.round(height * plan.scale));

        const sink = new MediaBunny.CanvasSink(track, {
            width: targetWidth,
            height: targetHeight,
            fit: 'fill',
            alpha: true,
        });

        /** @type {ImageBitmap[]} */
        const frames = [];
        /** @type {number[]} */
        const times = [];
        const firstTimestamp = stamps[0];
        // Only the frames being kept are asked for, so the ones dropped are
        // decoded (the decoder needs them) but never drawn.
        const kept = stamps.filter((_, i) => i % plan.keepEvery === 0);

        try {
            for await (const wrapped of sink.canvasesAtTimestamps(kept)) {
                if (!wrapped) continue;
                frames.push(await createImageBitmap(wrapped.canvas));
                times.push(wrapped.timestamp - firstTimestamp);
            }
        } catch (error) {
            for (const frame of frames) frame.close?.();
            throw new Error('No frames could be read from that clip.', { cause: error });
        }

        if (frames.length === 0) throw new Error('No frames could be read from that clip.');

        // Timings come from the frames themselves, not a nominal rate: a
        // browser recording is variable-rate, and this keeps its real timing.
        const durations = times.map((t, i) => {
            const next = i + 1 < times.length ? times[i + 1] : duration - firstTimestamp;
            return Math.max(1, (next - t) * 1000);
        });

        const sticker = new AnimatedImage(frames, durations);
        // Read from the file's own flags, nothing decoded: a clip that cannot
        // carry alpha will sit on the video as a solid rectangle, which is
        // worth saying before someone wonders where the cut-out went.
        sticker.opaque = !(await track.canBeTransparent().catch(() => false));
        return sticker;
    } finally {
        input.dispose();
    }
}
