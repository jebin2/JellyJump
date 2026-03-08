import { Logger } from "../../utils/Logger.js";
import { Modal } from '../Modal.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { CustomDropdown } from '../../utils/CustomDropdown.js';
import { createProcessFooter, FOOTER_CONFIGS } from '../../utils/FooterHelper.js';

/**
 * Slideshow Menu Handler
 * Allows users to create an MP4 video from a collection of images with transitions and optional music.
 */
export class SlideshowMenu {
    /**
     * Initialize and open the Slideshow modal
     * @param {Object} playlist - Playlist instance
     */
    static async init(playlist) {
        const contentTemplate = document.getElementById('slideshow-content-template');
        const itemTemplate = document.getElementById('slideshow-image-item-template');

        if (!contentTemplate || !itemTemplate) {
            Logger.error('SlideshowMenu: templates not found');
            return;
        }

        const modal = new Modal({ maxWidth: '760px' });
        modal.setTitle('Images to Video');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(createProcessFooter(FOOTER_CONFIGS.slideshow));

        const modalContent = modal.modal;

        // --- Elements ---
        const dropzone = modalContent.querySelector('.slideshow-dropzone');
        const fileInput = modalContent.querySelector('.slideshow-file-input');
        const browseLink = modalContent.querySelector('.slideshow-browse-link');
        const imageListSection = modalContent.querySelector('.slideshow-image-list');
        const itemsList = modalContent.querySelector('.slideshow-items-list');
        const countSpan = modalContent.querySelector('.slideshow-count');
        const addMoreBtn = modalContent.querySelector('.slideshow-add-more-btn');

        const transitionBtn = modalContent.querySelector('#slideshow-transition-btn');
        const transitionMenu = modalContent.querySelector('#slideshow-transition-menu');
        const transDurWrap = modalContent.querySelector('.slideshow-transition-duration-wrap');
        const transDurSlider = modalContent.querySelector('.slideshow-trans-dur-slider');
        const transDurVal = modalContent.querySelector('.slideshow-trans-dur-val');

        const fpsBtn = modalContent.querySelector('#slideshow-fps-btn');
        const fpsMenu = modalContent.querySelector('#slideshow-fps-menu');

        const musicInput = modalContent.querySelector('.slideshow-music-input');
        const musicName = modalContent.querySelector('.slideshow-music-name');
        const musicClear = modalContent.querySelector('.slideshow-music-clear');

        const processBtn = modalContent.querySelector('.slideshow-btn');
        const downloadBtn = modalContent.querySelector('.download-btn');
        const progressSection = modalContent.querySelector('.progress-section');
        const progressText = modalContent.querySelector('.progress-percentage');
        const progressStatus = modalContent.querySelector('.progress-status');
        const errorMessage = modalContent.querySelector('.error-message');
        const successMessage = modalContent.querySelector('.success-message');

        // --- State ---
        const images = []; // { file, objectUrl, name }
        let musicFile = null;
        let dragSrcIndex = null;
        const objectUrls = [];

        // --- Dropdowns ---
        const transitionDropdown = CustomDropdown.init({
            button: transitionBtn,
            menu: transitionMenu,
            initialValue: 'cut',
            onChange: (value) => {
                if (value === 'cut') {
                    transDurWrap.style.display = 'none';
                } else {
                    transDurWrap.style.display = '';
                }
            }
        });

        const fpsDropdown = CustomDropdown.init({
            button: fpsBtn,
            menu: fpsMenu,
            initialValue: '30'
        });

        // --- Transition duration slider ---
        transDurSlider.addEventListener('input', () => {
            transDurVal.textContent = `${parseFloat(transDurSlider.value).toFixed(1)}s`;
        });

        // --- Helpers ---
        const updateCount = () => {
            countSpan.textContent = images.length;
            imageListSection.classList.toggle('hidden', images.length === 0);
        };

        const renderItems = () => {
            itemsList.innerHTML = '';
            images.forEach((img, index) => {
                const itemFrag = itemTemplate.content.cloneNode(true);
                const item = itemFrag.querySelector('.slideshow-item');
                item.querySelector('img').src = img.objectUrl;
                item.querySelector('.slideshow-item-name').textContent = img.name;
                item.dataset.index = index;

                // Drag-and-drop reordering
                item.addEventListener('dragstart', () => {
                    dragSrcIndex = index;
                    item.style.opacity = '0.5';
                });
                item.addEventListener('dragend', () => {
                    item.style.opacity = '';
                });
                item.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    item.style.outline = '2px solid var(--accent-primary)';
                });
                item.addEventListener('dragleave', () => {
                    item.style.outline = '';
                });
                item.addEventListener('drop', (e) => {
                    e.preventDefault();
                    item.style.outline = '';
                    if (dragSrcIndex !== null && dragSrcIndex !== index) {
                        const moved = images.splice(dragSrcIndex, 1)[0];
                        images.splice(index, 0, moved);
                        dragSrcIndex = null;
                        renderItems();
                    }
                });

                // Duration: clamp on blur
                const durInput = item.querySelector('.slideshow-item-duration');
                durInput.addEventListener('blur', () => {
                    const val = parseFloat(durInput.value);
                    durInput.value = isNaN(val) ? '3' : String(Math.max(0.5, Math.min(60, val)));
                });

                // Remove
                item.querySelector('.slideshow-item-remove').addEventListener('click', () => {
                    URL.revokeObjectURL(images[index].objectUrl);
                    images.splice(index, 1);
                    renderItems();
                    updateCount();
                });

                itemsList.appendChild(itemFrag);
            });
            updateCount();
        };

        const addImages = (files) => {
            for (const file of files) {
                if (!file.type.startsWith('image/')) continue;
                const objectUrl = URL.createObjectURL(file);
                objectUrls.push(objectUrl);
                images.push({ file, objectUrl, name: file.name });
            }
            renderItems();
        };

        // --- Dropzone ---
        dropzone.addEventListener('click', () => fileInput.click());
        browseLink.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
        fileInput.addEventListener('change', () => {
            if (fileInput.files.length) addImages(fileInput.files);
            fileInput.value = '';
        });
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = 'var(--accent-primary)';
        });
        dropzone.addEventListener('dragleave', () => {
            dropzone.style.borderColor = '';
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.style.borderColor = '';
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (files.length) addImages(files);
        });

        addMoreBtn.addEventListener('click', () => fileInput.click());

        // --- Music ---
        musicInput.addEventListener('change', () => {
            if (musicInput.files.length) {
                musicFile = musicInput.files[0];
                musicName.textContent = musicFile.name;
                musicClear.classList.remove('hidden');
            }
        });
        musicClear.addEventListener('click', () => {
            musicFile = null;
            musicInput.value = '';
            musicName.textContent = 'No file selected';
            musicClear.classList.add('hidden');
        });

        // --- Open Modal ---
        modal.open();

        // --- Process Handler ---
        if (processBtn) {
            processBtn.addEventListener('click', async () => {
                if (images.length === 0) {
                    if (errorMessage) {
                        errorMessage.textContent = 'Please add at least one image.';
                        errorMessage.classList.remove('hidden');
                    }
                    return;
                }

                // Collect settings
                const imageBlobs = images.map(img => img.file);
                const imageDurations = Array.from(
                    itemsList.querySelectorAll('.slideshow-item-duration')
                ).map(inp => Math.max(0.5, parseFloat(inp.value) || 3));
                const transition = transitionDropdown.getValue();
                const transitionDuration = parseFloat(transDurSlider.value) || 0.5;
                const fps = parseInt(fpsDropdown.getValue(), 10) || 30;
                const audioBlob = musicFile || null;

                // Disable UI
                processBtn.disabled = true;
                transitionDropdown.setDisabled(true);
                fpsDropdown.setDisabled(true);
                if (downloadBtn) downloadBtn.disabled = true;
                if (errorMessage) errorMessage.classList.add('hidden');
                if (successMessage) successMessage.classList.add('hidden');
                if (progressSection) progressSection.classList.remove('hidden');
                if (progressStatus) progressStatus.textContent = 'Encoding...';

                const closeBtn = modal.modal.querySelector('.mb-modal-close');
                const originalClose = modal.close.bind(modal);
                modal.close = () => { };
                if (closeBtn) closeBtn.style.display = 'none';

                try {
                    const onProgress = (progress) => {
                        const pct = Math.round(progress * 100);
                        if (progressText) progressText.textContent = `${pct}%`;
                        if (progressStatus) {
                            progressStatus.textContent = progress < 0.9 ? 'Rendering frames...' : 'Finalizing...';
                        }
                    };

                    const outputBlob = await MediaProcessor.createSlideshowVideo({
                        imageBlobs,
                        imageDurations,
                        transition,
                        transitionDuration,
                        audioBlob,
                        audioLoop: true,
                        fps,
                        onProgress
                    });

                    if (successMessage) successMessage.classList.remove('hidden');
                    if (progressSection) progressSection.classList.add('hidden');

                    const filename = `slideshow-${transition}-${Date.now()}.mp4`;
                    const { item: newItem, url } = playlist.insertProcessedItem(null, outputBlob, filename, {
                        mediaType: 'video/mp4',
                        extra: { path: `Slideshow/${filename}` }
                    });
                    await playlist._ensureMetadata(newItem);

                    if (downloadBtn) {
                        downloadBtn.onclick = () => {
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                        };
                        downloadBtn.disabled = false;
                        downloadBtn.classList.remove('hidden');
                    }
                } catch (e) {
                    Logger.error('[SlideshowMenu] Processing failed:', e);
                    if (errorMessage) {
                        errorMessage.textContent = `Failed: ${e.message}`;
                        errorMessage.classList.remove('hidden');
                    }
                    if (progressSection) progressSection.classList.add('hidden');
                } finally {
                    modal.close = originalClose;
                    if (closeBtn) closeBtn.style.display = '';
                    if (processBtn) processBtn.disabled = false;
                    transitionDropdown.setDisabled(false);
                    fpsDropdown.setDisabled(false);
                }
            });
        }

        // --- Cleanup ---
        modal.onCleanup(() => {
            transitionDropdown.destroy();
            fpsDropdown.destroy();
            for (const url of objectUrls) {
                try { URL.revokeObjectURL(url); } catch (_) { /* ignore */ }
            }
        });
    }
}
