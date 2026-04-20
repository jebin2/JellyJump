import { Logger } from "../../utils/Logger.js";
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { CustomDropdown } from '../../utils/CustomDropdown.js';
import { openProcessMenu, FOOTER_CONFIGS } from './MenuFactory.js';
import { ZipHelper } from '../../utils/ZipHelper.js';

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
        Logger.log('Opening Conversion Modal');
        const { modal, content: modalContent } = openProcessMenu('Convert & Compress Video', 'conversion-content-template', FOOTER_CONFIGS.convert, { maxWidth: '500px' });
        if (!modal) return;

        // Elements
        const convertBtn = modalContent.querySelector('.convert-btn');
        const downloadBtn = modalContent.querySelector('.download-btn');
        const progressSection = modalContent.querySelector('.progress-section');
        const progressPercentage = modalContent.querySelector('.progress-percentage');
        const successMessage = modalContent.querySelector('.success-message');
        const errorMessage = modalContent.querySelector('.error-message');
        const inputs = modalContent.querySelectorAll('input');

        // Format Dropdown
        const formatBtn = modalContent.querySelector('#conversion-format-btn');
        const formatMenu = modalContent.querySelector('#conversion-format-menu');
        const formatDropdown = CustomDropdown.init({
            button: formatBtn,
            menu: formatMenu,
            initialValue: 'keep'
        });

        // Quality Elements
        const qualitySlider = modalContent.querySelector('.quality-slider');
        const qualityValue = modalContent.querySelector('.quality-value');
        const estimatedReduction = modalContent.querySelector('.estimated-reduction');

        // UI Logic: Handle Quality Slider
        const updateQualityLabel = () => {
            const val = parseInt(qualitySlider.value);
            let labelType = "Medium";
            let reduction = `~${100 - val}% smaller`;

            if (val === 100) {
                labelType = "Original";
                reduction = "No size reduction";
            } else if (val >= 65) {
                labelType = "High";
            } else if (val >= 30) {
                labelType = "Medium";
            } else {
                labelType = "Low";
            }

            qualityValue.textContent = `${labelType} (${val}%)`;
            estimatedReduction.textContent = reduction;
        };

        qualitySlider.addEventListener('input', updateQualityLabel);
        updateQualityLabel();

        // Register dropdown cleanup
        modal.onCleanup(() => formatDropdown.destroy());
        modal.onCleanup(() => { if (downloadBtn._hlsObjectUrl) URL.revokeObjectURL(downloadBtn._hlsObjectUrl); });

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
            const format = formatDropdown.getValue();
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
            formatDropdown.setDisabled(true);
            convertBtn.disabled = true;
            modal.closeBtn.disabled = true;
            // Hide previous messages and show progress
            errorMessage.classList.add('hidden');
            successMessage.classList.add('hidden');
            downloadBtn.classList.add('hidden');
            progressSection.classList.remove('hidden');

            try {
                await ConvertMenu._startConversion(item, format, quality, playlist, (progress) => {
                    const percent = Math.round(progress * 100) + '%';
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
                formatDropdown.setDisabled(false);
                convertBtn.disabled = false;
                modal.closeBtn.disabled = false;

            } catch (error) {
                Logger.error('Conversion failed:', error);
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
                formatDropdown.setDisabled(false);
                convertBtn.disabled = false;
                modal.closeBtn.disabled = false;
            }
        });
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
    static async _startConversion(item, format, quality, playlist, onProgress, downloadBtn) {
        // Get source with caching
        const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());

        // Determine Target Format
        let targetFormat = format;
        if (format === 'keep') {
            const ext = item.title.split('.').pop().toLowerCase();
            targetFormat = ext;

            // Fallback if format not supported
            if (!['mp4', 'webm', 'mov', 'flac'].includes(targetFormat)) {
                Logger.warn(`Format ${targetFormat} not explicitly supported, defaulting to MP4.`);
                targetFormat = 'mp4';
            }
        }

        try {
            if (targetFormat === 'hls') {
                const hlsFiles = await MediaProcessor.processHls({
                    source,
                    quality,
                    onProgress,
                });
                ConvertMenu._handleHlsSuccess(hlsFiles, item, downloadBtn);
            } else if (targetFormat === 'flac') {
                const resultBlob = await MediaProcessor.extractTrack({
                    source: source,
                    trackIndex: 0,
                    trackType: 'audio',
                    format: 'flac',
                    onProgress: onProgress
                });
                ConvertMenu._handleConversionSuccess(resultBlob, item, targetFormat, playlist, downloadBtn);
            } else {
                const resultBlob = await MediaProcessor.process({
                    source: source,
                    format: targetFormat,
                    quality: quality,
                    onProgress: onProgress
                });
                ConvertMenu._handleConversionSuccess(resultBlob, item, targetFormat, playlist, downloadBtn);
            }
        } catch (error) {
            Logger.error("Conversion failed:", error);
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
    static _handleConversionSuccess(blob, originalItem, format, playlist, downloadBtn) {
        const newFilename = originalItem.title.replace(/\.[^/.]+$/, "") + `-converted.${format}`;
        const { url } = playlist.insertProcessedItem(originalItem, blob, newFilename);

        // Update Download Button
        if (downloadBtn) {
            downloadBtn.href = url;
            downloadBtn.download = newFilename;
        }
    }

    static _handleHlsSuccess(hlsFiles, originalItem, downloadBtn) {
        if (downloadBtn?._hlsObjectUrl) URL.revokeObjectURL(downloadBtn._hlsObjectUrl);

        const zipBlob = new Blob([ZipHelper.build(hlsFiles)], { type: 'application/zip' });
        const url = URL.createObjectURL(zipBlob);
        const filename = originalItem.title.replace(/\.[^/.]+$/, '') + '-hls.zip';

        if (downloadBtn) {
            downloadBtn._hlsObjectUrl = url;
            downloadBtn.href = url;
            downloadBtn.download = filename;
        }
    }
}
