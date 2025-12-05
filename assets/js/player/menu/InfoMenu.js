import { Modal } from '../Modal.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';

/**
 * Info Menu Handler
 * Displays video metadata information
 */
export class InfoMenu {
    /**
     * Initialize and open Video Info modal
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(item, playlist) {
        const contentTemplate = document.getElementById('info-content-template');
        const footerTemplate = document.getElementById('info-footer-template');

        if (!contentTemplate) return;

        const modal = new Modal({ maxWidth: '600px' });
        modal.setTitle('Video Information');
        modal.setBody(contentTemplate.content.cloneNode(true));

        if (footerTemplate) {
            modal.setFooter(footerTemplate.content.cloneNode(true));
        }

        const modalContent = modal.modal;

        // Elements
        const loadingEl = modalContent.querySelector('.info-loading');
        const contentEl = modalContent.querySelector('.info-modal-content');
        const copyBtns = modalContent.querySelectorAll('.copy-btn');
        const copyAllBtn = modalContent.querySelector('.copy-all-btn');

        modal.open();

        // Load Metadata
        try {
            // Ensure metadata is cached
            await playlist._ensureMetadata(item);

            let videoTrack = null;

            // Build metadata from cached data
            const formatBytes = (bytes, decimals = 1) => {
                if (bytes === 0) return '0 Bytes';
                const k = 1024;
                const dm = decimals < 0 ? 0 : decimals;
                const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
                const i = Math.floor(Math.log(bytes) / Math.log(k));
                return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
            };

            // Get file size
            let fileSize = '0 Bytes';
            if (item.file) {
                fileSize = formatBytes(item.file.size);
            } else if (item.url) {
                try {
                    const response = await fetch(item.url, { method: 'HEAD' });
                    const size = response.headers.get('content-length');
                    if (size) fileSize = formatBytes(parseInt(size));
                } catch (e) {
                    fileSize = 'Unknown';
                }
            }

            const metadata = {
                filename: item.title,
                format: item.file ? item.file.type.split('/')[0] : 'Unknown',
                mimeType: item.file ? item.file.type : 'Unknown',
                size: fileSize,
                duration: item.duration || 'Unknown',

                // Video from cached data
                videoCodec: item.videoInfo ? item.videoInfo.codec.toUpperCase() : 'N/A',
                videoCodecString: item.videoInfo ? item.videoInfo.codec : 'N/A',
                resolution: item.videoInfo ? `${item.videoInfo.width}x${item.videoInfo.height}` : 'N/A',
                codedResolution: item.videoInfo ? `${item.videoInfo.codedWidth}x${item.videoInfo.codedHeight}` : 'N/A',
                fps: 'Calculating...', // Will be updated with packet stats
                videoBitrate: 'Calculating...',
                rotation: item.videoInfo ? `${item.videoInfo.rotation}°` : 'N/A',
                hdr: item.videoInfo ? (item.videoInfo.hasHDR ? 'Yes' : 'No') : 'N/A',

                // Audio from cached data
                audioCodec: item.audioInfo ? item.audioInfo.codec.toUpperCase() : 'N/A',
                audioCodecString: item.audioInfo ? item.audioInfo.codec : 'N/A',
                channels: item.audioInfo ? (item.audioInfo.channels === 2 ? 'Stereo (2)' : `${item.audioInfo.channels} Channels`) : 'N/A',
                sampleRate: item.audioInfo ? `${(item.audioInfo.sampleRate / 1000).toFixed(1)} kHz` : 'N/A',
                language: item.audioInfo ? (item.audioInfo.languageCode === 'und' ? 'Undetermined' : item.audioInfo.languageCode) : 'N/A'
            };

            // For packet stats, we still need to get the video track
            if (item.videoInfo && item.file) {
                try {
                    const tracks = await MediaProcessor.getTracks(item.file);
                    videoTrack = tracks.video ? tracks.video[0] : null;
                } catch (e) {
                    console.warn('Could not get video track for packet stats:', e);
                }
            }

            // Hide loading, show content
            loadingEl.classList.add('hidden');
            contentEl.classList.remove('hidden');

            // Populate UI
            Object.keys(metadata).forEach(key => {
                const el = modalContent.querySelector(`[data-key="${key}"]`);
                if (el) {
                    el.textContent = metadata[key];
                    // Update copy button data
                    const btn = el.parentElement.querySelector('.copy-btn');
                    if (btn) btn.dataset.value = metadata[key];
                }
            });

            // Store raw metadata for "Copy All"
            modal.body.dataset.rawInfo = JSON.stringify(metadata);

            // Async update for stats
            if (videoTrack) {
                videoTrack.computePacketStats(50).then(stats => {
                    // Re-fetch elements as they are in the DOM now
                    const fpsEl = modalContent.querySelector('.info-value[data-key="fps"]');
                    const bitrateEl = modalContent.querySelector('.info-value[data-key="videoBitrate"]');

                    // Update metadata object
                    const currentMetadata = JSON.parse(modal.body.dataset.rawInfo || '{}');

                    if (fpsEl) {
                        const fps = Math.round(stats.averagePacketRate);
                        const fpsText = `${fps} fps`;
                        fpsEl.textContent = fpsText;

                        // Update copy button
                        const btn = fpsEl.parentElement.querySelector('.copy-btn');
                        if (btn) btn.dataset.value = fpsText;

                        currentMetadata.fps = fpsText;
                    }

                    if (bitrateEl) {
                        const bitrate = (stats.averageBitrate / 1000000).toFixed(1);
                        const bitrateText = `${bitrate} Mbps`;
                        bitrateEl.textContent = bitrateText;

                        // Update copy button
                        const btn = bitrateEl.parentElement.querySelector('.copy-btn');
                        if (btn) btn.dataset.value = bitrateText;

                        currentMetadata.videoBitrate = bitrateText;
                    }

                    // Update raw info for copy all
                    modal.body.dataset.rawInfo = JSON.stringify(currentMetadata);

                }).catch(console.error);
            }

        } catch (e) {
            console.error('Failed to load video info:', e);
            // Show error or partial content
            if (loadingEl) loadingEl.classList.add('hidden');
            if (contentEl) contentEl.classList.remove('hidden');
        }

        // Event Listeners

        // Copy Single Value
        copyBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const value = btn.dataset.value;
                if (value) {
                    try {
                        await navigator.clipboard.writeText(value);
                        playlist._showToast('Copied to clipboard!');
                    } catch (err) {
                        console.error('Failed to copy:', err);
                    }
                }
            });
        });

        // Copy All
        if (copyAllBtn) {
            copyAllBtn.addEventListener('click', async () => {
                try {
                    // Retrieve from where we stored it
                    const metadata = JSON.parse(modal.body.dataset.rawInfo || '{}');
                    const text = `Video Information
-----------------
Filename: ${metadata.filename}
Format: ${metadata.format}
MIME Type: ${metadata.mimeType}
Size: ${metadata.size}
Duration: ${metadata.duration}

Video Stream
------------
Codec: ${metadata.videoCodec} (${metadata.videoCodecString})
Resolution: ${metadata.resolution} (Coded: ${metadata.codedResolution})
Frame Rate: ${metadata.fps}
Bitrate: ${metadata.videoBitrate}
Rotation: ${metadata.rotation}
HDR: ${metadata.hdr}

Audio Stream
------------
Codec: ${metadata.audioCodec} (${metadata.audioCodecString})
Channels: ${metadata.channels}
Sample Rate: ${metadata.sampleRate}
Language: ${metadata.language}
`;
                    await navigator.clipboard.writeText(text);
                    playlist._showToast('All info copied to clipboard!');
                } catch (err) {
                    console.error('Failed to copy all:', err);
                }
            });
        }
    }
}
