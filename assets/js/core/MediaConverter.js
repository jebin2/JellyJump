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
    /**
     * Convert a video blob/file to a target format with optional quality reduction.
     * @param {Object} options
     * @param {Blob|File} options.source - The source video file or blob
     * @param {string} options.format - Target format ('mp4', 'webm', 'mov')
     * @param {number} options.quality - Quality percentage (40, 60, 80, 100)
     * @param {number} [options.startTime] - Start time in seconds
     * @param {number} [options.endTime] - End time in seconds
     * @param {Function} [options.onProgress] - Callback for progress updates (0-1)
     * @returns {Promise<Blob>} - The converted video blob
     */
    static async convert({ source, format, quality, startTime, endTime, onProgress }) {
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

        // Configure Trim Options
        let trimOptions = undefined;
        if ((typeof startTime === 'number' && startTime >= 0) || (typeof endTime === 'number' && endTime > 0)) {
            trimOptions = {};
            if (typeof startTime === 'number' && startTime >= 0) {
                trimOptions.start = startTime;
            }
            if (typeof endTime === 'number' && endTime > (startTime || 0)) {
                trimOptions.end = endTime;
            }
        }

        const conversion = await MediaBunny.Conversion.init({
            input,
            output,
            video: videoOptions,
            trim: trimOptions
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
        const input = new MediaBunny.Input({
            source: source instanceof Blob ? new MediaBunny.BlobSource(source) : new MediaBunny.BufferSource(source),
            formats: MediaBunny.ALL_FORMATS
        });

        let outputFormat;
        switch (format) {
            case 'mp4':
                outputFormat = new MediaBunny.Mp4OutputFormat();
                break;
            case 'mp3':
                outputFormat = new MediaBunny.Mp3OutputFormat();
                break;
            case 'm4a':
                outputFormat = new MediaBunny.Mp4OutputFormat();
                break;
            case 'aac':
                outputFormat = new MediaBunny.AdtsOutputFormat();
                break;
            case 'wav':
                outputFormat = new MediaBunny.WavOutputFormat();
                break;
            default:
                throw new Error(`Unsupported format: ${format}`);
        }

        const output = new MediaBunny.Output({
            format: outputFormat,
            target: new MediaBunny.BufferTarget()
        });

        const conversionOptions = {
            input: input,
            output: output,
            video: (t, i) => {
                // MediaBunny uses 1-based indexing for tracks in the callback
                const keep = trackType === 'video' && (i - 1) === trackIndex;
                console.log(`[MediaConverter] Video track ${i} (${t.codec}): ${keep ? 'KEEP' : 'DISCARD'} (Target: ${trackType} #${trackIndex})`);
                return keep ? {} : { discard: true };
            },
            audio: (t, i) => {
                // MediaBunny uses 1-based indexing for tracks in the callback
                const keep = trackType === 'audio' && (i - 1) === trackIndex;
                console.log(`[MediaConverter] Audio track ${i} (${t.codec}): ${keep ? 'KEEP' : 'DISCARD'} (Target: ${trackType} #${trackIndex})`);
                return keep ? {} : { discard: true };
            }
        };

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
