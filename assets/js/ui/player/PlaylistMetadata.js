import { Logger } from '../../shared/utils/Logger.js';
import { Toast } from '../../shared/utils/Toast.js';
import { formatTime } from '../../shared/utils/mediaUtils.js';

/**
 * Reading what items are: durations and details, stream thumbnails, items
 * that turn out broken, and checking an M3U folder's streams.
 *
 * Part of the playlist (ARCHITECTURE_PLAN.md, phase E). These are
 * `Playlist` methods, kept in a file of their own and added to
 * `Playlist.prototype` (see the end of Playlist.js): `this` is the
 * playlist, and they call each other and the rest of it as before.
 */
export const PlaylistMetadata = {
    /**
     * Read the duration and details of new items, showing each as it comes.
     * @param {Object[]} items
     */
    async processMetadata(items) {
        await this.processor.processMetadata(
            items,
            (item) => this._updateItemUI(item),
            () => this.save()
        );
    },

    /**
     * Read one item's details if it has none yet (tools need them).
     * @param {Object} item
     */
    async ensureMetadata(item) {
        await this.processor.ensureMetadata(item, () => this.save());
    },

    /**
     * Prefetch metadata for a video asynchronously (non-blocking)
     * This improves UX when user opens Video Info or uses operations
     * @param {Object} item - Playlist item
     * @private
     */
    async _prefetchMetadata(item) {
        // Don't prefetch for streams (HLS/M3U8) - MediaBunny doesn't understand them
        if (item.isStream) {
            Logger.log('[Playlist] Skipping metadata prefetch for stream:', item.title);
            return;
        }

        // Don't prefetch if already cached
        if (item.videoInfo || item.audioInfo) {
            Logger.log('[Playlist] Metadata already cached for:', item.title);
            return;
        }

        // Don't block - this runs in background
        try {
            Logger.log('[Playlist] Prefetching metadata for:', item.title);
            await this.ensureMetadata(item);
            Logger.log('[Playlist] Metadata prefetch complete:', item.title);
        } catch (error) {
            Logger.warn('[Playlist] Metadata prefetch failed for:', item.title, error);
            // Non-critical error - will retry if user opens info/trim
        }
    },

    _updateItemUI(item) {
        this.renderer.updateItemUI(item);
    },

    /**
     * Update stream item metadata after loading (duration and thumbnail)
     * @param {Object} video - Video item
     * @param {number} index - Item index
     * @private
     */
    _updateStreamItemMetadata(video, index) {
        // Determine if it's live or VOD based on player state
        const isLive = this.player.isLive;

        // Update duration display
        if (isLive) {
            video.duration = 'LIVE';
            video.isLive = true;
        } else {
            // VOD stream - get actual duration when available
            const checkDuration = () => {
                if (this.player.duration && this.player.duration > 0) {
                    video.duration = formatTime(this.player.duration);
                    this._updateItemUI(video);
                    this.save();
                }
            };
            // Check after a short delay for metadata to load
            setTimeout(checkDuration, 500);
            setTimeout(checkDuration, 2000); // Retry if first didn't work
        }

        // Capture thumbnail after video starts playing
        this._captureStreamThumbnail(video, index);

        // Update UI immediately for live badge
        this._updateItemUI(video);
    },

    /**
     * Capture thumbnail from stream video
     * @param {Object} video - Video item
     * @param {number} index - Item index
     * @private
     */
    _captureStreamThumbnail(video, index) {
        // Generate a unique capture ID to handle video switches
        const captureId = ++this._thumbnailCaptureId || 1;
        this._thumbnailCaptureId = captureId;

        // Clear any existing stale thumbnail from previous video
        if (video.thumbnail) {
            Logger.log(`[Playlist] Keeping existing thumbnail for: ${video.title}`);
            return;
        }

        // Define the capture callback
        const captureCallback = (canvas, ctx) => {
            // Check if capture was invalidated (user switched videos)
            if (this._thumbnailCaptureId !== captureId || this.activeIndex !== index) {
                // Remove this callback as it's no longer valid
                this.player.afterFrameRenderCallbacks = this.player.afterFrameRenderCallbacks.filter(cb => cb !== captureCallback);
                return;
            }

            try {
                // Check content (simple non-black check) to avoid capturing empty/loading frames
                // We sample the center of the canvas to avoid reading the whole large buffer
                const w = canvas.width;
                const h = canvas.height;
                const sampleW = Math.min(w, 50); // Sample a small center patch
                const sampleH = Math.min(h, 50);
                const sampleX = Math.floor((w - sampleW) / 2);
                const sampleY = Math.floor((h - sampleH) / 2);

                const imageData = ctx.getImageData(sampleX, sampleY, sampleW, sampleH);
                const data = imageData.data;
                let nonBlackPixels = 0;
                const threshold = 15;

                // Check sample
                for (let i = 0; i < data.length; i += 4) {
                    // r,g,b > threshold
                    if (data[i] > threshold || data[i + 1] > threshold || data[i + 2] > threshold) {
                        nonBlackPixels++;
                    }
                }

                // If sample is pitch black, wait
                if (nonBlackPixels < (data.length / 4) * 0.05) {
                    return;
                }

                // Success!
                // Captured directly constitutes a larger thumbnail but meets "Direct" requirement
                // We use 0.7 quality to keep size somewhat reasonable
                video.thumbnail = canvas.toDataURL('image/jpeg', 0.7);

                this._updateItemUI(video);
                this.save();
                Logger.log(`[Playlist] Captured thumbnail via render loop for: ${video.title}`);

                // Remove the callback since we're done
                this.player.afterFrameRenderCallbacks = this.player.afterFrameRenderCallbacks.filter(cb => cb !== captureCallback);

            } catch (e) {
                Logger.warn('[Playlist] Failed to capture thumbnail in render loop:', e);
                // Remove callback on error
                this.player.afterFrameRenderCallbacks = this.player.afterFrameRenderCallbacks.filter(cb => cb !== captureCallback);
            }
        };

        // Register the callback
        this.player.afterFrameRenderCallbacks.push(captureCallback);

        // Safety timeout: remove callback if it never fires (e.g. stream fails)
        setTimeout(() => {
            if (this.player.afterFrameRenderCallbacks.includes(captureCallback)) {
                this.player.afterFrameRenderCallbacks = this.player.afterFrameRenderCallbacks.filter(cb => cb !== captureCallback);
            }
        }, 60000);
    },

    /**
     * Update local video item metadata after loading (duration and thumbnail)
     * @param {Object} video - Video item
     * @param {number} index - Item index
     * @private
     */
    async _updateLocalItemMetadata(video, index) {
        // Update duration when metadata is available
        const updateDuration = () => {
            if (this.player.duration && this.player.duration > 0) {
                const newDuration = formatTime(this.player.duration);
                if (video.duration !== newDuration) {
                    video.duration = newDuration;
                    this._updateItemUI(video);
                    this.save();
                }
            }
        };

        // Check duration after metadata loads
        setTimeout(updateDuration, 300);
        setTimeout(updateDuration, 1000); // Retry if first didn't work

        // Capture thumbnail using render loop (unified method)
        this._captureStreamThumbnail(video, index);
    },

    /**
     * Mark a playlist item as broken (stream failed to load)
     * @param {string} itemId - ID of the item to mark as broken
     * @param {string} [error] - Optional error message
     */
    markItemBroken(itemId, error) {
        const item = this.items.find(i => i.id === itemId);
        if (!item || item.isBroken) return;

        item.isBroken = true;
        item.errorMessage = error || 'Stream unavailable';
        Logger.log(`[Playlist] Marked as broken: ${item.title}`);

        this.renderer.markItemBrokenInDOM(item.id);
        this.save();
    },

    /**
     * Validate streams in a folder (check if they're accessible)
     * @param {string} folderPath - Path of the folder to validate
     * @param {string} m3uSource - Source URL of the M3U (for reference)
     * @private
     */
    async _validateStreams(folderPath, m3uSource) {
        // Get all stream items in this folder
        const prefix = folderPath + '/';
        const folderItems = this.state.items.filter(item => {
            const path = item.path || '';
            return path.startsWith(prefix) && item.isStream;
        });

        const { ValidationModal } = await import('../menus/features/ValidationModal.js');
        await ValidationModal.show({
            items: folderItems,
            processor: this.processor,
            onToast: (msg) => Toast.show(msg),
            onComplete: () => {
                this.save();
                this.render();
            }
        });
    },
};
