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

        const platformSection   = modalContent.querySelector('.encrypt-platform-section');
        const platformLabel     = modalContent.querySelector('.encrypt-platform-label');
        const platformInfo      = modalContent.querySelector('.encrypt-platform-info');

        let currentMode  = 'encrypt';
        let fileMetadata = null;
        let sourceBlob   = null; // cached for duration estimate

        // Payloads above the in-RAM ceiling can't be held as one ArrayBuffer;
        // the carrier is streamed to a disk file the user picks (needs the
        // File System Access API — Electron and Chromium have it).
        const needsStreaming = () =>
            sourceBlob && sourceBlob.size > PlatformCrypto.IN_RAM_PAYLOAD_LIMIT;
        const canStream = typeof window !== 'undefined' && 'showSaveFilePicker' in window;

        const updatePlatformUI = () => {
            if (!platformSection) return;
            platformSection.style.display = currentMode === 'encrypt' ? '' : 'none';
            if (currentMode !== 'encrypt' || !sourceBlob) return;

            if (needsStreaming() && !canStream) {
                const maxMb = Math.floor(PlatformCrypto.IN_RAM_PAYLOAD_LIMIT / 1048576);
                if (platformLabel) platformLabel.textContent = 'FILE TOO LARGE';
                if (platformInfo) {
                    platformInfo.textContent =
                        `Files over ~${maxMb} MB need to stream to disk, which this browser ` +
                        "doesn't support. Use the desktop app or a Chromium-based browser.";
                }
                if (encryptBtn) encryptBtn.disabled = true;
            } else if (needsStreaming()) {
                if (encryptBtn) encryptBtn.disabled = false;
                if (platformLabel) platformLabel.textContent = 'RE-ENCODING RESISTANT (STREAMED)';
                if (platformInfo) {
                    platformInfo.textContent =
                        "This file is large — you'll pick a save location and the encrypted " +
                        'carrier video is written straight to disk. Note the carrier is much ' +
                        'longer/larger than the original.';
                }
            } else {
                if (encryptBtn) encryptBtn.disabled = false;
                if (platformLabel) platformLabel.textContent = 'RE-ENCODING RESISTANT';
                if (platformInfo) {
                    platformInfo.innerHTML =
                        "Encrypted data is embedded in the carrier video's pixel strip and audio track — " +
                        'survives platform re-encoding (Twitter, YouTube, Telegram, etc).<br>Estimated output length: ' +
                        '<span class="encrypt-platform-duration font-mono" style="color:var(--accent-primary);">—</span>.';
                }
                const dur = platformSection.querySelector('.encrypt-platform-duration');
                if (dur) {
                    const sec = PlatformCrypto.estimatedDuration(sourceBlob.size);
                    const min = Math.floor(sec / 60);
                    const s   = Math.round(sec % 60);
                    dur.textContent = min > 0 ? `~${min}m ${s}s` : `~${s}s`;
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

                let resultBlob, newFilename, streamed = false;

                if (currentMode === 'encrypt') {
                    newFilename = item.title.replace(/\.[^/.]+$/, '') + '-encrypted.mp4';
                    const encOpts = {
                        filename: item.title,
                        mimeType: source.type || item.type || 'video/mp4',
                        hint:     hintInput.value.trim() || undefined,
                        onProgress,
                        signal,
                    };
                    // Large payloads stream the carrier straight to a disk file
                    // the user picks (can't hold a >2 GB carrier in RAM).
                    if (source.size > PlatformCrypto.IN_RAM_PAYLOAD_LIMIT) {
                        encOpts.fileHandle = await window.showSaveFilePicker({
                            suggestedName: newFilename,
                            types: [{ description: 'MP4 video', accept: { 'video/mp4': ['.mp4'] } }],
                        });
                        streamed = true;
                    }
                    const { MediaProcessor } = await import('../../../core/MediaProcessor.js');
                    resultBlob = await MediaProcessor.encryptPlatform(source, password, encOpts);
                } else {
                    const { MediaProcessor } = await import('../../../core/MediaProcessor.js');
                    const result = await MediaProcessor.decryptPlatform(source, password, onProgress, signal);
                    resultBlob  = result.blob;
                    newFilename = result.metadata.name ||
                        (item.title.replace(/\.[^/.]+$/, '') + '-decrypted');
                }

                progressSection.classList.add('hidden');
                successMessage.classList.remove('hidden');

                if (streamed || !resultBlob) {
                    // Carrier was written directly to the user's chosen file.
                    successMessage.textContent = `Encrypted and saved to “${newFilename}”.`;
                    downloadBtn.classList.add('hidden');
                } else {
                    const { url } = playlist.insertProcessedItem(item, resultBlob, newFilename);
                    if (downloadBtn) {
                        downloadBtn.href     = url;
                        downloadBtn.download = newFilename;
                        downloadBtn.classList.remove('hidden');
                        downloadBtn.title = `Download ${currentMode === 'encrypt' ? 'Encrypted' : 'Decrypted'}`;
                    }
                }

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
