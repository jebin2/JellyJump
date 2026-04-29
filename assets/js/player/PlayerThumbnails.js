import { Logger } from '../shared/utils/Logger.js';
import { formatTime } from '../shared/utils/mediaUtils.js';

export class PlayerThumbnails {
    constructor(player) {
        this.player = player;
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
        p.lastThumbnailHoverTime = time;

        this.updateImage(time);
    }

    updateImage(time) {
        const p = this.player;
        if (!p.ui.thumbnailOverlay || !p.thumbnailGenerator) return;

        const thumb = p.thumbnailGenerator.getThumbnail(time);
        if (thumb) {
            p.ui.thumbnailOverlay.style.backgroundImage = `url(${thumb})`;
            p.ui.thumbnailLoader.style.display = 'none';
        } else {
            p.ui.thumbnailOverlay.style.backgroundImage = 'none';
            p.ui.thumbnailLoader.style.display = 'block';

            if (!p.thumbnailGenerationStarted && !p.thumbnailHoverTimer) {
                p.thumbnailHoverTimer = setTimeout(() => this.startGeneration(), 300);
            }
        }
    }

    handleLeave() {
        const p = this.player;
        if (p.ui.thumbnailOverlay) p.ui.thumbnailOverlay.classList.remove('visible');
        if (p.thumbnailHoverTimer) {
            clearTimeout(p.thumbnailHoverTimer);
            p.thumbnailHoverTimer = null;
        }
    }

    async startGeneration() {
        const p = this.player;
        if (p.thumbnailGenerationStarted) return;
        p.thumbnailGenerationStarted = true;

        const url = p.sourceUrl;
        if (!url) return;

        // Skip thumbnail generation for HLS/live streams
        if (url.includes('.m3u8') || url.includes('/hls/') || url.includes('/live/') || url.includes('/manifest/')) {
            Logger.log('[Thumbnails] Skipping HLS/live stream');
            return;
        }

        Logger.log('[Thumbnails] Starting generation with URL:', url);
        try {
            await p.thumbnailGenerator.generate(url, p.duration, { width: 160, count: 100 });
            Logger.log('[Thumbnails] Generation complete');
        } catch (e) {
            Logger.warn('[Thumbnails] Generation failed:', e);
            p.thumbnailGenerationStarted = false;
        }
    }

    cleanup() {
        const p = this.player;
        if (p.thumbnailGenerator) p.thumbnailGenerator.cancel();
        p.thumbnailGenerationStarted = false;
        if (p.thumbnailHoverTimer) {
            clearTimeout(p.thumbnailHoverTimer);
            p.thumbnailHoverTimer = null;
        }
        if (p.ui.thumbnailOverlay) p.ui.thumbnailOverlay.style.backgroundImage = 'none';
    }
}
