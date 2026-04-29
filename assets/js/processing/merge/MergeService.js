import { Logger } from "../../shared/utils/Logger.js";
import { MediaBunny } from '../../core/MediaBunny.js';
import { AUDIO_BITRATE_BPS } from '../shared/InputFactory.js';


/**
 * Calculate scaling based on selected mode
 * @private
 */
function calculateScale(videoWidth, videoHeight, targetWidth, targetHeight, scaleMode) {
    if (scaleMode === 'fill') {
        return { x: 0, y: 0, width: targetWidth, height: targetHeight };
    }

    if (scaleMode === 'center') {
        return {
            x: (targetWidth - videoWidth) / 2,
            y: (targetHeight - videoHeight) / 2,
            width: videoWidth,
            height: videoHeight
        };
    }

    const videoAspect = videoWidth / videoHeight;
    const targetAspect = targetWidth / targetHeight;

    let drawWidth, drawHeight;
    if (videoAspect > targetAspect) {
        drawWidth = targetWidth;
        drawHeight = targetWidth / videoAspect;
    } else {
        drawHeight = targetHeight;
        drawWidth = targetHeight * videoAspect;
    }

    return {
        x: (targetWidth - drawWidth) / 2,
        y: (targetHeight - drawHeight) / 2,
        width: drawWidth,
        height: drawHeight
    };
}

/**
 * Analyze all input videos for merge() — returns videoInfos, inputObjects, maxWidth, maxHeight.
 * @private
 */
async function analyzeInputVideos(inputs, onProgress) {
    const videoInfos = [];
    const inputObjects = [];
    let maxWidth = 0;
    let maxHeight = 0;

    for (let i = 0; i < inputs.length; i++) {
        const input = new MediaBunny.Input({
            source: new MediaBunny.BlobSource(inputs[i]),
            formats: MediaBunny.ALL_FORMATS
        });
        inputObjects.push(input);

        const videoTrack = await input.getPrimaryVideoTrack();
        if (!videoTrack) throw new Error(`No video track found in input file ${i + 1}`);

        const duration = await videoTrack.computeDuration();
        const width = videoTrack.displayWidth || videoTrack.codedWidth;
        const height = videoTrack.displayHeight || videoTrack.codedHeight;

        Logger.log(`[MergeService] Video ${i + 1}: ${width}x${height}, ${duration}s, codec: ${videoTrack.codec}`);

        maxWidth = Math.max(maxWidth, width);
        maxHeight = Math.max(maxHeight, height);
        videoInfos.push({ index: i, input, width, height, duration, codec: videoTrack.codec });

        if (onProgress) onProgress((i + 1) / (inputs.length * 2));
    }

    return { videoInfos, inputObjects, maxWidth, maxHeight };
}

/**
 * Resample/remix an audio sample to target channels and sample rate using OfflineAudioContext.
 * @private
 */
async function resampleAudioSample(sample, absoluteTimestamp, targetChannels, targetSampleRate) {
    const offlineCtx = new OfflineAudioContext(
        targetChannels,
        Math.ceil(sample.numberOfFrames * (targetSampleRate / sample.sampleRate)),
        targetSampleRate
    );
    const sourceBuffer = sample.toAudioBuffer();
    const source = offlineCtx.createBufferSource();
    source.buffer = sourceBuffer;
    source.connect(offlineCtx.destination);
    source.start(0);
    const resampledBuffer = await offlineCtx.startRendering();
    const resampledSamples = MediaBunny.AudioSample.fromAudioBuffer(resampledBuffer, absoluteTimestamp);
    return Array.isArray(resampledSamples) ? resampledSamples[0] : resampledSamples;
}

/**
 * Merge multiple videos using MediaBunny
 * 
 * @param {Object} options
 * @param {Array<Blob|File>} options.inputs - List of input files/blobs
 * @param {string} options.format - 'mp4', 'webm', etc.
 * @param {Object} [options.resolution] - { width: number, height: number }
 * @param {Function} [options.onProgress]
 * @returns {Promise<Blob>}
 */
