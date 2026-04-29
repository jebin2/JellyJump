import { Logger } from "../../utils/Logger.js";
import { MediaBunny } from '../../core/MediaBunny.js';
import { AUDIO_BITRATE_BPS } from '../shared/InputFactory.js';


/**
 * Render one frame of a transition between two images onto ctx.
 * @private
 */
function renderTransitionFrame(ctx, bmA, bmB, rectA, rectB, progress, transType, w, h) {
    switch (transType) {
        case 'crossfade': {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = 1 - progress;
            ctx.drawImage(bmA, rectA.dx, rectA.dy, rectA.dw, rectA.dh);
            ctx.globalAlpha = progress;
            ctx.drawImage(bmB, rectB.dx, rectB.dy, rectB.dw, rectB.dh);
            ctx.globalAlpha = 1;
            break;
        }
        case 'slide-left':
        case 'slide-right':
        case 'slide-up':
        case 'slide-down': {
            const isH = transType === 'slide-left' || transType === 'slide-right';
            const dir = (transType === 'slide-left' || transType === 'slide-up') ? -1 : 1;
            const span = isH ? w : h;
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, w, h);
            ctx.clip();
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, w, h);
            const aOff = dir * progress * span;
            const bOff = -dir * (1 - progress) * span;
            if (isH) {
                ctx.drawImage(bmA, rectA.dx + aOff, rectA.dy, rectA.dw, rectA.dh);
                ctx.drawImage(bmB, rectB.dx + bOff, rectB.dy, rectB.dw, rectB.dh);
            } else {
                ctx.drawImage(bmA, rectA.dx, rectA.dy + aOff, rectA.dw, rectA.dh);
                ctx.drawImage(bmB, rectB.dx, rectB.dy + bOff, rectB.dw, rectB.dh);
            }
            ctx.restore();
            break;
        }
        case 'fade-to-black': {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, w, h);
            if (progress < 0.5) {
                ctx.globalAlpha = 1 - progress * 2;
                ctx.drawImage(bmA, rectA.dx, rectA.dy, rectA.dw, rectA.dh);
            } else {
                ctx.globalAlpha = (progress - 0.5) * 2;
                ctx.drawImage(bmB, rectB.dx, rectB.dy, rectB.dw, rectB.dh);
            }
            ctx.globalAlpha = 1;
            break;
        }
        case 'wipe-left':
        case 'wipe-right': {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, w, h);
            const { dx: adx, dy: ady, dw: adw, dh: adh } = rectA;
            ctx.drawImage(bmA, adx, ady, adw, adh);
            ctx.save();
            ctx.beginPath();
            if (transType === 'wipe-left') {
                ctx.rect(0, 0, progress * w, h);
            } else {
                ctx.rect((1 - progress) * w, 0, progress * w, h);
            }
            ctx.clip();
            ctx.drawImage(bmB, rectB.dx, rectB.dy, rectB.dw, rectB.dh);
            ctx.restore();
            break;
        }
        case 'zoom-out': {
            const shrink = 1 - progress;
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = shrink;
            ctx.drawImage(bmA,
                rectA.dx + rectA.dw * progress / 2,
                rectA.dy + rectA.dh * progress / 2,
                rectA.dw * shrink, rectA.dh * shrink);
            ctx.globalAlpha = progress;
            ctx.drawImage(bmB, rectB.dx, rectB.dy, rectB.dw, rectB.dh);
            ctx.globalAlpha = 1;
            break;
        }
        case 'flip': {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, w, h);
            const scaleX = progress < 0.5 ? 1 - 2 * progress : 2 * progress - 1;
            const { dx, dy, dw, dh } = progress < 0.5 ? rectA : rectB;
            ctx.save();
            ctx.translate(w / 2, h / 2);
            ctx.scale(scaleX, 1);
            ctx.translate(-w / 2, -h / 2);
            ctx.drawImage(progress < 0.5 ? bmA : bmB, dx, dy, dw, dh);
            ctx.restore();
            break;
        }
        case 'zoom': {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, w, h);
            ctx.globalAlpha = 1 - progress;
            ctx.drawImage(bmA, rectA.dx, rectA.dy, rectA.dw, rectA.dh);
            ctx.globalAlpha = progress;
            ctx.drawImage(bmB, rectB.dx, rectB.dy, rectB.dw, rectB.dh);
            ctx.globalAlpha = 1;
            break;
        }
        default: {
            // Fallback: cut to next image
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(bmB, rectB.dx, rectB.dy, rectB.dw, rectB.dh);
        }
    }
}

/**
 * Write looped/trimmed audio from audioBlob into audioSource for totalDuration seconds.
 * @private
 */
