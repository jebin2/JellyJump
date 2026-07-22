import { Logger } from "../../shared/utils/Logger.js";
import { MediaBunny, ensureEncoders } from '../../core/MediaBunny.js';

/**
 * Combine the video track of one file with the audio track of another, muxing
 * both into a single output without decoding/re-encoding either stream
 * (Mediabunny's composable Conversion API — both source tracks are copied
 * straight through when their codec fits the target container).
 *
 * @param {Object} options
 * @param {Blob|File} options.videoSource - File to take the video track from
 * @param {Blob|File} options.audioSource - File to take the audio track from
 * @param {string} [options.format] - 'mp4', 'webm', or 'mov'
 * @param {Function} [options.onProgress]
 * @returns {Promise<Blob>}
 */
export async function combineAudioVideo({ videoSource, audioSource, format = 'mp4', onProgress }) {
    await ensureEncoders();

    let videoInput = null;
    let audioInput = null;
    let output = null;
    let videoConversion = null;
    let audioConversion = null;

    try {
        videoInput = new MediaBunny.Input({ source: new MediaBunny.BlobSource(videoSource), formats: MediaBunny.ALL_FORMATS });
        audioInput = new MediaBunny.Input({ source: new MediaBunny.BlobSource(audioSource), formats: MediaBunny.ALL_FORMATS });

        const videoTrack = await videoInput.getPrimaryVideoTrack();
        if (!videoTrack) throw new Error('The selected video file has no video track.');

        const audioTrack = await audioInput.getPrimaryAudioTrack();
        if (!audioTrack) throw new Error('The selected audio file has no audio track.');

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

        output = new MediaBunny.Output({ format: outputFormat, target: new MediaBunny.BufferTarget() });

        videoConversion = await MediaBunny.Conversion.init({
            input: videoInput,
            output,
            composable: true,
            audio: { discard: true }
        });
        audioConversion = await MediaBunny.Conversion.init({
            input: audioInput,
            output,
            composable: true,
            video: { discard: true }
        });

        if (videoConversion.discardedTracks.some(d => d.track === videoTrack)) {
            throw new Error(`Video track could not be added to the ${format} output (unsupported codec: ${videoTrack.codec}).`);
        }
        if (audioConversion.discardedTracks.some(d => d.track === audioTrack)) {
            throw new Error(`Audio track could not be added to the ${format} output (unsupported codec: ${audioTrack.codec}).`);
        }

        let videoProgress = 0;
        let audioProgress = 0;
        const reportProgress = () => {
            if (onProgress) onProgress((videoProgress + audioProgress) / 2);
        };
        videoConversion.onProgress = (p) => { videoProgress = p; reportProgress(); };
        audioConversion.onProgress = (p) => { audioProgress = p; reportProgress(); };

        await output.start();
        await Promise.all([videoConversion.execute(), audioConversion.execute()]);
        await output.finalize();

        if (onProgress) onProgress(1);

        Logger.log('[CombineAVService] Combine complete!');
        return new Blob([output.target.buffer], { type: `video/${format}` });

    } finally {
        for (const conversion of [videoConversion, audioConversion]) {
            if (conversion && typeof conversion.dispose === 'function') {
                try { conversion.dispose(); } catch (e) { Logger.warn('Error disposing conversion:', e); }
            }
        }
        if (output && typeof output.dispose === 'function') {
            try { output.dispose(); } catch (e) { Logger.warn('Error disposing output:', e); }
        }
        for (const input of [videoInput, audioInput]) {
            if (input && typeof input.dispose === 'function') {
                try { input.dispose(); } catch (e) { Logger.warn('Error disposing input:', e); }
            }
        }
    }
}
