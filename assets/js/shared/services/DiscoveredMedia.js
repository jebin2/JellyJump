import { Logger } from '../utils/Logger.js';
import { MediaScanner } from './MediaScanner.js';

/**
 * DiscoveredMedia
 * In-memory list of video files found by a scan.
 *
 * Deliberately separate from the saved playlist. A scan can surface hundreds of
 * files; folding those into the playlist would bury whatever the user had
 * arranged, and the desktop playlist is persisted by rewriting jellyjump.json
 * in full on every change — so thousands of discovered entries would turn every
 * reorder into a multi-megabyte write. Discovered files live here until the
 * user explicitly moves one into the playlist.
 *
 * Nothing here is persisted: rescanning the standard media folders is cheap,
 * and a stale index is worse than no index.
 */
export class DiscoveredMedia {
    constructor() {
        this._byPath = new Map();
        this._listeners = new Set();
        this._scanner = new MediaScanner();
        this._lastSummary = null;
    }

    static isSupported() {
        return MediaScanner.isSupported();
    }

    /** @returns {Array} discovered files, newest-modified first */
    get items() {
        return [...this._byPath.values()].sort((a, b) => b.mtime - a.mtime);
    }

    get size() {
        return this._byPath.size;
    }

    get isScanning() {
        return this._scanner.isScanning;
    }

    get lastSummary() {
        return this._lastSummary;
    }

    /**
     * Subscribe to changes. Fires on every batch and once when a scan ends.
     * @returns {Function} unsubscribe
     */
    subscribe(listener) {
        this._listeners.add(listener);
        return () => this._listeners.delete(listener);
    }

    _emit(event) {
        for (const listener of this._listeners) {
            try {
                listener(event);
            } catch (error) {
                Logger.error('[DiscoveredMedia] Listener threw:', error);
            }
        }
    }

    /**
     * Run a scan, merging results in as they stream back.
     * Re-scanning replaces nothing: entries are keyed by path, so a file seen
     * again simply updates in place and files that moved are added alongside.
     */
    async scan(options = {}) {
        if (this._scanner.isScanning) return;

        await this._scanner.scan({
            ...options,
            onBatch: (files) => {
                for (const file of files) {
                    this._byPath.set(file.path, file);
                }
                this._emit({ type: 'batch', added: files.length, total: this._byPath.size });
            },
            onDone: (summary) => {
                this._lastSummary = summary;
                this._emit({ type: 'done', summary, total: this._byPath.size });
            },
            onError: (error) => {
                this._emit({ type: 'error', error });
            },
        });
    }

    async cancel() {
        await this._scanner.cancel();
    }

    clear() {
        this._byPath.clear();
        this._emit({ type: 'cleared', total: 0 });
    }
}
