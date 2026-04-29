import { Logger } from "../../../shared/utils/Logger.js";
import { MediaProcessor } from '../../../core/MediaProcessor.js';
import { MediaMetadata } from '../../../shared/utils/MediaMetadata.js';
import { formatTime, parseTime } from '../../../shared/utils/mediaUtils.js';
import { openProcessMenu, FOOTER_CONFIGS } from '../core/MenuFactory.js';

/**
 * Speed & Reverse Menu Handler
 * Handles both video playback speed adjustment and reversal.
 */
export class SpeedReverseMenu {
    /**
     * Initialize and open Speed/Reverse control modal
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(item, playlist) {
        const { modal, content: modalContent } = openProcessMenu('Playback Speed & Direction', 'reverse-content-template', FOOTER_CONFIGS.reverse, { maxWidth: '500px' });
        if (!modal) return;

        // Elements
        const sourceFilename = modalContent.querySelector('.source-filename');
        const sourceDuration = modalContent.querySelector('.source-duration');
        const sourceResolution = modalContent.querySelector('.source-resolution');

        const speedSlider = modalContent.querySelector('.quality-slider');
        const speedDisplay = modalContent.querySelector('.speed-display');
        const audioCheckbox = modalContent.querySelector('#reverse-include-audio');
        const directionRadios = modalContent.querySelectorAll('input[name="direction"]');

        const processBtn = modalContent.querySelector('.reverse-btn');
        const downloadBtn = modalContent.querySelector('.download-btn');
        const progressSection = modalContent.querySelector('.progress-section');
        const progressBar = modalContent.querySelector('.progress-bar-fill');
        const progressText = modalContent.querySelector('.progress-percentage');
        const progressStatus = modalContent.querySelector('.progress-status');
        const errorMessage = modalContent.querySelector('.error-message');
        const successMessage = modalContent.querySelector('.success-message');

        const loadingSection = modalContent.querySelector('.reverse-loading');
        const contentSection = modalContent.querySelector('.reverse-content');
        const longVideoWarning = modalContent.querySelector('#long-video-warning');
        const processingInfo = modalContent.querySelector('.processing-info');

        // Initial Data
        sourceFilename.textContent = item.title;
        sourceFilename.title = item.title;

        // Ensure metadata
        await playlist._ensureMetadata(item);

        // Hide loading
        if (loadingSection) loadingSection.classList.add('hidden');
        if (contentSection) contentSection.classList.remove('hidden');
        if (processBtn) processBtn.disabled = false;

        let videoDuration = 0;
        if (item.duration && typeof item.duration === 'string' && item.duration !== '--:--') {
            videoDuration = parseTime(item.duration);
        }
        sourceDuration.textContent = formatTime(videoDuration);
        sourceResolution.textContent = item.videoInfo
            ? `${item.videoInfo.width}×${item.videoInfo.height}`
            : 'Unknown';

        // Check for long video (only warning if reverse is selected later)
        const isLongVideo = videoDuration > 60;

        // Helper: Update UI
        const updateUI = () => {
            const speed = parseFloat(speedSlider.value);
            const isReverse = modalContent.querySelector('input[name="direction"]:checked').value === 'reverse';

            // Update Speed Display
            const newDuration = videoDuration / speed;
            speedDisplay.textContent = `${speed}x (${formatTime(newDuration)})`;

            // Update Info / Warnings
            if (isReverse && isLongVideo) {
                if (longVideoWarning) longVideoWarning.classList.remove('hidden');
                if (processingInfo) processingInfo.classList.remove('hidden');
            } else {
                if (longVideoWarning) longVideoWarning.classList.add('hidden');
                // We keep processing info container, just hide warning
                if (!longVideoWarning || longVideoWarning.classList.contains('hidden')) {
                    // Maybe hide parent if empty, but CSS handles it via hidden class on element
                }
            }

            // Update Checkbox Label
            const checkboxContainer = audioCheckbox.closest('label');
            if (checkboxContainer) {
                const labelSpan = checkboxContainer.querySelector('.checkbox-label');
                if (labelSpan) {
                    labelSpan.textContent = isReverse ? "Include reversed audio" : "Include audio";
                }
            }

            // Update Button Text
            if (processBtn && !processBtn.disabled) {
                processBtn.innerHTML = isReverse ? '<span>Reverse Video</span>' : '<span>Change Speed</span>';
            }
        };

        // Slider Event
        if (speedSlider) {
            speedSlider.addEventListener('input', updateUI);
        }

        // Radio Event
        directionRadios.forEach(radio => {
            radio.addEventListener('change', updateUI);
        });

        // Initialize UI
        updateUI();

        // Process Handler
        if (processBtn) {
            processBtn.addEventListener('click', async () => {
                const speed = speedSlider ? parseFloat(speedSlider.value) : 1;
                const includeAudio = audioCheckbox ? audioCheckbox.checked : true;
                const isReverse = modalContent.querySelector('input[name="direction"]:checked').value === 'reverse';

                // UI Updates
                processBtn.disabled = true;
                processBtn.innerHTML = '<span>Processing...</span>';
                if (downloadBtn) downloadBtn.disabled = true;
                if (speedSlider) speedSlider.disabled = true;
                if (audioCheckbox) audioCheckbox.disabled = true;
                directionRadios.forEach(r => r.disabled = true);

                // Hide previous messages and show progress
                if (errorMessage) errorMessage.classList.add('hidden');
                if (successMessage) successMessage.classList.add('hidden');
                if (progressSection) progressSection.classList.remove('hidden');

                // Prevent closing
                const originalClose = modal.close;
                modal.close = () => { };
                const closeBtn = modal.modal.querySelector('.mb-modal-close');
                if (closeBtn) closeBtn.style.display = 'none';

                try {
                    // Get source
                    let sourceFile;
                    try {
                        sourceFile = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());
                    } catch (e) {
                        Logger.error('Failed to get source blob:', e);
                        throw new Error('Cannot access video file');
                    }

                    let outputBlob;
                    const onProgress = (progress) => {
                        const pct = Math.round(progress * 100);
                        if (progressText) progressText.textContent = `${pct}%`;
                        if (progressBar) progressBar.style.width = `${pct}%`;

                        if (progressStatus) {
                            if (progress < 0.9) {
                                progressStatus.textContent = isReverse ? "Reversing & Encoding..." : "Processing frames...";
                            } else {
                                progressStatus.textContent = "Finalizing...";
                            }
                        }
                    };

                    if (isReverse) {
                        outputBlob = await MediaProcessor.reverseVideo({
                            source: sourceFile,
                            includeAudio: includeAudio,
                            speed: speed,
                            onProgress: onProgress
                        });
                    } else {
                        outputBlob = await MediaProcessor.changeVideoSpeed({
                            source: sourceFile,
                            speed: speed,
                            includeAudio: includeAudio,
                            onProgress: onProgress
                        });
                    }

                    // Success
                    if (successMessage) successMessage.classList.remove('hidden');
                    if (progressSection) progressSection.classList.add('hidden');

                    // Filename
                    const speedTag = isReverse ? `reversed-${speed}x` : (speed < 1 ? `slow-${speed}x` : `fast-${speed}x`);
                    // @ts-ignore
                    const filename = `${item.title.replace(/\.[^.]+$/, '')}-${speedTag}.mp4`;

                    // Add to playlist
                    const { item: newItem, url } = playlist.insertProcessedItem(item, outputBlob, filename, {
                        duration: null,
                        mediaType: 'video/mp4',
                        extra: { thumbnail: item.thumbnail },
                    });
                    await playlist._ensureMetadata(newItem);

                    // Download Button
                    if (downloadBtn) {
                        downloadBtn.onclick = () => {
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                        };

                        downloadBtn.disabled = false;
                        downloadBtn.classList.remove('hidden');
                    }

                } catch (e) {
                    Logger.error('Processing failed:', e);
                    if (errorMessage) {
                        errorMessage.textContent = `Processing failed: ${e.message}`;
                        errorMessage.classList.remove('hidden');
                    }
                    if (progressSection) progressSection.classList.add('hidden');
                } finally {
                    modal.close = originalClose;
                    if (closeBtn) closeBtn.style.display = '';

                    // Re-enable controls
                    if (processBtn) {
                        processBtn.disabled = false;
                        // Determine label again based on current selection (which hasn't changed)
                        const isReverseNow = modalContent.querySelector('input[name="direction"]:checked').value === 'reverse';
                        processBtn.innerHTML = isReverseNow ? '<span>Reverse Video</span>' : '<span>Change Speed</span>';
                    }
                    if (speedSlider) speedSlider.disabled = false;
                    if (audioCheckbox) audioCheckbox.disabled = false;
                    directionRadios.forEach(r => r.disabled = false);
                }
            });
        }
    }
}
