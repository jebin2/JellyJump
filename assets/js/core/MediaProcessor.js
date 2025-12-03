import { MediaBunny } from './MediaBunny.js';

/**
 * MediaProcessor
 * Core service for handling video format conversion and optimization.
 */
export class MediaProcessor {
    /**
     * Process video (transcode, trim, etc.)
     * @param {Object} options
     * @param {Blob|File} options.source
     * @param {string} options.format - 'mp4', 'webm', 'mov', 'keep'
     * @param {number} options.quality - 0-100
     * @param {Object} [options.trim] - { start: number, end: number }
     * @param {Function} [options.onProgress]
     * @returns {Promise<Blob>}
     */
    /**
     * Process video (transcode, trim, resize, etc.)
     * @param {Object} options
     * @param {Blob|File} options.source
     * @param {string} options.format - 'mp4', 'webm', 'mov', 'keep'
     * @param {number} options.quality - 0-100
     * @param {Object} [options.trim] - { start: number, end: number }
     * @param {Object} [options.resize] - { width: number, height: number }
     * @param {Function} [options.onProgress]
     * @returns {Promise<Blob>}
     */
    static async process({ source, format, quality, trim, resize, onProgress }) {
        const blobSource = new MediaBunny.BlobSource(source);
        const input = new MediaBunny.Input({ source: blobSource, formats: MediaBunny.ALL_FORMATS });

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

        // Configure Video Encoder
        let videoConfig = {};

        if (quality < 100) {
            // Simple bitrate calculation based on quality
            // 100 = Copy (if possible) or High Bitrate
            // 80 = High
            // 60 = Medium
            // 40 = Low
            let bitrate;
            if (quality >= 80) bitrate = 2500000; // 2.5 Mbps
            else if (quality >= 60) bitrate = 1500000; // 1.5 Mbps
            else bitrate = 800000; // 800 Kbps

            videoConfig = {
                bitrate: bitrate,
                forceTranscode: true
            };
        }

        // Configure Resize
        if (resize && resize.width && resize.height) {
            videoConfig.width = resize.width;
            videoConfig.height = resize.height;
            videoConfig.fit = 'fill'; // Match exact dimensions
            videoConfig.forceTranscode = true;
        }

        const conversion = await MediaBunny.Conversion.init({
            input: input,
            output: output,
            video: videoConfig,
            trim: trim // Pass trim options directly to init
        });

        if (onProgress) {
            conversion.onProgress = onProgress;
        }

        await conversion.execute();

        return new Blob([output.target.buffer], { type: `video/${format}` });
    }
    /**
     * Get tracks from media
     * @param {Blob|File} source
     * @returns {Promise<{video: Array, audio: Array}>}
     */
    static async getTracks(source) {
        const blobSource = new MediaBunny.BlobSource(source);
        const input = new MediaBunny.Input({
            source: blobSource,
            formats: MediaBunny.ALL_FORMATS
        });

        const videoTracks = await input.getVideoTracks();
        const audioTracks = await input.getAudioTracks();

        // Enrich tracks with computed duration and codec string
        const formatTrackInfo = async (tracks) => {
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
            video: await formatTrackInfo(videoTracks),
            audio: await formatTrackInfo(audioTracks)
        };
    }

    /**
     * Extract a specific track
     * @param {Object} options
     * @param {Blob|File} options.source
     * @param {number} options.trackIndex - Index of the track in its type list (0-based)
     * @param {string} options.trackType - 'video' or 'audio'
     * @param {string} options.format - 'mp4' (video) or 'm4a'/'mp3' (audio)
     * @param {Function} [options.onProgress]
     * @returns {Promise<Blob>}
     */
    static async extractTrack({ source, trackIndex, trackType, format, onProgress }) {
        const blobSource = source instanceof Blob ? new MediaBunny.BlobSource(source) : new MediaBunny.BufferSource(source);
        const input = new MediaBunny.Input({
            source: blobSource,
            formats: MediaBunny.ALL_FORMATS
        });

        let outputFormat;
        switch (format) {
            case 'mp4':
            case 'm4a':
                outputFormat = new MediaBunny.Mp4OutputFormat();
                break;
            case 'mp3':
                outputFormat = new MediaBunny.Mp3OutputFormat();
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

        const config = {
            input: input,
            output: output,
            video: (t, i) => {
                // MediaBunny uses 1-based indexing for tracks in the callback
                const keep = trackType === 'video' && (i - 1) === trackIndex;
                console.log(`[MediaProcessor] Video track ${i} (${t.codec}): ${keep ? 'KEEP' : 'DISCARD'} (Target: ${trackType} #${trackIndex})`);
                return keep ? {} : { discard: true };
            },
            audio: (t, i) => {
                // MediaBunny uses 1-based indexing for tracks in the callback
                const keep = trackType === 'audio' && (i - 1) === trackIndex;
                console.log(`[MediaProcessor] Audio track ${i} (${t.codec}): ${keep ? 'KEEP' : 'DISCARD'} (Target: ${trackType} #${trackIndex})`);
                return keep ? {} : { discard: true };
            }
        };

        const conversion = await MediaBunny.Conversion.init(config);

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
