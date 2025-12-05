import { Modal } from '../Modal.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { generateId } from '../../utils/mediaUtils.js';

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
        const contentTemplate = document.getElementById('resize-content-template');
        const footerTemplate = document.getElementById('resize-footer-template');

        if (!contentTemplate || !footerTemplate) return;

        const modal = new Modal({ maxWidth: '550px' });
        modal.setTitle('Resize Video');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));

        const modalContent = modal.modal;

        // Elements
        const resolutionDisplay = modalContent.querySelector('.current-resolution');
        const aspectRatioDisplay = modalContent.querySelector('.current-aspect-ratio');
        const widthInput = modalContent.querySelector('#resize-width');
        const heightInput = modalContent.querySelector('#resize-height');
        const lockBtn = modalContent.querySelector('.aspect-lock-btn');
        const presetBtns = modalContent.querySelectorAll('.preset-btn');
        const addToPlaylistCheckbox = modalContent.querySelector('input[name="addToPlaylist"]');
        const resizeBtn = modalContent.querySelector('.resize-btn');
        const downloadBtn = modalContent.querySelector('.download-btn');
        const progressSection = modalContent.querySelector('.resize-progress');
        const progressBarFill = modalContent.querySelector('.progress-bar-fill');
        const progressText = modalContent.querySelector('.progress-percentage');
        const statusText = modalContent.querySelector('.status-text');
        const errorDisplay = modalContent.querySelector('.resize-error');
        const successDisplay = modalContent.querySelector('.resize-success');

        modal.open();

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
            console.error('Failed to load video info:', e);
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

            errorDisplay.classList.add('hidden');
            progressSection.classList.remove('hidden');
            resizeBtn.disabled = true;
            modal.closeBtn.disabled = true;
            statusText.textContent = `Resizing to ${targetW}x${targetH}...`;

            try {
                // Get source with caching
                const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());

                const blob = await MediaProcessor.process({
                    source: source,
                    format: 'mp4',
                    quality: 100,
                    resize: { width: targetW, height: targetH },
                    onProgress: (progress) => {
                        const percent = Math.round(progress * 100);
                        progressBarFill.style.width = `${percent}%`;
                        progressText.textContent = `${percent}%`;
                    }
                });

                // Success
                successDisplay.classList.remove('hidden');
                progressSection.classList.add('hidden');

                // Configure Download
                const ext = 'mp4';
                const filename = item.title.replace(/\.[^/.]+$/, "") + `-${targetW}x${targetH}.${ext}`;
                const url = URL.createObjectURL(blob);

                downloadBtn.href = url;
                downloadBtn.download = filename;
                downloadBtn.classList.remove('hidden');

                // Reset for another resize
                resizeBtn.disabled = false;
                resizeBtn.classList.remove('hidden');
                statusText.textContent = 'Resizing video...';
                progressBarFill.style.width = '0%';
                progressText.textContent = '0%';

                // Add to Playlist
                if (addToPlaylistCheckbox.checked) {
                    const newItem = {
                        id: generateId(),
                        title: filename,
                        url: url,
                        file: new File([blob], filename, { type: `video/${ext}` }),
                        duration: item.duration,
                        type: 'video',
                        isLocal: true,
                        isNew: true
                    };

                    const insertIndex = playlist.items.indexOf(item) + 1;
                    playlist.items.splice(insertIndex, 0, newItem);
                    playlist.render();
                    playlist._saveState();
                }

                modal.closeBtn.disabled = false;

            } catch (e) {
                console.error('Resize failed:', e);
                errorDisplay.textContent = `Resize failed: ${e.message}`;
                errorDisplay.classList.remove('hidden');
                progressSection.classList.add('hidden');
                resizeBtn.disabled = false;
                modal.closeBtn.disabled = false;
            }
        });
    }
}
