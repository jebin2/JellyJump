import { Logger } from "../../utils/Logger.js";
import { Modal } from '../Modal.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { generateId } from '../../utils/mediaUtils.js';
import {
    loadVideo,
    updateOverlay,
    setupDragHandlers,
    updateBoxPosition,
    showError,
    hideMessage,
    showProgress,
    hideProgress,
    showSuccess,
    setupCleanup
} from './BoxEditorUtils.js';

/**
 * Watermark Menu Handler - KISS Flow
 * Simple, clear flow: Load video -> Setup UI -> Drag/Resize -> Apply watermark
 */
export class WatermarkMenu {
    static async init(item, playlist) {
        const contentTemplate = document.getElementById('watermark-content-template');
        const footerTemplate = document.getElementById('watermark-footer-template');
        if (!contentTemplate || !footerTemplate) return;

        // Create modal
        const modal = new Modal({ maxWidth: '650px' });
        modal.setTitle('Add Watermark');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));
        modal.open();

        const modalContent = modal.modal;

        // Get all elements
        const elements = {
            playerContainer: modalContent.querySelector('#watermark-player-container'),
            watermarkBox: modalContent.querySelector('[data-watermark-box]'),
            overlay: modalContent.querySelector('.watermark-overlay'),
            textPreview: modalContent.querySelector('.text-content'),
            imagePreview: modalContent.querySelector('.image-content'),
            controls: {
                typeToggle: modalContent.querySelector('#wm-type-toggle'),
                textGroup: modalContent.querySelector('.wm-text-input-group'),
                imageGroup: modalContent.querySelector('.wm-image-input-group'),
                textInput: modalContent.querySelector('#wm-text-content'),
                imageInput: modalContent.querySelector('#wm-image-file'),
                opacitySlider: modalContent.querySelector('#wm-opacity'),
                opacityValue: modalContent.querySelector('.wm-opacity-value')
            },
            buttons: {
                apply: modalContent.querySelector('.apply-btn'),
                download: modalContent.querySelector('.download-btn')
            },
            progress: {
                section: modalContent.querySelector('.progress-section'),
                bar: modalContent.querySelector('.progress-bar-fill'),
                text: modalContent.querySelector('.progress-percentage')
            },
            messages: {
                error: modalContent.querySelector('.error-message'),
                success: modalContent.querySelector('.success-message')
            }
        };

        // State - using shared box format + watermark-specific props
        const state = {
            video: { width: 0, height: 0 },
            box: { x: 0, y: 0, width: 0, height: 0 },
            watermark: { type: 'text', text: 'JellyJump', imageFile: null, opacity: 1.0 },
            preview: { scale: 1 },
            drag: { active: false, handle: null, startX: 0, startY: 0, startBox: {} }
        };

        const MIN_SIZE = 100;

        // === STEP 1: Load Video ===
        const player = await loadVideo('watermark-player-container', item, playlist, state);
        if (!player) {
            showError(elements.messages.error, 'Failed to load video');
            return;
        }

        // === STEP 2: Setup Watermark UI ===
        setupWatermarkUI(elements, state);

        // === STEP 3: Handle Dragging ===
        const onUpdate = () => {
            updateWatermarkBox(elements, state);
        };
        const cleanup = setupDragHandlers(elements.overlay, elements.watermarkBox, state, MIN_SIZE, onUpdate);

        // === STEP 4: Handle Controls ===
        setupControlHandlers(elements, state);

        // === STEP 5: Process Watermark ===
        setupApplyButton(elements, state, item, playlist, modal);

        // === STEP 6: Cleanup ===
        setupCleanup(modal, player, cleanup);
    }
}

// === WATERMARK-SPECIFIC FUNCTIONS ===

function setupWatermarkUI(elements, state) {
    // Initialize box to center, 25% width
    const initialW = state.video.width * 0.25;
    const initialH = initialW * 0.4;
    state.box = {
        x: (state.video.width - initialW) / 2,
        y: (state.video.height - initialH) / 2,
        width: initialW,
        height: initialH
    };

    // Update overlay after player renders
    setTimeout(() => {
        updateOverlay(elements.overlay, elements.playerContainer, state, () => {
            updateWatermarkBox(elements, state);
        });
    }, 300);
}

