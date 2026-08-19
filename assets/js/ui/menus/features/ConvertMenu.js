import { Logger } from "../../../shared/utils/Logger.js";
import { MediaProcessor } from '../../../core/MediaProcessor.js';
import { MediaMetadata } from '../../../shared/utils/MediaMetadata.js';
import { CustomDropdown } from '../../../shared/utils/CustomDropdown.js';
import { openProcessMenu, FOOTER_CONFIGS } from '../core/MenuFactory.js';
import { ZipHelper } from '../../../shared/utils/ZipHelper.js';
import { uploadToHuggingFace } from '../../../processing/hls/HuggingFaceUploader.js';
import { MediaBunny } from '../../../core/MediaBunny.js';

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

        // Footer elements
        const convertBtn = modalContent.querySelector('.convert-btn');
        const downloadBtn = modalContent.querySelector('.download-btn');
        const progressSection = modalContent.querySelector('.progress-section');
        const progressPercentage = modalContent.querySelector('.progress-percentage');
        const successMessage = modalContent.querySelector('.success-message');
        const errorMessage = modalContent.querySelector('.error-message');

        // Content elements
        const qualitySlider = modalContent.querySelector('.quality-slider');
        const qualityValue = modalContent.querySelector('.quality-value');
        const estimatedReduction = modalContent.querySelector('.estimated-reduction');
        const hlsCloudSection = modalContent.querySelector('.hls-cloud-section');
        const hfTokenInput = modalContent.querySelector('.hf-token-input');
        const hfRepoInput = modalContent.querySelector('.hf-repo-input');
        const hfFolderInput = modalContent.querySelector('.hf-folder-input');
        const hfUploadBtn = modalContent.querySelector('.hf-upload-btn');
        const hfProgressSection = modalContent.querySelector('.hf-progress-section');
        const hfProgressPct = modalContent.querySelector('.hf-progress-pct');
        const hfErrorMessage = modalContent.querySelector('.hf-error-message');
        const hfSuccessSection = modalContent.querySelector('.hf-success-section');
        const hfResultUrl = modalContent.querySelector('.hf-result-url');
        const hfCopyBtn = modalContent.querySelector('.hf-copy-btn');
        const hfPlayBtn = modalContent.querySelector('.hf-play-btn');

        // Format Dropdown
        const formatBtn = modalContent.querySelector('#conversion-format-btn');
        const formatMenu = modalContent.querySelector('#conversion-format-menu');
        const formatDropdown = CustomDropdown.init({
            button: formatBtn,
            menu: formatMenu,
            initialValue: 'keep',
            onChange: (value) => {
                hlsCloudSection.classList.toggle('hidden', value !== 'hls');
            },
        });

        // ProRes encoding is only available where a ProRes encoder is
        // registered; the plugin we ship decodes it but does not encode it, so
        // this asks rather than assuming.
        const proresItem = formatMenu.querySelector('[data-value="prores"]');
        if (proresItem) {
            MediaBunny.canEncodeVideo('prores').then((supported) => {
                if (supported) {
                    proresItem.classList.remove('disabled');
                    proresItem.removeAttribute('title');
                }
            }).catch(() => { /* leave disabled */ });
        }

        // Enable upload button once both token and repo are filled
        const onCredentialsChange = () => {
            hfUploadBtn.disabled = !hfTokenInput.value.trim() || !hfRepoInput.value.trim() || !hfUploadBtn._hlsFiles;
        };
        hfTokenInput.addEventListener('input', onCredentialsChange);
        hfRepoInput.addEventListener('input', onCredentialsChange);

        // Quality Slider
        const updateQualityLabel = () => {
            const val = parseInt(qualitySlider.value);
            let labelType = "Medium";
            let reduction = `~${100 - val}% smaller`;
            if (val === 100) { labelType = "Original"; reduction = "No size reduction"; }
            else if (val >= 65) { labelType = "High"; }
            else if (val >= 30) { labelType = "Medium"; }
            else { labelType = "Low"; }
            qualityValue.textContent = `${labelType} (${val}%)`;
            estimatedReduction.textContent = reduction;
        };
        qualitySlider.addEventListener('input', updateQualityLabel);
        updateQualityLabel();

        // Cleanup
        modal.onCleanup(() => formatDropdown.destroy());
        modal.onCleanup(() => { if (downloadBtn._hlsObjectUrl) URL.revokeObjectURL(downloadBtn._hlsObjectUrl); });

        // Prevent closing during conversion
        const originalClose = modal.close.bind(modal);
        modal.close = () => {
            if (convertBtn.disabled && !downloadBtn.classList.contains('hidden')) return;
            originalClose();
        };

        // Convert Handler
        convertBtn.addEventListener('click', async () => {
            const format = formatDropdown.getValue();
            const quality = parseInt(qualitySlider.value);

            if (format === 'keep' && quality === 100) {
                errorMessage.textContent = "No changes selected. Please choose a different format or reduce quality.";
                errorMessage.classList.remove('hidden');
                return;
            }

            const allInputs = modalContent.querySelectorAll('input');
            allInputs.forEach(input => input.disabled = true);
            qualitySlider.disabled = true;
            formatDropdown.setDisabled(true);
            convertBtn.disabled = true;
            modal.closeBtn.disabled = true;
            errorMessage.classList.add('hidden');
            successMessage.classList.add('hidden');
            downloadBtn.classList.add('hidden');
            progressSection.classList.remove('hidden');

            // Reset HLS cloud state
            hfUploadBtn._hlsFiles = null;
            hfUploadBtn.disabled = true;
            hfSuccessSection.classList.add('hidden');
            hfErrorMessage.classList.add('hidden');

            try {
                await ConvertMenu._startConversion(item, format, quality, playlist, (progress) => {
                    progressPercentage.textContent = Math.round(progress * 100) + '%';
                }, downloadBtn, (hlsFiles) => {
                    // Store HLS files and enable upload once conversion is done
                    hfUploadBtn._hlsFiles = hlsFiles;
                    onCredentialsChange();
                });

                successMessage.textContent = format === 'hls' ? '✓ Ready for download (ZIP)' : '✓ Added to playlist';
                successMessage.classList.remove('hidden');
                progressSection.classList.add('hidden');

                downloadBtn.classList.remove('hidden');
                const downloadFormat = (format === 'keep') ? item.title.split('.').pop()
                    : (format === 'prores') ? 'mov' : format;
                downloadBtn.title = `Download ${downloadFormat.toUpperCase()}`;
                downloadBtn.setAttribute('aria-label', `Download ${downloadFormat.toUpperCase()}`);

                allInputs.forEach(input => {
                    if (!input.parentElement.classList.contains('disabled')) input.disabled = false;
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

                const allInputs2 = modalContent.querySelectorAll('input');
                allInputs2.forEach(input => {
                    if (!input.parentElement.classList.contains('disabled')) input.disabled = false;
                });
                qualitySlider.disabled = false;
                formatDropdown.setDisabled(false);
                convertBtn.disabled = false;
                modal.closeBtn.disabled = false;
            }
        });

        // HF Upload Handler
        hfUploadBtn.addEventListener('click', async () => {
            const hlsFiles = hfUploadBtn._hlsFiles;
            if (!hlsFiles) return;

            const token = hfTokenInput.value.trim();
            const repoId = hfRepoInput.value.trim();
            const folder = hfFolderInput.value.trim();

            hfUploadBtn.disabled = true;
            hfErrorMessage.classList.add('hidden');
            hfSuccessSection.classList.add('hidden');
            hfProgressSection.classList.remove('hidden');
            hfProgressPct.textContent = '0%';
            modal.closeBtn.disabled = true;

            try {
                const m3u8Url = await uploadToHuggingFace({
                    files: hlsFiles,
                    token,
                    repoId,
                    folder,
                    type: 'bucket',
                    onProgress: (p) => { hfProgressPct.textContent = Math.round(p * 100) + '%'; },
                });

                hfProgressSection.classList.add('hidden');
                hfResultUrl.value = m3u8Url;
                hfSuccessSection.classList.remove('hidden');
            } catch (error) {
                Logger.error('[HFUpload] Failed:', error);
                hfProgressSection.classList.add('hidden');
                hfErrorMessage.textContent = `Upload failed: ${error.message}`;
                hfErrorMessage.classList.remove('hidden');
                hfUploadBtn.disabled = false;
            } finally {
                modal.closeBtn.disabled = false;
            }
        });

        // Copy URL
        hfCopyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(hfResultUrl.value).catch(() => {
                hfResultUrl.select();
                document.execCommand('copy');
            });
        });

        // Play in JellyJump
        hfPlayBtn.addEventListener('click', async () => {
            const url = hfResultUrl.value;
            if (!url) return;
            modal.close();
            await playlist._handleUrlUpload(url);
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
    static async _startConversion(item, format, quality, playlist, onProgress, downloadBtn, onHlsFiles) {
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
                onHlsFiles?.(hlsFiles);
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
        const extension = (format === 'prores') ? 'mov' : format;
        const newFilename = originalItem.title.replace(/\.[^/.]+$/, "") + `-converted.${extension}`;
        const { url } = playlist.insertProcessedItem(originalItem, blob, newFilename);

        // Update Download Button
        if (downloadBtn) {
            downloadBtn.href = url;
            downloadBtn.download = newFilename;
        }
    }

    static _handleHlsSuccess(hlsFiles, originalItem, downloadBtn) {
        if (downloadBtn?._hlsObjectUrl) URL.revokeObjectURL(downloadBtn._hlsObjectUrl);

        const zipBlob = ZipHelper.build(hlsFiles);
        const url = URL.createObjectURL(zipBlob);
        const filename = originalItem.title.replace(/\.[^/.]+$/, '') + '-hls.zip';

        if (downloadBtn) {
            downloadBtn._hlsObjectUrl = url;
            downloadBtn.href = url;
            downloadBtn.download = filename;
        }
    }
}
