import { Logger } from "../../../shared/utils/Logger.js";
import { Modal } from '../../Modal.js';
import { MediaProcessor } from '../../../core/MediaProcessor.js';
import { MediaMetadata } from '../../../shared/utils/MediaMetadata.js';
import { generateId } from '../../../shared/utils/mediaUtils.js';

/**
 * Combine Audio/Video Menu Handler
 * Muxes the video track of one playlist item with the audio track of another,
 * without re-encoding either stream (Mediabunny composable conversions).
 */
export class CombineAVMenu {
    /**
     * Initialize and open Combine Audio/Video modal
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(playlist) {
        const contentTemplate = document.getElementById('combine-av-modal-content-template');
        const footerTemplate = document.getElementById('combine-av-modal-footer-template');

        if (!contentTemplate || !footerTemplate) return;

        const modal = new Modal({ maxWidth: '520px' });
        modal.setTitle('Combine Audio/Video');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));

        const modalContent = modal.modal;
        const videoSelect = modalContent.querySelector('.combine-video-select');
        const audioSelect = modalContent.querySelector('.combine-audio-select');
        const formatSelect = modalContent.querySelector('.combine-format-select');
        const combineBtn = modalContent.querySelector('.combine-btn');
        const emptyState = modalContent.querySelector('.combine-empty-state');

        const isStreamOrLive = (item) => {
            if (item.isStream || item.isLive) return false;
            if (item.url && (item.url.includes('.m3u8') || item.url.includes('/hls/'))) return false;
            return true;
        };

        const isValidVideo = (item) => {
            if (!isStreamOrLive(item)) return false;
            if (item.isAudio) return false;
            const itemType = item.type || item.mimeType || item.fileType || '';
            if (itemType.startsWith('audio')) return false;
            const filename = item.title || item.path || item.url || '';
            if (/\.(mp3|wav|flac|aac|ogg|m4a|opus|wma)$/i.test(filename)) return false;
            return true;
        };

        const playableItems = playlist.items.filter(isStreamOrLive);
        const videoItems = playlist.items.filter(isValidVideo);

        if (playableItems.length < 2 || videoItems.length === 0) {
            emptyState.classList.remove('hidden');
            combineBtn.setAttribute('disabled', 'true');
        } else {
            emptyState.classList.add('hidden');
        }

        const populateSelect = (select, items) => {
            select.innerHTML = '';
            items.forEach((item, idx) => {
                const option = document.createElement('option');
                option.value = String(idx);
                option.textContent = item.path || item.title;
                select.appendChild(option);
            });
        };

        populateSelect(videoSelect, videoItems);
        populateSelect(audioSelect, playableItems);
        videoSelect._items = videoItems;
        audioSelect._items = playableItems;

        const updateUI = () => {
            const ready = videoItems.length > 0 && playableItems.length > 0;
            combineBtn.disabled = !ready;
        };
        updateUI();

        modal.open();

        combineBtn.addEventListener('click', async () => {
            const videoItem = videoItems[parseInt(videoSelect.value, 10)];
            const audioItem = playableItems[parseInt(audioSelect.value, 10)];
            if (!videoItem || !audioItem) return;

            const format = formatSelect.value;

            videoSelect.disabled = true;
            audioSelect.disabled = true;
            formatSelect.disabled = true;
            combineBtn.disabled = true;
            combineBtn.innerHTML = '<span class="spinner-sm border-2 border-current border-t-transparent rounded-full w-4 h-4 animate-spin mr-xs"></span> Combining...';

            const progressSection = modalContent.querySelector('.progress-section');
            const progressText = progressSection.querySelector('.progress-percentage');
            const errorMsg = modalContent.querySelector('.error-message');
            const successMsg = modalContent.querySelector('.success-message');
            const downloadBtn = modalContent.querySelector('.download-btn');

            progressSection.classList.remove('hidden');
            errorMsg.classList.add('hidden');
            successMsg.classList.add('hidden');

            try {
                const videoBlob = await MediaMetadata.getSourceBlob(videoItem, () => playlist._saveState());
                const audioBlob = await MediaMetadata.getSourceBlob(audioItem, () => playlist._saveState());

                const combinedBlob = await MediaProcessor.combineAudioVideo({
                    videoSource: videoBlob,
                    audioSource: audioBlob,
                    format,
                    onProgress: (progress) => {
                        progressText.textContent = `${Math.round(progress * 100)}%`;
                    }
                });

                progressSection.classList.add('hidden');
                successMsg.textContent = '✓ Added to playlist';
                successMsg.classList.remove('hidden');

                combineBtn.innerHTML = '<span>Added</span><svg width="16" height="16" fill="currentColor" class="ml-xs"><use href="assets/icons/sprite.svg#icon-check"></use></svg>';

                const url = URL.createObjectURL(combinedBlob);
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const filename = `combined-${timestamp}.${format}`;

                downloadBtn.href = url;
                downloadBtn.download = filename;
                downloadBtn.classList.remove('hidden');

                const basePath = videoItem?.path || videoItem?.title || '';
                const parentPath = basePath.includes('/') ? basePath.substring(0, basePath.lastIndexOf('/')) : '';

                const newItem = {
                    title: filename,
                    url,
                    duration: '...',
                    thumbnail: '',
                    isLocal: true,
                    file: new File([combinedBlob], filename, { type: `video/${format}` }),
                    id: generateId(),
                    path: parentPath ? `${parentPath}/${filename}` : filename
                };

                const lastIndex = playlist.items.indexOf(videoItem);
                if (lastIndex !== -1) {
                    playlist.items.splice(lastIndex + 1, 0, newItem);
                } else {
                    playlist.items.push(newItem);
                }

                playlist._saveState();
                playlist.render();
                playlist._processMetadata([newItem]);

            } catch (e) {
                Logger.error('Combine Audio/Video failed:', e);
                progressSection.classList.add('hidden');
                errorMsg.textContent = `Combine failed: ${e.message}`;
                errorMsg.classList.remove('hidden');

                videoSelect.disabled = false;
                audioSelect.disabled = false;
                formatSelect.disabled = false;
                combineBtn.disabled = false;
                combineBtn.innerHTML = '<span class="mr-xs">Combine</span><svg width="16" height="16" fill="currentColor"><use href="assets/icons/sprite.svg#icon-audio"></use></svg>';
            }
        });
    }
}
