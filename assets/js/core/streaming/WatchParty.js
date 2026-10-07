import { Logger } from '../../shared/utils/Logger.js';
import { packSignal, unpackSignal } from './SignalCodec.js';

/** How long to wait for ICE gathering before sending what we have. */
const GATHER_TIMEOUT_MS = 5000;

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
            if (this._peers.get(id)?.connection !== connection) return;
            this._peers.delete(id);
            connection.close();
            Logger.log(`[WatchParty] Invite ${id} ${state}; forgotten`);
        });

        for (const track of stream.getTracks()) connection.addTrack(track, stream);

        await connection.setLocalDescription(await connection.createOffer());
        await this._gathered(connection);

        const code = await packSignal(connection.localDescription, { invite: id });
        const base = baseUrl ?? new URL('watch.html', window.location.href).href;
        // The fragment, not the query: fragments are not sent to servers and do
        // not appear in access logs, so the handshake stays between the two of
        // you even though the link passes through a chat.
        const link = `${base}#${code}`;
        Logger.log(`[WatchParty] Invite ${id} ready (${code.length} chars)`);
        return { id, code, link };
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
        if (peer.accepted) throw new Error('That invitation has already been answered.');

        await peer.connection.setRemoteDescription(answer);
        peer.accepted = true;
        Logger.log(`[WatchParty] Invite ${target} answered`);
        return target;
    }

    /** True while anything is being shared -- an invite out, or someone watching. */
    get isActive() {
        return this._peers.size > 0 || this.player.broadcast.isOpen;
    }

    /** Hang up on everyone and stop capturing. */
    stop() {
        for (const peer of this._peers.values()) peer.connection.close();
        this._peers.clear();
        this.player.broadcast.close();
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
