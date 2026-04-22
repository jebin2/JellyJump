import { Logger } from "../../utils/Logger.js";
import { openProcessMenu, FOOTER_CONFIGS } from './MenuFactory.js';
import { MediaProcessor } from "../../core/MediaProcessor.js";
import {
    loadVideo,
    setupEditor,
    setupCleanup
} from './BoxEditorUtils.js';

import { MediaMetadata } from "../../utils/MediaMetadata.js";

export class RotateMenu {
    /**
     * Initialize Rotate & Flip Menu
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(item, playlist) {
        const { modal, content: modalContent } = openProcessMenu('Rotate & Flip', 'rotate-content-template', FOOTER_CONFIGS.rotate, { splitLayout: true });
        if (!modal) return;

        // === Setup Editor DOM (Left Panel) ===
        const videoPanel = modalContent.querySelector('.modal-video-panel');
        // We use setupEditor to create the container structure, 
        // but we disable the overlay since we are not drawing boxes.
        const editorUI = setupEditor(videoPanel, {
            type: 'rotate',
            enableOverlay: false
        });

        // === Load Video ===
        // State object required by loadVideo
        const state = {
            video: { width: 0, height: 0 },
            preview: { scale: 1 }
        };

        const player = await loadVideo(editorUI.containerId, item, playlist, state);
        if (!player) {
            Logger.error('[RotateMenu] Failed to load video');
            return;
        }

        this._setup(modal, item, playlist, player, editorUI);
    }

    /**
     * Setup UI and Event Listeners
     * @private
     */
    static _setup(modal, item, playlist, player, editorUI) {
        const modalBody = modal.modal.querySelector('.mb-modal-body');

        // State
        let rotation = 0;
        let flipH = false;
        let flipV = false;
        let isProcessing = false;

        // Target element for CSS transforms
        // Try to find canvas or video inside the player container
        const getMediaElement = () => {
            return editorUI.playerContainer.querySelector('canvas') ||
                editorUI.playerContainer.querySelector('video');
        };

        // Update Transform Helper
        const updateUI = () => {
            const scaleX = flipH ? -1 : 1;
            const scaleY = flipV ? -1 : 1;
            const mediaEl = getMediaElement();

            if (mediaEl) {
                // Apply transform
                mediaEl.style.transition = 'transform 0.3s ease';
                mediaEl.style.transform = `rotate(${rotation}deg) scale(${scaleX}, ${scaleY})`;
            }

            modalBody.querySelector('.rotation-value').textContent = `${rotation}°`;
            modalBody.querySelector('.flip-value').textContent =
                (flipH && flipV) ? 'Horizontal & Vertical' :
                    (flipH ? 'Horizontal' :
                        (flipV ? 'Vertical' : 'None'));
        };

        // Control Listeners
        modalBody.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                if (isProcessing) return;
                // find button closest in case of SVG click
                const target = e.target.closest('button');
                const action = target.dataset.action;

                if (action === 'rotate-left') rotation -= 90;
                if (action === 'rotate-right') rotation += 90;

                // Normalize to 0, 90, 180, 270
                rotation = (rotation % 360 + 360) % 360;
                if (action === 'flip-h') flipH = !flipH;
                if (action === 'flip-v') flipV = !flipV;
                if (action === 'reset') { rotation = 0; flipH = false; flipV = false; }

                updateUI();
            });
        });

        // Process Button
        const processBtn = modal.modal.querySelector('.rotate-process-btn');
        const footer = modal.modal.querySelector('.mb-modal-footer');
        const progressSection = footer.querySelector('.progress-section');
        const statusText = footer.querySelector('.progress-status');
        const percentageText = footer.querySelector('.progress-percentage');

        const errorMsg = footer.querySelector('.error-message');
        const successMsg = footer.querySelector('.success-message');
        const actionButtons = footer.querySelector('.action-buttons');

        processBtn.addEventListener('click', async () => {
            if (isProcessing) return;
            isProcessing = true;

            // Normalize Rotation
            let normRotation = rotation % 360;

            // UI Update
            progressSection.classList.remove('hidden');
            actionButtons.classList.add('hidden');
            errorMsg.classList.add('hidden');
            successMsg.classList.add('hidden');
            statusText.textContent = 'Processing...';

            try {
                // Get source safely (fixes TypeError: blob must be a Blob)
                const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());

                // Filename generation
                const originalName = item.file ? item.file.name : (item.title || 'video.mp4');
                const nameParts = originalName.split('.');
                const ext = nameParts.pop();
                const baseName = nameParts.join('.');
                const newName = `${baseName}_rotated.${ext}`;

                const resultBlob = await MediaProcessor.process({
                    source: source,
                    format: 'mp4',
                    quality: 'high',
                    rotate: normRotation,
                    flip: (flipH || flipV) ? { horizontal: flipH, vertical: flipV } : null,
                    onProgress: (progress) => {
                        percentageText.textContent = `${Math.round(progress * 100)}%`;
                    }
                });

                // Success
                progressSection.classList.add('hidden');
                successMsg.classList.remove('hidden');

                // Add to playlist (under source item as subfolder)
                playlist.insertProcessedItem(item, resultBlob, newName);

                isProcessing = false;

            } catch (error) {
                Logger.error('[RotateMenu] Processing failed', error);
                progressSection.classList.add('hidden');
                actionButtons.classList.remove('hidden');
                errorMsg.textContent = 'Processing failed. See console.';
                errorMsg.classList.remove('hidden');
                isProcessing = false;
            }
        });

        // Add listener to reset UI on interaction
        const resetSuccessState = () => {
            if (!successMsg.classList.contains('hidden')) {
                successMsg.classList.add('hidden');
                actionButtons.classList.remove('hidden');
            }
        };

        modalBody.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', resetSuccessState);
        });

        // Cleanup
        setupCleanup(modal, player, null);
    }
}
