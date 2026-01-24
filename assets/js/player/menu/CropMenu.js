import { Logger } from "../../utils/Logger.js";
import { Modal } from '../Modal.js';
import { CorePlayer } from '../../core/Player.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { generateId } from '../../utils/mediaUtils.js';

/**
 * Crop Menu Handler - KISS Flow
 * Simple, clear flow: Load video -> Setup crop UI -> Drag to crop -> Process
 */
export class CropMenu {
    static async init(item, playlist) {
        const contentTemplate = document.getElementById('crop-content-template');
        const footerTemplate = document.getElementById('crop-footer-template');
        if (!contentTemplate || !footerTemplate) return;

        // Create modal
        const modal = new Modal({ maxWidth: '650px' });
        modal.setTitle('Crop Video');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));
        modal.open();

        const modalContent = modal.modal;

        // Get all elements
        const elements = {
            playerContainer: modalContent.querySelector('#crop-player-container'),
            cropBox: modalContent.querySelector('[data-crop-box]'),
            cropOverlay: modalContent.querySelector('.crop-overlay'),
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
                section: modalContent.querySelector('.crop-progress'),
                text: modalContent.querySelector('.progress-percentage'),
                status: modalContent.querySelector('.status-text')
            },
            messages: {
                error: modalContent.querySelector('.crop-error'),
                success: modalContent.querySelector('.crop-success')
            }
        };

        // State - KISS: just 4 numbers
        const state = {
            video: { width: 0, height: 0 },
            crop: { left: 0, top: 0, width: 0, height: 0 },
            preview: { scale: 1 },
            drag: { active: false, handle: null, startX: 0, startY: 0, startCrop: {} }
        };

        const MIN_SIZE = 100;

        // === STEP 1: Load Video ===
        const player = await loadVideo(elements.playerContainer, item, playlist, state);
        if (!player) {
            showError(elements.messages.error, 'Failed to load video');
            return;
        }

        // === STEP 2: Setup Crop UI ===
        setupCropUI(elements, state);

        // === STEP 3: Handle Dragging ===
        setupDragHandlers(elements, state, MIN_SIZE);

        // === STEP 4: Handle Inputs ===
        setupInputHandlers(elements, state);

        // === STEP 5: Process Crop ===
        setupCropButton(elements, state, item, playlist, modal);

        // === STEP 6: Cleanup ===
        setupCleanup(modal, player, elements);
    }
}

// === HELPER FUNCTIONS - Each does ONE thing ===

async function loadVideo(container, item, playlist, state) {
    if (!container) return null;

    const player = new CorePlayer('crop-player-container', {
        mode: 'player',
        controlBarMode: 'fixed',
        controls: {
            playPause: true, time: true, progress: true,
            navigation: false, captions: false, settings: false,
            fullscreen: false, loop: false, speed: false,
            filters: false, equalizer: true, volumeOnly: true,
            modeToggle: false, keyboard: false
        },
        autoplay: false
    });

    try {
        await playlist._ensureMetadata(item);

        // Get video dimensions
        if (item.videoInfo?.width && item.videoInfo?.height) {
            state.video.width = item.videoInfo.width;
            state.video.height = item.videoInfo.height;
        }

        // Load video
        await MediaMetadata.getProcessedSourceURL(item, () => playlist._saveState());
        await player.load(item.blob_url, false);

        // Wait for metadata
        for (let i = 0; i < 10 && !state.video.width; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            const videoEl = player.displayContainer?.querySelector('video');
            if (videoEl?.videoWidth) {
                state.video.width = videoEl.videoWidth;
                state.video.height = videoEl.videoHeight;
            }
        }

        // Fallback
        if (!state.video.width) {
            state.video.width = 1920;
            state.video.height = 1080;
        }

        return player;
    } catch (e) {
        Logger.error('Video load failed:', e);
        return null;
    }
}

