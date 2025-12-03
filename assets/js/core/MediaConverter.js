import { MediaBunny } from './MediaBunny.js';

/**
 * MediaConverter
 * Core service for handling video format conversion and optimization.
 */
export class MediaConverter {
    /**
     * Convert a video blob/file to a target format with optional quality reduction.
     * @param {Object} options
     * @param {Blob|File} options.source - The source video file or blob
     * @param {string} options.format - Target format ('mp4', 'webm', 'mov')
     * @param {number} options.quality - Quality percentage (40, 60, 80, 100)
     * @param {Function} [options.onProgress] - Callback for progress updates (0-1)
     * @returns {Promise<Blob>} - The converted video blob
     */
    static async convert({ source, format, quality, onProgress }) {
        const inputSource = new MediaBunny.BlobSource(source);

        const input = new MediaBunny.Input({
            source: inputSource,
            formats: MediaBunny.ALL_FORMATS
        });

        // Determine Output Format
        let outputFormat;
        switch (format) {
            case 'mp4':
                outputFormat = new MediaBunny.Mp4OutputFormat();
                break;
            case 'webm':
                outputFormat = new MediaBunny.WebMOutputFormat();
                break;
            case 'mov':
                outputFormat = new MediaBunny.QuickTimeOutputFormat();
                break;
            default:
                throw new Error(`Unsupported format: ${format}`);
        }

        const output = new MediaBunny.Output({
            format: outputFormat,
            target: new MediaBunny.BufferTarget()
        });

        // Configure Video Options based on Quality
        let videoOptions = {};

        if (quality < 100) {
            // Calculate bitrate reduction
            let targetBitrate;
            if (quality >= 80) targetBitrate = 2500000;
            else if (quality >= 60) targetBitrate = 1500000;
            else targetBitrate = 800000;

            videoOptions = {
                bitrate: targetBitrate,
                forceTranscode: true
            };
        }

        const conversion = await MediaBunny.Conversion.init({
            input,
            output,
            video: videoOptions
        });

        if (onProgress) {
            conversion.onProgress = onProgress;
        }

        await conversion.execute();

        return new Blob([output.target.buffer], { type: `video/${format}` });
    }
    /**
     * Get all tracks from a video source.
     * @param {Blob|File} source 
     * @returns {Promise<{video: Array, audio: Array}>}
     */
    static async getTracks(source) {
        const inputSource = new MediaBunny.BlobSource(source);
        const input = new MediaBunny.Input({
            source: inputSource,
            formats: MediaBunny.ALL_FORMATS
        });

        const videoTracks = await input.getVideoTracks();
        const audioTracks = await input.getAudioTracks();

        // Enrich tracks with computed duration and codec string
        const enrichTracks = async (tracks) => {
            return Promise.all(tracks.map(async (track) => {
                const duration = await track.computeDuration();
                const codecString = await track.getCodecParameterString();
                return {
                    id: track.id,
                    type: track.type,
                    language: track.languageCode,
                    codec: track.codec,
                    codecString: codecString,
                    duration: duration,
                    // Video specific
                    width: track.displayWidth,
                    height: track.displayHeight,
                    // Audio specific
                    channels: track.numberOfChannels,
                    sampleRate: track.sampleRate,
                    // Original track object for reference if needed (but avoid passing complex objects if possible)
                    // We'll use index for selection which is safer
                };
            }));
        };

        return {
            video: await enrichTracks(videoTracks),
            audio: await enrichTracks(audioTracks)
        };
    }

    /**
     * Extract a specific track from the source.
     * @param {Object} options
     * @param {Blob|File} options.source
     * @param {number} options.trackIndex - Index of the track in its type list (0-based)
     * @param {string} options.trackType - 'video' or 'audio'
     * @param {string} options.format - 'mp4' (video) or 'm4a'/'mp3' (audio)
     * @param {Function} [options.onProgress]
     * @returns {Promise<Blob>}
     */
    static async extractTrack({ source, trackIndex, trackType, format, onProgress }) {
        const inputSource = new MediaBunny.BlobSource(source);
        const input = new MediaBunny.Input({
            source: inputSource,
            formats: MediaBunny.ALL_FORMATS
        });

        // Determine Output Format
        let outputFormat;
        switch (format) {
            case 'mp4':
                outputFormat = new MediaBunny.Mp4OutputFormat();
                break;
            case 'm4a':
                outputFormat = new MediaBunny.Mp4OutputFormat(); // M4A is MP4 container
                break;
            case 'mp3':
                outputFormat = new MediaBunny.Mp3OutputFormat();
                break;
            case 'aac':
                outputFormat = new MediaBunny.AdtsOutputFormat();
                break;
            default:
                throw new Error(`Unsupported format: ${format}`);
        }

        const output = new MediaBunny.Output({
            format: outputFormat,
            target: new MediaBunny.BufferTarget()
        });

        // Configure Conversion to select specific track
        const conversionOptions = {
            input,
            output,
        };

        if (trackType === 'video') {
            // Keep selected video track, discard others
            conversionOptions.video = (track, index) => {
                return index === trackIndex ? {} : { discard: true };
            };
            // Discard all audio
            conversionOptions.audio = { discard: true };
        } else if (trackType === 'audio') {
            // Discard all video
            conversionOptions.video = { discard: true };
            // Keep selected audio track, discard others
            conversionOptions.audio = (track, index) => {
                return index === trackIndex ? {} : { discard: true };
            };
        }

        const conversion = await MediaBunny.Conversion.init(conversionOptions);

        if (!conversion.isValid) {
            console.error('Conversion invalid:', conversion.discardedTracks);
            const reasons = conversion.discardedTracks.map(d => `${d.track.type}: ${d.reason}`).join(', ');
            throw new Error(`Cannot execute conversion: ${reasons}`);
        }

        if (onProgress) {
            conversion.onProgress = onProgress;
        }

        await conversion.execute();

        const mimeType = trackType === 'video' ? `video/${format}` : `audio/${format}`;
        return new Blob([output.target.buffer], { type: mimeType });
    }
}
