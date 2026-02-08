import { Logger } from "../../utils/Logger.js";
import { Modal } from '../Modal.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { generateId, formatTime, parseTime } from '../../utils/mediaUtils.js';
import { loadVideo, setupEditor } from './BoxEditorUtils.js'; // Added setupEditor

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

        const modal = new Modal({ splitLayout: true });
        modal.setTitle('Cut Video');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));

        const modalContent = modal.modal;

        // === SETUP EDITOR DOM (Unified) ===
        const videoPanel = modalContent.querySelector('.modal-video-panel');
        const editorUI = setupEditor(videoPanel, { type: 'trim', enableOverlay: false });

        // Open Modal Immediately
        modal.open();

        // Elements
        const trimLoading = modalContent.querySelector('.trim-loading');
        const trimContent = modalContent.querySelector('.trim-content');
        const startInput = modalContent.querySelector('#trim-start-input');
        const endInput = modalContent.querySelector('#trim-end-input');
        const setStartBtn = modalContent.querySelector('#trim-set-start-btn');
        const setEndBtn = modalContent.querySelector('#trim-set-end-btn');
        const durationDisplay = modalContent.querySelector('.trim-duration');
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
            // UI State
            modalContent.classList.add('processing');
            trimBtn.disabled = true;
            modal.closeBtn.disabled = true;
            // Hide previous messages and show progress
            errorMessage.classList.add('hidden');
            successMessage.classList.add('hidden');
            progressSection.classList.remove('hidden');

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
                        progressPercentage.textContent = `${percent}%`;
                    }
                });

                // Success
                progressSection.classList.add('hidden');
                successMessage.classList.remove('hidden');

                // Configure Download
                const ext = 'mp4';
                const filename = item.title.replace(/\.[^/.]+$/, "") + `- trimmed - ${Math.round(startTime)} -${Math.round(endTime)}.${ext} `;
                const url = URL.createObjectURL(blob);

                downloadBtn.href = url;
                downloadBtn.download = filename;
                downloadBtn.classList.remove('hidden');

                // Always add to Playlist
                const newItem = {
                    id: generateId(),
                    title: filename,
                    url: url,
                    file: new File([blob], filename, { type: `video/${ext}` }),
                    duration: formatTime(endTime - startTime),
                    type: 'video',
                    isLocal: true,
                    isNew: true,
                    path: (item.path || item.title) + '/' + filename
                };

                const insertIndex = playlist.items.indexOf(item) + 1;
                playlist.items.splice(insertIndex, 0, newItem);
                playlist.render();
                playlist._saveState();

                modal.closeBtn.disabled = false;

            } catch (e) {
                Logger.error('Trimming failed:', e);
                errorMessage.textContent = `Trimming failed: ${e.message} `;
                errorMessage.classList.remove('hidden');
                trimBtn.disabled = false;
                modal.closeBtn.disabled = false;
                progressSection.classList.add('hidden');
            }
        });
    }
}
