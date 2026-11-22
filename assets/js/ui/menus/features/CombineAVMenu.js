import { Modal } from '../../Modal.js';
import { MediaProcessor } from '../../../processing/MediaProcessor.js';
import { MediaMetadata } from '../../../shared/utils/MediaMetadata.js';
import { runMenuJob } from '../core/MenuJob.js';
import { installTemplates } from '../core/Templates.js';
import combineAvTemplates from '../templates/combine-av.html?raw';

installTemplates(combineAvTemplates);

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

            // The button stays locked after a success, so the same pair is
            // not combined twice.
            combineBtn.disabled = true;
            combineBtn.innerHTML = '<span class="spinner-sm border-2 border-current border-t-transparent rounded-full w-4 h-4 animate-spin mr-xs"></span> Combining...';

            const outcome = await runMenuJob({
                name: 'Combine A/V',
                subject: videoItem.title,
                background: true,
                modal,
                work: async ({ signal, onProgress }) => {
                    const videoBlob = await MediaMetadata.getSourceBlob(videoItem, () => playlist.save());
                    const audioBlob = await MediaMetadata.getSourceBlob(audioItem, () => playlist.save());
                    return MediaProcessor.combineAudioVideo({
                        videoSource: videoBlob,
                        audioSource: audioBlob,
                        format,
                        onProgress,
                        signal,
                    });
                },
                done: async (combinedBlob) => {
                    // The dialog is closed by now (a background job); the
                    // result goes in after the video, and the job tray
                    // offers it (download, edit).
                    const anchor = videoItem;
                    const filename = `combined-${new Date().toISOString().replace(/[:.]/g, '-')}.${format}`;
                    const basePath = anchor?.path || anchor?.title || '';
                    const parentPath = basePath.includes('/') ? basePath.substring(0, basePath.lastIndexOf('/')) : '';
                    const { item: newItem } = playlist.insertProcessedItem(anchor, combinedBlob, filename, {
                        type: `video/${format}`,
                        duration: null,
                        extra: { path: parentPath ? `${parentPath}/${filename}` : filename },
                    });
                    await playlist.ensureMetadata(newItem);
                },
            });
            if (!outcome.ok) {
                combineBtn.disabled = false;
                combineBtn.innerHTML = '<span class="mr-xs">Combine</span><svg width="16" height="16" fill="currentColor"><use href="assets/icons/sprite.svg#icon-audio"></use></svg>';
            }
        });
    }
}
