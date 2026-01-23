import { Logger } from "../../utils/Logger.js";
import { Modal } from '../Modal.js';
import { CorePlayer } from '../../core/Player.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { generateId, formatDuration, formatTime, formatFileSize } from '../../utils/mediaUtils.js';

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
        const contentTemplate = document.getElementById('gif-content-template');
        const footerTemplate = document.getElementById('gif-footer-template');

        if (!contentTemplate || !footerTemplate) {
            Logger.error('GIF modal templates not found!');
            return;
        }

        const modal = new Modal({ maxWidth: '600px' });
        modal.setTitle('Create GIF');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));

        const modalContent = modal.modal;

        // Open Modal
        modal.open();

        // ---------------------------------------------------------
        // Disable Outside Click Close
        // ---------------------------------------------------------
        // Remove the default overlay click handler to prevent closing on outside click
        const modalOverlay = modal.overlay;
        if (modalOverlay && modalOverlay._closeHandler) {
            modalOverlay.removeEventListener('click', modalOverlay._closeHandler);
        }

        // Initialize Player
        const playerContainer = modalContent.querySelector('#gif-player-container');
        let player = null;

        if (playerContainer) {
            player = new CorePlayer('gif-player-container', {
                mode: 'player',
                controlBarMode: 'fixed',  // Always show control bar
                controls: {
                    playPause: true,
                    navigation: false,
                    time: true,
                    progress: true,
                    captions: false,
                    settings: false,
                    fullscreen: false,
                    loop: false,
                    speed: false,
                    filters: false,
                    equalizer: true,
                    volumeOnly: true,
                    modeToggle: false,
                    keyboard: false
                },
                autoplay: false
            });
        }

        // Elements
        const gifLoading = modalContent.querySelector('.gif-loading');
        const gifContent = modalContent.querySelector('.gif-content');

        // Time Display Elements
        const startDisplay = modalContent.querySelector('.gif-start-time');
        const endDisplay = modalContent.querySelector('.gif-end-time');
        const durationDisplay = modalContent.querySelector('.gif-duration');

        // Timeline Slider Elements
        const timelineSlider = modalContent.querySelector('.timeline-slider');
        const timelineRange = modalContent.querySelector('.timeline-range');
        const startHandle = modalContent.querySelector('.start-handle');
        const endHandle = modalContent.querySelector('.end-handle');

        const validationError = modalContent.querySelector('.time-validation-error');
        const fpsSelect = modalContent.querySelector('#gif-fps');
        const sizeSelect = modalContent.querySelector('#gif-size');
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
            const parts = item.duration.split(':').map(Number);
            if (parts.length === 2) {
                duration = parts[0] * 60 + parts[1];
            } else if (parts.length === 3) {
                duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
            }
        }

        // Show Content
        gifLoading.classList.add('hidden');
        gifContent.classList.remove('hidden');

        // State
        let startTime = 0;
        let endTime = Math.min(duration, 10); // Default 10s or full duration

        // Initialize displays
        startDisplay.textContent = formatTime(startTime);
        endDisplay.textContent = formatTime(endTime);
        durationDisplay.textContent = formatTime(endTime - startTime);

        // Load Video into Player
        if (player) {
            // Get source blob - handles memory vs IndexedDB vs URL
            await MediaMetadata.getProcessedSourceURL(item, () => playlist._saveState());
            await player.load(item.blob_url, false);

            // Enable A-B Loop Mode
            player.loopMode = 'ab';
            player.loopStart = startTime;
            player.loopEnd = endTime;
        }

        // Update UI
        const updateUI = () => {
            // Update Displays
            startDisplay.textContent = formatTime(startTime);
            endDisplay.textContent = formatTime(endTime);

            // Update Duration
            const gifDuration = Math.max(0, endTime - startTime);
            durationDisplay.textContent = formatTime(gifDuration);

            // Update Slider
            const startPercent = (startTime / duration) * 100;
            const endPercent = (endTime / duration) * 100;

            startHandle.style.left = `${startPercent}%`;
            endHandle.style.left = `${endPercent}%`;
            timelineRange.style.left = `${startPercent}%`;
            timelineRange.style.width = `${endPercent - startPercent}%`;

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

        // Slider Drag Logic
        const handleDrag = (e, isStart) => {
            const rect = timelineSlider.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const percent = Math.max(0, Math.min(1, x / rect.width));
            const time = percent * duration;

            if (isStart) {
                if (time < endTime - 1) startTime = time;
                if (player) player.seek(startTime);
            } else {
                if (time > startTime + 1) endTime = time;
                if (player) player.seek(endTime);
            }
            updateUI();
        };

        const initDrag = (handle, isStart) => {
            handle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const onMouseMove = (e) => handleDrag(e, isStart);
                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        };

        initDrag(startHandle, true);
        initDrag(endHandle, false);

        qualitySlider.addEventListener('input', () => {
            const value = parseInt(qualitySlider.value);
            const labels = { 40: 'Low', 60: 'Medium', 80: 'High', 100: 'Original' };
            qualityValue.textContent = labels[value] || 'Medium';
        });

        // Create GIF action
        createBtn.addEventListener('click', async () => {
            const start = startTime;
            const end = endTime;
            const fps = parseInt(fpsSelect.value);
            const sizePreset = sizeSelect.value;
            const quality = parseInt(qualitySlider.value);

            // Disable inputs
            fpsSelect.disabled = true;
            sizeSelect.disabled = true;
            qualitySlider.disabled = true;
            createBtn.disabled = true;
            modal.closeBtn.disabled = true;

            progressSection.classList.remove('hidden');
            errorMessage.classList.add('hidden');
            successMessage.classList.add('hidden');
            gifPreviewSection.classList.add('hidden');
            downloadBtn.classList.add('hidden');

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
                const newItem = {
                    title: filename,
                    url: previewUrl,
                    duration: formatTime(end - start),
                    thumbnail: previewUrl,
                    isLocal: true,
                    file: new File([gifBlob], filename, { type: 'image/gif' }),
                    id: generateId(),
                    type: 'image/gif',
                    path: (item.path || item.title) + '/' + filename
                };

                const sourceIndex = playlist.items.indexOf(item);
                if (sourceIndex !== -1) {
                    playlist.items.splice(sourceIndex + 1, 0, newItem);
                } else {
                    playlist.items.push(newItem);
                }

                playlist._saveState();
                playlist.render();

                modal.closeBtn.disabled = false;

                // Re-enable  inputs
                fpsSelect.disabled = false;
                sizeSelect.disabled = false;
                qualitySlider.disabled = false;
                createBtn.disabled = false;

            } catch (e) {
                Logger.error('GIF creation failed:', e);
                errorMessage.textContent = `GIF creation failed: ${e.message}`;
                errorMessage.classList.remove('hidden');
                progressSection.classList.add('hidden');

                // Re-enable inputs
                fpsSelect.disabled = false;
                sizeSelect.disabled = false;
                qualitySlider.disabled = false;
                createBtn.disabled = false;
                modal.closeBtn.disabled = false;
            }
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
