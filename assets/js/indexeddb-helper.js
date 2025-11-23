/**
 * IndexedDB Helper Module
 * Phase 30: Import Media Button
 * 
 * Manages IndexedDB operations for media library storage
 */

const DB_NAME = 'MediaLibraryDB';
const DB_VERSION = 1;
const STORE_NAME = 'media';

class IndexedDBHelper {
    constructor() {
        this.db = null;
    }

    /**
     * Initialize database connection
     * @returns {Promise<IDBDatabase>}
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create media store if it doesn't exist
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    store.createIndex('type', 'type', { unique: false });
                    store.createIndex('dateAdded', 'dateAdded', { unique: false });
                }
            };
        });
    }

    /**
     * Add media item to database
     * @param {Object} mediaItem - Media item with id, name, type, blob, metadata
     * @returns {Promise<string>} - Returns media ID
     */
    async addMedia(mediaItem) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.add(mediaItem);

            request.onsuccess = () => resolve(mediaItem.id);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get media item by ID
     * @param {string} id - Media ID
     * @returns {Promise<Object>}
     */
    async getMedia(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Get all media items of a specific type
     * @param {string} type - 'video', 'audio', or 'image'
     * @returns {Promise<Array>}
     */
    async getAllMediaByType(type) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('type');
            const request = index.getAll(type);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Delete media item by ID
     * @param {string} id - Media ID
     * @returns {Promise<void>}
     */
    async deleteMedia(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * Update media item with thumbnail
     * @param {string} id - Media ID
     * @param {Blob} thumbnailBlob - Thumbnail image blob
     * @returns {Promise<void>}
     */
    async updateMediaThumbnail(id, thumbnailBlob) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            // Get existing media item
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const mediaItem = getRequest.result;
                if (mediaItem) {
                    // Update thumbnail fields
                    mediaItem.thumbnail = thumbnailBlob;
                    mediaItem.thumbnailGenerated = true;

                    // Save updated item
                    const putRequest = store.put(mediaItem);
                    putRequest.onsuccess = () => resolve();
                    putRequest.onerror = () => reject(putRequest.error);
                } else {
                    reject(new Error('Media item not found'));
                }
            };

            getRequest.onerror = () => reject(getRequest.error);
        });
    }
}

// Export singleton instance
export const dbHelper = new IndexedDBHelper();
