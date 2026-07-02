import { Logger } from '../../shared/utils/Logger.js';
import { MediaBunny, ensureEncoders } from '../../core/MediaBunny.js';
import { AUDIO_BITRATE_BPS, createMediaBunnyInput } from '../shared/InputFactory.js';
import { addAudioSamples, stretchAudioBuffer } from '../shared/AudioHelpers.js';

async function processAudioWithSpeed(audioTrack, audioSource, speed = 1) {
    const audioSink = new MediaBunny.AudioSampleSink(audioTrack);
    let outputTimestamp = 0;

    for await (const sample of audioSink.samples()) {
        let finalBuffer = sample.toAudioBuffer();

        if (speed !== 1) {
            try {
                finalBuffer = await stretchAudioBuffer(finalBuffer, speed);
            } catch (e) {
                Logger.warn('[MediaProcessor] Audio time-stretch failed, using original:', e);
            }
        }

        outputTimestamp = await addAudioSamples(audioSource, finalBuffer, outputTimestamp);
        sample.close();
    }
}

async function reverseAudioWithSink(audioTrack, audioSource, speed = 1, onProgress) {
    const audioSink = new MediaBunny.AudioSampleSink(audioTrack);

    // Walk the track in fixed windows from the end so only a few seconds of
    // decoded PCM are ever alive at once — decoding the entire track up front
    // holds the full uncompressed audio in memory (~1.4 GB per hour of stereo).
    const WINDOW_DURATION = 5;
    const firstTimestamp = await audioTrack.getFirstTimestamp();
    const duration = await audioTrack.computeDuration();
    const totalWindows = Math.max(1, Math.ceil(duration / WINDOW_DURATION));

    let outputTimestamp = 0;

    for (let w = totalWindows - 1; w >= 0; w--) {
        const windowStart = firstTimestamp + w * WINDOW_DURATION;
        const windowEnd = Math.min(firstTimestamp + duration, windowStart + WINDOW_DURATION);

        const samples = [];
        for await (const sample of audioSink.samples(windowStart, windowEnd)) {
            // The range can yield boundary-straddling samples; keep each sample
            // in exactly one window (the one its timestamp falls into).
            if (sample && sample.timestamp >= windowStart && sample.timestamp < windowEnd) {
                samples.push(sample);
            } else {
                sample?.close();
            }
        }
        samples.reverse();

        for (const sample of samples) {
            const buffer = sample.toAudioBuffer();

            for (let c = 0; c < buffer.numberOfChannels; c++) {
                buffer.getChannelData(c).reverse();
            }

            let finalBuffer = buffer;
            if (speed !== 1) {
                try {
                    finalBuffer = await stretchAudioBuffer(buffer, speed);
                } catch (e) {
                    Logger.warn('[MediaProcessor] Audio time-stretch failed, using original:', e);
                }
            }

            outputTimestamp = await addAudioSamples(audioSource, finalBuffer, outputTimestamp);
            sample.close();
        }

        if (onProgress) {
            onProgress(0.8 + ((totalWindows - w) / totalWindows) * 0.2);
        }
    }
}

