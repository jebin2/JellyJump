import { Logger } from '../../../shared/utils/Logger.js';
import { CryptoHelper } from '../../../shared/utils/CryptoHelper.js';
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

        // Files up to ~20 MB fit the re-encoding-resistant carrier (JJC4 strip);
        // larger files automatically use standard encryption (JJC2) — no size
        // limit, but the output must be shared as-is, not re-encoded.
        const usesPlatformFormat = () =>
            !sourceBlob || sourceBlob.size <= PlatformCrypto.MAX_PAYLOAD_BYTES;

        const updatePlatformUI = () => {
            if (!platformSection) return;
            platformSection.style.display = currentMode === 'encrypt' ? '' : 'none';
            if (currentMode !== 'encrypt' || !sourceBlob) return;

            if (usesPlatformFormat()) {
                if (platformDuration) {
                    const sec = PlatformCrypto.estimatedDuration(sourceBlob.size);
                    const min = Math.floor(sec / 60);
                    const s   = Math.round(sec % 60);
                    platformDuration.textContent = min > 0 ? `~${min}m ${s}s` : `~${s}s`;
                }
            } else {
                const maxMb = Math.floor(PlatformCrypto.MAX_PAYLOAD_BYTES / 1048576);
                if (platformLabel) platformLabel.textContent = 'STANDARD ENCRYPTION';
                if (platformInfo) {
                    platformInfo.textContent =
                        `Files over ~${maxMb} MB use standard encryption: same AES-256 protection ` +
                        'and playable placeholder, output stays about the original size. ' +
                        'Share the file as-is — it will not survive platform re-encoding.';
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

        // ── Detect existing encryption format + read metadata ───────────────
        try {
            sourceBlob   = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());
            // Try JJC2 first, then JJC3
            fileMetadata = await CryptoHelper.readMetadata(sourceBlob);
            if (!fileMetadata) {
                fileMetadata = await PlatformCrypto.readMetadata(sourceBlob);
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
                    if (source.size <= PlatformCrypto.MAX_PAYLOAD_BYTES) {
                        const { MediaProcessor } = await import('../../../core/MediaProcessor.js');
                        resultBlob = await MediaProcessor.encryptPlatform(source, password, encOpts);
                    } else {
                        // Too large for the visual-strip carrier — standard
                        // JJC2 encryption (no size limit, decrypt auto-detects)
                        resultBlob = await CryptoHelper.encrypt(source, password, encOpts);
                    }
                    newFilename = item.title.replace(/\.[^/.]+$/, '') + '-encrypted.mp4';
                } else {
                    // Auto-detect format for decryption — JJC2 first (cheap
                    // trailer read; avoids parsing huge blobs as media)
                    let result;
                    const jjc2Meta = await CryptoHelper.readMetadata(source);
                    if (jjc2Meta !== null) {
                        result = await CryptoHelper.decrypt(source, password, onProgress);
                    } else {
                        const { MediaProcessor } = await import('../../../core/MediaProcessor.js');
                        result = await MediaProcessor.decryptPlatform(source, password, onProgress, signal);
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
