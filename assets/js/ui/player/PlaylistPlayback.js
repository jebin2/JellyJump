import { Logger } from '../../shared/utils/Logger.js';
import { unlockIfEncrypted } from './EncryptedPlayback.js';
import { classifyPlaylistItem } from './PlaylistItemKind.js';
import { Toast } from '../../shared/utils/Toast.js';
import { ConfirmDialog } from '../../shared/utils/ConfirmDialog.js';
import { RecordMenu } from '../menus/features/RecordMenu.js';
import { ScreenRecorderMenu } from '../menus/features/ScreenRecorderMenu.js';
import { MediaMetadata } from '../../shared/utils/MediaMetadata.js';

/**
 * Fired on window by selectItem, with {index, item}: what the playlist plays
 * now (the edit panel follows it).
 */
export const ITEM_SELECTED_EVENT = 'jellyjump:item-selected';

/**
 * Playing an item: selecting it, getting its source (stored file, stream,
 * YouTube), letting go of the one before, and its subtitles.
 *
 * Part of the playlist (ARCHITECTURE_PLAN.md, phase E). These are
 * `Playlist` methods, kept in a file of their own and added to
 * `Playlist.prototype` (see the end of Playlist.js): `this` is the
 * playlist, and they call each other and the rest of it as before.
 */
