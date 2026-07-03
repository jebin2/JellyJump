import { Logger } from '../../../shared/utils/Logger.js';
import { PlatformCrypto } from '../../../shared/utils/PlatformCrypto.js';
import { MediaMetadata } from '../../../shared/utils/MediaMetadata.js';
import { openProcessMenu, FOOTER_CONFIGS } from '../core/MenuFactory.js';

export class EncryptMenu {
    static async init(item, playlist) {
        Logger.log('Opening Encrypt Modal');
        const { modal, content: modalContent } = openProcessMenu(
            'Encrypt / Decrypt', 'encrypt-content-template',
            FOOTER_CONFIGS.encrypt, { maxWidth: '500px' }
        );
        if (!modal) return;

        // ── Elements ────────────────────────────────────────────────────────
        const encryptBtn        = modalContent.querySelector('.encrypt-btn');
        const downloadBtn       = modalContent.querySelector('.download-btn');
        const progressSection   = modalContent.querySelector('.progress-section');
        const progressPct       = modalContent.querySelector('.progress-percentage');
        const successMessage    = modalContent.querySelector('.success-message');
        const errorMessage      = modalContent.querySelector('.error-message');

        const toggleCheckbox    = modalContent.querySelector('.encrypt-mode-checkbox');
        const passwordInput     = modalContent.querySelector('.encrypt-password');
        const confirmInput      = modalContent.querySelector('.encrypt-confirm');
        const confirmSection    = modalContent.querySelector('.encrypt-confirm-section');
        const hintInput         = modalContent.querySelector('.encrypt-hint');
        const hintSection       = modalContent.querySelector('.encrypt-hint-section');
        const hintDisplay       = modalContent.querySelector('.encrypt-hint-display');
        const hintValue         = modalContent.querySelector('.encrypt-hint-value');
        const infoText          = modalContent.querySelector('.encrypt-info-text');
        const actionIconUse     = modalContent.querySelector('.action-icon-use');

        const platformDuration  = modalContent.querySelector('.encrypt-platform-duration');
        const platformSection   = modalContent.querySelector('.encrypt-platform-section');
        const platformLabel     = modalContent.querySelector('.encrypt-platform-label');
        const platformInfo      = modalContent.querySelector('.encrypt-platform-info');

        let currentMode  = 'encrypt';
        let fileMetadata = null;
        let sourceBlob   = null; // cached for duration estimate

        // The re-encoding-resistant carrier has a physical ~20 MB ceiling.
        const tooLarge = () =>
            sourceBlob && sourceBlob.size > PlatformCrypto.MAX_PAYLOAD_BYTES;

        const updatePlatformUI = () => {
            if (!platformSection) return;
            platformSection.style.display = currentMode === 'encrypt' ? '' : 'none';
            if (currentMode !== 'encrypt' || !sourceBlob) return;

            if (tooLarge()) {
                const maxMb = Math.floor(PlatformCrypto.MAX_PAYLOAD_BYTES / 1048576);
                if (platformLabel) platformLabel.textContent = 'FILE TOO LARGE';
                if (platformInfo) {
                    platformInfo.textContent =
                        `This file exceeds the ~${maxMb} MB limit for the re-encoding-resistant ` +
                        'format. Encryption is disabled — the carrier video would be impractically large.';
                }
                if (encryptBtn) encryptBtn.disabled = true;
            } else {
                if (encryptBtn) encryptBtn.disabled = false;
                if (platformLabel) platformLabel.textContent = 'RE-ENCODING RESISTANT';
                if (platformDuration) {
                    const sec = PlatformCrypto.estimatedDuration(sourceBlob.size);
                    const min = Math.floor(sec / 60);
                    const s   = Math.round(sec % 60);
                    platformDuration.textContent = min > 0 ? `~${min}m ${s}s` : `~${s}s`;
                }
            }
        };

        // ── Encrypt/Decrypt mode toggle ─────────────────────────────────────
        const updateModeUI = () => {
            if (currentMode === 'encrypt') {
                confirmSection.classList.remove('hidden');
                hintSection.classList.remove('hidden');
                hintDisplay.classList.add('hidden');
                if (platformSection) platformSection.style.display = '';
                encryptBtn.title = 'Encrypt';
                encryptBtn.setAttribute('aria-label', 'Encrypt');
                if (actionIconUse) actionIconUse.setAttribute('href', 'assets/icons/sprite.svg#icon-lock');
                infoText.textContent =
                    'Encrypts the file into a carrier MP4. External players (VLC, YouTube, etc) ' +
                    'show an encrypted banner — only the correct password restores the original.';
            } else {
                confirmSection.classList.add('hidden');
                hintSection.classList.add('hidden');
                if (platformSection) platformSection.style.display = 'none';
                encryptBtn.title = 'Decrypt';
                encryptBtn.setAttribute('aria-label', 'Decrypt');
                if (actionIconUse) actionIconUse.setAttribute('href', 'assets/icons/sprite.svg#icon-lock-open');
                infoText.textContent =
                    'Decrypts a previously encrypted file. Enter the same password used to encrypt it.';

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

        // ── Detect existing JJC4 file + read metadata ───────────────────────
        try {
            sourceBlob   = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());
            fileMetadata = await PlatformCrypto.readMetadata(sourceBlob);
            if (fileMetadata) {
                Logger.log(`[EncryptMenu] Detected JJC4 file — ${JSON.stringify(fileMetadata)}`);
                // Pre-select decrypt mode
                toggleCheckbox.checked = true;
                currentMode = 'decrypt';
            }
        } catch (e) {
            Logger.log(`[EncryptMenu] Could not read metadata: ${e.message}`);
        }

        updateModeUI();
        updatePlatformUI();

        // ── Process handler ─────────────────────────────────────────────────
        encryptBtn.addEventListener('click', async () => {
            const password = passwordInput.value;

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
            const abortController = new AbortController();
            const { signal } = abortController;

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Cancel';
            cancelBtn.className = 'jellyjump-btn-secondary text-sm';
            cancelBtn.addEventListener('click', () => abortController.abort());
            progressSection.appendChild(cancelBtn);

            encryptBtn.disabled        = true;
            modal.closeBtn.disabled    = true;
            passwordInput.disabled     = true;
            confirmInput.disabled      = true;
            hintInput.disabled         = true;
            toggleCheckbox.disabled    = true;
            errorMessage.classList.add('hidden');
            successMessage.classList.add('hidden');
            downloadBtn.classList.add('hidden');
            progressSection.classList.remove('hidden');

            try {
                const source = sourceBlob ||
                    await MediaMetadata.getSourceBlob(item, () => playlist._saveState());

                const onProgress = (p) => {
                    progressPct.textContent = Math.round(p * 100) + '%';
                };

                let resultBlob, newFilename;

                if (currentMode === 'encrypt') {
                    const encOpts = {
                        filename: item.title,
                        mimeType: source.type || item.type || 'video/mp4',
                        hint:     hintInput.value.trim() || undefined,
                        onProgress,
                        signal,
                    };
                    const { MediaProcessor } = await import('../../../core/MediaProcessor.js');
                    resultBlob = await MediaProcessor.encryptPlatform(source, password, encOpts);
                    newFilename = item.title.replace(/\.[^/.]+$/, '') + '-encrypted.mp4';
                } else {
                    const { MediaProcessor } = await import('../../../core/MediaProcessor.js');
                    const result = await MediaProcessor.decryptPlatform(source, password, onProgress, signal);
                    resultBlob  = result.blob;
                    newFilename = result.metadata.name ||
                        (item.title.replace(/\.[^/.]+$/, '') + '-decrypted');
                }

                const { url } = playlist.insertProcessedItem(item, resultBlob, newFilename);

                if (downloadBtn) {
                    downloadBtn.href     = url;
                    downloadBtn.download = newFilename;
                }

                successMessage.classList.remove('hidden');
                progressSection.classList.add('hidden');
                downloadBtn.classList.remove('hidden');
                downloadBtn.title = `Download ${currentMode === 'encrypt' ? 'Encrypted' : 'Decrypted'}`;

            } catch (error) {
                progressSection.classList.add('hidden');
                if (error.name === 'AbortError') {
                    errorMessage.textContent = 'Operation cancelled.';
                } else {
                    Logger.error('Encrypt/Decrypt failed:', error);
                    errorMessage.textContent = `Operation failed: ${error.message}`;
                }
                errorMessage.classList.remove('hidden');
            } finally {
                cancelBtn.remove();
            }

            // Re-enable UI
            encryptBtn.disabled        = false;
            modal.closeBtn.disabled    = false;
            passwordInput.disabled     = false;
            confirmInput.disabled      = false;
            hintInput.disabled         = false;
            toggleCheckbox.disabled    = false;
        });
    }
}
