import { Logger } from '../../shared/utils/Logger.js';
import { packSignal, unpackSignal } from './SignalCodec.js';

/** How long to wait for ICE gathering before sending what we have. */
const GATHER_TIMEOUT_MS = 5000;
/**
 * How long an answered invitation may stay unconnected before it is given up
 * on. Generous, because a bad network can take a while -- but not unbounded,
 * or an invitation that can never complete sits in the list for ever claiming
 * to be connecting. The clearest way to produce one is to open the same link
 * twice: both answerers fail, and the state stays `connecting` rather than
 * `failed`, so nothing else would ever clear it.
 */
const CONNECT_TIMEOUT_MS = 30000;
/**
 * A channel carrying nothing but the host saying goodbye.
 *
 * Closing a peer connection does not tell the other end anything: the viewer
 * finds out only when ICE gives up, which was measured at about eight seconds
 * of frozen picture with no explanation. One message makes it immediate. It
 * has to be created before the offer so it is described in the SDP, which
 * lengthens the code that gets pasted -- worth it for not leaving people
 * staring at a still frame wondering whose fault it is.
 */
const CONTROL_CHANNEL = 'jj-control';
/** Long enough for a tiny message to leave before the connection is torn down. */
const GOODBYE_FLUSH_MS = 120;

/**
 * Hosting a watch party: one broadcast, several viewers, no server.
 *
 * Each viewer needs its own peer connection, and each connection needs two
 * messages -- the host's offer and that viewer's answer. With nothing in the
 * middle those travel by hand, so this produces a link to send and accepts the
 * code that comes back. invite() once per friend.
 *
 * Candidates are gathered before the offer is handed over rather than trickled
 * afterwards, because trickling needs a live channel to trickle down and there
 * isn't one. That costs a second or two per invite and makes the handshake a
 * single blob each way.
 *
 * The media is one capture shared by every connection: the canvas is encoded
 * once per peer by the browser, but captured once, so adding a viewer does not
 * add a capture. What it does add is upstream bandwidth, which is the real
 * limit on how many friends can watch.
 */
export class WatchParty {
    constructor(player) {
        this.player = player;
        this._peers = new Map();
        this._nextId = 1;
    }

    /** Viewers whose connection has completed. */
    get viewerCount() {
        let n = 0;
        for (const peer of this._peers.values()) {
            if (peer.connection.connectionState === 'connected') n++;
        }
        return n;
    }

    /** Every invite issued, connected or not. */
    get invites() {
        return [...this._peers.entries()].map(([id, peer]) => ({
            id,
            state: peer.connection.connectionState,
            accepted: peer.accepted,
        }));
    }

    /**
     * The invitation still waiting for a reply, if there is one -- the link a
     * host has in hand but nobody has answered yet.
     *
     * @returns {{id: number, code: string, link: string}|null}
     */
    get pendingInvite() {
        const outstanding = [...this._peers.entries()]
            .filter(([, peer]) => !peer.accepted && peer.link);
        if (!outstanding.length) return null;
        const [id, peer] = outstanding[outstanding.length - 1];
        return { id, code: peer.code, link: peer.link };
    }

    /**
     * Start broadcasting if it has not started, and produce an invitation for
     * one viewer.
     *
     * @param {{baseUrl?: string}} [options] - where the viewer page lives;
     *        defaults to watch.html beside the current page
     * @returns {Promise<{id: number, code: string, link: string}>}
     */
    async invite({ baseUrl } = {}) {
        const stream = this.player.broadcast.open();
        if (!stream) throw new Error('There is nothing playing to share.');
        this.player.broadcast.attachAudio();

        const connection = new RTCPeerConnection();
        const id = this._nextId++;
        this._peers.set(id, { connection, accepted: false });

        // A connection that has failed or been closed is never coming back,
        // and holding it keeps an RTCPeerConnection alive for nothing. Invites
        // that are never answered accumulate the same way -- one per friend who
        // was sent a link and did not open it.
        connection.addEventListener('connectionstatechange', () => {
            const state = connection.connectionState;
            if (state !== 'failed' && state !== 'closed') return;
            const peer = this._peers.get(id);
            if (peer?.connection !== connection) return;
            clearTimeout(peer.timer);
            this._peers.delete(id);
            connection.close();
            Logger.log(`[WatchParty] Invite ${id} ${state}; forgotten`);
        });

        for (const track of stream.getTracks()) connection.addTrack(track, stream);
        // Created before the offer, or it is not in the SDP and the viewer
        // never sees the channel at all.
        this._peers.get(id).control = connection.createDataChannel(CONTROL_CHANNEL);

        await connection.setLocalDescription(await connection.createOffer());
        await this._gathered(connection);

        const code = await packSignal(connection.localDescription, { invite: id });
        const base = baseUrl ?? new URL('watch.html', window.location.href).href;
        // The fragment, not the query: fragments are not sent to servers and do
        // not appear in access logs, so the handshake stays between the two of
        // you even though the link passes through a chat.
        const link = `${base}#${code}`;
        const issued = { id, code, link };
        // Kept so the same invitation can be shown again. A host who closes
        // and reopens the panel has not sent a new link to anyone, and minting
        // one there would rename the friend the old link went to.
        const peer = this._peers.get(id);
        if (peer) Object.assign(peer, issued);
        Logger.log(`[WatchParty] Invite ${id} ready (${code.length} chars)`);
        return issued;
    }

