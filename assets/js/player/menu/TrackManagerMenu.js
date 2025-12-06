import { Modal } from '../Modal.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { generateId } from '../../utils/mediaUtils.js';

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
        if (!template) return;

        const modal = new Modal({ maxWidth: '700px' });
        modal.setTitle('Video & Audio Tracks');
        modal.setBody(template.content.cloneNode(true));

        const modalContent = modal.modal;

        // Populate Source Info
        const sourceFilename = modalContent.querySelector('.source-filename');
        sourceFilename.textContent = `Source: ${item.title}`;

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

            this.renderTracks(tracks, item, modalContent, playlist);
        } catch (e) {
            console.error('Failed to load tracks:', e);

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
                    console.log(`[TrackManagerMenu] Removed unavailable item: ${item.title}`);
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
     * @param {HTMLElement} modal 
     * @param {Playlist} playlist
     * @private
     */
    static renderTracks(tracks, item, modal, playlist) {
        const videoList = modal.querySelector('.video-track-list');
        const audioList = modal.querySelector('.audio-track-list');
        const videoCount = modal.querySelector('.video-tracks-section .track-count');
        const audioCount = modal.querySelector('.audio-tracks-section .track-count');
        const noVideoMsg = modal.querySelector('.video-tracks-section .no-tracks-message');
        const noAudioMsg = modal.querySelector('.audio-tracks-section .no-tracks-message');

        videoCount.textContent = tracks.video.length;
        audioCount.textContent = tracks.audio.length;

        if (tracks.video.length === 0) noVideoMsg.classList.remove('hidden');
        if (tracks.audio.length === 0) noAudioMsg.classList.remove('hidden');

        const cardTemplate = document.getElementById('track-card-template');

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
                const progressContainer = el.querySelector('.progress-container');

                // Determine format based on codec
                let format = 'mp4';
                if (type === 'audio') {
                    const codec = (track.codec || '').toLowerCase();
                    if (codec.includes('mp3')) {
                        format = 'mp3';
                    } else if (codec.includes('aac') || codec.includes('mp4a')) {
                        format = 'aac';
                    } else if (codec.includes('pcm') || codec === '') {
                        format = 'wav';
                    } else {
                        format = 'm4a';
                    }
                }

                downloadBtn.addEventListener('click', () => {
                    this.extractTrack(playlist.items.indexOf(item), i, type, format, false, progressContainer, downloadBtn, addToPlaylistBtn, playlist);
                });

                addToPlaylistBtn.addEventListener('click', () => {
                    // Duplicate Check
                    const ext = format;
                    const newFilename = `${item.title.replace(/\.[^/.]+$/, "")}-${type}-track${i + 1}.${ext}`;

                    const exists = playlist.items.some(it => it.title === newFilename);
                    if (exists) {
                        alert(`Track "${newFilename}" is already in the playlist.`);
                        return;
                    }

                    this.extractTrack(playlist.items.indexOf(item), i, type, format, true, progressContainer, downloadBtn, addToPlaylistBtn, playlist);
                });

                trackList.appendChild(el);
            });
        };

        renderList(tracks.video, videoList, 'video');
        renderList(tracks.audio, audioList, 'audio');
    }

    /**
     * Extract track
     * @param {number} index 
     * @param {number} trackIndex 
     * @param {string} trackType 
     * @param {string} format
     * @param {boolean} addToPlaylist 
     * @param {HTMLElement} progressContainer 
     * @param {HTMLElement} downloadBtn 
     * @param {HTMLElement} addToPlaylistBtn
     * @param {Playlist} playlist
     * @private
     */
    static async extractTrack(index, trackIndex, trackType, format, addToPlaylist, progressContainer, downloadBtn, addToPlaylistBtn, playlist) {
        const item = playlist.items[index];

        // UI State
        downloadBtn.classList.add('hidden');
        addToPlaylistBtn.classList.add('hidden');
        progressContainer.classList.remove('hidden');

        try {
            // Get source with caching
            const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());

            const blob = await MediaProcessor.extractTrack({
                source,
                trackIndex,
                trackType,
                format,
                onProgress: (p) => {
                    // Optional: Update progress text
                }
            });

            this.handleExtractionSuccess(blob, item, trackType, trackIndex, format, addToPlaylist, playlist);
        } catch (e) {
            console.error('Extraction failed:', e);
            alert(`Extraction failed: ${e.message}`);
        } finally {
            downloadBtn.classList.remove('hidden');
            addToPlaylistBtn.classList.remove('hidden');
            progressContainer.classList.add('hidden');
        }
    }

    /**
     * Handle extraction success
     * @param {Blob} blob 
     * @param {Object} originalItem 
     * @param {string} trackType 
     * @param {number} trackIndex 
     * @param {string} format
     * @param {boolean} addToPlaylist 
     * @param {Playlist} playlist
     * @private
     */
    static handleExtractionSuccess(blob, originalItem, trackType, trackIndex, format, addToPlaylist, playlist) {
        const ext = format;
        const newFilename = `${originalItem.title.replace(/\.[^/.]+$/, "")}-${trackType}-track${trackIndex + 1}.${ext}`;
        const url = URL.createObjectURL(blob);

        if (addToPlaylist) {
            const newItem = {
                id: generateId(),
                title: newFilename,
                url: url,
                file: new File([blob], newFilename, { type: blob.type }),
                duration: originalItem.duration,
                type: trackType === 'video' ? 'video' : 'audio',
                isAudioOnly: trackType === 'audio'
            };

            // Insert after original item
            const index = playlist.items.indexOf(originalItem);
            playlist.items.splice(index + 1, 0, newItem);

            // Re-render playlist
            playlist.render();

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
        }
    }
}
