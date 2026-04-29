import { Logger } from "../../../utils/Logger.js";
import { MediaProcessor } from '../../../core/MediaProcessor.js';
import { CustomDropdown } from '../../../utils/CustomDropdown.js';
import { openProcessMenu, FOOTER_CONFIGS } from '../core/MenuFactory.js';

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
        const itemTemplate = document.getElementById('slideshow-image-item-template');
        const { modal, content: modalContent } = openProcessMenu('Images to Video', 'slideshow-content-template', FOOTER_CONFIGS.slideshow, { maxWidth: '760px' });
        if (!modal) return;
        if (!itemTemplate) {
            Logger.error('SlideshowMenu: templates not found');
            modal.close();
            return;
        }

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
        const audioTrimSection = modalContent.querySelector('.slideshow-audio-trim');
        const audioStartSlider = modalContent.querySelector('.slideshow-audio-start');
        const audioEndSlider = modalContent.querySelector('.slideshow-audio-end');
        const rangeFill = modalContent.querySelector('.slideshow-range-fill');
        const trimTimes = modalContent.querySelector('.slideshow-trim-times');
        const startLabel = modalContent.querySelector('.slideshow-audio-start-label');
        const endLabel = modalContent.querySelector('.slideshow-audio-end-label');
        const audioPlayBtn = modalContent.querySelector('.slideshow-audio-play');
        const playIcon = modalContent.querySelector('.slideshow-play-icon');

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
        let audioDuration = 0;
        let previewNode = null;
        let previewCtx = null;
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

        // --- Audio trim helpers ---
        const fmtTime = (s) => {
            const m = Math.floor(s / 60);
            return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
        };

        const updateTrimUI = () => {
            const start = parseFloat(audioStartSlider.value);
            const end = parseFloat(audioEndSlider.value);
            const max = audioDuration || 1;
            rangeFill.style.left = `${(start / max) * 100}%`;
            rangeFill.style.width = `${((end - start) / max) * 100}%`;
            startLabel.textContent = fmtTime(start);
            endLabel.textContent = fmtTime(end);
            trimTimes.textContent = `${fmtTime(start)} – ${fmtTime(end)}`;
        };

        const stopPreview = () => {
            if (previewNode) {
                try { previewNode.stop(); } catch (_) {}
                previewNode = null;
            }
            playIcon.setAttribute('href', 'assets/icons/sprite.svg#icon-play');
        };

        audioStartSlider.addEventListener('input', () => {
            const start = parseFloat(audioStartSlider.value);
            const end = parseFloat(audioEndSlider.value);
            if (start >= end) audioEndSlider.value = Math.min(start + 0.1, audioDuration);
            updateTrimUI();
            stopPreview();
        });

        audioEndSlider.addEventListener('input', () => {
            const start = parseFloat(audioStartSlider.value);
            const end = parseFloat(audioEndSlider.value);
            if (end <= start) audioStartSlider.value = Math.max(end - 0.1, 0);
            updateTrimUI();
            stopPreview();
        });

        audioPlayBtn.addEventListener('click', async () => {
            if (previewNode) {
                stopPreview();
                return;
            }
            if (!musicFile) return;
            try {
                previewCtx = previewCtx || new AudioContext();
                if (previewCtx.state === 'suspended') await previewCtx.resume();
                const arrayBuffer = await musicFile.arrayBuffer();
                const audioBuffer = await previewCtx.decodeAudioData(arrayBuffer);
                const start = parseFloat(audioStartSlider.value);
                const end = parseFloat(audioEndSlider.value);
                previewNode = previewCtx.createBufferSource();
                previewNode.buffer = audioBuffer;
                previewNode.connect(previewCtx.destination);
                previewNode.start(0, start, end - start);
                playIcon.setAttribute('href', 'assets/icons/sprite.svg#icon-pause');
                previewNode.onended = () => {
                    previewNode = null;
                    playIcon.setAttribute('href', 'assets/icons/sprite.svg#icon-play');
                };
            } catch (e) {
                Logger.warn('[SlideshowMenu] Audio preview failed:', e);
            }
        });

        // --- Music ---
        musicInput.addEventListener('change', async () => {
            if (!musicInput.files.length) return;
            musicFile = musicInput.files[0];
            musicName.textContent = musicFile.name;
            musicClear.classList.remove('hidden');
            stopPreview();

            // Decode to get duration, then show trim UI
            try {
                const ctx = new AudioContext();
                const buf = await ctx.decodeAudioData(await musicFile.arrayBuffer());
                audioDuration = buf.duration;
                await ctx.close();
                const max = audioDuration.toFixed(2);
                audioStartSlider.max = max;
                audioEndSlider.max = max;
                audioStartSlider.value = 0;
                audioEndSlider.value = max;
                updateTrimUI();
                audioTrimSection.classList.remove('hidden');
            } catch (e) {
                Logger.warn('[SlideshowMenu] Could not decode audio for trim:', e);
                audioTrimSection.classList.add('hidden');
            }
        });
        musicClear.addEventListener('click', () => {
            musicFile = null;
            audioDuration = 0;
            musicInput.value = '';
            musicName.textContent = 'No file selected';
            musicClear.classList.add('hidden');
            audioTrimSection.classList.add('hidden');
            stopPreview();
        });

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
                const audioStartTime = audioBlob ? parseFloat(audioStartSlider.value) : 0;
                const audioEndTime = audioBlob ? parseFloat(audioEndSlider.value) : null;

                stopPreview();

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
                        audioStartTime,
                        audioEndTime,
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
            stopPreview();
            if (previewCtx) { previewCtx.close().catch(() => {}); previewCtx = null; }
            for (const url of objectUrls) {
                try { URL.revokeObjectURL(url); } catch (_) { /* ignore */ }
            }
        });
    }
}
