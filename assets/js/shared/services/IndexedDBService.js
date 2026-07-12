import { Logger } from "../utils/Logger.js";
/**
 * IndexedDB Service
 * Handles persistence of playlist, files, and player state using IndexedDB.
 * Allows storing large binary data (Blobs) which localStorage cannot handle.
 * 
 * Playlist Item Schema:
 * @typedef {Object} PlaylistItem
 * @property {string} id - Unique identifier (UUID)
 * @property {string} title - Display title (filename)
 * @property {string} duration - Formatted duration ("mm:ss" or "hh:mm:ss")
 * @property {string} thumbnail - Thumbnail URL or empty string
 * @property {boolean} isLocal - True if item is a local file (not remote stream)
 * @property {string} [path] - Filename/relative path
 * @property {string} [url] - Remote URL for streaming, or empty for local files
 * @property {string} [localPath] - Absolute filesystem path (Electron only, for disk access)
 * @property {string} [mimeType] - MIME type (e.g., "video/mp4")
 * @property {string} [fileType] - Same as mimeType (for compatibility)
 * @property {number} [fileSize] - File size in bytes
 * @property {number} [originalIndex] - Original position in playlist (for shuffle)
 */
export class IndexedDBService {
    constructor() {
        this.DB_NAME = 'JellyJumpDB';
        this.DB_VERSION = 1;
        this.STORES = {
            PLAYLIST: 'playlist',
            FILES: 'files',
            STATE: 'state'
        };
        this.db = null;
        this.initPromise = this._init();
    }

    /**
     * Initialize the database
     * @private
     */
    _init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

