import { Logger } from "../shared/utils/Logger.js";
/**
 * Reusable Modal Component
 * Uses the 'modal-shell-template' to create consistent modals.
 */
export class Modal {
    /**
     * @param {Object} options
     * @param {string} [options.maxWidth] - Custom max-width (e.g. '700px')
     * @param {boolean} [options.splitLayout] - Use split layout (70% video / 30% controls)
     * @param {Function} [options.onClose] - Callback when modal closes
     */
    constructor(options = {}) {
        this.options = options;
        this.overlay = null;
        this.modal = null;
        this.header = null;
        this.title = null;
        this.closeBtn = null;
        this.body = null;
        this.footer = null;
        this._cleanupCallbacks = [];

        this._init();
    }

    _init() {
        const template = document.getElementById('modal-shell-template');
        if (!template) {
            Logger.error('Modal shell template not found');
            return;
        }

        const clone = template.content.cloneNode(true);
        this.overlay = clone.querySelector('.mb-modal-overlay');
        this.modal = clone.querySelector('.mb-modal');
        this.header = clone.querySelector('.mb-modal-header');
        this.title = clone.querySelector('.mb-modal-title');
        this.closeBtn = clone.querySelector('.mb-modal-close');
        this.body = clone.querySelector('.mb-modal-body');
        this.footer = clone.querySelector('.mb-modal-footer');

        if (this.options.maxWidth) {
            this.modal.style.maxWidth = this.options.maxWidth;
        }

        // Split layout for video editing modals
        if (this.options.splitLayout) {
            this.modal.classList.add('mb-modal-split');
        }

        // Close handlers
        this.closeBtn.addEventListener('click', () => this.close());

        // Store handler reference for potential removal by subcomponents
        this.overlay._closeHandler = (e) => {
            if (e.target === this.overlay) this.close();
        };

        // if (this.options.closeOnClickOutside !== false) {
        //     this.overlay.addEventListener('click', this.overlay._closeHandler);
        // }
    }

    /**
     * Set the modal title
     * @param {string} text 
     */
    setTitle(text) {
        if (this.title) this.title.textContent = text;
    }

    /**
     * Set the modal body content
     * @param {HTMLElement|DocumentFragment|string} content 
     */
    setBody(content) {
        if (!this.body) return;
        this.body.innerHTML = '';
        if (typeof content === 'string') {
            this.body.innerHTML = content;
        } else {
            this.body.appendChild(content);
        }
    }

    /**
     * Set the modal footer content
     * @param {HTMLElement|DocumentFragment|string} content 
     */
    setFooter(content) {
        if (!this.footer) return;
        this.footer.innerHTML = '';
        if (content) {
            this.footer.classList.remove('hidden');
            if (typeof content === 'string') {
                this.footer.innerHTML = content;
            } else {
                this.footer.appendChild(content);
            }
        } else {
            this.footer.classList.add('hidden');
        }
    }

    /**
     * Open the modal
     */
    open() {
        if (this.overlay) {
            document.body.appendChild(this.overlay);
            // Optional: Add animation class if needed
        }
    }

    /**
     * Register a cleanup callback to run when the modal closes.
     * Use this to destroy dropdowns, disconnect observers, remove listeners, etc.
     * @param {Function} callback
     */
    onCleanup(callback) {
        if (typeof callback === 'function') {
            this._cleanupCallbacks.push(callback);
        }
    }

    /**
     * Close the modal
     */
    close() {
        // Run registered cleanup callbacks
        for (const cb of this._cleanupCallbacks) {
            try { cb(); } catch (e) { Logger.warn('Modal cleanup error:', e); }
        }
        this._cleanupCallbacks.length = 0;

        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
        }
        if (this.options.onClose) {
            this.options.onClose();
        }

        // Null out references to help GC
        this.overlay = null;
        this.modal = null;
        this.header = null;
        this.title = null;
        this.closeBtn = null;
        this.body = null;
        this.footer = null;
    }

    /**
     * Find an element inside the modal
     * @param {string} selector 
     * @returns {HTMLElement}
     */
    querySelector(selector) {
        return this.overlay ? this.overlay.querySelector(selector) : null;
    }

    /**
     * Find all elements inside the modal
     * @param {string} selector 
     * @returns {NodeList}
     */
    querySelectorAll(selector) {
        return this.overlay ? this.overlay.querySelectorAll(selector) : [];
    }
}
