import { Logger } from "../../utils/Logger.js";
import { Modal } from '../Modal.js';
import { CorePlayer } from '../../core/Player.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { generateId } from '../../utils/mediaUtils.js';

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

        // State - KISS: video dimensions + watermark position
        const state = {
            video: { width: 0, height: 0 },
            watermark: { x: 0, y: 0, width: 0, height: 0, type: 'text', text: 'JellyJump', imageFile: null, opacity: 1.0 },
            preview: { scale: 1 },
            drag: { active: false, handle: null, startX: 0, startY: 0, startBox: {} }
        };

        const MIN_SIZE = 100;

        // === STEP 1: Load Video ===
        const player = await loadVideo(elements.playerContainer, item, playlist, state);
        if (!player) {
            showError(elements.messages.error, 'Failed to load video');
            return;
        }

        // === STEP 2: Setup Watermark UI ===
        setupWatermarkUI(elements, state);

        // === STEP 3: Handle Dragging ===
        setupDragHandlers(elements, state, MIN_SIZE);

        // === STEP 4: Handle Controls ===
        setupControlHandlers(elements, state);

        // === STEP 5: Process Watermark ===
        setupApplyButton(elements, state, item, playlist, modal);

        // === STEP 6: Cleanup ===
        setupCleanup(modal, player, elements);
    }
}

// === HELPER FUNCTIONS - Each does ONE thing ===

async function loadVideo(container, item, playlist, state) {
    if (!container) return null;

    const player = new CorePlayer('watermark-player-container', {
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

function setupWatermarkUI(elements, state) {
    // Initialize watermark to center, 25% width
    const initialW = state.video.width * 0.25;
    const initialH = initialW * 0.4;
    state.watermark.width = initialW;
    state.watermark.height = initialH;
    state.watermark.x = (state.video.width - initialW) / 2;
    state.watermark.y = (state.video.height - initialH) / 2;

    // Update overlay after player renders
    setTimeout(() => {
        updateOverlay(elements, state);
    }, 300);
}

function updateOverlay(elements, state) {
    const canvas = elements.playerContainer?.querySelector('canvas');
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
    elements.overlay.style.width = `${displayWidth}px`;
    elements.overlay.style.height = `${displayHeight}px`;
    elements.overlay.style.left = `${offsetX}px`;
    elements.overlay.style.top = `${offsetY}px`;

    // Calculate scale
    state.preview.scale = displayWidth / state.video.width;

    updateWatermarkBox(elements, state);
}

function updateWatermarkBox(elements, state) {
    const { x, y, width, height, opacity, type, text } = state.watermark;
    const scale = state.preview.scale;

    elements.watermarkBox.style.left = `${x * scale}px`;
    elements.watermarkBox.style.top = `${y * scale}px`;
    elements.watermarkBox.style.width = `${width * scale}px`;
    elements.watermarkBox.style.height = `${height * scale}px`;

    // Update content preview
    const content = type === 'text' ? elements.textPreview : elements.imagePreview;
    content.style.opacity = opacity;

    // Text sizing
    if (type === 'text') {
        const heightConstraint = height * scale * 0.8;
        const charCount = Math.max(1, text.length);
        const widthConstraint = (width * scale * 0.9) / (charCount * 0.5);
        let fontSize = Math.max(12, Math.min(heightConstraint, widthConstraint));
        elements.textPreview.style.fontSize = `${fontSize}px`;
    }
}

function setupDragHandlers(elements, state, MIN_SIZE) {
    const getMousePos = (e) => {
        const rect = elements.overlay.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / state.preview.scale,
            y: (e.clientY - rect.top) / state.preview.scale
        };
    };

    const onMouseDown = (e) => {
        const isHandle = e.target.classList.contains('crop-handle');
        const isBox = e.target.closest('[data-watermark-box]');

        if (isHandle || isBox) {
            state.drag.active = true;
            state.drag.handle = isHandle ? e.target.dataset.handle : 'move';
            const pos = getMousePos(e);
            state.drag.startX = pos.x;
            state.drag.startY = pos.y;
            state.drag.startBox = {
                x: state.watermark.x,
                y: state.watermark.y,
                w: state.watermark.width,
                h: state.watermark.height
            };
            e.preventDefault();
        }
    };

    const onMouseMove = (e) => {
        if (!state.drag.active) return;

        const pos = getMousePos(e);
        const dx = pos.x - state.drag.startX;
        const dy = pos.y - state.drag.startY;
        const h = state.drag.handle;
        const start = state.drag.startBox;

        // Reset to start values (EXACT same as crop menu)
        state.watermark.x = start.x;
        state.watermark.y = start.y;
        state.watermark.width = start.w;
        state.watermark.height = start.h;

        if (h === 'move') {
            // Move box
            state.watermark.x = Math.max(0, Math.min(start.x + dx, state.video.width - start.w));
            state.watermark.y = Math.max(0, Math.min(start.y + dy, state.video.height - start.h));
        } else {
            // Resize - CRITICAL: Calculate fixed edges first, then moving edges
            // This ensures the opposite edge stays locked in place

            if (h.includes('w')) {
                // Moving LEFT edge - RIGHT edge is fixed at (start.x + start.w)
                const fixedRight = start.x + start.w;
                const newLeft = Math.max(0, Math.min(start.x + dx, fixedRight - MIN_SIZE));
                state.watermark.x = newLeft;
                state.watermark.width = fixedRight - newLeft;
            }

            if (h.includes('e')) {
                // Moving RIGHT edge - LEFT edge is fixed at start.x
                const maxRight = state.video.width;
                const newWidth = Math.max(MIN_SIZE, Math.min(start.w + dx, maxRight - start.x));
                state.watermark.width = newWidth;
            }

            if (h.includes('n')) {
                // Moving TOP edge - BOTTOM edge is fixed at (start.y + start.h)
                const fixedBottom = start.y + start.h;
                const newTop = Math.max(0, Math.min(start.y + dy, fixedBottom - MIN_SIZE));
                state.watermark.y = newTop;
                state.watermark.height = fixedBottom - newTop;
            }

            if (h.includes('s')) {
                // Moving BOTTOM edge - TOP edge is fixed at start.y
                const maxBottom = state.video.height;
                const newHeight = Math.max(MIN_SIZE, Math.min(start.h + dy, maxBottom - start.y));
                state.watermark.height = newHeight;
            }
        }

        updateWatermarkBox(elements, state);
    };

    const onMouseUp = () => {
        state.drag.active = false;
        state.drag.handle = null;
    };

    elements.overlay.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    // Store for cleanup
    elements._cleanup = { onMouseMove, onMouseUp };
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
                    state.watermark.height = state.watermark.width / aspect;
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
                x: Math.round(state.watermark.x),
                y: Math.round(state.watermark.y),
                width: Math.round(state.watermark.width),
                height: Math.round(state.watermark.height)
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
                    elements.progress.bar.style.width = `${percent}%`;
                    elements.progress.text.textContent = `${percent}%`;
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

function showProgress(progress) {
    progress.bar.style.width = '0%';
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