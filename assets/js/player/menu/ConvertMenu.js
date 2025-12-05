import { Modal } from '../Modal.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { generateId } from '../../utils/mediaUtils.js';

/**
 * Convert Menu Handler
 * Handles video format conversion and optimization
 */
export class ConvertMenu {
    /**
     * Initialize and open Conversion modal
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(item, playlist) {
        const contentTemplate = document.getElementById('conversion-content-template');
        const footerTemplate = document.getElementById('conversion-footer-template');

        console.log('Opening Conversion Modal');
        if (!contentTemplate || !footerTemplate) {
            console.error('Conversion modal templates not found!');
            return;
        }

        const modal = new Modal({ maxWidth: '500px' });
        modal.setTitle('Convert & Optimize Video');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));

        const modalContent = modal.modal;

        // Populate Source Info
        const sourceFilename = modalContent.querySelector('.source-filename');
        if (sourceFilename) {
            sourceFilename.textContent = item.title;
            sourceFilename.title = item.title;
        }

        // Elements
        const convertBtn = modalContent.querySelector('.convert-btn');
        const downloadBtn = modalContent.querySelector('.download-btn');
        const progressSection = modalContent.querySelector('.progress-section');
        const progressBarFill = modalContent.querySelector('.progress-bar-fill');
        const progressPercentage = modalContent.querySelector('.progress-percentage');
        const successMessage = modalContent.querySelector('.success-message');
        const errorMessage = modalContent.querySelector('.error-message');
        const inputs = modalContent.querySelectorAll('input');

        // Quality Elements
        const qualitySlider = modalContent.querySelector('.quality-slider');
        const qualityValue = modalContent.querySelector('.quality-value');
        const estimatedReduction = modalContent.querySelector('.estimated-reduction');

        // UI Logic: Handle Quality Slider
        const updateQualityLabel = () => {
            const val = parseInt(qualitySlider.value);
            let label = "Medium (60%)";
            let reduction = "~40% smaller";

            if (val === 100) {
                label = "Original (100%)";
                reduction = "No size reduction";
            } else if (val === 80) {
                label = "High (80%)";
                reduction = "~20% smaller";
            } else if (val === 40) {
                label = "Low (40%)";
                reduction = "~60% smaller";
            }

            qualityValue.textContent = label;
            estimatedReduction.textContent = reduction;
        };

        qualitySlider.addEventListener('input', updateQualityLabel);
        updateQualityLabel();

        // Prevent closing during conversion
        const originalClose = modal.close.bind(modal);
        modal.close = () => {
            if (convertBtn.disabled && !downloadBtn.classList.contains('hidden')) {
                return; // Don't close during conversion
            }
            originalClose();
        };

        // Convert Handler
        convertBtn.addEventListener('click', async () => {
            const format = modalContent.querySelector('input[name="format"]:checked').value;
            const addToPlaylist = modalContent.querySelector('input[name="addToPlaylist"]').checked;
            const quality = parseInt(qualitySlider.value);

            // Validation: No Op check
            if (format === 'keep' && quality === 100) {
                errorMessage.textContent = "No changes selected. Please choose a different format or reduce quality.";
                errorMessage.classList.remove('hidden');
                return;
            }

            // UI Updates
            inputs.forEach(input => input.disabled = true);
            qualitySlider.disabled = true;
            convertBtn.disabled = true;
            modal.closeBtn.disabled = true;
            progressSection.classList.remove('hidden');
            errorMessage.classList.add('hidden');
            successMessage.classList.add('hidden');
            downloadBtn.classList.add('hidden');

            try {
                await ConvertMenu._startConversion(item, format, quality, addToPlaylist, playlist, (progress) => {
                    const percent = Math.round(progress * 100) + '%';
                    progressBarFill.style.width = percent;
                    progressPercentage.textContent = percent;
                }, downloadBtn);

                // Success
                successMessage.classList.remove('hidden');
                progressSection.classList.add('hidden');

                // Enable Download
                downloadBtn.classList.remove('hidden');
                const downloadFormat = (format === 'keep') ? item.title.split('.').pop() : format;
                downloadBtn.title = `Download ${downloadFormat.toUpperCase()}`;
                downloadBtn.setAttribute('aria-label', `Download ${downloadFormat.toUpperCase()}`);

                // Re-enable Inputs for new conversion
                inputs.forEach(input => {
                    if (!input.parentElement.classList.contains('disabled')) {
                        input.disabled = false;
                    }
                });
                qualitySlider.disabled = false;
                convertBtn.disabled = false;
                modal.closeBtn.disabled = false;

            } catch (error) {
                console.error('Conversion failed:', error);
                errorMessage.textContent = `Operation failed: ${error.message}`;
                errorMessage.classList.remove('hidden');
                progressSection.classList.add('hidden');

                // Re-enable inputs
                inputs.forEach(input => {
                    if (!input.parentElement.classList.contains('disabled')) {
                        input.disabled = false;
                    }
                });
                qualitySlider.disabled = false;
                convertBtn.disabled = false;
                modal.closeBtn.disabled = false;
            }
        });

        modal.open();
    }

    /**
     * Start the conversion process
     * @param {Object} item - Playlist item
     * @param {string} format - Target format
     * @param {number} quality - Quality setting (40, 60, 80, 100)
     * @param {boolean} addToPlaylist - Whether to add result to playlist
     * @param {Playlist} playlist - Playlist instance
     * @param {Function} onProgress - Progress callback
     * @param {HTMLElement} downloadBtn - Download button element
     * @private
     */
    static async _startConversion(item, format, quality, addToPlaylist, playlist, onProgress, downloadBtn) {
        // Get source with caching
        const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());

