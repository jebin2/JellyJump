import { Logger } from "../../utils/Logger.js";
import { Modal } from '../Modal.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import {
    loadVideo,
    updateScale,
    setupDragHandlers,
    updateBoxPosition,
    showError,
    hideMessage,
    showProgress,
    hideProgress,
    showSuccess,
    setupCleanup,
    setupAutoUpdate
} from './BoxEditorUtils.js';
import { createProcessFooter, FOOTER_CONFIGS } from '../../utils/FooterHelper.js';

/**
 * Crop Menu Handler - Fresh Implementation
 * Simple, clear flow: Load video -> Setup crop UI -> Drag to crop -> Process
 */
export class CropMenu {
    static async init(item, playlist) {
        const contentTemplate = document.getElementById('crop-content-template');
        if (!contentTemplate) return;

        // Create modal
        const modal = new Modal({ splitLayout: true });
        modal.setTitle('Crop Video');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(createProcessFooter(FOOTER_CONFIGS.crop));
        modal.open();

        const modalContent = modal.modal;
        const playerContainerId = 'crop-player-container';
        const playerContainer = modalContent.querySelector(`#${playerContainerId}`);
        const cropWrapper = modalContent.querySelector('.crop-preview-wrapper');

        // Get elements from template (overlay is sibling to player container)
        const elements = {
            playerContainer,
            cropWrapper,
            cropOverlay: cropWrapper.querySelector('[data-crop-overlay]'),
            cropBox: cropWrapper.querySelector('[data-crop-box]'),
            inputs: {
                left: modalContent.querySelector('#crop-left'),
                top: modalContent.querySelector('#crop-top'),
                width: modalContent.querySelector('#crop-width'),
                height: modalContent.querySelector('#crop-height')
            },
            buttons: {
                crop: modalContent.querySelector('.crop-btn'),
                download: modalContent.querySelector('.download-btn')
            },
            progress: {
                section: modalContent.querySelector('.progress-section'),
                text: modalContent.querySelector('.progress-percentage'),
                status: modalContent.querySelector('.progress-status')
            },
            messages: {
                error: modalContent.querySelector('.error-message'),
                success: modalContent.querySelector('.success-message')
            }
        };

        // State
        const state = {
            video: { width: 0, height: 0 },
            box: { x: 0, y: 0, width: 0, height: 0 },
            preview: { scale: 1, offsetX: 0, offsetY: 0, displayWidth: 0, displayHeight: 0 },
        };

        const MIN_SIZE = 40;

        // === STEP 1: Load Video ===
        const player = await loadVideo(playerContainerId, item, playlist, state);
        if (!player) {
            showError(elements.messages.error, 'Failed to load video');
            return;
        }

        // === STEP 2: Setup Crop UI ===
        setupCropUI(elements, state, player);

        // === STEP 3: Handle Dragging ===
        const onUpdate = () => {
            updateBoxPosition(elements.cropBox, state);
            updateInputs(elements, state);
        };
        const cleanup = setupDragHandlers(elements.cropOverlay, elements.cropBox, state, MIN_SIZE, onUpdate);

        // === STEP 4: Handle Inputs ===
        setupInputHandlers(elements, state);

        // === STEP 5: Process Crop ===
        setupCropButton(elements, state, item, playlist, modal);

        // === STEP 6: Cleanup ===
        setupCleanup(modal, player, cleanup);
    }
}

// === CROP-SPECIFIC FUNCTIONS ===

function setupCropUI(elements, state, player) {
    // Initialize box to full video
    state.box = {
        x: 0,
        y: 0,
        width: state.video.width,
        height: state.video.height
    };

    // Update after player renders
    setTimeout(() => {
        // Calculate scale and offsets
        updateScale(elements.cropOverlay, state);
        updateBoxPosition(elements.cropBox, state);
        updateInputs(elements, state);

        // Auto Update on Container Resize
        if (elements.playerContainer) {
            const observer = setupAutoUpdate(
                elements.playerContainer,
                elements.cropOverlay,
                state,
                () => updateBoxPosition(elements.cropBox, state)
            );
            if (player) player.updateObserver = observer;
        }
    }, 200);
}

function updateInputs(elements, state) {
    elements.inputs.left.value = Math.round(state.box.x);
    elements.inputs.top.value = Math.round(state.box.y);
    elements.inputs.width.value = Math.round(state.box.width);
    elements.inputs.height.value = Math.round(state.box.height);
}

function setupInputHandlers(elements, state) {
    const handleChange = () => {
        state.box.x = Math.max(0, parseInt(elements.inputs.left.value) || 0);
        state.box.y = Math.max(0, parseInt(elements.inputs.top.value) || 0);
        state.box.width = Math.max(100, parseInt(elements.inputs.width.value) || 100);
        state.box.height = Math.max(100, parseInt(elements.inputs.height.value) || 100);

        // Clamp to video bounds
        state.box.x = Math.min(state.box.x, state.video.width - 100);
        state.box.y = Math.min(state.box.y, state.video.height - 100);
        state.box.width = Math.min(state.box.width, state.video.width - state.box.x);
        state.box.height = Math.min(state.box.height, state.video.height - state.box.y);

        updateScale(elements.cropOverlay, state);
        updateBoxPosition(elements.cropBox, state);
        updateInputs(elements, state);
    };

    Object.values(elements.inputs).forEach(input => {
        input.addEventListener('input', handleChange);
    });
}

function setupCropButton(elements, state, item, playlist, modal) {
    elements.buttons.crop.addEventListener('click', async () => {
        // Ensure even dimensions
        let width = Math.floor(state.box.width / 2) * 2;
        let height = Math.floor(state.box.height / 2) * 2;

        if (width < 64 || height < 64) {
            showError(elements.messages.error, 'Crop must be at least 64px');
            return;
        }

        hideMessage(elements.messages.error);
        hideMessage(elements.messages.success);
        showProgress(elements.progress, `Cropping to ${width}x${height}...`);
        elements.buttons.crop.disabled = true;
        modal.closeBtn.disabled = true;

        try {
            const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());

            const blob = await MediaProcessor.process({
                source: source,
                format: 'mp4',
                quality: 100,
                crop: {
                    left: Math.round(state.box.x),
                    top: Math.round(state.box.y),
                    width: width,
                    height: height
                },
                onProgress: (progress) => {
                    elements.progress.text.textContent = `${Math.round(progress * 100)}%`;
                }
            });

            // Success
            hideProgress(elements.progress);
            const filename = item.title.replace(/\.[^/.]+$/, "") + `-crop-${width}x${height}.mp4`;

            // Add to playlist
            const { url } = playlist.insertProcessedItem(item, blob, filename);

            elements.buttons.download.href = url;
            elements.buttons.download.download = filename;
            elements.buttons.download.classList.remove('hidden');

            showSuccess(elements.messages.success, 'Added to playlist');
            elements.buttons.crop.disabled = false;
            modal.closeBtn.disabled = false;

        } catch (e) {
            Logger.error('Crop failed:', e);
            showError(elements.messages.error, `Crop failed: ${e.message}`);
            hideProgress(elements.progress);
            elements.buttons.crop.disabled = false;
            modal.closeBtn.disabled = false;
        }
    });
}