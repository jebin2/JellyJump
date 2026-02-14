import { Logger } from "../../utils/Logger.js";
import { Modal } from '../Modal.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { generateId } from '../../utils/mediaUtils.js';
import { CustomDropdown } from '../../utils/CustomDropdown.js';

/**
 * Track Manager Menu Handler
 * Handles video/audio track extraction and management
 */
export class TrackManagerMenu {
    /**
     * Initialize and open Track Manager modal
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(item, playlist) {
        const template = document.getElementById('track-management-content-template');
        const footerTemplate = document.getElementById('track-management-footer-template');
        if (!template || !footerTemplate) return;

        const modal = new Modal({ maxWidth: '700px' });
        modal.setTitle('Video & Audio Tracks');
        modal.setBody(template.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));

        const modalContent = modal.modal;

        // Populate Source Info
        const sourceFilename = modalContent.querySelector('.source-filename');
        sourceFilename.textContent = `Source: ${item.title}`;

        // Close button in footer
        const closeBtn = modal.querySelector('.mb-modal-close-btn');
        if (closeBtn) closeBtn.addEventListener('click', () => modal.close());

        modal.open();

        // Fetch Tracks
        try {
            // Ensure metadata (including tracks) is loaded/cached
            await playlist._ensureMetadata(item);

            // Hide loading, show content
            modalContent.querySelector('.tracks-loading').classList.add('hidden');
            modalContent.querySelector('.tracks-content').classList.remove('hidden');

            // Use cached tracks
            const tracks = {
                video: item.videoTracks || [],
                audio: item.audioTracks || []
            };

            this.renderTracks(tracks, item, modalContent, playlist, modal);
        } catch (e) {
            Logger.error('Failed to load tracks:', e);

            // Check if this is a "no source" error (file missing from IndexedDB and no URL)
            if (e.message && e.message.includes('No source available')) {
                modal.close();

                // Show user-friendly popup
                alert(`The file "${item.title}" is no longer available and will be removed from the playlist.\n\nThis can happen when the browser cache is cleared or the file was not properly saved.`);

                // Remove the item from playlist
                const itemIndex = playlist.items.indexOf(item);
                if (itemIndex !== -1) {
                    playlist.items.splice(itemIndex, 1);
                    playlist.render();
                    playlist._saveState();
                    Logger.log(`[TrackManagerMenu] Removed unavailable item: ${item.title}`);
                }
                return;
            }

            modalContent.querySelector('.tracks-loading').classList.add('hidden');
            modalContent.querySelector('.mb-modal-body').insertAdjacentHTML('beforeend', `<div class="p-md text-danger">Failed to load tracks: ${e.message}</div>`);
        }
    }

    /**
     * Render tracks in the modal
     * @param {Object} tracks 
     * @param {Object} item 
     * @param {HTMLElement} modalContent 
     * @param {Playlist} playlist
     * @param {Modal} modalInstance
     * @private
     */
    static renderTracks(tracks, item, modalContent, playlist, modalInstance) {
        const videoList = modalContent.querySelector('.video-track-list');
        const audioList = modalContent.querySelector('.audio-track-list');
        const videoCount = modalContent.querySelector('.video-tracks-section .track-count');
        const audioCount = modalContent.querySelector('.audio-tracks-section .track-count');
        const noVideoMsg = modalContent.querySelector('.video-tracks-section .no-tracks-message');
        const noAudioMsg = modalContent.querySelector('.audio-tracks-section .no-tracks-message');

        videoCount.textContent = tracks.video.length;
        audioCount.textContent = tracks.audio.length;

        if (tracks.video.length === 0) noVideoMsg.classList.remove('hidden');
        if (tracks.audio.length === 0) noAudioMsg.classList.remove('hidden');

        const cardTemplate = document.getElementById('track-card-template');
        const dropdowns = [];

        const renderList = (list, trackList, type) => {
            list.forEach((track, i) => {
                const card = cardTemplate.content.cloneNode(true);
                const el = card.querySelector('.track-card');

                el.querySelector('.track-index').textContent = i + 1;
                el.querySelector('.meta-codec').textContent = track.codecString || track.codec || 'Unknown';
                el.querySelector('.meta-language').textContent = track.language || 'und';

                let details = '';
                if (type === 'video') {
                    details = `${track.width}x${track.height}`;
                } else {
                    details = `${track.channels}ch, ${track.sampleRate}Hz`;
                }
                el.querySelector('.meta-details').textContent = details;

                // Events
                const downloadBtn = el.querySelector('.download-track-btn');
                const addToPlaylistBtn = el.querySelector('.add-to-playlist-btn');

                // Speed dropdown (using custom dropdown utility)
                const speedBtn = el.querySelector('[data-speed-btn]');
                const speedMenu = el.querySelector('[data-speed-menu]');
                const speedDropdown = CustomDropdown.init({
                    button: speedBtn,
                    menu: speedMenu,
                    initialValue: '1'
                });
                dropdowns.push(speedDropdown);

                // Determine format based on codec
                let format = 'mp4';
                if (type === 'audio') {
                    const codec = (track.codec || '').toLowerCase();
                    if (codec.includes('mp3')) {
                        format = 'mp3';
                    } else if (codec.includes('aac') || codec.includes('mp4a')) {
                        format = 'm4a';
                    } else if (codec.includes('pcm') || codec === '') {
                        format = 'wav';
                    } else {
                        format = 'm4a';
                    }
                }

                downloadBtn.addEventListener('click', () => {
                    this.extractTrack({
                        index: playlist.items.indexOf(item),
                        trackIndex: i,
                        trackType: type,
                        format: format,
                        addToPlaylist: false,
                        speed: parseFloat(speedDropdown.getValue()),
                        modalInstance,
                        speedDropdown,
                        playlist
                    });
                });

                addToPlaylistBtn.addEventListener('click', () => {
                    const speed = parseFloat(speedDropdown.getValue());
                    const ext = format;
                    const speedSuffix = speed !== 1 ? `-${speed}x` : '';
                    const newFilename = `${item.title.replace(/\.[^/.]+$/, "")}-${type}-track${i + 1}${speedSuffix}.${ext}`;

                    const exists = playlist.items.some(it => it.title === newFilename);
                    if (exists) {
                        alert(`Track "${newFilename}" is already in the playlist.`);
                        return;
                    }

                    this.extractTrack({
                        index: playlist.items.indexOf(item),
                        trackIndex: i,
                        trackType: type,
                        format: format,
                        addToPlaylist: true,
                        speed: parseFloat(speedDropdown.getValue()),
                        modalInstance,
                        speedDropdown,
                        playlist
                    });
                });

                trackList.appendChild(el);
            });
        };

        renderList(tracks.video, videoList, 'video');
        renderList(tracks.audio, audioList, 'audio');

        // Register dropdown cleanup on modal close
        modalInstance.onCleanup(() => {
            dropdowns.forEach(d => d.destroy());
        });
    }