function setupCropUI(elements, state) {
    // Initialize crop to full video
    state.crop = {
        left: 0,
        top: 0,
        width: state.video.width,
        height: state.video.height
    };

    // Update overlay to match video display area
    setTimeout(() => {
        updateOverlay(elements, state);
        updateInputs(elements, state);
    }, 200);
}

function updateOverlay(elements, state) {
    const canvas = elements.playerContainer.querySelector('canvas');
    if (!canvas) return;

    const canvasRect = canvas.getBoundingClientRect();
    const videoAspect = state.video.width / state.video.height;
    const canvasAspect = canvasRect.width / canvasRect.height;

    let displayWidth, displayHeight, offsetX, offsetY;

    if (canvasAspect > videoAspect) {
        // Pillarbox (black bars left/right)
        displayHeight = canvasRect.height;
        displayWidth = displayHeight * videoAspect;
        offsetX = (canvasRect.width - displayWidth) / 2;
        offsetY = 0;
    } else {
        // Letterbox (black bars top/bottom)
        displayWidth = canvasRect.width;
        displayHeight = displayWidth / videoAspect;
        offsetX = 0;
        offsetY = (canvasRect.height - displayHeight) / 2;
    }

    // Position overlay over video
    elements.cropOverlay.style.width = `${displayWidth}px`;
    elements.cropOverlay.style.height = `${displayHeight}px`;
    elements.cropOverlay.style.left = `${offsetX}px`;
    elements.cropOverlay.style.top = `${offsetY}px`;

    // Calculate scale
    state.preview.scale = displayWidth / state.video.width;

    updateCropBox(elements, state);
}

function updateCropBox(elements, state) {
    const { left, top, width, height } = state.crop;
    const scale = state.preview.scale;

    elements.cropBox.style.left = `${left * scale}px`;
    elements.cropBox.style.top = `${top * scale}px`;
    elements.cropBox.style.width = `${width * scale}px`;
    elements.cropBox.style.height = `${height * scale}px`;
}

function updateInputs(elements, state) {
    elements.inputs.left.value = Math.round(state.crop.left);
    elements.inputs.top.value = Math.round(state.crop.top);
    elements.inputs.width.value = Math.round(state.crop.width);
    elements.inputs.height.value = Math.round(state.crop.height);
}

function setupDragHandlers(elements, state, MIN_SIZE) {
    const getMousePos = (e) => {
        const rect = elements.cropOverlay.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / state.preview.scale,
            y: (e.clientY - rect.top) / state.preview.scale
        };
    };

    const onMouseDown = (e) => {
        const handle = e.target.dataset.handle;
        if (handle || e.target === elements.cropBox) {
            state.drag.active = true;
            state.drag.handle = handle || 'move';
            const pos = getMousePos(e);
            state.drag.startX = pos.x;
            state.drag.startY = pos.y;
            state.drag.startCrop = { ...state.crop };
            e.preventDefault();
        }
    };

    const onMouseMove = (e) => {
        if (!state.drag.active) return;

        const pos = getMousePos(e);
        const dx = pos.x - state.drag.startX;
        const dy = pos.y - state.drag.startY;
        const h = state.drag.handle;
        const start = state.drag.startCrop;

        // Reset to start values
        state.crop = { ...start };

        if (h === 'move') {
            // Move box
            state.crop.left = Math.max(0, Math.min(start.left + dx, state.video.width - start.width));
            state.crop.top = Math.max(0, Math.min(start.top + dy, state.video.height - start.height));
        } else {
            // Resize - CRITICAL: Calculate fixed edges first, then moving edges
            // This ensures the opposite edge stays locked in place

            if (h.includes('w')) {
                // Moving LEFT edge - RIGHT edge is fixed at (start.left + start.width)
                const fixedRight = start.left + start.width;
                const newLeft = Math.max(0, Math.min(start.left + dx, fixedRight - MIN_SIZE));
                state.crop.left = newLeft;
                state.crop.width = fixedRight - newLeft;
            }

            if (h.includes('e')) {
                // Moving RIGHT edge - LEFT edge is fixed at start.left
                const maxRight = state.video.width;
                const newWidth = Math.max(MIN_SIZE, Math.min(start.width + dx, maxRight - start.left));
                state.crop.width = newWidth;
            }

            if (h.includes('n')) {
                // Moving TOP edge - BOTTOM edge is fixed at (start.top + start.height)
                const fixedBottom = start.top + start.height;
                const newTop = Math.max(0, Math.min(start.top + dy, fixedBottom - MIN_SIZE));
                state.crop.top = newTop;
                state.crop.height = fixedBottom - newTop;
            }

            if (h.includes('s')) {
                // Moving BOTTOM edge - TOP edge is fixed at start.top
                const maxBottom = state.video.height;
                const newHeight = Math.max(MIN_SIZE, Math.min(start.height + dy, maxBottom - start.top));
                state.crop.height = newHeight;
            }
        }

        updateCropBox(elements, state);
        updateInputs(elements, state);
    };

    const onMouseUp = () => {
        state.drag.active = false;
        state.drag.handle = null;
    };

    elements.cropOverlay.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Store for cleanup
    elements._cleanup = { onMouseMove, onMouseUp };
}

