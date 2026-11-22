import GIF from '../../lib/gif.js';
import { MediaBunny } from '../../shared/media/MediaBunny.js';
import { createMediaBunnyInput } from '../../shared/media/InputFactory.js';
import { throwIfCancelled, cancelledError } from '../../shared/utils/Cancellation.js';

export async function createGif(options) {
    const {
        input,
        startTime,
        duration,
        fps,
        width,
        height,
        quality,
        onProgress,
        signal,
    } = options;

    // Frames are decoded by Mediabunny rather than by seeking a <video>
    // element: each one is the frame at that exact timestamp instead of
    // wherever the element's seek landed, and any file the player can open
    // works here too, including codecs and containers the browser itself
    // cannot play.
    const mediaInput = createMediaBunnyInput(input);

    try {
        const videoTrack = await mediaInput.getPrimaryVideoTrack();
        if (!videoTrack) throw new Error('That file has no video track in it.');
        if (!(await videoTrack.canDecode())) throw new Error('This video cannot be decoded in this browser.');

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const gif = new GIF({
            workers: 2,
            quality: Math.max(1, Math.round((100 - quality) / 10)),
            workerScript: 'assets/js/lib/gif.worker.js',
            width,
            height
        });

        const frameDelay = Math.round(1000 / fps);
        const totalFrames = Math.ceil(duration * fps);
        const frameInterval = duration / totalFrames;

        // startTime is on the player's timeline, which is the file's own
        // timestamps, so it is used as given.
        const sink = new MediaBunny.CanvasSink(videoTrack, { width, height, fit: 'fill' });
        const timestamps = Array.from({ length: totalFrames }, (_, i) => startTime + i * frameInterval);

        let framesProcessed = 0;
        let hasFrame = false;

        for await (const wrapped of sink.canvasesAtTimestamps(timestamps)) {
            throwIfCancelled(signal);
            // null is a timestamp before the first frame; the previous frame,
            // if there is one, is held for it, as a seek would have shown.
            if (wrapped) {
                ctx.drawImage(wrapped.canvas, 0, 0, width, height);
                hasFrame = true;
            }
            if (hasFrame) gif.addFrame(canvas, { delay: frameDelay, copy: true });
            framesProcessed++;

            if (onProgress) {
                onProgress(framesProcessed / totalFrames * 0.5);
            }
        }

        if (!hasFrame) throw new Error('No frames could be read from that part of the video.');

        return new Promise((resolve, reject) => {
            gif.on('finished', (blob) => {
                if (onProgress) onProgress(1.0);
                resolve(blob);
            });

            gif.on('progress', (p) => {
                if (onProgress) {
                    onProgress(0.5 + (p * 0.5));
                }
            });

            gif.on('error', reject);
            // Encoding runs in gif.js's own workers; abort() stops them.
            signal?.addEventListener('abort', () => {
                gif.abort();
                reject(cancelledError());
            }, { once: true });
            gif.render();
        });
    } finally {
        mediaInput.dispose();
    }
}
