import { Modal } from '../Modal.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { generateId } from '../../utils/mediaUtils.js';

/**
 * Merge Menu Handler
 * Handles video merging/concatenation with drag-and-drop ordering
 */
export class MergeMenu {
    /**
     * Initialize and open Merge modal
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(item, playlist) {
        const initialIndex = playlist.items.indexOf(item);

        const contentTemplate = document.getElementById('merge-modal-content-template');
        const footerTemplate = document.getElementById('merge-modal-footer-template');
        const itemTemplate = document.getElementById('merge-item-template');

        if (!contentTemplate || !footerTemplate || !itemTemplate) return;

        const modal = new Modal({ maxWidth: '900px' });
        modal.setTitle('Merge Videos');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));

        const modalContent = modal.modal;
        const availableList = modalContent.querySelector('.available-list');
        const selectedList = modalContent.querySelector('.selected-list');
        const mergeBtn = modalContent.querySelector('.merge-btn');
        const selectionCount = modalContent.querySelector('.selection-count');
        const emptySelectionState = modalContent.querySelector('.empty-selection-state');

        // Resolution controls
        const widthInput = modalContent.querySelector('#merge-width');
        const heightInput = modalContent.querySelector('#merge-height');
        const maxResolutionHint = modalContent.querySelector('.max-resolution-hint');
        const scaleSelect = modalContent.querySelector('.scale-select');
        const bgColorInput = modalContent.querySelector('#merge-bg-color');

        // State
        let selectedVideos = []; // Array of playlist items

        // Helper: Detect Max Resolution
        const detectMaxResolution = async () => {
            if (selectedVideos.length === 0) {
                widthInput.value = '';
                heightInput.value = '';
                maxResolutionHint.textContent = 'Select videos to detect resolution';
                return;
            }

            maxResolutionHint.textContent = 'Detecting resolution...';

            let maxWidth = 0;
            let maxHeight = 0;

            for (const item of selectedVideos) {
                if (!item.videoInfo) {
                    const oldDuration = item.duration;
                    item.duration = 'Loading...';
                    renderSelected();

                    await playlist._ensureMetadata(item);
                    renderSelected();
                } else {
                    await playlist._ensureMetadata(item);
                }

                if (item.videoInfo) {
                    maxWidth = Math.max(maxWidth, item.videoInfo.width);
                    maxHeight = Math.max(maxHeight, item.videoInfo.height);
                }
            }

            if (maxWidth > 0 && maxHeight > 0) {
                widthInput.value = maxWidth;
                heightInput.value = maxHeight;
                maxResolutionHint.textContent = `Max detected: ${maxWidth}×${maxHeight}`;
            } else {
                maxResolutionHint.textContent = 'Could not detect resolution';
            }
        };

        // Helper: Update UI
        const updateUI = async () => {
            selectionCount.textContent = `${selectedVideos.length} selected`;

            if (selectedVideos.length >= 2) {
                mergeBtn.removeAttribute('disabled');
            } else {
                mergeBtn.setAttribute('disabled', 'true');
            }

            if (selectedVideos.length > 0) {
                emptySelectionState.classList.add('hidden');
            } else {
                emptySelectionState.classList.remove('hidden');
            }

            await detectMaxResolution();
        };

        // Helper: Render Available Videos
        const renderAvailable = () => {
            availableList.innerHTML = '';

            // Filter video items only
            const videoItems = playlist.items.filter(item => {
                return !item.type || item.type.startsWith('video/');
            });

            if (videoItems.length === 0) {
                availableList.innerHTML = '<div class="empty-state text-center p-md text-muted text-sm italic">No videos available</div>';
                return;
            }

            videoItems.forEach((item, idx) => {
                const el = itemTemplate.content.cloneNode(true).querySelector('.merge-item');
                el.querySelector('.remove-item-btn').remove();

                const titleEl = el.querySelector('.item-title');
                titleEl.textContent = item.title;
                titleEl.title = item.title;
                el.querySelector('.item-dur').textContent = item.duration || '--:--';

                const isSelected = selectedVideos.includes(item);
                if (isSelected) {
                    el.classList.add('bg-primary', 'text-white');
                    el.classList.remove('hover:bg-tertiary');
                }

                el.addEventListener('click', () => {
                    // Always add to merge list (allowing duplicates)
                    selectedVideos.push(item);
                    renderAvailable();
                    renderSelected();
                    updateUI();
                });

                availableList.appendChild(el);
            });
        };

        // Helper: Render Selected Videos (Draggable)
        const renderSelected = () => {
            selectedList.innerHTML = '';
            if (selectedVideos.length === 0) {
                selectedList.appendChild(emptySelectionState);
                return;
            }

            selectedVideos.forEach((item, idx) => {
                if (!item) {
                    console.warn('Undefined item in selectedVideos at index', idx);
                    return;
                }

                const el = itemTemplate.content.cloneNode(true).querySelector('.merge-item');

                const titleEl = el.querySelector('.item-title');
                titleEl.textContent = item.title;
                titleEl.title = item.title;
                el.querySelector('.item-dur').textContent = item.duration || '--:--';

                // Remove Button
                el.querySelector('.remove-item-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectedVideos.splice(idx, 1); // Remove only this specific instance
                    renderAvailable();
                    renderSelected();
                    updateUI();
                });

                // Drag Events
                el.addEventListener('dragstart', (e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', idx);
                    el.classList.add('opacity-50');
                });

                el.addEventListener('dragend', () => {
                    el.classList.remove('opacity-50');
                    selectedList.querySelectorAll('.merge-item').forEach(i => i.classList.remove('border-primary'));
                });

                el.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    el.classList.add('border-primary');
                });

                el.addEventListener('dragleave', () => {
                    el.classList.remove('border-primary');
                });

                el.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
                    const toIdx = idx;

                    if (fromIdx !== toIdx) {
                        const movedItem = selectedVideos[fromIdx];
                        selectedVideos.splice(fromIdx, 1);
                        selectedVideos.splice(toIdx, 0, movedItem);
                        renderSelected();
                    }
                });

                selectedList.appendChild(el);
            });
        };

        // Initial Selection
        if (typeof initialIndex === 'number' && playlist.items[initialIndex]) {
            selectedVideos.push(playlist.items[initialIndex]);
            if (playlist.items[initialIndex + 1]) {
                selectedVideos.push(playlist.items[initialIndex + 1]);
            }
        }

        modal.open();
        renderAvailable();
        renderSelected();
        updateUI();

        // Merge Action
        mergeBtn.addEventListener('click', async () => {
            if (selectedVideos.length < 2) return;

            const targetWidth = parseInt(widthInput.value);
            const targetHeight = parseInt(heightInput.value);
            const scaleMode = scaleSelect.value;
            const backgroundColor = bgColorInput.value;
            const addToPlaylist = modalContent.querySelector('input[name="addToPlaylist"]').checked;

            // Validate
            if (!targetWidth || !targetHeight || targetWidth < 128 || targetHeight < 128) {
                alert('Please enter valid resolution dimensions (minimum 128×128)');
                return;
            }

            // UI State
            modalContent.querySelector('.options-group').classList.add('disabled');
            widthInput.disabled = true;
            heightInput.disabled = true;
            scaleSelect.disabled = true;
            bgColorInput.disabled = true;

            mergeBtn.disabled = true;
            mergeBtn.innerHTML = '<span class="spinner-sm border-2 border-current border-t-transparent rounded-full w-4 h-4 animate-spin mr-xs"></span> Merging...';

            const progressSection = modalContent.querySelector('.merge-progress');
            const progressBar = progressSection.querySelector('.progress-bar-fill');
            const progressText = progressSection.querySelector('.progress-percentage');
            const errorMsg = modalContent.querySelector('.merge-error');
            const successMsg = modalContent.querySelector('.merge-success');
            const downloadBtn = modalContent.querySelector('.download-btn');

            progressSection.classList.remove('hidden');
            errorMsg.classList.add('hidden');
            successMsg.classList.add('hidden');

            try {
                // Prepare Inputs (with caching)
                const inputs = [];
                for (const item of selectedVideos) {
                    const blob = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());
                    inputs.push(blob);
                }

                // Merge
                const mergedBlob = await MediaProcessor.merge({
                    inputs: inputs,
                    format: 'mp4',
                    resolution: { width: targetWidth, height: targetHeight },
                    scaleMode: scaleMode,
                    backgroundColor: backgroundColor,
                    onProgress: (progress) => {
                        const pct = Math.round(progress * 100);
                        progressBar.style.width = `${pct}%`;
                        progressText.textContent = `${pct}%`;
                    }
                });

                // Success
                successMsg.classList.remove('hidden');
                mergeBtn.innerHTML = 'Merged';

                // Setup Download
                const url = URL.createObjectURL(mergedBlob);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `merged-${timestamp}.mp4`;

                downloadBtn.href = url;
                downloadBtn.download = filename;
                downloadBtn.classList.remove('hidden');

                // Add to Playlist
                if (addToPlaylist) {
                    const newItem = {
                        title: filename,
                        url: url,
                        duration: '...',
                        thumbnail: '',
                        isLocal: true,
                        file: new File([mergedBlob], filename, { type: 'video/mp4' }),
                        id: generateId()
                    };

                    const lastIndex = playlist.items.indexOf(selectedVideos[selectedVideos.length - 1]);
                    if (lastIndex !== -1) {
                        playlist.items.splice(lastIndex + 1, 0, newItem);
                    } else {
                        playlist.items.push(newItem);
                    }

                    playlist._saveState();
                    playlist.render();
                    playlist._processMetadata([newItem]);
                }

            } catch (e) {
                console.error('Merge failed:', e);
                errorMsg.textContent = `Merge failed: ${e.message}`;
                errorMsg.classList.remove('hidden');
                mergeBtn.disabled = false;
                mergeBtn.innerHTML = '<span class="mr-xs">Merge</span><svg width="16" height="16" fill="currentColor"><use href="assets/icons/sprite.svg#icon-layers"></use></svg>';
            }
        });
    }
}
