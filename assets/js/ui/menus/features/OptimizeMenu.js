import { Logger } from '../../../shared/utils/Logger.js';
import { Modal } from '../../Modal.js';
import { Toast } from '../../../shared/utils/Toast.js';
import { MediaBunny } from '../../../core/MediaBunny.js';
import { MediaProcessor } from '../../../core/MediaProcessor.js';
import { formatTime } from '../../../shared/utils/mediaUtils.js';

/**
 * Optimize Menu
 * On phones, videos above 1080p can overwhelm WebKit (a 4K recording may be
 * killed by iOS mid-decode). Before an oversized local file enters the
 * playlist, ask the user whether to convert it to 1080p right in the dialog;
 * only the chosen version (optimized or original) is added afterwards.
 */
export const OptimizeMenu = {
    // Long side above which we offer optimization, and the target long side.
    THRESHOLD: 1920,
    TARGET: 1920,

    _isMobile() {
        return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    },

    /**
     * Gate freshly picked local files before they are added to the playlist.
     * On phones, each video above the threshold prompts the user; choosing
     * Optimize converts it inside the dialog and swaps the item's source
     * before it is added. Declining (or any failure) keeps the original -
     * capable devices can still play it.
     * @param {Object[]} items - Items from PlaylistProcessor.processFiles
     * @returns {Promise<Object[]>} The same items, sources possibly swapped
     */
    async interceptNewItems(items) {
        if (!this._isMobile()) return items;

        for (const item of items) {
            if (!item.isLocal || item.isAudio || !item.file) continue;

            try {
                // Probe the container for dimensions (cheap - no decoding).
                const meta = await MediaProcessor.getMetadata(item.file);
                if (!meta || !meta.videoInfo) continue;

                // Keep the probed metadata so it is not extracted again
                // after the item is added.
                item.videoInfo = meta.videoInfo;
                item.audioInfo = meta.audioInfo;
                item.videoTracks = meta.videoTracks;
                item.audioTracks = meta.audioTracks;
                if (meta.duration) item.duration = formatTime(meta.duration);

                const w = meta.videoInfo.displayWidth || meta.videoInfo.width;
                const h = meta.videoInfo.displayHeight || meta.videoInfo.height;
                if (!w || !h || Math.max(w, h) <= this.THRESHOLD) continue;

                await this._promptAndMaybeConvert(item, w, h);
            } catch (e) {
                Logger.warn('[Optimize] Probe failed for', item.title, e);
            }
        }

        return items;
    },

    /**
     * Show the prompt for one oversized file. Resolves once the user has
     * decided and (if chosen) the conversion has finished or failed.
     * @private
     */
    _promptAndMaybeConvert(item, w, h) {
        return new Promise((resolve) => {
            let settled = false;
            let converting = false;
            const settle = () => {
                if (!settled) {
                    settled = true;
                    resolve();
                }
            };

            const modal = new Modal({
                maxWidth: '420px',
                // X / programmatic close: without an explicit choice the
                // original is added untouched.
                onClose: () => {
                    if (!settled && !converting) item.optimizeDeclined = true;
                    settle();
                }
            });
            modal.setTitle('Optimize for this device?');

            const body = document.createElement('div');
            body.innerHTML = `
                <p style="margin-bottom:10px;">"${item.title}" is ${w}×${h} — larger than this device can usually play smoothly.</p>
                <p class="text-secondary" style="font-size:0.9em;margin-bottom:10px;">JellyJump can convert it to 1080p once, right on this device, and add the converted copy to the playlist. Your original file stays untouched on the device.</p>
                <div class="optimize-progress" style="display:none;">
                    <div style="font-family:var(--font-mono);font-size:0.9em;margin-bottom:6px;" class="optimize-progress-label">Optimizing… 0%</div>
                    <div style="height:6px;background:var(--bg-tertiary);border-radius:3px;overflow:hidden;">
                        <div class="optimize-progress-bar" style="height:100%;width:0%;background:var(--accent-primary);transition:width 0.2s;"></div>
                    </div>
                </div>
            `;
            modal.setBody(body);

            const footer = document.createElement('div');
            footer.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
            const skipBtn = document.createElement('button');
            skipBtn.className = 'btn jellyjump-btn-small';
            skipBtn.textContent = 'Add original';
            const okBtn = document.createElement('button');
            okBtn.className = 'btn jellyjump-btn-small';
            okBtn.textContent = 'Optimize to 1080p';
            footer.appendChild(skipBtn);
            footer.appendChild(okBtn);
            modal.setFooter(footer);

            skipBtn.addEventListener('click', () => {
                item.optimizeDeclined = true;
                settle();
                modal.close();
            });

            okBtn.addEventListener('click', async () => {
                converting = true;
                okBtn.disabled = true;
                skipBtn.disabled = true;
                modal.closeBtn.disabled = true;

                const progressWrap = body.querySelector('.optimize-progress');
                const progressLabel = body.querySelector('.optimize-progress-label');
                const progressBar = body.querySelector('.optimize-progress-bar');
                progressWrap.style.display = 'block';

                try {
                    await this._convert(item, w, h, (pct) => {
                        progressLabel.textContent = `Optimizing… ${pct}%`;
                        progressBar.style.width = `${pct}%`;
                    });
                    Toast.show(`Optimized "${item.title}" to 1080p`);
                } catch (e) {
                    Logger.error('[Optimize] Conversion failed:', e);
                    // Fall back to adding the original untouched.
                    item.optimizeDeclined = true;
                    Toast.show(`Could not optimize (${e.message}) - adding the original.`, 4000, true);
                } finally {
                    converting = false;
                    modal.closeBtn.disabled = false;
                    settle();
                    modal.close();
                }
            });

            modal.open();
        });
    },

    /**
     * Transcode the item's file to the target resolution and swap the
     * item's source in place (the item is not in the playlist yet).
     * @private
     */
    async _convert(item, srcW, srcH, onPct) {
        // Constrain only the long side; mediabunny derives the other
        // dimension from the source aspect ratio, so the original ratio is
        // preserved exactly (no independent rounding, no fill-stretching).
        const resolution = srcW >= srcH ? { width: this.TARGET } : { height: this.TARGET };

        // Prefer H.264/MP4 (hardware-encoded on iPhones); fall back to
        // VP9/WebM where no AVC encoder is available.
        const useAvc = await MediaBunny.canEncodeVideo('avc');
        const format = useAvc ? 'mp4' : 'webm';

        Logger.log(`[Optimize] ${item.title}: ${srcW}x${srcH} -> long side ${this.TARGET} (${format})`);

        let lastPct = -1;
        const blob = await MediaProcessor.process({
            source: item.file,
            format,
            quality: 80,
            resolution,
            onProgress: (p) => {
                const pct = Math.round(p * 100);
                if (pct !== lastPct) {
                    lastPct = pct;
                    onPct(pct);
                }
            }
        });

        if (item.url && item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);

        const baseName = (item.title || 'video').replace(/\.[^/.]+$/, '');
        item.file = new File([blob], `${baseName}.${format}`, { type: blob.type });
        item.url = URL.createObjectURL(item.file);
        item.fileSize = blob.size;
        item.fileType = blob.type;
        item.mimeType = blob.type;
        // Metadata belongs to the old source - re-extracted after adding.
        item.videoInfo = null;
        item.audioInfo = null;
        item.videoTracks = null;
        item.audioTracks = null;
        item.duration = 'Loading...';
    }
};
