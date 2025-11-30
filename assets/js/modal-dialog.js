/**
 * JellyJump Editor - Modal Dialog
 * Reusable modal dialog component.
 * Phase: 36
 */

export class ModalDialog {
    constructor() {
        this.overlay = null;
        this.dialog = null;
        this.focusTrapHandler = null;
    }

    /**
     * Shows a modal dialog
     * @param {string} title 
     * @param {string} message 
     * @param {Array<{text: string, type: string, callback: Function}>} buttons 
     */
    show(title, message, buttons = []) {
        // Remove existing modal if any
        this.close();

        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-overlay';

        // Create dialog container
        this.dialog = document.createElement('div');
        this.dialog.className = 'modal';
        this.dialog.setAttribute('role', 'alertdialog');
        this.dialog.setAttribute('aria-modal', 'true');
        this.dialog.setAttribute('aria-labelledby', 'modal-title');
        this.dialog.setAttribute('aria-describedby', 'modal-message');

        // Content
        this.dialog.innerHTML = `
            <h2 id="modal-title" class="modal__title">${title}</h2>
            <p id="modal-message" class="modal__message">${message}</p>
            <div class="modal__actions"></div>
        `;

        // Add buttons
        const actionsContainer = this.dialog.querySelector('.modal__actions');
        buttons.forEach(btnConfig => {
            const btn = document.createElement('button');
            btn.className = `modal-btn modal-btn--${btnConfig.type || 'secondary'}`;
            btn.textContent = btnConfig.text;
            btn.addEventListener('click', () => {
                if (btnConfig.callback) btnConfig.callback();
                this.close();
            });
            actionsContainer.appendChild(btn);
        });

        this.overlay.appendChild(this.dialog);
        document.body.appendChild(this.overlay);

        // Trap focus
        this.trapFocus(this.dialog);

        // Focus first button
        const firstBtn = actionsContainer.querySelector('button');
        if (firstBtn) firstBtn.focus();

        // Close on Escape
        this.escapeHandler = (e) => {
            if (e.key === 'Escape') {
                // Find cancel button callback if exists, otherwise just close
                const cancelBtn = buttons.find(b => b.type === 'secondary' || b.text.toLowerCase() === 'cancel');
                if (cancelBtn && cancelBtn.callback) cancelBtn.callback();
                this.close();
            }
        };
        document.addEventListener('keydown', this.escapeHandler);
    }

    /**
     * Closes the modal
     */
    close() {
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
            this.dialog = null;
        }
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
            this.escapeHandler = null;
        }
    }

    /**
     * Traps focus within the modal
     * @param {HTMLElement} element 
     */
    trapFocus(element) {
        element.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;

            const focusableElements = element.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey) {
                if (document.activeElement === firstElement) {
                    lastElement.focus();
                    e.preventDefault();
                }
            } else {
                if (document.activeElement === lastElement) {
                    firstElement.focus();
                    e.preventDefault();
                }
            }
        });
    }
}

// Export singleton instance
export const modalDialog = new ModalDialog();
