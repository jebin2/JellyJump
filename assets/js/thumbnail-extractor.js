/**
 * ThumbnailExtractor
 * Extracts and manages video thumbnails for timeline clips.
 */
class ThumbnailExtractor {
    constructor() {
        this.cache = new Map(); // Memory cache: mediaId -> dataURL
        this.pending = new Map(); // Pending extractions: mediaId -> Promise
    }

    /**
     * Get thumbnail for a media item.
     * If cached, returns immediately.
     * If not, triggers extraction and returns null (updates later).
     * @param {string} mediaId 
     * @returns {string|null} Data URL or null
     */
    getThumbnail(mediaId) {
        if (this.cache.has(mediaId)) {
            return this.cache.get(mediaId);
        }

        // If not cached and not pending, trigger extraction
        if (!this.pending.has(mediaId)) {
            this.extractThumbnail(mediaId);
        }

        return null;
    }

    /**
     * Extract thumbnail for a media ID
     * @param {string} mediaId 
     */
    async extractThumbnail(mediaId) {
        if (this.pending.has(mediaId)) return this.pending.get(mediaId);

        const promise = (async () => {
            try {
                // Get media file from IndexedDB
                if (!window.indexedDBHelper) {
                    console.error('IndexedDBHelper not available');
                    return null;
                }

                const media = await window.indexedDBHelper.getMedia(mediaId);
                if (!media || !media.type.startsWith('video')) {
                    return null; // Only for videos
                }

                // Generate thumbnail
                const dataURL = await this.generateThumbnail(media.file || media.blob); // Handle different property names

                // Cache it
                if (dataURL) {
                    this.cache.set(mediaId, dataURL);

                    // Notify listeners (ClipRenderer)
                    const event = new CustomEvent('thumbnail-ready', {
                        detail: { mediaId, thumbnail: dataURL }
                    });
                    window.dispatchEvent(event);
                }

                return dataURL;
            } catch (err) {
                console.error('Error extracting thumbnail:', err);
                return null;
            } finally {
                this.pending.delete(mediaId);
            }
        })();

        this.pending.set(mediaId, promise);
        return promise;
    }

    /**
     * Generate thumbnail from file using a hidden video element
     * (Simpler than full MediaBunny Player for just one frame, but can switch if needed)
     * @param {File|Blob} file 
     * @returns {Promise<string>} Data URL
     */
    generateThumbnail(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }

            const video = document.createElement('video');
            video.preload = 'metadata';
            video.muted = true;
            video.playsInline = true;

            const url = URL.createObjectURL(file);
            video.src = url;

            video.onloadeddata = () => {
                // Seek to 0 (or slightly after to avoid black frames if needed)
                video.currentTime = 0.1;
            };

            video.onseeked = () => {
                try {
                    const canvas = document.createElement('canvas');
                    // Small resolution for thumbnails
                    canvas.width = 160;
                    canvas.height = 90;

                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    const dataURL = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataURL);
                } catch (e) {
                    reject(e);
                } finally {
                    URL.revokeObjectURL(url);
                    video.remove();
                }
            };

            video.onerror = (e) => {
                URL.revokeObjectURL(url);
                reject(new Error('Video load error'));
            };
        });
    }
}

// Initialize
window.thumbnailExtractor = new ThumbnailExtractor();
export default window.thumbnailExtractor;
