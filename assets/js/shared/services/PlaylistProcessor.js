import { Logger } from "../utils/Logger.js";
import { MediaMetadata } from '../utils/MediaMetadata.js';
import { M3UParser } from '../utils/M3UParser.js';
import { StreamDetector } from '../utils/StreamDetector.js';
import { generateId } from '../utils/mediaUtils.js';

/**
 * Playlist Processor Service
 * Handles asynchronous media operations: metadata extraction, file imports, and M3U syncing.
 */
export class PlaylistProcessor {
    /**
     * Process dropped files into playlist items
     * @param {FileList|File[]} files 
     * @returns {Object[]} Array of prepared playlist items
     */
    static processFiles(files) {
        const fileArray = Array.from(files);

        // 1. Separate Media and Subtitle files
        const mediaFiles = fileArray.filter(file =>
            file.type.startsWith('video/') || file.type.startsWith('audio/')
        );

        const subtitleFiles = fileArray.filter(file =>
            file.name.toLowerCase().endsWith('.vtt') || file.name.toLowerCase().endsWith('.srt')
        );

        if (mediaFiles.length === 0) {
            return [];
        }

        const getBasename = (name) => name.substring(0, name.lastIndexOf('.'));

        return mediaFiles.map(file => {
            let path = file.webkitRelativePath || file.name;
            if (!path.includes('/')) {
                path = file.name;
            }

            const isAudio = file.type.startsWith('audio/');
            const id = generateId();

            const item = {
                id: id,
                title: file.name,
                url: URL.createObjectURL(file),
                duration: 'Loading...',
                thumbnail: '',
                isLocal: true,
                isAudio: isAudio,
                needsReload: false,
                file: file,
                fileSize: file.size,
                fileType: file.type,
                mimeType: file.type,
                path: path,
                addedAt: new Date().toISOString()
            };

            if (file.path) {
                item.localPath = file.path;
            }

            const mediaBasename = getBasename(file.name);
            const matchingSubtitle = subtitleFiles.find(subFile =>
                getBasename(subFile.name) === mediaBasename
            );

            if (matchingSubtitle) {
                item.subtitleFile = matchingSubtitle;
            }

            return item;
        });
    }

    /**
     * Extract metadata for a batch of items
     * @param {Object[]} items 
     * @param {Function} onItemUpdated - Callback for each item
     * @param {Function} onBatchComplete - Callback when batch is done
     */
    static async processMetadata(items, onItemUpdated, onBatchComplete) {
        await MediaMetadata.processMetadata(
            items,
            onItemUpdated,
            onBatchComplete
        );
    }

    /**
     * Ensure metadata exists for a single item
     * @param {Object} item 
     * @param {Function} onUpdated 
     */
    static async ensureMetadata(item, onUpdated) {
        await MediaMetadata.ensureMetadata(item, onUpdated);
    }

    /**
     * Throw a descriptive error when a plain-HTTP URL is requested from an
     * HTTPS page. Browsers block these requests (mixed content) before CORS
     * is even evaluated, so the generic "CORS Error" message is misleading.
     * @param {string} urlString
     */
    static _assertNotMixedContent(urlString) {
        if (typeof window === 'undefined' || window.location.protocol !== 'https:') return;

        let protocol;
        try {
            protocol = new URL(urlString).protocol;
        } catch {
            return;
        }

        if (protocol === 'http:') {
            throw new Error(
                'Mixed Content: this link uses http:// but JellyJump is running over https://, ' +
                'so the browser blocks the request. Serve the file over HTTPS, or run JellyJump ' +
                'from a non-HTTPS origin (desktop app or a local server).'
            );
        }
    }

