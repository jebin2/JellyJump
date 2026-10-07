import { Modal } from '../../Modal.js';
import { Toast } from '../../../shared/utils/Toast.js';
import { Logger } from '../../../shared/utils/Logger.js';

/**
 * Watch Party
 * Shares what is playing with friends, with nothing in between.
 *
 * The handshake needs two messages and there is no server to carry them, so
 * this menu is mostly about making the carrying bearable: one link to send, one
 * box to paste the reply into, repeated per friend. That is the cost of having
 * no backend, and the UI says so rather than hiding it.
 *
 * Works in the browser as well as the desktop app -- the picture is captured
 * from the canvas and sent peer to peer, so nothing needs to be installed or
 * reachable from outside.
 */
export class WatchPartyMenu {
    /** Whether this runtime can do it at all. */
    static isSupported() {
        return typeof RTCPeerConnection === 'function'
            && typeof HTMLCanvasElement !== 'undefined'
            && typeof HTMLCanvasElement.prototype.captureStream === 'function';
    }

    static show(player) {
        if (!this.isSupported()) {
            Toast.show('This browser cannot share a watch party.', 4000, true);
            return;
        }
        if (!player?.duration && !player?.isLive) {
            Toast.show('Open something to watch first.', 3500, true);
            return;
        }

        const modal = new Modal({ maxWidth: '560px' });
        modal.setTitle('Watch Together');

        const body = document.createElement('div');
        body.className = 'watch-party';
        body.innerHTML = `
            <p class="wp-lead">
                Send a friend the link. They send a code back. Then they are watching
                what you are watching — they cannot pause or seek it.
            </p>
            <div class="wp-step">
                <div class="wp-step-head"><span class="wp-num">1</span> Send this link</div>
                <div class="wp-row">
                    <input class="wp-link" readonly spellcheck="false" placeholder="Creating…">
                    <button class="wp-copy jellyjump-btn-secondary" type="button" disabled>Copy</button>
                </div>
                <p class="wp-hint">Paste it wherever you talk to them. It is long; that is normal.</p>
            </div>
            <div class="wp-step">
                <div class="wp-step-head"><span class="wp-num">2</span> Paste their reply</div>
                <div class="wp-row">
                    <input class="wp-answer" spellcheck="false" placeholder="Paste the code they send back">
                    <button class="wp-accept jellyjump-btn-secondary" type="button">Connect</button>
                </div>
                <p class="wp-hint wp-status"></p>
            </div>
            <div class="wp-viewers"></div>
            <p class="wp-hint">
                One link and one code per friend — repeat for each. Links expire when
                you close this tab.
            </p>
        `;
        modal.setBody(body);
        modal.open();

        const linkField = body.querySelector('.wp-link');
        const copyButton = body.querySelector('.wp-copy');
        const answerField = body.querySelector('.wp-answer');
        const acceptButton = body.querySelector('.wp-accept');
        const status = body.querySelector('.wp-status');
        const viewers = body.querySelector('.wp-viewers');

        const party = player.watchParty;
        let currentInvite = null;
        let pollId = null;

        const renderViewers = () => {
            const list = party.invites;
            if (!list.length) { viewers.textContent = ''; return; }
            const connected = list.filter(i => i.state === 'connected').length;
            viewers.textContent = connected === 1
                ? '1 friend is watching.'
                : `${connected} friends are watching.`;
        };

        const newInvite = async () => {
            linkField.value = '';
            linkField.placeholder = 'Creating…';
            copyButton.disabled = true;
            try {
                currentInvite = await party.invite();
                linkField.value = currentInvite.link;
                copyButton.disabled = false;
                copyButton.textContent = 'Copy';
            } catch (error) {
                Logger.warn('[WatchParty] Invite failed:', error);
                linkField.placeholder = error.message || 'Could not create an invitation.';
                status.textContent = error.message || '';
            }
        };

        copyButton.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(linkField.value);
                copyButton.textContent = 'Copied';
                setTimeout(() => { copyButton.textContent = 'Copy'; }, 1800);
            } catch {
                // Clipboard permission can be refused; selecting is the fallback.
                linkField.select();
                copyButton.textContent = 'Press Ctrl+C';
            }
        });

        acceptButton.addEventListener('click', async () => {
            const code = answerField.value.trim();
            if (!code) { status.textContent = 'Paste the code they sent you.'; return; }
            acceptButton.disabled = true;
            status.textContent = 'Connecting…';
            try {
                await party.accept(code);
                answerField.value = '';
                status.textContent = 'Connected. Make a new link for the next friend.';
                renderViewers();
                // Each friend needs their own pair, so the next one is queued up
                // immediately rather than making them ask for it.
                await newInvite();
            } catch (error) {
                Logger.warn('[WatchParty] Accept failed:', error);
                status.textContent = error.message || 'That code could not be used.';
            } finally {
                acceptButton.disabled = false;
            }
        });

        // Connection state changes with no event of its own to listen to here,
        // so the count is refreshed on a slow timer while the panel is open.
        pollId = setInterval(renderViewers, 1500);
        modal.onCleanup(() => {
            clearInterval(pollId);
            // Deliberately not stopping the party: closing this panel should not
            // disconnect friends who are already watching. ShareMenu behaves the
            // same way, and the player keeps broadcasting until it is stopped.
        });

        newInvite();
    }
}
