import { Logger } from '../../shared/utils/Logger.js';
import { PROCESSED_ITEM_EVENT } from '../../shared/services/JobQueue.js';
import { Toast } from '../../shared/utils/Toast.js';
import { generateId } from '../../shared/utils/mediaUtils.js';
import { parseYouTubeUrl, fetchYouTubeInfo, buildYouTubeItem } from '../../shared/utils/YouTubeUrl.js';
import { parseLinkListFile, linkListFolderName } from '../../shared/utils/LinkListFile.js';
import { looksLikeShareLink, probe as probeRemoteLibrary } from '../../shared/services/RemoteLibrary.js';

/**
 * Adding to the playlist: files (dropped, picked, or from the desktop app),
 * URLs, M3U and link lists, YouTube links, and the results of tools.
 *
 * Part of the playlist (ARCHITECTURE_PLAN.md, phase E). These are
 * `Playlist` methods, kept in a file of their own and added to
 * `Playlist.prototype` (see the end of Playlist.js): `this` is the
 * playlist, and they call each other and the rest of it as before.
 */
export const PlaylistIngest = {
    /**
     * Handle FileList from input or drop
     * @param {FileList} files 
     */
    async handleFiles(files) {
        if (!files || files.length === 0) return;

        const newItems = this.processor.processFiles(files);

        if (newItems.length === 0) {
            Toast.show('Please select valid video or audio files.', 3000, true);
            return;
        }

        // On phones, oversized videos are gated BEFORE they enter the
        // playlist: the user can convert to 1080p inside the prompt (the
        // optimized copy is what gets added) or add the original as-is.
        try {
            const { OptimizeMenu } = await import('../menus/features/OptimizeMenu.js');
            await OptimizeMenu.interceptNewItems(newItems);
        } catch (e) {
            Logger.warn('[Playlist] Optimize gate failed, adding originals:', e);
        }

        this.addItems(newItems);
        this.processMetadata(newItems);
    },

    /**
     * Handle files from Electron's native file dialog (has paths)
     * @param {Array<{path: string, name: string, size: number, lastModified: number}>} files 
     */
    async handleElectronFiles(files) {

        const videoExtensions = ['mp4', 'mkv', 'avi', 'webm', 'mov', 'm4v', 'wmv', 'flv'];
        const audioExtensions = ['mp3', 'flac', 'aac', 'ogg', 'wav', 'm4a', 'opus', 'wma'];
        const subtitleExtensions = ['vtt', 'srt']; // Add subtitle extensions
        const allExtensions = [...videoExtensions, ...audioExtensions, ...subtitleExtensions]; // Include subtitles in initial filter

        // Filter valid files first
        const validFiles = files.filter(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            return allExtensions.includes(ext);
        });

        const mediaFiles = validFiles.filter(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            return videoExtensions.includes(ext) || audioExtensions.includes(ext);
        });

        const subtitleFiles = validFiles.filter(file => {
            const ext = file.name.split('.').pop().toLowerCase();
            return subtitleExtensions.includes(ext);
        });

        if (mediaFiles.length === 0) {
            Toast.show('Please select valid video or audio files.', 3000, true);
            return;
        }

        const newItems = mediaFiles.map(file => {
            // Determine MIME type from extension
            const ext = file.name.split('.').pop().toLowerCase();
            const mimeTypes = {
                'mp4': 'video/mp4',
                'mkv': 'video/x-matroska',
                'avi': 'video/x-msvideo',
                'webm': 'video/webm',
                'mov': 'video/quicktime',
                'm4v': 'video/x-m4v',
                'wmv': 'video/x-ms-wmv',
                'flv': 'video/x-flv',
                // Audio types
                'mp3': 'audio/mpeg',
                'flac': 'audio/flac',
                'aac': 'audio/aac',
                'ogg': 'audio/ogg',
                'wav': 'audio/wav',
                'm4a': 'audio/mp4',
                'opus': 'audio/opus',
                'wma': 'audio/x-ms-wma'
            };
            const mimeType = mimeTypes[ext] || 'video/mp4';
            const isAudio = ext && audioExtensions.includes(ext);

            const item = {
                title: file.name,
                url: '', // Will be created on-demand from localPath
                duration: 'Loading...',
                thumbnail: '',
                isLocal: true,
                isAudio: isAudio,
                needsReload: false,
                file: null, // File will be loaded from disk on-demand
                fileSize: file.size,
                fileType: mimeType,
                mimeType: mimeType,
                path: file.name,
                localPath: file.path, // The absolute path for disk access
                id: generateId()
            };

            // Check for matching subtitle
            const getBasename = (name) => name.substring(0, name.lastIndexOf('.'));
            const mediaBasename = getBasename(file.name);

            const matchingSubtitle = subtitleFiles.find(subFile =>
                getBasename(subFile.name) === mediaBasename
            );

            if (matchingSubtitle) {
                // For Electron, we store the path to allow direct loading or conversion if needed
                item.subtitlePath = matchingSubtitle.path;
                Logger.log(`[Playlist] Auto-detected subtitle for ${file.name}: ${matchingSubtitle.name} (${matchingSubtitle.path})`);
            }

            return item;
        });



        this.addItems(newItems);

        // Process metadata for new items
        this.processMetadata(newItems);

        // If playlist was empty, play the first new file
        if (this.items.length === newItems.length) {
            this.selectItem(0);
        }
    },

    /**
     * Expand a .jjlist the scan found into playlist entries.
     *
     * The file becomes a folder named after it, with one YouTube item per line
     * beneath — so a hand-written list of links reads like any other folder of
     * videos.
     *
     * The file itself is never added: it is a playlist, not something to play,
     * and it is deliberately absent from the shared index so it cannot be
     * fetched over a share link either.
     *
     * Titles come from the file when it names them. A line that is only a URL
     * is listed by its id straight away and its real title filled in behind,
     * because waiting on a lookup per line would leave the folder empty for as
     * long as the network takes.
     * @param {{path: string, name: string, text: string}} file
     */
    addLinkListItems(file) {
        const entries = parseLinkListFile(file.text);
        if (entries.length === 0) return;

        // Named after the file, without the extension — the extension is how
        // the app recognises it, not something the user needs to read.
        const folder = linkListFolderName(file.name);

        // Keyed on the video, not the URL, and matching how the parser dedupes
        // within a file: the same video written as youtu.be one day and
        // watch?v= the next is one entry, not two.
        const key = (id, start) => `${id}@${start || 0}`;
        const known = new Set(
            this.state.items
                .filter(i => i.linkListPath === file.path)
                .map(i => key(i.youtubeId, i.youtubeStart))
        );

        const newItems = [];
        for (const entry of entries) {
            if (known.has(key(entry.id, entry.start))) continue;
            known.add(key(entry.id, entry.start));

            newItems.push({
                id: generateId(),
                ...buildYouTubeItem(entry, entry.url, {
                    title: entry.name,
                    path: `${folder}/${entry.name || entry.id}`,
                    extra: {
                        // Where it came from, so re-reading updates rather than
                        // duplicates — and which lines still need a title.
                        linkListPath: file.path,
                        linkListFolder: folder,
                        needsTitle: !entry.name,
                    },
                }),
            });
        }

        if (newItems.length === 0) return;

        this.state.addItems(newItems);
        this._renderDiscoveredSoon();
        Logger.log(`[Playlist] ${newItems.length} link(s) from ${file.name}`);

        this._fillMissingYouTubeTitles(newItems);
    },

    /**
     * Look up titles for entries the file did not name.
     *
     * One request each, and only for the unnamed ones — a file that names its
     * videos costs nothing. Failures are left alone: the id is a poor title but
     * a working entry, and a video that will not play is not the lookup's
     * business.
     * @private
     */
    async _fillMissingYouTubeTitles(items) {
        const unnamed = items.filter(i => i.needsTitle);
        if (unnamed.length === 0) return;

        for (const item of unnamed) {
            const info = await fetchYouTubeInfo(item.youtubeId);
            if (!info?.title || info.title === `YouTube ${item.youtubeId}`) continue;
            item.title = info.title;
            item.path = `${item.linkListFolder}/${info.title}`;
            delete item.needsTitle;
        }
        this._renderDiscoveredSoon();
    },

    /**
     * Add what a URL points to: a video, a stream, an M3U or link list, a
     * YouTube link, or a shared library.
     * @param {string} url
     * @param {Function} [onFirstItems] - called as soon as something is on
     *   screen, so a dialog waiting on this can get out of the way. A shared
     *   library keeps streaming after it fires.
     */
    async handleUrlUpload(url, onFirstItems) {
        try {
            // A share link is a library, not a media file. Handing it to the
            // normal path makes the demuxer fetch a web page and fail with
            // "unsupported or unrecognizable format", which says nothing useful.
            // A YouTube page is not a media file either: the demuxer would
            // fetch HTML and fail with "unsupported or unrecognizable format".
            const youtube = parseYouTubeUrl(url);
            if (youtube) {
                await this._addYouTubeVideo(url, youtube);
                onFirstItems?.();
                return;
            }

            if (looksLikeShareLink(url)) {
                const info = await probeRemoteLibrary(url);
                if (info.ok) {
                    await this.remoteLibraries.add(url, info, onFirstItems);
                    return;
                }
                Logger.log(`[Playlist] Not a JellyJump library (${info.error}), treating as a media URL`);
            }

            const result = await this.processor.processUrl(url);

            // Handle M3U/IPTV Playlist result
            if (result.type === 'm3u') {
                await this._handleM3UPlaylist(result.url);
                return;
            }

            // Add item to playlist
            this.addItem(result);

            // Process metadata if it's a regular file. Through the same helper
            // every other caller uses: it patches the one row whose thumbnail
            // and duration arrived, where this used to rebuild the whole tree
            // and throw away the reader's place in it.
            if (!result.isStream) {
                this.processMetadata([result]);
            }

            // Always select and play the new item
            this.selectItem(this.items.length - 1);

        } catch (error) {
            throw error;
        }
    },

    /**
     * Add a YouTube video as a playlist item.
     *
     * The item carries the watch URL, not a media URL — there is nothing to
     * fetch. The player recognises it on load and hands it to YouTube's own
     * iframe player.
     *
     * Title and thumbnail come from oEmbed so the row reads like any other
     * entry. That lookup is allowed to fail: an unreachable oEmbed says nothing
     * about whether the video will play, so the item is added either way.
     * @private
     */
    async _addYouTubeVideo(url, parsed) {
        const info = await fetchYouTubeInfo(parsed.id);

        this.addItem(buildYouTubeItem(parsed, url, {
            title: info.title,
            thumbnail: info.thumbnail,
        }));

        this.save();
        this.render();
        this._updatePlayerNavigationState();
        this.selectItem(this.items.length - 1, true);
        Logger.log(`[Playlist] Added YouTube video ${parsed.id}: ${info.title}`);
    },

    /**
     * Add a video to the playlist
     * @param {Object} video - Video object { title, url, duration, thumbnail }
     */
    addItem(video) {
        if (!video.id) video.id = generateId();
        this.state.addItem(video);
        this.save();
        this.render();
        this._updatePlayerNavigationState();
    },

    /**
     * Insert a processed result into the playlist after its source item.
     * Centralizes the pattern used by menus after processing (convert, trim, encrypt, etc.)
     * @param {Object} sourceItem - The original playlist item that was processed
     * @param {Blob} blob - The result blob
     * @param {string} filename - Display name / download filename
     * @param {Object} [options]
     * @param {string} [options.type] - File MIME type override (default: blob.type || 'video/mp4')
     * @param {string} [options.mediaType] - Playlist type field ('video', 'audio', 'image/gif', etc.)
     * @param {string|null} [options.duration] - Duration string; null to skip (caller may ensureMetadata)
     * @param {Object} [options.extra] - Additional fields merged into the item
     * @returns {{ item: Object, url: string }}
     */
    insertProcessedItem(sourceItem, blob, filename, options = {}) {
        // The edit panel names a copy it edits on itself, so that the name
        // does not grow with every edit made on top of it.
        const named = this.nameProcessedItem?.(sourceItem, filename) ?? null;
        if (named) filename = named.title;
        const url = URL.createObjectURL(blob);
        const mimeType = options.type || blob.type || 'video/mp4';
        const newItem = {
            id: generateId(),
            title: filename,
            url,
            blob_url: url,
            file: new File([blob], filename, { type: mimeType }),
            duration: options.duration !== undefined ? options.duration : (sourceItem ? sourceItem.duration : null),
            type: options.mediaType || 'video',
            isLocal: true,
            isNew: true,
            // A file the app made, not the user's: the desktop app keeps it
            // in its copies folder (DesktopStorageService).
            madeByTool: true,
            path: named?.path ?? (sourceItem ? (sourceItem.path || sourceItem.title) + '/' + filename : filename),
            ...options.extra,
        };

        const index = sourceItem ? this.state.items.indexOf(sourceItem) : -1;
        if (index !== -1) {
            this.state.insertItem(index + 1, newItem);
        } else {
            this.state.addItem(newItem);
        }

        this.render();
        this.save();

        // The job that made it, if any, lists it as its result.
        window.dispatchEvent(new CustomEvent(PROCESSED_ITEM_EVENT, { detail: { item: newItem, url } }));

        return { item: newItem, url };
    },

    /**
     * Add multiple videos
     * @param {Array} videos 
     * @param {boolean} autoplay - Whether to auto-play the first item (default: true)
     */
    async addItems(videos, autoplay = true) {
        // Separate M3U playlist URLs from regular items
        const m3uItems = [];
        const regularItems = [];

        for (const v of videos) {
            const url = v.url?.toLowerCase() || '';
            const isM3UPlaylist = url.endsWith('.m3u') ||
                (url.includes('.m3u') && !url.includes('.m3u8'));

            if (isM3UPlaylist) {
                m3uItems.push(v);
            } else {
                if (!v.id) v.id = generateId();
                regularItems.push(v);
            }
        }

        // Disable loading state since we have new items
        this.isLoading = false;

        // Add regular items immediately
        if (regularItems.length > 0) {
            const startIndex = this.state.items.length;
            this.state.addItems(regularItems);
            this.save();
            this.render();
            this._updatePlayerNavigationState();

            // Auto-play the first item from the batch that was just added
            this.selectItem(startIndex, autoplay);
        }

        // Process M3U playlists asynchronously
        for (const m3u of m3uItems) {
            try {
                Logger.log(`[Playlist] Expanding M3U playlist: ${m3u.title || m3u.url}`);
                await this._handleM3UPlaylist(m3u.url);
            } catch (error) {
                Logger.error(`[Playlist] Failed to expand M3U: ${m3u.url}`, error);
                // Add as a regular item if expansion fails
                if (!m3u.id) m3u.id = generateId();
                this.state.addItem(m3u);
                this.save();
                this.render();
            }
        }
    },

    /**
     * Handle M3U/IPTV Playlist Import
     * Parses the M3U file and adds channels grouped by category as folders
     * @param {string} url - URL to the M3U playlist
     * @private
     */
    async _handleM3UPlaylist(url, isSync = false) {
        try {
            const newItems = await this.processor.importM3U(url);

            // If syncing, remove OLD items from this source first
            if (isSync) {
                this.state.setItems(this.items.filter(item => item.m3uSource !== url));
                Logger.log(`[M3U] Removed old items for sync: ${url}`);
            }

            // Add all items at once
            this.state.addItems(newItems);
            this.save();
            this.render();
            this._updatePlayerNavigationState();

            // Show success message
            Toast.show(`${isSync ? 'Synced' : 'Added'} ${newItems.length} channels`);

        } catch (error) {
            Logger.error('[M3U] Failed to import playlist:', error);
            throw error;
        }
    },

    /**
     * Sync/Re-update M3U Playlist
     * @param {string} name - Playlist/Folder name
     * @param {string} url - Source URL
     */
    async _syncM3UPlaylist(name, url) {
        if (!url) return;
        Toast.show(`Syncing ${name}...`);
        try {
            await this._handleM3UPlaylist(url, true);
        } catch (e) {
            Toast.show(`Sync failed: ${e.message}`, 3000, true);
        }
    },
};
