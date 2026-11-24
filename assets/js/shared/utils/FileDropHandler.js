// @ts-check
/**
 * File Drop Handler
 * Reusable drag & drop file handler for any container element
 */
export class FileDropHandler {
    /**
     * Create a file drop handler
     * @param {HTMLElement} container - Element to attach drag & drop to
     * @param {Function} onFilesDropped - Callback when files are dropped (receives FileList/Array)
     */
    constructor(container, onFilesDropped) {
        this.container = container;
        this.onFilesDropped = onFilesDropped;
        /** @type {Map<string, EventListener>} */
        this.boundHandlers = new Map();
        /** @type {HTMLElement|null} where the listeners are, once attached */
        this.section = null;

        this._attachEvents();
    }

    /**
     * Attach drag and drop event listeners
     * @private
     */
    _attachEvents() {
        const section = /** @type {HTMLElement} */ (this.container.closest('.playlist-section') || this.container);

        // Prevent default drag behaviors
        const preventDefaults = (/** @type {Event} */ e) => {
            e.preventDefault();
            e.stopPropagation();
        };

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            const handler = preventDefaults;
            section.addEventListener(eventName, handler, false);
            this.boundHandlers.set(`prevent-${eventName}`, handler);
        });

        // Highlight drop zone when dragging over
        const highlight = () => section.classList.add('drag-over');
        ['dragenter', 'dragover'].forEach(eventName => {
            section.addEventListener(eventName, highlight, false);
            this.boundHandlers.set(`highlight-${eventName}`, highlight);
        });

        // Unhighlight when dragging away or dropping
        const unhighlight = () => section.classList.remove('drag-over');
        ['dragleave', 'drop'].forEach(eventName => {
            section.addEventListener(eventName, unhighlight, false);
            this.boundHandlers.set(`unhighlight-${eventName}`, unhighlight);
        });

        // Handle dropped files
        const handleDrop = async (/** @type {Event} */ e) => {
            // A drop event always carries its data.
            const dt = /** @type {DataTransfer} */ (/** @type {DragEvent} */ (e).dataTransfer);
            const items = dt.items;

            if (items) {
                // Use DataTransferItemList interface to access files and folders
                const files = [];
                const queue = [];

                for (let i = 0; i < items.length; i++) {
                    const entry = typeof items[i].webkitGetAsEntry === 'function' ? items[i].webkitGetAsEntry() : null;
                    if (entry) {
                        queue.push(FileDropHandler.scanEntry(entry));
                    } else if (items[i].kind === 'file') {
                        files.push(items[i].getAsFile());
                    }
                }

                const scannedFiles = await Promise.all(queue);
                const flatScanned = scannedFiles.flat();

                // Combine simple files and scanned entries
                const allFiles = [...files, ...flatScanned];
                this.onFilesDropped(allFiles);
            } else {
                // Use DataTransfer interface to access files (fallback)
                this.onFilesDropped(Array.from(dt.files));
            }
        };

        section.addEventListener('drop', handleDrop, false);
        this.boundHandlers.set('drop', handleDrop);
        this.section = section;
    }

    /**
     * Recursively scan a FileSystemEntry (handles folders)
     * @param {any} entry - a FileSystemFileEntry or FileSystemDirectoryEntry
     * @returns {Promise<Array<File>>}
     * @static
     */
    static scanEntry(entry) {
        return new Promise((resolve) => {
            if (entry.isFile) {
                entry.file((/** @type {File} */ file) => {
                    // Patch webkitRelativePath if missing
                    if (!file.webkitRelativePath && entry.fullPath) {
                        Object.defineProperty(file, 'webkitRelativePath', {
                            value: entry.fullPath.substring(1) // Remove leading /
                        });
                    }
                    resolve([file]);
                });
            } else if (entry.isDirectory) {
                const dirReader = entry.createReader();
                dirReader.readEntries(async (/** @type {any[]} */ entries) => {
                    const promises = entries.map((/** @type {any} */ e) => FileDropHandler.scanEntry(e));
                    const results = await Promise.all(promises);
                    resolve(results.flat());
                });
            } else {
                resolve([]);
            }
        });
    }

    /**
     * Clean up event listeners
     */
    destroy() {
        const section = this.section;
        if (!section) return;

        // Remove all bound handlers
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            const preventHandler = this.boundHandlers.get(`prevent-${eventName}`);
            if (preventHandler) {
                section.removeEventListener(eventName, preventHandler, false);
            }
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            const highlightHandler = this.boundHandlers.get(`highlight-${eventName}`);
            if (highlightHandler) {
                section.removeEventListener(eventName, highlightHandler, false);
            }
        });

        ['dragleave', 'drop'].forEach(eventName => {
            const unhighlightHandler = this.boundHandlers.get(`unhighlight-${eventName}`);
            if (unhighlightHandler) {
                section.removeEventListener(eventName, unhighlightHandler, false);
            }
        });

        const dropHandler = this.boundHandlers.get('drop');
        if (dropHandler) {
            section.removeEventListener('drop', dropHandler, false);
        }

        this.boundHandlers.clear();
        this.section = null;
    }
}
