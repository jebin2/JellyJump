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
                <strong>Each link works for one person.</strong>
            </p>
            <div class="wp-step">
                <div class="wp-step-head">
                    <span class="wp-num">1</span>
                    <span>Send this link to <span class="wp-whose">one friend</span></span>
                </div>
                <div class="wp-row">
                    <input class="wp-link" readonly spellcheck="false" placeholder="Creating…">
                    <button class="wp-copy jellyjump-btn-secondary" type="button" disabled>Copy</button>
                </div>
                <p class="wp-hint">
                    Paste it in a message to that one person — not a group. It is long;
                    that is normal.
                </p>
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
            <div class="wp-footer">
                <p class="wp-hint wp-running">
                    One link and one code per friend — send them all, then paste the
                    replies back in any order.
                    <strong>Closing this panel does not stop sharing.</strong>
                </p>
                <button class="wp-stop jellyjump-btn-secondary" type="button">Stop sharing</button>
            </div>
        `;
        modal.setBody(body);
        modal.open();

        const linkField = body.querySelector('.wp-link');
        const copyButton = body.querySelector('.wp-copy');
        const answerField = body.querySelector('.wp-answer');
        const acceptButton = body.querySelector('.wp-accept');
        const status = body.querySelector('.wp-status');
        const viewers = body.querySelector('.wp-viewers');
        const stopButton = body.querySelector('.wp-stop');
        const whose = body.querySelector('.wp-whose');

        const party = player.watchParty;
        let currentInvite = null;
        let pollId = null;

        // A count is not enough once there is more than one friend: with three
        // links out and two replies back, the host needs to know which one is
        // still missing. Replies carry their invitation's id, so they can be
        // pasted in any order -- this is what shows that happened.
        const describe = (state, accepted) => {
            if (state === 'connected') return 'watching';
            if (!accepted) return 'waiting for their reply';
            if (state === 'connecting' || state === 'new') return 'connecting…';
            return state;
        };
        // One render at a time: reading each connection's stats is async, and
        // two passes interleaving would build the list twice over.
        let rendering = false;
        const renderViewers = async () => {
            if (rendering) return;
            rendering = true;
            try {
                const list = await party.invitesWithRoutes();
                viewers.textContent = '';
                stopButton.disabled = !party.isActive;
                for (const invite of list) {
                    const row = document.createElement('div');
                    row.className = 'wp-viewer-row';
                    const dot = document.createElement('span');
                    dot.className = 'wp-dot';
                    if (invite.state === 'connected') dot.classList.add('on');
                    const label = document.createElement('span');
                    const how = invite.route ? ` (${invite.route})` : '';
                    label.textContent = `Friend ${invite.id} — ${describe(invite.state, invite.accepted)}${how}`;
                    row.append(dot, label);
                    viewers.append(row);
                    // Worth the space whenever there is something to say: why
                    // a friend is not through, or -- once they are -- how much
                    // is reaching them, which is the only way to tell a soft
                    // picture caused by their network from one caused by the
                    // encoder still climbing.
                    if (invite.accepted && invite.detail) {
                        const why = document.createElement('p');
                        why.className = 'wp-viewer-why';
                        why.textContent = invite.detail;
                        viewers.append(why);
                    }
                }
            } finally {
                rendering = false;
            }
        };

        const showInvite = (invite) => {
            currentInvite = invite;
            linkField.value = invite.link;
            copyButton.disabled = false;
            copyButton.textContent = 'Copy';
            // Named, so it is visible that this link belongs to one person
            // and that the previous one is spent. Sending the same link to
            // several people is the one mistake this panel invites, and it
            // breaks the first of them as well as the rest.
            whose.textContent = `Friend ${invite.id}`;
        };

        const newInvite = async () => {
            linkField.value = '';
            linkField.placeholder = 'Creating…';
            copyButton.disabled = true;
            try {
                showInvite(await party.invite());
            } catch (error) {
                Logger.warn('[WatchParty] Invite failed:', error);
                linkField.placeholder = error.message || 'Could not create an invitation.';
                status.textContent = error.message || '';
            }
            await renderViewers();
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
                const which = await party.accept(code);
                answerField.value = '';
                status.textContent = `Friend ${which} is connected. The next link is ready below.`;
                await renderViewers();
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

        stopButton.addEventListener('click', async () => {
            // The one thing in this panel that is destructive, so it says what
            // it did rather than just going quiet. Everyone watching is told
            // over the control channel before their connection goes, so their
            // page explains itself at once instead of freezing for the eight
            // seconds ICE takes to notice.
            party.stop();
            answerField.value = '';
            status.textContent = 'Sharing stopped. Nobody is watching.';
            Toast.show('Watch party ended.', 2500);
            // Then straight back to a usable panel: stopping ends the party,
            // it does not close the door. Leaving the link box empty read as
            // broken, and the only way back to a link was closing this and
            // opening it again.
            stopButton.disabled = true;
            await newInvite();
        });

        // Connection state changes with no event of its own to listen to here,
        // so the count is refreshed on a slow timer while the panel is open.
        pollId = setInterval(renderViewers, 1500);
        modal.onCleanup(() => {
            clearInterval(pollId);
            // Deliberately not stopping the party: closing this panel should not
            // disconnect friends who are already watching, the same way
            // ShareMenu leaves sharing running. That is only defensible because
            // the panel says so and offers a way to stop, which it did not
            // before -- a host could close this believing they had stopped
            // sharing while friends went on watching.
        });

        // A link that is already out there is shown again rather than replaced.
        // Reopening this panel has not sent anybody anything, so minting a new
        // invitation here would both rename the friend who holds the old link
        // and leave a row waiting for a reply that is never coming.
        const outstanding = party.pendingInvite;
        if (outstanding) {
            showInvite(outstanding);
            renderViewers();
        } else {
            newInvite();
        }
    }
}
