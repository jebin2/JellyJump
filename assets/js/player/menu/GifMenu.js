import { Modal } from '../Modal.js';
import { CorePlayer } from '../../core/Player.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';

/**
 * GIF Menu Handler
 * Handles GIF creation from video segments with A-B loop preview
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
            console.error('GIF modal templates not found!');
            return;
        }

        const modal = new Modal({ maxWidth: '600px' });
        modal.setTitle('Create GIF');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));

        const modalContent = modal.modal;

        // Open Modal
        modal.open();

        // Initialize Player
        const playerContainer = modalContent.querySelector('#gif-player-container');
        let player = null;

        if (playerContainer) {
            player = new CorePlayer('gif-player-container', {
                mode: 'player',
                controls: {
                    playPause: true,
                    volume: false,
                    time: true,
                    progress: true,
                    captions: false,
                    settings: false,
                    fullscreen: false,
                    loop: false,
                    speed: false,
                    modeToggle: false
                },
                autoplay: false
            });
        }

        // Elements
        const gifLoading = modalContent.querySelector('.gif-loading');
        const gifContent = modalContent.querySelector('.gif-content');
        const sourceFilename = modalContent.querySelector('.source-filename');
        const sourceDuration = modalContent.querySelector('.source-duration');
        const sourceResolution = modalContent.querySelector('.source-resolution');

        sourceFilename.textContent = item.title;
        sourceFilename.title = item.title;

        // Ensure metadata
        await playlist._ensureMetadata(item);
        gifLoading.classList.add('hidden');
        gifContent.classList.remove('hidden');

        // Get video duration
        let videoDuration = 0;
        if (item.duration && typeof item.duration === 'string' && item.duration !== '--:--') {
            const parts = item.duration.split(':').map(Number);
            if (parts.length === 2) {
                videoDuration = parts[0] * 60 + parts[1];
            } else if (parts.length === 3) {
                videoDuration = parts[0] * 3600 + parts[1] * 60 + parts[2];
            }
        }
        sourceDuration.textContent = playlist._formatDuration(videoDuration);
        sourceResolution.textContent = item.videoInfo
            ? `${item.videoInfo.width}×${item.videoInfo.height}`
            : 'Unknown';

        // Load Video into Player
        if (player) {
            const videoUrl = item.url || URL.createObjectURL(item.file);
            await player.load(videoUrl, false);

            // Enable A-B Loop Mode
            player.loopMode = 'ab';
            player.loopStart = 0;
            player.loopEnd = Math.min(videoDuration, 10);
        }

        // Control Elements
        const startInput = modalContent.querySelector('#gif-start-input');
        const endInput = modalContent.querySelector('#gif-end-input');
        const durationDisplay = modalContent.querySelector('.gif-duration');
        const validationError = modalContent.querySelector('.time-validation-error');
        const fpsSelect = modalContent.querySelector('#gif-fps');
        const sizeSelect = modalContent.querySelector('#gif-size');
        const qualitySlider = modalContent.querySelector('#gif-quality');
        const qualityValue = modalContent.querySelector('#gif-quality-value');

        const createBtn = modalContent.querySelector('.create-gif-btn');
        const downloadBtn = modalContent.querySelector('.download-btn');
        const progressSection = modalContent.querySelector('.progress-section');
        const progressBar = modalContent.querySelector('.progress-bar-fill');
        const progressText = modalContent.querySelector('.progress-percentage');
        const gifPreviewSection = modalContent.querySelector('.gif-preview-section');
        const gifPreviewImage = modalContent.querySelector('.gif-preview-image');
        const gifFileSize = modalContent.querySelector('.gif-file-size');
        const errorMessage = modalContent.querySelector('.error-message');
        const successMessage = modalContent.querySelector('.success-message');

        // Initialize end time
        endInput.value = playlist._formatTime(Math.min(videoDuration, 10));

        // Validation
        const validateAndUpdate = () => {
            const start = playlist._parseTime(startInput.value);
            const end = playlist._parseTime(endInput.value);
            const duration = end - start;

            // Update A-B loop points
            if (player) {
                player.loopStart = start;
                player.loopEnd = end;
            }

            validationError.classList.add('hidden');
            createBtn.disabled = false;

            if (start >= end) {
                validationError.textContent = 'Start time must be before end time';
                validationError.classList.remove('hidden');
                createBtn.disabled = true;
                return false;
            }

            if (duration < 0.5) {
                validationError.textContent = 'GIF duration must be at least 0.5 seconds';
                validationError.classList.remove('hidden');
                createBtn.disabled = true;
                return false;
            }

            if (duration > 60) {
                validationError.textContent = 'GIF duration must not exceed 60 seconds';
                validationError.classList.remove('hidden');
                createBtn.disabled = true;
                return false;
            }

            if (end > videoDuration) {
                validationError.textContent = 'End time exceeds video duration';
                validationError.classList.remove('hidden');
                createBtn.disabled = true;
                return false;
            }

            durationDisplay.textContent = `${duration.toFixed(1)}s`;
            return true;
        };

        // Event Listeners
        startInput.addEventListener('input', validateAndUpdate);
        endInput.addEventListener('input', validateAndUpdate);

        qualitySlider.addEventListener('input', () => {
            const value = parseInt(qualitySlider.value);
            const labels = { 40: 'Low', 60: 'Medium', 80: 'High', 100: 'Original' };
            qualityValue.textContent = labels[value] || 'Medium';
        });

        // Create GIF action
        createBtn.addEventListener('click', async () => {
            if (!validateAndUpdate()) return;

            const start = playlist._parseTime(startInput.value);
            const end = playlist._parseTime(endInput.value);
            const fps = parseInt(fpsSelect.value);
            const sizePreset = sizeSelect.value;
            const quality = parseInt(qualitySlider.value);
            const addToPlaylist = modalContent.querySelector('input[name="addToPlaylist"]').checked;

            // Disable inputs
            startInput.disabled = true;
            endInput.disabled = true;
            fpsSelect.disabled = true;
            sizeSelect.disabled = true;
            qualitySlider.disabled = true;
            createBtn.disabled = true;

            progressSection.classList.remove('hidden');
            errorMessage.classList.add('hidden');
            successMessage.classList.add('hidden');

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
                if (item.file) {
                    sourceFile = item.file;
                } else if (item.url) {
                    const response = await fetch(item.url);
                    const blob = await response.blob();
                    sourceFile = new File([blob], item.title, { type: blob.type });
                } else {
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
                        progressBar.style.width = `${pct}%`;
                        progressText.textContent = `${pct}%`;
                    }
                });

                // Success
                successMessage.classList.remove('hidden');

                // Show preview
                const previewUrl = URL.createObjectURL(gifBlob);
                gifPreviewImage.src = previewUrl;
                gifFileSize.textContent = playlist._formatFileSize(gifBlob.size);
                gifPreviewSection.classList.remove('hidden');

                // Setup download
                const timestamp = Math.round(start).toString().padStart(2, '0') + '-' + Math.round(end).toString().padStart(2, '0');
                const filename = `${item.title.replace(/\.[^.]+$/, '')}-${timestamp}.gif`;

                downloadBtn.href = previewUrl;
                downloadBtn.download = filename;
                downloadBtn.classList.remove('hidden');

                // Add to playlist
                if (addToPlaylist) {
                    const newItem = {
                        title: filename,
                        url: previewUrl,
                        duration: playlist._formatDuration(end - start),
                        thumbnail: previewUrl,
                        isLocal: true,
                        file: new File([gifBlob], filename, { type: 'image/gif' }),
                        id: playlist._generateId(),
                        type: 'image/gif'
                    };

                    const sourceIndex = playlist.items.indexOf(item);
                    if (sourceIndex !== -1) {
                        playlist.items.splice(sourceIndex + 1, 0, newItem);
                    } else {
                        playlist.items.push(newItem);
                    }

                    playlist._saveState();
                    playlist.render();
                }

                // Re-enable  inputs
                startInput.disabled = false;
                endInput.disabled = false;
                fpsSelect.disabled = false;
                sizeSelect.disabled = false;
                qualitySlider.disabled = false;
                createBtn.disabled = false;

            } catch (e) {
                console.error('GIF creation failed:', e);
                errorMessage.textContent = `GIF creation failed: ${e.message}`;
                errorMessage.classList.remove('hidden');

                // Re-enable inputs
                startInput.disabled = false;
                endInput.disabled = false;
                fpsSelect.disabled = false;
                sizeSelect.disabled = false;
                qualitySlider.disabled = false;
                createBtn.disabled = false;
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

        validateAndUpdate(); // Initial validation
    }
}
