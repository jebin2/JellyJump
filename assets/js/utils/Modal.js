/**
 * Modal Utility
 * Reusable modal dialog component for confirmations, alerts, and custom content
 */
export class Modal {
    // Lock to prevent multiple modals from showing at once
    static _isOpen = false;

    /**
     * Show a confirmation modal
     * @param {Object} options - Modal options
     * @param {string} options.title - Modal title
     * @param {string} options.message - Modal message
     * @param {string} [options.confirmText='OK'] - Confirm button text
     * @param {string} [options.cancelText='Cancel'] - Cancel button text
     * @param {string} [options.confirmStyle='primary'] - Confirm button style: 'primary', 'danger', 'secondary'
     * @param {string} [options.icon='⚠️'] - Icon to show in title
     * @returns {Promise<boolean>} - Resolves true if confirmed, false if cancelled
     */
    static confirm({
        title = 'Confirm',
        message = '',
        confirmText = 'OK',
        cancelText = 'Cancel',
        confirmStyle = 'primary',
        icon = '⚠️'
    } = {}) {
        // Skip if a modal is already open
        if (this._isOpen) {
            console.log('Modal already open, skipping');
            return Promise.resolve(false);
        }
        this._isOpen = true;
        return new Promise((resolve) => {
            const overlay = this._createOverlay();
            const modal = this._createModal();

            // Title
            const titleEl = document.createElement('h2');
            titleEl.className = 'modal__title';
            titleEl.style.setProperty('--modal-icon', `"${icon}"`);
            titleEl.innerHTML = `<span class="modal__icon">${icon}</span> ${this._escapeHtml(title)}`;

            // Message
            const messageEl = document.createElement('p');
            messageEl.className = 'modal__message';
            messageEl.textContent = message;

            // Actions
            const actionsEl = document.createElement('div');
            actionsEl.className = 'modal__actions';

            // Cancel button
            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'modal-btn modal-btn--secondary';
            cancelBtn.textContent = cancelText;
            cancelBtn.onclick = () => {
                this._close(overlay);
                resolve(false);
            };

            // Confirm button
            const confirmBtn = document.createElement('button');
            confirmBtn.className = `modal-btn modal-btn--${confirmStyle}`;
            confirmBtn.textContent = confirmText;
            confirmBtn.onclick = () => {
                this._close(overlay);
                resolve(true);
            };

            actionsEl.appendChild(cancelBtn);
            actionsEl.appendChild(confirmBtn);

            modal.appendChild(titleEl);
            modal.appendChild(messageEl);
            modal.appendChild(actionsEl);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Cleanup function
            let keydownHandler = null;
            const cleanup = () => {
                if (keydownHandler) {
                    document.removeEventListener('keydown', keydownHandler);
                }
            };

            // Delay before attaching event listeners to prevent initialization race conditions
            setTimeout(() => {
                // Focus confirm button
                confirmBtn.focus();

                // Handle escape key
                keydownHandler = (e) => {
                    if (e.key === 'Escape') {
                        cleanup();
                        this._close(overlay);
                        resolve(false);
                    }
                };
                document.addEventListener('keydown', keydownHandler);

                // Handle overlay click
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        cleanup();
                        this._close(overlay);
                        resolve(false);
                    }
                });

                // Update button handlers to cleanup
                cancelBtn.onclick = () => {
                    cleanup();
                    this._close(overlay);
                    resolve(false);
                };
                confirmBtn.onclick = () => {
                    cleanup();
                    this._close(overlay);
                    resolve(true);
                };
            }, 50);
        });
    }

    /**
     * Show an alert modal (single button)
     * @param {Object} options - Modal options
     * @param {string} options.title - Modal title
     * @param {string} options.message - Modal message
     * @param {string} [options.buttonText='OK'] - Button text
     * @param {string} [options.buttonStyle='primary'] - Button style
     * @param {string} [options.icon='ℹ️'] - Icon to show in title
     * @returns {Promise<void>}
     */
    static alert({
        title = 'Alert',
        message = '',
        buttonText = 'OK',
        buttonStyle = 'primary',
        icon = 'ℹ️'
    } = {}) {
        return new Promise((resolve) => {
            const overlay = this._createOverlay();
            const modal = this._createModal();

            // Title
            const titleEl = document.createElement('h2');
            titleEl.className = 'modal__title';
            titleEl.innerHTML = `<span class="modal__icon">${icon}</span> ${this._escapeHtml(title)}`;

            // Message
            const messageEl = document.createElement('p');
            messageEl.className = 'modal__message';
            messageEl.textContent = message;

            // Actions
            const actionsEl = document.createElement('div');
            actionsEl.className = 'modal__actions';

            // OK button
            const okBtn = document.createElement('button');
            okBtn.className = `modal-btn modal-btn--${buttonStyle}`;
            okBtn.textContent = buttonText;
            okBtn.onclick = () => {
                this._close(overlay);
                resolve();
            };

            actionsEl.appendChild(okBtn);

            modal.appendChild(titleEl);
            modal.appendChild(messageEl);
            modal.appendChild(actionsEl);
            overlay.appendChild(modal);
            document.body.appendChild(overlay);

            // Focus button
            okBtn.focus();

            // Handle escape key
            const handleKeydown = (e) => {
                if (e.key === 'Escape') {
                    this._close(overlay);
                    document.removeEventListener('keydown', handleKeydown);
                    resolve();
                }
            };
            document.addEventListener('keydown', handleKeydown);
        });
    }

    /**
     * Create modal overlay element
     * @private
     */
    static _createOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        return overlay;
    }

    /**
     * Create modal container element
     * @private
     */
    static _createModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        return modal;
    }

    /**
     * Close and remove modal
     * @param {HTMLElement} overlay 
     * @private
     */
    static _close(overlay) {
        overlay.classList.add('closing');
        setTimeout(() => {
            overlay.remove();
            this._isOpen = false; // Reset lock after modal is removed
        }, 200);
    }

    /**
     * Escape HTML to prevent XSS
     * @param {string} text 
     * @private
     */
    static _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
