/**
 * What happened to a peer connection, in words.
 *
 * A watch party either works or sits on "connecting…", and the difference is
 * usually the shape of somebody's home network rather than anything either
 * person did. This reads that off the connection so it can be said out loud:
 * which kind of address each end offered, and which pair -- if any -- the two
 * of them managed to use.
 *
 * Candidate *types* only, never addresses. The whole point is a line a viewer
 * can paste to the host, and a candidate address is that person's IP.
 */

/** What each kind of address means to someone who did not ask for jargon. */
const PLAIN = {
    host: 'local network',
    srflx: 'public address',
    prflx: 'public address (learned)',
    relay: 'relay server',
};

const plain = type => PLAIN[type] || type || 'unknown';

/**
 * What each connection has been seen to offer, ever.
 *
 * A connection that has given up drops its candidates from the stats, so a
 * report taken afterwards says "none yet" about an end that plainly did offer
 * something -- the worst moment to start understating what happened, since it
 * is the moment somebody is reading the line to work out what went wrong.
 * Weak, so remembering costs nothing once the connection is gone.
 */
const seen = new WeakMap();

function remember(connection, local, remote) {
    const kept = seen.get(connection) || { local: new Set(), remote: new Set() };
    for (const type of local) kept.local.add(type);
    for (const type of remote) kept.remote.add(type);
    seen.set(connection, kept);
    return { local: [...kept.local], remote: [...kept.remote] };
}

/**
 * @param {RTCPeerConnection|null} connection
 * @returns {Promise<{state: string, route: string|null, local: string[],
 *          remote: string[], tried: number, text: string}>}
 */
export async function describeConnection(connection) {
    const state = connection?.connectionState ?? 'closed';
    const empty = { state, route: null, local: [], remote: [], tried: 0 };
    if (!connection || typeof connection.getStats !== 'function') {
        return { ...empty, text: 'No connection to report on.' };
    }

    let stats;
    try {
        stats = await connection.getStats();
    } catch {
        // Stats are a nicety; never let them be the thing that breaks.
        return { ...empty, text: `Connection ${state}; no details available.` };
    }

    const candidates = new Map();
    const pairs = [];
    let selectedId = null;
    stats.forEach(report => {
        if (report.type === 'local-candidate' || report.type === 'remote-candidate') {
            candidates.set(report.id, report);
        } else if (report.type === 'candidate-pair') {
            pairs.push(report);
            // Chrome marks the live pair on the pair itself; the spec puts it
            // on the transport. Both are read, so neither browser is a gap.
            if (report.selected) selectedId = report.id;
        } else if (report.type === 'transport' && report.selectedCandidatePairId) {
            selectedId = report.selectedCandidatePairId;
        }
    });

    const typesOf = kind => [...new Set([...candidates.values()]
        .filter(c => c.type === kind)
        .map(c => c.candidateType))].filter(Boolean);
    const { local, remote } = remember(
        connection, typesOf('local-candidate'), typesOf('remote-candidate'));
    const live = pairs.find(p => p.id === selectedId)
        || pairs.find(p => p.state === 'succeeded' && p.nominated)
        || pairs.find(p => p.state === 'succeeded');

    const facts = {
        state, local, remote, tried: pairs.length, route: null, pairFound: !!live,
    };

    // A found route is not a working connection. ICE can settle on a pair and
    // the connection still never complete -- the handshake that follows can
    // fail on its own -- and a report that said "connected" there would be
    // telling the one person trying to diagnose this the one wrong thing.
    // So the route is only claimed when the connection itself agrees.
    if (live && state === 'connected') {
        const ours = candidates.get(live.localCandidateId)?.candidateType;
        const theirs = candidates.get(live.remoteCandidateId)?.candidateType;
        facts.route = (ours === 'relay' || theirs === 'relay') ? 'relayed' : 'direct';
        return {
            ...facts,
            text: `Connected ${facts.route} — your ${plain(ours)} to their ${plain(theirs)}.`,
        };
    }

    // Otherwise what is worth saying is which kinds of address each end had to
    // work with, because that is what decides whether there was ever a route.
    const mine = local.length ? local.map(plain).join(', ') : 'none yet';
    const theirs = remote.length ? remote.map(plain).join(', ') : 'none yet';
    const tail = `You offered: ${mine}. They offered: ${theirs}.`;
    if (live) {
        return { ...facts, text: `A route is open but the connection has not finished. ${tail}` };
    }
    if (state === 'failed') {
        return { ...facts, text: `No route could be found. ${tail}` };
    }
    return { ...facts, text: `Still trying ${facts.tried} route${facts.tried === 1 ? '' : 's'}. ${tail}` };
}

/** The short form, for a list of viewers rather than a page of its own. */
export async function describeRoute(connection) {
    const report = await describeConnection(connection);
    if (report.route) return report.route;
    if (report.state === 'failed') return 'no route';
    return null;
}
