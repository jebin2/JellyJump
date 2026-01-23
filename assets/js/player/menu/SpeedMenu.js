import { Logger } from "../../utils/Logger.js";
import { Modal } from '../Modal.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { generateId, formatDuration } from '../../utils/mediaUtils.js';

/**
 * Speed Menu Handler
 * Handles video speed adjustment (Slow Motion / Fast Forward)
 */
export class SpeedMenu {
    /**
     * Initialize and open Speed Control modal
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(item, playlist) {
        // reuse same template of reverse video modal
        const contentTemplate = document.getElementById('reverse-content-template');
        const footerTemplate = document.getElementById('reverse-footer-template');

        if (!contentTemplate || !footerTemplate) {
            Logger.error('Speed modal templates not found!');
            return;
        }

        const modal = new Modal({ maxWidth: '500px' });
        modal.setTitle('Video Speed Control');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));

        const modalContent = modal.modal;

        // Customizations for Speed Menu
        // 1. Update Info Text
        const infoText = modalContent.querySelector('.info-text');
        if (infoText) {
            infoText.textContent = "Adjust playback speed. Audio will be preserved but might be out of sync.";
        }

        // 2. Update Checkbox Label
        const audioCheckbox = modalContent.querySelector('#reverse-include-audio'); // Reused ID
        if (audioCheckbox) {
            const checkboxContainer = audioCheckbox.closest('label');
            if (checkboxContainer) {
                const labelSpan = checkboxContainer.querySelector('.checkbox-label');
                if (labelSpan) {
                    labelSpan.textContent = "Include audio";
                }
            }
        }

        // 3. Update Button Text
        const processBtn = modalContent.querySelector('.reverse-btn'); // Reused class from footer
        if (processBtn) {
            processBtn.classList.remove('reverse-btn');
            processBtn.classList.add('speed-process-btn');
            processBtn.innerHTML = '<span>Change Speed</span>';
        }

        // Open Modal
        modal.open();

        // Elements
        const sourceFilename = modalContent.querySelector('.source-filename');
        const sourceDuration = modalContent.querySelector('.source-duration');
        const sourceResolution = modalContent.querySelector('.source-resolution');

        const speedSlider = modalContent.querySelector('.quality-slider'); // Reused class input[type=range]
        const speedDisplay = modalContent.querySelector('.speed-display');

        const downloadBtn = modalContent.querySelector('.download-btn');
        const progressSection = modalContent.querySelector('.progress-section');
        const progressBar = modalContent.querySelector('.progress-bar-fill');
        const progressText = modalContent.querySelector('.progress-percentage');
        const progressStatus = modalContent.querySelector('.progress-status');
        const errorMessage = modalContent.querySelector('.error-message');
        const successMessage = modalContent.querySelector('.success-message');

        const loadingSection = modalContent.querySelector('.reverse-loading');
        const contentSection = modalContent.querySelector('.reverse-content');

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
            const parts = item.duration.split(':').map(Number);
            if (parts.length === 2) {
                videoDuration = parts[0] * 60 + parts[1];
            } else if (parts.length === 3) {
                videoDuration = parts[0] * 3600 + parts[1] * 60 + parts[2];
            }
        }

        sourceDuration.textContent = formatDuration(videoDuration);
        sourceResolution.textContent = item.videoInfo
            ? `${item.videoInfo.width}×${item.videoInfo.height}`
            : 'Unknown';

        // Helper: Update UI
        const updateUI = (speed) => {
            if (speedDisplay) {
                const newDuration = videoDuration / speed;
                speedDisplay.textContent = `${speed}x (${formatDuration(newDuration)})`;
            }
        };

        // Slider Event
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                updateUI(val);
            });
            // Initialize UI
            updateUI(parseFloat(speedSlider.value));
        }

        // Process Handler
        if (processBtn) {
            processBtn.addEventListener('click', async () => {
                const speed = speedSlider ? parseFloat(speedSlider.value) : 1;
                const includeAudio = audioCheckbox ? audioCheckbox.checked : true;

                // UI Updates
                processBtn.disabled = true;
                if (downloadBtn) downloadBtn.disabled = true;
                if (speedSlider) speedSlider.disabled = true;
                if (audioCheckbox) audioCheckbox.disabled = true;

                if (progressSection) progressSection.classList.remove('hidden');
                if (errorMessage) errorMessage.classList.add('hidden');
                if (successMessage) successMessage.classList.add('hidden');

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

                    // Execute Speed Change
                    const outputBlob = await MediaProcessor.changeVideoSpeed({
                        source: sourceFile,
                        speed: speed,
                        includeAudio: includeAudio,
                        onProgress: (progress) => {
                            const pct = Math.round(progress * 100);
                            if (progressText) progressText.textContent = `${pct}%`;
                            if (progressBar) progressBar.style.width = `${pct}%`;

                            if (progressStatus) {
                                if (progress < 0.9) {
                                    progressStatus.textContent = "Processing frames...";
                                } else {
                                    progressStatus.textContent = "Finalizing...";
                                }
                            }
                        }
                    });

                    // Success
                    if (successMessage) successMessage.classList.remove('hidden');
                    if (progressSection) progressSection.classList.add('hidden');

                    // Filename
                    const speedTag = speed < 1 ? `slow-${speed}x` : `fast-${speed}x`;
                    // @ts-ignore
                    const filename = `${item.title.replace(/\.[^.]+$/, '')}-${speedTag}.mp4`;
                    const url = URL.createObjectURL(outputBlob);

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

                    // Re-enable controls for another run
                    if (processBtn) {
                        processBtn.disabled = false;
                        processBtn.innerHTML = '<span>Change Speed</span>';
                    }
                    if (speedSlider) speedSlider.disabled = false;
                    if (audioCheckbox) audioCheckbox.disabled = false;

                    // Add to playlist
                    const newItem = {
                        title: filename,
                        url: url,
                        duration: null,
                        thumbnail: item.thumbnail,
                        isLocal: true,
                        file: new File([outputBlob], filename, { type: 'video/mp4' }),
                        id: generateId(),
                        type: 'video/mp4',
                        path: (item.path || item.title) + '/' + filename
                    };

                    const sourceIndex = playlist.items.indexOf(item);
                    if (sourceIndex !== -1) {
                        playlist.items.splice(sourceIndex + 1, 0, newItem);
                    } else {
                        playlist.items.push(newItem);
                    }
                    await playlist._ensureMetadata(newItem);
                    playlist._saveState();
                    playlist.render();

                } catch (e) {
                    Logger.error('Speed change failed:', e);
                    if (errorMessage) {
                        errorMessage.textContent = `Processing failed: ${e.message}`;
                        errorMessage.classList.remove('hidden');
                    }
                    if (progressSection) progressSection.classList.add('hidden');

                    processBtn.disabled = false;
                    if (speedSlider) speedSlider.disabled = false;
                    if (audioCheckbox) audioCheckbox.disabled = false;
                } finally {
                    modal.close = originalClose;
                    if (closeBtn) closeBtn.style.display = '';
                }
            });
        }
    }
}