    /**
     * Extract track
     * @param {Object} options
     * @private
     */
    static async extractTrack({ index, trackIndex, trackType, format, addToPlaylist, speed, modalInstance, speedDropdown, playlist }) {
        const item = playlist.items[index];
        const modal = modalInstance.modal;

        // UI Elements from Footer
        const progressSection = modal.querySelector('.progress-section');
        const progressPercentage = modal.querySelector('.progress-percentage');
        const progressStatus = modal.querySelector('.progress-status');
        const successMessage = modal.querySelector('.success-message');
        const errorMessage = modal.querySelector('.error-message');

        // Disable UI
        modal.querySelectorAll('button').forEach(btn => btn.disabled = true);
        if (speedDropdown) speedDropdown.setDisabled(true);

        // Hide previous messages and show progress
        errorMessage.classList.add('hidden');
        successMessage.classList.add('hidden');
        progressSection.classList.remove('hidden');
        progressPercentage.textContent = '0%';
        progressStatus.textContent = 'Extracting...';

        try {
            // Get source with caching
            const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());

            const blob = await MediaProcessor.extractTrack({
                source,
                trackIndex,
                trackType,
                format,
                speed,
                onProgress: (p) => {
                    const percent = Math.round(p * 100) + '%';
                    progressPercentage.textContent = percent;
                }
            });

            this.handleExtractionSuccess({
                blob,
                originalItem: item,
                trackType,
                trackIndex,
                format,
                addToPlaylist,
                speed,
                playlist,
                modal
            });
        } catch (e) {
            Logger.error('Extraction failed:', e);
            errorMessage.textContent = `Extraction failed: ${e.message}`;
            errorMessage.classList.remove('hidden');
            progressSection.classList.add('hidden');
        } finally {
            modal.querySelectorAll('button').forEach(btn => btn.disabled = false);
            if (speedDropdown) speedDropdown.setDisabled(false);
        }
    }

    /**
     * Handle extraction success
     * @param {Object} options
     * @private
     */
    static handleExtractionSuccess({ blob, originalItem, trackType, trackIndex, format, addToPlaylist, speed, playlist, modal }) {
        const ext = format;
        const speedSuffix = speed !== 1 ? `-${speed}x` : '';
        const newFilename = `${originalItem.title.replace(/\.[^/.]+$/, "")}-${trackType}-track${trackIndex + 1}${speedSuffix}.${ext}`;
        const url = URL.createObjectURL(blob);

        const progressSection = modal.querySelector('.progress-section');
        const successMessage = modal.querySelector('.success-message');

        if (addToPlaylist) {
            const newItem = {
                id: generateId(),
                title: newFilename,
                url: url,
                file: new File([blob], newFilename, { type: blob.type }),
                duration: originalItem.duration,
                type: trackType === 'video' ? 'video' : 'audio',
                path: (originalItem.path || originalItem.title).includes('/') ?
                    (originalItem.path.split('/').slice(0, -1).join('/') + '/' + newFilename) :
                    (originalItem.title + '/' + newFilename),
                isAudioOnly: trackType === 'audio'
            };

            // Insert after original item
            const index = playlist.items.indexOf(originalItem);
            playlist.items.splice(index + 1, 0, newItem);

            // Re-render playlist
            playlist.render();

            // Success feedback
            successMessage.classList.remove('hidden');
            progressSection.classList.add('hidden');

            // Scroll to new item
            setTimeout(() => {
                const newEl = playlist.container.querySelector(`[data-index="${index + 1}"]`);
                if (newEl) newEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        } else {
            // Trigger Download
            const a = document.createElement('a');
            a.href = url;
            a.download = newFilename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            // Hide progress
            progressSection.classList.add('hidden');
        }
    }
}