        // Determine Target Format
        let targetFormat = format;
        if (format === 'keep') {
            const ext = item.title.split('.').pop().toLowerCase();
            targetFormat = ext;

            // Fallback if format not supported
            if (!['mp4', 'webm', 'mov'].includes(targetFormat)) {
                console.warn(`Format ${targetFormat} not explicitly supported, defaulting to MP4.`);
                targetFormat = 'mp4';
            }
        }

        try {
            const resultBlob = await MediaProcessor.process({
                source: source,
                format: targetFormat,
                quality: quality,
                onProgress: onProgress
            });

            // Handle Success
            ConvertMenu._handleConversionSuccess(resultBlob, item, targetFormat, addToPlaylist, playlist, downloadBtn);
        } catch (error) {
            console.error("Conversion failed:", error);
            throw error;
        }
    }

    /**
     * Handle successful conversion
     * @param {Blob} blob - Result blob
     * @param {Object} originalItem - Original playlist item
     * @param {string} format - Output format
     * @param {boolean} addToPlaylist - Whether to add to playlist
     * @param {Playlist} playlist - Playlist instance
     * @param {HTMLElement} downloadBtn - Download button element
     * @private
     */
    static _handleConversionSuccess(blob, originalItem, format, addToPlaylist, playlist, downloadBtn) {
        const newFilename = originalItem.title.replace(/\.[^/.]+$/, "") + `-converted.${format}`;
        const url = URL.createObjectURL(blob);

        // Update Download Button
        if (downloadBtn) {
            downloadBtn.href = url;
            downloadBtn.download = newFilename;
        }

        if (addToPlaylist) {
            const newItem = {
                title: newFilename,
                url: url,
                file: new File([blob], newFilename, { type: blob.type }),
                duration: originalItem.duration, // Approx same duration
                type: 'video',
                id: generateId()
            };

            // Insert after original item
            const index = playlist.items.indexOf(originalItem);
            playlist.items.splice(index + 1, 0, newItem);

            // Re-render playlist
            playlist.render();
            playlist._saveState();
        }
    }
}
