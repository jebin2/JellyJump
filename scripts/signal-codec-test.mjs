/**
 * Packing and unpacking the handshake blobs that travel by hand.
 *
 * These strings get pasted into chat windows and URLs, so the failure modes
 * that matter are not cryptographic -- they are a paste that picked up a
 * newline, a link that got truncated, or a character a messaging app decided
 * to alter.
 *
 *   node scripts/signal-codec-test.mjs
 */
import { packSignal, unpackSignal } from '../assets/js/core/streaming/SignalCodec.js';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};
const rejects = async (fn, label) => {
    try { await fn(); check(false, label + ' (did not throw)'); }
    catch { check(true, label); }
};

// A representative offer, with the shapes that matter: candidates, fingerprint,
// ice credentials, and the long codec block that dominates the size.
const sdp = [
    'v=0', 'o=- 4611731400430051336 2 IN IP4 127.0.0.1', 's=-', 't=0 0',
    'a=group:BUNDLE 0 1', 'm=video 9 UDP/TLS/RTP/SAVPF 96 97 98 99 100 101 102',
    'c=IN IP4 0.0.0.0', 'a=ice-ufrag:4ZcD', 'a=ice-pwd:2/1muCWoOi3uLifh0NuRHlsw',
    'a=fingerprint:sha-256 4A:AD:B9:B1:3F:82:18:3B:54:02:12:DF:3E:5D:49:6B',
    'a=candidate:1 1 udp 2113937151 192.168.1.14 54321 typ host',
    'a=candidate:2 1 udp 1677729535 203.0.113.9 41234 typ srflx',
    ...Array.from({ length: 40 }, (_, i) => `a=rtpmap:${96 + i} VP8/90000`),
].join('\r\n');

console.log('\nit survives a round trip');
const packed = await packSignal({ type: 'offer', sdp });
const back = await unpackSignal(packed);
check(back.type === 'offer', 'the type comes back');
check(back.sdp === sdp, 'the sdp comes back byte for byte, newlines included');

console.log('\nit is safe to put in a url and a chat message');
check(/^jj1\.[A-Za-z0-9_-]+$/.test(packed), 'only url-safe characters, no + / or =');
check(!packed.includes('\n'), 'a single line');
check(packed.length < sdp.length, `smaller than the sdp (${packed.length} vs ${sdp.length})`);
check(packed === encodeURIComponent(packed), 'unchanged by url encoding');

console.log('\nit tolerates what a paste does to text');
check((await unpackSignal('  ' + packed + '  ')).sdp === sdp, 'leading and trailing spaces');
check((await unpackSignal(packed.slice(0, 30) + '\n' + packed.slice(30))).sdp === sdp,
    'a newline inserted by a chat window wrapping the line');

console.log('\nit refuses what is not a signal, rather than failing later');
await rejects(() => unpackSignal('hello'), 'ordinary text');
await rejects(() => unpackSignal(''), 'nothing at all');
await rejects(() => unpackSignal(undefined), 'undefined');
await rejects(() => unpackSignal(packed.slice(0, packed.length - 20)), 'a truncated paste');
await rejects(() => unpackSignal('jj1.' + 'A'.repeat(40)), 'the right prefix over nonsense');
const emptySdp = await packSignal({ type: 'offer', sdp: '' });
await rejects(() => unpackSignal(emptySdp), 'an empty sdp');

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