export const PlaylistPlayback = {
    /**
     * Initialize keyboard and player navigation
     * @private
     */
    async _initPlayerNavigation() {
        if (!this.player) return;
        
        this.player.setNavigationCallbacks(
            () => this.playPrevious(),
            () => this.playNext()
        );

        // Auto-advance when the current item ends. On the last item this stops,
        // unless the loop mode is 'playlist', where it wraps to the first.
        this.player.onEnded = () => this.playNext();

        // Changing the loop mode changes whether a next item exists, so the
        // prev/next buttons have to be re-evaluated when it does.
        this.player.on('loopmodechange', () => this._updatePlayerNavigationState());

        this.player.setPlayCallback(() => {
            if (this.items.length > 0 && this.activeIndex === -1) {
                ConfirmDialog.alert({
                    title: 'No Video Selected',
                    message: 'Please select a video from the playlist to play.',
                    confirmText: 'OK',
                    icon: '📺'
                });
            } else if (this.items.length === 0) {
                ConfirmDialog.alert({
                    title: 'Playlist Empty',
                    message: 'Add videos to the playlist using the upload button or paste a URL.',
                    confirmText: 'OK',
                    icon: '📂'
                });
            }
        });
    },

    /**
     * Stop playback and show 'Select video to play' message
     * Called when active video/folder is deleted
     * @private
     */
    _stopPlayback() {
        this.activeIndex = -1;
        this.player.reset();
        this._updateUI();
        this._updatePlayerNavigationState();
        Logger.log('[Playlist] Playback stopped - select a video to play');
    },

    /**
     * Select and play a video by index
     * @param {number} index 
     * @param {boolean} autoplay - Whether to start playing immediately
     */

    /**
     * A YouTube watch page: handed straight to the player, which gives it to
     * YouTube's iframe. Nothing below the dispatch applies -- caching, metadata
     * and thumbnails all assume a fetchable media file, and a watch page is not
     * one.
     */
    async _playYouTubeItem(video, autoplay) {
        await this.player.load(video.url, autoplay, video.id, null);
        this._clearLoadGuard();
        this.save();
    },

    /**
     * An HLS or live URL, loaded without the metadata pass.
     *
     * The LIVE badge goes up before the load is known to succeed, because
     * waiting makes selecting a live item feel broken; the catch puts it back
     * down, which is the only reason the load is wrapped at all.
     */
    async _playStreamItem(video, index, autoplay) {
        video.isStream = true; // Mark for metadata prefetch skip

        const showLiveImmediately = video.isLive || video.url?.includes('.m3u8');
        if (showLiveImmediately) {
            this.player.isLive = true;
            this.player.announce?.streamState();
        }

        try {
            // For streams, use autoplay directly - user clicked to play
            await this.player.load(video.url, autoplay, video.id, null);
        } catch (e) {
            if (showLiveImmediately) {
                this.player.isLive = false;
                this.player.announce?.streamState();
            }
            throw e;
        }

        this._updateStreamItemMetadata(video, index);
        this._clearLoadGuard();
        this.save();
    },

    /**
     * Make sure the item has something the player can open.
     *
     * A remote URL is served from the cache when it is there and streamed
     * straight from the network when it is not, caching behind the playback so
     * the next time is instant. A local file is pulled out of storage. A file
     * that has gone missing takes the whole item with it: it is removed from
     * the playlist and the next one starts, which is why this reports back
     * rather than throwing -- the caller has nothing left to load.
     *
     * @returns {Promise<boolean>} false when the item is gone and selectItem
     *          should stop; true when there is a source to play.
     */
    async _ensureItemSource(video, index, autoplay) {
        if (video.blob_url) return true;

        try {
            // OPTIMIZATION: For remote URLs, check cache first.
            // If not in cache, play directly from URL and cache in background.
            if (!video.isLocal && video.url && !video.isStream) {
                const cachedBlob = await MediaMetadata.checkCache(video);

                if (cachedBlob) {
                    Logger.log(`[Playlist] Playing from cache: ${video.title}`);
                    video.blob_url = URL.createObjectURL(cachedBlob);
                    // Mark as having file so we don't try to download again
                    video.file = cachedBlob;
                } else {
                    Logger.log(`[Playlist] Playing directly from URL (background caching): ${video.title}`);
                    // Direct playback
                    video.blob_url = video.url;

                    // Not for shared libraries: caching downloads the
                    // whole file, which defeats streaming a multi-GB
                    // movie over the network and fills storage with a
                    // copy of someone else's library.
                    if (!video.isRemoteLibrary) MediaMetadata.cacheInBackground(video, () => {
                        Logger.log(`[Playlist] Background cache complete for: ${video.title}`);
                        this.save();
                    });
                }
            } else {
                // Local files or legacy behavior
                if (this.player && typeof this.player._setLoading === 'function') {
                    this.player._setLoading(true);
                } else if (this.player.ui && this.player.ui.loader) {
                    this.player.ui.loader.classList.add('visible');
                }
                Logger.log(`Loading file from storage: ${video.title}`);
                this.player.already_fetching = true;
                await MediaMetadata.getProcessedSourceURL(video);
            }

            if (this.player.already_fetching) {
                // This reads empty and is not. If the resolve above did not
                // produce a blob_url, `.startsWith` throws here, the catch
                // below removes the item and the playlist moves on -- which is
                // the handling for a file that has gone missing. Collapsing
                // the test would leave such an item in the list and merely
                // fail to play it.
                if (video.blob_url.startsWith('blob:')) {
                    // Keep it for a bit or let the player handle revocation
                }
                this.player.already_fetching = false;
            }
        } catch (e) {
            Logger.error('Error loading file from storage:', e);
            if (this.player && typeof this.player._setLoading === 'function') {
                this.player._setLoading(false);
            } else if (this.player.ui && this.player.ui.loader) {
                this.player.ui.loader.classList.remove('visible');
            }

            // Auto-remove and skip to next
            this._clearLoadGuard();
            Logger.warn(`File not found: ${video.title}. Removing and skipping.`);

            // 1. Data Removal (handles activeIndex adjustment)
            this.state.removeItem(index);
            this.save();
            this.render();

            // 2. Play next or loop back
            if (index < this.state.items.length) {
                this.selectItem(index, autoplay);
            } else if (this.state.items.length > 0 && this.player.loopMode === 'playlist') {
                this.selectItem(0, autoplay);
            } else {
                this._stopPlayback();
            }
            return false;
        }

        return true;
    },

    async selectItem(index, autoplay = true) {
        if (index < 0 || index >= this.items.length) return;

        // Show loading immediately for instant feedback
        if (this.player && typeof this.player._setLoading === 'function') {
            this.player._setLoading(true);
        }

        // Reset UI (clear canvas, reset time/progress)
        if (this.player && typeof this.player.resetUI === 'function') {
            this.player.resetUI();
        }

        // The item being left is let go of once the player has moved off it
        // (below, in finally). Revoking its URL here, while the player was
        // still reading it, failed those reads and set off retries (BUG-14).
        const previous = this.activeIndex !== index ? this.items[this.activeIndex] : null;

        try {
            const video = this.items[index];

            // One decision, taken once and in a tested order; the side effects
            // below stay exactly where they were.
            const itemKind = classifyPlaylistItem(video, {
                hasWebcamStream: !!ScreenRecorderMenu.stream,
            });

            if (itemKind === 'needsReload') {
                Toast.show('This local file needs to be re-uploaded.', 4000, true);
                return;
            }

            this.activeIndex = index;
            window.dispatchEvent(new CustomEvent(ITEM_SELECTED_EVENT, { detail: { index, item: video } }));

            // INSTANT FEEDBACK: Update UI immediately
            this._updateUI();
            this._updatePlayerNavigationState();

            // Handle Recording State (Stop if active)
            RecordMenu.handleItemChange(this);

            // Handle Live Webcam Restore
            if (video.isWebcam) {
                Logger.log('[Playlist] Selecting Live Webcam Item');
                if (itemKind === 'webcam') {
                    Logger.log('[Playlist] Restoring live webcam stream');
                    await this.player.loadWebcamStream(ScreenRecorderMenu.stream);
                    this.activeIndex = index;
                    this._updateUI();
                    this._isSelectingItem = false;
                    return;
                } else {
                    Logger.warn('[Playlist] Webcam item selected but no stream found in ScreenRecorderMenu');
                }
            }

            // Mark this item as "loading" so a hard crash during the load
            // (WebKit killing the page on a too-heavy file) is detectable on
            // the next launch and the item is not auto-restored into a
            // crash loop. Cleared once the player has the media loaded.
            this._setLoadGuard(video);

            // Handle streams (HLS/Live) - load directly without MediaMetadata processing
            // YouTube goes straight to the player, which hands it to YouTube's
            // iframe. Everything below this — caching, metadata extraction,
            // thumbnail generation — assumes a fetchable media file, and a
            // watch page is not one: the cache path would download HTML and the
            // demuxer would reject it.
            if (itemKind === 'youtube') {
                await this._playYouTubeItem(video, autoplay);
                return;
            }

            if (itemKind === 'stream') {
                await this._playStreamItem(video, index, autoplay);
                return;
            }

            if (!await this._ensureItemSource(video, index, autoplay)) return;

            // Final safety check: Ensure we have a valid URL before loading
            if (!video.blob_url) {
                Logger.error('Video URL is null, cannot load:', video.title);
                return;
            }

            // An encrypted carrier plays as its placeholder unless it is
            // unlocked first; this swaps blob_url over to the decrypted file.
            // Closing the password dialog means "don't play this", so stop
            // here rather than loading the placeholder they just declined.
            if (!await unlockIfEncrypted(video)) {
                this._clearLoadGuard();
                return;
            }

            this._saveSubtitleChanges(video);

            // Subtitles saved with the item come back with it.
            await this.player.load(video.blob_url, autoplay, video.id, video.subtitleTracks || null);
            this._clearLoadGuard();
            await this._loadFoundSubtitles(video);

            // Update item metadata (duration and thumbnail) after video loads
            this._updateLocalItemMetadata(video, index);

            this.save();

            if (autoplay) {
                this.player.play();
            }

            // Prefetch metadata asynchronously (non-blocking)
            this._prefetchMetadata(video);
        } finally {
            this._isSelectingItem = false;
            // Only if it really was left: a switch that stopped early keeps it.
            if (previous && previous !== this.items[this.activeIndex]) this._releaseItem(previous);
        }
    },

    /**
     * Let go of an item's file once another is selected. The playback blob
     * URL is revoked, not just dropped, or the blob stays pinned in the
     * browser's blob store for the page's lifetime; getProcessedSourceURL
     * recreates it on a revisit.
     * @param {Object|undefined} item
     * @private
     */
    _releaseItem(item) {
        if (!item) return;
        if (item.blob_url && item.blob_url.startsWith('blob:')) {
            URL.revokeObjectURL(item.blob_url);
        }
        item.blob_url = null;

        if (item.isLocal && item.url) {
            Logger.log(`Releasing memory for: ${item.title}`);
            URL.revokeObjectURL(item.url);
            item.url = null;
            // The file itself stays. Storage lets go of a file once it has
            // kept it (IndexedDB) or can read it from disk again (desktop),
            // so one still here is one it could not keep: a copy too large
            // for IndexedDB, or an edited copy on desktop, which has no path
            // on disk. Dropping it here lost that video for good (BUG-6);
            // the URL is made again from it on the next visit.
        }
    },

    /**
     * Keep the subtitle tracks the user adds to this item, so they come back
     * when it is played again.
     * @private
     */
    _saveSubtitleChanges(video) {
        this.player.onSubtitleChange = (subtitleTracks) => {
            video.subtitleTracks = subtitleTracks.map(track => ({
                id: track.id,
                name: track.name,
                cues: [...track.cues]
            }));
            this.save();
            Logger.log(`Saved ${subtitleTracks.length} subtitle track(s) for: ${video.title}`);
        };
    },

    /**
     * Load the subtitle files found beside the item -- uploaded with it,
     * found by a scan, or listed by a shared library. One that fails to load
     * is logged and skipped; the video plays either way.
     * @private
     */
    async _loadFoundSubtitles(video) {
        const sources = [];
        if (video.subtitleFile) {
            if (video.subtitleUrl) URL.revokeObjectURL(video.subtitleUrl);
            video.subtitleUrl = URL.createObjectURL(video.subtitleFile);
            sources.push(video.subtitleUrl);
        } else if (video.subtitlePath) {
            sources.push(video.subtitlePath);
        }
        if (Array.isArray(video.subtitlePaths)) sources.push(...video.subtitlePaths);
        if (Array.isArray(video.subtitleUrls)) sources.push(...video.subtitleUrls);

        for (const subUrl of new Set(sources.filter(Boolean))) {
            try {
                Logger.log(`[Playlist] Loading auto-detected subtitle: ${subUrl}`);
                await this.player.loadSubtitle(subUrl);
            } catch (e) {
                Logger.error('[Playlist] Failed to load auto-detected subtitle:', e);
            }
        }
    },
};
