import { MediaBunny } from '../core/MediaBunny.js';
import { MediaProcessor } from '../core/MediaProcessor.js';
import { formatDuration } from './mediaUtils.js';

/**
 * Media Metadata Service
 * Handles extraction and processing of video/audio metadata using MediaBunny
 */
export class MediaMetadata {
    /**
     * Process metadata for multiple items (batch processing)
     * @param {Array} items - Playlist items to process
     * @param {Function} onUpdate - Callback when item metadata updates (item, callback)
     * @param {Function} onSave - Callback to save state after processing
     * @returns {Promise<void>}
     */
    static async processMetadata(items, onUpdate, onSave) {
        for (const item of items) {
            if (item.isLocal && item.file) {
                // Show loading state
                item.duration = 'Loading...';
                if (onUpdate) onUpdate(item);

                try {
                    await this.ensureMetadata(item, onSave);

                    // Update UI with actual data
                    if (onUpdate) onUpdate(item);
                    if (onSave) onSave();
                } catch (e) {
                    console.warn('Failed to load metadata for', item.title, e);
                    item.duration = '--:--';
                    if (onUpdate) onUpdate(item);
                }
            }
        }
    }


    /**
     * Get source blob for an item (with caching for remote URLs)
     * Fetches remote videos once and caches them on the item to avoid redundant downloads
     * @param {Object} item - Playlist item  
     * @param {Function} [onSave] - Optional callback to save state after caching
     * @returns {Promise<Blob>} Source blob
     */
    static async getSourceBlob(item, onSave) {
        // Local file - return directly
        if (item.file) {
            return item.file;
        }

        // Remote URL - fetch and cache
        if (item.url) {
            console.log('[Cache] Fetching remote video for caching:', item.title);

            const response = await fetch(item.url);
            if (!response.ok) {
                throw new Error(`Failed to fetch video: ${response.statusText}`);
            }

            const blob = await response.blob();
            const sizeMB = blob.size / 1024 / 1024;

            console.log(`[Cache] Downloaded ${sizeMB.toFixed(2)} MB`);

            // Size limit check (500MB default)
            const MAX_CACHE_SIZE_MB = 500;
            if (sizeMB > MAX_CACHE_SIZE_MB) {
                console.warn(`[Cache] Video too large to cache (${sizeMB.toFixed(2)} MB > ${MAX_CACHE_SIZE_MB} MB)`);
                console.warn('[Cache] Returning blob without caching (will re-fetch on next operation)');
                return blob; // Return without caching
            }

            // Cache the blob
            item.file = blob;
            item.isLocal = true; // Mark as locally available

            // Save to persistence
            if (onSave) {
                onSave();
            }

            console.log('[Cache] Blob cached on item:', item.title);
            return blob;
        }

        throw new Error('No source available for item');
    }

    /**
     * Ensure metadata exists on item (lazy load if missing)
     * @param {Object} item - Playlist item
     * @param {Function} onSave - Callback to save state after fetching
     * @returns {Promise<void>}
     */
    static async ensureMetadata(item, onSave) {
        // Already cached
        if (item.videoInfo || item.audioInfo) {
            return;
        }

        // Use helper to get source (with caching for remote URLs)
        const source = await MediaMetadata.getSourceBlob(item, onSave);

        const { videoInfo, audioInfo, duration, videoTracks, audioTracks } = await MediaProcessor.getMetadata(source);
        item.videoInfo = videoInfo;
        item.audioInfo = audioInfo;
        item.videoTracks = videoTracks;
        item.audioTracks = audioTracks;

        // Update duration if missing, placeholder, or loading
        if (!item.duration || item.duration === '--:--' || item.duration === 'Loading...') {
            item.duration = formatDuration(duration);
        }

        if (onSave) onSave();
    }

    /**
     * Get video duration using MediaBunny
     * @param {File|string} resource - File object or URL string
     * @returns {Promise<number>} Duration in seconds
     */
    static async getVideoDuration(resource) {
        try {
            // Create appropriate source based on resource type
            const source = resource instanceof File
                ? new MediaBunny.BlobSource(resource)
                : new MediaBunny.UrlSource(resource);

            const input = new MediaBunny.Input({
                source,
                formats: MediaBunny.ALL_FORMATS
            });

            const duration = await input.computeDuration();
            return duration;
        } catch (error) {
            console.error('Error getting video duration:', error);
            return 0;
        }
    }

    /**
     * Get formatted metadata for a file
     * @param {Blob} blob - Media file blob
     * @param {string} filename - Filename
     * @returns {Promise<Object>} { metadata: Object, videoTrack: VideoTrack }
     */
    static async getFormattedMetadata(blob, filename) {
        const input = new MediaBunny.Input({
            source: new MediaBunny.BlobSource(blob),
            formats: MediaBunny.ALL_FORMATS
        });

        const format = await input.getFormat();
        const tracks = await input.getTracks();
        const videoTrack = await input.getPrimaryVideoTrack();
        const audioTrack = await input.getPrimaryAudioTrack();

        // Helper: Format Bytes
        const formatBytes = (bytes, decimals = 1) => {
            if (bytes === 0) return '0 Bytes';
            const k = 1024;
            const dm = decimals < 0 ? 0 : decimals;
            const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
        };

        // Helper: Format Duration
        const formatDurationFull = (seconds) => {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            return [h, m, s]
                .map(v => v < 10 ? "0" + v : v)
                .filter((v, i) => v !== "00" || i > 0)
                .join(":");
        };

        // Helper: Get Codec Name
        const getCodecName = (codec) => {
            if (!codec) return 'N/A';
            return codec.toUpperCase();
        };

        const metadata = {
            filename: filename,
            format: format ? format.name : 'Unknown',
            mimeType: format ? format.mimeType : blob.type,
            size: formatBytes(blob.size),
            duration: formatDurationFull(videoTrack ? await videoTrack.computeDuration() : (audioTrack ? await audioTrack.computeDuration() : 0)),

            // Video
            videoCodec: videoTrack ? getCodecName(videoTrack.codec) : 'N/A',
            videoCodecString: videoTrack ? await videoTrack.getCodecParameterString() : 'N/A',
            resolution: videoTrack ? `${videoTrack.displayWidth}x${videoTrack.displayHeight}` : 'N/A',
            codedResolution: videoTrack ? `${videoTrack.codedWidth}x${videoTrack.codedHeight}` : 'N/A',
            fps: 'Calculating...',
            videoBitrate: 'Calculating...',
            rotation: videoTrack ? `${videoTrack.rotation}°` : 'N/A',
            hdr: videoTrack ? (await videoTrack.hasHighDynamicRange() ? 'Yes' : 'No') : 'N/A',

            // Audio
            audioCodec: audioTrack ? getCodecName(audioTrack.codec) : 'N/A',
            audioCodecString: audioTrack ? await audioTrack.getCodecParameterString() : 'N/A',
            channels: audioTrack ? (audioTrack.numberOfChannels === 2 ? 'Stereo (2)' : `${audioTrack.numberOfChannels} Channels`) : 'N/A',
            sampleRate: audioTrack ? `${(audioTrack.sampleRate / 1000).toFixed(1)} kHz` : 'N/A',
            language: audioTrack ? (audioTrack.languageCode === 'und' ? 'Undetermined' : audioTrack.languageCode) : 'N/A'
        };

        return { metadata, videoTrack };
    }
}
