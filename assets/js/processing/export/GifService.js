import GIF from '../../lib/gif.js';

export async function createGif(options) {
    const {
        input,
        startTime,
        duration,
        fps,
        width,
        height,
        quality,
        onProgress
    } = options;

    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;

    const videoUrl = URL.createObjectURL(input);
    video.src = videoUrl;

    try {
        await new Promise((resolve, reject) => {
            video.onloadedmetadata = resolve;
            video.onerror = reject;
        });

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

        let framesProcessed = 0;

        for (let i = 0; i < totalFrames; i++) {
            const currentTime = startTime + (i * frameInterval);

            video.currentTime = currentTime;
            await new Promise(resolve => {
                video.onseeked = resolve;
            });

            ctx.drawImage(video, 0, 0, width, height);
            gif.addFrame(canvas, { delay: frameDelay, copy: true });
            framesProcessed++;

            if (onProgress) {
                onProgress(framesProcessed / totalFrames * 0.5);
            }
        }

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
            gif.render();
        });
    } finally {
        URL.revokeObjectURL(videoUrl);
        video.src = '';
        video.load();
    }
}
