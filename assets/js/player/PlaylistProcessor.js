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
     * Parse and transform an M3U playlist from URL
     * @param {string} url - URL to the M3U playlist
     * @returns {Promise<Object[]>} Array of prepared items
     */
    static async importM3U(url) {
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
}