export async function merge({ inputs, format = 'mp4', resolution, scaleMode = 'proportional', backgroundColor = '#000000', onProgress }) {
    if (!inputs || inputs.length < 2) {
        throw new Error('At least 2 videos are required for merging.');
    }

    Logger.log('[MergeService] Starting merge of', inputs.length, 'videos');

    const inputObjects = [];
    let output = null;
    let canvasSource = null;
    let audioSource = null;
    const canvas = document.createElement('canvas');

    try {
        Logger.log('[MergeService] Step 1: Analyzing input videos...');
        const { videoInfos, inputObjects: analysedInputs, maxWidth, maxHeight } =
            await analyzeInputVideos(inputs, onProgress);
        inputObjects.push(...analysedInputs);

        const targetWidth = resolution?.width || maxWidth;
        const targetHeight = resolution?.height || maxHeight;
        const targetFps = 30;

        Logger.log(`[MergeService] Target specs: ${targetWidth}x${targetHeight} @ ${targetFps}fps`);

        Logger.log('[MergeService] Step 2: Setting up output...');

        let outputFormat;
        switch (format) {
            case 'mp4':
                outputFormat = new MediaBunny.Mp4OutputFormat();
                break;
            case 'webm':
                outputFormat = new MediaBunny.WebMOutputFormat();
                break;
            case 'mov':
                outputFormat = new MediaBunny.MovOutputFormat();
                break;
            default:
                throw new Error(`Unsupported format: ${format}`);
        }

        output = new MediaBunny.Output({
            format: outputFormat,
            target: new MediaBunny.BufferTarget()
        });

        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        canvasSource = new MediaBunny.CanvasSource(canvas, {
            codec: format === 'webm' ? 'vp9' : 'avc',
            bitrate: MediaBunny.QUALITY_HIGH,
        });

        output.addVideoTrack(canvasSource);

        let audioCodec;
        let audioBitrate = AUDIO_BITRATE_BPS;
        const targetSampleRate = 48000;
        const targetChannels = 2;

        if (format === 'webm') {
            audioCodec = 'opus';
        } else {
            const supportedCodecs = await MediaBunny.getEncodableAudioCodecs(['aac', 'opus', 'mp3']);
            if (supportedCodecs.length === 0) {
                Logger.warn('[MergeService] No supported audio codecs found, merge will be video-only');
                audioCodec = null;
            } else {
                audioCodec = supportedCodecs[0];
                Logger.log(`[MergeService] Using audio codec: ${audioCodec}`);
            }
        }

        if (audioCodec) {
            audioSource = new MediaBunny.AudioSampleSource({
                codec: audioCodec,
                bitrate: audioBitrate
            });
            output.addAudioTrack(audioSource);
            Logger.log(`[MergeService] Audio output: ${targetChannels} channels @ ${targetSampleRate}Hz`);
        }

        await output.start();

        let currentTimestamp = 0;

        for (let i = 0; i < videoInfos.length; i++) {
            Logger.log(`[MergeService] Processing video ${i + 1}/${videoInfos.length}...`);

            const info = videoInfos[i];
            const input = info.input;

            const videoTrack = await input.getPrimaryVideoTrack();
            const audioTrack = await input.getPrimaryAudioTrack();

            const canDecodeVideo = await videoTrack.canDecode();
            if (!canDecodeVideo) {
                throw new Error(`Cannot decode video ${i + 1}. Codec ${videoTrack.codec} not supported.`);
            }

            const videoSink = new MediaBunny.VideoSampleSink(videoTrack);
            const videoStartTime = await videoTrack.getFirstTimestamp();
            let frameCount = 0;

            for await (const sample of videoSink.samples()) {
                try {
                    const relativeTimestamp = sample.timestamp - videoStartTime;
                    const absoluteTimestamp = currentTimestamp + relativeTimestamp;
                    const duration = sample.duration || (1 / targetFps);

                    ctx.fillStyle = backgroundColor;
                    ctx.fillRect(0, 0, targetWidth, targetHeight);

                    const scaleParams = calculateScale(
                        sample.displayWidth,
                        sample.displayHeight,
                        targetWidth,
                        targetHeight,
                        scaleMode
                    );

                    sample.draw(ctx, scaleParams.x, scaleParams.y, scaleParams.width, scaleParams.height);
                    await canvasSource.add(absoluteTimestamp, duration);

                    frameCount++;
                } finally {
                    sample.close();
                }
            }

            Logger.log(`[MergeService] Processed ${frameCount} frames from video ${i + 1}`);

            if (audioSource && audioTrack) {
                const canDecodeAudio = await audioTrack.canDecode();
                if (canDecodeAudio) {
                    Logger.log(`[MergeService] Processing audio from video ${i + 1}...`);

                    const audioSink = new MediaBunny.AudioSampleSink(audioTrack);
                    const audioStartTime = await audioTrack.getFirstTimestamp();
                    let audioSampleCount = 0;

                    const needsResampling = audioTrack.sampleRate !== targetSampleRate;
                    const needsRemixing = audioTrack.numberOfChannels !== targetChannels;

                    for await (const sample of audioSink.samples()) {
                        const relativeTimestamp = sample.timestamp - audioStartTime;
                        const absoluteTimestamp = currentTimestamp + relativeTimestamp;

                        let processedSample = sample;

                        if (needsResampling || needsRemixing) {
                            try {
                                processedSample = await resampleAudioSample(
                                    sample, absoluteTimestamp, targetChannels, targetSampleRate
                                );
                                sample.close();
                            } catch (resampleError) {
                                Logger.error(`[MergeService] Error resampling audio:`, resampleError);
                                sample.close();
                                throw resampleError;
                            }
                        } else {
                            processedSample.setTimestamp(absoluteTimestamp);
                        }

                        await audioSource.add(processedSample);
                        if (processedSample !== sample) processedSample.close();

                        audioSampleCount++;
                    }

                    Logger.log(`[MergeService] Processed ${audioSampleCount} audio samples from video ${i + 1}`);
                } else {
                    Logger.warn(`[MergeService] Cannot decode audio from video ${i + 1}, skipping`);
                }
            }

            currentTimestamp += info.duration;

            if (onProgress) {
                const overallProgress = 0.5 + ((i + 1) / (videoInfos.length * 2));
                onProgress(overallProgress);
            }
        }

        Logger.log('[MergeService] Finalizing merge...');
        canvasSource.close();
        if (audioSource) audioSource.close();
        await output.finalize();

        if (onProgress) onProgress(1.0);

        Logger.log('[MergeService] Merge complete!');
        return new Blob([output.target.buffer], { type: `video/${format}` });

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
        for (const input of inputObjects) {
            if (input && typeof input.dispose === 'function') {
                try { input.dispose(); } catch (e) { Logger.warn('Error disposing input:', e); }
            }
        }
    }
}
