import { Logger } from "../../../shared/utils/Logger.js";
import { MediaProcessor } from '../../../processing/MediaProcessor.js';
import { MediaMetadata } from '../../../shared/utils/MediaMetadata.js';
import { formatTime, parseTime, formatFileSize } from '../../../shared/utils/mediaUtils.js';
import { CustomDropdown } from '../../../shared/utils/CustomDropdown.js';
import { openProcessMenu, FOOTER_CONFIGS } from '../core/MenuFactory.js';
import { runMenuJob } from '../core/MenuJob.js';
import { borrowMainPlayer, setPreviewRange } from '../core/PreviewPlayer.js';
import { installTemplates } from '../core/Templates.js';
import gifTemplates from '../templates/gif.html?raw';

installTemplates(gifTemplates);

/**
 * GIF: a stretch of the video as an animated GIF. The main player is the
 * preview: its timeline shows the stretch, and the stretch plays on a loop.
 */
export class GifMenu {
    /**
     * Initialize and open GIF creation modal
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance  
     */
    static async init(item, playlist) {
        const { modal, content: modalContent } = openProcessMenu('GIF', 'gif-content-template', FOOTER_CONFIGS.gif);
        if (!modal) return;

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


        const gifPreviewSection = modalContent.querySelector('.gif-preview-section');
        const gifPreviewImage = modalContent.querySelector('.gif-preview-image');
        const gifFileSize = modalContent.querySelector('.gif-file-size');

        // Ensure metadata
        await playlist.ensureMetadata(item);

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

        const player = borrowMainPlayer(modal, playlist);

        // Update UI
        const updateUI = () => {
            // Update Inputs
            startInput.value = formatTime(startTime);
            endInput.value = formatTime(endTime);

            // Update Duration
            const gifDuration = Math.max(0, endTime - startTime);
            durationDisplay.textContent = formatTime(gifDuration);

            // The GIF's stretch, on the timeline and looping
            setPreviewRange(player, startTime, endTime);

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
            }
        });

        setEndBtn.addEventListener('click', () => {
            if (player) {
                const currentTime = player.currentTime;
                // Ensure end time is after start time
                if (currentTime > startTime) {
                    endTime = Math.min(Math.max(0, currentTime), duration);
                    updateUI();
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

            gifPreviewSection.classList.add('hidden');
            downloadBtn.classList.add('hidden');

            await runMenuJob({
                name: 'GIF',
                subject: item.title,
                background: true,
                modal,
                work: async ({ signal, onProgress }) => {
                    let targetWidth, targetHeight;
                    if (sizePreset === 'original') {
                        targetWidth = item.videoInfo.width;
                        targetHeight = item.videoInfo.height;
                    } else {
                        const heightMap = { '720': 720, '480': 480, '360': 360 };
                        targetHeight = heightMap[sizePreset];
                        targetWidth = Math.round((item.videoInfo.width / item.videoInfo.height) * targetHeight);
                    }

                    let sourceFile;
                    try {
                        sourceFile = await MediaMetadata.getSourceBlob(item, () => playlist.save());
                    } catch (e) {
                        Logger.error('Failed to get source blob:', e);
                        throw new Error('Cannot access video file');
                    }

                    return MediaProcessor.createGif({
                        input: sourceFile,
                        startTime: start,
                        duration: end - start,
                        fps, width: targetWidth, height: targetHeight, quality,
                        onProgress, signal,
                    });
                },
                done: (gifBlob) => {
                    const previewUrl = URL.createObjectURL(gifBlob);
                    gifPreviewImage.src = previewUrl;
                    gifFileSize.textContent = formatFileSize(gifBlob.size);
                    gifPreviewSection.classList.remove('hidden');

                    // Scrolled into view once the layout has the preview in it.
                    if (modal.body) {
                        setTimeout(() => {
                            modal.body.scrollTo({ top: modal.body.scrollHeight, behavior: 'smooth' });
                        }, 50);
                    }

                    const timestamp = Math.round(start).toString().padStart(2, '0') + '-' + Math.round(end).toString().padStart(2, '0');
                    const filename = `${item.title.replace(/\.[^.]+$/, '')}-${timestamp}.gif`;
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
                },
            });
        });

        // Register dropdown cleanup
        modal.onCleanup(() => {
            fpsDropdown.destroy();
            sizeDropdown.destroy();
        });
    }
}
