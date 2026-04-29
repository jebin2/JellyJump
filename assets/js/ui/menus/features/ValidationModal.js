import { Logger } from '../../../shared/utils/Logger.js';

/**
 * Validation Modal
 * Handles the UI for batch stream validation progress.
 */
export class ValidationModal {
    /**
     * Create and show the validation progress modal
     * @param {Object} context - Execution context { items, processor, onComplete, onToast }
     */
    static async show({ items, processor, onComplete, onToast }) {
        if (items.length === 0) {
            if (onToast) onToast('No streams found to validate');
            return;
        }

        const modal = this._createUI(items.length);
        document.body.appendChild(modal.overlay);

        let workingCount = 0;
        let brokenCount = 0;
        let cancelled = false;

        modal.okBtn.onclick = () => {
            cancelled = true;
            this._close(modal);
        };

        await processor.validateStreams(items, (progress, item, isBroken) => {
            if (cancelled) return;

            if (isBroken) {
                brokenCount++;
                // Note: isBroken flag is set on item by processor
            } else {
                workingCount++;
            }

            modal.progressFill.style.width = `${progress * 100}%`;
            modal.status.textContent = `Checking ${Math.round(progress * items.length)} of ${items.length}...`;
            modal.currentItem.textContent = item.title;
            modal.brokenCountEl.textContent = brokenCount;
            modal.workingCountEl.textContent = workingCount;
        });

        if (cancelled) return;

        modal.status.textContent = 'Validation complete!';
        modal.okBtn.textContent = 'OK';
        modal.okBtn.onclick = () => {
            this._close(modal);
            if (onComplete) onComplete(brokenCount, workingCount);
        };

        if (onToast) onToast(`Validation complete: ${brokenCount} broken, ${workingCount} working`);
    }

    /**
     * Create validation progress modal elements
     * @private
     */
    static _createUI(totalCount) {
        const overlay = document.createElement('div');
        overlay.className = 'mb-modal-overlay';
        overlay.innerHTML = `
            <div class="mb-modal" style="max-width: 400px;">
                <div class="mb-modal-header">
                    <h3>Validating Streams</h3>
                </div>
                <div class="validation-modal-content">
                    <div class="validation-progress-container">
                        <div class="validation-progress-bar">
                            <div class="validation-progress-fill"></div>
                        </div>
                        <div class="validation-status">Preparing...</div>
                    </div>
                    <div class="validation-current-item">Starting...</div>
                    <div class="validation-stats">
                        <div class="validation-stat">
                            <span class="label">Working:</span>
                            <span class="value working-count">0</span>
                        </div>
                        <div class="validation-stat">
                            <span class="label">Broken:</span>
                            <span class="value broken-count">0</span>
                        </div>
                    </div>
                </div>
                <div class="mb-modal-footer">
                    <button class="mb-btn mb-btn-secondary ok-btn">Cancel</button>
                </div>
            </div>
        `;

        return {
            overlay,
            progressFill: overlay.querySelector('.validation-progress-fill'),
            status: overlay.querySelector('.validation-status'),
            currentItem: overlay.querySelector('.validation-current-item'),
            workingCountEl: overlay.querySelector('.working-count'),
            brokenCountEl: overlay.querySelector('.broken-count'),
            okBtn: overlay.querySelector('.ok-btn')
        };
    }

    /**
     * Close the modal
     * @private
     */
    static _close(modal) {
        modal.overlay.remove();
    }
}
