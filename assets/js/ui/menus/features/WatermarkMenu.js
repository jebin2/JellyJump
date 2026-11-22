import { Logger } from "../../../shared/utils/Logger.js";
import { MediaProcessor } from '../../../core/MediaProcessor.js';
import { MediaMetadata } from '../../../shared/utils/MediaMetadata.js';
import { generateId, formatTime, parseTime } from '../../../shared/utils/mediaUtils.js';
import {
    updateBoxPosition,
    setupAreaEditor,
    createBoxOverlay,
} from './BoxEditorUtils.js';
import { lendPicture } from '../core/PreviewPlayer.js';
import { openProcessMenu, FOOTER_CONFIGS } from '../core/MenuFactory.js';
import { runMenuJob } from '../core/MenuJob.js';

/**
 * Watermark Menu Handler - Multi-watermark with time ranges
 * Mirrors BlurMenu patterns: draw-to-add, list management, live preview
 */
export class WatermarkMenu {
    static async init(item, playlist) {
        const itemTemplate = document.getElementById('watermark-item-template');
        const { modal, content: modalContent } = openProcessMenu('Watermark', 'watermark-content-template', FOOTER_CONFIGS.watermark);
        if (!modal) return;
        if (!itemTemplate) {
            Logger.error('Watermark modal templates not found!');
            modal.close();
            return;
        }

        const MIN_SIZE = 40;

        // === 1. Setup Editor DOM (Left Panel) ===
        // In the edit panel the areas are drawn over the main player.
        // The areas are drawn over the main player.
        const stage = await lendPicture(modal, playlist);
        if (!stage) return;
        const videoPanel = stage.wrapper;
        const { overlay, box } = createBoxOverlay({ overlayClass: 'watermark-overlay', boxDataAttr: 'data-watermark-box' });
        stage.adopt(overlay);
        const editorUI = { containerId: null, playerContainer: stage.wrapper, wrapper: stage.wrapper, overlay, box };

        // Add data-crop-box so setupDragHandlers recognizes it for move
        editorUI.box.setAttribute('data-crop-box', '');

        // Style box for watermark preview
        editorUI.box.style.border = '2px dashed rgba(255, 255, 255, 0.8)';
        editorUI.box.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
        editorUI.box.style.boxShadow = 'none';
        editorUI.box.style.display = 'none';

        // === 2. Elements & State ===
        const elements = {
            wmList: modalContent.querySelector('#watermark-areas-list'),
            livePreviewToggle: modalContent.querySelector('#wm-live-preview-toggle'),
            processBtn: modalContent.querySelector('.wm-process-btn'),
            downloadBtn: modalContent.querySelector('.download-btn'),
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
            watermarkAreas: [],
            selectedIndex: -1
        };


        // === 3. The player ===
        const player = stage.player;
        state.video = { ...stage.video };


        // === 4. Live Preview Render Callback ===
        const renderCallback = (canvas, ctx) => {
            if (!player) return;
            if (!elements.livePreviewToggle.checked) return;
            if (state.watermarkAreas.length === 0) return;

            const currentTime = player.currentTime;
            const width = canvas.width;
            const height = canvas.height;

            if (!state.video.width || !state.video.height) return;

            const scaleX = width / state.video.width;
            const scaleY = height / state.video.height;

            state.watermarkAreas.forEach((wm) => {
                if (currentTime < wm.startTime || currentTime > wm.endTime) return;

                const x = wm.x * scaleX;
                const y = wm.y * scaleY;
                const w = wm.width * scaleX;
                const h = wm.height * scaleY;

                try {
                    ctx.save();
                    ctx.globalAlpha = wm.opacity || 1.0;

                    if (wm.type === 'image' && wm._previewImage && wm._previewImage.complete) {
                        ctx.drawImage(wm._previewImage, x, y, w, h);
                    } else if (wm.type === 'text' && wm.text) {
                        // Scale font to fit the watermark box
                        const charCount = Math.max(1, wm.text.length);
                        const widthBased = w / (charCount * 0.6);
                        const heightBased = h * 0.8;
                        const fontSize = Math.max(8, Math.min(widthBased, heightBased));

                        ctx.font = `bold ${fontSize}px sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';

                        const rgb = hexToRgb(wm.color);
                        ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
                        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
                        ctx.lineWidth = fontSize * 0.05;

                        const cx = x + w / 2;
                        const cy = y + h / 2;
                        ctx.strokeText(wm.text, cx, cy);
                        ctx.fillText(wm.text, cx, cy);
                    }

                    ctx.restore();
                } catch (e) {
                    Logger.warn('Render Watermark Failed', e);
                }
            });
        };
        stage.addRenderCallback(renderCallback);


        // === 5. Box Logic, Selection & Drawing ===

        const { updateSelection, renderOverlayRects, dispose: disposeAreaEditor } = setupAreaEditor({
            editorUI, state, player, videoPanel,
            areas: () => state.watermarkAreas,
            rectClass: 'wm-area-rect',
            boxSelector: '[data-watermark-box]',
            minSize: MIN_SIZE,
            createArea: (box) => ({
                id: generateId(),
                ...box,
                startTime: 0,
                endTime: player.duration || 10,
                type: 'text',
                text: 'Watermark',
                color: '#ffffff',
                imageFile: null,
                imageDataUrl: null,
                opacity: 1.0,
                _previewImage: null,
            }),
            onSelectionChange: () => renderList(),
            onAreaMoved: (index) => syncInputsFromArea(index),
            // Under the main player's controls.
            zIndex: 5,
        });


        // Toggle Live Preview ON by default
        elements.livePreviewToggle.checked = true;
        elements.livePreviewToggle.onchange = () => {
            if (player) player.seek(player.currentTime);
        };


        // === 6. List Management ===

        const syncInputsFromArea = (index) => {
            const listItems = elements.wmList.querySelectorAll('.watermark-item');
            const el = listItems[index];
            if (!el) return;
            const area = state.watermarkAreas[index];
            if (!area) return;

            const xInput = el.querySelector('.wm-x');
            const yInput = el.querySelector('.wm-y');
            const wInput = el.querySelector('.wm-width');
            const hInput = el.querySelector('.wm-height');

            if (xInput) xInput.value = Math.round(area.x);
            if (yInput) yInput.value = Math.round(area.y);
            if (wInput) wInput.value = Math.round(area.width);
            if (hInput) hInput.value = Math.round(area.height);
        };

        const renderList = () => {
            const list = elements.wmList;
            list.innerHTML = '';

            if (state.watermarkAreas.length === 0) {
                list.innerHTML = `<div class="empty-state text-center py-xl text-muted text-xs italic">No watermarks added. Draw on the video to add a watermark.</div>`;
                return;
            }

            state.watermarkAreas.forEach((area, index) => {
                const el = itemTemplate.content.cloneNode(true);

                // Highlight if selected
                if (index === state.selectedIndex) {
                    const root = el.querySelector('.watermark-item') || el.firstElementChild;
                    if (root) {
                        root.classList.add('active', 'border-primary', 'bg-primary/10');
                    }
                }

                el.querySelector('.wm-item-title').textContent = `Watermark #${index + 1}`;

                // Time inputs
                const startInput = el.querySelector('.wm-start-time');
                const endInput = el.querySelector('.wm-end-time');
                startInput.value = formatTime(area.startTime);
                endInput.value = formatTime(area.endTime);

                // Type toggle
                const typeToggle = el.querySelector('.wm-item-type-toggle');
                const textGroup = el.querySelector('.wm-item-text-group');
                const imageGroup = el.querySelector('.wm-item-image-group');
                typeToggle.checked = area.type === 'image';
                if (area.type === 'image') {
                    textGroup.classList.add('hidden');
                    imageGroup.classList.remove('hidden');
                }

                // Text & color
                const textInput = el.querySelector('.wm-item-text');
                const colorInput = el.querySelector('.wm-item-color');
                textInput.value = area.text || 'Watermark';
                colorInput.value = area.color || '#ffffff';

                // Opacity
                const opacitySlider = el.querySelector('.wm-item-opacity');
                const opacityValue = el.querySelector('.wm-item-opacity-value');
                opacitySlider.value = Math.round((area.opacity || 1.0) * 100);
                opacityValue.textContent = `${opacitySlider.value}%`;

                // Position/Size inputs
                const xInput = el.querySelector('.wm-x');
                const yInput = el.querySelector('.wm-y');
                const wInput = el.querySelector('.wm-width');
                const hInput = el.querySelector('.wm-height');
                xInput.value = Math.round(area.x);
                yInput.value = Math.round(area.y);
                wInput.value = Math.round(area.width);
                hInput.value = Math.round(area.height);

                // --- Event Handlers ---

                // Click to select
                const root = el.querySelector('.watermark-item') || el.firstElementChild;
                root.onclick = (e) => {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.closest('button') || e.target.closest('.toggle-switch') || e.target.tagName === 'LABEL') return;
                    updateSelection(index);
                };

                // Remove button
                el.querySelector('.remove-wm-btn').onclick = (e) => {
                    e.stopPropagation();
                    state.watermarkAreas.splice(index, 1);
                    if (state.selectedIndex === index) {
                        updateSelection(-1);
                    } else if (state.selectedIndex > index) {
                        updateSelection(state.selectedIndex - 1);
                    } else {
                        renderList();
                    }
                };

                // Type toggle handler
                typeToggle.onchange = () => {
                    area.type = typeToggle.checked ? 'image' : 'text';
                    if (area.type === 'text') {
                        textGroup.classList.remove('hidden');
                        imageGroup.classList.add('hidden');
                    } else {
                        textGroup.classList.add('hidden');
                        imageGroup.classList.remove('hidden');
                    }
                    if (player) player.seek(player.currentTime);
                };

                // Text input
                textInput.oninput = () => {
                    area.text = textInput.value;
                    if (player) player.seek(player.currentTime);
                };

                // Color picker
                colorInput.oninput = () => {
                    area.color = colorInput.value;
                    if (player) player.seek(player.currentTime);
                };

                // Image file input
                const imageInput = el.querySelector('.wm-item-image');
                imageInput.onchange = (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    area.imageFile = file;
                    const reader = new FileReader();
                    reader.onload = (evt) => {
                        area.imageDataUrl = evt.target.result;
                        const img = new Image();
                        img.onload = () => {
                            area._previewImage = img;
                            // Auto-resize to image aspect ratio
                            const aspect = img.width / img.height;
                            area.height = area.width / aspect;
                            if (index === state.selectedIndex) {
                                state.box.height = area.height;
                                updateBoxPosition(editorUI.box, state);
                                syncInputsFromArea(index);
                            }
                            if (player) player.seek(player.currentTime);
                            if (player) player.seek(player.currentTime);
                        };
                        img.src = evt.target.result;
                    };
                    reader.readAsDataURL(file);
                };

                // Opacity slider
                opacitySlider.oninput = () => {
                    const val = parseInt(opacitySlider.value);
                    area.opacity = val / 100;
                    opacityValue.textContent = `${val}%`;
                    if (player) player.seek(player.currentTime);
                };

                // Set current time buttons
                el.querySelector('.set-current-start').onclick = (e) => {
                    e.stopPropagation();
                    area.startTime = player.currentTime;
                    startInput.value = formatTime(area.startTime);
                };
                el.querySelector('.set-current-end').onclick = (e) => {
                    e.stopPropagation();
                    area.endTime = player.currentTime;
                    endInput.value = formatTime(area.endTime);
                };

                // Time input change handlers
                startInput.onchange = () => {
                    const val = parseTime(startInput.value);
                    if (val !== null) area.startTime = val;
                };
                endInput.onchange = () => {
                    const val = parseTime(endInput.value);
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
                xInput.onchange = () => {
                    const val = parseInt(xInput.value, 10);
                    if (!isNaN(val)) {
                        area.x = Math.max(0, Math.min(val, (state.video.width || 1920) - area.width));
                        syncBoxAndOverlay();
                    }
                };
                yInput.onchange = () => {
                    const val = parseInt(yInput.value, 10);
                    if (!isNaN(val)) {
                        area.y = Math.max(0, Math.min(val, (state.video.height || 1080) - area.height));
                        syncBoxAndOverlay();
                    }
                };
                wInput.onchange = () => {
                    const val = parseInt(wInput.value, 10);
                    if (!isNaN(val) && val >= MIN_SIZE) {
                        area.width = Math.min(val, (state.video.width || 1920) - area.x);
                        syncBoxAndOverlay();
                    }
                };
                hInput.onchange = () => {
                    const val = parseInt(hInput.value, 10);
                    if (!isNaN(val) && val >= MIN_SIZE) {
                        area.height = Math.min(val, (state.video.height || 1080) - area.y);
                        syncBoxAndOverlay();
                    }
                };

                list.appendChild(el);
            });
        };


        // === 7. Process Button ===

        elements.processBtn.onclick = async () => {
            if (state.watermarkAreas.length === 0) {
                elements.messages.error.textContent = "No watermark areas defined.";
                elements.messages.error.classList.remove('hidden');
                return;
            }

            updateSelection(-1);

            const ext = item.title.split('.').pop().toLowerCase();
            const format = ['mp4', 'webm', 'mov'].includes(ext) ? ext : 'mp4';

            await runMenuJob({
                name: 'Watermark',
                subject: item.title,
                background: true,
                failureText: (e) => e.message,
                modal,
                work: async ({ signal, onProgress }) => MediaProcessor.process({
                    source: await MediaMetadata.getSourceBlob(item, () => playlist._saveState()),
                    format,
                    quality: 100,
                    watermark: { items: state.watermarkAreas.map(toWatermarkConfig) },
                    onProgress: (p) => onProgress(p, p < 0.9 ? 'Watermarking...' : 'Finalizing...'),
                    signal,
                }),
                done: (blob) => {
                    const filename = item.title.replace(/\.[^/.]+$/, '') + `-watermarked.${format}`;
                    const { url } = playlist.insertProcessedItem(item, blob, filename, {
                        type: `video/${format}`,
                    });
                    elements.downloadBtn.href = url;
                    elements.downloadBtn.download = filename;
                    elements.downloadBtn.classList.remove('hidden');
                },
            });
        };


        // === 8. Cleanup ===
        modal.onCleanup(disposeAreaEditor);
    }
}

/**
 * One watermark as the processor takes it: its box rounded to pixels, and a
 * text one with its font sized to fit the box and placed in its middle.
 * @param {Object} wm - a watermark area from the editor
 */
function toWatermarkConfig(wm) {
    const wmConfig = {
        id: wm.id,
        type: wm.type,
        x: Math.round(wm.x),
        y: Math.round(wm.y),
        width: Math.round(wm.width),
        height: Math.round(wm.height),
        opacity: wm.opacity,
        startTime: wm.startTime,
        endTime: wm.endTime
    };

    if (wm.type === 'text') {
        // Pre-calculate font size and centering
        const heightConstraint = wm.height * 0.8;
        const charCount = Math.max(1, wm.text.length);
        const widthConstraint = (wm.width * 0.9) / (charCount * 0.5);
        const finalFontSize = Math.max(12, Math.min(heightConstraint, widthConstraint));

        // Measure text for centering
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.font = `bold ${finalFontSize}px sans-serif`;
        const textMetrics = tempCtx.measureText(wm.text);
        const textWidth = textMetrics.width;

        wmConfig.text = wm.text;
        wmConfig.x = Math.round(wm.x + (wm.width - textWidth) / 2);
        wmConfig.y = Math.round(wm.y + (wm.height - finalFontSize) / 2);
        wmConfig.fontSize = Math.round(finalFontSize);
        wmConfig.font = `bold ${Math.round(finalFontSize)}px sans-serif`;
        wmConfig.fillStyle = (() => {
            const rgb = hexToRgb(wm.color);
            return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
        })();
        wmConfig.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        wmConfig.lineWidth = Math.round(finalFontSize) * 0.05;
        wmConfig.textAlign = 'left';
        wmConfig.textBaseline = 'top';
    } else if (wm.type === 'image') {
        wmConfig.image = wm.imageFile;
    }

    return wmConfig;
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
}
