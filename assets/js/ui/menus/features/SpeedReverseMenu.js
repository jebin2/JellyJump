import { Logger } from "../../../shared/utils/Logger.js";
import { MediaProcessor } from '../../../processing/MediaProcessor.js';
import { MediaMetadata } from '../../../shared/utils/MediaMetadata.js';
import { formatTime, parseTime } from '../../../shared/utils/mediaUtils.js';
import { openProcessMenu, FOOTER_CONFIGS } from '../core/MenuFactory.js';
import { runMenuJob } from '../core/MenuJob.js';
import { setActionLabel } from '../../../shared/utils/FooterHelper.js';

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
            if (processBtn) {
                setActionLabel(processBtn, isReverse ? 'Reverse Video' : 'Change Speed');
                // Forward at 1x with the audio is the same video again.
                const unchanged = !isReverse && speed === 1 && audioCheckbox?.checked !== false;
                processBtn.disabled = unchanged;
                if (unchanged) processBtn.title = 'Pick another speed, reverse it, or leave out the audio';
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
        audioCheckbox?.addEventListener('change', updateUI);

        // Initialize UI
        updateUI();

        // Process Handler
        if (processBtn) {
            processBtn.addEventListener('click', async () => {
                const speed = speedSlider ? parseFloat(speedSlider.value) : 1;
                const includeAudio = audioCheckbox ? audioCheckbox.checked : true;
                const isReverse = modalContent.querySelector('input[name="direction"]:checked').value === 'reverse';

                await runMenuJob({
                    name: isReverse ? 'Reverse' : 'Speed',
                    subject: item.title,
                    background: true,
                    modal,
                    work: async ({ signal, onProgress }) => {
                        let sourceFile;
                        try {
                            sourceFile = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());
                        } catch (e) {
                            Logger.error('Failed to get source blob:', e);
                            throw new Error('Cannot access video file');
                        }
                        const report = (progress) => onProgress(progress, progress < 0.9
                            ? (isReverse ? 'Reversing & Encoding...' : 'Processing frames...')
                            : 'Finalizing...');
                        const options = { source: sourceFile, speed, includeAudio, onProgress: report, signal };
                        return isReverse
                            ? MediaProcessor.reverseVideo(options)
                            : MediaProcessor.changeVideoSpeed(options);
                    },
                    done: async (outputBlob) => {
                        const speedTag = isReverse ? `reversed-${speed}x` : (speed < 1 ? `slow-${speed}x` : `fast-${speed}x`);
                        const filename = `${item.title.replace(/\.[^.]+$/, '')}-${speedTag}.mp4`;
                        const { item: newItem } = playlist.insertProcessedItem(item, outputBlob, filename, {
                            duration: null,
                            mediaType: 'video/mp4',
                            extra: { thumbnail: item.thumbnail },
                        });
                        await playlist._ensureMetadata(newItem);
                    },
                });
            });
        }
    }
}
