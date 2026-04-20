import { Logger } from "../../utils/Logger.js";
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { openProcessMenu, FOOTER_CONFIGS } from './MenuFactory.js';

/**
 * Resize Menu Handler  
 * Handles video resizing with preset options and aspect ratio locking
 */
export class ResizeMenu {
    /**
     * Initialize and open Resize modal
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(item, playlist) {
        const { modal, content: modalContent } = openProcessMenu('Resize Video', 'resize-content-template', FOOTER_CONFIGS.resize, { maxWidth: '550px' });
        if (!modal) return;

        // Elements
        const resolutionDisplay = modalContent.querySelector('.current-resolution');
        const aspectRatioDisplay = modalContent.querySelector('.current-aspect-ratio');
        const widthInput = modalContent.querySelector('#resize-width');
        const heightInput = modalContent.querySelector('#resize-height');
        const lockBtn = modalContent.querySelector('.aspect-lock-btn');
        const presetBtns = modalContent.querySelectorAll('.preset-btn');
        const resizeBtn = modalContent.querySelector('.resize-btn');
        const downloadBtn = modalContent.querySelector('.download-btn');

        // Footer elements (unified modal pattern)
        const progressSection = modalContent.querySelector('.progress-section');
        const progressStatus = modalContent.querySelector('.progress-status');
        const progressText = modalContent.querySelector('.progress-percentage');
        const errorDisplay = modalContent.querySelector('.error-message');
        const successDisplay = modalContent.querySelector('.success-message');

        // State
        let originalWidth = 0;
        let originalHeight = 0;
        let aspectRatio = 0;
        let isLocked = true;

        // Helper: Calculate Aspect Ratio String
        const getAspectRatioString = (w, h) => {
            const gcd = (a, b) => b ? gcd(b, a % b) : a;
            const divisor = gcd(w, h);
            return `${w / divisor}:${h / divisor}`;
        };

        // Helper: Update Inputs
        const updateInputs = (w, h, source) => {
            if (source !== 'width') widthInput.value = Math.round(w);
            if (source !== 'height') heightInput.value = Math.round(h);
        };

        // Load Metadata
        try {
            await playlist._ensureMetadata(item);

            if (item.videoInfo && item.videoInfo.width && item.videoInfo.height) {
                originalWidth = item.videoInfo.width;
                originalHeight = item.videoInfo.height;
                aspectRatio = originalWidth / originalHeight;

                resolutionDisplay.textContent = `${originalWidth}x${originalHeight}`;
                aspectRatioDisplay.textContent = getAspectRatioString(originalWidth, originalHeight);

                // Init inputs
                updateInputs(originalWidth, originalHeight);
            } else {
                throw new Error('No video metadata available');
            }
        } catch (e) {
            Logger.error('Failed to load video info:', e);
            resolutionDisplay.textContent = 'Unknown';
            errorDisplay.textContent = 'Failed to load video info. Resizing may not work.';
            errorDisplay.classList.remove('hidden');
        }

        // Event Listeners

        // Aspect Lock Toggle
        lockBtn.addEventListener('click', () => {
            isLocked = !isLocked;
            lockBtn.setAttribute('aria-pressed', isLocked);
            lockBtn.classList.toggle('jellyjump-btn-primary', isLocked);
            lockBtn.classList.toggle('jellyjump-btn-secondary', !isLocked);

            if (isLocked) {
                // Re-sync height to width
                const w = parseInt(widthInput.value) || originalWidth;
                updateInputs(w, w / aspectRatio, 'width');
            }
        });

        // Width Input
        widthInput.addEventListener('input', () => {
            const w = parseInt(widthInput.value);
            if (isLocked && w && aspectRatio) {
                updateInputs(w, w / aspectRatio, 'width');
            }
        });

        // Height Input
        heightInput.addEventListener('input', () => {
            const h = parseInt(heightInput.value);
            if (isLocked && h && aspectRatio) {
                updateInputs(h * aspectRatio, h, 'height');
            }
        });

        // Presets
        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const preset = btn.dataset.preset;
                let targetH;

                switch (preset) {
                    case '1080p': targetH = 1080; break;
                    case '720p': targetH = 720; break;
                    case '480p': targetH = 480; break;
                    case '360p': targetH = 360; break;
                }

                if (targetH) {
                    // Always respect aspect ratio for presets
                    updateInputs(targetH * aspectRatio, targetH);

                    // Highlight active preset
                    presetBtns.forEach(b => b.classList.remove('jellyjump-btn-primary'));
                    presetBtns.forEach(b => b.classList.add('jellyjump-btn-secondary'));
                    btn.classList.remove('jellyjump-btn-secondary');
                    btn.classList.add('jellyjump-btn-primary');
                }
            });
        });

        // Resize Action
        resizeBtn.addEventListener('click', async () => {
            const targetW = parseInt(widthInput.value);
            const targetH = parseInt(heightInput.value);

            // Validation
            if (!targetW || !targetH || targetW < 128 || targetH < 128) {
                errorDisplay.textContent = 'Dimensions must be at least 128px.';
                errorDisplay.classList.remove('hidden');
                return;
            }

            // Even numbers check (codec requirement)
            if (targetW % 2 !== 0 || targetH % 2 !== 0) {
                errorDisplay.textContent = 'Dimensions must be even numbers.';
                errorDisplay.classList.remove('hidden');
                return;
            }

            // Hide previous messages and show progress
            errorDisplay.classList.add('hidden');
            successDisplay.classList.add('hidden');
            progressSection.classList.remove('hidden');
            resizeBtn.disabled = true;
            modal.closeBtn.disabled = true;
            progressStatus.textContent = `Resizing to ${targetW}x${targetH}...`;

            try {
                // Get source with caching
                const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());

                const blob = await MediaProcessor.process({
                    source: source,
                    format: 'mp4',
                    quality: 100,
                    resolution: { width: targetW, height: targetH },
                    onProgress: (progress) => {
                        const percent = Math.round(progress * 100);
                        progressText.textContent = `${percent}%`;
                    }
                });

                // Success
                successDisplay.classList.remove('hidden');
                progressSection.classList.add('hidden');

                // Configure Download
                const ext = 'mp4';
                const filename = item.title.replace(/\.[^/.]+$/, "") + `-${targetW}x${targetH}.${ext}`;

                // Always add to Playlist
                const { url } = playlist.insertProcessedItem(item, blob, filename, {
                    type: `video/${ext}`,
                });

                downloadBtn.href = url;
                downloadBtn.download = filename;
                downloadBtn.classList.remove('hidden');

                // Reset for another resize
                resizeBtn.disabled = false;
                resizeBtn.classList.remove('hidden');
                progressStatus.textContent = 'Processing...';
                progressText.textContent = '0%';

                modal.closeBtn.disabled = false;

            } catch (e) {
                Logger.error('Resize failed:', e);
                errorDisplay.textContent = `Resize failed: ${e.message}`;
                errorDisplay.classList.remove('hidden');
                progressSection.classList.add('hidden');
                resizeBtn.disabled = false;
                modal.closeBtn.disabled = false;
            }
        });
    }
}
