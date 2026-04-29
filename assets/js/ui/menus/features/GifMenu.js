import { Logger } from "../../../utils/Logger.js";
import { MediaProcessor } from '../../../core/MediaProcessor.js';
import { MediaMetadata } from '../../../utils/MediaMetadata.js';
import { formatTime, parseTime, formatFileSize } from '../../../utils/mediaUtils.js';
import { loadVideo } from './BoxEditorUtils.js';
import { CustomDropdown } from '../../../utils/CustomDropdown.js';
import { openProcessMenu, FOOTER_CONFIGS } from '../core/MenuFactory.js';

/**
 * GIF Menu Handler
 * Handles GIF creation from video segments with timeline slider and player preview
 */
export class GifMenu {
    /**
     * Initialize and open GIF creation modal
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance  
     */
    static async init(item, playlist) {
        const { modal, content: modalContent } = openProcessMenu('GIF', 'gif-content-template', FOOTER_CONFIGS.gif, { splitLayout: true });
        if (!modal) return;

        // ---------------------------------------------------------
        // Disable Outside Click Close
        // ---------------------------------------------------------
        // Remove the default overlay click handler to prevent closing on outside click
        const modalOverlay = modal.overlay;
        if (modalOverlay && modalOverlay._closeHandler) {
            modalOverlay.removeEventListener('click', modalOverlay._closeHandler);
        }

        // Elements
        const gifLoading = modalContent.querySelector('.gif-loading');
        const gifContent = modalContent.querySelector('.gif-content');

        // Input Elements
        const startInput = modalContent.querySelector('#gif-start-input');
        const endInput = modalContent.querySelector('#gif-end-input');
        const setStartBtn = modalContent.querySelector('#gif-set-start-btn');
        const setEndBtn = modalContent.querySelector('#gif-set-end-btn');

        // Time Display Elements
        const durationDisplay = modalContent.querySelector('.gif-duration');

        const validationError = modalContent.querySelector('.time-validation-error');

        // FPS Dropdown
        const fpsBtn = modalContent.querySelector('#gif-fps-btn');
        const fpsMenu = modalContent.querySelector('#gif-fps-menu');
        const fpsDropdown = CustomDropdown.init({
            button: fpsBtn,
            menu: fpsMenu,
            initialValue: '15'
        });

        // Size Dropdown
        const sizeBtn = modalContent.querySelector('#gif-size-btn');
        const sizeMenu = modalContent.querySelector('#gif-size-menu');
        const sizeDropdown = CustomDropdown.init({
            button: sizeBtn,
            menu: sizeMenu,
            initialValue: '480'
        });

        const qualitySlider = modalContent.querySelector('#gif-quality');
        const qualityValue = modalContent.querySelector('#gif-quality-value');

        const createBtn = modalContent.querySelector('.create-gif-btn');
        const downloadBtn = modalContent.querySelector('.download-btn');

        const progressSection = modalContent.querySelector('.progress-section');
        const progressText = modalContent.querySelector('.progress-percentage');

        const gifPreviewSection = modalContent.querySelector('.gif-preview-section');
        const gifPreviewImage = modalContent.querySelector('.gif-preview-image');
        const gifFileSize = modalContent.querySelector('.gif-file-size');
        const errorMessage = modalContent.querySelector('.error-message');
        const successMessage = modalContent.querySelector('.success-message');

        // Ensure metadata
        await playlist._ensureMetadata(item);

        // Get video duration
        let duration = 0;
        if (item.duration && typeof item.duration === 'string' && item.duration !== '--:--') {
            duration = parseTime(item.duration);
        }

        // Show Content
        gifLoading.classList.add('hidden');
        gifContent.classList.remove('hidden');

        // State
        let startTime = 0;
        let endTime = Math.min(duration, 10); // Default 10s or full duration

        // Initialize displays
        startInput.value = formatTime(startTime);
        endInput.value = formatTime(endTime);
        durationDisplay.textContent = formatTime(endTime - startTime);

        // Load Video
        const state = { video: { width: 0, height: 0 } }; // Dummy state for loadVideo
        const player = await loadVideo('gif-player-container', item, playlist, state);

        if (player) {
            // Enable A-B Loop Mode
            player.loopMode = 'ab';
            player.loopStart = startTime;
            player.loopEnd = endTime;
        }

        // Update UI
        const updateUI = () => {
            // Update Inputs
            startInput.value = formatTime(startTime);
            endInput.value = formatTime(endTime);

            // Update Duration
            const gifDuration = Math.max(0, endTime - startTime);
            durationDisplay.textContent = formatTime(gifDuration);

            // Update Player Loop Points
            if (player) {
                player.loopStart = startTime;
                player.loopEnd = endTime;
                if (player.loopMode !== 'ab') player.loopMode = 'ab';
            }

            // Validation
            validationError.classList.add('hidden');
            createBtn.disabled = false;

            if (startTime >= endTime) {
                validationError.textContent = 'Start time must be before end time';
                validationError.classList.remove('hidden');
                createBtn.disabled = true;
            } else if (gifDuration < 1) {
                validationError.textContent = 'GIF duration must be at least 1 second';
                validationError.classList.remove('hidden');
                createBtn.disabled = true;
            } else if (gifDuration > 60) {
                validationError.textContent = 'GIF duration must not exceed 60 seconds';
                validationError.classList.remove('hidden');
                createBtn.disabled = true;
            }
        };

        // Initialize UI
        updateUI();

        // Input Event Listeners
        startInput.addEventListener('change', () => {
            const time = parseTime(startInput.value);
            if (!isNaN(time)) {
                startTime = Math.min(Math.max(0, time), duration);
                if (startTime >= endTime) startTime = Math.max(0, endTime - 1);
                updateUI();
                if (player) {
                    player.seek(startTime);
                    player.loopStart = startTime;
                }
            } else {
                updateUI(); // Reset invalid input
            }
        });

        endInput.addEventListener('change', () => {
            const time = parseTime(endInput.value);
            if (!isNaN(time)) {
                endTime = Math.min(Math.max(0, time), duration);
                if (endTime <= startTime) endTime = Math.min(duration, startTime + 1);
                updateUI();
                if (player) {
                    player.seek(endTime);
                    player.loopEnd = endTime;
                }
            } else {
                updateUI(); // Reset invalid input
            }
        });

        // Set Button Listeners
        setStartBtn.addEventListener('click', () => {
            if (player) {
                const currentTime = player.currentTime;
                startTime = Math.min(Math.max(0, currentTime), duration);
                if (startTime >= endTime) {
                    // Adjust end time if start overlaps
                    endTime = Math.min(duration, startTime + 10);
                }
                updateUI();
                player.loopStart = startTime;
                player.loopEnd = endTime; // Ensure loop remains valid
            }
        });

        setEndBtn.addEventListener('click', () => {
            if (player) {
                const currentTime = player.currentTime;
                // Ensure end time is after start time
                if (currentTime > startTime) {
                    endTime = Math.min(Math.max(0, currentTime), duration);
                    updateUI();
                    player.loopEnd = endTime;
                }
            }
        });

        qualitySlider.addEventListener('input', () => {
            const value = parseInt(qualitySlider.value);
            const labels = { 40: 'Low', 60: 'Medium', 80: 'High', 100: 'Original' };
            qualityValue.textContent = labels[value] || 'Medium';
        });

        // Create GIF action
        createBtn.addEventListener('click', async () => {
            const start = startTime;
            const end = endTime;
            const fps = parseInt(fpsDropdown.getValue());
            const sizePreset = sizeDropdown.getValue();
            const quality = parseInt(qualitySlider.value);

            // Disable inputs
            fpsDropdown.setDisabled(true);
            sizeDropdown.setDisabled(true);
            qualitySlider.disabled = true;
            createBtn.disabled = true;
            modal.closeBtn.disabled = true;

            // Hide previous messages and show progress
            errorMessage.classList.add('hidden');
            successMessage.classList.add('hidden');
            gifPreviewSection.classList.add('hidden');
            downloadBtn.classList.add('hidden');
            progressSection.classList.remove('hidden');

            try {
                // Calculate dimensions
                let targetWidth, targetHeight;
                if (sizePreset === 'original') {
                    targetWidth = item.videoInfo.width;
                    targetHeight = item.videoInfo.height;
                } else {
                    const heightMap = { '720': 720, '480': 480, '360': 360 };
                    targetHeight = heightMap[sizePreset];
                    targetWidth = Math.round((item.videoInfo.width / item.videoInfo.height) * targetHeight);
                }

                // Get source file
                let sourceFile;
                try {
                    // Get source with caching
                    sourceFile = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());
                } catch (e) {
                    Logger.error('Failed to get source blob:', e);
                    throw new Error('Cannot access video file');
                }

                // Create GIF
                const gifBlob = await MediaProcessor.createGif({
                    input: sourceFile,
                    startTime: start,
                    duration: end - start,
                    fps: fps,
                    width: targetWidth,
                    height: targetHeight,
                    quality: quality,
                    onProgress: (progress) => {
                        const pct = Math.round(progress * 100);
                        progressText.textContent = `${pct}%`;
                    }
                });

                // Success
                progressSection.classList.add('hidden');
                successMessage.classList.remove('hidden');

                // Show preview
                const previewUrl = URL.createObjectURL(gifBlob);
                gifPreviewImage.src = previewUrl;
                gifFileSize.textContent = formatFileSize(gifBlob.size);
                gifPreviewSection.classList.remove('hidden');

                // Scroll to bottom of modal
                if (modal.body) {
                    // Small timeout to ensure layout is updated
                    setTimeout(() => {
                        modal.body.scrollTo({
                            top: modal.body.scrollHeight,
                            behavior: 'smooth'
                        });
                    }, 50);
                }

                // Setup download
                const timestamp = Math.round(start).toString().padStart(2, '0') + '-' + Math.round(end).toString().padStart(2, '0');
                const filename = `${item.title.replace(/\.[^.]+$/, '')} -${timestamp}.gif`;

                downloadBtn.href = previewUrl;
                downloadBtn.download = filename;
                downloadBtn.classList.remove('hidden');

                // Always add to playlist
                playlist.insertProcessedItem(item, gifBlob, filename, {
                    type: 'image/gif',
                    mediaType: 'image/gif',
                    duration: formatTime(end - start),
                    extra: { url: previewUrl, thumbnail: previewUrl },
                });

                modal.closeBtn.disabled = false;

                // Re-enable  inputs
                fpsDropdown.setDisabled(false);
                sizeDropdown.setDisabled(false);
                qualitySlider.disabled = false;
                createBtn.disabled = false;

            } catch (e) {
                Logger.error('GIF creation failed:', e);
                errorMessage.textContent = `GIF creation failed: ${e.message}`;
                errorMessage.classList.remove('hidden');
                progressSection.classList.add('hidden');

                // Re-enable inputs
                fpsDropdown.setDisabled(false);
                sizeDropdown.setDisabled(false);
                qualitySlider.disabled = false;
                createBtn.disabled = false;
                modal.closeBtn.disabled = false;
            }
        });

        // Register dropdown cleanup
        modal.onCleanup(() => {
            fpsDropdown.destroy();
            sizeDropdown.destroy();
        });

        // Cleanup on close
        const originalClose = modal.close.bind(modal);
        modal.close = () => {
            if (player) {
                player.destroy();
            }
            originalClose();
        };
    }
}
