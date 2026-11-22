import { Logger } from "../../../shared/utils/Logger.js";
import { MediaMetadata } from '../../../shared/utils/MediaMetadata.js';
import { MediaProcessor } from '../../../processing/MediaProcessor.js';
import { lendPicture, canvasPoint } from '../core/PreviewPlayer.js';
import { openProcessMenu, FOOTER_CONFIGS } from '../core/MenuFactory.js';
import { runMenuJob } from '../core/MenuJob.js';

export class RemoveBackgroundMenu {
    /**
     * Initialize and open Remove Background modal
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(item, playlist) {
        const { modal, content: modalContent } = openProcessMenu('Remove Background', 'remove-bg-content-template', FOOTER_CONFIGS.removeBg);
        if (!modal) return;

        // Elements
        const selectedColorsList = modalContent.querySelector('.selected-colors-list');
        const livePreviewToggle = modalContent.querySelector('#live-preview-toggle');

        const bgTypeRadios = modalContent.querySelectorAll('input[name="bg-type"]');
        const customBgColorInput = modalContent.querySelector('#custom-bg-color');

        const processBtn = modalContent.querySelector('.removebg-btn');
        const downloadBtn = modalContent.querySelector('.download-btn');
        const progressSection = modalContent.querySelector('.progress-section');
        const progressBar = modalContent.querySelector('.progress-bar-fill');
        const progressText = modalContent.querySelector('.progress-percentage');
        const progressStatus = modalContent.querySelector('.progress-status');
        const errorMessage = modalContent.querySelector('.error-message');
        const successMessage = modalContent.querySelector('.success-message');

        // State
        let selectedColors = []; // Array of {r, g, b, tolerance}
        let sourceBlob = null;

        // The main player is the preview, and a clear layer over its picture
        // takes the clicks that pick colours.
        const stage = await lendPicture(modal, playlist);
        if (!stage) return;
        const player = stage.player;
        const pickTarget = document.createElement('div');
        pickTarget.className = 'jj-pick-layer';
        pickTarget.title = 'Click a colour to remove it';
        stage.adopt(pickTarget);

        // Render Callback
        const renderCallback = (canvas, ctx) => {
            // Check Live Preview toggle
            if (!livePreviewToggle.checked) return;
            if (selectedColors.length === 0) return;

            const width = canvas.width;
            const height = canvas.height;

            const imageData = ctx.getImageData(0, 0, width, height);

            const bgType = Array.from(bgTypeRadios).find(r => r.checked).value;
            const bgColor = customBgColorInput.value;

            // Use shared logic for consistent results
            MediaProcessor.applyChromaKey(imageData, selectedColors, bgType, bgColor);

            ctx.putImageData(imageData, 0, 0);
        };

        stage.addRenderCallback(renderCallback);

        // Initialize Video
        try {
            // Auto-detect background color
            if (player && player.canvas) {
                // Wait a moment for the frame to render
                setTimeout(() => {
                    try {
                        const ctx = player.canvas.getContext('2d', { willReadFrequently: true });
                        const width = player.canvas.width;
                        const height = player.canvas.height;
                        const imageData = ctx.getImageData(0, 0, width, height).data;

                        // Helper to detect background color from frame edges
                        const detectBackgroundColor = (data, width, height) => {
                            // We will sample 4 points: Top-Left, Top-Right, Bottom-Left, Bottom-Right
                            const positions = [
                                0,                              // Top-Left
                                (width - 1) * 4,                // Top-Right
                                (width * (height - 1)) * 4,     // Bottom-Left
                                (width * height - 1) * 4        // Bottom-Right
                            ];

                            let r = 0, g = 0, b = 0;
                            let count = 0;

                            positions.forEach(pos => {
                                if (pos < data.length) {
                                    r += data[pos];
                                    g += data[pos + 1];
                                    b += data[pos + 2];
                                    count++;
                                }
                            });

                            if (count === 0) return null;

                            // Return the average RGB values
                            return {
                                r: Math.round(r / count),
                                g: Math.round(g / count),
                                b: Math.round(b / count)
                            };
                        };

                        const detectedColor = detectBackgroundColor(imageData, width, height);
                        if (detectedColor) {
                            Logger.log('[RemoveBackground] Auto-detected color:', detectedColor);
                            addColor(detectedColor);
                        }
                    } catch (e) {
                        Logger.warn('[RemoveBackground] Auto-detection failed:', e);
                    }
                }, 100);
            }

        } catch (e) {
            Logger.error('Failed to load video:', e);
            errorMessage.textContent = 'Failed to load video: ' + e.message;
            errorMessage.classList.remove('hidden');
            return;
        }

        // --- Event Handlers ---

        // Direct click-to-pick: clicking on the video picks color
        pickTarget.style.cursor = 'crosshair';
        pickTarget.addEventListener('click', (e) => {
            if (!player || !player.canvas) return;

            // Read pixel at click position from canvas -- the picture is
            // letterboxed in it, so a click on the bars picks nothing.
            const point = canvasPoint(player.canvas, e);
            if (!point) return;

            const ctx = player.canvas.getContext('2d', { willReadFrequently: true });
            const pixel = ctx.getImageData(point.x, point.y, 1, 1).data;
            if (pixel[3] > 0) {
                addColor({ r: pixel[0], g: pixel[1], b: pixel[2] });
            }
        });

        livePreviewToggle.onchange = () => {
            if (!player.isPlaying) player.seek(player.currentTime);
        };

        function addColor(color) {
            const exists = selectedColors.some(c =>
                Math.abs(c.r - color.r) < 5 &&
                Math.abs(c.g - color.g) < 5 &&
                Math.abs(c.b - color.b) < 5
            );

            if (exists) return;

            // Add with default values
            selectedColors.push({
                ...color,
                similarity: 0.0,
                smoothness: 0.08,
                spill: 0.1
            });
            renderColorsList();

            // Force redraw if paused
            if (!player.isPlaying) player.seek(player.currentTime);
        }

        function removeColor(index) {
            selectedColors.splice(index, 1);
            renderColorsList();
            if (!player.isPlaying) player.seek(player.currentTime);
        }

        function renderColorsList() {
            selectedColorsList.innerHTML = '';

            if (selectedColors.length === 0) {
                selectedColorsList.innerHTML = `
                    <div class="empty-state text-xs text-muted text-center py-md">
                        Click on the video to pick colors.
                    </div>
                `;
                return;
            }

            const template = document.getElementById('color-item-template');

            selectedColors.forEach((color, index) => {
                const clone = template.content.cloneNode(true);

                const swatch = clone.querySelector('.color-swatch');
                const hex = clone.querySelector('.color-hex');
                const removeBtn = clone.querySelector('.remove-color-btn');

                // Sliders
                const similaritySlider = clone.querySelector('.similarity-slider');
                const similarityValue = clone.querySelector('.similarity-value');
                const smoothnessSlider = clone.querySelector('.smoothness-slider');
                const smoothnessValue = clone.querySelector('.smoothness-value');
                const spillSlider = clone.querySelector('.spill-slider');
                const spillValue = clone.querySelector('.spill-value');

                // Keep slider clicks from toggling the parent row
                // (was an inline onclick in the template, removed for CSP)
                [similaritySlider, smoothnessSlider, spillSlider].forEach((slider) =>
                    slider.addEventListener('click', (e) => e.stopPropagation()));

                const rgbString = `rgb(${color.r}, ${color.g}, ${color.b})`;
                swatch.style.backgroundColor = rgbString;
                hex.textContent = rgbToHex(color.r, color.g, color.b);

                // Initialize values
                similaritySlider.value = color.similarity * 100;
                similarityValue.textContent = color.similarity.toFixed(2);

                smoothnessSlider.value = color.smoothness * 100;
                smoothnessValue.textContent = color.smoothness.toFixed(2);

                spillSlider.value = color.spill * 100;
                spillValue.textContent = color.spill.toFixed(2);

                // Event Handlers
                const updatePreview = () => {
                    if (!player.isPlaying) player.seek(player.currentTime);
                };

                similaritySlider.oninput = () => {
                    color.similarity = parseInt(similaritySlider.value) / 100;
                    similarityValue.textContent = color.similarity.toFixed(2);
                    updatePreview();
                };

                smoothnessSlider.oninput = () => {
                    color.smoothness = parseInt(smoothnessSlider.value) / 100;
                    smoothnessValue.textContent = color.smoothness.toFixed(2);
                    updatePreview();
                };

                spillSlider.oninput = () => {
                    color.spill = parseInt(spillSlider.value) / 100;
                    spillValue.textContent = color.spill.toFixed(2);
                    updatePreview();
                };

                removeBtn.onclick = () => removeColor(index);

                selectedColorsList.appendChild(clone);
            });
        }

        // Background Options
        bgTypeRadios.forEach(radio => {
            radio.onchange = () => {
                const isCustom = radio.value === 'custom';
                customBgColorInput.disabled = !isCustom;
                if (!player.isPlaying) player.seek(player.currentTime);
            };

            radio.onclick = () => {
                if (radio.value === 'custom') {
                    customBgColorInput.disabled = false;
                    setTimeout(() => customBgColorInput.click(), 10);
                }
            };
        });

        customBgColorInput.onchange = () => {
            if (!player.isPlaying) player.seek(player.currentTime);
        };

        // Helpers
        function rgbToHex(r, g, b) {
            return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
        }

        function hexToRgb(hex) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
            return result ? {
                r: parseInt(result[1], 16),
                g: parseInt(result[2], 16),
                b: parseInt(result[3], 16)
            } : null;
        }

        // Process Video
        processBtn.onclick = async () => {
            if (selectedColors.length === 0) {
                errorMessage.textContent = 'Please select at least one color to remove.';
                errorMessage.classList.remove('hidden');
                return;
            }

            downloadBtn.classList.add('hidden');
            // Its own rule for coming back: only with a custom background.
            customBgColorInput.disabled = true;
            if (player) player.pause();

            const bgType = Array.from(bgTypeRadios).find(r => r.checked).value;
            const bgColor = customBgColorInput.value;

            await runMenuJob({
                name: 'Remove BG',
                subject: item.title,
                background: true,
                modal,
                work: async ({ signal, onProgress }) => MediaProcessor.process({
                    source: await MediaMetadata.getProcessedSourceURL(item),
                    removeBackgroundOptions: { colors: selectedColors, bgType, bgColor },
                    onProgress: (p) => onProgress(p,
                        p < 0.1 ? 'Initializing...' : p < 0.9 ? 'Removing background...' : 'Finalizing...'),
                    signal,
                }),
                done: async (processedBlob) => {
                    const ext = bgType === 'transparent' ? 'webm' : 'mp4';
                    const filename = `${item.title.replace(/\.[^.]+$/, '')}-nobg.${ext}`;
                    const { item: newItem, url } = playlist.insertProcessedItem(item, processedBlob, filename, {
                        type: `video/${ext}`,
                        mediaType: `video/${ext}`,
                        duration: null,
                        extra: { thumbnail: item.thumbnail },
                    });
                    downloadBtn.href = url;
                    downloadBtn.download = filename;
                    downloadBtn.classList.remove('hidden');
                    downloadBtn.onclick = (e) => {
                        e.stopPropagation(); // Allow default download action
                    };
                    await playlist._ensureMetadata(newItem);
                },
            });
            if (bgTypeRadios[1].checked) customBgColorInput.disabled = false;
        };
    }
}