    /**
     * Probe a URL with an opaque (no-cors) request to tell "server reachable
     * but missing CORS headers" apart from "server unreachable".
     * @param {string} url
     * @returns {Promise<boolean>} True if the server responded at all
     */
    static async _isReachableNoCors(url) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        try {
            await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
            return true;
        } catch {
            return false;
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Parse and transform an M3U playlist from URL
     * @param {string} url - URL to the M3U playlist
     * @returns {Promise<Object[]>} Array of prepared items
     */
    static async importM3U(url) {
        this._assertNotMixedContent(url);
        try {
            // Fetch and parse the M3U playlist
            const channels = await M3UParser.fetchAndParse(url);

            if (!channels || channels.length === 0) {
                throw new Error('No channels found in this playlist.');
            }

            // Extract playlist name from URL for root folder
            const urlPath = new URL(url).pathname;
            let playlistName = urlPath.split('/').pop() || 'IPTV Playlist';
            playlistName = playlistName.replace('.m3u', '').replace(/_/g, ' ');
            // Capitalize first letter
            playlistName = playlistName.charAt(0).toUpperCase() + playlistName.slice(1);

            // Convert channels to playlist items with folder hierarchy
            return channels.map(channel => {
                // Build path: PlaylistName/Group/ChannelName
                const group = channel.group || 'Uncategorized';
                const channelName = channel.name || 'Unknown Channel';
                const path = `${playlistName}/${group}/${channelName}`;

                return {
                    id: channel.id || generateId(),
                    title: channelName,
                    url: channel.url,
                    blob_url: channel.url,
                    duration: 'LIVE',
                    thumbnail: channel.logo || '',
                    isLocal: false,
                    isStream: true,
                    isLive: true,
                    file: null,
                    fileType: 'application/vnd.apple.mpegurl',
                    mimeType: 'application/vnd.apple.mpegurl',
                    path: path,
                    m3uSource: url,
                    m3uData: {
                        tvgId: channel.tvgId,
                        tvgName: channel.tvgName,
                        language: channel.language,
                        country: channel.country,
                        group: channel.group
                    }
                };
            });
        } catch (error) {
            Logger.error('[PlaylistProcessor] Failed to import M3U:', error);
            if (error.message.includes('Failed to fetch') || error.name === 'TypeError') {
                throw new Error('CORS Error: Cannot access this M3U playlist. The server must allow cross-origin requests.');
            }
            throw error;
        }
    }

    /**
     * Check if a stream URL is accessible
     * @param {string} url - Stream URL to check
     * @returns {Promise<boolean>} - True if accessible
     */
    static async checkStreamAccessibility(url) {
        const streamType = StreamDetector.detect(url);

        // For HLS streams, do a simple HEAD/GET fetch to check manifest accessibility
        if (streamType === StreamDetector.TYPE_HLS) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            try {
                const response = await fetch(url, { method: 'HEAD', signal: controller.signal });
                clearTimeout(timeoutId);
                return response.ok;
            } catch {
                clearTimeout(timeoutId);
                return false;
            }
        }

        // TYPE_FILE means URL doesn't look like a valid stream
        if (streamType === StreamDetector.TYPE_FILE) {
            return false;
        }

        // For other types, use fetch-based checking
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
            const response = await fetch(url, {
                method: 'HEAD',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response.ok;
        } catch (err) {
            clearTimeout(timeoutId);
            if (err.name === 'AbortError') return false;

            // CORS error - try no-cors mode as fallback
            try {
                const controller2 = new AbortController();
                const timeoutId2 = setTimeout(() => controller2.abort(), 3000);

                await fetch(url, {
                    method: 'HEAD',
                    signal: controller2.signal,
                    mode: 'no-cors'
                });

                clearTimeout(timeoutId2);
                return true;
            } catch {
                return false;
            }
        }
    }

    /**
     * Validate a list of streams
     * @param {Object[]} items 
     * @param {Function} onProgress 
     * @returns {Promise<Object>} Results summary
     */
    static async validateStreams(items, onProgress) {
        const results = { total: items.length, broken: 0, valid: 0 };
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const isValid = await this.checkStreamAccessibility(item.url);
            
            if (!isValid) {
                item.isBroken = true;
                results.broken++;
            } else {
                item.isBroken = false;
                results.valid++;
            }
            
            if (onProgress) onProgress((i + 1) / items.length, item, !isValid);
            
            // Small delay to avoid overwhelming the network
            await new Promise(r => setTimeout(r, 50));
        }
        
        return results;
    }