export async function reverseVideo({ source, includeAudio = false, speed = 1, onProgress }) {
    await ensureEncoders();
    Logger.log('[MediaProcessor] Starting video reversal with samplesAtTimestamps...');

    const input = createMediaBunnyInput(source);

    let output = null;
    let canvasSource = null;
    let audioSource = null;

    try {
        const videoTrack = await input.getPrimaryVideoTrack();
        if (!videoTrack) throw new Error('No video track found');

        const width = videoTrack.displayWidth || videoTrack.codedWidth;
        const height = videoTrack.displayHeight || videoTrack.codedHeight;
        const duration = await videoTrack.computeDuration();
        const firstTimestamp = await videoTrack.getFirstTimestamp();

        let sourceFps = 30;
        let sourceBitrate = 0;
        try {
            const stats = await videoTrack.computePacketStats();
            sourceFps = stats.averagePacketRate || 30;
            sourceBitrate = stats.averageBitrate || 0;
        } catch (e) {
            Logger.warn('[MediaProcessor] Could not compute frame rate, defaulting to 30fps', e);
        }

        const clampedSpeed = Math.max(0.25, Math.min(2, speed));
        const outputFps = sourceFps;
        const sourceDuration = duration;
        const outputDuration = sourceDuration / clampedSpeed;
        const frameDuration = 1 / outputFps;
        const totalOutputFrames = Math.ceil(outputDuration * outputFps);

        Logger.log(`[MediaProcessor] Source: ${width}x${height}, ${duration.toFixed(2)}s, ${sourceFps.toFixed(1)}fps, ${(sourceBitrate / 1000000).toFixed(2)} Mbps`);
        Logger.log(`[MediaProcessor] Speed: ${clampedSpeed}x, Output: ${outputDuration.toFixed(2)}s, ${totalOutputFrames} frames`);

        output = new MediaBunny.Output({
            format: new MediaBunny.Mp4OutputFormat(),
            target: new MediaBunny.BufferTarget()
        });

        canvasSource = new MediaBunny.VideoSampleSource({
            codec: 'avc',
            bitrate: MediaBunny.QUALITY_HIGH,
        });
        output.addVideoTrack(canvasSource);

        if (includeAudio) {
            const audioTrack = await input.getPrimaryAudioTrack();
            if (audioTrack) {
                const supportedCodecs = await MediaBunny.getEncodableAudioCodecs(['aac', 'opus', 'mp3']);
                if (supportedCodecs.length > 0) {
                    audioSource = new MediaBunny.AudioSampleSource({
                        codec: supportedCodecs[0],
                        bitrate: AUDIO_BITRATE_BPS
                    });
                    output.addAudioTrack(audioSource);
                }
            }
        }

        await output.start();

        Logger.log('[MediaProcessor] Extracting frames in reverse order using samplesAtTimestamps...');
        const videoSink = new MediaBunny.VideoSampleSink(videoTrack);
        const reverseTimestampGenerator = (async function* () {
            for (let outputFrame = 0; outputFrame < totalOutputFrames; outputFrame++) {
                const outputProgress = outputFrame / totalOutputFrames;
                const sourceTime = sourceDuration * (1 - outputProgress);
                yield firstTimestamp + sourceTime;
            }
        })();

        let outputTimestamp = 0;
        let frameCount = 0;

        for await (const sample of videoSink.samplesAtTimestamps(reverseTimestampGenerator)) {
            if (!sample) continue;

            sample.setTimestamp(outputTimestamp);
            sample.setDuration(frameDuration);
            await canvasSource.add(sample);
            outputTimestamp += frameDuration;
            sample.close();
            frameCount++;

            if (onProgress) {
                onProgress(frameCount / totalOutputFrames * 0.8);
            }
        }

        Logger.log(`[MediaProcessor] Encoded ${frameCount} frames`);

        if (includeAudio && audioSource) {
            Logger.log('[MediaProcessor] Reversing audio...');
            try {
                const audioTrack = await input.getPrimaryAudioTrack();
                if (audioTrack) {
                    await reverseAudioWithSink(audioTrack, audioSource, clampedSpeed, onProgress);
                    Logger.log('[MediaProcessor] Audio reversal complete');
                }
            } catch (e) {
                Logger.warn('[MediaProcessor] Audio reversal failed:', e);
            }
        }

        Logger.log('[MediaProcessor] Finalizing...');
        canvasSource.close();
        if (audioSource) audioSource.close();
        await output.finalize();
        if (onProgress) onProgress(1.0);

        Logger.log('[MediaProcessor] Reverse complete!');
        return new Blob([output.target.buffer], { type: 'video/mp4' });
    } finally {
        if (input && typeof input.dispose === 'function') {
            try { input.dispose(); } catch (e) { Logger.warn('Error disposing input:', e); }
        }
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

export async function changeVideoSpeed({ source, speed = 1, onProgress, includeAudio = true }) {
    await ensureEncoders();
    Logger.log(`[MediaProcessor] Changing speed to ${speed}x...`);

    const input = createMediaBunnyInput(source);

    let output = null;
    let canvasSource = null;

    try {
        const videoTrack = await input.getPrimaryVideoTrack();
        if (!videoTrack) throw new Error('No video track found');

        const duration = await videoTrack.computeDuration();
        const firstTimestamp = await videoTrack.getFirstTimestamp();

        let sourceFps = 30;
        try {
            const stats = await videoTrack.computePacketStats();
            sourceFps = stats.averagePacketRate || 30;
        } catch (e) {
            Logger.warn('[MediaProcessor] Could not compute frame rate, defaulting to 30fps', e);
        }

        const clampedSpeed = Math.max(0.1, Math.min(10, speed));
        const outputFps = sourceFps;
        const sourceDuration = duration;
        const outputDuration = sourceDuration / clampedSpeed;
        const frameDuration = 1 / outputFps;
        const totalOutputFrames = Math.ceil(outputDuration * outputFps);

        Logger.log(`[MediaProcessor] Speed: ${clampedSpeed}x, Output: ${outputDuration.toFixed(2)}s, ${totalOutputFrames} frames`);

        output = new MediaBunny.Output({
            format: new MediaBunny.Mp4OutputFormat(),
            target: new MediaBunny.BufferTarget()
        });

        canvasSource = new MediaBunny.VideoSampleSource({
            codec: 'avc',
            bitrate: MediaBunny.QUALITY_HIGH,
        });
        output.addVideoTrack(canvasSource);

        let audioSource = null;
        if (includeAudio) {
            const audioTrack = await input.getPrimaryAudioTrack();
            if (audioTrack) {
                const supportedCodecs = await MediaBunny.getEncodableAudioCodecs(['aac', 'opus', 'mp3']);
                if (supportedCodecs.length > 0) {
                    try {
                        audioSource = new MediaBunny.AudioSampleSource({
                            codec: supportedCodecs[0],
                            bitrate: AUDIO_BITRATE_BPS
                        });
                        output.addAudioTrack(audioSource);
                        Logger.log('[MediaProcessor] Audio track added (experimental speed sync)');
                    } catch (e) {
                        Logger.warn('[MediaProcessor] Failed to setup audio:', e);
                    }
                }
            }
        }

        await output.start();

        Logger.log('[MediaProcessor] Processing video frames...');
        const videoSink = new MediaBunny.VideoSampleSink(videoTrack);
        const timestampGenerator = (async function* () {
            for (let outputFrame = 0; outputFrame < totalOutputFrames; outputFrame++) {
                const outputProgress = outputFrame / totalOutputFrames;
                const sourceTime = sourceDuration * outputProgress;
                yield firstTimestamp + sourceTime;
            }
        })();

        let outputTimestamp = 0;
        let frameCount = 0;

        for await (const sample of videoSink.samplesAtTimestamps(timestampGenerator)) {
            if (!sample) continue;

            sample.setTimestamp(outputTimestamp);
            sample.setDuration(frameDuration);
            await canvasSource.add(sample);
            outputTimestamp += frameDuration;
            sample.close();
            frameCount++;

            if (onProgress) {
                onProgress(frameCount / totalOutputFrames);
            }
        }

        Logger.log(`[MediaProcessor] Encoded ${frameCount} frames`);

        if (includeAudio && audioSource) {
            Logger.log('[MediaProcessor] Processing audio...');
            try {
                const audioTrack = await input.getPrimaryAudioTrack();
                if (audioTrack) {
                    await processAudioWithSpeed(audioTrack, audioSource, speed);
                    Logger.log('[MediaProcessor] Audio processing complete');
                }
            } catch (e) {
                Logger.warn('[MediaProcessor] Audio processing failed:', e);
            }
        }

        canvasSource.close();
        if (audioSource) audioSource.close();
        await output.finalize();
        return new Blob([output.target.buffer], { type: 'video/mp4' });
    } finally {
        try { if (input) input.dispose(); } catch (e) { Logger.warn('[MediaProcessor] input dispose failed:', e); }
        try { if (output) output.dispose(); } catch (e) { Logger.warn('[MediaProcessor] output dispose failed:', e); }
        try { if (canvasSource) canvasSource.dispose(); } catch (e) { Logger.warn('[MediaProcessor] canvasSource dispose failed:', e); }
    }
}
