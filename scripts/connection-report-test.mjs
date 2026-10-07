/**
 * What a connection report says, against connections that cannot happen here.
 *
 * The end-to-end suites can only produce the connections this machine is
 * capable of, which is a direct one over loopback. The interesting reports are
 * the other ones -- a relayed route, a route that was found and then came to
 * nothing, a connection with no route at all -- so they are fed in by hand.
 *
 * The rule worth protecting: ICE settling on a pair is not the same as a
 * working connection, and a report that confuses the two tells the one person
 * trying to diagnose a failure the one thing that will mislead them.
 *
 *   node scripts/connection-report-test.mjs
 */
import { describeConnection, describeRoute } from '../assets/js/core/streaming/ConnectionReport.js';

let pass = 0, fail = 0;
const check = (ok, label) => { if (ok) { pass++; console.log(`  PASS  ${label}`); } else { fail++; console.log(`  FAIL  ${label}`); } };

/** A connection whose stats are whatever the test says they are. */
const fake = (connectionState, reports) => ({
    connectionState,
    getStats: async () => ({ forEach: fn => reports.forEach(fn) }),
});
// Real addresses in the stats, so it is provable none of them reach the text.
const localCandidate = (id, candidateType, address) => ({ id, type: 'local-candidate', candidateType, address });
const remoteCandidate = (id, candidateType, address) => ({ id, type: 'remote-candidate', candidateType, address });
const pair = (id, localCandidateId, remoteCandidateId, state, extra = {}) =>
    ({ id, type: 'candidate-pair', localCandidateId, remoteCandidateId, state, ...extra });

const ADDRESSES = /\b\d{1,3}(\.\d{1,3}){3}\b/;

// ── a working direct connection ──
{
    const r = await describeConnection(fake('connected', [
        localCandidate('L', 'srflx', '203.0.113.7'),
        remoteCandidate('R', 'host', '192.168.1.44'),
        pair('P', 'L', 'R', 'succeeded', { selected: true }),
    ]));
    check(r.route === 'direct', `a live pair with no relay is direct (${r.route})`);
    check(/^Connected direct/.test(r.text), `and says so plainly (${r.text})`);
    check(r.text.includes('public address') && r.text.includes('local network'),
        'naming the kind of address at each end');
    check(!ADDRESSES.test(r.text), 'and never the addresses themselves');
    check(await describeRoute(fake('connected', [
        localCandidate('L', 'srflx', '203.0.113.7'),
        remoteCandidate('R', 'host', '192.168.1.44'),
        pair('P', 'L', 'R', 'succeeded', { selected: true }),
    ])) === 'direct', 'the short form agrees');
}

// ── a working connection through a relay ──
{
    const r = await describeConnection(fake('connected', [
        localCandidate('L', 'relay', '198.51.100.9'),
        remoteCandidate('R', 'srflx', '203.0.113.7'),
        pair('P', 'L', 'R', 'succeeded', { selected: true }),
    ]));
    check(r.route === 'relayed', `a pair through a relay is relayed, not direct (${r.route})`);
    check(r.text.includes('relay server'), `and the relay is named (${r.text})`);
}

// ── the spec's way of marking the live pair, rather than Chrome's ──
{
    const r = await describeConnection(fake('connected', [
        localCandidate('L', 'host', '192.168.1.5'),
        remoteCandidate('R', 'host', '192.168.1.9'),
        pair('P', 'L', 'R', 'succeeded'),
        { id: 'T', type: 'transport', selectedCandidatePairId: 'P' },
    ]));
    check(r.route === 'direct', 'a pair named by the transport is read too');
}

// ── a route was found and the connection still did not happen ──
// The case that matters: this is what a mismatched handshake looks like, and
// calling it "connected" would send someone looking for the wrong fault.
{
    const r = await describeConnection(fake('connecting', [
        localCandidate('L', 'host', '192.168.1.5'),
        remoteCandidate('R', 'host', '192.168.1.9'),
        pair('P', 'L', 'R', 'succeeded', { selected: true }),
    ]));
    check(r.route === null, 'a succeeded pair on an unconnected connection claims no route');
    check(r.pairFound === true, 'while still reporting that a route exists');
    check(/route is open but the connection has not finished/.test(r.text),
        `and says exactly that (${r.text})`);
    check(!/^Connected/.test(r.text), 'never beginning with "Connected"');
}

// ── nothing got through at all ──
{
    const r = await describeConnection(fake('failed', [
        localCandidate('L', 'host', '192.168.1.5'),
        remoteCandidate('R', 'host', '192.168.1.9'),
        pair('P', 'L', 'R', 'failed'),
    ]));
    check(/^No route could be found/.test(r.text), `a failed connection says so (${r.text})`);
    check(r.text.includes('You offered: local network') && r.text.includes('They offered: local network'),
        'and says what each end had to work with');
    check(r.route === null && r.pairFound === false, 'with no route claimed');
}

// ── still in progress ──
{
    const r = await describeConnection(fake('connecting', [
        localCandidate('L', 'host', '192.168.1.5'),
        pair('P', 'L', 'R', 'in-progress'),
        pair('P2', 'L', 'R', 'waiting'),
    ]));
    check(/^Still trying 2 routes/.test(r.text), `work in progress is counted (${r.text})`);
    check(r.text.includes('They offered: none yet'), 'and an end with nothing yet is said to have nothing yet');
}
{
    const r = await describeConnection(fake('connecting', [pair('P', 'L', 'R', 'waiting')]));
    check(/^Still trying 1 route\./.test(r.text), `one route is singular (${r.text})`);
}

// ── and it is never the thing that breaks ──
{
    const thrower = { connectionState: 'connected', getStats: async () => { throw new Error('nope'); } };
    const r = await describeConnection(thrower);
    check(/no details available/.test(r.text), `stats that throw degrade quietly (${r.text})`);
    check(await describeRoute(thrower) === null, 'and the short form says nothing rather than guessing');
}
{
    const r = await describeConnection(null);
    check(r.state === 'closed' && /No connection/.test(r.text), `no connection at all is handled (${r.text})`);
    const old = await describeConnection({ connectionState: 'connected' });
    check(/no details available|No connection/.test(old.text),
        'as is a connection too old to have getStats');
}
{
    check(await describeRoute(fake('failed', [])) === 'no route',
        'the short form names a failure');
}

// ── and it does not forget what an end offered once it has given up ──
// A connection that fails drops its candidates from the stats. Reporting
// "none yet" then would understate what happened at the exact moment somebody
// is reading the line to find out what happened.
{
    const connection = {
        connectionState: 'connecting',
        getStats: async () => ({ forEach: fn => [
            localCandidate('L', 'srflx', '203.0.113.7'),
            remoteCandidate('R', 'srflx', '198.51.100.4'),
            pair('P', 'L', 'R', 'in-progress'),
        ].forEach(fn) }),
    };
    const during = await describeConnection(connection);
    check(during.text.includes('You offered: public address')
        && during.text.includes('They offered: public address'),
        `while trying, both ends are reported (${during.text})`);
    // The same connection, now failed and with nothing left in its stats.
    connection.connectionState = 'failed';
    connection.getStats = async () => ({ forEach: () => {} });
    const after = await describeConnection(connection);
    check(after.text.includes('You offered: public address')
        && after.text.includes('They offered: public address'),
        `and still reported after it gives up (${after.text})`);
    check(!after.text.includes('none yet'), 'rather than claiming neither end offered anything');
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
