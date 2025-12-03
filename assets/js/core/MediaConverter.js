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
}
