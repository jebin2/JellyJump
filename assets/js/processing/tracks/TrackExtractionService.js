import { Logger } from '../../utils/Logger.js';
import { MediaBunny } from '../../core/MediaBunny.js';
import { AUDIO_BITRATE_BPS } from '../shared/InputFactory.js';
import { addAudioSamples, stretchAudioBuffer } from '../shared/AudioHelpers.js';

export async function extractTrackWithSpeed({ source, trackIndex, trackType, format, speed, onProgress }) {
    Logger.log(`[MediaProcessor] Extracting ${trackType} track ${trackIndex} with speed ${speed}x`);

    const blobSource = source instanceof Blob ? new MediaBunny.BlobSource(source) : new MediaBunny.BufferSource(source);
    const input = new MediaBunny.Input({
        source: blobSource,
        formats: MediaBunny.ALL_FORMATS
    });

    let output = null;
    let canvasSource = null;
    let audioSource = null;

    try {
        if (trackType === 'video') {
            const videoTracks = await input.getVideoTracks();
            if (trackIndex >= videoTracks.length) {
                throw new Error(`Video track ${trackIndex} not found`);
            }
            const videoTrack = videoTracks[trackIndex];

            const width = videoTrack.displayWidth || videoTrack.codedWidth;
            const height = videoTrack.displayHeight || videoTrack.codedHeight;
            const duration = await videoTrack.computeDuration();
            const firstTimestamp = await videoTrack.getFirstTimestamp();

            let sourceFps = 30;
            try {
                const stats = await videoTrack.computePacketStats();
                sourceFps = stats.averagePacketRate || 30;
            } catch (e) {
                Logger.warn('[MediaProcessor] Could not compute frame rate, defaulting to 30fps');
            }

            const outputDuration = duration / speed;
            const outputFps = sourceFps;
            const frameDuration = 1 / outputFps;
            const totalOutputFrames = Math.ceil(outputDuration * outputFps);

            Logger.log(`[MediaProcessor] Video: ${width}x${height}, ${duration.toFixed(2)}s -> ${outputDuration.toFixed(2)}s at ${speed}x`);

            const outputFormat = format === 'webm' ? new MediaBunny.WebMOutputFormat() : new MediaBunny.Mp4OutputFormat();
            output = new MediaBunny.Output({
                format: outputFormat,
                target: new MediaBunny.BufferTarget()
            });

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });

            canvasSource = new MediaBunny.CanvasSource(canvas, {
                codec: format === 'webm' ? 'vp9' : 'avc',
                bitrate: MediaBunny.QUALITY_HIGH,
            });

            output.addVideoTrack(canvasSource);
            await output.start();

            const videoSink = new MediaBunny.VideoSampleSink(videoTrack);
            const timestampGenerator = (async function* () {
                for (let outputFrame = 0; outputFrame < totalOutputFrames; outputFrame++) {
                    const outputProgress = outputFrame / totalOutputFrames;
                    const sourceTime = duration * outputProgress;
                    yield firstTimestamp + sourceTime;
                }
            })();

            let outputTimestamp = 0;
            let frameCount = 0;

            for await (const sample of videoSink.samplesAtTimestamps(timestampGenerator)) {
                if (!sample) continue;

                sample.draw(ctx, 0, 0, width, height);
                await canvasSource.add(outputTimestamp, frameDuration);
                outputTimestamp += frameDuration;
                sample.close();
                frameCount++;

                if (onProgress) {
                    onProgress(frameCount / totalOutputFrames);
                }
            }

            Logger.log(`[MediaProcessor] Encoded ${frameCount} video frames`);
            canvasSource.close();
            await output.finalize();

            return new Blob([output.target.buffer], { type: `video/${format}` });
        }

        const audioTracks = await input.getAudioTracks();
        if (trackIndex >= audioTracks.length) {
            throw new Error(`Audio track ${trackIndex} not found`);
        }
        const audioTrack = audioTracks[trackIndex];

        const audioSink = new MediaBunny.AudioSampleSink(audioTrack);
        const samples = [];
        for await (const sample of audioSink.samples()) {
            samples.push(sample);
        }

        Logger.log(`[MediaProcessor] Collected ${samples.length} audio samples for speed adjustment`);

        let outputFormat;
        switch (format) {
            case 'm4a':
                outputFormat = new MediaBunny.Mp4OutputFormat();
                break;
            case 'mp3':
                outputFormat = new MediaBunny.Mp3OutputFormat();
                break;
            case 'wav':
                outputFormat = new MediaBunny.WavOutputFormat();
                break;
            case 'flac':
                outputFormat = new MediaBunny.FlacOutputFormat();
                break;
            default:
                outputFormat = new MediaBunny.Mp4OutputFormat();
        }

        output = new MediaBunny.Output({
            format: outputFormat,
            target: new MediaBunny.BufferTarget()
        });

        const codecList = format === 'flac' ? ['flac'] : ['aac', 'opus', 'mp3'];
        const supportedCodecs = await MediaBunny.getEncodableAudioCodecs(codecList);
        if (supportedCodecs.length === 0) {
            throw new Error('No supported audio codecs found');
        }

        const audioSourceConfig = format === 'flac'
            ? { codec: supportedCodecs[0] }
            : { codec: supportedCodecs[0], bitrate: AUDIO_BITRATE_BPS };
        audioSource = new MediaBunny.AudioSampleSource(audioSourceConfig);
        output.addAudioTrack(audioSource);
        await output.start();

        let outputTimestamp = 0;
        const totalSamples = samples.length;

        for (let i = 0; i < samples.length; i++) {
            const sample = samples[i];
            const buffer = sample.toAudioBuffer();

            let finalBuffer = buffer;
            try {
                finalBuffer = await stretchAudioBuffer(buffer, speed);
            } catch (e) {
                Logger.warn('[MediaProcessor] Audio time-stretch failed, using original:', e);
            }

            outputTimestamp = await addAudioSamples(audioSource, finalBuffer, outputTimestamp);
            sample.close();

            if (onProgress && i % 100 === 0) {
                onProgress(i / totalSamples);
            }
        }

        Logger.log('[MediaProcessor] Audio speed adjustment complete');
        audioSource.close();
        await output.finalize();

        if (onProgress) onProgress(1.0);

        return new Blob([output.target.buffer], { type: `audio/${format}` });
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
