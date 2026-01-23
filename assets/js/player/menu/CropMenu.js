import { Logger } from "../../utils/Logger.js";
import { Modal } from '../Modal.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { generateId } from '../../utils/mediaUtils.js';

/**
 * Crop Menu Handler
 * Handles video cropping functionality with a resizable crop box overlay
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

        // Elements
        const originalResDisplay = modalContent.querySelector('.original-resolution');
        const cropSizeDisplay = modalContent.querySelector('.crop-size');
        const previewCanvas = modalContent.querySelector('.crop-preview-canvas');
        const cropBox = modalContent.querySelector('[data-crop-box]');
        const cropOverlay = modalContent.querySelector('.crop-overlay');
        const leftInput = modalContent.querySelector('#crop-left');
        const topInput = modalContent.querySelector('#crop-top');
        const widthInput = modalContent.querySelector('#crop-width');
        const heightInput = modalContent.querySelector('#crop-height');
        const addToPlaylistCheckbox = modalContent.querySelector('input[name="addToPlaylist"]');
        const cropBtn = modalContent.querySelector('.crop-btn');
        const downloadBtn = modalContent.querySelector('.download-btn');
        const progressSection = modalContent.querySelector('.crop-progress');
        const progressBarFill = modalContent.querySelector('.progress-bar-fill');
        const progressText = modalContent.querySelector('.progress-percentage');
        const statusText = modalContent.querySelector('.status-text');
        const errorDisplay = modalContent.querySelector('.crop-error');
        const successDisplay = modalContent.querySelector('.crop-success');

        modal.open();

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

        // Draw video frame to canvas
        const drawPreview = async () => {
            try {
                const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());
                const video = document.createElement('video');
                video.muted = true;
                video.src = URL.createObjectURL(source);

                await new Promise((resolve, reject) => {
                    video.onloadedmetadata = resolve;
                    video.onerror = reject;
                });

                video.currentTime = 0.1;
                await new Promise(resolve => video.onseeked = resolve);

                const maxPreviewWidth = 580;
                const maxPreviewHeight = 320;

                const videoWidth = video.videoWidth;
                const videoHeight = video.videoHeight;

                previewScale = Math.min(maxPreviewWidth / videoWidth, maxPreviewHeight / videoHeight, 1);

                previewCanvas.width = videoWidth * previewScale;
                previewCanvas.height = videoHeight * previewScale;

                const ctx = previewCanvas.getContext('2d');
                ctx.drawImage(video, 0, 0, previewCanvas.width, previewCanvas.height);

                // Set overlay size to match canvas
                cropOverlay.style.width = `${previewCanvas.width}px`;
                cropOverlay.style.height = `${previewCanvas.height}px`;

                URL.revokeObjectURL(video.src);

                return { videoWidth, videoHeight };
            } catch (e) {
                Logger.error('Failed to draw preview:', e);
                throw e;
            }
        };

        // Load Metadata and initialize
        try {
            await playlist._ensureMetadata(item);

            if (item.videoInfo && item.videoInfo.width && item.videoInfo.height) {
                originalWidth = item.videoInfo.width;
                originalHeight = item.videoInfo.height;
            } else {
                // Try to get from video directly
                const dims = await drawPreview();
                originalWidth = dims.videoWidth;
                originalHeight = dims.videoHeight;
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

            await drawPreview();
            updateCropBoxFromState();
            updateInputsFromState();

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
                // Drag the whole box
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

                // Calculate fixed edges from start state
                const rightEdge = cropStart.left + cropStart.width;
                const bottomEdge = cropStart.top + cropStart.height;

                if (h.includes('w')) {
                    // Moving left edge, right edge stays fixed
                    let newLeft = cropStart.left + dx;
                    newLeft = Math.max(0, Math.min(newLeft, rightEdge - MIN_CROP_SIZE));
                    cropState.left = newLeft;
                    cropState.width = rightEdge - newLeft;
                }
                if (h.includes('e')) {
                    // Moving right edge, left edge stays fixed
                    let newWidth = cropStart.width + dx;
                    newWidth = Math.max(MIN_CROP_SIZE, Math.min(newWidth, originalWidth - cropStart.left));
                    cropState.width = newWidth;
                }
                if (h.includes('n')) {
                    // Moving top edge, bottom edge stays fixed
                    let newTop = cropStart.top + dy;
                    newTop = Math.max(0, Math.min(newTop, bottomEdge - MIN_CROP_SIZE));
                    cropState.top = newTop;
                    cropState.height = bottomEdge - newTop;
                }
                if (h.includes('s')) {
                    // Moving bottom edge, top edge stays fixed
                    let newHeight = cropStart.height + dy;
                    newHeight = Math.max(MIN_CROP_SIZE, Math.min(newHeight, originalHeight - cropStart.top));
                    cropState.height = newHeight;
                }
            }

            clampCropState();
            updateCropBoxFromState();
            updateInputsFromState();
        };

        // Track if we just finished dragging (to prevent modal close on mouseup)
        let wasDragging = false;

        const handleMouseUp = () => {
            if (isDragging) {
                wasDragging = true;
                // Reset wasDragging after a short delay (after click event fires)
                setTimeout(() => { wasDragging = false; }, 100);
            }
            isDragging = false;
            dragHandle = null;
        };

        cropOverlay.addEventListener('mousedown', handleMouseDown);
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        // Prevent modal from closing while dragging or just after drag ends
        const modalOverlay = modal.overlay;
        const preventCloseWhileDragging = (e) => {
            // Only close if clicking directly on overlay AND not during/after drag
            if (e.target === modalOverlay && !isDragging && !wasDragging) {
                modal.close();
            }
        };

        // Remove original click handler and add our custom one
        modalOverlay.removeEventListener('click', modalOverlay._closeHandler);
        modalOverlay.addEventListener('click', preventCloseWhileDragging);

        // Cleanup on modal close
        const originalClose = modal.close.bind(modal);
        modal.close = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            modalOverlay.removeEventListener('click', preventCloseWhileDragging);
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
                        progressBarFill.style.width = `${percent}%`;
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
                statusText.textContent = 'Cropping video...';
                progressBarFill.style.width = '0%';
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
