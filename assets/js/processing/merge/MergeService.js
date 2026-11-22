import { Logger } from "../../shared/utils/Logger.js";
import { MediaBunny, ensureEncoders, codecOf } from '../../shared/media/MediaBunny.js';
import { AUDIO_BITRATE_BPS } from '../../shared/media/InputFactory.js';
import { executeConversion, cancelUnfinished, throwIfCancelled } from '../../shared/utils/Cancellation.js';
import { copyMetadataTags } from '../shared/MetadataTags.js';


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

        const codec = await codecOf(videoTrack);
        Logger.log(`[MergeService] Video ${i + 1}: ${width}x${height}, ${duration}s, codec: ${codec}`);

        maxWidth = Math.max(maxWidth, width);
        maxHeight = Math.max(maxHeight, height);
        videoInfos.push({ index: i, input, width, height, duration, codec });

        if (onProgress) onProgress((i + 1) / (inputs.length * 2));
    }

    return { videoInfos, inputObjects, maxWidth, maxHeight };
}

/**
 * Feed one input's primary audio track into the merge, at the merge's sample
 * rate and channel count, starting at `offset` seconds.
 *
 * The resampling is Mediabunny's, run as a Conversion whose only job is to
 * hand over its resampled samples: `process` sees each one after resampling
 * and remixing, passes it on, and drops it from the conversion's own output,
 * which writes nowhere (as PCM, so no browser encoder is needed). The output's own audio source cannot do this: its
 * resampler accepts one input format for the life of the track, and a merge
 * changes format at every join.
 *
 * This replaced resampling each decoded sample on its own through an
 * OfflineAudioContext, which glitched at every sample boundary. Measured on a
 * 1 kHz tone merged from 44.1 kHz into 48 kHz: the worst 10 ms window was
 * 24 dB above the noise that way, against 47 dB here and 42.5 dB for Opus
 * with no resampling at all.
 *
 * @returns {Promise<number>} how many samples were added
 */
async function addResampledAudio(input, audioSource, offset, sampleRate, numberOfChannels, signal) {
    const discard = new MediaBunny.Output({
        format: new MediaBunny.MkvOutputFormat(),
        target: new MediaBunny.NullTarget(),
    });
    let firstTimestamp = null;
    let count = 0;

    const conversion = await MediaBunny.Conversion.init({
        input,
        output: discard,
        tracks: 'primary',
        video: { discard: true },
        audio: {
            sampleRate,
            numberOfChannels,
            // Nothing is written, and PCM needs no encoder from the browser.
            codec: 'pcm-f32',
            // Without this an input already in the target format would be
            // copied as packets, and `process` would never see it.
            forceTranscode: true,
            process: async (sample) => {
                firstTimestamp ??= sample.timestamp;
                const copy = sample.clone();
                try {
                    copy.setTimestamp(offset + (sample.timestamp - firstTimestamp));
                    await audioSource.add(copy);
                } finally {
                    copy.close();
                }
                count++;
                return null;
            },
        },
    });
    if (!conversion.isValid) {
        const reasons = conversion.discardedTracks.map(t => t.reason).join(', ');
        throw new Error(`Cannot read the audio for merging (${reasons}).`);
    }
    await executeConversion(conversion, signal);
    return count;
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
export async function merge({ inputs, format = 'mp4', resolution, scaleMode = 'proportional', backgroundColor = '#000000', onProgress, signal }) {
    await ensureEncoders();
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
            quality: MediaBunny.QUALITY_HIGH,
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
                quality: new MediaBunny.Quality({ bitrate: audioBitrate }),
            });
            output.addAudioTrack(audioSource);
            Logger.log(`[MergeService] Audio output: ${targetChannels} channels @ ${targetSampleRate}Hz`);
        }

        // The first file's title and cover art, as a Conversion would keep them.
        await copyMetadataTags(inputObjects[0], output);
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
                throw new Error(`Cannot decode video ${i + 1}. Codec ${await codecOf(videoTrack)} not supported.`);
            }

            const videoSink = new MediaBunny.VideoSampleSink(videoTrack);
            const videoStartTime = await videoTrack.getFirstTimestamp();
            let frameCount = 0;

            for await (const sample of videoSink.samples()) {
                try {
                    throwIfCancelled(signal);
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

                    const audioSampleCount = await addResampledAudio(
                        input, audioSource, currentTimestamp, targetSampleRate, targetChannels, signal,
                    );

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
        await cancelUnfinished(output);
        for (const input of inputObjects) {
            if (input && typeof input.dispose === 'function') {
                try { input.dispose(); } catch (e) { Logger.warn('Error disposing input:', e); }
            }
        }
    }
}
