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

        // Initialize Player
        if (playerContainer) {
            player = new CorePlayer('remove-bg-player-container', {
                mode: 'player',
                controlBarMode: 'fixed', // Fixed control bar as requested
                controls: {
                    playPause: true,
                    volume: false,
                    time: true,
                    progress: true,
                    captions: false,
                    settings: false,
                    fullscreen: false,
                    loop: true,
                    speed: false,
                    modeToggle: false
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
            const data = imageData.data;

            const bgType = Array.from(bgTypeRadios).find(r => r.checked).value;
            let bgR, bgG, bgB;

            if (bgType === 'custom') {
                const hex = customBgColorInput.value;
                const rgb = hexToRgb(hex);
                bgR = rgb ? rgb.r : 0;
                bgG = rgb ? rgb.g : 0;
                bgB = rgb ? rgb.b : 0;
            }

            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];

                for (const color of selectedColors) {
                    const dist = Math.sqrt(
                        Math.pow(r - color.r, 2) +
                        Math.pow(g - color.g, 2) +
                        Math.pow(b - color.b, 2)
                    );

                    if (dist <= color.tolerance) {
                        if (bgType === 'transparent') {
                            data[i + 3] = 0; // Alpha 0
                        } else {
                            data[i] = bgR;
                            data[i + 1] = bgG;
                            data[i + 2] = bgB;
                        }
                        break;
                    }
                }
            }
            ctx.putImageData(imageData, 0, 0);
        };

        if (player) {
            player.addRenderCallback(renderCallback);
        }

        // Initialize Video
        try {
            sourceBlob = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());
            const videoUrl = URL.createObjectURL(sourceBlob);

            await player.load(videoUrl, false);

            // Handle Color Picking
            if (player.canvas) {
                player.canvas.addEventListener('click', (e) => {
                    if (!isPickingColor) return;

                    // Stop propagation to prevent play/pause toggle
                    e.stopImmediatePropagation();
                    e.preventDefault();

                    const rect = player.canvas.getBoundingClientRect();
                    const scaleX = player.canvas.width / rect.width;
                    const scaleY = player.canvas.height / rect.height;

                    const x = (e.clientX - rect.left) * scaleX;
                    const y = (e.clientY - rect.top) * scaleY;

                    const ctx = player.canvas.getContext('2d', { willReadFrequently: true });
                    const pixel = ctx.getImageData(x, y, 1, 1).data;

                    // Don't add if transparent
                    if (pixel[3] === 0) return;

                    addColor({
                        r: pixel[0],
                        g: pixel[1],
                        b: pixel[2],
                        tolerance: 10
                    });

                    // Turn off picking mode after selection
                    togglePickingMode(false);

                }, true); // Capture phase

                // Change cursor when hovering canvas in picking mode
                player.canvas.addEventListener('mousemove', () => {
                    player.canvas.style.cursor = isPickingColor ? 'crosshair' : 'pointer';
                });
            }

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
                    <svg width="16" height="16" fill="currentColor" class="animate-pulse">
                        <use href="assets/icons/sprite.svg#icon-eyedropper"></use>
                    </svg>
                    Picking... (Click Video)
                `;
                player.pause(); // Pause video when picking starts
                player.canvas.style.cursor = 'crosshair';
            } else {
                pickColorBtn.classList.remove('active');
                pickColorBtn.innerHTML = `
                    <svg width="16" height="16" fill="currentColor">
                        <use href="assets/icons/sprite.svg#icon-eyedropper"></use>
                    </svg>
                    Pick Color from Video
                `;
                player.canvas.style.cursor = 'pointer';
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

            selectedColors.push(color);
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
                const slider = clone.querySelector('.tolerance-slider');
                const toleranceValue = clone.querySelector('.tolerance-value');

                const rgbString = `rgb(${color.r}, ${color.g}, ${color.b})`;
                swatch.style.backgroundColor = rgbString;
                hex.textContent = rgbToHex(color.r, color.g, color.b);

                slider.value = color.tolerance;
                toleranceValue.textContent = `Tol: ${color.tolerance}`;

                slider.oninput = () => {
                    color.tolerance = parseInt(slider.value);
                    toleranceValue.textContent = `Tol: ${color.tolerance}`;
                };

                slider.onchange = () => {
                    if (!player.isPlaying) player.seek(player.currentTime);
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

                const processedBlob = await MediaProcessor.removeBackground({
                    source: sourceBlob,
                    colors: selectedColors,
                    bgType: bgType,
                    bgColor: bgColor,
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
                    duration: item.duration, // Approx same duration
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
