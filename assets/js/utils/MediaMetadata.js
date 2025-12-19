import { MediaBunny } from '../core/MediaBunny.js';
import { MediaProcessor } from '../core/MediaProcessor.js';
import { IndexedDBService } from '../player/IndexedDBService.js';
import { formatDuration } from './mediaUtils.js';
import { ElectronHelper } from './ElectronHelper.js';

// Shared IndexedDB instance for caching remote blobs
const _dbService = new IndexedDBService();

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
     * Check if item is already cached in IndexedDB
     * @param {Object} item 
     * @returns {Promise<Blob|null>}
     */
    static async checkCache(item) {
        if (!item.id) return null;

        try {
            const file = await _dbService.loadFile(item.id);
            if (file) {
                console.log('[Cache] Found in cache:', item.title);
                return file;
            }
        } catch (e) {
            console.warn('[Cache] Error checking cache:', e);
        }
        return null;
    }

    /**
     * Cache a remote URL in the background
     * @param {Object} item 
     * @param {Function} [onSave] 
     */
    static async cacheInBackground(item, onSave) {
        if (!item.url || !item.id) return;

        console.log('[Cache] Starting background cache for:', item.title);

        try {
            // Check if already cached first to avoid redundant download
            const existing = await this.checkCache(item);
            if (existing) {
                console.log('[Cache] Item already cached, skipping download:', item.title);
                return;
            }

            const response = await fetch(item.url);
            if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);

            const blob = await response.blob();
            const sizeMB = blob.size / 1024 / 1024;
            const MAX_CACHE_SIZE_MB = 500;

            if (sizeMB > MAX_CACHE_SIZE_MB) {
                console.warn(`[Cache] Video too large to cache (${sizeMB.toFixed(2)} MB)`);
                return;
            }

            const filename = item.title || 'video';
            const saved = await _dbService.saveFile(item.id, blob, filename, blob.type);

            if (saved) {
                console.log('[Cache] Successfully cached in background:', item.title);
                if (onSave) onSave();
            }
        } catch (error) {
            console.warn('[Cache] Background caching failed:', error);
        }
    }

    /**
     * Get source blob for an item (with caching for remote URLs)
     * For remote URLs: downloads, saves to IndexedDB, then releases from memory
     * For local files: loads from IndexedDB on-demand if not in memory
     * For Electron: reads directly from disk using localPath
     * @param {Object} item - Playlist item  
     * @param {Function} [onSave] - Optional callback to save state after caching
     * @returns {Promise<Blob>} Source blob
     */
    static async getSourceBlob(item, onSave) {
        // 1. If file is already in memory, return it
        if (item.file) {
            return item.file;
        }

        // 2. Electron: If we have a localPath, read directly from disk
        if (ElectronHelper.isElectron() && item.localPath) {
            const exists = await ElectronHelper.fileExists(item.localPath);
            if (!exists) {
                throw new Error('File no longer exists at path: ' + item.localPath);
            }

            const blob = await ElectronHelper.readFileAsBlob(item.localPath, item.mimeType);
            if (!blob) {
                throw new Error('Failed to read file from disk');
            }
            return blob;
        }

        // 3. Check IndexedDB Cache
        const cachedFile = await this.checkCache(item);
        if (cachedFile) {
            return cachedFile;
        }

        // 4. Remote URL - fetch and persist to IndexedDB (Blocking Legacy Mode)
        // Note: For better UX, use cacheInBackground() in the UI layer instead of this blocking call
        if (item.url) {
            console.log('[Cache] Fetching remote video (blocking):', item.title);

            const response = await fetch(item.url);
            if (!response.ok) {
                throw new Error(`Failed to fetch video: ${response.statusText}`);
            }

            const blob = await response.blob();
            const sizeMB = blob.size / 1024 / 1024;

            // Size limit check (500MB default)
            const MAX_CACHE_SIZE_MB = 500;
            if (sizeMB > MAX_CACHE_SIZE_MB) {
                console.warn(`[Cache] Video too large to cache (${sizeMB.toFixed(2)} MB)`);
                return blob; // Return without caching
            }

            // Save to IndexedDB for persistence
            if (item.id) {
                const filename = item.title || 'video';
                const saved = await _dbService.saveFile(item.id, blob, filename, blob.type);
                if (saved) {
                    if (onSave) onSave();
                    console.log('[Cache] Blob persisted to IndexedDB:', item.title);
                }
            }

            return blob;
        }

        throw new Error('No source available for item');
    }

    static async getProcessedSourceURL(item, onSave) {
        if (item.blob_url && item.blob_url.startsWith('blob:')) {
            return item.blob_url;
        }

        const file = await this.getSourceBlob(item, onSave);

        item.blob_url = URL.createObjectURL(file);
        return item.blob_url;
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
        const blobUrl = await MediaMetadata.getProcessedSourceURL(item, onSave);

        const { videoInfo, audioInfo, duration, videoTracks, audioTracks } = await MediaProcessor.getMetadata(blobUrl);
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
