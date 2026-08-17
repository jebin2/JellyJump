import { Modal } from '../../Modal.js';
import { Toast } from '../../../shared/utils/Toast.js';
import { Logger } from '../../../shared/utils/Logger.js';
import { ShareState } from '../../../shared/services/ShareState.js';

/**
 * Share Menu
 * Turns library sharing on and hands over a link to paste into JellyJump on
 * another device.
 *
 * Desktop only, and only on a tailnet: the link is an https:// address backed
 * by a Tailscale MagicDNS certificate, which is what lets the hosted app talk
 * to this machine at all. When that is unavailable the menu says why rather
 * than offering a button that cannot work.
 */
export class ShareMenu {
    /** Whether this runtime can share at all — the browser has nothing to serve. */
    static isSupported() {
        return typeof window !== 'undefined' && !!window.electronAPI?.getShareStatus;
    }

    static async show() {
        const modal = new Modal({ maxWidth: '480px' });
        modal.setTitle('Share Library');

        const body = document.createElement('div');
        body.className = 'share-menu';
        body.innerHTML = '<div class="share-status">Checking Tailscale…</div>';
        modal.setBody(body);
        modal.open();

        const render = (state) => this._render(body, state, render);

        try {
            const result = await window.electronAPI.getShareStatus();
            render(result.success ? result.state : { error: result.error });
        } catch (error) {
            Logger.error('[Share] Status failed:', error);
            render({ error: error.message });
        }
    }

    /**
     * @param {HTMLElement} body
     * @param {Object} state - from the main process; carries everything the UI
     *   needs, so nothing has to be inferred from a boolean
     * @param {Function} rerender
     */
    static _render(body, state, rerender) {
        // Sharing outlives this modal, so the Tools button is what tells
        // the user it is still on after the menu closes.
        ShareState.update(state);
        body.textContent = '';

        if (state.error) {
            body.appendChild(this._note(`Could not read sharing status: ${state.error}`, 'error'));
            return;
        }

        if (!state.tailscaleAvailable && !state.enabled) {
            body.appendChild(this._note(
                state.tailscaleReason || 'Tailscale is not available',
                'error',
            ));
            body.appendChild(this._note(
                'Sharing needs Tailscale with HTTPS enabled. The link is an https:// address '
                + 'backed by a Tailscale certificate — a browser will not load a library over '
                + 'plain http, so there is nothing to fall back to.',
                'hint',
            ));
            return;
        }

        if (!state.enabled) {
            // A failed start reports why here. Without this the button flips to
            // "Starting…" and straight back, which looks like nothing happened
            // at all rather than like something went wrong.
            if (state.reason) {
                body.appendChild(this._note(state.reason, 'error'));
                Logger.warn('[Share] Could not start sharing:', state.reason);
            }
            body.appendChild(this._note(
                `Share ${state.itemCount} scanned file${state.itemCount === 1 ? '' : 's'} with other `
                + 'devices on your tailnet. Nothing is served until you turn this on.',
                'hint',
            ));
            const enable = this._button('Start sharing', 'primary');
            enable.addEventListener('click', async () => {
                enable.disabled = true;
                enable.textContent = 'Starting…';
                const result = await window.electronAPI.enableShare();
                rerender(result.success ? result.state : { error: result.error });
            });
            body.appendChild(enable);
            return;
        }

        // Sharing is on: the link is the whole point of this screen.
        body.appendChild(this._note(
            `Sharing ${state.itemCount} file${state.itemCount === 1 ? '' : 's'}. Open JellyJump on a `
            + 'device on your tailnet, then paste this with Add Link.',
            'hint',
        ));

        const linkRow = document.createElement('div');
        linkRow.className = 'share-link-row';

        const link = document.createElement('input');
        link.type = 'text';
        link.readOnly = true;
        link.className = 'share-link';
        link.value = state.url;
        link.addEventListener('focus', () => link.select());
        linkRow.appendChild(link);

        const copy = this._button('Copy', 'primary');
        copy.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(state.url);
            } catch {
                // Clipboard can be refused; selecting the text still lets the
                // user copy it by hand rather than leaving them stuck.
                link.select();
            }
            copy.textContent = 'Copied';
            Toast.show('Share link copied');
            setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
        });
        linkRow.appendChild(copy);
        body.appendChild(linkRow);

        body.appendChild(this._note(
            'Anyone with this link and access to your tailnet can browse and play your library. '
            + 'Treat it like a password.',
            'warn',
        ));

        const actions = document.createElement('div');
        actions.className = 'share-actions';

        const stop = this._button('Stop sharing');
        stop.addEventListener('click', async () => {
            stop.disabled = true;
            stop.textContent = 'Stopping…';
            const result = await window.electronAPI.disableShare();
            rerender(result.success ? result.state : { error: result.error });
        });
        actions.appendChild(stop);

        const regenerate = this._button('New link');
        regenerate.title = 'Invalidate the current link everywhere it has been pasted';
        regenerate.addEventListener('click', async () => {
            regenerate.disabled = true;
            regenerate.textContent = 'Working…';
            const result = await window.electronAPI.regenerateShareToken();
            rerender(result.success ? result.state : { error: result.error });
            Toast.show('Previous links no longer work');
        });
        actions.appendChild(regenerate);

        body.appendChild(actions);
    }

    static _note(text, kind) {
        const el = document.createElement('p');
        el.className = `share-note share-note--${kind}`;
        el.textContent = text;
        return el;
    }

    static _button(label, kind) {
        const el = document.createElement('button');
        el.className = kind === 'primary' ? 'share-btn share-btn--primary' : 'share-btn';
        el.textContent = label;
        return el;
    }
}
