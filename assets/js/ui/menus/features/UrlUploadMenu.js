import { Logger } from '../../../shared/utils/Logger.js';
import { Modal } from '../../Modal.js';
import { Toast } from '../../../shared/utils/Toast.js';

/**
 * URL Upload Menu
 * Handles the UI and validation for adding media from a URL.
 */
export const UrlUploadMenu = {
    /**
     * Open the URL upload modal
     * @param {Playlist} playlist - Playlist instance
     */
    async show(playlist) {
        const contentTemplate = document.getElementById('url-upload-content-template');
        const footerTemplate = document.getElementById('url-upload-footer-template');
        
        if (!contentTemplate || !footerTemplate) {
            Logger.error('UrlUploadMenu: Templates not found!');
            return;
        }

        const modal = new Modal({ maxWidth: '500px' });
        modal.setTitle('Add Video from URL');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(footerTemplate.content.cloneNode(true));

        const modalElement = modal.modal;
        const input = modalElement.querySelector('#url-input');
        const addBtn = modalElement.querySelector('.mb-modal-add');
        const errorDiv = modalElement.querySelector('.mb-modal-error');
        const loadingDiv = modalElement.querySelector('.mb-modal-loading');

        modal.open();

        // Focus input after opening
        setTimeout(() => input.focus(), 100);

        // Validation logic
        const validate = () => {
            const url = input.value.trim();
            const isValid = this._isValidUrl(url);
            addBtn.disabled = !isValid;
            errorDiv.classList.add('hidden');
        };

        input.addEventListener('input', validate);

        // Handle Add action
        const handleAdd = async () => {
            const url = input.value.trim();
            if (!url) return;

            // Update UI to loading state
            // Note: .hidden is display:none !important, so it must be toggled
            // via classList - inline style.display cannot override it.
            input.disabled = true;
            addBtn.disabled = true;
            modal.closeBtn.disabled = true;
            loadingDiv.classList.remove('hidden');
            errorDiv.classList.add('hidden');

            // A shared library streams in, so it has something to show long
            // before it is finished. Closing on the first files means the user
            // watches the playlist fill instead of this dialog's spinner; the
            // rest keeps arriving behind it. Guarded because a failure after
            // this point must not try to revert a dialog that is already gone.
            let closed = false;
            const closeEarly = () => {
                if (closed) return;
                closed = true;
                modal.close();
            };

            try {
                // Delegate the business logic to playlist
                await playlist._handleUrlUpload(url, closeEarly);
                closeEarly();
            } catch (error) {
                if (closed) {
                    Logger.error('UrlUploadMenu: Add failed after the dialog closed', error);
                    Toast.show(`Could not finish adding that link: ${error.message}`, 5000, true);
                    return;
                }
                Logger.error('UrlUploadMenu: Add failed', error);

                // Revert UI state on error
                input.disabled = false;
                addBtn.disabled = false;
                modal.closeBtn.disabled = false;
                loadingDiv.classList.add('hidden');

                errorDiv.textContent = error.message;
                errorDiv.classList.remove('hidden');
            }
        };

        addBtn.addEventListener('click', handleAdd);

        // Keyboard shortcuts
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !addBtn.disabled) {
                handleAdd();
            }
            if (e.key === 'Escape') {
                modal.close();
            }
        });
    },

    /**
     * Validate URL syntax
     * @private
     * @param {string} urlString 
     * @returns {boolean}
     */
    _isValidUrl(urlString) {
        try {
            const url = new URL(urlString);
            return url.protocol === "http:" || url.protocol === "https:";
        } catch (_) {
            return false;
        }
    }
};