function updateWatermarkBox(elements, state) {
    // Update box position
    updateBoxPosition(elements.watermarkBox, state);

    // Update content preview
    const { type, text, opacity } = state.watermark;
    const content = type === 'text' ? elements.textPreview : elements.imagePreview;
    content.style.opacity = opacity;

    // Text sizing
    if (type === 'text') {
        const scale = state.preview.scale;
        const heightConstraint = state.box.height * scale * 0.8;
        const charCount = Math.max(1, text.length);
        const widthConstraint = (state.box.width * scale * 0.9) / (charCount * 0.5);
        let fontSize = Math.max(12, Math.min(heightConstraint, widthConstraint));
        elements.textPreview.style.fontSize = `${fontSize}px`;
    }
}

function setupControlHandlers(elements, state) {
    const { typeToggle, textGroup, imageGroup, textInput, imageInput, opacitySlider, opacityValue } = elements.controls;

    // Type toggle
    typeToggle.addEventListener('change', (e) => {
        state.watermark.type = e.target.checked ? 'image' : 'text';

        if (state.watermark.type === 'text') {
            textGroup.classList.remove('hidden');
            imageGroup.classList.add('hidden');
            elements.textPreview.classList.remove('hidden');
            elements.imagePreview.classList.add('hidden');
        } else {
            textGroup.classList.add('hidden');
            imageGroup.classList.remove('hidden');
            elements.textPreview.classList.add('hidden');
            elements.imagePreview.classList.remove('hidden');
        }
        updateWatermarkBox(elements, state);
    });

    // Text input
    textInput.addEventListener('input', (e) => {
        state.watermark.text = e.target.value;
        elements.textPreview.textContent = state.watermark.text;
        updateWatermarkBox(elements, state);
    });

    // Image input
    imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            state.watermark.imageFile = file;
            const reader = new FileReader();
            reader.onload = (evt) => {
                elements.imagePreview.src = evt.target.result;

                // Auto-resize to image aspect ratio
                const tempImg = new Image();
                tempImg.onload = () => {
                    const aspect = tempImg.width / tempImg.height;
                    state.box.height = state.box.width / aspect;
                    updateWatermarkBox(elements, state);
                };
                tempImg.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    // Opacity slider
    opacitySlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        state.watermark.opacity = val / 100;
        opacityValue.textContent = `${val}%`;
        updateWatermarkBox(elements, state);
    });
}

function setupApplyButton(elements, state, item, playlist, modal) {
    elements.buttons.apply.addEventListener('click', async () => {
        hideMessage(elements.messages.error);
        hideMessage(elements.messages.success);
        showProgress(elements.progress);
        elements.buttons.apply.disabled = true;
        modal.closeBtn.disabled = true;

        try {
            const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());

            const watermarkConfig = {
                type: state.watermark.type,
                text: state.watermark.text,
                image: state.watermark.imageFile,
                opacity: state.watermark.opacity,
                x: Math.round(state.box.x),
                y: Math.round(state.box.y),
                width: Math.round(state.box.width),
                height: Math.round(state.box.height)
            };

            const ext = item.title.split('.').pop().toLowerCase();
            const format = ['mp4', 'webm', 'mov'].includes(ext) ? ext : 'mp4';

            const blob = await MediaProcessor.process({
                source: source,
                format: format,
                quality: 100,
                watermark: watermarkConfig,
                onProgress: (p) => {
                    const percent = Math.round(p * 100);
                    if (elements.progress.bar) elements.progress.bar.style.width = `${percent}%`;
                    if (elements.progress.text) elements.progress.text.textContent = `${percent}%`;
                }
            });

            // Success
            hideProgress(elements.progress);
            const filename = item.title.replace(/\.[^/.]+$/, "") + `-watermarked.${format}`;
            const url = URL.createObjectURL(blob);

            // Add to playlist
            const newItem = {
                id: generateId(),
                title: filename,
                url: url,
                file: new File([blob], filename, { type: blob.type }),
                duration: item.duration,
                type: 'video',
                path: (item.path || item.title) + '/' + filename
            };

            playlist.items.splice(playlist.items.indexOf(item) + 1, 0, newItem);
            playlist.render();
            playlist._saveState();

            elements.buttons.download.href = url;
            elements.buttons.download.download = filename;
            elements.buttons.download.classList.remove('hidden');

            showSuccess(elements.messages.success, 'Added to playlist');
            elements.buttons.apply.disabled = false;
            modal.closeBtn.disabled = false;

        } catch (e) {
            Logger.error('Watermark failed:', e);
            showError(elements.messages.error, `Watermark failed: ${e.message}`);
            hideProgress(elements.progress);
            elements.buttons.apply.disabled = false;
            modal.closeBtn.disabled = false;
        }
    });
}