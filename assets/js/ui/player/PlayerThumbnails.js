import { Logger } from '../../shared/utils/Logger.js';
import { formatTime } from '../../shared/utils/mediaUtils.js';
import { ThumbnailGenerator } from './ThumbnailGenerator.js';

/**
 * PlayerThumbnails - the hover preview strip over the progress bar.
 *
 * It owns its own state now. The generator, whether generation has started,
 * the hover debounce timer and the last hovered time all used to live on
 * Player and be reached back through `this.player`, which meant four of
 * Player's seventy-four fields existed solely for this file to mutate.
 *
 * Nothing outside reads any of it, so this moved without a single call site
 * changing: Player's six thumbnail methods still delegate here.
 */
export class PlayerThumbnails {
    constructor(player) {
        this.player = player;

        this.generator = null;
        this.generationStarted = false;
        this.hoverTimer = null;
        this.lastHoverTime = 0;

        if (player.config.controls.thumbnails) {
            this.generator = new ThumbnailGenerator();
            // Frames arrive over time, so repaint whatever the pointer is
            // currently sitting on as they do.
            this.generator.progressCallback = () => {
                const overlay = player.ui.thumbnailOverlay;
                if (overlay?.classList.contains('visible')) this.updateImage(this.lastHoverTime);
            };
        }
    }

    createOverlay() {
        const p = this.player;
        if (p.ui.thumbnailOverlay) return;

        const overlay = document.createElement('div');
        overlay.className = 'jellyjump-thumbnail-overlay';
        overlay.innerHTML = `
            <div class="jelly-loader"></div>
            <div class="jellyjump-thumbnail-time">00:00</div>
        `;
        p.container.appendChild(overlay);
        p.ui.thumbnailOverlay = overlay;
        p.ui.thumbnailTime = overlay.querySelector('.jellyjump-thumbnail-time');
        p.ui.thumbnailLoader = overlay.querySelector('.jelly-loader');
    }

    handleHover(e) {
        const p = this.player;
        if (p.isStreamMode || !p.ui.thumbnailOverlay) return;

        const rect = p.ui.progressContainer.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const pos = Math.max(0, Math.min(1, offsetX / rect.width));
        const time = pos * p.duration;

        p.ui.thumbnailOverlay.classList.add('visible');

        const overlayRect = p.ui.thumbnailOverlay.getBoundingClientRect();
        const containerRect = p.container.getBoundingClientRect();
        const relativeLeft = e.clientX - containerRect.left - (overlayRect.width / 2);
        const clampedRelLeft = Math.max(10, Math.min(relativeLeft, containerRect.width - overlayRect.width - 10));

        p.ui.thumbnailOverlay.style.left = `${clampedRelLeft}px`;
        p.ui.thumbnailOverlay.style.bottom = `${containerRect.bottom - rect.top + 15}px`;
        p.ui.thumbnailTime.textContent = formatTime(time);
        this.lastHoverTime = time;

        this.updateImage(time);
    }

    updateImage(time) {
        const p = this.player;
        if (!p.ui.thumbnailOverlay || !this.generator) return;

        const thumb = this.generator.getThumbnail(time);
        if (thumb) {
            p.ui.thumbnailOverlay.style.backgroundImage = `url(${thumb})`;
            p.ui.thumbnailLoader.style.display = 'none';
        } else {
            p.ui.thumbnailOverlay.style.backgroundImage = 'none';
            p.ui.thumbnailLoader.style.display = 'block';

            // Hovering briefly should not kick off a whole pass over the file.
            if (!this.generationStarted && !this.hoverTimer) {
                this.hoverTimer = setTimeout(() => this.startGeneration(), 300);
            }
        }
    }

    handleLeave() {
        const p = this.player;
        if (p.ui.thumbnailOverlay) p.ui.thumbnailOverlay.classList.remove('visible');
        this._clearHoverTimer();
    }

    async startGeneration() {
        if (this.generationStarted) return;
        this.generationStarted = true;

        const p = this.player;
        const url = p.sourceUrl;
        if (!url) return;

        // Skip thumbnail generation for HLS/live streams
        if (url.includes('.m3u8') || url.includes('/hls/') || url.includes('/live/') || url.includes('/manifest/')) {
            Logger.log('[Thumbnails] Skipping HLS/live stream');
            return;
        }

        Logger.log('[Thumbnails] Starting generation with URL:', url);
        try {
            await this.generator.generate(url, p.duration, { width: 160, count: 100 });
            Logger.log('[Thumbnails] Generation complete');
        } catch (e) {
            Logger.warn('[Thumbnails] Generation failed:', e);
            this.generationStarted = false;
        }
    }

    cleanup() {
        if (this.generator) this.generator.cancel();
        this.generationStarted = false;
        this._clearHoverTimer();
        const overlay = this.player.ui.thumbnailOverlay;
        if (overlay) overlay.style.backgroundImage = 'none';
    }

    /** Releases the generator, which holds decoded frames. */
    destroy() {
        this._clearHoverTimer();
        if (this.generator) {
            this.generator.destroy();
            this.generator = null;
        }
    }

    /** @private */
    _clearHoverTimer() {
        if (this.hoverTimer) {
            clearTimeout(this.hoverTimer);
            this.hoverTimer = null;
        }
    }
}
