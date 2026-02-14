import { Logger } from '../../utils/Logger.js';
import { Modal } from '../Modal.js';
import { CryptoHelper } from '../../utils/CryptoHelper.js';
import { MediaMetadata } from '../../utils/MediaMetadata.js';
import { createProcessFooter, FOOTER_CONFIGS } from '../../utils/FooterHelper.js';

/**
 * Encrypt Menu Handler
 * Encrypts or decrypts MP4 video files by XOR'ing the mdat box data
 * with a password-derived keystream.
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
        modal.setTitle('Encrypt / Decrypt Video');
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

        const modeRadios = modalContent.querySelectorAll('input[name="encrypt-mode"]');
        const modeLabels = modalContent.querySelectorAll('.encrypt-mode-label');
        const passwordInput = modalContent.querySelector('.encrypt-password');
        const confirmInput = modalContent.querySelector('.encrypt-confirm');
        const confirmSection = modalContent.querySelector('.encrypt-confirm-section');
        const infoText = modalContent.querySelector('.encrypt-info-text');

        const actionIconUse = modalContent.querySelector('.action-icon-use');

        let currentMode = 'encrypt';

        // Mode toggle styling
        const updateModeUI = () => {
            modeLabels.forEach(label => {
                const radio = label.querySelector('input');
                if (radio.checked) {
                    label.classList.add('active');
                } else {
                    label.classList.remove('active');
                }
            });

            if (currentMode === 'encrypt') {
                confirmSection.classList.remove('hidden');
                encryptBtn.title = 'Encrypt';
                encryptBtn.setAttribute('aria-label', 'Encrypt');
                if (actionIconUse) actionIconUse.setAttribute('href', 'assets/icons/sprite.svg#icon-lock');
                infoText.textContent = 'Encrypts the video\'s media data with a password. The file remains a valid MP4 but plays as corrupted noise. Only the correct password can restore the original.';
            } else {
                confirmSection.classList.add('hidden');
                encryptBtn.title = 'Decrypt';
                encryptBtn.setAttribute('aria-label', 'Decrypt');
                if (actionIconUse) actionIconUse.setAttribute('href', 'assets/icons/sprite.svg#icon-lock-open');
                infoText.textContent = 'Decrypts a previously encrypted video. Enter the same password used to encrypt it. A wrong password will produce garbage output without any error.';
            }
        };

        modeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                currentMode = radio.value;
                updateModeUI();
                errorMessage.classList.add('hidden');
            });
        });

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
            modeRadios.forEach(r => r.disabled = true);
            errorMessage.classList.add('hidden');
            successMessage.classList.add('hidden');
            downloadBtn.classList.add('hidden');
            progressSection.classList.remove('hidden');

            try {
                const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());

                const onProgress = (progress) => {
                    progressPercentage.textContent = Math.round(progress * 100) + '%';
                };

                let resultBlob;
                if (currentMode === 'encrypt') {
                    resultBlob = await CryptoHelper.encrypt(source, password, onProgress);
                } else {
                    resultBlob = await CryptoHelper.decrypt(source, password, onProgress);
                }

                // Build result filename
                const suffix = currentMode === 'encrypt' ? '-encrypted' : '-decrypted';
                const newFilename = item.title.replace(/\.[^/.]+$/, '') + suffix + '.mp4';

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
            modeRadios.forEach(r => r.disabled = false);
        });

        modal.open();
    }
}
