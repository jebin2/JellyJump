import { Logger } from "../../../utils/Logger.js";
import { CorePlayer } from '../../../core/Player.js';
import { MediaMetadata } from '../../../utils/MediaMetadata.js';

/**
 * Box Editor Utilities - Fresh Simplified Approach
 * 
 * Key Principle: Let CSS handle positioning. JS only handles:
 * 1. Loading video and detecting dimensions
 * 2. Scaling the crop box coordinates to display
 * 3. Drag/resize handlers
 */

/**
 * Load video into a CorePlayer instance and guarantee valid dimensions
 * @param {string} containerId - DOM container ID
 * @param {Object} item - Playlist item
 * @param {Object} playlist - Playlist instance
 * @param {Object} state - State object to populate video: {width, height}
 * @returns {CorePlayer|null} Player instance
 */
export async function loadVideo(containerId, item, playlist, state) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    const player = new CorePlayer(containerId, {
        mode: 'player',
        controlBarMode: 'fixed',
        controls: {
            playOverlay: false,
            playPause: true, time: true, progress: true,
            navigation: false, captions: false, settings: false,
            fullscreen: false, loop: false, speed: false,
            filters: false, equalizer: false, volumeOnly: true,
            modeToggle: false, keyboard: false,
            thumbnails: false
        },
        autoplay: false
    });

    try {
        // Load Source
        await MediaMetadata.getProcessedSourceURL(item, () => playlist._saveState());
        await player.load(item.blob_url, false);

        // Strict Dimension Detection: Trust Canvas Only
        state.video.width = 0;
        state.video.height = 0;

        for (let i = 0; i < 40; i++) { // Wait up to 2 seconds (50ms * 40)
            const canvas = player.canvas;
            // Check for valid intrinsic dimensions (default 300x150 is ignored unless explicit)
            if (canvas && canvas.width > 0 && canvas.width !== 300) {
                state.video.width = canvas.width;
                state.video.height = canvas.height;
                Logger.log(`[BoxEditor] Dimensions DETECTED from Canvas: ${state.video.width}x${state.video.height}`);
                break;
            } else {
                if (i % 10 === 0) Logger.log(`[BoxEditor] Waiting for canvas dimensions... (${i}) current: ${canvas?.width}x${canvas?.height}`);
            }
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Fallback (Rare)
        if (!state.video.width) {
            Logger.warn('[BoxEditor] Canvas detection failed. Fallback to metadata/default.');
            state.video.width = item.videoInfo?.width || 1920;
            state.video.height = item.videoInfo?.height || 1080;
        }

        return player;
    } catch (e) {
        Logger.error('[BoxEditor] Video load failed:', e);
        return null;
    } finally {
        if (player) {
            player.pause();
            player.seek(0);
        }
    }
}

/**
 * Calculate scale factor based on overlay/container size vs video intrinsic size
 * The overlay fills the container (via CSS inset: 0), which matches the video display.
 * 
 * @param {HTMLElement} overlay - The crop overlay element
 * @param {Object} state - State containing video.width, video.height
 */
