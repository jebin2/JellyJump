import { Modal } from '../Modal.js';
import { CorePlayer } from '../../core/Player.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { generateId, formatDuration } from '../../utils/mediaUtils.js';

export class RemoveBackgroundMenu {
    /**
     * Initialize and open Remove Background modal
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(item, playlist) {
        const contentTemplate = document.getElementById('remove-bg-content-template');
        const footerTemplate = document.getElementById('remove-bg-footer-template');

        if (!contentTemplate || !footerTemplate) {
            console.error('Remove Background modal templates not found!');
            return;
        }

        const modal = new Modal({ maxWidth: '900px' });
        modal.setTitle('Remove Background');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));

        const modalContent = modal.modal;

        // Open Modal
        modal.open();

        // Elements
        const playerContainer = modalContent.querySelector('#remove-bg-player-container');
        const selectedColorsList = modalContent.querySelector('.selected-colors-list');
        const pickColorBtn = modalContent.querySelector('#pick-color-btn');
        const livePreviewToggle = modalContent.querySelector('#live-preview-toggle');

        const bgTypeRadios = modalContent.querySelectorAll('input[name="bg-type"]');
        const customBgColorInput = modalContent.querySelector('#custom-bg-color');

        const processBtn = modalContent.querySelector('.process-btn');
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
        let player = null;
        let isPickingColor = false;
        let frameOverlay = null; // Overlay image for color picking

        // Initialize Player
        if (playerContainer) {
            player = new CorePlayer('remove-bg-player-container', {
                mode: 'player',
                controlBarMode: 'fixed', // Fixed control bar as requested
                controls: {
                    playPause: true,
                    navigation: false,  // No prev/next buttons
                    volume: false,
                    time: true,
                    progress: true,
                    captions: false,
                    settings: false,
                    fullscreen: false,
                    loop: true,
                    speed: false,
                    modeToggle: false,
                    keyboard: false  // Disable keyboard shortcuts for modal player
                },
                autoplay: false
            });
        }

        // Render Callback
        const renderCallback = (ctx, width, height) => {
            // Check Live Preview toggle
            if (!livePreviewToggle.checked) return;
            if (selectedColors.length === 0) return;

            const imageData = ctx.getImageData(0, 0, width, height);

            const bgType = Array.from(bgTypeRadios).find(r => r.checked).value;
            const bgColor = customBgColorInput.value;

            // Use shared logic for consistent results
            MediaProcessor.applyChromaKey(imageData, selectedColors, bgType, bgColor);

            ctx.putImageData(imageData, 0, 0);
        };

        if (player) {
            player.addRenderCallback(renderCallback);
        }

        // Initialize Video
        try {
            const videoUrl = await MediaMetadata.getProcessedSourceURL(item, () => playlist._saveState());
            await player.load(videoUrl, false);

            // Auto-detect background color
            if (player.canvas) {
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
                            console.log('[RemoveBackground] Auto-detected color:', detectedColor);
                            addColor(detectedColor);
                        }
                    } catch (e) {
                        console.warn('[RemoveBackground] Auto-detection failed:', e);
                    }
                }, 100);
            }

            // Handle Color Picking with Frame Overlay
            // Create a frame overlay for stable color picking
            const createFrameOverlay = () => {
                // Create overlay image if not exists
                if (!frameOverlay) {
                    frameOverlay = document.createElement('img');
                    frameOverlay.className = 'color-picker-overlay';
                    frameOverlay.style.cssText = `
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        object-fit: contain;
                        z-index: 100;
                        cursor: crosshair;
                        display: none;
                        background: #000;
                    `;
                    playerContainer.appendChild(frameOverlay);

                    // Click handler for picking color from overlay
                    frameOverlay.addEventListener('click', (e) => {
                        if (!isPickingColor) return;

                        // Create a temp canvas to read pixel from the overlay image
                        const tempCanvas = document.createElement('canvas');
                        tempCanvas.width = player.canvas.width;
                        tempCanvas.height = player.canvas.height;
                        const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
                        tempCtx.drawImage(frameOverlay, 0, 0, tempCanvas.width, tempCanvas.height);

                        // Calculate click position relative to image
                        const rect = frameOverlay.getBoundingClientRect();
                        const scaleX = tempCanvas.width / rect.width;
                        const scaleY = tempCanvas.height / rect.height;
                        const x = Math.floor((e.clientX - rect.left) * scaleX);
                        const y = Math.floor((e.clientY - rect.top) * scaleY);

                        const pixel = tempCtx.getImageData(x, y, 1, 1).data;

                        // Don't add if transparent
                        if (pixel[3] === 0) return;

                        addColor({
                            r: pixel[0],
                            g: pixel[1],
                            b: pixel[2]
                        });
                        // Don't close - allow picking more colors
                    });
                }
                return frameOverlay;
            };

            // Create the overlay
            createFrameOverlay();

        } catch (e) {
            console.error('Failed to load video:', e);
            errorMessage.textContent = 'Failed to load video: ' + e.message;
            errorMessage.classList.remove('hidden');
            return;
        }

        // --- Event Handlers ---

        function togglePickingMode(enable) {
            isPickingColor = enable;
            if (isPickingColor) {
                pickColorBtn.classList.add('active');
                pickColorBtn.innerHTML = `
                    <svg width="16" height="16" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-check"></use>
                    </svg>
                    Done
                `;
                player.pause(); // Pause video when picking starts

                // Capture current frame and show overlay
                if (player.canvas && frameOverlay) {
                    frameOverlay.src = player.canvas.toDataURL('image/png');
                    frameOverlay.style.display = 'block';
                }
            } else {
                pickColorBtn.classList.remove('active');
                pickColorBtn.innerHTML = `
                    <svg width="16" height="16" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-eyedropper"></use>
                    </svg>
                    Pick Color from Video
                `;

                // Hide overlay
                if (frameOverlay) {
                    frameOverlay.style.display = 'none';
                }
            }
        }

        pickColorBtn.onclick = () => {
            togglePickingMode(!isPickingColor);
        };

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
                        No colors selected.
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

        // Cleanup
        const originalClose = modal.close.bind(modal);
        modal.close = () => {
            if (player) player.destroy();
            originalClose();
        };

        // Process Video
        processBtn.onclick = async () => {
            if (selectedColors.length === 0) {
                errorMessage.textContent = 'Please select at least one color to remove.';
                errorMessage.classList.remove('hidden');
                return;
            }

            // UI Updates
            processBtn.disabled = true;
            downloadBtn.classList.add('hidden');
            progressSection.classList.remove('hidden');
            errorMessage.classList.add('hidden');
            successMessage.classList.add('hidden');

            // Disable inputs
            pickColorBtn.disabled = true;
            livePreviewToggle.disabled = true;
            bgTypeRadios.forEach(r => r.disabled = true);
            customBgColorInput.disabled = true;

            // Pause player
            if (player) player.pause();
            try {
                const bgType = Array.from(bgTypeRadios).find(r => r.checked).value;
                const bgColor = customBgColorInput.value;

                const processedBlob = await MediaProcessor.process({
                    source: sourceBlob,
                    removeBackgroundOptions: {
                        colors: selectedColors,
                        bgType: bgType,
                        bgColor: bgColor
                    },
                    onProgress: (progress) => {
                        const pct = Math.round(progress * 100);
                        progressBar.style.width = `${pct}%`;
                        progressText.textContent = `${pct}%`;

                        if (progress < 0.1) progressStatus.textContent = "Initializing...";
                        else if (progress < 0.9) progressStatus.textContent = "Removing background...";
                        else progressStatus.textContent = "Finalizing...";
                    }
                });

                // Success
                successMessage.classList.remove('hidden');
                progressSection.classList.add('hidden');

                // Setup download
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const ext = bgType === 'transparent' ? 'webm' : 'mp4';
                const filename = `${item.title.replace(/\.[^.]+$/, '')}-nobg.${ext}`;
                const url = URL.createObjectURL(processedBlob);

                downloadBtn.href = url;
                downloadBtn.download = filename;
                downloadBtn.classList.remove('hidden');

                downloadBtn.onclick = (e) => {
                    e.stopPropagation(); // Allow default download action
                };

                // Add to playlist
                const newItem = {
                    title: filename,
                    url: url,
                    duration: null, // Let metadata fetcher populate this
                    thumbnail: item.thumbnail, // Use original thumbnail for now
                    isLocal: true,
                    file: new File([processedBlob], filename, { type: `video/${ext}` }),
                    id: generateId(),
                    type: `video/${ext}`
                };

                const sourceIndex = playlist.items.indexOf(item);
                if (sourceIndex !== -1) {
                    playlist.items.splice(sourceIndex + 1, 0, newItem);
                } else {
                    playlist.items.push(newItem);
                }
                await playlist._ensureMetadata(newItem);

                playlist._saveState();
                playlist.render();

            } catch (e) {
                console.error('Processing failed:', e);
                errorMessage.textContent = `Processing failed: ${e.message}`;
                errorMessage.classList.remove('hidden');
                progressSection.classList.add('hidden');
            } finally {
                // Re-enable controls
                processBtn.disabled = false;
                pickColorBtn.disabled = false;
                livePreviewToggle.disabled = false;
                bgTypeRadios.forEach(r => r.disabled = false);
                if (bgTypeRadios[1].checked) customBgColorInput.disabled = false;
            }
        };
    }
}
