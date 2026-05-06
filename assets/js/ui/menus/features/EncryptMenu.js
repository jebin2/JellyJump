import { Logger } from '../../../shared/utils/Logger.js';
import { CryptoHelper } from '../../../shared/utils/CryptoHelper.js';
import { TwitterCrypto } from '../../../shared/utils/TwitterCrypto.js';
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

        const twitterCheckbox   = modalContent.querySelector('.encrypt-twitter-checkbox');
        const twitterInfo       = modalContent.querySelector('.encrypt-twitter-info');
        const twitterDuration   = modalContent.querySelector('.encrypt-twitter-duration');
        const twitterSection    = modalContent.querySelector('.encrypt-twitter-section');

        let currentMode    = 'encrypt';
        let fileMetadata   = null;
        let twitterSafe    = false;
        let sourceBlob     = null; // cached for duration estimate

        // ── Twitter-safe checkbox ───────────────────────────────────────────
        const updateTwitterUI = () => {
            if (currentMode !== 'encrypt' || !twitterSection) return;
            twitterSection.style.display = '';
            if (twitterCheckbox) {
                twitterSafe = twitterCheckbox.checked;
                if (twitterInfo) twitterInfo.style.display = twitterSafe ? '' : 'none';
                if (twitterSafe && twitterDuration && sourceBlob) {
                    const sec = TwitterCrypto.estimatedDuration(sourceBlob.size);
                    const min = Math.floor(sec / 60);
                    const s   = Math.round(sec % 60);
                    twitterDuration.textContent = min > 0 ? `~${min}m ${s}s` : `~${s}s`;
                }
            }
        };

        if (twitterCheckbox) {
            twitterCheckbox.addEventListener('change', updateTwitterUI);
        }

        // ── Encrypt/Decrypt mode toggle ─────────────────────────────────────
        const updateModeUI = () => {
            if (currentMode === 'encrypt') {
                confirmSection.classList.remove('hidden');
                hintSection.classList.remove('hidden');
                hintDisplay.classList.add('hidden');
                if (twitterSection) twitterSection.style.display = '';
                encryptBtn.title = 'Encrypt';
                encryptBtn.setAttribute('aria-label', 'Encrypt');
                if (actionIconUse) actionIconUse.setAttribute('href', 'assets/icons/sprite.svg#icon-lock');
                infoText.textContent =
                    'Encrypts the file with a password. The output plays a short "encrypted" ' +
                    'message in external players (VLC, etc). Only the correct password can restore the original.';
            } else {
                confirmSection.classList.add('hidden');
                hintSection.classList.add('hidden');
                if (twitterSection) twitterSection.style.display = 'none';
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

        // ── Detect existing encryption format + read metadata ───────────────
        try {
            sourceBlob   = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());
            // Try JJC2 first, then JJC3
            fileMetadata = await CryptoHelper.readMetadata(sourceBlob);
            if (!fileMetadata) {
                fileMetadata = await TwitterCrypto.readMetadata(sourceBlob);
                if (fileMetadata) {
                    Logger.log('[EncryptMenu] Detected JJC3 file');
                    // Pre-select decrypt mode for JJC3 files
                    toggleCheckbox.checked = true;
                    currentMode = 'decrypt';
                }
            }
            if (fileMetadata) {
                Logger.log(`[EncryptMenu] Metadata: ${JSON.stringify(fileMetadata)}`);
            }
        } catch (e) {
            Logger.log(`[EncryptMenu] Could not read metadata: ${e.message}`);
        }

        updateModeUI();
        updateTwitterUI();

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
            encryptBtn.disabled        = true;
            modal.closeBtn.disabled    = true;
            passwordInput.disabled     = true;
            confirmInput.disabled      = true;
            hintInput.disabled         = true;
            toggleCheckbox.disabled    = true;
            if (twitterCheckbox) twitterCheckbox.disabled = true;
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
                    };

                    if (twitterSafe) {
                        resultBlob  = await TwitterCrypto.encrypt(source, password, encOpts);
                        newFilename = item.title.replace(/\.[^/.]+$/, '') + '-encrypted-tw.mp4';
                    } else {
                        resultBlob  = await CryptoHelper.encrypt(source, password, encOpts);
                        newFilename = item.title.replace(/\.[^/.]+$/, '') + '-encrypted.mp4';
                    }
                } else {
                    // Auto-detect format for decryption
                    let result;
                    const isJJC3 = await TwitterCrypto.readMetadata(source);
                    if (isJJC3 !== null) {
                        result = await TwitterCrypto.decrypt(source, password, onProgress);
                    } else {
                        result = await CryptoHelper.decrypt(source, password, onProgress);
                    }
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
                Logger.error('Encrypt/Decrypt failed:', error);
                errorMessage.textContent = `Operation failed: ${error.message}`;
                errorMessage.classList.remove('hidden');
                progressSection.classList.add('hidden');
            }

            // Re-enable UI
            encryptBtn.disabled        = false;
            modal.closeBtn.disabled    = false;
            passwordInput.disabled     = false;
            confirmInput.disabled      = false;
            hintInput.disabled         = false;
            toggleCheckbox.disabled    = false;
            if (twitterCheckbox) twitterCheckbox.disabled = false;
        });
    }
}
