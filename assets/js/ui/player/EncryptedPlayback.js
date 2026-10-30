/**
 * Decrypt-on-play for JJC4 carriers.
 *
 * Encrypting a file produces a carrier video that plays as a "this video is
 * encrypted" placeholder, which is exactly what anyone who re-downloads it
 * sees. Before this, the only way back to the original was the Tools menu:
 * open Encrypt/Decrypt, type the password, wait, download the result, add it
 * to the playlist, play it. Here, pressing play on the carrier is enough.
 *
 * The check runs on every local file on its way to the player, so it has to be
 * cheap — PlatformCrypto.looksLikeCarrier reads one video frame rather than
 * decoding the audio header, which costs about 20ms on a carrier and 60ms on
 * an ordinary video.
 */
import { Logger } from '../../shared/utils/Logger.js';
import { PlatformCrypto } from '../../shared/utils/PlatformCrypto.js';
import { openProcessMenu, FOOTER_CONFIGS } from '../menus/core/MenuFactory.js';

/**
 * Ask for the password and decrypt, returning the plaintext file.
 *
 * Stays open across a wrong password rather than making the user find their
 * way back: the HMAC check is the only thing that can tell a wrong password
 * from a corrupt carrier, so a mistyped password is the expected case, not an
 * error worth throwing the dialog away for.
 * @param {Blob} carrier
 * @param {string} [title] shown in the dialog so it is clear which item this is
 * @returns {Promise<{blob: Blob, metadata: Object}|null>} null if cancelled
 */
async function promptAndDecrypt(carrier, title) {
    const { modal, content } = openProcessMenu(
        'Unlock video', 'unlock-content-template',
        FOOTER_CONFIGS.unlock, { maxWidth: '500px' }
    );
    if (!modal) return null;

    const unlockBtn      = content.querySelector('.unlock-btn');
    const passwordInput  = content.querySelector('.unlock-password');
    const hintDisplay    = content.querySelector('.unlock-hint-display');
    const hintValue      = content.querySelector('.unlock-hint-value');
    const intro          = content.querySelector('.unlock-intro');
    const progressBlock  = content.querySelector('.progress-section');
    const progressPct    = content.querySelector('.progress-percentage');
    const progressStatus = content.querySelector('.progress-status');
    const errorMessage   = content.querySelector('.error-message');

    if (title && intro) {
        intro.textContent = `"${title}" is an encrypted carrier. Enter the password to play the file hidden inside it.`;
    }

    // The hint lives in the audio header, which costs a track decode to read,
    // so it is fetched while the user is already typing rather than before the
    // dialog appears.
    PlatformCrypto.readMetadata(carrier).then((metadata) => {
        if (metadata?.hint && hintValue && hintDisplay) {
            hintValue.textContent = metadata.hint;
            hintDisplay.classList.remove('hidden');
        }
    }).catch(() => { /* no hint is not a failure */ });

    return new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            modal.close();
            resolve(value);
        };

        const showError = (message) => {
            if (!errorMessage) return;
            errorMessage.textContent = message;
            errorMessage.classList.remove('hidden');
        };

        const setBusy = (busy) => {
            if (unlockBtn) unlockBtn.disabled = busy;
            if (passwordInput) passwordInput.disabled = busy;
            progressBlock?.classList.toggle('hidden', !busy);
        };

        const attempt = async () => {
            const password = passwordInput?.value ?? '';
            if (!password) { showError('Enter the password.'); return; }

            errorMessage?.classList.add('hidden');
            setBusy(true);
            if (progressStatus) progressStatus.textContent = 'Unlocking...';

            try {
                const result = await PlatformCrypto.decrypt(carrier, password, (value) => {
                    if (progressPct) progressPct.textContent = `${Math.round(value * 100)}%`;
                });
                finish(result);
            } catch (error) {
                Logger.warn('[EncryptedPlayback] Unlock failed:', error.message);
                setBusy(false);
                showError(error.message || 'Could not unlock this video.');
                if (passwordInput) { passwordInput.value = ''; passwordInput.focus(); }
            }
        };

        unlockBtn?.addEventListener('click', attempt);
        passwordInput?.addEventListener('keydown', (e) => { if (e.key === 'Enter') attempt(); });

        // Closing the dialog any other way — the X, the overlay, Escape — is a
        // decision not to play this item, not a failure.
        const previousOnClose = modal.options.onClose;
        modal.options.onClose = () => {
            previousOnClose?.();
            finish(null);
        };

        passwordInput?.focus();
    });
}

// Unlocks already in flight, keyed by playlist item. Adding a file selects it,
// and a second click selects it again, so the same item can be on its way to
// the player twice at once; without this each attempt opens its own password
// dialog over the last.
const inFlight = new Map();

/**
 * Swap a playlist item over to its decrypted contents, if it needs it.
 *
 * Called on the way to player.load. Returns whether playback should go ahead:
 * false means the user closed the dialog without unlocking, which is a choice
 * to play nothing rather than an error to report.
 * @param {Object} video playlist item, with blob_url and optionally file
 * @returns {Promise<boolean>}
 */
export async function unlockIfEncrypted(video) {
    if (!video || video.isStream || video.isRemoteLibrary) return true;

    const pending = inFlight.get(video);
    if (pending) return pending;
    const run = _unlock(video).finally(() => inFlight.delete(video));
    inFlight.set(video, run);
    return run;
}

async function _unlock(video) {
    // Unlocked earlier this session: point at the plaintext again rather than
    // asking a second time. Not just a fast path — the playlist rebuilds
    // blob_url from the file on disk between plays, which is the carrier, so
    // an item can arrive here pointing back at its own placeholder.
    if (video.jjcUnlockedUrl) {
        video.blob_url = video.jjcUnlockedUrl;
        return true;
    }
    // Asked once and told it is not a carrier; do not pay for the probe again
    // every time the item is played.
    if (video.jjcChecked) return true;

    let carrier = video.file instanceof Blob ? video.file : null;
    if (!carrier) {
        if (!video.blob_url?.startsWith('blob:')) { video.jjcChecked = true; return true; }
        try {
            carrier = await (await fetch(video.blob_url)).blob();
        } catch {
            video.jjcChecked = true;
            return true;
        }
    }

    let isCarrier = false;
    try {
        isCarrier = await PlatformCrypto.looksLikeCarrier(carrier);
    } catch (error) {
        Logger.warn('[EncryptedPlayback] Carrier check failed:', error.message);
    }
    if (!isCarrier) { video.jjcChecked = true; return true; }

    Logger.log(`[EncryptedPlayback] ${video.title} is a JJC4 carrier — asking for the password`);
    const result = await promptAndDecrypt(carrier, video.title);
    if (!result) return false;

    video.jjcUnlockedUrl = URL.createObjectURL(result.blob);
    video.jjcCarrierUrl = video.blob_url;
    video.blob_url = video.jjcUnlockedUrl;
    // Deliberately not setting jjcChecked: that flag means "not a carrier",
    // and this one is. The branch above is what keeps it from asking again.
    Logger.log(`[EncryptedPlayback] Unlocked ${video.title} — ${result.blob.size} B`);
    return true;
}
