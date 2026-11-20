import { MediaProcessor } from '../../../core/MediaProcessor.js';
import { MediaMetadata } from '../../../shared/utils/MediaMetadata.js';
import { formatTime, parseTime } from '../../../shared/utils/mediaUtils.js';
import { loadVideo, setupEditor } from './BoxEditorUtils.js'; // Added setupEditor
import { openProcessMenu, FOOTER_CONFIGS } from '../core/MenuFactory.js';
import { runMenuJob } from '../core/MenuJob.js';

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
        const { modal, content: modalContent } = openProcessMenu('Clip Video', 'trim-content-template', FOOTER_CONFIGS.trim, { splitLayout: true });
        if (!modal) return;

        // === SETUP EDITOR DOM (Unified) ===
        const videoPanel = modalContent.querySelector('.modal-video-panel');
        const editorUI = setupEditor(videoPanel, { type: 'trim', enableOverlay: false });

        // Elements
        const trimLoading = modalContent.querySelector('.trim-loading');
        const trimContent = modalContent.querySelector('.trim-content');
        const startInput = modalContent.querySelector('#trim-start-input');
        const endInput = modalContent.querySelector('#trim-end-input');
        const setStartBtn = modalContent.querySelector('#trim-set-start-btn');
        const setEndBtn = modalContent.querySelector('#trim-set-end-btn');
        const durationDisplay = modalContent.querySelector('.trim-duration');
        const losslessToggle = modalContent.querySelector('#trim-lossless-toggle');
        const trimBtn = modalContent.querySelector('.trim-btn');
        const downloadBtn = modalContent.querySelector('.download-btn');
        const progressSection = modalContent.querySelector('.progress-section');
        const progressPercentage = modalContent.querySelector('.progress-percentage');
        const errorMessage = modalContent.querySelector('.error-message');
        const successMessage = modalContent.querySelector('.success-message');

        // Initial State
        trimBtn.disabled = true;


        // Ensure metadata
        await playlist._ensureMetadata(item);

        // Get Video Duration
        let duration = 0;
        if (item.duration && typeof item.duration === 'string' && item.duration !== '--:--') {
            duration = parseTime(item.duration);
        }



        // Initialize displays
        startInput.value = formatTime(0);
        endInput.value = formatTime(duration);
        durationDisplay.textContent = formatTime(duration);

        // State
        let startTime = 0;
        let endTime = duration;

        // Load Video
        const state = { video: { width: 0, height: 0 } }; // Dummy state for loadVideo
        const player = await loadVideo(editorUI.containerId, item, playlist, state);

        if (player) {
            // Enable A-B Loop Mode
            player.loopMode = 'ab';
            player.loopStart = startTime;
            player.loopEnd = endTime;
        }

        // Show Content
        trimLoading.classList.add('hidden');
        trimContent.classList.remove('hidden');
        trimBtn.disabled = false;

        // Update UI
        const updateUI = () => {
            // Update Displays
            if (document.activeElement !== startInput) startInput.value = formatTime(startTime);
            if (document.activeElement !== endInput) endInput.value = formatTime(endTime);

            // Update Duration
            const trimDuration = Math.max(0, endTime - startTime);
            durationDisplay.textContent = formatTime(trimDuration);



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
        startInput.onchange = (e) => {
            const val = parseTime(e.target.value);
            if (val !== null) {
                startTime = Math.max(0, Math.min(val, duration));
                updateUI();
                if (player) player.seek(startTime);
            } else {
                updateUI(); // Reset on invalid
            }
        };

        endInput.onchange = (e) => {
            const val = parseTime(e.target.value);
            if (val !== null) {
                endTime = Math.max(0, Math.min(val, duration));
                updateUI();
                if (player) player.seek(endTime);
            } else {
                updateUI(); // Reset on invalid
            }
        };

        setStartBtn.onclick = () => {
            if (player) {
                startTime = player.currentTime;
                updateUI();
            }
        };

        setEndBtn.onclick = () => {
            if (player) {
                endTime = player.currentTime;
                updateUI();
            }
        };

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
            modalContent.classList.add('processing');
            await runMenuJob({
                name: 'Trimming',
                progress: { section: progressSection, text: progressPercentage },
                error: errorMessage,
                success: successMessage,
                lock: [trimBtn, losslessToggle],
                modal,
                // A finished trim is not run again by accident.
                unlock: 'onFailure',
                work: async ({ signal, onProgress }) => {
                    const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());
                    const trim = { start: startTime, end: endTime };
                    return losslessToggle?.checked
                        ? MediaProcessor.losslessTrim({ source, trim, onProgress, signal })
                        : MediaProcessor.process({ source, format: 'mp4', quality: 100, trim, onProgress, signal });
                },
                done: (blob) => {
                    const ext = 'mp4';
                    const filename = item.title.replace(/\.[^/.]+$/, "") + `- trimmed - ${Math.round(startTime)} -${Math.round(endTime)}.${ext}`;
                    // Always add to Playlist
                    const { url } = playlist.insertProcessedItem(item, blob, filename, {
                        type: `video/${ext}`,
                        duration: formatTime(endTime - startTime),
                    });
                    downloadBtn.href = url;
                    downloadBtn.download = filename;
                    downloadBtn.classList.remove('hidden');
                },
            });
        });
    }
}
