/**
 * IndexedDB Service
 * Handles persistence of playlist, files, and player state using IndexedDB.
 * Allows storing large binary data (Blobs) which localStorage cannot handle.
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
                console.error('IndexedDB error:', event.target.error);
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
     * Save playlist items and their files
     * @param {Array} items 
     */
    async savePlaylist(items) {
        await this.ready();

        // Check if database connection is still open
        if (!this.db || this.db.statechanged) {
            console.warn('IndexedDB connection not available, skipping savePlaylist');
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORES.PLAYLIST, this.STORES.FILES], 'readwrite');

            transaction.oncomplete = () => {
                if (items.length > 0) {
                    localStorage.setItem(this.DB_NAME + '-playlist', 'true');
                } else {
                    localStorage.removeItem(this.DB_NAME + '-playlist');
                }
                resolve();
            };
            transaction.onerror = (event) => reject(event.target.error);

            const playlistStore = transaction.objectStore(this.STORES.PLAYLIST);
            const fileStore = transaction.objectStore(this.STORES.FILES);

            // Clear existing playlist first (simplest approach for now)
            // Ideally we'd diff, but clearing is safer to ensure sync
            // Clear existing playlist first (simplest approach for now)
            // Ideally we'd diff, but clearing is safer to ensure sync
            playlistStore.clear();

            // CRITICAL: Do NOT clear fileStore here. 
            // Since we unload files from memory to save RAM, clearing the store would delete 
            // the persisted files for items that are currently unloaded (item.file is null).
            // We only want to ADD/UPDATE files that are present in memory.
            // Garbage collection of unused files should be a separate process if needed.
            // fileStore.clear();

            items.forEach(item => {
                // 1. Prepare item for storage
                const storedItem = {
                    id: item.id,
                    title: item.title,
                    duration: item.duration,
                    thumbnail: item.thumbnail,
                    isLocal: item.isLocal,
                    path: item.path,
                    url: item.isLocal ? '' : item.url, // Remote URLs kept, local cleared
                    originalIndex: item.originalIndex
                };

                playlistStore.put(storedItem);

                // 2. If local and has file in memory, save it to files store
                // Note: Most files are already in DB via saveFile() from MediaMetadata
                // This handles files that were added via file input (not downloaded)
                if (item.isLocal && item.file) {
                    // Check size limit (500MB)
                    const MAX_SIZE = 500 * 1024 * 1024;
                    if (item.file.size < MAX_SIZE) {
                        fileStore.put({
                            id: item.id,
                            blob: item.file,
                            name: item.file.name || item.title,
                            type: item.file.type
                        });
                    } else {
                        console.warn(`[IndexedDB] File ${item.title} too large to persist (${(item.file.size / 1024 / 1024).toFixed(2)} MB)`);
                    }
                }
            });
        });
    }

    /**
     * Load playlist and restore files
     * @returns {Promise<Array>}
     */
    /**
     * Load playlist (metadata only, no files)
     * @returns {Promise<Array>}
     */
    async loadPlaylist() {
        await this.ready();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORES.PLAYLIST], 'readonly');
            const playlistStore = transaction.objectStore(this.STORES.PLAYLIST);
            const itemsRequest = playlistStore.getAll();

            itemsRequest.onsuccess = () => {
                const storedItems = itemsRequest.result;
                const restoredItems = storedItems.map(item => {
                    const restored = { ...item };
                    if (restored.isLocal) {
                        // Don't load file yet. Set as null.
                        restored.file = null;
                        restored.url = null;
                        restored.needsReload = false; // We assume it exists, will fail on load if not
                    }
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
        await this.ready();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORES.FILES], 'readonly');
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
        await this.ready();

        // Size limit (500MB)
        const MAX_SIZE = 500 * 1024 * 1024;
        if (blob.size > MAX_SIZE) {
            console.warn(`[IndexedDB] File too large to save: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
            return false;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORES.FILES], 'readwrite');
            const fileStore = transaction.objectStore(this.STORES.FILES);

            fileStore.put({
                id: id,
                blob: blob,
                name: name,
                type: type
            });

            transaction.oncomplete = () => {
                console.log(`[IndexedDB] File saved: ${name} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
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
        await this.ready();

        // Check if database connection is still open
        if (!this.db || this.db.statechanged) {
            console.warn('IndexedDB connection not available, skipping savePlaybackState');
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORES.STATE], 'readwrite');
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
        await this.ready();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORES.STATE], 'readonly');
            const store = transaction.objectStore(this.STORES.STATE);
            const request = store.get('playback');
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async clear() {
        await this.ready();
        const transaction = this.db.transaction([this.STORES.PLAYLIST, this.STORES.FILES, this.STORES.STATE], 'readwrite');
        transaction.objectStore(this.STORES.PLAYLIST).clear();
        transaction.objectStore(this.STORES.FILES).clear();
        transaction.objectStore(this.STORES.STATE).clear();
        return new Promise((resolve) => {
            transaction.oncomplete = () => {
                localStorage.removeItem(this.DB_NAME + '-playlist');
                resolve();
            };
        });
    }
}
