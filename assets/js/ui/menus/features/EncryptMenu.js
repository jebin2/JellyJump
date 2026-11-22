import { Logger } from '../../../shared/utils/Logger.js';
import { PlatformCrypto } from '../../../shared/utils/PlatformCrypto.js';
import { MediaMetadata } from '../../../shared/utils/MediaMetadata.js';
import { openProcessMenu, FOOTER_CONFIGS } from '../core/MenuFactory.js';
import { setActionLabel } from '../../../shared/utils/FooterHelper.js';
import { runMenuJob } from '../core/MenuJob.js';
import { Toast } from '../../../shared/utils/Toast.js';

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
        const errorMessage      = modalContent.querySelector('.error-message');

        // Start does nothing until the file has been looked at, below; a
        // button that ignores a click is worse than one that is plainly off.
        if (encryptBtn) encryptBtn.disabled = true;

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
        // From the item when the bytes are not in hand: a remote file is no
        // longer downloaded just to open this dialog, so its size comes from
        // the listing rather than from a blob.
        const sourceSize = () => sourceBlob?.size ?? item.fileSize ?? 0;
        const needsStreaming = () =>
            sourceSize() > PlatformCrypto.IN_RAM_PAYLOAD_LIMIT;
        const canStream = typeof window !== 'undefined' && 'showSaveFilePicker' in window;

        const updatePlatformUI = () => {
            if (!platformSection) return;
            platformSection.style.display = currentMode === 'encrypt' ? '' : 'none';
            if (currentMode !== 'encrypt' || !sourceSize()) return;

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
                    const sec = PlatformCrypto.estimatedDuration(sourceSize());
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
                setActionLabel(encryptBtn, 'Encrypt');
                if (actionIconUse) actionIconUse.setAttribute('href', 'assets/icons/sprite.svg#icon-lock');
                infoText.textContent =
                    'Encrypts the file into a carrier MP4. External players (VLC, YouTube, etc) ' +
                    'show an encrypted banner — only the correct password restores the original.';
            } else {
                confirmSection.classList.add('hidden');
                hintSection.classList.add('hidden');
                if (platformSection) platformSection.style.display = 'none';
                setActionLabel(encryptBtn, 'Decrypt');
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
            // A header read, so a remote file is inspected where it lies. This
            // used to fetch the whole thing before the dialog could even open,
            // which on a shared library meant waiting out a multi-gigabyte
            // download to be told the file is not encrypted.
            const probeSource = await MediaMetadata.sourceForReading(item, () => playlist.save());
            if (typeof probeSource === 'string' && probeSource.startsWith('blob:')) {
                sourceBlob = await (await fetch(probeSource)).blob();
            }
            fileMetadata = await PlatformCrypto.readMetadata(probeSource);
            if (fileMetadata) {
                Logger.log(`[EncryptMenu] Detected JJC4 file — ${JSON.stringify(fileMetadata)}`);
                // Pre-select decrypt mode
                toggleCheckbox.checked = true;
                currentMode = 'decrypt';
            }
        } catch (e) {
            Logger.log(`[EncryptMenu] Could not read metadata: ${e.message}`);
        }

        if (encryptBtn) encryptBtn.disabled = false;
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

            errorMessage.classList.add('hidden');
            const mode = currentMode;
            const name = mode === 'encrypt' ? 'Encrypt' : 'Decrypt';
            const encryptedName = item.title.replace(/\.[^/.]+$/, '') + '-encrypted.mp4';

            // A carrier too big to hold in memory is written to a file the
            // user picks. The picker needs this click, so it is asked for
            // here, before the job is queued.
            let fileHandle = null;
            if (mode === 'encrypt' && needsStreaming()) {
                try {
                    fileHandle = await window.showSaveFilePicker({
                        suggestedName: encryptedName,
                        types: [{ description: 'MP4 video', accept: { 'video/mp4': ['.mp4'] } }],
                    });
                } catch (e) {
                    if (e?.name !== 'AbortError') Logger.error('Save picker failed:', e);
                    return;
                }
            }
            const hint = hintInput.value.trim() || undefined;

            // A percentage alone says nothing about a job that can run for
            // minutes, so the tray shows how long is left as soon as there is
            // enough of a rate to extrapolate from.
            const fmtDur = (sec) => {
                if (!Number.isFinite(sec) || sec < 0) return '';
                if (sec >= 3600) return `${Math.floor(sec / 3600)}h ${Math.round((sec % 3600) / 60)}m`;
                if (sec >= 60) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`;
                return `${Math.max(1, Math.round(sec))}s`;
            };

            runMenuJob({
                name,
                subject: item.title,
                background: true,
                modal,
                work: async ({ signal, onProgress }) => {
                    const source = sourceBlob ||
                        await MediaMetadata.getSourceBlob(item, () => playlist.save());
                    const report = (p, info) => {
                        const eta = info?.etaSec !== undefined ? fmtDur(info.etaSec) : '';
                        onProgress(p, eta ? `${eta} left · ${Math.round(info.fps)} fps` : `${name}ing…`);
                    };
                    const { MediaProcessor } = await import('../../../processing/MediaProcessor.js');
                    if (mode === 'encrypt') {
                        const blob = await MediaProcessor.encryptPlatform(source, password, {
                            filename: item.title,
                            mimeType: source.type || item.type || 'video/mp4',
                            hint,
                            onProgress: report,
                            signal,
                            ...(fileHandle ? { fileHandle } : {}),
                        });
                        return { blob: fileHandle ? null : blob, filename: encryptedName };
                    }
                    const result = await MediaProcessor.decryptPlatform(source, password, report, signal);
                    return {
                        blob: result.blob,
                        filename: result.metadata.name || (item.title.replace(/\.[^/.]+$/, '') + '-decrypted'),
                    };
                },
                done: ({ blob, filename }) => {
                    // Written straight to the user's chosen file: nothing to
                    // add to the playlist.
                    if (!blob) Toast.show(`Encrypted and saved to “${filename}”.`, 5000);
                    else playlist.insertProcessedItem(item, blob, filename);
                },
            });
        });
    }
}
