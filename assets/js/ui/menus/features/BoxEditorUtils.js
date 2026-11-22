/**
 * Box Editor Utilities: the boxes Crop, Blur and Watermark draw over the main
 * player's picture.
 *
 * Key Principle: Let CSS handle positioning. JS only handles:
 * 1. Scaling the box's video coordinates to the display
 * 2. Drag/resize handlers
 */

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
    const canvas = wrapper?.querySelector('canvas.jellyjump-video') || wrapper?.querySelector('canvas');

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

    // Pointer events, so a finger drags the box as a mouse does.
    overlay.addEventListener('pointerdown', handleMouseDown);
    document.addEventListener('pointermove', handleMouseMove);
    document.addEventListener('pointerup', handleMouseUp);

    return {
        onMouseMove: handleMouseMove,
        onMouseUp: handleMouseUp,
        dispose: () => {
            overlay.removeEventListener('pointerdown', handleMouseDown);
            document.removeEventListener('pointermove', handleMouseMove);
            document.removeEventListener('pointerup', handleMouseUp);
        },
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
 * @returns {function} cleanup — removes all three listeners
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

    overlay.addEventListener('pointerdown', onMouseDown);
    document.addEventListener('pointermove', onMouseMove);
    document.addEventListener('pointerup', onMouseUp);

    return () => {
        overlay.removeEventListener('pointerdown', onMouseDown);
        document.removeEventListener('pointermove', onMouseMove);
        document.removeEventListener('pointerup', onMouseUp);
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

/**
 * A layer to draw over a video, holding a box with eight resize handles.
 * @param {{overlayClass?: string, boxDataAttr?: string}} [options]
 * @returns {{overlay: HTMLElement, box: HTMLElement}}
 */
export function createBoxOverlay(options = {}) {
    const overlay = document.createElement('div');
    overlay.className = `crop-overlay ${options.overlayClass || ''}`;
    overlay.style.cssText = 'position: absolute; inset: 0; pointer-events: none; z-index: 10;';

    const box = document.createElement('div');
    box.className = 'crop-box';
    box.setAttribute(options.boxDataAttr || 'data-crop-box', '');

    for (const h of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
        const handle = document.createElement('div');
        handle.className = `crop-handle crop-handle-${h}`;
        handle.dataset.handle = h;
        box.appendChild(handle);
    }

    overlay.appendChild(box);
    return { overlay, box };
}

/**
 * The rectangle editor shared by the Blur and Watermark menus: an outline
 * for each area active at the current time, the selected one in the box with
 * handles, drawing a new area by dragging on the video, and moving or
 * resizing the selected one.
 *
 * @param {Object} options
 * @param {Object} options.editorUI - {overlay, box, playerContainer}, the box from createBoxOverlay()
 * @param {Object} options.state - the editor state; its `selectedIndex`,
 *   `box` and `preview` are used
 * @param {Object} options.player
 * @param {Element} options.videoPanel - watched for size changes
 * @param {() => Array<{x: number, y: number, width: number, height: number, startTime: number, endTime: number}>} options.areas
 * @param {string} options.rectClass - class of an unselected area's outline
 * @param {string} options.boxSelector - matches the selected area's box
 * @param {number} options.minSize
 * @param {(box: {x: number, y: number, width: number, height: number}) => Object} options.createArea
 *   a new area for a drawn rectangle
 * @param {() => void} options.onSelectionChange - e.g. re-render the list
 * @param {(index: number) => void} options.onAreaMoved - the selected area
 *   was moved or resized
 * @param {number} [options.zIndex] - the overlay's; under the player's
 *   controls when it is drawn over the main player
 * @returns {{updateSelection: (index: number) => void, renderOverlayRects: () => void,
 *   cleanupDrag: Object, dispose: () => void}}
 */
export function setupAreaEditor({
    editorUI, state, player, videoPanel, areas, rectClass, boxSelector, minSize,
    createArea, onSelectionChange, onAreaMoved, zIndex = 1000,
}) {

    // Render outline rectangles for ALL areas on the overlay
    // Non-selected areas get a simple clickable outline; selected area uses the main box with handles
    const renderOverlayRects = () => {
        // Remove previous rect indicators (but not the main box or draw preview)
        editorUI.overlay.querySelectorAll(`.${rectClass}`).forEach(el => el.remove());

        const scale = state.preview.scale || 1;
        const ox = state.preview.offsetX || 0;
        const oy = state.preview.offsetY || 0;
        const currentTime = player ? player.currentTime : 0;

        areas().forEach((area, index) => {
            // Skip the selected one — it uses the main editorUI.box with handles
            if (index === state.selectedIndex) return;

            // Only show areas active at the current playback time
            if (currentTime < area.startTime || currentTime > area.endTime) return;

            const rect = document.createElement('div');
            rect.className = rectClass;
            rect.style.cssText = `
                position: absolute;
                left: ${ox + area.x * scale}px;
                top: ${oy + area.y * scale}px;
                width: ${area.width * scale}px;
                height: ${area.height * scale}px;
                border: 2px dashed rgba(255, 255, 255, 0.5);
                background: rgba(255, 255, 255, 0.08);
                cursor: pointer;
                pointer-events: auto;
                z-index: 998;
                box-sizing: border-box;
            `;

            // Area number label
            const label = document.createElement('span');
            label.textContent = `${index + 1}`;
            label.style.cssText = `
                position: absolute;
                top: 2px; left: 4px;
                font-size: 10px;
                color: rgba(255,255,255,0.8);
                background: rgba(0,0,0,0.5);
                padding: 0 3px;
                border-radius: 2px;
                pointer-events: none;
            `;
            rect.appendChild(label);

            // Click to select this area
            rect.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                updateSelection(index);
            });

            editorUI.overlay.appendChild(rect);
        });
    };

    // Keep overlay always visible with pointer-events for drawing
    const showOverlayAlways = () => {
        editorUI.overlay.setAttribute('style', `
            display: block;
            position: absolute;
            inset: 0;
            pointer-events: auto !important;
            z-index: ${zIndex};
            cursor: crosshair;
            touch-action: none;
        `);
        updateScale(editorUI.overlay, state);
        if (state.selectedIndex >= 0) updateBoxPosition(editorUI.box, state);
        renderOverlayRects();
    };

    // Show overlay immediately (always visible for drawing)
    showOverlayAlways();

    // === Time-based overlay visibility ===
    // Show the box and outlines only during their areas' active time ranges
    let lastVisibilityCheck = -1;
    const showActiveAreas = () => {
        const currentTime = player ? player.currentTime : 0;
        if (Math.abs(currentTime - lastVisibilityCheck) < 0.05) return;
        lastVisibilityCheck = currentTime;

        // Update selected box visibility based on time range
        if (state.selectedIndex >= 0 && state.selectedIndex < areas().length) {
            const area = areas()[state.selectedIndex];
            const inRange = currentTime >= area.startTime && currentTime <= area.endTime;
            editorUI.box.style.display = inRange ? 'block' : 'none';
        }

        // Re-render overlay rects (already time-filtered)
        renderOverlayRects();
    };
    player.addRenderCallback(showActiveAreas);

    const updateSelection = (index) => {
        state.selectedIndex = index;
        onSelectionChange();

        if (index >= 0 && index < areas().length) {
            const area = areas()[index];
            state.box = {
                x: area.x,
                y: area.y,
                width: area.width,
                height: area.height
            };

            // Show box with handles
            editorUI.box.style.display = 'block';
            updateBoxPosition(editorUI.box, state);

            updateScale(editorUI.overlay, state);
            updateBoxPosition(editorUI.box, state);

        } else {
            // No selection — hide the box but keep overlay visible for drawing
            editorUI.box.style.display = 'none';
        }

        // Re-render all area outlines on overlay
        renderOverlayRects();

        // Seek to area's start if current time is outside its range, else refresh current frame
        if (player && player.duration) {
            if (index >= 0 && index < areas().length) {
                const area = areas()[index];
                const currentTime = player.currentTime;
                if (currentTime < area.startTime || currentTime > area.endTime) {
                    player.seek(area.startTime);
                } else {
                    player.seek(currentTime);
                }
            } else {
                player.seek(player.currentTime);
            }
        }
    };

    const onBoxUpdate = () => {
        if (state.selectedIndex !== -1) {
            const area = areas()[state.selectedIndex];
            area.x = state.box.x;
            area.y = state.box.y;
            area.width = state.box.width;
            area.height = state.box.height;

            // Sync values back to inputs
            onAreaMoved(state.selectedIndex);

            // Redraw, so the effect shows at the new position
            if (player) player.seek(player.currentTime);
        }
    };

    // Update overlay when video resizes
    const resizeObserver = new ResizeObserver(() => {
        showOverlayAlways();
    });
    resizeObserver.observe(videoPanel);

    // Setup Drag (for selected box move/resize)
    const cleanupDrag = setupDragHandlers(editorUI.overlay, editorUI.box, state, minSize, () => {
        updateBoxPosition(editorUI.box, state);
        onBoxUpdate();
    });


    // === 5b. Drawing Rectangles on Overlay ===

    const cleanupOverlayDraw = setupOverlayDraw(editorUI.overlay, state, {
        excludeBoxSelector: boxSelector,
        excludeRectSelector: `.${rectClass}`,
        minSize,
        onDraw: (x, y, w, h) => {
            areas().push(createArea({ x, y, width: w, height: h }));
            updateSelection(areas().length - 1);
        }
    });

    return {
        updateSelection,
        renderOverlayRects,
        cleanupDrag,
        dispose: () => {
            cleanupOverlayDraw();
            cleanupDrag.dispose();
            resizeObserver.disconnect();
            player.removeRenderCallback?.(showActiveAreas);
        },
    };
}
