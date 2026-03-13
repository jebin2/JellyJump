import { Logger } from "../../utils/Logger.js";
import { Modal } from '../Modal.js';
import { MediaProcessor } from '../../core/MediaProcessor.js';
import { MediaBunny } from '../../core/MediaBunny.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';

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
            // For streams, we can't use MediaBunny to extract metadata from a file
            // So we skip ensureMetadata and populate what we know
            if (item.isStream || item.isLive) {
                const isPlaying = playlist.player && playlist.player.src === item.url;
                let resolution = 'N/A';
                let videoCodec = 'N/A';

                // If currently playing, try to get info from video element
                if (isPlaying && playlist.player.videoElement) {
                    const v = playlist.player.videoElement;
                    if (v.videoWidth) {
                        resolution = `${v.videoWidth}x${v.videoHeight}`;
                    }
                }

                const metadata = {
                    source: item.url || 'Unknown',
                    filename: item.title,
                    format: 'Stream (HLS/M3U8)',
                    mimeType: item.mimeType || 'application/vnd.apple.mpegurl',
                    size: 'N/A',
                    duration: 'LIVE',

                    // Metadata Tags
                    metaTitle: 'N/A',
                    metaArtist: 'N/A',
                    metaAlbum: 'N/A',
                    metaDate: 'N/A',
                    metaComment: 'N/A',

                    // Video
                    videoCodec: videoCodec,
                    videoCodecString: 'N/A',
                    resolution: resolution,
                    aspectRatio: 'N/A',
                    codedResolution: 'N/A',
                    fps: 'N/A',
                    frameCount: 'N/A',
                    videoBitrate: 'N/A',
                    rotation: 'N/A',
                    hdr: 'N/A',
                    colorSpace: 'N/A',
                    videoTrackCount: '',

                    // Audio
                    audioCodec: 'N/A',
                    audioCodecString: 'N/A',
                    channels: 'N/A',
                    sampleRate: 'N/A',
                    audioBitrate: 'N/A',
                    language: 'N/A',
                    audioTrackCount: ''
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

                        // Special handling for source URL title
                        if (key === 'source') {
                            el.title = metadata[key];
                        }
                    }
                });

                // Store raw metadata for "Copy All"
                modal.body.dataset.rawInfo = JSON.stringify(metadata);

                return; // Done for stream
            }

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

            // Get file size from cached metadata or fetch from URL
            let fileSize = 'Unknown';
            if (item.fileSize) {
                // Use cached file size (works even after item.file is released from memory)
                fileSize = formatBytes(item.fileSize);
            } else if (item.file) {
                // Fallback to file object if available
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

            // Get file type from cached metadata or file object
            const mimeType = item.fileType || (item.file ? item.file.type : 'Unknown');
            const format = mimeType !== 'Unknown' ? mimeType.split('/')[0] : 'Unknown';

            // Determine source text
            const sourceText = item.isLocal ? 'Local File' : (item.url || 'Unknown');

            // Calculate aspect ratio from video dimensions
            const calculateAspectRatio = (width, height) => {
                if (!width || !height) return 'N/A';
                const gcd = (a, b) => b ? gcd(b, a % b) : a;
                const divisor = gcd(width, height);
                const ratioW = width / divisor;
                const ratioH = height / divisor;
                // Check for common ratios
                const decimal = width / height;
                if (Math.abs(decimal - 16 / 9) < 0.01) return '16:9';
                if (Math.abs(decimal - 4 / 3) < 0.01) return '4:3';
                if (Math.abs(decimal - 21 / 9) < 0.01) return '21:9';
                if (Math.abs(decimal - 9 / 16) < 0.01) return '9:16';
                if (Math.abs(decimal - 1) < 0.01) return '1:1';
                return `${ratioW}:${ratioH}`;
            };

            const aspectRatio = item.videoInfo ?
                calculateAspectRatio(item.videoInfo.width, item.videoInfo.height) : 'N/A';

            // Get track counts
            const videoTrackCount = item.videoTracks ? `(${item.videoTracks.length} track${item.videoTracks.length !== 1 ? 's' : ''})` : '';
            const audioTrackCount = item.audioTracks ? `(${item.audioTracks.length} track${item.audioTracks.length !== 1 ? 's' : ''})` : '';

            // Extended metadata: initialize defaults
            let metaTags = {
                title: null,
                artist: null,
                album: null,
                date: null,
                comment: null,
                genre: null,
                track: null,
                encoder: null
            };
            let coverArtUrl = null;
            let frameCount = 'N/A';
            let audioBitrate = 'N/A';
            let colorSpace = 'N/A';
            let hasHDR = item.videoInfo ? item.videoInfo.hasHDR : false;
            let videoCodecParam = 'N/A';
            let audioCodecParam = 'N/A';
            let videoCanDecode = 'N/A';
            let audioCanDecode = 'N/A';
            let pixelAspectRatio = 'N/A';

            // Fetch extended metadata using MediaBunny directly
            try {
                const blobUrl = await MediaMetadata.getProcessedSourceURL(item);
                let inputSource;
                if (typeof blobUrl === 'string') {
                    inputSource = new MediaBunny.UrlSource(blobUrl);
                } else {
                    inputSource = new MediaBunny.BlobSource(blobUrl);
                }

                const input = new MediaBunny.Input({
                    source: inputSource,
                    formats: MediaBunny.ALL_FORMATS
                });

                try {
                    // Get metadata tags
                    const tags = await input.getMetadataTags();
                    if (tags) {
                        metaTags.title = tags.title || null;
                        metaTags.artist = tags.artist || null;
                        metaTags.album = tags.album || null;
                        metaTags.date = tags.date || null;
                        metaTags.comment = tags.comment || null;
                        metaTags.genre = tags.genre || null;
                        metaTags.track = tags.track || null;
                        metaTags.encoder = tags.encoder || tags.raw?.ENCODER || tags.raw?.encoder || null;

                        // Cover art
                        if (tags.images && tags.images.length > 0) {
                            try {
                                const coverImage = tags.images[0];
                                if (coverImage.data) {
                                    const blob = new Blob([coverImage.data], { type: coverImage.mimeType || 'image/jpeg' });
                                    coverArtUrl = URL.createObjectURL(blob);
                                }
                            } catch (e) {
                                Logger.warn('Failed to extract cover art:', e);
                            }
                        }
                    }

                    // Get video track extended info
                    const videoTrack = await input.getPrimaryVideoTrack();
                    if (videoTrack) {
                        // Frame count and color space from packet stats scan
                        try {
                            const stats = await videoTrack.computePacketStats();
                            if (stats && stats.packetCount) {
                                frameCount = stats.packetCount.toLocaleString();
                            }
                        } catch (e) {
                            Logger.warn('Failed to compute video packet stats:', e);
                        }

                        // Color space
                        try {
                            const cs = await videoTrack.getColorSpace();
                            if (cs) {
                                const parts = [];
                                if (cs.primaries) parts.push(cs.primaries);
                                if (cs.matrix) parts.push(cs.matrix);
                                if (cs.transfer) parts.push(cs.transfer);
                                if (parts.length > 0) {
                                    colorSpace = parts.join(' / ');
                                }
                            }
                        } catch (e) {
                            Logger.warn('Failed to get color space:', e);
                        }

                        // HDR check (potentially more accurate than cached)
                        try {
                            hasHDR = await videoTrack.hasHighDynamicRange();
                        } catch (e) {
                            // Use cached value
                        }

                        // Codec parameter string
                        try {
                            videoCodecParam = await videoTrack.getCodecParameterString() || 'N/A';
                        } catch (e) {
                            Logger.warn('Failed to get video codec param:', e);
                        }

                        // Decode support check
                        try {
                            const canDecode = await videoTrack.canDecode();
                            videoCanDecode = canDecode ? '✅ Supported' : '❌ Not Supported';
                        } catch (e) {
                            videoCanDecode = '❓ Unknown';
                        }

                        // Pixel Aspect Ratio (SAR) — new in mediabunny v1.35
                        try {
                            const par = videoTrack.pixelAspectRatio;
                            if (par) {
                                if (par.num === 1 && par.den === 1) {
                                    pixelAspectRatio = '1:1 (Square Pixels)';
                                } else {
                                    pixelAspectRatio = `${par.num}:${par.den}`;
                                }
                            }
                        } catch (e) {
                            Logger.warn('Failed to get pixel aspect ratio:', e);
                        }
                    }

                    // Get audio track extended info
                    const audioTrack = await input.getPrimaryAudioTrack();
                    if (audioTrack) {
                        try {
                            const audioStats = await audioTrack.computePacketStats();
                            if (audioStats && audioStats.averageBitrate) {
                                audioBitrate = `${Math.round(audioStats.averageBitrate / 1000)} kbps`;
                            }
                        } catch (e) {
                            Logger.warn('Failed to compute audio packet stats:', e);
                        }

                        // Codec parameter string
                        try {
                            audioCodecParam = await audioTrack.getCodecParameterString() || 'N/A';
                        } catch (e) {
                            Logger.warn('Failed to get audio codec param:', e);
                        }

                        // Decode support check
                        try {
                            const canDecode = await audioTrack.canDecode();
                            audioCanDecode = canDecode ? '✅ Supported' : '❌ Not Supported';
                        } catch (e) {
                            audioCanDecode = '❓ Unknown';
                        }
                    }
                } finally {
                    if (input && typeof input.dispose === 'function') {
                        try { input.dispose(); } catch (e) { /* ignore */ }
                    }
                }
            } catch (e) {
                Logger.warn('Failed to fetch extended metadata:', e);
            }

            const metadata = {
                source: sourceText,
                filename: item.title,
                format: format,
                mimeType: mimeType,
                size: fileSize,
                duration: item.duration || 'Unknown',

                // Metadata Tags
                metaTitle: metaTags.title || '—',
                metaArtist: metaTags.artist || '—',
                metaAlbum: metaTags.album || '—',
                metaDate: metaTags.date || '—',
                metaComment: metaTags.comment || '—',
                metaGenre: metaTags.genre || '—',
                metaTrack: metaTags.track || '—',
                metaEncoder: metaTags.encoder || '—',
                coverArt: coverArtUrl,

                // Video from cached data + extended
                videoCodec: item.videoInfo ? item.videoInfo.codec.toUpperCase() : 'N/A',
                videoCodecString: item.videoInfo ? item.videoInfo.codec : 'N/A',
                resolution: item.videoInfo ? `${item.videoInfo.width}x${item.videoInfo.height}` : 'N/A',
                aspectRatio: aspectRatio,
                pixelAspectRatio: pixelAspectRatio,
                codedResolution: item.videoInfo ? `${item.videoInfo.codedWidth}x${item.videoInfo.codedHeight}` : 'N/A',
                fps: fps,
                frameCount: frameCount,
                videoBitrate: bitrate,
                rotation: item.videoInfo ? `${item.videoInfo.rotation}°` : 'N/A',
                hdr: hasHDR ? 'Yes' : 'No',
                colorSpace: colorSpace,
                videoCodecParam: videoCodecParam,
                videoCanDecode: videoCanDecode,
                videoTrackCount: videoTrackCount,

                // Audio from cached data + extended
                audioCodec: item.audioInfo ? item.audioInfo.codec.toUpperCase() : 'N/A',
                audioCodecString: item.audioInfo ? item.audioInfo.codec : 'N/A',
                channels: item.audioInfo ? (item.audioInfo.channels === 2 ? 'Stereo (2)' : `${item.audioInfo.channels} Channels`) : 'N/A',
                sampleRate: item.audioInfo ? `${(item.audioInfo.sampleRate / 1000).toFixed(1)} kHz` : 'N/A',
                audioBitrate: audioBitrate,
                language: item.audioInfo ? (item.audioInfo.languageCode === 'und' ? 'Undetermined' : item.audioInfo.languageCode) : 'N/A',
                audioCodecParam: audioCodecParam,
                audioCanDecode: audioCanDecode,
                audioTrackCount: audioTrackCount
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

                    // Special handling for source URL title
                    if (key === 'source') {
                        el.title = metadata[key];
                    }
                }
            });

            // Store raw metadata for "Copy All"
            modal.body.dataset.rawInfo = JSON.stringify(metadata);

            // Show metadata section if at least one tag exists
            const hasAnyMeta = metaTags.title || metaTags.artist || metaTags.album || metaTags.date || metaTags.comment || metaTags.genre || metaTags.track || metaTags.encoder || coverArtUrl;
            const metaSection = modalContent.querySelector('[data-section="metadata"]');
            if (metaSection && hasAnyMeta) {
                metaSection.classList.remove('hidden');
                // Hide individual rows if their value is empty
                ['metaTitle', 'metaArtist', 'metaAlbum', 'metaDate', 'metaComment', 'metaGenre', 'metaTrack', 'metaEncoder'].forEach(key => {
                    const row = metaSection.querySelector(`[data-row="${key}"]`);
                    if (row) {
                        const value = metadata[key];
                        if (!value || value === '—') {
                            row.classList.add('hidden');
                        }
                    }
                });

                // Handle cover art display
                if (coverArtUrl) {
                    const coverRow = metaSection.querySelector('[data-row="coverArt"]');
                    const coverImg = metaSection.querySelector('[data-key="coverArt"]');
                    if (coverRow && coverImg) {
                        coverRow.classList.remove('hidden');
                        coverImg.src = coverArtUrl;
                        coverImg.style.display = 'block';
                    }
                }
            }

        } catch (e) {
            Logger.error('Failed to load video info:', e);
            // Show error or partial content
            if (loadingEl) loadingEl.classList.add('hidden');
            if (contentEl) contentEl.classList.remove('hidden');
        }

        // Event Listeners

        // Helper to show footer success message
        const showCopySuccess = (message = 'Copied to clipboard') => {
            const successEl = modalContent.querySelector('.success-message');
            if (successEl) {
                successEl.querySelector('span').textContent = message;
                successEl.classList.remove('hidden');
                // Auto-hide after 2 seconds
                setTimeout(() => {
                    successEl.classList.add('hidden');
                }, 2000);
            }
        };

        // Copy Single Value
        copyBtns.forEach(btn => {
            btn.addEventListener('click', async () => {
                const value = btn.dataset.value;
                if (value) {
                    try {
                        await navigator.clipboard.writeText(value);
                        showCopySuccess('Copied to clipboard');
                    } catch (err) {
                        Logger.error('Failed to copy:', err);
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
Pixel Aspect Ratio: ${metadata.pixelAspectRatio}
Frame Rate: ${metadata.fps}
Bitrate: ${metadata.videoBitrate}
Rotation: ${metadata.rotation}
HDR: ${metadata.hdr}
Color Space: ${metadata.colorSpace}
Frame Count: ${metadata.frameCount}
${metadata.videoTrackCount ? `Tracks: ${metadata.videoTrackCount}` : ''}
${metadata.metaTitle && metadata.metaTitle !== '—' ? `
Metadata Tags
-------------
Title: ${metadata.metaTitle}
Artist: ${metadata.metaArtist}
Album: ${metadata.metaAlbum}
Date: ${metadata.metaDate}
Comment: ${metadata.metaComment}` : ''}

Audio Stream
------------
Codec: ${metadata.audioCodec} (${metadata.audioCodecString})
Channels: ${metadata.channels}
Sample Rate: ${metadata.sampleRate}
Bitrate: ${metadata.audioBitrate}
Language: ${metadata.language}
${metadata.audioTrackCount ? `Tracks: ${metadata.audioTrackCount}` : ''}
`;
                    await navigator.clipboard.writeText(text);
                    showCopySuccess('All info copied');
                } catch (err) {
                    Logger.error('Failed to copy all:', err);
                }
            });
        }
    }
}