            request.onerror = (event) => {
                Logger.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Playlist store (key: id)
                if (!db.objectStoreNames.contains(this.STORES.PLAYLIST)) {
                    db.createObjectStore(this.STORES.PLAYLIST, { keyPath: 'id' });
                }

                // Files store (key: id) - stores Blobs
                if (!db.objectStoreNames.contains(this.STORES.FILES)) {
                    db.createObjectStore(this.STORES.FILES, { keyPath: 'id' });
                }

                // State store (key: key)
                if (!db.objectStoreNames.contains(this.STORES.STATE)) {
                    db.createObjectStore(this.STORES.STATE, { keyPath: 'key' });
                }
            };
        });
    }

    /**
     * Ensure DB is initialized
     */
    async ready() {
        if (!this.db) await this.initPromise;
        return this.db;
    }

    /**
     * Ensure database connection is open and valid
     * Reinitializes if connection is null or closed
     * @private
     */
    async _ensureConnection() {
        await this.ready();
        if (!this.db) {
            Logger.warn('[IndexedDB] Connection not available, reinitializing...');
            this.initPromise = this._init();
            await this.initPromise;
        }
    }

    /**
     * Execute a transaction with automatic retry on InvalidStateError
     * @param {string[]} stores - Store names for transaction
     * @param {string} mode - 'readonly' or 'readwrite'
     * @param {Function} executor - Function receiving (transaction) to execute operations
     * @returns {Promise} Result from executor
     * @private
     */
    async _withTransaction(stores, mode, executor) {
        await this._ensureConnection();

        return new Promise((resolve, reject) => {
            try {
                const transaction = this.db.transaction(stores, mode);
                executor(transaction, resolve, reject);
            } catch (e) {
                // Handle InvalidStateError when connection is closing
                if (e.name === 'InvalidStateError') {
                    Logger.warn('[IndexedDB] Connection was closing, reinitializing and retrying...');
                    this.db = null;
                    this.initPromise = this._init();
                    this.initPromise.then(() => {
                        // Retry the transaction
                        this._withTransaction(stores, mode, executor)
                            .then(resolve)
                            .catch(reject);
                    }).catch(reject);
                } else {
                    reject(e);
                }
            }
        });
    }

    /**
     * Save playlist items and their files
     * @param {Array} items 
     */
    async savePlaylist(items) {
        return this._withTransaction(
            [this.STORES.PLAYLIST, this.STORES.FILES],
            'readwrite',
            (transaction, resolve, reject) => {
                const MAX_SIZE = 500 * 1024 * 1024;
                const persistedItemIds = new Set(); // Track items that were successfully saved to generic file store

                transaction.oncomplete = () => {
                    if (items.length > 0) {
                        localStorage.setItem(this.DB_NAME + '-playlist', 'true');
                    } else {
                        localStorage.removeItem(this.DB_NAME + '-playlist');
                    }

                    // Release file blobs from memory after successful persistence.
                    // Only release if we ACTUALLY saved it to DB.
                    for (const item of items) {
                        if (item.isLocal && item.file && persistedItemIds.has(item.id)) {
                            Logger.log(`[IndexedDB] Releasing memory for persisted file: ${item.title}`);
                            item.file = null;
                        }
                    }

                    resolve();
                };
                transaction.onerror = (event) => reject(event.target.error);

                const playlistStore = transaction.objectStore(this.STORES.PLAYLIST);
                const fileStore = transaction.objectStore(this.STORES.FILES);

                // Clear existing playlist first (simplest approach for now)
                playlistStore.clear();

                // CRITICAL: Do NOT clear fileStore here. 
                // We only want to ADD/UPDATE files that are present in memory.

                items.forEach(item => {
                    // 1. Prepare item for storage
                    const storedItem = {
                        id: item.id,
                        title: item.title,
                        duration: item.duration,
                        thumbnail: item.thumbnail,
                        isLocal: item.isLocal,
                        path: item.path,
                        // Keep URL for remote items, clear for local
                        url: item.isLocal ? '' : item.url,
                        originalIndex: item.originalIndex,
                        fileSize: item.fileSize,
                        fileType: item.fileType,
                        mimeType: item.mimeType,
                        localPath: item.localPath,
                        optimizeDeclined: item.optimizeDeclined
                    };

                    playlistStore.put(storedItem);

                    // 2. If local and has file in memory, save it to files store
                    if (item.isLocal && item.file) {
                        if (item.file.size < MAX_SIZE) {
                            fileStore.put({
                                id: item.id,
                                blob: item.file,
                                name: item.file.name || item.title,
                                type: item.file.type
                            });
                            persistedItemIds.add(item.id);
                        } else {
                            Logger.warn(`[IndexedDB] File ${item.title} too large to persist (${(item.file.size / 1024 / 1024).toFixed(2)} MB)`);
                            // Do NOT add to persistedItemIds, so it stays in memory
                        }
                    }
                });
            }
        );
    }

    /**
     * Load playlist (metadata only, no files)
     * @returns {Promise<Array>}
     */
    async loadPlaylist() {
        return this._withTransaction([this.STORES.PLAYLIST], 'readonly', (transaction, resolve, reject) => {
            const playlistStore = transaction.objectStore(this.STORES.PLAYLIST);
            const itemsRequest = playlistStore.getAll();

            itemsRequest.onsuccess = () => {
                const storedItems = itemsRequest.result;
                const restoredItems = storedItems.map(item => {
                    const restored = { ...item };
                    if (restored.isLocal) {
                        // Local file: Don't load file yet. Set as null.
                        restored.file = null;
                        restored.url = null;
                        restored.needsReload = false; // We assume it exists, will fail on load if not
                    }
                    // Remote URL items keep their URL for re-fetching
                    return restored;
                });
                resolve(restoredItems);
            };

            itemsRequest.onerror = () => reject(itemsRequest.error);
        });
    }

    /**
     * Load a single file by ID
     * @param {string} id 
     * @returns {Promise<File|null>}
     */
    async loadFile(id) {
        return this._withTransaction([this.STORES.FILES], 'readonly', (transaction, resolve, reject) => {
            const fileStore = transaction.objectStore(this.STORES.FILES);
            const request = fileStore.get(id);

            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    const file = new File([result.blob], result.name, { type: result.type });
                    resolve(file);
                } else {
                    resolve(null);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Save a single file to IndexedDB
     * @param {string} id - Item ID
     * @param {Blob} blob - File blob to save
     * @param {string} name - Filename
     * @param {string} type - MIME type
     * @returns {Promise<boolean>} True if saved, false if too large
     */
    async saveFile(id, blob, name, type) {
        // Size limit (500MB)
        const MAX_SIZE = 500 * 1024 * 1024;
        if (blob.size > MAX_SIZE) {
            Logger.warn(`[IndexedDB] File too large to save: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
            return false;
        }

        return this._withTransaction([this.STORES.FILES], 'readwrite', (transaction, resolve, reject) => {
            const fileStore = transaction.objectStore(this.STORES.FILES);

            fileStore.put({
                id: id,
                blob: blob,
                name: name,
                type: type
            });

            transaction.oncomplete = () => {
                Logger.log(`[IndexedDB] File saved: ${name} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
                resolve(true);
            };
            transaction.onerror = () => reject(transaction.error);
        });
    }

    /**
     * Save playback state
     * @param {Object} state 
     */
    async savePlaybackState(state) {
        return this._withTransaction([this.STORES.STATE], 'readwrite', (transaction, resolve, reject) => {
            const store = transaction.objectStore(this.STORES.STATE);
            store.put({ key: 'playback', ...state });
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    /**
     * Load playback state
     */
    async loadPlaybackState() {
        return this._withTransaction([this.STORES.STATE], 'readonly', (transaction, resolve, reject) => {
            const store = transaction.objectStore(this.STORES.STATE);
            const request = store.get('playback');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Clear all data
     */
    async clear() {
        return this._withTransaction(
            [this.STORES.PLAYLIST, this.STORES.FILES, this.STORES.STATE],
            'readwrite',
            (transaction, resolve) => {
                transaction.objectStore(this.STORES.PLAYLIST).clear();
                transaction.objectStore(this.STORES.FILES).clear();
                transaction.objectStore(this.STORES.STATE).clear();
                transaction.oncomplete = () => {
                    localStorage.removeItem(this.DB_NAME + '-playlist');
                    resolve();
                };
            }
        );
    }
}
