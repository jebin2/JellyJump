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

            // Format FPS and Bitrate
            let fps = 'Unknown';
            let bitrate = 'Unknown';

            if (item.videoInfo) {
                if (item.videoInfo.fps) {
                    fps = `${item.videoInfo.fps} fps`;
                }
                if (item.videoInfo.bitrate) {
                    bitrate = `${(item.videoInfo.bitrate / 1000000).toFixed(1)} Mbps`;
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
                fps: fps,
                videoBitrate: bitrate,
                rotation: item.videoInfo ? `${item.videoInfo.rotation}°` : 'N/A',
                hdr: item.videoInfo ? (item.videoInfo.hasHDR ? 'Yes' : 'No') : 'N/A',

                // Audio from cached data
                audioCodec: item.audioInfo ? item.audioInfo.codec.toUpperCase() : 'N/A',
                audioCodecString: item.audioInfo ? item.audioInfo.codec : 'N/A',
                channels: item.audioInfo ? (item.audioInfo.channels === 2 ? 'Stereo (2)' : `${item.audioInfo.channels} Channels`) : 'N/A',
                sampleRate: item.audioInfo ? `${(item.audioInfo.sampleRate / 1000).toFixed(1)} kHz` : 'N/A',
                language: item.audioInfo ? (item.audioInfo.languageCode === 'und' ? 'Undetermined' : item.audioInfo.languageCode) : 'N/A'
            };

            // Hide loading, show content
            if (loadingEl) loadingEl.classList.add('hidden');
            if (contentEl) contentEl.classList.remove('hidden');

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
