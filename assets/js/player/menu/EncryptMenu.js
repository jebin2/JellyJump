import { Logger } from '../../utils/Logger.js';
import { Modal } from '../Modal.js';
import { CryptoHelper } from '../../utils/CryptoHelper.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { createProcessFooter, FOOTER_CONFIGS } from '../../utils/FooterHelper.js';

/**
 * Encrypt Menu Handler
 * Encrypts or decrypts files using a playable placeholder + AES-CTR + HMAC format.
 */
export class EncryptMenu {
    /**
     * Initialize and open Encrypt/Decrypt modal
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(item, playlist) {
        const contentTemplate = document.getElementById('encrypt-content-template');

        Logger.log('Opening Encrypt Modal');
        if (!contentTemplate) {
            Logger.error('Encrypt content template not found!');
            return;
        }

        const modal = new Modal({ maxWidth: '500px' });
        modal.setTitle('Encrypt / Decrypt');
        modal.setBody(contentTemplate.content.cloneNode(true));
        modal.setFooter(createProcessFooter(FOOTER_CONFIGS.encrypt));

        const modalContent = modal.modal;

        // Elements
        const encryptBtn = modalContent.querySelector('.encrypt-btn');
        const downloadBtn = modalContent.querySelector('.download-btn');
        const progressSection = modalContent.querySelector('.progress-section');
        const progressPercentage = modalContent.querySelector('.progress-percentage');
        const successMessage = modalContent.querySelector('.success-message');
        const errorMessage = modalContent.querySelector('.error-message');

        const toggleCheckbox = modalContent.querySelector('.encrypt-mode-checkbox');
        const passwordInput = modalContent.querySelector('.encrypt-password');
        const confirmInput = modalContent.querySelector('.encrypt-confirm');
        const confirmSection = modalContent.querySelector('.encrypt-confirm-section');
        const hintInput = modalContent.querySelector('.encrypt-hint');
        const hintSection = modalContent.querySelector('.encrypt-hint-section');
        const hintDisplay = modalContent.querySelector('.encrypt-hint-display');
        const hintValue = modalContent.querySelector('.encrypt-hint-value');
        const infoText = modalContent.querySelector('.encrypt-info-text');

        const actionIconUse = modalContent.querySelector('.action-icon-use');

        let currentMode = 'encrypt';
        let fileMetadata = null;

        const updateModeUI = () => {
            if (currentMode === 'encrypt') {
                confirmSection.classList.remove('hidden');
                hintSection.classList.remove('hidden');
                hintDisplay.classList.add('hidden');
                encryptBtn.title = 'Encrypt';
                encryptBtn.setAttribute('aria-label', 'Encrypt');
                if (actionIconUse) actionIconUse.setAttribute('href', 'assets/icons/sprite.svg#icon-lock');
                infoText.textContent = 'Encrypts the file with a password. The output plays a short "encrypted" message in external players (VLC, etc). Only the correct password can restore the original.';
            } else {
                confirmSection.classList.add('hidden');
                hintSection.classList.add('hidden');
                encryptBtn.title = 'Decrypt';
                encryptBtn.setAttribute('aria-label', 'Decrypt');
                if (actionIconUse) actionIconUse.setAttribute('href', 'assets/icons/sprite.svg#icon-lock-open');
                infoText.textContent = 'Decrypts a previously encrypted file. Enter the same password used to encrypt it.';

                // Show hint if available from file metadata
                if (fileMetadata && fileMetadata.hint) {
                    hintValue.textContent = fileMetadata.hint;
                    hintDisplay.classList.remove('hidden');
                } else {
                    hintDisplay.classList.add('hidden');
                }
            }
        };

        toggleCheckbox.addEventListener('change', () => {
            currentMode = toggleCheckbox.checked ? 'decrypt' : 'encrypt';
            updateModeUI();
            errorMessage.classList.add('hidden');
        });

        // Try to read metadata from the file (for hint display in decrypt mode)
        try {
            const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());
            fileMetadata = await CryptoHelper.readMetadata(source);
            if (fileMetadata) {
                Logger.log(`[EncryptMenu] File metadata: ${JSON.stringify(fileMetadata)}`);
            }
        } catch (e) {
            Logger.log(`[EncryptMenu] Could not read metadata: ${e.message}`);
        }

        updateModeUI();

        // Process handler
        encryptBtn.addEventListener('click', async () => {
            const password = passwordInput.value;

            // Validate
            if (!password) {
                errorMessage.textContent = 'Please enter a password.';
                errorMessage.classList.remove('hidden');
                return;
            }

            if (currentMode === 'encrypt' && password !== confirmInput.value) {
                errorMessage.textContent = 'Passwords do not match.';
                errorMessage.classList.remove('hidden');
                return;
            }

            // Disable UI
            encryptBtn.disabled = true;
            modal.closeBtn.disabled = true;
            passwordInput.disabled = true;
            confirmInput.disabled = true;
            hintInput.disabled = true;
            toggleCheckbox.disabled = true;
            errorMessage.classList.add('hidden');
            successMessage.classList.add('hidden');
            downloadBtn.classList.add('hidden');
            progressSection.classList.remove('hidden');

            try {
                const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());

                const onProgress = (progress) => {
                    progressPercentage.textContent = Math.round(progress * 100) + '%';
                };

                let resultBlob, newFilename;

                if (currentMode === 'encrypt') {
                    resultBlob = await CryptoHelper.encrypt(source, password, {
                        filename: item.title,
                        mimeType: source.type || item.type || 'video/mp4',
                        hint: hintInput.value.trim() || undefined,
                        onProgress,
                    });
                    newFilename = item.title.replace(/\.[^/.]+$/, '') + '-encrypted.mp4';
                } else {
                    const result = await CryptoHelper.decrypt(source, password, onProgress);
                    resultBlob = result.blob;
                    // Restore original filename from metadata, or fall back
                    newFilename = result.metadata.name || (item.title.replace(/\.[^/.]+$/, '') + '-decrypted.mp4');
                }

                // Add to playlist
                const { url } = playlist.insertProcessedItem(item, resultBlob, newFilename);

                // Update download button
                if (downloadBtn) {
                    downloadBtn.href = url;
                    downloadBtn.download = newFilename;
                }

                // Success UI
                successMessage.classList.remove('hidden');
                progressSection.classList.add('hidden');
                downloadBtn.classList.remove('hidden');
                downloadBtn.title = `Download ${currentMode === 'encrypt' ? 'Encrypted' : 'Decrypted'}`;

            } catch (error) {
                Logger.error('Encrypt/Decrypt failed:', error);
                errorMessage.textContent = `Operation failed: ${error.message}`;
                errorMessage.classList.remove('hidden');
                progressSection.classList.add('hidden');
            }

            // Re-enable UI
            encryptBtn.disabled = false;
            modal.closeBtn.disabled = false;
            passwordInput.disabled = false;
            confirmInput.disabled = false;
            hintInput.disabled = false;
            toggleCheckbox.disabled = false;
        });

        modal.open();
    }
}
