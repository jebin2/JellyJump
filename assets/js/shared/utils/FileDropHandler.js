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
        this.boundHandlers = new Map();

        this._attachEvents();
    }

    /**
     * Attach drag and drop event listeners
     * @private
     */
    _attachEvents() {
        const section = this.container.closest('.playlist-section') || this.container;

        // Prevent default drag behaviors
        const preventDefaults = (e) => {
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
        const handleDrop = async (e) => {
            const dt = e.dataTransfer;
            const items = dt.items;

            if (items) {
                // Use DataTransferItemList interface to access files and folders
                const files = [];
                const queue = [];

                for (let i = 0; i < items.length; i++) {
                    const entry = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
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
     * @param {FileSystemEntry} entry
     * @returns {Promise<Array<File>>}
     * @static
     */
    static scanEntry(entry) {
        return new Promise((resolve) => {
            if (entry.isFile) {
                entry.file(file => {
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
                dirReader.readEntries(async (entries) => {
                    const promises = entries.map(e => FileDropHandler.scanEntry(e));
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
        if (!this.section) return;

        // Remove all bound handlers
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            const preventHandler = this.boundHandlers.get(`prevent-${eventName}`);
            if (preventHandler) {
                this.section.removeEventListener(eventName, preventHandler, false);
            }
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            const highlightHandler = this.boundHandlers.get(`highlight-${eventName}`);
            if (highlightHandler) {
                this.section.removeEventListener(eventName, highlightHandler, false);
            }
        });

        ['dragleave', 'drop'].forEach(eventName => {
            const unhighlightHandler = this.boundHandlers.get(`unhighlight-${eventName}`);
            if (unhighlightHandler) {
                this.section.removeEventListener(eventName, unhighlightHandler, false);
            }
        });

        const dropHandler = this.boundHandlers.get('drop');
        if (dropHandler) {
            this.section.removeEventListener('drop', dropHandler, false);
        }

        this.boundHandlers.clear();
        this.section = null;
    }
}