    /**
     * Complete a connection with the code a viewer sent back.
     * @param {string} text - what they pasted
     * @param {number} [id] - which invite; defaults to the newest unaccepted
     * @returns {Promise<number>} the invite that was completed
     */
    async accept(text, id) {
        const answer = await unpackSignal(text);
        if (answer.type !== 'answer') {
            throw new Error('That is an invitation, not a reply to one.');
        }
        // The reply names its own invitation, so replies can come back in any
        // order and from any number of friends. The fallback is for a code made
        // before this carried an id; it is only ever right with one invitation
        // outstanding, which is why it is not the main path.
        const target = id ?? answer.invite ?? this._newestUnaccepted();
        const peer = this._peers.get(target);
        if (!peer) {
            throw new Error('That reply is for an invitation this tab no longer has.');
        }
        if (peer.accepted) {
            // The common way to get here is sending one link to several people.
            throw new Error(
                'That invitation was already used. Each friend needs their own link — '
                + 'send them the new one below.');
        }

        await peer.connection.setRemoteDescription(answer);
        peer.accepted = true;
        peer.timer = setTimeout(() => {
            if (peer.connection.connectionState === 'connected') return;
            if (this._peers.get(target) !== peer) return;
            Logger.warn(`[WatchParty] Invite ${target} never connected; giving up`);
            this._peers.delete(target);
            peer.connection.close();
        }, CONNECT_TIMEOUT_MS);
        Logger.log(`[WatchParty] Invite ${target} answered`);
        return target;
    }

    /** True while anything is being shared -- an invite out, or someone watching. */
    get isActive() {
        return this._peers.size > 0 || this.player.broadcast.isOpen;
    }

    /**
     * Hang up on everyone and stop capturing.
     *
     * Everyone is told before the connection goes, so their page can say what
     * happened at once rather than waiting for ICE to notice.
     */
    stop() {
        const peers = [...this._peers.values()];
        for (const peer of peers) {
            clearTimeout(peer.timer);
            try {
                if (peer.control?.readyState === 'open') {
                    peer.control.send(JSON.stringify({ type: 'bye' }));
                }
            } catch (e) {
                // A channel that will not carry a goodbye is not worth a fuss;
                // ICE will get there eventually.
                Logger.debug('[WatchParty] Goodbye not sent:', e);
            }
        }
        this._peers.clear();
        // The numbers only exist to tell this party's links apart. Once it is
        // over the names are free again, so the next party starts at Friend 1
        // rather than carrying on from whatever the last one reached.
        this._nextId = 1;
        this.player.broadcast.close();
        // Closing immediately would drop the message still on its way out.
        setTimeout(() => {
            for (const peer of peers) peer.connection.close();
        }, GOODBYE_FLUSH_MS);
        Logger.log('[WatchParty] Stopped');
    }

    _newestUnaccepted() {
        let found = null;
        for (const [id, peer] of this._peers) if (!peer.accepted) found = id;
        if (found === null) throw new Error('Every invitation has been answered already.');
        return found;
    }

    /** Resolve once candidates are in, or after a timeout with what we have. */
    _gathered(connection) {
        if (connection.iceGatheringState === 'complete') return Promise.resolve();
        return new Promise(resolve => {
            const done = () => { clearTimeout(timer); resolve(); };
            const timer = setTimeout(() => {
                Logger.warn('[WatchParty] Gathering timed out; sending what we have');
                done();
            }, GATHER_TIMEOUT_MS);
            connection.addEventListener('icegatheringstatechange', () => {
                if (connection.iceGatheringState === 'complete') done();
            });
        });
    }
}

/**
 * Joining a watch party, from the viewer page.
 *
 * Receives only: it adds no tracks of its own, so there is nothing for the
 * viewer to control and no camera or microphone involved.
 */
export class WatchViewer {
    constructor() {
        this.connection = null;
        this.stream = null;
        /** Called when the host says it has stopped, rather than simply vanishing. */
        this.onHostStopped = null;
    }

    /**
     * Answer an invitation.
     * @param {string} offerText - the code from the link's fragment
     * @returns {Promise<{code: string, stream: Promise<MediaStream>}>} the code
     *          to send back, and the stream once the host's media arrives
     */
    async join(offerText) {
        const offer = await unpackSignal(offerText);
        if (offer.type !== 'offer') {
            throw new Error('That is a reply, not an invitation.');
        }

        this.connection = new RTCPeerConnection();
        // The host opens this channel; the viewer only receives on it. It
        // carries one message today and is the obvious place for anything else
        // the host ever needs to tell a viewer directly.
        this.connection.addEventListener('datachannel', event => {
            if (event.channel.label !== CONTROL_CHANNEL) return;
            event.channel.addEventListener('message', message => {
                let payload;
                try { payload = JSON.parse(message.data); } catch { return; }
                if (payload?.type === 'bye') this.onHostStopped?.();
            });
        });
        const arrival = new Promise(resolve => {
            this.connection.addEventListener('track', event => {
                this.stream = event.streams[0];
                resolve(event.streams[0]);
            });
        });

        await this.connection.setRemoteDescription(offer);
        await this.connection.setLocalDescription(await this.connection.createAnswer());
        await this._gathered();

        // Echo the invitation back so the host knows which connection this
        // answers without having to rely on the order replies arrive in.
        const code = await packSignal(this.connection.localDescription, { invite: offer.invite });
        return { code, stream: arrival };
    }

    leave() {
        this.connection?.close();
        this.connection = null;
        this.stream = null;
    }

    _gathered() {
        if (this.connection.iceGatheringState === 'complete') return Promise.resolve();
        return new Promise(resolve => {
            const done = () => { clearTimeout(timer); resolve(); };
            const timer = setTimeout(done, GATHER_TIMEOUT_MS);
            this.connection.addEventListener('icegatheringstatechange', () => {
                if (this.connection.iceGatheringState === 'complete') done();
            });
        });
    }
}
