import { Logger } from '../../shared/utils/Logger.js';
import { MediaBunny } from '../../core/MediaBunny.js';
import { buildFrameProcessor } from '../frame/FrameProcessorService.js';

/**
 * AlphaRecorder - the transparent export, encoded through MediaRecorder.
 *
 * The rest of the app converts through MediaBunny, which encodes with
 * WebCodecs. That path cannot carry transparency, and not because of a missing
 * option: Chrome's VideoEncoder reports `alpha: 'keep'` unsupported for vp8,
 * vp9 profile 0 and vp9 profile 2 alike, so the encoder config's own
 * `?? "discard"` default is the only value that works. Before this, choosing
 * "transparent" gave an opaque file with the keyed area flattened to black --
 * measured: 0% transparent pixels, corner rgba(0,0,0,255).
 *
 * MediaRecorder is a different encoder inside Chrome and does keep alpha:
 * recording a canvas with transparency and reading it back gave 72.5% fully
 * clear and 27.5% partial alpha, soft edges intact.
 *
 * What it costs, and why the rest of the app is not moved onto it: it encodes
 * in real time. Frames are paced to the source's own timing because
 * MediaRecorder timestamps by wall clock, so a clip takes about its own
 * duration to export. Faster would mean a file that plays fast.
 */

/** VP8 first: it is the codec measured to carry alpha through MediaRecorder. */
const CANDIDATE_TYPES = [
    'video/webm;codecs=vp8',
    'video/webm;codecs=vp9',
    'video/webm',
];

/**
 * @param {Object} options
 * @returns {Promise<Blob>} a WebM whose keyed-out areas are genuinely transparent
 */
export async function recordTransparentWebM({
    input, videoTrack, width, height, nativeRotation = 0,
    removeBackgroundOptions, watermarkItems, watermarkImages, blur,
    firstTimestamp = 0, onProgress,
}) {
    if (typeof MediaRecorder === 'undefined') {
        throw new Error('This browser cannot export a transparent video.');
    }
    const mimeType = CANDIDATE_TYPES.find(t => MediaRecorder.isTypeSupported(t));
    if (!mimeType) throw new Error('This browser cannot record WebM.');

    const duration = await input.computeDuration();
    if (!(duration > 0)) throw new Error('That video has no length.');

    let fps = 30;
    try {
        fps = (await videoTrack.computePacketStats(50)).averagePacketRate || 30;
    } catch {
        // Only used for pacing and progress; 30 is a fair guess when the
        // container will not say.
    }

    const totalFrames = Math.max(1, Math.round(duration * fps));
    const frameInterval = 1000 / fps;

    const process = buildFrameProcessor({
        removeBackgroundOptions, watermarkItems, watermarkImages, blur,
        rotate: 0, flip: null, nativeRotation,
        originalWidth: width, originalHeight: height, firstTimestamp,
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    // Alpha is the entire point of this path.
    const ctx = canvas.getContext('2d', { alpha: true });

    // Sampled at the source's rate rather than driven frame by frame. A
    // zero-rate stream with requestFrame() looks tidier and put Chrome's
    // recorder into "an illegal state" on every attempt; this is the shape
    // that was measured to work and to keep alpha.
    const stream = canvas.captureStream(fps);
    const [streamTrack] = stream.getVideoTracks();

    // No bitrate hint: the same measured-working recipe left it to the
    // browser, and a hint derived from a source with no measurable bitrate is
    // a guess offered as a fact.
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

    const finished = new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = (e) => reject(e.error || new Error('Recording failed.'));
    });

    Logger.log(`[AlphaRecorder] ${width}x${height} @ ${fps.toFixed(1)}fps as ${mimeType}`);

    const sink = new MediaBunny.VideoSampleSink(videoTrack);
    const timestamps = (async function* () {
        for (let i = 0; i < totalFrames; i++) yield firstTimestamp + (i / fps);
    })();

    const startedAt = performance.now();
    let index = 0;

    try {
        for await (const sample of sink.samplesAtTimestamps(timestamps)) {
            if (!sample) continue;

            const processed = process(sample);
            ctx.clearRect(0, 0, width, height);
            ctx.drawImage(processed, 0, 0, width, height);
            sample.close();

            // Started once the canvas holds a frame, so the stream has
            // something to describe when the encoder configures itself.
            if (recorder.state === 'inactive') recorder.start();
            index++;
            onProgress?.(Math.min(0.99, index / totalFrames));

            // Paced to the source's timing, because MediaRecorder stamps
            // frames by wall clock: pushing them as fast as they decode would
            // produce a correct-looking file that plays many times too fast.
            const due = startedAt + index * frameInterval;
            const wait = due - performance.now();
            if (wait > 0) await new Promise(r => setTimeout(r, wait));
        }
    } finally {
        // A frame already drawn must reach the recorder before it closes.
        await new Promise(r => setTimeout(r, frameInterval));
        if (recorder.state !== 'inactive') recorder.stop();
        streamTrack.stop();
    }

    await finished;
    onProgress?.(1);

    if (chunks.length === 0) throw new Error('Nothing was recorded.');
    return new Blob(chunks, { type: 'video/webm' });
}
