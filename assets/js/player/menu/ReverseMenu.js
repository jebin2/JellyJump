import { Modal } from '../Modal.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { generateId, formatDuration, formatFileSize } from '../../utils/mediaUtils.js';
import { SpeedDropdown } from '../../utils/SpeedDropdown.js';

/**
 * Reverse Menu Handler
 * Handles video reversal operation
 */
export class ReverseMenu {
    /**
     * Initialize and open Reverse Video modal
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance  
     */
    static async init(item, playlist) {
        const contentTemplate = document.getElementById('reverse-content-template');
        const footerTemplate = document.getElementById('reverse-footer-template');

        if (!contentTemplate || !footerTemplate) {
            console.error('Reverse modal templates not found!');
            return;
        }

        const modal = new Modal({ maxWidth: '500px' });
        modal.setTitle('Reverse Video');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));

        const modalContent = modal.modal;

        // Open Modal
        modal.open();

        // Elements
        const sourceFilename = modalContent.querySelector('.source-filename');
        const sourceDuration = modalContent.querySelector('.source-duration');
        const sourceResolution = modalContent.querySelector('.source-resolution');
        const audioCheckbox = modalContent.querySelector('#reverse-include-audio');

        // Speed dropdown (using common utility)
        const speedBtn = modalContent.querySelector('[data-speed-btn]');
        const speedMenu = modalContent.querySelector('[data-speed-menu]');
        const speedDropdown = SpeedDropdown.init({
            button: speedBtn,
            menu: speedMenu
        });

        const processingInfo = modalContent.querySelector('.processing-info');
        const longVideoWarning = modalContent.querySelector('#long-video-warning');

        const reverseBtn = modalContent.querySelector('.reverse-btn');
        const downloadBtn = modalContent.querySelector('.download-btn');
        const progressSection = modalContent.querySelector('.progress-section');
        const progressBar = modalContent.querySelector('.progress-bar-fill');
        const progressText = modalContent.querySelector('.progress-percentage');
        const progressStatus = modalContent.querySelector('.progress-status');
        const frameCounter = modalContent.querySelector('.frame-counter');
        const errorMessage = modalContent.querySelector('.error-message');
        const successMessage = modalContent.querySelector('.success-message');

        const reverseLoading = modalContent.querySelector('.reverse-loading');
        const reverseContent = modalContent.querySelector('.reverse-content');

        // Disable button initially
        reverseBtn.disabled = true;

        // Populate Info
        sourceFilename.textContent = item.title;
        sourceFilename.title = item.title;

        // Ensure metadata
        await playlist._ensureMetadata(item);

        // Hide loading, show content, enable button
        reverseLoading.classList.add('hidden');
        reverseContent.classList.remove('hidden');
        reverseBtn.disabled = false;

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
        sourceDuration.textContent = formatDuration(videoDuration);
        sourceResolution.textContent = item.videoInfo
            ? `${item.videoInfo.width}×${item.videoInfo.height}`
            : 'Unknown';

        // Check for long video
        if (videoDuration > 60) {
            longVideoWarning.classList.remove('hidden');
            processingInfo.classList.remove('hidden');
        } else {
            processingInfo.classList.add('hidden');
        }



        const startReversal = async () => {
            const includeAudio = audioCheckbox.checked;
            const speed = speedDropdown.getCurrentSpeed();

            // UI Updates
            reverseBtn.disabled = true;

            // Disable download button
            downloadBtn.disabled = true;

            audioCheckbox.disabled = true;
            speedDropdown.setDisabled(true);

            progressSection.classList.remove('hidden');
            errorMessage.classList.add('hidden');
            successMessage.classList.add('hidden');

            // Prevent closing
            const originalClose = modal.close;
            modal.close = () => { }; // Disable close
            modal.modal.querySelector('.mb-modal-close').style.display = 'none';

            try {
                // Get source file
                let sourceFile;
                try {
                    sourceFile = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());
                } catch (e) {
                    console.error('Failed to get source blob:', e);
                    throw new Error('Cannot access video file');
                }

                // Execute Reversal
                const reversedBlob = await MediaProcessor.reverseVideo({
                    source: sourceFile,
                    includeAudio: includeAudio,
                    speed: speed,
                    onProgress: (progress) => {
                        const pct = Math.round(progress * 100);
                        progressBar.style.width = `${pct}%`;
                        progressText.textContent = `${pct}%`;

                        if (progress < 0.4) {
                            progressStatus.textContent = "Extracting frames...";
                        } else if (progress < 0.9) {
                            progressStatus.textContent = "Reversing & Encoding...";
                        } else {
                            progressStatus.textContent = "Finalizing...";
                        }
                    }
                });

                // Success
                successMessage.classList.remove('hidden');
                progressSection.classList.add('hidden');

                // Setup download
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const filename = `${item.title.replace(/\.[^.]+$/, '')}-reversed.mp4`;
                const url = URL.createObjectURL(reversedBlob);

                // Configure download button
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

                // Re-enable controls for another run
                audioCheckbox.disabled = false;
                speedDropdown.setDisabled(false);
                reverseBtn.disabled = false;

                // Add to playlist
                const newItem = {
                    title: filename,
                    url: url,
                    duration: null, // Let metadata fetcher populate this
                    thumbnail: item.thumbnail, // Use original thumbnail for now
                    isLocal: true,
                    file: new File([reversedBlob], filename, { type: 'video/mp4' }),
                    id: generateId(),
                    type: 'video/mp4'
                };

                const sourceIndex = playlist.items.indexOf(item);
                if (sourceIndex !== -1) {
                    playlist.items.splice(sourceIndex + 1, 0, newItem);
                } else {
                    playlist.items.push(newItem);
                }
                await playlist._ensureMetadata(newItem);

                // Mark as new (visual effect)
                // We'll handle this by re-rendering and highlighting
                playlist._saveState();
                playlist.render();

                // Generate thumbnail for new item
                // (Optional: trigger thumbnail generation)

            } catch (e) {
                console.error('Reversal failed:', e);
                errorMessage.textContent = `Reversal failed: ${e.message}`;
                errorMessage.classList.remove('hidden');
                progressSection.classList.add('hidden');

                // Re-enable controls on error
                audioCheckbox.disabled = false;
                speedDropdown.setDisabled(false);
                reverseBtn.disabled = false;
            } finally {
                // Restore close functionality
                modal.close = originalClose;
                modal.modal.querySelector('.mb-modal-close').style.display = '';
            }
        };

        reverseBtn.addEventListener('click', startReversal);
    }
}
