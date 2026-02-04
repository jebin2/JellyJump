import { Logger } from "../../utils/Logger.js";
import { Modal } from '../Modal.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { generateId, formatDuration, parseTime } from '../../utils/mediaUtils.js';
import {
    loadVideo,
    setupDragHandlers,
    updateBoxPosition,
    setupEditor,
    setupCleanup,
    updateOverlay
} from './BoxEditorUtils.js';

export class BlurMenu {
    /**
     * Initialize and open Blur modal
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(item, playlist) {
        const contentTemplate = document.getElementById('blur-content-template');
        const footerTemplate = document.getElementById('blur-footer-template');
        const itemTemplate = document.getElementById('blur-item-template');

        if (!contentTemplate || !footerTemplate || !itemTemplate) {
            Logger.error('Blur modal templates not found!');
            return;
        }

        const modal = new Modal({ splitLayout: true });
        modal.setTitle('Blur Video');

        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));

        const modalContent = modal.modal;
        modal.open();

        // Used for drag/resize calculations
        const MIN_SIZE = 20;

        // === 1. Setup Editor DOM (Left Panel) ===
        const videoPanel = modalContent.querySelector('.modal-video-panel');
        const editorUI = setupEditor(videoPanel, {
            type: 'blur',
            overlayClass: 'blur-overlay',
            boxDataAttr: 'data-blur-box',
            enableOverlay: true
        });

        // Add data-crop-box so setupDragHandlers recognizes it for move
        editorUI.box.setAttribute('data-crop-box', '');

        // Style box as outline only — no backdropFilter since the canvas render
        // callback handles the actual blur effect and respects time ranges
        editorUI.box.style.border = '2px dashed rgba(255, 255, 255, 0.8)';
        editorUI.box.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
        editorUI.box.style.boxShadow = 'none';
        // Hide box until user draws or adds a blur area
        editorUI.box.style.display = 'none';


        // === 2. Elements & State ===
        const elements = {
            addBlurBtn: modalContent.querySelector('#add-blur-btn'),
            blurList: modalContent.querySelector('#blur-areas-list'),
            blurIntensity: modalContent.querySelector('#blur-intensity'),
            blurIntensityValue: modalContent.querySelector('#blur-intensity-value'),
            processBtn: modalContent.querySelector('.process-btn'),
            downloadBtn: modalContent.querySelector('.download-btn'),
            livePreviewToggle: modalContent.querySelector('#live-preview-toggle'),
            progress: {
                section: modalContent.querySelector('.progress-section'),
                bar: modalContent.querySelector('.progress-bar-fill'),
                text: modalContent.querySelector('.progress-percentage'),
                status: modalContent.querySelector('.progress-status')
            },
            messages: {
                error: modalContent.querySelector('.error-message'),
                success: modalContent.querySelector('.success-message')
            }
        };

        const state = {
            video: { width: 0, height: 0 },
            box: { x: 0, y: 0, width: 0, height: 0 },
            preview: { scale: 1 },
            blurAreas: [],
            selectedIndex: -1
        };

        // === 3. Load Video ===
        const player = await loadVideo(editorUI.containerId, item, playlist, state);
        if (!player) {
            elements.messages.error.textContent = "Failed to load video.";
            elements.messages.error.classList.remove('hidden');
            return;
        }

        // === 4. Live Blur & Render Callback (with dynamic intensity) ===
        const getBlurIntensity = () => {
            return parseInt(elements.blurIntensity.value, 10) || 15;
        };

        const renderCallback = (canvas, ctx) => {
            if (!player) return;
            if (!elements.livePreviewToggle.checked) return;
            if (state.blurAreas.length === 0) return;

            const currentTime = player.currentTime;
            const intensity = getBlurIntensity();

            state.blurAreas.forEach((area) => {
                if (currentTime < area.startTime || currentTime > area.endTime) {
                    return;
                }

                const width = canvas.width;
                const height = canvas.height;

                if (!state.video.width || !state.video.height) return;

                const scaleX = width / state.video.width;
                const scaleY = height / state.video.height;

                const x = area.x * scaleX;
                const y = area.y * scaleY;
                const w = area.width * scaleX;
                const h = area.height * scaleY;

                try {
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(x, y, w, h);
                    ctx.clip();
                    ctx.filter = `blur(${intensity}px)`;
                    ctx.drawImage(canvas, 0, 0, width, height);
                    ctx.restore();
                } catch (e) {
                    Logger.warn('Render Blur Failed', e);
                }
            });
        };
        player.addRenderCallback(renderCallback);

        // Wire blur intensity slider
        elements.blurIntensity.oninput = () => {
            elements.blurIntensityValue.textContent = `${elements.blurIntensity.value}px`;
            if (player) player.seek(player.currentTime);
        };


        // === 5. Box Logic & Selection ===

        // Render outline rectangles for ALL blur areas on the overlay
        // Non-selected areas get a simple clickable outline; selected area uses the main box with handles
        const renderOverlayRects = () => {
            // Remove previous rect indicators (but not the main box or draw preview)
            editorUI.overlay.querySelectorAll('.blur-area-rect').forEach(el => el.remove());

            const scale = state.preview.scale || 1;
            const ox = state.preview.offsetX || 0;
            const oy = state.preview.offsetY || 0;

            state.blurAreas.forEach((area, index) => {
                // Skip the selected one — it uses the main editorUI.box with handles
                if (index === state.selectedIndex) return;

                const rect = document.createElement('div');
                rect.className = 'blur-area-rect';
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
                rect.addEventListener('mousedown', (e) => {
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
                z-index: 1000;
            `);
            updateOverlay(editorUI.overlay, editorUI.playerContainer, state, () => {
                if (state.selectedIndex >= 0) {
                    updateBoxPosition(editorUI.box, state);
                }
                renderOverlayRects();
            });
        };

        // Show overlay immediately (always visible for drawing)
        showOverlayAlways();

        const updateSelection = (index) => {
            state.selectedIndex = index;
            renderList();

            if (index >= 0 && index < state.blurAreas.length) {
                const area = state.blurAreas[index];
                state.box = {
                    x: area.x,
                    y: area.y,
                    width: area.width,
                    height: area.height
                };

                // Show box with handles
                editorUI.box.style.display = 'block';
                updateBoxPosition(editorUI.box, state);

                updateOverlay(editorUI.overlay, editorUI.playerContainer, state, () => {
                    updateBoxPosition(editorUI.box, state);
                });

            } else {
                // No selection — hide the box but keep overlay visible for drawing
                editorUI.box.style.display = 'none';
            }

            // Re-render all area outlines on overlay
            renderOverlayRects();

            // Force a frame update
            if (player && player.duration) {
                const t = player.currentTime;
                player.seek(t);
            }
        };

        const onBoxUpdate = () => {
            if (state.selectedIndex !== -1) {
                const area = state.blurAreas[state.selectedIndex];
                area.x = state.box.x;
                area.y = state.box.y;
                area.width = state.box.width;
                area.height = state.box.height;

                // Sync values back to inputs
                syncInputsFromArea(state.selectedIndex);

                // Force canvas redraw so blur renders at the new position
                if (player) player.seek(player.currentTime);
            }
        };

        // Update overlay when video resizes
        const resizeObserver = new ResizeObserver(() => {
            showOverlayAlways();
        });
        resizeObserver.observe(videoPanel);

        // Setup Drag (for selected box move/resize)
        const cleanupDrag = setupDragHandlers(editorUI.overlay, editorUI.box, state, MIN_SIZE, () => {
            updateBoxPosition(editorUI.box, state);
            onBoxUpdate();
        });


        // === 5b. Drawing Rectangles on Overlay ===

        const getVideoPos = (e) => {
            const rect = editorUI.overlay.getBoundingClientRect();
            const ox = state.preview.offsetX || 0;
            const oy = state.preview.offsetY || 0;
            const scale = state.preview.scale || 1;
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            return {
                x: (mouseX - ox) / scale,
                y: (mouseY - oy) / scale
            };
        };

        let drawState = null;
        let drawPreview = null;

        const overlayDrawMouseDown = (e) => {
            // Only trigger drawing if clicking on empty overlay area
            const isHandle = e.target.classList.contains('crop-handle');
            const isBox = e.target.closest('[data-blur-box]');
            const isAreaRect = e.target.closest('.blur-area-rect');
            if (isHandle || isBox || isAreaRect) return;

            // Also don't start drawing on the draw preview itself
            if (e.target === drawPreview) return;

            e.preventDefault();
            const pos = getVideoPos(e);

            drawState = {
                startX: pos.x,
                startY: pos.y
            };

            // Create draw preview div
            drawPreview = document.createElement('div');
            drawPreview.style.cssText = `
                position: absolute;
                border: 2px dashed rgba(100, 180, 255, 0.9);
                background: rgba(100, 180, 255, 0.15);
                pointer-events: none;
                z-index: 999;
            `;
            editorUI.overlay.appendChild(drawPreview);
        };

        const overlayDrawMouseMove = (e) => {
            if (!drawState || !drawPreview) return;

            const pos = getVideoPos(e);
            const scale = state.preview.scale || 1;
            const ox = state.preview.offsetX || 0;
            const oy = state.preview.offsetY || 0;

            // Clamp to video bounds
            const clampedX = Math.max(0, Math.min(pos.x, state.video.width));
            const clampedY = Math.max(0, Math.min(pos.y, state.video.height));

            const x = Math.min(drawState.startX, clampedX);
            const y = Math.min(drawState.startY, clampedY);
            const w = Math.abs(clampedX - drawState.startX);
            const h = Math.abs(clampedY - drawState.startY);

            // Convert to overlay pixel coords for the preview div
            drawPreview.style.left = `${ox + x * scale}px`;
            drawPreview.style.top = `${oy + y * scale}px`;
            drawPreview.style.width = `${w * scale}px`;
            drawPreview.style.height = `${h * scale}px`;
        };

        const overlayDrawMouseUp = (e) => {
            if (!drawState) return;

            const pos = getVideoPos(e);

            // Clamp to video bounds
            const clampedX = Math.max(0, Math.min(pos.x, state.video.width));
            const clampedY = Math.max(0, Math.min(pos.y, state.video.height));

            const x = Math.min(drawState.startX, clampedX);
            const y = Math.min(drawState.startY, clampedY);
            const w = Math.abs(clampedX - drawState.startX);
            const h = Math.abs(clampedY - drawState.startY);

            // Clean up preview
            if (drawPreview && drawPreview.parentNode) {
                drawPreview.parentNode.removeChild(drawPreview);
            }
            drawPreview = null;
            drawState = null;

            // Only create area if the drawn rect is large enough
            if (w < MIN_SIZE || h < MIN_SIZE) return;

            const newArea = {
                id: generateId(),
                x, y, width: w, height: h,
                startTime: 0,
                endTime: player.duration || 10
            };

            state.blurAreas.push(newArea);
            updateSelection(state.blurAreas.length - 1);
        };

        editorUI.overlay.addEventListener('mousedown', overlayDrawMouseDown);
        document.addEventListener('mousemove', overlayDrawMouseMove);
        document.addEventListener('mouseup', overlayDrawMouseUp);


        // Toggle Live Preview ON by default
        elements.livePreviewToggle.checked = true;
        elements.livePreviewToggle.onchange = () => {
            if (player) player.seek(player.currentTime);
        };


        // === 6. List Management ===

        // Helper: sync input fields from a blur area's current values (without full re-render)
        const syncInputsFromArea = (index) => {
            const listItems = elements.blurList.querySelectorAll('.blur-item');
            const item = listItems[index];
            if (!item) return;
            const area = state.blurAreas[index];
            if (!area) return;

            const xInput = item.querySelector('.blur-x');
            const yInput = item.querySelector('.blur-y');
            const wInput = item.querySelector('.blur-width');
            const hInput = item.querySelector('.blur-height');

            if (xInput) xInput.value = Math.round(area.x);
            if (yInput) yInput.value = Math.round(area.y);
            if (wInput) wInput.value = Math.round(area.width);
            if (hInput) hInput.value = Math.round(area.height);
        };

        // formatDuration(0) returns '--:--' due to !0 check; blur needs 0 to show as 0:00
        const fmtTime = (sec) => {
            if (sec === 0 || sec === null || sec === undefined) return '0:00';
            return formatDuration(sec);
        };

        const renderList = () => {
            const list = elements.blurList;
            list.innerHTML = '';

            if (state.blurAreas.length === 0) {
                list.innerHTML = `<div class="empty-state text-center py-xl text-muted text-xs italic">No blur areas added. Click "Add Blur Area" or draw on the video.</div>`;
                return;
            }

            state.blurAreas.forEach((area, index) => {
                const el = itemTemplate.content.cloneNode(true);

                // Highlight if selected
                if (index === state.selectedIndex) {
                    const root = el.querySelector('.blur-item') || el.firstElementChild;
                    if (root) {
                        root.classList.add('active', 'border-primary', 'bg-primary/10');
                    }
                }

                el.querySelector('.blur-item-title').textContent = `Blur Area #${index + 1}`;

                // Time inputs
                const startInput = el.querySelector('.blur-start-time');
                const endInput = el.querySelector('.blur-end-time');
                startInput.value = fmtTime(area.startTime);
                endInput.value = fmtTime(area.endTime);

                // Position/Size inputs
                const xInput = el.querySelector('.blur-x');
                const yInput = el.querySelector('.blur-y');
                const wInput = el.querySelector('.blur-width');
                const hInput = el.querySelector('.blur-height');

                xInput.value = Math.round(area.x);
                yInput.value = Math.round(area.y);
                wInput.value = Math.round(area.width);
                hInput.value = Math.round(area.height);

                // Click to select
                const root = el.querySelector('.blur-item') || el.firstElementChild;
                root.onclick = (e) => {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
                    updateSelection(index);
                };

                // Remove button
                el.querySelector('.remove-blur-btn').onclick = (e) => {
                    e.stopPropagation();
                    state.blurAreas.splice(index, 1);
                    if (state.selectedIndex === index) {
                        updateSelection(-1);
                    } else if (state.selectedIndex > index) {
                        updateSelection(state.selectedIndex - 1);
                    } else {
                        renderList();
                    }
                };

                // Set current time buttons
                el.querySelector('.set-current-start').onclick = (e) => {
                    e.stopPropagation();
                    area.startTime = player.currentTime;
                    startInput.value = fmtTime(area.startTime);
                };
                el.querySelector('.set-current-end').onclick = (e) => {
                    e.stopPropagation();
                    area.endTime = player.currentTime;
                    endInput.value = fmtTime(area.endTime);
                };

                // Time input change handlers
                startInput.onchange = (e) => {
                    const val = parseTime(e.target.value);
                    if (val !== null) area.startTime = val;
                };
                endInput.onchange = (e) => {
                    const val = parseTime(e.target.value);
                    if (val !== null) area.endTime = val;
                };

                // X/Y/W/H input change handlers
                const syncBoxAndOverlay = () => {
                    if (index === state.selectedIndex) {
                        state.box.x = area.x;
                        state.box.y = area.y;
                        state.box.width = area.width;
                        state.box.height = area.height;
                        updateBoxPosition(editorUI.box, state);
                    }
                    renderOverlayRects();
                    if (player) player.seek(player.currentTime);
                };
                xInput.onchange = (e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) {
                        area.x = Math.max(0, Math.min(val, (state.video.width || 1920) - area.width));
                        syncBoxAndOverlay();
                    }
                };
                yInput.onchange = (e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) {
                        area.y = Math.max(0, Math.min(val, (state.video.height || 1080) - area.height));
                        syncBoxAndOverlay();
                    }
                };
                wInput.onchange = (e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= MIN_SIZE) {
                        area.width = Math.min(val, (state.video.width || 1920) - area.x);
                        syncBoxAndOverlay();
                    }
                };
                hInput.onchange = (e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val >= MIN_SIZE) {
                        area.height = Math.min(val, (state.video.height || 1080) - area.y);
                        syncBoxAndOverlay();
                    }
                };

                list.appendChild(el);
            });
        };


        // === 7. Controls ===

        elements.addBlurBtn.onclick = () => {
            const videoW = state.video.width || 1920;
            const videoH = state.video.height || 1080;
            const w = videoW * 0.25;
            const h = w;

            const offsetW = (Math.random() - 0.5) * (videoW * 0.2);
            const offsetH = (Math.random() - 0.5) * (videoH * 0.2);

            const x = Math.max(0, Math.min(videoW - w, (videoW - w) / 2 + offsetW));
            const y = Math.max(0, Math.min(videoH - h, (videoH - h) / 2 + offsetH));

            const newArea = {
                id: generateId(),
                x, y, width: w, height: h,
                startTime: 0,
                endTime: player.duration || 10
            };

            state.blurAreas.push(newArea);
            updateSelection(state.blurAreas.length - 1);
        };

        elements.processBtn.onclick = async () => {
            if (state.blurAreas.length === 0) {
                elements.messages.error.textContent = "No blur areas defined.";
                elements.messages.error.classList.remove('hidden');
                return;
            }

            elements.processBtn.disabled = true;
            elements.messages.error.classList.add('hidden');
            elements.messages.success.classList.add('hidden');
            elements.progress.section.classList.remove('hidden');

            // De-select to hide box overlay
            updateSelection(-1);

            try {
                const intensity = getBlurIntensity();
                const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());
                const processedBlob = await MediaProcessor.process({
                    source: source,
                    format: 'mp4',
                    blur: { areas: state.blurAreas, intensity },
                    onProgress: (p) => {
                        const pct = Math.round(p * 100);
                        if (elements.progress.bar) elements.progress.bar.style.width = `${pct}%`;
                        if (elements.progress.text) elements.progress.text.textContent = `${pct}%`;
                        if (elements.progress.status) {
                            elements.progress.status.textContent = p < 0.9 ? "Blurring..." : "Finalizing...";
                        }
                    }
                });

                // Success
                elements.messages.success.classList.remove('hidden');
                elements.progress.section.classList.add('hidden');

                const filename = item.title.replace(/\.[^/.]+$/, '') + '-blurred.mp4';
                const url = URL.createObjectURL(processedBlob);
                elements.downloadBtn.href = url;
                elements.downloadBtn.download = filename;
                elements.downloadBtn.classList.remove('hidden');

                const newItem = {
                    id: generateId(),
                    title: filename,
                    url: url,
                    file: new File([processedBlob], filename, { type: 'video/mp4' }),
                    duration: item.duration,
                    type: 'video',
                    isLocal: true,
                    isNew: true,
                    path: (item.path || item.title) + '/' + filename
                };
                playlist.items.splice(playlist.items.indexOf(item) + 1, 0, newItem);
                playlist.render();
                playlist._saveState();

            } catch (e) {
                Logger.error('Blur processing failed:', e);
                elements.messages.error.textContent = e.message;
                elements.messages.error.classList.remove('hidden');
                elements.progress.section.classList.add('hidden');
            } finally {
                elements.processBtn.disabled = false;
            }
        };


        // === 8. Cleanup ===
        const originalCleanup = setupCleanup(modal, player, cleanupDrag);

        // Additional cleanup for drawing listeners
        const originalClose = modal.close.bind(modal);
        modal.close = () => {
            document.removeEventListener('mousemove', overlayDrawMouseMove);
            document.removeEventListener('mouseup', overlayDrawMouseUp);
            resizeObserver.disconnect();
            originalClose();
        };
    }
}