function setupInputHandlers(elements, state) {
    const handleChange = () => {
        state.crop.left = Math.max(0, parseInt(elements.inputs.left.value) || 0);
        state.crop.top = Math.max(0, parseInt(elements.inputs.top.value) || 0);
        state.crop.width = Math.max(100, parseInt(elements.inputs.width.value) || 100);
        state.crop.height = Math.max(100, parseInt(elements.inputs.height.value) || 100);

        // Clamp to video bounds
        state.crop.left = Math.min(state.crop.left, state.video.width - 100);
        state.crop.top = Math.min(state.crop.top, state.video.height - 100);
        state.crop.width = Math.min(state.crop.width, state.video.width - state.crop.left);
        state.crop.height = Math.min(state.crop.height, state.video.height - state.crop.top);

        updateCropBox(elements, state);
        updateInputs(elements, state);
    };

    Object.values(elements.inputs).forEach(input => {
        input.addEventListener('input', handleChange);
    });
}

function setupCropButton(elements, state, item, playlist, modal) {
    elements.buttons.crop.addEventListener('click', async () => {
        // Ensure even dimensions
        let width = Math.floor(state.crop.width / 2) * 2;
        let height = Math.floor(state.crop.height / 2) * 2;

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
                    left: Math.round(state.crop.left),
                    top: Math.round(state.crop.top),
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
            const url = URL.createObjectURL(blob);

            elements.buttons.download.href = url;
            elements.buttons.download.download = filename;
            elements.buttons.download.classList.remove('hidden');

            // Add to playlist
            const newItem = {
                id: generateId(),
                title: filename,
                url: url,
                file: new File([blob], filename, { type: 'video/mp4' }),
                duration: item.duration,
                type: 'video',
                isLocal: true,
                isNew: true,
                path: (item.path || item.title) + '/' + filename
            };

            playlist.items.splice(playlist.items.indexOf(item) + 1, 0, newItem);
            playlist.render();
            playlist._saveState();

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

function setupCleanup(modal, player, elements) {
    const originalClose = modal.close.bind(modal);
    modal.close = () => {
        if (elements._cleanup) {
            document.removeEventListener('mousemove', elements._cleanup.onMouseMove);
            document.removeEventListener('mouseup', elements._cleanup.onMouseUp);
        }
        if (player) player.destroy();
        originalClose();
    };
}

// UI Helpers
function showError(element, message) {
    element.textContent = message;
    element.classList.remove('hidden');
}

function hideMessage(element) {
    element.classList.add('hidden');
}

function showProgress(progress, status) {
    progress.status.textContent = status;
    progress.text.textContent = '0%';
    progress.section.classList.remove('hidden');
}

function hideProgress(progress) {
    progress.section.classList.add('hidden');
}

function showSuccess(element, message) {
    element.textContent = `✓ ${message}`;
    element.classList.remove('hidden');
}