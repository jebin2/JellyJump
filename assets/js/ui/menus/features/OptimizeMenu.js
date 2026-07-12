import { Logger } from '../../../shared/utils/Logger.js';
import { Modal } from '../../Modal.js';
import { Toast } from '../../../shared/utils/Toast.js';
import { MediaBunny } from '../../../core/MediaBunny.js';
import { MediaProcessor } from '../../../core/MediaProcessor.js';
import { MediaMetadata } from '../../../shared/utils/MediaMetadata.js';

/**
 * Optimize Menu
 * On phones, videos above 1080p overwhelm WebKit (a 4K recording can be
 * killed by iOS mid-decode). When such a local file is added, offer a
 * one-time on-device transcode down to 1080p; the optimized copy replaces
 * the original as the item's stored source.
 */
export const OptimizeMenu = {
    // Long side above which we offer optimization, and the target long side.
    THRESHOLD: 1920,
    TARGET: 1920,

    _promptOpen: false,

    _isMobile() {
        return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    },

    /**
     * Offer optimization for a freshly added local item (call after its
     * metadata is known). No-op unless on a phone with a >1080p video.
     * @param {Object} item - Playlist item with videoInfo populated
     * @param {Playlist} playlist
     */
    maybeOffer(item, playlist) {
        if (!this._isMobile()) return;
        if (!item || !item.isLocal || item.isAudio || !item.videoInfo) return;
        if (item.optimizeDeclined || item._optimizing || item._optimizeOffered) return;

        const info = item.videoInfo;
        const w = info.displayWidth || info.width;
        const h = info.displayHeight || info.height;
        if (!w || !h || Math.max(w, h) <= this.THRESHOLD) return;

        if (this._promptOpen) return;
        item._optimizeOffered = true;
        this._showPrompt(item, playlist, w, h);
    },

    _showPrompt(item, playlist, w, h) {
        this._promptOpen = true;

        const modal = new Modal({ maxWidth: '420px' });
        modal.setTitle('Optimize for this device?');

        const body = document.createElement('div');
        body.innerHTML = `
            <p style="margin-bottom:10px;">"${item.title}" is ${w}×${h} — larger than this device can play smoothly.</p>
            <p class="text-secondary" style="font-size:0.9em;">JellyJump can convert it to 1080p once, right on this device. The converted copy replaces the original in your playlist (the source file on your phone is untouched).</p>
        `;
        modal.setBody(body);

        const footer = document.createElement('div');
        footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
        const skipBtn = document.createElement('button');
        skipBtn.className = 'btn jellyjump-btn-small';
        skipBtn.textContent = 'Not now';
        const okBtn = document.createElement('button');
        okBtn.className = 'btn jellyjump-btn-small';
        okBtn.textContent = 'Optimize to 1080p';
        footer.appendChild(skipBtn);
        footer.appendChild(okBtn);
        modal.setFooter(footer);

        const close = () => {
            this._promptOpen = false;
            modal.close();
        };

        skipBtn.addEventListener('click', () => {
            item.optimizeDeclined = true;
            playlist._saveState();
            close();
        });

        okBtn.addEventListener('click', () => {
            close();
            this._optimize(item, playlist).catch((e) => {
                Logger.error('[Optimize] Failed:', e);
            });
        });

        modal.open();
    },

    /**
     * Run the transcode and swap the item's source to the optimized copy.
     * @private
     */
    async _optimize(item, playlist) {
        const info = item.videoInfo;
        const srcW = info.displayWidth || info.width;
        const srcH = info.displayHeight || info.height;
        const scale = this.TARGET / Math.max(srcW, srcH);
        const width = Math.max(2, Math.round((srcW * scale) / 2) * 2);
        const height = Math.max(2, Math.round((srcH * scale) / 2) * 2);

        item._optimizing = true;
        const originalDuration = item.duration;
        // Reuse the crash-loop guard: if this transcode is heavy enough to
        // get the page killed, the next launch must not auto-restore into
        // the same situation.
        playlist._setLoadGuard(item);

        try {
            const source = item.file || await MediaMetadata.getSourceBlob(item);

            // Prefer H.264/MP4 (hardware-encoded on iPhones); fall back to
            // VP9/WebM where no AVC encoder is available.
            const useAvc = await MediaBunny.canEncodeVideo('avc');
            const format = useAvc ? 'mp4' : 'webm';

            Logger.log(`[Optimize] ${item.title}: ${srcW}x${srcH} -> ${width}x${height} (${format})`);

            let lastPct = -1;
            const blob = await MediaProcessor.process({
                source,
                format,
                quality: 80,
                resolution: { width, height },
                onProgress: (p) => {
                    const pct = Math.round(p * 100);
                    if (pct !== lastPct) {
                        lastPct = pct;
                        item.duration = `Optimizing ${pct}%`;
                        playlist._updateItemUI(item);
                    }
                }
            });

            // Swap the item's source to the optimized copy. _saveState()
            // persists the new blob under the same item id, overwriting
            // (discarding) the original in storage.
            if (item.url && item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
            if (item.blob_url && item.blob_url.startsWith('blob:')) URL.revokeObjectURL(item.blob_url);
            item.blob_url = null;

            const baseName = (item.title || 'video').replace(/\.[^/.]+$/, '');
            item.file = new File([blob], `${baseName}.${format}`, { type: blob.type });
            item.url = URL.createObjectURL(item.file);
            item.fileSize = blob.size;
            item.fileType = blob.type;
            item.mimeType = blob.type;
            item.videoInfo = null;
            item.audioInfo = null;
            item.videoTracks = null;
            item.audioTracks = null;
            item.duration = 'Loading...';

            await MediaMetadata.ensureMetadata(item, () => playlist._saveState());

            item._optimizing = false;
            playlist._clearLoadGuard();
            playlist._saveState();
            playlist.render();
            Toast.show(`Optimized "${item.title}" to 1080p`);

            // If this item is on screen, reload the player with the new source
            const index = playlist.items.indexOf(item);
            if (index !== -1 && index === playlist.activeIndex) {
                playlist.selectItem(index, false);
            }
        } catch (e) {
            item._optimizing = false;
            item.duration = originalDuration;
            playlist._clearLoadGuard();
            playlist._updateItemUI(item);
            Toast.show(`Could not optimize: ${e.message}`, 4000, true);
            throw e;
        }
    }
};
