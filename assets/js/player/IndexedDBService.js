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
            playlistStore.clear();
            // We don't clear files immediately to avoid deleting files that are still needed
            // But for simplicity in this phase, we'll clear and rewrite. 
            // Optimization: Only delete files that are no longer in the playlist.
            fileStore.clear();

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

                // 2. If local and has file, save the file blob
                if (item.isLocal && item.file) {
                    // Check size limit (e.g., 500MB)
                    if (item.file.size < 500 * 1024 * 1024) {
                        fileStore.put({
                            id: item.id,
                            blob: item.file,
                            name: item.file.name,
                            type: item.file.type
                        });
                    } else {
                        console.warn(`File ${item.title} too large to persist (${(item.file.size / 1024 / 1024).toFixed(2)} MB)`);
                    }
                }
            });
        });
    }

    /**
     * Load playlist and restore files
     * @returns {Promise<Array>}
     */
    async loadPlaylist() {
        await this.ready();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.STORES.PLAYLIST, this.STORES.FILES], 'readonly');
            const playlistStore = transaction.objectStore(this.STORES.PLAYLIST);
            const fileStore = transaction.objectStore(this.STORES.FILES);

            const itemsRequest = playlistStore.getAll();

            itemsRequest.onsuccess = async () => {
                const storedItems = itemsRequest.result;
                const restoredItems = [];

                // We need to fetch files for local items
                // Since we can't await inside the transaction easily for all, 
                // we'll collect promises or do it in a way that keeps transaction active?
                // Actually, 'getAll' on files might be heavy. Let's get individual files.

                // Better approach: Get all items, then for each local item, get its file.
                // Note: Transaction might commit if we await. 
                // So let's fetch all files if possible or open a new transaction if needed.
                // For safety, let's just fetch all files now (assuming playlist isn't huge).

                const filesRequest = fileStore.getAll();

                filesRequest.onsuccess = () => {
                    const files = filesRequest.result;
                    const fileMap = new Map(files.map(f => [f.id, f]));

                    storedItems.forEach(item => {
                        const restored = { ...item };

                        if (restored.isLocal) {
                            const fileData = fileMap.get(item.id);
                            if (fileData) {
                                // Reconstruct File object
                                restored.file = new File([fileData.blob], fileData.name, { type: fileData.type });
                                restored.url = URL.createObjectURL(restored.file);
                                restored.needsReload = false;
                            } else {
                                restored.needsReload = true; // File missing or too large
                            }
                        }

                        restoredItems.push(restored);
                    });

                    // Sort by original index if needed, or rely on array order
                    resolve(restoredItems);
                };

                filesRequest.onerror = () => reject(filesRequest.error);
            };

            itemsRequest.onerror = () => reject(itemsRequest.error);
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
