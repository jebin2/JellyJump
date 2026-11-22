import { Logger } from "../../../shared/utils/Logger.js";
import { MediaMetadata } from '../../../shared/utils/MediaMetadata.js';
import { MediaProcessor } from '../../../processing/MediaProcessor.js';
import { generateId, formatTime, parseTime } from '../../../shared/utils/mediaUtils.js';
import {
    updateBoxPosition,
    setupAreaEditor,
    createBoxOverlay,
} from './BoxEditorUtils.js';
import { lendPicture } from '../core/PreviewPlayer.js';
import { openProcessMenu, FOOTER_CONFIGS } from '../core/MenuFactory.js';
import { runMenuJob } from '../core/MenuJob.js';

export class BlurMenu {
    /**
     * Initialize and open Blur modal
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(item, playlist) {
        const itemTemplate = document.getElementById('blur-item-template');
        const { modal, content: modalContent } = openProcessMenu('Blur', 'blur-content-template', FOOTER_CONFIGS.blur);
        if (!modal) return;
        if (!itemTemplate) {
            Logger.error('Blur modal templates not found!');
            modal.close();
            return;
        }

        // Used for drag/resize calculations
        const MIN_SIZE = 20;

        // === 1. Setup Editor DOM (Left Panel) ===
        // In the edit panel the areas are drawn over the main player.
        // The areas are drawn over the main player.
        const stage = await lendPicture(modal, playlist);
        if (!stage) return;
        const videoPanel = stage.wrapper;
        const { overlay, box } = createBoxOverlay({ overlayClass: 'blur-overlay', boxDataAttr: 'data-blur-box' });
        stage.adopt(overlay);
        const editorUI = { containerId: null, playerContainer: stage.wrapper, wrapper: stage.wrapper, overlay, box };

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

        // === 3. The player ===
        const player = stage.player;
        state.video = { ...stage.video };

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
        stage.addRenderCallback(renderCallback);

        // Wire blur intensity slider
        elements.blurIntensity.oninput = () => {
            elements.blurIntensityValue.textContent = `${elements.blurIntensity.value}px`;
            if (player) player.seek(player.currentTime);
        };


        // === 5. Box Logic, Selection & Drawing ===

        const { updateSelection, renderOverlayRects, dispose: disposeAreaEditor } = setupAreaEditor({
            editorUI, state, player, videoPanel,
            areas: () => state.blurAreas,
            rectClass: 'blur-area-rect',
            boxSelector: '[data-blur-box]',
            minSize: MIN_SIZE,
            createArea: (box) => ({
                id: generateId(),
                ...box,
                startTime: 0,
                endTime: player.duration || 10,
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


        const renderList = () => {
            const list = elements.blurList;
            list.innerHTML = '';

            if (state.blurAreas.length === 0) {
                list.innerHTML = `<div class="empty-state text-center py-xl text-muted text-xs italic">No blur areas added. Draw on the video to add a blur area.</div>`;
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
                startInput.value = formatTime(area.startTime);
                endInput.value = formatTime(area.endTime);

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
                    startInput.value = formatTime(area.startTime);
                };
                el.querySelector('.set-current-end').onclick = (e) => {
                    e.stopPropagation();
                    area.endTime = player.currentTime;
                    endInput.value = formatTime(area.endTime);
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

        elements.processBtn.onclick = async () => {
            if (state.blurAreas.length === 0) {
                elements.messages.error.textContent = "No blur areas defined.";
                elements.messages.error.classList.remove('hidden');
                return;
            }

            // De-select to hide box overlay
            updateSelection(-1);

            await runMenuJob({
                name: 'Blur',
                subject: item.title,
                background: true,
                failureText: (e) => e.message,
                modal,
                work: async ({ signal, onProgress }) => MediaProcessor.process({
                    source: await MediaMetadata.getSourceBlob(item, () => playlist._saveState()),
                    format: 'mp4',
                    blur: { areas: state.blurAreas, intensity: getBlurIntensity() },
                    onProgress: (p) => onProgress(p, p < 0.9 ? 'Blurring...' : 'Finalizing...'),
                    signal,
                }),
                done: (processedBlob) => {
                    const filename = item.title.replace(/\.[^/.]+$/, '') + '-blurred.mp4';
                    const { url } = playlist.insertProcessedItem(item, processedBlob, filename);
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