export function updateScale(overlay, state) {

    if (!overlay || !state.video.width) {
        return;
    }

    // Find the canvas element in the player container
    const wrapper = overlay.parentElement;
    const canvas = wrapper?.querySelector('canvas');

    if (!canvas) {
        // Fallback to container-based calculation
        const containerRect = wrapper.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const containerHeight = containerRect.height;
        const videoAspect = state.video.width / state.video.height;
        const containerAspect = containerWidth / containerHeight;

        let scaledWidth, scaledHeight, offsetX, offsetY;
        if (containerAspect > videoAspect) {
            scaledHeight = containerHeight;
            scaledWidth = containerHeight * videoAspect;
            offsetX = (containerWidth - scaledWidth) / 2;
            offsetY = 0;
        } else {
            scaledWidth = containerWidth;
            scaledHeight = containerWidth / videoAspect;
            offsetX = 0;
            offsetY = (containerHeight - scaledHeight) / 2;
        }

        overlay.style.left = `${offsetX}px`;
        overlay.style.top = `${offsetY}px`;
        overlay.style.width = `${scaledWidth}px`;
        overlay.style.height = `${scaledHeight}px`;

        state.preview.scale = scaledWidth / state.video.width;
        state.preview.offsetX = 0;
        state.preview.offsetY = 0;
        state.preview.displayWidth = scaledWidth;
        state.preview.displayHeight = scaledHeight;
        return;
    }

    // Get actual canvas position/size relative to wrapper
    const wrapperRect = wrapper.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();

    const canvasLeft = canvasRect.left - wrapperRect.left;
    const canvasTop = canvasRect.top - wrapperRect.top;
    const canvasWidth = canvasRect.width;
    const canvasHeight = canvasRect.height;


    // Calculate video CONTENT area within canvas (object-fit: contain behavior)
    const videoWidth = state.video.width;
    const videoHeight = state.video.height;
    const videoAspect = videoWidth / videoHeight;
    const canvasAspect = canvasWidth / canvasHeight;

    let scaledWidth, scaledHeight, contentOffsetX, contentOffsetY;

    if (canvasAspect > videoAspect) {
        // Canvas is wider than video - pillarbox
        scaledHeight = canvasHeight;
        scaledWidth = canvasHeight * videoAspect;
        contentOffsetX = (canvasWidth - scaledWidth) / 2;
        contentOffsetY = 0;
    } else {
        // Canvas is taller than video - letterbox
        scaledWidth = canvasWidth;
        scaledHeight = canvasWidth / videoAspect;
        contentOffsetX = 0;
        contentOffsetY = (canvasHeight - scaledHeight) / 2;
    }


    // Position overlay at VIDEO CONTENT area (within canvas)
    const overlayLeft = canvasLeft + contentOffsetX;
    const overlayTop = canvasTop + contentOffsetY;

    overlay.style.position = 'absolute';
    overlay.style.left = `${overlayLeft}px`;
    overlay.style.top = `${overlayTop}px`;
    overlay.style.width = `${scaledWidth}px`;
    overlay.style.height = `${scaledHeight}px`;
    overlay.style.right = 'auto';
    overlay.style.bottom = 'auto';


    // Scale based on video content display size
    state.preview.scale = scaledWidth / videoWidth;
    state.preview.offsetX = 0;
    state.preview.offsetY = 0;
    state.preview.displayWidth = scaledWidth;
    state.preview.displayHeight = scaledHeight;

}

/**
 * Update crop box visual position based on state
 */
export function updateBoxPosition(box, state) {

    const s = state.preview.scale;
    const ox = state.preview.offsetX || 0;
    const oy = state.preview.offsetY || 0;

    const left = ox + state.box.x * s;
    const top = oy + state.box.y * s;
    const width = state.box.width * s;
    const height = state.box.height * s;


    // Position box considering the letterbox/pillarbox offset
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;
}

/**
 * Setup drag handlers with strict clamping
 */
export function setupDragHandlers(overlay, box, state, minSize, onUpdate) {
    // Convert mouse position (in overlay coords) to video coords
    const getVideoPos = (e) => {
        const rect = overlay.getBoundingClientRect();
        const ox = state.preview.offsetX || 0;
        const oy = state.preview.offsetY || 0;
        const scale = state.preview.scale || 1;

        // Mouse position relative to overlay
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Convert to video coordinates (accounting for letterbox offset)
        return {
            x: (mouseX - ox) / scale,
            y: (mouseY - oy) / scale
        };
    };

    let dragState = null;

    const handleMouseDown = (e) => {
        const isHandle = e.target.classList.contains('crop-handle');
        const isBox = e.target.closest('[data-crop-box]');

        if (!isHandle && !isBox) return;

        e.preventDefault();
        const pos = getVideoPos(e);

        dragState = {
            active: true,
            handle: isHandle ? e.target.dataset.handle : 'move',
            startX: pos.x,
            startY: pos.y,
            startBox: { ...state.box }
        };
    };

    const handleMouseMove = (e) => {
        if (!dragState?.active) return;

        const pos = getVideoPos(e);
        const dx = pos.x - dragState.startX;
        const dy = pos.y - dragState.startY;
        const start = dragState.startBox;
        const handle = dragState.handle;

        // Video bounds
        const maxW = state.video.width;
        const maxH = state.video.height;

        let bx = start.x;
        let by = start.y;
        let bw = start.width;
        let bh = start.height;


        if (handle === 'move') {
            bx = start.x + dx;
            by = start.y + dy;
        } else {
            // Resize Logic
            if (handle.includes('w')) {
                const right = start.x + start.width;
                bx = Math.min(start.x + dx, right - minSize);
                bw = right - bx;
            }
            if (handle.includes('e')) {
                bw = Math.max(minSize, start.width + dx);
            }
            if (handle.includes('n')) {
                const bottom = start.y + start.height;
                by = Math.min(start.y + dy, bottom - minSize);
                bh = bottom - by;
            }
            if (handle.includes('s')) {
                bh = Math.max(minSize, start.height + dy);
            }
        }


        // STRICT CLAMPING to video bounds
        bx = Math.max(0, Math.min(bx, maxW - minSize));
        by = Math.max(0, Math.min(by, maxH - minSize));
        bw = Math.min(bw, maxW - bx);
        bh = Math.min(bh, maxH - by);
        bw = Math.max(minSize, bw);
        bh = Math.max(minSize, bh);


        state.box = { x: bx, y: by, width: bw, height: bh };
        if (onUpdate) onUpdate();
    };

    const handleMouseUp = () => {
        if (dragState) {
            dragState.active = false;
            dragState = null;
        }
    };

    overlay.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return {
        onMouseMove: handleMouseMove,
        onMouseUp: handleMouseUp
    };
}

