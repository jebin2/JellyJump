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
 * Which is why the frames come from playing the clip and drawing it, rather
 * than from the demuxer the player uses. Measured on a transparent VP8 WebM:
 * MediaBunny's CanvasSink returned every frame correctly and 100% opaque --
 * the alpha channel does not survive it -- while drawing the same clip from a
 * <video> gave 71.7% clear and 28.3% partial alpha, soft edges intact. The
 * slower route is the one that keeps the thing we want.
 */

/** Longer clips are refused rather than quietly truncated. */
const MAX_STICKER_SECONDS = 30;

/**
 * Played faster than real time, since capture is per presented frame and a
 * short clip loses nothing by it: measured, 4x returned the same frame count
 * as 1x. It only bounds how long the wait can get.
 */
const CAPTURE_RATE = 4;

/** A stuck decode must not hang the caller for ever. */
const CAPTURE_TIMEOUT_MS = 20000;

/**
 * @param {Blob} blob - a video file; WebM if it is to keep transparency
 * @param {number} frameWidth - the width of the video frame, in canvas px
 * @returns {Promise<AnimatedImage>}
 * @throws {Error} with a message meant for the user
 */
export async function decodeVideoSticker(blob, frameWidth) {
    if (!('requestVideoFrameCallback' in HTMLVideoElement.prototype)) {
        throw new Error('This browser cannot take a clip as a sticker. An image or GIF will work.');
    }

    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(blob);

    try {
        video.src = objectUrl;
        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';

        await new Promise((resolve, reject) => {
            video.onloadeddata = resolve;
            video.onerror = () => reject(new Error('That clip could not be opened.'));
        });

        const { videoWidth: width, videoHeight: height, duration } = video;
        if (!width || !height) throw new Error('That file has no video track in it.');
        if (!(duration > 0) || !Number.isFinite(duration)) throw new Error('That clip has no length.');
        if (duration > MAX_STICKER_SECONDS) {
            throw new Error(
                `That clip is ${Math.round(duration)}s. Trim it under ${MAX_STICKER_SECONDS}s to use it as a sticker.`,
            );
        }

        // The same budget a GIF gets, for the same reason: the cost is frames
        // times width times height, and a video is long in the first of those.
        // The frame count is not known before playing, so it is estimated high
        // enough that the plan errs towards holding less.
        const plan = decodePlan({
            frameCount: Math.max(1, Math.round(duration * 30)), width, height, frameWidth,
        });
        const targetWidth = Math.max(1, Math.round(width * plan.scale));
        const targetHeight = Math.max(1, Math.round(height * plan.scale));

        const scratch = document.createElement('canvas');
        scratch.width = width;
        scratch.height = height;
        // Alpha is why this exists, so the frame must not land on a white bed.
        const ctx = scratch.getContext('2d', { alpha: true });

        const frames = [];
        const times = [];
        let index = 0;

        video.playbackRate = CAPTURE_RATE;
        await video.play().catch(() => { /* capture below fails honestly if it did not start */ });

        await new Promise((resolve) => {
            const stop = () => resolve();
            const guard = setTimeout(stop, CAPTURE_TIMEOUT_MS);
            video.addEventListener('ended', () => { clearTimeout(guard); stop(); }, { once: true });

            const onFrame = async (_now, meta) => {
                if (index++ % plan.keepEvery === 0) {
                    ctx.clearRect(0, 0, width, height);
                    ctx.drawImage(video, 0, 0);
                    frames.push(await createImageBitmap(scratch, {
                        resizeWidth: targetWidth,
                        resizeHeight: targetHeight,
                        resizeQuality: 'medium',
                    }));
                    times.push(meta.mediaTime);
                }
                if (video.ended) { clearTimeout(guard); stop(); return; }
                video.requestVideoFrameCallback(onFrame);
            };
            video.requestVideoFrameCallback(onFrame);
        });

        video.pause();
        if (frames.length === 0) throw new Error('No frames could be read from that clip.');

        // Timings come from the frames themselves, not a nominal rate: a
        // browser recording is variable-rate, and this keeps its real timing.
        const durations = times.map((t, i) => {
            const next = i + 1 < times.length ? times[i + 1] : duration;
            return Math.max(1, (next - t) * 1000);
        });

        return new AnimatedImage(frames, durations);
    } finally {
        video.pause();
        video.removeAttribute('src');
        video.load();
        URL.revokeObjectURL(objectUrl);
    }
}
