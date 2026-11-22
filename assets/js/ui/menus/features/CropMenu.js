import { MediaProcessor } from '../../../processing/MediaProcessor.js';
import { MediaMetadata } from '../../../shared/utils/MediaMetadata.js';
import {
    updateScale,
    setupDragHandlers,
    updateBoxPosition,
    showError,
    hideMessage,
    showProgress,
    hideProgress,
    showSuccess,
    setupAutoUpdate
} from './BoxEditorUtils.js';
import { openProcessMenu, FOOTER_CONFIGS } from '../core/MenuFactory.js';
import { runMenuJob } from '../core/MenuJob.js';
import { lendPicture } from '../core/PreviewPlayer.js';

/**
 * Crop: drag a box over the main player's picture, and keep what is inside.
 */
export class CropMenu {
    static async init(item, playlist) {
        const { modal, content: modalContent } = openProcessMenu('Crop', 'crop-content-template', FOOTER_CONFIGS.crop);
        if (!modal) return;
        const cropWrapper = modalContent.querySelector('.crop-preview-wrapper');

        // Get elements from template (overlay is sibling to player container)
        const elements = {
            playerContainer: null,
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

        // === STEP 1: The box goes over the main player's picture ===
        const stage = await lendPicture(modal, playlist);
        if (!stage) return;
        stage.adopt(elements.cropOverlay);
        elements.playerContainer = stage.wrapper;
        state.video = { ...stage.video };

        // === STEP 2: Setup Crop UI ===
        const observer = setupCropUI(elements, state);

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
        modal.onCleanup(() => {
            cleanup.dispose();
            clearTimeout(observer.timer);
            observer.current?.disconnect();
        });
    }
}

// === CROP-SPECIFIC FUNCTIONS ===

/** @returns {{timer: any, current: ResizeObserver|null}} so the panel can stop it */
function setupCropUI(elements, state) {
    const observer = { timer: null, current: null };
    // Initialize box to full video
    state.box = {
        x: 0,
        y: 0,
        width: state.video.width,
        height: state.video.height
    };

    // Update after player renders
    observer.timer = setTimeout(() => {
        // Calculate scale and offsets
        updateScale(elements.cropOverlay, state);
        updateBoxPosition(elements.cropBox, state);
        updateInputs(elements, state);

        // Auto Update on Container Resize
        if (elements.playerContainer) {
            observer.current = setupAutoUpdate(
                elements.playerContainer,
                elements.cropOverlay,
                state,
                () => updateBoxPosition(elements.cropBox, state)
            );
        }
    }, 200);
    return observer;
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

        showProgress(elements.progress, `Cropping to ${width}x${height}...`);
        await runMenuJob({
            name: 'Crop',
            subject: item.title,
            background: true,
            modal,
            work: async ({ signal, onProgress }) => {
                const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());
                return MediaProcessor.process({
                    source, format: 'mp4', quality: 100,
                    crop: { left: Math.round(state.box.x), top: Math.round(state.box.y), width, height },
                    onProgress, signal,
                });
            },
            done: (blob) => {
                const filename = item.title.replace(/\.[^/.]+$/, "") + `-crop-${width}x${height}.mp4`;
                const { url } = playlist.insertProcessedItem(item, blob, filename);
                elements.buttons.download.href = url;
                elements.buttons.download.download = filename;
                elements.buttons.download.classList.remove('hidden');
                elements.messages.success.textContent = '✓ Added to playlist';
            },
        });
    });
}