// @ts-check
import { Logger } from "../utils/Logger.js";
import { desktopBridge } from '../platform/Platform.js';
import { PLAYLIST_MARKER } from './IndexedDBService.js';

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
/** @typedef {import('../types.js').PlaylistItem} PlaylistItem */
/** @typedef {{playlist: PlaylistItem[], playbackState: Object|null}} DesktopConfig */

/** Bytes per message when writing a copy to disk. */
const COPY_CHUNK = 8 * 1024 * 1024;

export class DesktopStorageService {
    constructor() {
        /** @type {Map<string, Promise<string|null>>} copies being written, by item id */
        this._storing = new Map();
        /** @type {Set<string>} items with a file in memory that get no copy (a dropped file) */
        this._notCopies = new Set();
        /** @type {DesktopConfig|null} what jellyjump.json holds; null until read */
        this._cache = null;
        this._initPromise = this._load();
    }

    async _load() {
        try {
            const data = await desktopBridge().readConfig();
            this._cache = data || { playlist: [], playbackState: null };
        } catch (e) {
            Logger.warn('[DesktopStorage] Failed to read config, starting fresh:', e);
            this._cache = { playlist: [], playbackState: null };
        }
    }

    async _persist() {
        try {
            await desktopBridge().writeConfig(this._cache);
        } catch (e) {
            Logger.error('[DesktopStorage] Failed to write config:', e);
        }
        // Mirror presence flag so player-main.js requires no changes
        if (this._data.playlist && this._data.playlist.length > 0) {
            localStorage.setItem(PLAYLIST_MARKER, 'true');
        } else {
            localStorage.removeItem(PLAYLIST_MARKER);
        }
    }

    async ready() {
        if (!this._cache) await this._initPromise;
    }

    /** The config, once ready() has resolved (it is read, or started fresh). */
    get _data() {
        return /** @type {DesktopConfig} */ (this._cache);
    }

    // ─── Playlist ────────────────────────────────────────────────────────────

    /**
     * @param {PlaylistItem[]} items
     */
    async savePlaylist(items) {
        await this.ready();

        // A tool's result has no file on disk: it gets one, in the app's
        // copies folder, so it plays after its memory is let go and after a
        // restart (G4; BUG-6 was the worst of not having one).
        await Promise.all(items
            .filter((item) => item.isLocal && item.file && !item.localPath && !item.isWebcam && !this._notCopies.has(item.id))
            .map(item => this._storeCopy(item)));

        this._data.playlist = items.map(item => ({
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

        // Release in-memory blobs after saving, as IndexedDBService does --
        // but only files that can be read back from disk. A copy that could
        // not be written keeps its file, or it could never play again (BUG-6).
        for (const item of items) {
            if (item.isLocal && item.file && item.localPath) {
                Logger.log(`[DesktopStorage] Releasing memory for persisted file: ${item.title}`);
                item.file = null;
            }
        }

        await this._persist();
    }

    /**
     * @returns {Promise<PlaylistItem[]>}
     */
    async loadPlaylist() {
        await this.ready();

        return (this._data.playlist || []).map((item) => {
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
     * @param {string} id
     */
    async loadFile(id) {
        await this.ready();

        const item = (this._data.playlist || []).find(i => i.id === id);
        // Not in the playlist: an earlier copy the edit panel keeps for Undo.
        const path = item?.localPath ?? await this._copyPath(id);
        if (!path) return null;
        try {
            const result = await desktopBridge().readFile(path);
            if (result.success) {
                return new File([result.buffer], item?.title || (path.split(/[\\/]/).pop() ?? '').replace(/^[^_]+__/, '') || 'file', {
                    type: item?.mimeType || '',
                });
            }
            Logger.warn('[DesktopStorage] readFile failed:', result.error);
        } catch (e) {
            Logger.warn('[DesktopStorage] Error reading file from disk:', e);
        }
        return null;
    }

    /**
     * No-op on desktop: a remote video is not kept (it is fetched again when
     * played). A tool's result is kept, by savePlaylist. Returns false so
     * callers know nothing was cached.
     * @param {string} _id
     * @param {Blob} _blob
     * @param {string} [_name]
     * @param {string} [_type]
     * @returns {Promise<boolean>}
     */
    async saveFile(_id, _blob, _name, _type) {
        return false;
    }

    /**
     * Delete an item's copy, if the app made one. Only ever the app's copies
     * folder: the user's own files are not the playlist's to delete.
     * @param {string} id
     */
    async deleteFile(id) {
        await desktopBridge()?.copyDelete?.(id);
    }

    /** The item ids of the copies on disk (for the sweep in PlaylistFiles). */
    async fileIds() {
        const result = await desktopBridge()?.copyList?.();
        if (!result?.success) throw new Error(result?.error || 'Could not list the copies');
        return result.value;
    }

    // ─── Copies (G4) ──────────────────────────────────────────────────────────

    /** @param {string} id @returns {Promise<string|null>} */
    async _copyPath(id) {
        const result = await desktopBridge()?.copyPath?.(id);
        return result?.success ? result.value : null;
    }

    /**
     * Give an item its copy's path: the copy already on disk (an earlier
     * edit put back by Undo), or a new one for a file a tool made. A file
     * the user dropped gets none: it is theirs, and copying it would double
     * it on disk; it stays in memory, as before. Concurrent saves share the
     * one write.
     * @param {PlaylistItem} item
     * @returns {Promise<string|null>}
     */
    _storeCopy(item) {
        if (!this._storing.has(item.id)) {
            const writing = this._copyPath(item.id)
                .then((existing) => {
                    if (existing) return existing;
                    if (!item.madeByTool) {
                        this._notCopies.add(item.id);
                        return null;
                    }
                    const file = /** @type {File} */ (item.file);   // only items with one are stored
                    return this._writeCopy(item.id, file, file.name || item.title);
                })
                .then((path) => {
                    if (path) item.localPath = path;
                    return path;
                })
                .catch((error) => {
                    Logger.warn('[DesktopStorage] Could not keep a copy on disk; it stays in memory:', error);
                    return null;
                })
                .finally(() => this._storing.delete(item.id));
            this._storing.set(item.id, writing);
        }
        return /** @type {Promise<string|null>} */ (this._storing.get(item.id));
    }

    /**
     * In chunks: a long video is too big for one message to the main process.
     * @param {string} id
     * @param {Blob} blob
     * @param {string} name
     * @returns {Promise<string|null>} the copy's path
     */
    async _writeCopy(id, blob, name) {
        const bridge = desktopBridge();
        if (!bridge?.copyBegin) return null;
        const step = (/** @type {{success?: boolean, error?: string, value?: any}} */ result) => {
            if (!result?.success) throw new Error(result?.error || 'copy failed');
            return result.value;
        };
        step(await bridge.copyBegin(id, name));
        try {
            for (let at = 0; at < blob.size; at += COPY_CHUNK) {
                step(await bridge.copyWrite(id, await blob.slice(at, at + COPY_CHUNK).arrayBuffer()));
            }
            return step(await bridge.copyFinish(id));
        } catch (error) {
            await bridge.copyAbort(id);
            throw error;
        }
    }

    // ─── Playback state ───────────────────────────────────────────────────────

    /**
     * @param {Object} state
     */
    async savePlaybackState(state) {
        await this.ready();
        this._data.playbackState = { key: 'playback', ...state };
        await this._persist();
    }

    async loadPlaybackState() {
        await this.ready();
        return this._data.playbackState || null;
    }

    // ─── Clear ────────────────────────────────────────────────────────────────

    async clear() {
        this._cache = { playlist: [], playbackState: null };
        await this._persist();
    }
}
