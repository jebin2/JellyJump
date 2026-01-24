import { Logger } from "../../utils/Logger.js";
import { CorePlayer } from '../../core/Player.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';

/**
 * Box Editor Utilities - Shared functionality for CropMenu and WatermarkMenu
 * KISS: Single source of truth for drag/resize logic
 */

/**
 * Load video into a CorePlayer instance
 * @param {string} containerId - DOM container ID for the player
 * @param {Object} item - Playlist item
 * @param {Object} playlist - Playlist instance
 * @param {Object} state - State object with video: { width, height }
 * @returns {CorePlayer|null} Player instance or null on failure
 */
export async function loadVideo(containerId, item, playlist, state) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const player = new CorePlayer(containerId, {
        mode: 'player',
        controlBarMode: 'fixed',
        controls: {
            playOverlay: false, // Hide big play overlay in modals
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

        // Get video dimensions from metadata
        if (item.videoInfo?.width && item.videoInfo?.height) {
            state.video.width = item.videoInfo.width;
            state.video.height = item.videoInfo.height;
        }

        // Load video
        await MediaMetadata.getProcessedSourceURL(item, () => playlist._saveState());
        await player.load(item.blob_url, false);

        // Wait for metadata if needed
        for (let i = 0; i < 10 && !state.video.width; i++) {
            await new Promise(resolve => setTimeout(resolve, 100));
            const videoEl = player.displayContainer?.querySelector('video');
            if (videoEl?.videoWidth) {
                state.video.width = videoEl.videoWidth;
                state.video.height = videoEl.videoHeight;
            }
        }

        // Fallback defaults
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

/**
 * Update overlay position to match video display area (handles letterbox/pillarbox)
 * @param {HTMLElement} overlay - The overlay element
 * @param {HTMLElement} playerContainer - Container with the canvas
 * @param {Object} state - State with video dimensions and preview.scale
 * @param {Function} onUpdate - Callback after overlay is positioned
 */
export function updateOverlay(overlay, playerContainer, state, onUpdate) {
    const canvas = playerContainer?.querySelector('canvas');
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

    // Position overlay
    overlay.style.width = `${displayWidth}px`;
    overlay.style.height = `${displayHeight}px`;
    overlay.style.left = `${offsetX}px`;
    overlay.style.top = `${offsetY}px`;

    // Update scale
    state.preview.scale = displayWidth / state.video.width;

    if (onUpdate) onUpdate();
}

/**
 * Setup drag handlers for a resizable box
 * @param {HTMLElement} overlay - Container for mouse events
 * @param {HTMLElement} box - The draggable/resizable box element
 * @param {Object} state - State with video, box, preview, drag
 * @param {number} minSize - Minimum box size
 * @param {Function} onUpdate - Callback when box is moved/resized
 * @returns {Object} Cleanup handlers { onMouseMove, onMouseUp }
 */
export function setupDragHandlers(overlay, box, state, minSize, onUpdate) {
    const getMousePos = (e) => {
        const rect = overlay.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) / state.preview.scale,
            y: (e.clientY - rect.top) / state.preview.scale
        };
    };

    const onMouseDown = (e) => {
        const isHandle = e.target.classList.contains('crop-handle');
        const isBox = e.target.closest('[data-crop-box]') || e.target.closest('[data-watermark-box]');

        if (isHandle || isBox) {
            state.drag.active = true;
            state.drag.handle = isHandle ? e.target.dataset.handle : 'move';
            const pos = getMousePos(e);
            state.drag.startX = pos.x;
            state.drag.startY = pos.y;
            state.drag.startBox = { ...state.box };
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

        // Reset to start values
        state.box.x = start.x;
        state.box.y = start.y;
        state.box.width = start.width;
        state.box.height = start.height;

        if (h === 'move') {
            // Move box
            state.box.x = Math.max(0, Math.min(start.x + dx, state.video.width - start.width));
            state.box.y = Math.max(0, Math.min(start.y + dy, state.video.height - start.height));
        } else {
            // Resize - CRITICAL: Calculate fixed edges first

            if (h.includes('w')) {
                // Moving LEFT edge - RIGHT edge is fixed
                const fixedRight = start.x + start.width;
                const newLeft = Math.max(0, Math.min(start.x + dx, fixedRight - minSize));
                state.box.x = newLeft;
                state.box.width = fixedRight - newLeft;
            }

            if (h.includes('e')) {
                // Moving RIGHT edge - LEFT edge is fixed
                const maxRight = state.video.width;
                state.box.width = Math.max(minSize, Math.min(start.width + dx, maxRight - start.x));
            }

            if (h.includes('n')) {
                // Moving TOP edge - BOTTOM edge is fixed
                const fixedBottom = start.y + start.height;
                const newTop = Math.max(0, Math.min(start.y + dy, fixedBottom - minSize));
                state.box.y = newTop;
                state.box.height = fixedBottom - newTop;
            }

            if (h.includes('s')) {
                // Moving BOTTOM edge - TOP edge is fixed
                const maxBottom = state.video.height;
                state.box.height = Math.max(minSize, Math.min(start.height + dy, maxBottom - start.y));
            }
        }

        if (onUpdate) onUpdate();
    };

    const onMouseUp = () => {
        state.drag.active = false;
        state.drag.handle = null;
    };

    overlay.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return { onMouseMove, onMouseUp };
}

/**
 * Update box element position from state
 * @param {HTMLElement} box - The box element
 * @param {Object} state - State with box and preview.scale
 */
export function updateBoxPosition(box, state) {
    const scale = state.preview.scale;
    box.style.left = `${state.box.x * scale}px`;
    box.style.top = `${state.box.y * scale}px`;
    box.style.width = `${state.box.width * scale}px`;
    box.style.height = `${state.box.height * scale}px`;
}

// === UI HELPERS ===

export function showError(element, message) {
    element.textContent = message;
    element.classList.remove('hidden');
}

export function hideMessage(element) {
    element.classList.add('hidden');
}

export function showProgress(progress, status = '') {
    if (progress.bar) progress.bar.style.width = '0%';
    if (progress.text) progress.text.textContent = '0%';
    if (progress.status) progress.status.textContent = status;
    progress.section.classList.remove('hidden');
}

export function hideProgress(progress) {
    progress.section.classList.add('hidden');
}

export function showSuccess(element, message) {
    element.textContent = `✓ ${message}`;
    element.classList.remove('hidden');
}

/**
 * Setup cleanup for modal close
 * @param {Object} modal - Modal instance
 * @param {CorePlayer} player - Player instance
 * @param {Object} cleanup - { onMouseMove, onMouseUp } handlers
 */
export function setupCleanup(modal, player, cleanup) {
    const originalClose = modal.close.bind(modal);
    modal.close = () => {
        if (cleanup) {
            document.removeEventListener('mousemove', cleanup.onMouseMove);
            document.removeEventListener('mouseup', cleanup.onMouseUp);
        }
        if (player) player.destroy();
        originalClose();
    };
}
