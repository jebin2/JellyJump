import { Logger } from '../utils/Logger.js';

/**
 * DesktopMediaScanner
 * Drives the scanner utilityProcess over IPC (see desktop/scanner.js).
 *
 * Results arrive as a stream of batches rather than one resolved array, so a
 * large tree fills the list in as it is walked instead of leaving it empty
 * until the whole scan finishes.
 */
export class DesktopMediaScanner {
    constructor() {
        this._unsubscribe = null;
        this._scanning = false;
    }

    static isSupported() {
        return typeof window !== 'undefined' && !!window.electronAPI?.startMediaScan;
    }

    get isScanning() {
        return this._scanning;
    }

    /**
     * Start a scan.
     * @param {Object} handlers
     * @param {Function} [handlers.onBatch] - called with an array of file records
     * @param {Function} [handlers.onDone] - called with { found, scanned, cancelled, elapsedMs }
     * @param {Function} [handlers.onError] - called with an Error
     * @param {string[]} [handlers.roots] - defaults to the platform's media folders
     */
    async scan({ onBatch, onLinkList, onDone, onError, onPhase, roots } = {}) {
        if (this._scanning) return;
        this._scanning = true;

        const finish = (summary) => {
            this._scanning = false;
            this._unsubscribe?.();
            this._unsubscribe = null;
            onDone?.(summary);
        };

        this._unsubscribe = window.electronAPI.onMediaScanEvent((event) => {
            switch (event?.type) {
                case 'started':
                    Logger.log(`[Scanner] Scanning ${event.roots.length} folder(s)`);
                    break;
                case 'phase':
                    Logger.log(`[Scanner] Pass ${event.phase}: ${event.roots.join(', ')}`);
                    onPhase?.(event.phase);
                    break;
                case 'batch':
                    onBatch?.(event.files);
                    break;
                case 'linklist':
                    onLinkList?.(event.file);
                    break;
                case 'done':
                    Logger.log(`[Scanner] Found ${event.found} video(s) in ${event.scanned} file(s), ${event.elapsedMs}ms`);
                    finish(event);
                    break;
                case 'error':
                    Logger.error('[Scanner]', event.message);
                    onError?.(new Error(event.message));
                    // An error is terminal for the scan; without this the caller
                    // would wait on a 'done' that is never coming.
                    finish({ found: 0, scanned: 0, cancelled: true, elapsedMs: 0 });
                    break;
            }
        });

        const result = await window.electronAPI.startMediaScan({ roots });
        if (!result?.success) {
            const error = new Error(result?.error || 'Failed to start media scan');
            Logger.error('[Scanner]', error.message);
            onError?.(error);
            finish({ found: 0, scanned: 0, cancelled: true, elapsedMs: 0 });
        }
    }

    async cancel() {
        if (!this._scanning) return;
        await window.electronAPI.cancelMediaScan();
    }
}
