import { Logger } from "../../../shared/utils/Logger.js";
import { MediaProcessor } from '../../../processing/MediaProcessor.js';
import { CustomDropdown } from '../../../shared/utils/CustomDropdown.js';
import { openProcessMenu, FOOTER_CONFIGS } from '../core/MenuFactory.js';
import { decodeAudioRange, getAudioDuration } from '../../../shared/media/AudioHelpers.js';
import { runMenuJob } from '../core/MenuJob.js';

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
        const errorMessage = modalContent.querySelector('.error-message');

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
                try { previewNode.stop(); } catch { /* the preview already ended */ }
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
                const start = parseFloat(audioStartSlider.value);
                const end = parseFloat(audioEndSlider.value);
                // Only the trimmed range is decoded, not the whole song.
                const audioBuffer = await decodeAudioRange(musicFile, start, end);
                if (!audioBuffer) return;
                previewNode = previewCtx.createBufferSource();
                previewNode.buffer = audioBuffer;
                previewNode.connect(previewCtx.destination);
                previewNode.start(0);
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

            // Read the duration from the file, then show trim UI
            try {
                audioDuration = await getAudioDuration(musicFile);
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

                await runMenuJob({
                    name: 'Slideshow',
                    subject: `${imageBlobs.length} images`,
                    background: true,
                    modal,
                    work: ({ signal, onProgress }) => MediaProcessor.createSlideshowVideo({
                        imageBlobs,
                        imageDurations,
                        transition,
                        transitionDuration,
                        audioBlob,
                        audioLoop: true,
                        audioStartTime,
                        audioEndTime,
                        fps,
                        onProgress: (p) => onProgress(p, p < 0.9 ? 'Rendering frames...' : 'Finalizing...'),
                        signal,
                    }),
                    done: async (outputBlob) => {
                        const filename = `slideshow-${transition}-${Date.now()}.mp4`;
                        const { item: newItem } = playlist.insertProcessedItem(null, outputBlob, filename, {
                            mediaType: 'video/mp4',
                            extra: { path: `Slideshow/${filename}` }
                        });
                        await playlist.ensureMetadata(newItem);
                    },
                });
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