async function addSlideshowAudio(audioSource, audioBlob, totalDuration, audioStartTime, audioEndTime, audioLoop) {
    const audioContext = new AudioContext();
    try {
        Logger.log('[SlideshowService] Adding background music...');
        const arrayBuffer = await audioBlob.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const sampleRate = audioBuffer.sampleRate;
        const numChannels = audioBuffer.numberOfChannels;
        const trackDur = audioBuffer.duration;

        const trimStart = Math.max(0, audioStartTime);
        const trimEnd = Math.min(audioEndTime !== null ? audioEndTime : trackDur, trackDur);

        if (trimEnd <= trimStart) return;

        let outputTs = 0;
        let passStart = trimStart;

        while (outputTs < totalDuration) {
            const remaining = totalDuration - outputTs;
            const chunkDur = Math.min(trimEnd - passStart, remaining);
            if (chunkDur <= 0) break;

            const startSample = Math.floor(passStart * sampleRate);
            const chunkSamples = Math.ceil(chunkDur * sampleRate);
            const endSample = Math.min(startSample + chunkSamples, audioBuffer.length);
            const actualSamples = endSample - startSample;
            if (actualSamples <= 0) break;

            const chunkBuffer = audioContext.createBuffer(numChannels, actualSamples, sampleRate);
            for (let ch = 0; ch < numChannels; ch++) {
                const src = audioBuffer.getChannelData(ch);
                chunkBuffer.getChannelData(ch).set(src.subarray(startSample, endSample));
            }

            const samples = MediaBunny.AudioSample.fromAudioBuffer(chunkBuffer, outputTs);
            const samplesArr = Array.isArray(samples) ? samples : [samples];
            for (const sample of samplesArr) {
                await audioSource.add(sample);
                sample.close();
            }

            outputTs += chunkDur;
            passStart += chunkDur;

            if (passStart >= trimEnd) {
                if (!audioLoop) break;
                passStart = trimStart;
            }
        }
    } finally {
        await audioContext.close();
    }
}

/**
 * Create a slideshow MP4 video from a list of images.
 * @param {Object} options
 * @param {Blob[]|File[]} options.imageBlobs - Ordered list of image files
 * @param {number[]} options.imageDurations - Duration in seconds for each image
 * @param {string} [options.transition='cut'] - 'cut'|'crossfade'|'slide-left'|'slide-right'|'slide-up'|'slide-down'|'fade-to-black'|'wipe-left'|'wipe-right'|'zoom'|'zoom-out'|'flip'
 * @param {number} [options.transitionDuration=0.5] - Transition duration in seconds
 * @param {Blob|File|null} [options.audioBlob] - Optional background music
 * @param {boolean} [options.audioLoop=true] - Loop audio to fill video duration
 * @param {number} [options.audioStartTime=0] - Trim start in seconds
 * @param {number} [options.audioEndTime] - Trim end in seconds (defaults to full duration)
 * @param {number} [options.fps=30] - Output frame rate
 * @param {Function} [options.onProgress] - Progress callback (0-1)
 * @returns {Promise<Blob>}
 */
