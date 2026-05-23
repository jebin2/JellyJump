import { Logger } from "../utils/Logger.js";

/**
 * DesktopStorageService
 * Drop-in replacement for IndexedDBService for the Electron desktop app.
 *
 * Playlist metadata and playback state are persisted to
 * {userData}/jellyjump.json via the read-config / write-config IPC handlers.
 *
 * Local files are never stored as blobs — they are read directly from disk
 * using the item's localPath (via the existing read-file IPC handler).
 * Remote URL blobs are not persisted on desktop; they are re-fetched on demand.
 *
 * The JellyJumpDB-playlist localStorage flag is mirrored so that player-main.js
 * (which checks that flag for the demo-video logic) requires no changes.
 */
export class DesktopStorageService {
    constructor() {
        this._cache = null; // { playlist: [], playbackState: null }
        this._initPromise = this._load();
    }

    async _load() {
        try {
            const data = await window.electronAPI.readConfig();
            this._cache = data || { playlist: [], playbackState: null };
        } catch (e) {
            Logger.warn('[DesktopStorage] Failed to read config, starting fresh:', e);
            this._cache = { playlist: [], playbackState: null };
        }
    }

    async _persist() {
        try {
            await window.electronAPI.writeConfig(this._cache);
        } catch (e) {
            Logger.error('[DesktopStorage] Failed to write config:', e);
        }
        // Mirror presence flag so player-main.js requires no changes
        if (this._cache.playlist && this._cache.playlist.length > 0) {
            localStorage.setItem('JellyJumpDB-playlist', 'true');
        } else {
            localStorage.removeItem('JellyJumpDB-playlist');
        }
    }

    async ready() {
        if (!this._cache) await this._initPromise;
    }

    // ─── Playlist ────────────────────────────────────────────────────────────

    async savePlaylist(items) {
        await this.ready();

        this._cache.playlist = items.map(item => ({
            id: item.id,
            title: item.title,
            duration: item.duration,
            thumbnail: item.thumbnail,
            isLocal: item.isLocal,
            path: item.path,
            url: item.isLocal ? '' : item.url,
            originalIndex: item.originalIndex,
            fileSize: item.fileSize,
            fileType: item.fileType,
            mimeType: item.mimeType,
            localPath: item.localPath,
        }));

        // Release in-memory blobs after saving (mirrors IndexedDBService behaviour)
        for (const item of items) {
            if (item.isLocal && item.file) {
                Logger.log(`[DesktopStorage] Releasing memory for persisted file: ${item.title}`);
                item.file = null;
            }
        }

        await this._persist();
    }

    async loadPlaylist() {
        await this.ready();

        return (this._cache.playlist || []).map(item => {
            const restored = { ...item };
            if (restored.isLocal) {
                restored.file = null;
                restored.url = null;
                restored.needsReload = false;
            }
            return restored;
        });
    }

    // ─── Files ───────────────────────────────────────────────────────────────

    /**
     * On desktop, local files are always read from disk via localPath.
     * We look up the cached playlist to find the path for the given id.
     */
    async loadFile(id) {
        await this.ready();

        const item = (this._cache.playlist || []).find(i => i.id === id);
        if (!item) return null;

        if (item.localPath) {
            try {
                const result = await window.electronAPI.readFile(item.localPath);
                if (result.success) {
                    return new File([result.buffer], item.title || 'file', {
                        type: item.mimeType || '',
                    });
                }
                Logger.warn('[DesktopStorage] readFile failed:', result.error);
            } catch (e) {
                Logger.warn('[DesktopStorage] Error reading file from disk:', e);
            }
        }
        return null;
    }

    /**
     * No-op on desktop — local files use localPath, remote blobs are not
     * persisted (re-fetched on demand). Returns false so callers know nothing
     * was cached (matching the size-exceeded return value of IndexedDBService).
     */
    async saveFile(_id, _blob, _name, _type) {
        return false;
    }

    // ─── Playback state ───────────────────────────────────────────────────────

    async savePlaybackState(state) {
        await this.ready();
        this._cache.playbackState = { key: 'playback', ...state };
        await this._persist();
    }

    async loadPlaybackState() {
        await this.ready();
        return this._cache.playbackState || null;
    }

    // ─── Clear ────────────────────────────────────────────────────────────────

    async clear() {
        this._cache = { playlist: [], playbackState: null };
        await this._persist();
    }
}
