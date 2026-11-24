// @ts-check
import { Logger } from '../../shared/utils/Logger.js';
import { Toast } from '../../shared/utils/Toast.js';
import { DiscoveredMedia } from '../../shared/services/DiscoveredMedia.js';
import { DISCOVERED_FOLDER, discoveredItemFromScan } from './DiscoveredItems.js';
import { isDesktop } from '../../shared/platform/Platform.js';

/**
 * The desktop app's media scan: the folder of videos found on disk, filled
 * as the scan finds them, and keeping one of them in the playlist.
 *
 * Part of the playlist (ARCHITECTURE_PLAN.md, phase E). These are
 * `Playlist` methods, kept in a file of their own and added to
 * `Playlist.prototype` (see the end of Playlist.js): `this` is the
 * playlist, and they call each other and the rest of it as before.
 */
export const PlaylistDiscovery = {
    /**
     * Scan the user's media folders and list what turns up under a "Discovered"
     * folder in the playlist.
     *
     * These are ordinary playlist items and reuse the whole existing flow —
     * the folder tree is derived from item.path, so nesting them under
     * DISCOVERED_FOLDER is all it takes to group them. They are flagged
     * isDiscovered so PlaylistStorage leaves them out of the saved playlist:
     * a scan can turn up thousands of files, and they come back on next launch
     * anyway.
     * @private
     */
    async _startMediaScan() {
        if (!DiscoveredMedia.isSupported()) return;
        // The browser scanner needs a user gesture and a directory pick, so it
        // is started from the UI rather than on load.
        if (!isDesktop()) return;

        this._discovered = new DiscoveredMedia();
        this.scanState = { scanning: true, found: 0, failed: false };

        this._discovered.subscribe((event) => {
            if (event.type === 'phase') {
                this.scanState = { ...this.scanState, phase: event.phase };
                this.render();
            }
            if (event.type === 'batch') {
                this.scanState.found = event.total;
                this.addDiscoveredItems(event.files);
            }
            if (event.type === 'linklist') {
                this.addLinkListItems(event.file);
            }
            if (event.type === 'error') {
                Logger.warn('[Playlist] Media scan failed:', event.error);
                this.scanState = { scanning: false, found: this.scanState.found, failed: true };
                this.render();
            }
            if (event.type === 'done') {
                this.scanState = {
                    scanning: false,
                    found: event.total,
                    failed: false,
                    cancelled: event.summary?.cancelled ?? false,
                };
                this.render();
            }
        });

        try {
            await this._discovered.scan();
        } catch (error) {
            Logger.warn('[Playlist] Media scan failed:', error);
            this.scanState = { scanning: false, found: this.scanState.found, failed: true };
            this.render();
        }
    },

    /** Folder that scan results are grouped under, for the renderer. */
    get discoveredFolderName() {
        return DISCOVERED_FOLDER;
    },

    /** Stop an in-flight scan. Whatever was already found stays listed. */
    async cancelMediaScan() {
        if (!this._discovered) return;
        await this._discovered.cancel();
        Logger.log('[Playlist] Media scan cancelled by user');
    },

    /**
     * Merge scan results into the playlist.
     * Deliberately does not go through addItems(): that selects and may
     * autoplay the first item added, which would hijack playback every time a
     * batch streams in.
     * @param {Array} files - scan records ({ path, name, size, mtime })
     */
    addDiscoveredItems(files) {
        if (!files || files.length === 0) return;

        const known = new Set(this.state.items.map(i => i.localPath).filter(Boolean));
        const newItems = [];

        for (const file of files) {
            if (known.has(file.path)) continue; // already in the playlist, curated or not
            known.add(file.path);
            newItems.push(discoveredItemFromScan(file));
        }

        if (newItems.length === 0) return;
        this.state.addItems(newItems);
        this._renderDiscoveredSoon();
    },

    /**
     * Coalesce redraws while a scan streams in.
     *
     * The home pass delivers many batches, and each render rebuilds the folder
     * tree over every item in the playlist — redrawing per batch makes that
     * cost grow with the list it is already building. One frame's delay is
     * imperceptible and collapses a burst of batches into a single rebuild.
     * @private
     */
    _renderDiscoveredSoon() {
        if (this._discoveredRenderQueued) return;
        this._discoveredRenderQueued = true;
        requestAnimationFrame(() => {
            this._discoveredRenderQueued = false;
            this.render();
            this._updatePlayerNavigationState();
        });
    },

    /**
     * Promote a discovered file into the saved playlist.
     *
     * Clearing isDiscovered is what makes it persist; moving it out of the
     * Discovered folder path is what stops it looking like a scan result that
     * will disappear. Both are needed — leaving the path alone would keep it
     * filed under a folder whose whole meaning is "not kept".
     * @param {string} id
     */
    keepDiscoveredItem(id) {
        const index = this.state.items.findIndex(i => i.id === id);
        if (index === -1) return;

        const item = this.state.items[index];
        if (!item.isDiscovered) return;

        delete item.isDiscovered;
        // Top level, matching how a file added through the open dialog looks.
        item.path = item.title;

        this.save();
        this.render();
        this._updatePlayerNavigationState();
        Toast.show(`Kept "${item.title}" in your playlist`);
        Logger.log('[Playlist] Kept discovered item:', item.title);
    },
};