export async function createSlideshowVideo({
    imageBlobs,
    imageDurations,
    transition = 'cut',
    transitionDuration = 0.5,
    audioBlob = null,
    audioLoop = true,
    audioStartTime = 0,
    audioEndTime = null,
    fps = 30,
    onProgress
}) {
    Logger.log('[SlideshowService] createSlideshowVideo start', { count: imageBlobs.length, transition, fps });

    let output = null;
    let canvasSource = null;
    let audioSource = null;

    try {
        // Step 1: Load all images as ImageBitmap
        const bitmaps = await Promise.all(imageBlobs.map(b => createImageBitmap(b)));

        // Determine canvas size (max dimensions, rounded to even)
        let canvasW = 0;
        let canvasH = 0;
        for (const bm of bitmaps) {
            canvasW = Math.max(canvasW, bm.width);
            canvasH = Math.max(canvasH, bm.height);
        }
        canvasW = canvasW % 2 === 0 ? canvasW : canvasW + 1;
        canvasH = canvasH % 2 === 0 ? canvasH : canvasH + 1;
        if (canvasW === 0 || canvasH === 0) throw new Error('Images have zero dimensions');

        Logger.log(`[SlideshowService] Canvas: ${canvasW}x${canvasH}`);

        // Effective transition duration: only if transition !== cut and at least 2 images
        const useTransition = transition !== 'cut' && bitmaps.length > 1;
        const transDur = useTransition ? transitionDuration : 0;
        const frameDur = 1 / fps;

        // Total video duration
        let totalDuration = 0;
        for (let i = 0; i < bitmaps.length; i++) {
            const dur = imageDurations[i] || 3;
            totalDuration += dur;
            if (i < bitmaps.length - 1) totalDuration += transDur;
        }

        // Step 2: Setup output
        output = new MediaBunny.Output({
            format: new MediaBunny.Mp4OutputFormat(),
            target: new MediaBunny.BufferTarget()
        });

        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');

        canvasSource = new MediaBunny.CanvasSource(canvas, {
            codec: 'avc',
            bitrate: MediaBunny.QUALITY_HIGH,
        });
        output.addVideoTrack(canvasSource);

        // Step 3: Optional audio
        if (audioBlob) {
            try {
                const supportedCodecs = await MediaBunny.getEncodableAudioCodecs(['aac', 'opus', 'mp3']);
                if (supportedCodecs.length > 0) {
                    audioSource = new MediaBunny.AudioSampleSource({
                        codec: supportedCodecs[0],
                        bitrate: AUDIO_BITRATE_BPS
                    });
                    output.addAudioTrack(audioSource);
                }
            } catch (e) {
                Logger.warn('[SlideshowService] Failed to set up audio for slideshow, skipping:', e);
                audioSource = null;
            }
        }

        await output.start();

        // Step 4: Render frames
        let outputTimestamp = 0;
        let totalFramesRendered = 0;
        const totalFrames = Math.ceil(totalDuration * fps);

        // Returns centered draw rect for a bitmap at optional scale factor
        const getCenteredRect = (bm, w, h, scaleFactor = 1) => {
            const scale = Math.min(w / bm.width, h / bm.height) * scaleFactor;
            const dw = bm.width * scale;
            const dh = bm.height * scale;
            return { dx: (w - dw) / 2, dy: (h - dh) / 2, dw, dh };
        };

        const drawImageCentered = (ctx, bm, w, h) => {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, w, h);
            const { dx, dy, dw, dh } = getCenteredRect(bm, w, h);
            ctx.drawImage(bm, dx, dy, dw, dh);
        };

        const isZoom = transition === 'zoom';

        for (let i = 0; i < bitmaps.length; i++) {
            const imgDuration = imageDurations[i] || 3;
            const staticFrames = Math.round(imgDuration * fps);
            const bmA = bitmaps[i];
            const kbBaseScale = isZoom ? Math.min(canvasW / bmA.width, canvasH / bmA.height) : 0;

            // Static frames
            for (let f = 0; f < staticFrames; f++) {
                if (isZoom) {
                    const progress = f / Math.max(staticFrames - 1, 1);
                    const scale = kbBaseScale * (1 + progress * 0.06);
                    const dw = bmA.width * scale;
                    const dh = bmA.height * scale;
                    ctx.fillStyle = '#000000';
                    ctx.fillRect(0, 0, canvasW, canvasH);
                    ctx.drawImage(bmA, (canvasW - dw) / 2, (canvasH - dh) / 2, dw, dh);
                } else {
                    drawImageCentered(ctx, bmA, canvasW, canvasH);
                }
                await canvasSource.add(outputTimestamp, frameDur);
                outputTimestamp += frameDur;
                totalFramesRendered++;
                if (onProgress) onProgress(totalFramesRendered / totalFrames * 0.85);
            }

            // Transition to next image
            if (useTransition && i < bitmaps.length - 1) {
                const bmB = bitmaps[i + 1];
                const rectA = getCenteredRect(bmA, canvasW, canvasH, isZoom ? 1.06 : 1);
                const rectB = getCenteredRect(bmB, canvasW, canvasH);
                const transFrames = Math.round(transDur * fps);
                for (let f = 0; f < transFrames; f++) {
                    const progress = transFrames > 1 ? f / (transFrames - 1) : 1;
                    renderTransitionFrame(ctx, bmA, bmB, rectA, rectB, progress, transition, canvasW, canvasH);
                    await canvasSource.add(outputTimestamp, frameDur);
                    outputTimestamp += frameDur;
                    totalFramesRendered++;
                    if (onProgress) onProgress(totalFramesRendered / totalFrames * 0.85);
                }
            }
        }

        Logger.log(`[SlideshowService] Rendered ${totalFramesRendered} frames, total ts: ${outputTimestamp.toFixed(3)}s`);

        // Step 5: Audio
        if (audioSource && audioBlob) {
            try {
                await addSlideshowAudio(audioSource, audioBlob, totalDuration, audioStartTime, audioEndTime, audioLoop);
            } catch (e) {
                Logger.warn('[SlideshowService] Audio processing failed for slideshow:', e);
            }
        }

        // Step 6: Finalize
        canvasSource.close();
        if (audioSource) audioSource.close();
        await output.finalize();

        if (onProgress) onProgress(1.0);

        Logger.log('[SlideshowService] Slideshow complete!');
        return new Blob([output.target.buffer], { type: 'video/mp4' });

    } finally {
        if (output && typeof output.dispose === 'function') {
            try { output.dispose(); } catch (e) { Logger.warn('Error disposing output:', e); }
        }
        if (canvasSource && typeof canvasSource.dispose === 'function') {
            try { canvasSource.dispose(); } catch (e) { Logger.warn('Error disposing canvasSource:', e); }
        }
        if (audioSource && typeof audioSource.dispose === 'function') {
            try { audioSource.dispose(); } catch (e) { Logger.warn('Error disposing audioSource:', e); }
        }
    }
}