/**
 * Setup draw-on-overlay mouse handlers (shared by BlurMenu, WatermarkMenu)
 * @param {HTMLElement} overlay
 * @param {Object} state - must have state.preview.{offsetX,offsetY,scale} and state.video.{width,height}
 * @param {Object} options
 * @param {string} options.excludeBoxSelector - selector for the draggable box (skip draw on it)
 * @param {string} options.excludeRectSelector - selector for existing area rects (skip draw on them)
 * @param {number} options.minSize - minimum draw size in video coords
 * @param {function(x,y,w,h):void} options.onDraw - called when a valid rect is drawn
 * @returns {function} cleanup — removes all three document listeners
 */
export function setupOverlayDraw(overlay, state, { excludeBoxSelector, excludeRectSelector, minSize, onDraw }) {
    const getVideoPos = (e) => {
        const rect = overlay.getBoundingClientRect();
        const ox = state.preview.offsetX || 0;
        const oy = state.preview.offsetY || 0;
        const scale = state.preview.scale || 1;
        return {
            x: (e.clientX - rect.left - ox) / scale,
            y: (e.clientY - rect.top - oy) / scale
        };
    };

    let drawState = null;
    let drawPreview = null;

    const onMouseDown = (e) => {
        if (e.target.classList.contains('crop-handle')) return;
        if (excludeBoxSelector && e.target.closest(excludeBoxSelector)) return;
        if (excludeRectSelector && e.target.closest(excludeRectSelector)) return;
        if (e.target === drawPreview) return;

        e.preventDefault();
        const pos = getVideoPos(e);
        drawState = { startX: pos.x, startY: pos.y };

        drawPreview = document.createElement('div');
        drawPreview.style.cssText = `
            position: absolute;
            border: 2px dashed rgba(100, 180, 255, 0.9);
            background: rgba(100, 180, 255, 0.15);
            pointer-events: none;
            z-index: 999;
        `;
        overlay.appendChild(drawPreview);
    };

    const onMouseMove = (e) => {
        if (!drawState || !drawPreview) return;
        const pos = getVideoPos(e);
        const scale = state.preview.scale || 1;
        const ox = state.preview.offsetX || 0;
        const oy = state.preview.offsetY || 0;
        const clampedX = Math.max(0, Math.min(pos.x, state.video.width));
        const clampedY = Math.max(0, Math.min(pos.y, state.video.height));
        const x = Math.min(drawState.startX, clampedX);
        const y = Math.min(drawState.startY, clampedY);
        const w = Math.abs(clampedX - drawState.startX);
        const h = Math.abs(clampedY - drawState.startY);
        drawPreview.style.left = `${ox + x * scale}px`;
        drawPreview.style.top = `${oy + y * scale}px`;
        drawPreview.style.width = `${w * scale}px`;
        drawPreview.style.height = `${h * scale}px`;
    };

    const onMouseUp = (e) => {
        if (!drawState) return;
        const pos = getVideoPos(e);
        const clampedX = Math.max(0, Math.min(pos.x, state.video.width));
        const clampedY = Math.max(0, Math.min(pos.y, state.video.height));
        const x = Math.min(drawState.startX, clampedX);
        const y = Math.min(drawState.startY, clampedY);
        const w = Math.abs(clampedX - drawState.startX);
        const h = Math.abs(clampedY - drawState.startY);

        if (drawPreview && drawPreview.parentNode) drawPreview.parentNode.removeChild(drawPreview);
        drawPreview = null;
        drawState = null;

        if (w >= minSize && h >= minSize) onDraw(x, y, w, h);
    };

    overlay.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    return () => {
        overlay.removeEventListener('mousedown', onMouseDown);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
}

// === UI Helpers ===
export function showError(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }
export function hideMessage(el) { el.classList.add('hidden'); }
export function showProgress(p, s = '') {
    if (p.bar) p.bar.style.width = '0%'; if (p.text) p.text.textContent = '0%';
    if (p.status) p.status.textContent = s; p.section.classList.remove('hidden');
}
export function hideProgress(p) { p.section.classList.add('hidden'); }
export function showSuccess(el, msg) { el.textContent = `✓ ${msg}`; el.classList.remove('hidden'); }

export function setupCleanup(modal, player, cleanup) {
    const originalClose = modal.close.bind(modal);
    modal.close = () => {
        if (player && player.updateObserver) {
            player.updateObserver.disconnect();
        }
        if (cleanup) {
            document.removeEventListener('mousemove', cleanup.onMouseMove);
            document.removeEventListener('mouseup', cleanup.onMouseUp);
        }
        if (player) player.destroy();
        originalClose();
    };
}

/**
 * Setup auto-update for overlay on resize
 */
export function setupAutoUpdate(playerContainer, overlay, state, onUpdate) {
    if (!playerContainer || !overlay) return null;

    const observer = new ResizeObserver(() => {
        updateScale(overlay, state);
        if (onUpdate) onUpdate();
    });

    observer.observe(playerContainer);
    return observer;
}

// ============================================
// BACKWARD COMPATIBILITY FUNCTIONS
// Used by WatermarkMenu.js and TrimMenu.js
// ============================================

/**
 * updateOverlay - Legacy function for WatermarkMenu
 * Maps to updateScale and recalculates offsets
 */
export function updateOverlay(overlay, playerContainer, state, onUpdate) {
    if (!overlay) return;

    // Update scale calculations
    updateScale(overlay, state);

    if (onUpdate) onUpdate();
}

/**
 * setupEditor - Legacy DOM setup for Watermark/Trim
 * Creates the editor structure dynamically
 */
export function setupEditor(parentElement, options = {}) {
    // Clean parent
    parentElement.innerHTML = '';

    const suffix = options.type || 'crop';
    const containerId = `${suffix}-player-container`;

    // 1. Wrapper (for crop-preview-wrapper compatibility)
    const wrapper = document.createElement('div');
    wrapper.className = 'crop-preview-wrapper';

    // 2. Player Container
    const playerContainer = document.createElement('div');
    playerContainer.className = 'crop-player-container';
    wrapper.appendChild(playerContainer);

    // 3. Inner Video Wrapper
    const videoWrapper = document.createElement('div');
    videoWrapper.id = containerId;
    videoWrapper.className = 'jellyjump-video-wrapper';
    videoWrapper.style.cssText = `
        width: 100%; 
        height: 100%; 
        position: relative; 
        display: flex; 
        align-items: center; 
        justify-content: center;
    `;

    // Style to ensure canvas fits
    const style = document.createElement('style');
    style.textContent = `
        #${containerId} canvas, #${containerId} video {
            width: 100% !important;
            height: 100% !important;
            object-fit: contain !important;
            display: block;
        }
    `;
    playerContainer.appendChild(style);
    playerContainer.appendChild(videoWrapper);

    let overlay = null;
    let box = null;

    if (options.enableOverlay !== false) {
        // 4. Overlay
        overlay = document.createElement('div');
        overlay.className = `crop-overlay ${options.overlayClass || ''}`;
        overlay.style.cssText = 'position: absolute; inset: 0; pointer-events: none; z-index: 10;';

        // 5. Box
        box = document.createElement('div');
        box.className = 'crop-box';
        if (options.boxDataAttr) box.setAttribute(options.boxDataAttr, '');
        else box.setAttribute('data-crop-box', '');

        // 6. Handles
        const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
        handles.forEach(h => {
            const handle = document.createElement('div');
            handle.className = `crop-handle crop-handle-${h}`;
            handle.dataset.handle = h;
            box.appendChild(handle);
        });

        overlay.appendChild(box);
        playerContainer.appendChild(overlay);
    }

    parentElement.appendChild(wrapper);

    return {
        containerId,
        playerContainer,
        wrapper,
        overlay,
        box
    };
}
