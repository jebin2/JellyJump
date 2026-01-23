import { Logger } from "../../utils/Logger.js";
import { Modal } from '../Modal.js';
import { CorePlayer } from '../../core/Player.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { generateId } from '../../utils/mediaUtils.js';

/**
 * Crop Menu Handler
 * Handles video cropping functionality with a resizable crop box overlay and live video preview
 */
export class CropMenu {
    /**
     * Initialize and open Crop modal
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(item, playlist) {
        const contentTemplate = document.getElementById('crop-content-template');
        const footerTemplate = document.getElementById('crop-footer-template');

        if (!contentTemplate || !footerTemplate) return;

        const modal = new Modal({ maxWidth: '650px' });
        modal.setTitle('Crop Video');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));

        const modalContent = modal.modal;

        // Open Modal Immediately
        modal.open();

        // Initialize Player
        const playerContainer = modalContent.querySelector('#crop-player-container');
        let player = null;

        if (playerContainer) {
            player = new CorePlayer('crop-player-container', {
                mode: 'player',
                controlBarMode: 'fixed',
                controls: {
                    playPause: true,
                    navigation: false,
                    time: true,
                    progress: true,
                    captions: false,
                    settings: false,
                    fullscreen: false,
                    loop: false,
                    speed: false,
                    filters: false,
                    equalizer: true,
                    volumeOnly: true,
                    modeToggle: false,
                    keyboard: false
                },
                autoplay: false
            });
        }

        // Elements - Body
        const originalResDisplay = modalContent.querySelector('.original-resolution');
        const cropSizeDisplay = modalContent.querySelector('.crop-size');
        const cropBox = modalContent.querySelector('[data-crop-box]');
        const cropOverlay = modalContent.querySelector('.crop-overlay');
        const leftInput = modalContent.querySelector('#crop-left');
        const topInput = modalContent.querySelector('#crop-top');
        const widthInput = modalContent.querySelector('#crop-width');
        const heightInput = modalContent.querySelector('#crop-height');
        const addToPlaylistCheckbox = modalContent.querySelector('input[name="addToPlaylist"]');

        // Elements - Footer
        const cropBtn = modalContent.querySelector('.crop-btn');
        const downloadBtn = modalContent.querySelector('.download-btn');
        const progressSection = modalContent.querySelector('.crop-progress');
        const progressText = modalContent.querySelector('.progress-percentage');
        const statusText = modalContent.querySelector('.status-text');
        const errorDisplay = modalContent.querySelector('.crop-error');
        const successDisplay = modalContent.querySelector('.crop-success');

        // State
        let originalWidth = 0;
        let originalHeight = 0;
        let cropState = { left: 0, top: 0, width: 0, height: 0 };
        let previewScale = 1;
        let isDragging = false;
        let dragHandle = null;
        let dragStart = { x: 0, y: 0 };
        let cropStart = { left: 0, top: 0, width: 0, height: 0 };

        const MIN_CROP_SIZE = 64;

        // Helper: Update crop size display
        const updateCropSizeDisplay = () => {
            cropSizeDisplay.textContent = `${cropState.width}x${cropState.height}`;
        };

        // Helper: Update crop box position from state
        const updateCropBoxFromState = () => {
            cropBox.style.left = `${cropState.left * previewScale}px`;
            cropBox.style.top = `${cropState.top * previewScale}px`;
            cropBox.style.width = `${cropState.width * previewScale}px`;
            cropBox.style.height = `${cropState.height * previewScale}px`;
        };

        // Helper: Update input fields from state
        const updateInputsFromState = () => {
            leftInput.value = Math.round(cropState.left);
            topInput.value = Math.round(cropState.top);
            widthInput.value = Math.round(cropState.width);
            heightInput.value = Math.round(cropState.height);
            updateCropSizeDisplay();
        };

        // Helper: Clamp crop state to valid bounds
        const clampCropState = () => {
            cropState.left = Math.max(0, Math.min(cropState.left, originalWidth - MIN_CROP_SIZE));
            cropState.top = Math.max(0, Math.min(cropState.top, originalHeight - MIN_CROP_SIZE));
            cropState.width = Math.max(MIN_CROP_SIZE, Math.min(cropState.width, originalWidth - cropState.left));
            cropState.height = Math.max(MIN_CROP_SIZE, Math.min(cropState.height, originalHeight - cropState.top));

            // Ensure even dimensions for codec compatibility
            cropState.width = Math.floor(cropState.width / 2) * 2;
            cropState.height = Math.floor(cropState.height / 2) * 2;
        };

        // Helper: Update overlay size to match player canvas
        const updateOverlaySize = () => {
            if (player && player.canvas) {
                const canvasRect = player.canvas.getBoundingClientRect();
                cropOverlay.style.width = `${canvasRect.width}px`;
                cropOverlay.style.height = `${canvasRect.height}px`;

                // Calculate scale based on canvas size vs original video
                previewScale = canvasRect.width / originalWidth;

                updateCropBoxFromState();
            }
        };

        // Load Metadata and initialize
        try {
            await playlist._ensureMetadata(item);

            if (item.videoInfo && item.videoInfo.width && item.videoInfo.height) {
                originalWidth = item.videoInfo.width;
                originalHeight = item.videoInfo.height;
            }

            // Load video into player
            if (player) {
                await MediaMetadata.getProcessedSourceURL(item, () => playlist._saveState());
                await player.load(item.blob_url, false);

                // Get dimensions from player if not available
                if (!originalWidth || !originalHeight) {
                    // Wait a bit for video to load
                    await new Promise(resolve => setTimeout(resolve, 100));
                    if (player.canvas) {
                        originalWidth = player.canvas.width || 1920;
                        originalHeight = player.canvas.height || 1080;
                    }
                }
            }

            originalResDisplay.textContent = `${originalWidth}x${originalHeight}`;

            // Initialize crop to 10% inset
            const inset = 0.1;
            cropState = {
                left: Math.floor(originalWidth * inset / 2) * 2,
                top: Math.floor(originalHeight * inset / 2) * 2,
                width: Math.floor(originalWidth * (1 - inset) / 2) * 2,
                height: Math.floor(originalHeight * (1 - inset) / 2) * 2
            };

            // Wait for player to render then update overlay
            setTimeout(() => {
                updateOverlaySize();
                updateInputsFromState();
            }, 200);

        } catch (e) {
            Logger.error('Failed to load video info:', e);
            originalResDisplay.textContent = 'Unknown';
            errorDisplay.textContent = 'Failed to load video info.';
            errorDisplay.classList.remove('hidden');
        }

        // Input Handlers
        const handleInputChange = () => {
            cropState.left = parseInt(leftInput.value) || 0;
            cropState.top = parseInt(topInput.value) || 0;
            cropState.width = parseInt(widthInput.value) || MIN_CROP_SIZE;
            cropState.height = parseInt(heightInput.value) || MIN_CROP_SIZE;
            clampCropState();
            updateCropBoxFromState();
            updateInputsFromState();
        };

        leftInput.addEventListener('input', handleInputChange);
        topInput.addEventListener('input', handleInputChange);
        widthInput.addEventListener('input', handleInputChange);
        heightInput.addEventListener('input', handleInputChange);

        // Crop Box Drag Handlers
        const getMousePos = (e) => {
            const rect = cropOverlay.getBoundingClientRect();
            return {
                x: (e.clientX - rect.left) / previewScale,
                y: (e.clientY - rect.top) / previewScale
            };
        };

        const handleMouseDown = (e) => {
            const handle = e.target.dataset.handle;
            if (handle) {
                isDragging = true;
                dragHandle = handle;
                dragStart = getMousePos(e);
                cropStart = { ...cropState };
                e.preventDefault();
            } else if (e.target === cropBox) {
                isDragging = true;
                dragHandle = 'move';
                dragStart = getMousePos(e);
                cropStart = { ...cropState };
                e.preventDefault();
            }
        };

        const handleMouseMove = (e) => {
            if (!isDragging) return;

            const pos = getMousePos(e);
            const dx = pos.x - dragStart.x;
            const dy = pos.y - dragStart.y;

            if (dragHandle === 'move') {
                cropState.left = cropStart.left + dx;
                cropState.top = cropStart.top + dy;
            } else {
                // Handle resize - keep opposite edge fixed
                const h = dragHandle;

                const rightEdge = cropStart.left + cropStart.width;
                const bottomEdge = cropStart.top + cropStart.height;

                if (h.includes('w')) {
                    let newLeft = cropStart.left + dx;
                    newLeft = Math.max(0, Math.min(newLeft, rightEdge - MIN_CROP_SIZE));
                    cropState.left = newLeft;
                    cropState.width = rightEdge - newLeft;
                }
                if (h.includes('e')) {
                    let newWidth = cropStart.width + dx;
                    newWidth = Math.max(MIN_CROP_SIZE, Math.min(newWidth, originalWidth - cropStart.left));
                    cropState.width = newWidth;
                }
                if (h.includes('n')) {
                    let newTop = cropStart.top + dy;
                    newTop = Math.max(0, Math.min(newTop, bottomEdge - MIN_CROP_SIZE));
                    cropState.top = newTop;
                    cropState.height = bottomEdge - newTop;
                }
                if (h.includes('s')) {
                    let newHeight = cropStart.height + dy;
                    newHeight = Math.max(MIN_CROP_SIZE, Math.min(newHeight, originalHeight - cropStart.top));
                    cropState.height = newHeight;
                }
            }

            clampCropState();
            updateCropBoxFromState();
            updateInputsFromState();
        };

        // Track if we just finished dragging
        let wasDragging = false;

        const handleMouseUp = () => {
            if (isDragging) {
                wasDragging = true;
                setTimeout(() => { wasDragging = false; }, 100);
            }
            isDragging = false;
            dragHandle = null;
        };

        cropOverlay.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        // Prevent modal from closing while dragging
        const modalOverlay = modal.overlay;
        const preventCloseWhileDragging = (e) => {
            if (e.target === modalOverlay && !isDragging && !wasDragging) {
                modal.close();
            }
        };

        modalOverlay.removeEventListener('click', modalOverlay._closeHandler);
        modalOverlay.addEventListener('click', preventCloseWhileDragging);

        // Cleanup on modal close
        const originalClose = modal.close.bind(modal);
        modal.close = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            modalOverlay.removeEventListener('click', preventCloseWhileDragging);
            if (player) {
                player.destroy();
            }
            originalClose();
        };

        // Crop Action
        cropBtn.addEventListener('click', async () => {
            // Validation
            if (cropState.width < MIN_CROP_SIZE || cropState.height < MIN_CROP_SIZE) {
                errorDisplay.textContent = `Crop dimensions must be at least ${MIN_CROP_SIZE}px.`;
                errorDisplay.classList.remove('hidden');
                return;
            }

            errorDisplay.classList.add('hidden');
            successDisplay.classList.add('hidden');
            progressSection.classList.remove('hidden');
            cropBtn.disabled = true;
            modal.closeBtn.disabled = true;
            statusText.textContent = `Cropping to ${cropState.width}x${cropState.height}...`;

            try {
                const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());

                const blob = await MediaProcessor.process({
                    source: source,
                    format: 'mp4',
                    quality: 100,
                    crop: {
                        left: Math.round(cropState.left),
                        top: Math.round(cropState.top),
                        width: Math.round(cropState.width),
                        height: Math.round(cropState.height)
                    },
                    onProgress: (progress) => {
                        const percent = Math.round(progress * 100);
                        progressText.textContent = `${percent}%`;
                    }
                });

                // Success
                successDisplay.classList.remove('hidden');
                progressSection.classList.add('hidden');

                // Configure Download
                const filename = item.title.replace(/\.[^/.]+$/, "") + `-crop-${cropState.width}x${cropState.height}.mp4`;
                const url = URL.createObjectURL(blob);

                downloadBtn.href = url;
                downloadBtn.download = filename;
                downloadBtn.classList.remove('hidden');

                // Reset for another crop
                cropBtn.disabled = false;
                cropBtn.classList.remove('hidden');
                statusText.textContent = 'Cropping...';
                progressText.textContent = '0%';

                // Add to Playlist
                if (addToPlaylistCheckbox.checked) {
                    const newItem = {
                        id: generateId(),
                        title: filename,
                        url: url,
                        file: new File([blob], filename, { type: 'video/mp4' }),
                        duration: item.duration,
                        type: 'video',
                        isLocal: true,
                        isNew: true,
                        path: (item.path || item.title) + '/' + filename
                    };

                    const insertIndex = playlist.items.indexOf(item) + 1;
                    playlist.items.splice(insertIndex, 0, newItem);
                    playlist.render();
                    playlist._saveState();
                }

                modal.closeBtn.disabled = false;

            } catch (e) {
                Logger.error('Crop failed:', e);
                errorDisplay.textContent = `Crop failed: ${e.message}`;
                errorDisplay.classList.remove('hidden');
                progressSection.classList.add('hidden');
                cropBtn.disabled = false;
                modal.closeBtn.disabled = false;
            }
        });
    }
}
