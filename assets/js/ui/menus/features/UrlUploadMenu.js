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
            errorDiv.style.display = 'none';
        };

        input.addEventListener('input', validate);

        // Handle Add action
        const handleAdd = async () => {
            const url = input.value.trim();
            if (!url) return;

            // Update UI to loading state
            input.disabled = true;
            addBtn.disabled = true;
            modal.closeBtn.disabled = true;
            loadingDiv.style.display = 'flex';
            errorDiv.style.display = 'none';

            try {
                // Delegate the business logic to playlist
                await playlist._handleUrlUpload(url);
                modal.close();
            } catch (error) {
                Logger.error('UrlUploadMenu: Add failed', error);
                
                // Revert UI state on error
                input.disabled = false;
                addBtn.disabled = false;
                modal.closeBtn.disabled = false;
                loadingDiv.style.display = 'none';
                
                errorDiv.textContent = error.message;
                errorDiv.style.display = 'block';
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