    /**
     * Process a single URL into a playlist item
     * @param {string} url 
     * @returns {Promise<Object>} Prepared item
     */
    static async processUrl(url) {
        const urlLower = url.toLowerCase();
        const urlObj = new URL(url);

        this._assertNotMixedContent(url);

        // 1. Detect M3U/IPTV Playlist
        const isM3UPlaylist = urlLower.endsWith('.m3u') ||
            (urlLower.includes('.m3u') && !urlLower.includes('.m3u8'));

        if (isM3UPlaylist) {
            return { type: 'm3u', url };
        }

        // 2. Detect HLS/Stream
        const hasM3u8Extension = urlLower.includes('.m3u8');
        const looksLikeStream = urlLower.includes('/hls/') || urlLower.includes('/live/');

        if (hasM3u8Extension && !looksLikeStream) {
            try {
                const response = await fetch(url);
                const content = await response.text();
                const isIPTVPlaylist = content.includes('#EXTINF') &&
                    (content.includes('group-title=') || content.includes('tvg-logo=') || content.includes('tvg-id=')) &&
                    !content.includes('#EXT-X-STREAM-INF') &&
                    !content.includes('#EXT-X-MEDIA-SEQUENCE');

                if (isIPTVPlaylist) return { type: 'm3u', url };
            } catch (e) {
                Logger.warn('[Processor] Could not inspect .m3u8, treating as stream');
            }
        }

        if (hasM3u8Extension || looksLikeStream) {
            const pathParts = urlObj.pathname.split('/');
            let filename = pathParts.pop() || 'stream';
            filename = filename.split('?')[0];
            const displayTitle = filename.replace('.m3u8', '') || 'Live Stream';

            return {
                title: displayTitle,
                url: url,
                blob_url: url,
                duration: 'LIVE',
                thumbnail: '',
                isLocal: false,
                isStream: true,
                isLive: true,
                file: null,
                fileType: 'application/vnd.apple.mpegurl',
                mimeType: 'application/vnd.apple.mpegurl',
                id: generateId()
            };
        }

        // 3. Detect Audio
        const audioExtensions = ['.mp3', '.flac', '.aac', '.ogg', '.wav', '.m4a', '.opus', '.wma'];
        const isAudioFile = audioExtensions.some(ext => urlLower.endsWith(ext));

        if (isAudioFile) {
            const filename = urlObj.pathname.split('/').pop() || 'audio';
            const displayTitle = filename.replace(/\.[^/.]+$/, '') || 'Audio Track';

            return {
                title: displayTitle,
                url: url,
                blob_url: url,
                duration: 'Loading...',
                thumbnail: '',
                isLocal: false,
                isAudio: true,
                file: null,
                fileType: 'audio/mpeg', // Generic fallback
                mimeType: 'audio/mpeg',
                id: generateId()
            };
        }

        // 4. Regular Video File
        try {
            let response = await fetch(url, { method: 'HEAD' });

            // Some servers reject HEAD; retry with a 1-byte ranged GET before giving up
            if (!response.ok && (response.status === 405 || response.status === 501)) {
                response = await fetch(url, { headers: { 'Range': 'bytes=0-0' } });
                response.body?.cancel?.();
            }

            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}${response.statusText ? ' ' + response.statusText : ''} for this link.`);
            }

            const contentType = response.headers.get('content-type') || 'video/mp4';

            const urlPath = urlObj.pathname;
            let filename = urlPath.split('/').pop() || 'remote-video.mp4';
            try {
                filename = decodeURIComponent(filename);
            } catch {
                // Keep the encoded name if the URL contains invalid escapes
            }

            return {
                title: filename,
                url: url,
                duration: 'Loading...',
                thumbnail: '',
                isLocal: false,
                file: null,
                fileType: contentType,
                mimeType: contentType,
                id: generateId()
            };
        } catch (e) {
            if (e.name === 'TypeError') {
                if (await this._isReachableNoCors(url)) {
                    throw new Error(
                        'CORS Error: the server hosting this file is reachable but does not allow ' +
                        'cross-origin requests. Enable CORS on it (send an ' +
                        '"Access-Control-Allow-Origin" header) and try again.'
                    );
                }
                throw new Error(
                    'Cannot reach this server. Check that the link is correct and accessible from this device.'
                );
            }
            throw e;
        }
    }
}
