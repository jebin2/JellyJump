import { Logger } from '../../shared/utils/Logger.js';
import { packSignal, unpackSignal } from './SignalCodec.js';
import { BASE_URL } from '../../shared/config.js';
import { describeConnection, describeMedia } from './ConnectionReport.js';

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
 * Where to ask what this machine looks like from outside.
 *
 * With no ICE servers at all, an invitation carries only `host` candidates --
 * this machine's own addresses -- which two computers in one house can use and
 * nobody else can. Measured on a real connection: no servers gave 2 host
 * candidates, a STUN server gave 2 host and 2 srflx, and it is the srflx one
 * that lets a friend on their own internet connect.
 *
 * This is not a backend. A STUN server is asked one question -- what address
 * did this packet come from -- and keeps nothing; the media never touches it
 * and neither does the handshake, which still travels by hand. Two are listed
 * so one being down is not the end of the party.
 *
 * What it still does not cover is a network that gives every connection a
 * different outside port, which happens behind symmetric NAT and on some
 * mobile carriers. Nothing but a relay fixes that, and a relay is a server
 * carrying the video, which is the one thing this feature does not have.
 */
const ICE_SERVERS = [
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.l.google.com:19302' },
];

/** The connection settings both ends share. */
export function rtcConfiguration() {
    return { iceServers: ICE_SERVERS };
}

/**
 * How fast the encoder may assume the link is, in kbps, before it has measured
 * it.
 *
 * Left alone, WebRTC starts near 300kbps and feels its way up, which costs
 * about twenty seconds at the start of every party. Measured on a real 2Mbit
 * link: 320x180 for the first eight seconds, 480x270 until eighteen, and only
 * then the 960x540 it then stayed at. The link could carry that the whole time.
 *
 * 600 rather than something bolder because this number has to be safe on the
 * links it cannot see. At 1200, a 700kbit link froze for a second or two while
 * the estimator took the overshoot back; at 600 the same link merely started at
 * 640x360 and eased down to its 480x270 without dropping a frame, while the
 * 2Mbit link still reached 640x360 in three seconds instead of eighteen.
 *
 * Deliberately not degradationPreference: 'maintain-resolution', which measured
 * better still -- a full 1280x720 at 30fps on the 2Mbit link -- and turned the
 * 700kbit one into 1280x720 at five frames a second. A mobile link is exactly
 * the one that changes while somebody is watching.
 */
const START_BITRATE_KBPS = 600;

/**
 * Tell the encoder where to start, through the answer.
 *
 * It has to be the answer: an encoder is constrained by the description it
 * receives, so the same line in the offer does nothing whatsoever. This edits
 * the host's own copy of what the viewer sent, on its way in -- nothing goes
 * back over the wire, and a viewer running older code is unaffected.
 */
export function withStartBitrate(sdp, kbps = START_BITRATE_KBPS) {
    if (!sdp) return sdp;
    return sdp.replace(/^a=fmtp:(\d+) (.*)$/gm, (line, pt, params) =>
        /x-google-start-bitrate/.test(params)
            ? line
            : `a=fmtp:${pt} ${params};x-google-start-bitrate=${kbps}`);
}

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
        this._departure = null;
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
     * The same list, with how each connection is actually carrying itself.
     *
     * Separate from invites() because it has to read the connection's stats,
     * which is asynchronous, and most callers only want the states. A host
     * watching a friend stay on "connecting" is the one caller that needs to
     * know whether anything is getting through at all.
     *
     * @returns {Promise<Array<{id: number, state: string, accepted: boolean,
     *          route: string|null, detail: string, limitedBy: string|null}>>}
     */
    async invitesWithRoutes() {
        return Promise.all([...this._peers.entries()].map(async ([id, peer]) => {
            const report = await describeConnection(peer.connection);
            const flow = await describeMedia(peer.connection);
            return {
                id,
                state: peer.connection.connectionState,
                accepted: peer.accepted,
                route: report.route,
                // What is going wrong, or -- once it is going right -- how
                // well. The second is what tells a host whether a friend's
                // soft picture is their network or just the encoder warming up.
                detail: report.route ? flow.text : report.text,
                limitedBy: flow.limitedBy,
            };
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
     *        defaults to a viewer page a friend can actually reach
     * @returns {Promise<{id: number, code: string, link: string}>}
     */
    /**
     * A host who closes the tab or quits the app has stopped sharing just as
     * surely as one who pressed the button, and their friends deserve the same
     * notice. Without this they keep a frozen frame until ICE gives up on the
     * other end, about eight seconds later.
     *
     * pagehide rather than beforeunload: it fires on the ways out that
     * beforeunload misses, and this has nothing to ask the host first.
     */
    _watchForDeparture() {
        if (this._departure) return;
        this._departure = () => this._sayGoodbye();
        window.addEventListener('pagehide', this._departure);
    }

    /**
     * Where the viewer page lives, as a friend can reach it.
     *
     * In the browser that is watch.html beside this one. The desktop app
     * loads its UI from file://, where the same reckoning gives a path on
     * this machine that nobody else can open -- a link that cannot work, sent
     * in good faith. The hosted copy is used there instead: it is the same
     * static page, and the handshake still rides in the fragment, which is
     * never sent to any server, so nothing about the party becomes less
     * private for being pasted into a hosted URL.
     *
     * @param {string} [here] - the page doing the inviting; defaults to this one
     */
    _viewerPageUrl(here = window.location.href) {
        const beside = new URL('watch.html', here);
        if (beside.protocol === 'http:' || beside.protocol === 'https:') return beside.href;
        return `${BASE_URL}/watch.html`;
    }

    async invite({ baseUrl } = {}) {
        this._watchForDeparture();
        const stream = this.player.broadcast.open();
        if (!stream) throw new Error('There is nothing playing to share.');
        this.player.broadcast.attachAudio();

        const connection = new RTCPeerConnection(rtcConfiguration());
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
        const base = baseUrl ?? this._viewerPageUrl();
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

        await peer.connection.setRemoteDescription({
            type: 'answer', sdp: withStartBitrate(answer.sdp),
        });
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
    /**
     * Tell everyone watching that this is over.
     *
     * Synchronous on purpose: it is also called while the page is being torn
     * down, where there is no later to continue in.
     */
    _sayGoodbye() {
        for (const peer of this._peers.values()) {
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
    }

    stop() {
        const peers = [...this._peers.values()];
        for (const peer of peers) clearTimeout(peer.timer);
        this._sayGoodbye();
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
        /**
         * Called with the name of the step join() has reached: 'reading',
         * then 'finding'. The step, not the sentence -- what to say about it
         * is the page's business, and lives with the page's other wording.
         */
        this.onProgress = null;
    }

    /**
     * Answer an invitation.
     * @param {string} offerText - the code from the link's fragment
     * @returns {Promise<{code: string, stream: Promise<MediaStream>}>} the code
     *          to send back, and the stream once the host's media arrives
     */
    async join(offerText) {
        this.onProgress?.('reading');
        const offer = await unpackSignal(offerText);
        if (offer.type !== 'offer') {
            throw new Error('That is a reply, not an invitation.');
        }

        this.connection = new RTCPeerConnection(rtcConfiguration());
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
        // The one step that takes long enough for a viewer to wonder: up to
        // GATHER_TIMEOUT_MS of asking the network what addresses it has.
        this.onProgress?.('finding');
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
