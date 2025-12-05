import { Modal } from '../Modal.js';
import { CorePlayer } from '../../core/Player.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { generateId } from '../../utils/mediaUtils.js';

/**
 * Trim Menu Handler
 * Handles video trimming functionality with timeline slider and player preview
 */
export class TrimMenu {
    /**
     * Initialize and open Trim modal
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(item, playlist) {
        const contentTemplate = document.getElementById('trim-content-template');
        const footerTemplate = document.getElementById('trim-footer-template');

        if (!contentTemplate || !footerTemplate) return;

        const modal = new Modal({ maxWidth: '600px' });
        modal.setTitle('Trim Video');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));

        const modalContent = modal.modal;

        // Open Modal Immediately
        modal.open();

        // Initialize Player
        const playerContainer = modalContent.querySelector('#trim-player-container');
        let player = null;

        if (playerContainer) {
            player = new CorePlayer('trim-player-container', {
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
        const trimLoading = modalContent.querySelector('.trim-loading');
        const trimContent = modalContent.querySelector('.trim-content');
        const sourceFilename = modalContent.querySelector('.source-filename');
        const startInput = modalContent.querySelector('#trim-start-input');
        const endInput = modalContent.querySelector('#trim-end-input');
        const durationDisplay = modalContent.querySelector('.trim-duration');
        const totalDurationDisplay = modalContent.querySelector('.total-duration');
        const timelineSlider = modalContent.querySelector('.timeline-slider');
        const timelineRange = modalContent.querySelector('.timeline-range');
        const startHandle = modalContent.querySelector('.start-handle');
        const endHandle = modalContent.querySelector('.end-handle');
        const addToPlaylistCheckbox = modalContent.querySelector('input[name="addToPlaylist"]');
        const trimBtn = modalContent.querySelector('.trim-btn');
        const downloadBtn = modalContent.querySelector('.download-btn');
        const progressSection = modalContent.querySelector('.progress-section');
        const progressBar = modalContent.querySelector('.progress-bar-fill');
        const progressPercentage = modalContent.querySelector('.progress-percentage');
        const errorMessage = modalContent.querySelector('.error-message');
        const successMessage = modalContent.querySelector('.success-message');

        // Initial State
        trimBtn.disabled = true;

        // Helper Functions
        const formatTime = (seconds) => {
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            const s = Math.floor(seconds % 60);
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')} `;
        };

        const parseTime = (timeStr) => {
            if (typeof timeStr === 'number') return timeStr;
            const parts = timeStr.split(':').map(Number);
            if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
            if (parts.length === 2) return parts[0] * 60 + parts[1];
            return 0;
        };

        // Initialize Data
        sourceFilename.textContent = item.title;
        sourceFilename.title = item.title;

        // Ensure metadata
        await playlist._ensureMetadata(item);

        // Get Video Duration
        let duration = 0;
        if (item.duration && typeof item.duration === 'string' && item.duration !== '--:--') {
            const parts = item.duration.split(':').map(Number);
            if (parts.length === 3) {
                duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
            } else if (parts.length === 2) {
                duration = parts[0] * 60 + parts[1];
            }
        }

        // Show Content
        trimLoading.classList.add('hidden');
        trimContent.classList.remove('hidden');
        trimBtn.disabled = false;

        totalDurationDisplay.textContent = formatTime(duration);

        // State
        let startTime = 0;
        let endTime = duration;

        // Load Video into Player
        if (player) {
            const videoUrl = item.url || URL.createObjectURL(item.file);
            await player.load(videoUrl, false);

            // Enable A-B Loop Mode
            player.loopMode = 'ab';
            player.loopStart = startTime;
            player.loopEnd = endTime;
        }

        // Update UI
        const updateUI = () => {
            // Update Inputs
            if (document.activeElement !== startInput) startInput.value = formatTime(startTime);
            if (document.activeElement !== endInput) endInput.value = formatTime(endTime);

            // Update Duration
            const trimDuration = Math.max(0, endTime - startTime);
            durationDisplay.textContent = formatTime(trimDuration);

            // Update Slider
            const startPercent = (startTime / duration) * 100;
            const endPercent = (endTime / duration) * 100;

            startHandle.style.left = `${startPercent}% `;
            endHandle.style.left = `${endPercent}% `;
            timelineRange.style.left = `${startPercent}% `;
            timelineRange.style.width = `${endPercent - startPercent}% `;

            // Update Player Loop Points
            if (player) {
                player.loopStart = startTime;
                player.loopEnd = endTime;
                if (player.loopMode !== 'ab') player.loopMode = 'ab';
            }

            // Validation
            const isValid = startTime < endTime && (endTime - startTime) >= 1;
            trimBtn.disabled = !isValid;

            if (!isValid) {
                if (startTime >= endTime) errorMessage.textContent = "Start time must be before end time.";
                else if ((endTime - startTime) < 1) errorMessage.textContent = "Duration must be at least 1 second.";
                errorMessage.classList.remove('hidden');
            } else {
                errorMessage.classList.add('hidden');
            }
        };

        // Initialize UI
        updateUI();

        // Input Handlers
        const handleInput = (input, isStart) => {
            const time = parseTime(input.value);
            if (isStart) {
                if (time >= 0 && time < duration) startTime = time;
            } else {
                if (time > 0 && time <= duration) endTime = time;
            }
            updateUI();
        };

        startInput.addEventListener('change', () => handleInput(startInput, true));
        endInput.addEventListener('change', () => handleInput(endInput, false));

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

        // Cleanup on close
        const originalClose = modal.close.bind(modal);
        modal.close = () => {
            if (player) {
                player.destroy();
            }
            originalClose();
        };

        // Trim Action
        trimBtn.addEventListener('click', async () => {
            // UI State
            modalContent.classList.add('processing');
            trimBtn.disabled = true;
            modal.closeBtn.disabled = true;
            progressSection.classList.remove('hidden');
            errorMessage.classList.add('hidden');
            successMessage.classList.add('hidden');

            try {
                // Get source with caching
                const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());

                // Trim
                const blob = await MediaProcessor.process({
                    source: source,
                    format: 'mp4',
                    quality: 100,
                    trim: {
                        start: startTime,
                        end: endTime
                    },
                    onProgress: (progress) => {
                        const percent = Math.round(progress * 100);
                        progressBar.style.width = `${percent}% `;
                        progressPercentage.textContent = `${percent}% `;
                    }
                });

                // Success
                successMessage.classList.remove('hidden');

                // Configure Download
                const ext = 'mp4';
                const filename = item.title.replace(/\.[^/.]+$/, "") + `- trimmed - ${Math.round(startTime)} -${Math.round(endTime)}.${ext} `;
                const url = URL.createObjectURL(blob);

                downloadBtn.href = url;
                downloadBtn.download = filename;
                downloadBtn.classList.remove('hidden');

                // Add to Playlist
                if (addToPlaylistCheckbox.checked) {
                    const newItem = {
                        id: generateId(),
                        title: filename,
                        url: url,
                        file: new File([blob], filename, { type: `video / ${ext} ` }),
                        duration: formatTime(endTime - startTime),
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
                console.error('Trimming failed:', e);
                errorMessage.textContent = `Trimming failed: ${e.message} `;
                errorMessage.classList.remove('hidden');
                trimBtn.disabled = false;
                modal.closeBtn.disabled = false;
                progressSection.classList.add('hidden');
            }
        });
    }
}
