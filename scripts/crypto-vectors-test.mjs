/**
 * Fixed test vectors for the JJC4 encryption (docs/adr/0011, plan O7).
 *
 * The encrypt-test suite checks that the app gives back what it was given;
 * that would still pass if both directions changed together, and every
 * carrier already shared would stop opening. These pin the format: key
 * derivation, the keystream, the HMAC and the header bytes, against values
 * worked out with Node's own crypto (an implementation the app does not use).
 *
 *   node scripts/crypto-vectors-test.mjs
 */
import { pbkdf2Sync, createCipheriv, createHmac } from 'node:crypto';
import { CryptoHelper } from '../assets/js/shared/utils/CryptoHelper.js';
import {
    encodeHeader, parseHeader, safeMediaType, MAGIC, VERSION, FIXED_SIZE, MAX_PAYLOAD,
} from '../assets/js/shared/utils/JJC4Header.js';

let pass = 0, fail = 0;
const check = (ok, label) => {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}`); }
};
const hex = (bytes) => Buffer.from(bytes).toString('hex');
const unhex = (s) => new Uint8Array(Buffer.from(s, 'hex'));

// ── The vector ───────────────────────────────────────────────────────────
const PASSWORD = 'correct horse battery staple';
const SALT = unhex('000102030405060708090a0b0c0d0e0f');
const IV = unhex('f0f1f2f3f4f5f6f7f8f9fafb00000000');
const PLAINTEXT = new TextEncoder().encode('JellyJump JJC4 test vector: 47 bytes of text..!');
const AES_KEY = '49d49c25f597846209f0d92e7770ab64e1c75e94b4ce6c509265ee67175d2a1e';
const MAC_KEY = '774b608062dc707de6ae4a581af6282218af5793bd94e935a75bb21f74f7848c';
const CIPHERTEXT = '1e42189d83ec77521dbe6433313130a8f7ba062b7ee3bd0469a3eb49128633b420c2aaaa626ec2cca7f97765ebc1ee';
const HMAC = '5986b8eb9ed7140d0010388377b01adf238d0b340eba0d5fe5d985a835eb9d08';

console.log('\nthe vector itself, from node:crypto');
{
    check(PLAINTEXT.length === 47, 'plaintext is 47 bytes: not a whole number of AES blocks');
    const bits = pbkdf2Sync(PASSWORD, SALT, 100_000, 64, 'sha256');
    check(hex(bits.subarray(0, 32)) === AES_KEY && hex(bits.subarray(32)) === MAC_KEY,
        'PBKDF2-SHA-256, 100,000 rounds, 512 bits: AES key then HMAC key');
    const cipher = createCipheriv('aes-256-ctr', bits.subarray(0, 32), IV);
    const ct = Buffer.concat([cipher.update(PLAINTEXT), cipher.final()]);
    check(hex(ct) === CIPHERTEXT, 'AES-256-CTR from the IV as the first counter block');
    check(createHmac('sha256', bits.subarray(32)).update(ct).digest('hex') === HMAC, 'HMAC-SHA-256 over the ciphertext');
}

console.log('\nCryptoHelper gives the same');
const { aesKey, hmacKey } = await CryptoHelper.deriveKeys(PASSWORD, SALT);
{
    check(CryptoHelper.PBKDF2_ITERATIONS === 100_000 && CryptoHelper.SALT_SIZE === 16 && CryptoHelper.IV_SIZE === 16,
        'parameters as in the ADR');
    const data = PLAINTEXT.slice();
    await CryptoHelper._xorRegion(data, 0, data.length, aesKey, IV, 0);
    check(hex(data) === CIPHERTEXT, 'encrypting the plaintext gives the ciphertext');
    const mac = await CryptoHelper._computeHmac(hmacKey, data);
    check(hex(mac) === HMAC, 'the HMAC matches');
    check(CryptoHelper._constantTimeEqual(mac, unhex(HMAC)) && !CryptoHelper._constantTimeEqual(mac, unhex(HMAC.replace(/.$/, '0'))),
        'the HMAC comparison accepts the right tag and refuses one changed in its last byte');

    // Decrypting a piece from the middle, as a streamed read would.
    const piece = unhex(CIPHERTEXT).slice(20, 41);
    await CryptoHelper._xorRegion(piece, 0, piece.length, aesKey, IV, 20);
    check(new TextDecoder().decode(piece) === new TextDecoder().decode(PLAINTEXT.slice(20, 41)),
        'decrypting from byte 20 (mid-block) gives the same bytes');

    const back = unhex(CIPHERTEXT);
    await CryptoHelper._xorRegion(back, 0, back.length, aesKey, IV, 0);
    check(hex(back) === hex(PLAINTEXT), 'decrypting gives the plaintext back');
}

console.log('\nthe counter block');
{
    const block = CryptoHelper._buildCounter(unhex('f0f1f2f3f4f5f6f7f8f9fafbdeadbeef'), 16 * 0x01020304 + 5);
    check(hex(block) === 'f0f1f2f3f4f5f6f7f8f9fafb01020304',
        'the first 12 IV bytes are the nonce; the last 4 are the block number, big-endian; the IV\'s own last 4 are not used');
    const data = PLAINTEXT.slice();
    await CryptoHelper._xorRegion(data, 0, data.length, aesKey, unhex('f0f1f2f3f4f5f6f7f8f9fafbffffffff'), 0);
    check(hex(data) === CIPHERTEXT, 'so an IV differing only there gives the same ciphertext (96 random bits of nonce)');
}

console.log('\nthe header');
const META = { rs: [200, 50], name: 'clip.mp4', type: 'video/mp4', hint: 'say friend' };
const HEADER = '4a4a4334' + '0005' + '0000002f' + '0048'
    + '000102030405060708090a0b0c0d0e0f'
    + 'f0f1f2f3f4f5f6f7f8f9fafb00000000'
    + HMAC
    + hex(new TextEncoder().encode(JSON.stringify(META)));
{
    check(MAGIC === 'JJC4' && VERSION === 5 && FIXED_SIZE === 76, 'magic JJC4, version 5, 76 fixed bytes');
    const bytes = encodeHeader({ payloadSize: 47, salt: SALT, iv: IV, hmac: unhex(HMAC), metadata: META });
    check(JSON.stringify(META).length === 0x48, 'the vector\'s metadata is 72 bytes');
    check(hex(bytes) === HEADER, 'the header bytes are exactly the vector');

    const padded = new Uint8Array(bytes.length + 300);
    padded.set(bytes);
    const h = parseHeader(padded);
    check(h.version === 5 && h.payloadSize === 47 && hex(h.salt) === hex(SALT) && hex(h.iv) === hex(IV) && hex(h.hmac) === HMAC,
        'read back, with the zero padding of a whole frame after it');
    check(JSON.stringify(h.metadata) === JSON.stringify(META), 'the metadata reads back');

    const broken = bytes.slice();
    broken[FIXED_SIZE] = 0x7b + 1; // not JSON any more
    check(JSON.stringify(parseHeader(broken).metadata) === '{}', 'metadata that is not JSON reads as none');
    const arrayMeta = encodeHeader({ payloadSize: 1, salt: SALT, iv: IV, hmac: unhex(HMAC), metadata: /** @type {any} */ ([1]) });
    check(JSON.stringify(parseHeader(arrayMeta).metadata) === '{}', 'metadata that is not an object reads as none');

    let threw = '';
    try { parseHeader(bytes.slice(0, 75)); } catch (e) { threw = e.message; }
    check(/too short/.test(threw), 'a header shorter than 76 bytes is refused');
}

console.log('\nlimits');
{
    const fields = { salt: SALT, iv: IV, hmac: unhex(HMAC), metadata: {} };
    const refuses = (f) => { try { encodeHeader(f); return false; } catch { return true; } };
    check(!refuses({ ...fields, payloadSize: MAX_PAYLOAD }), 'a payload of 2^32-1 bytes fits the size field');
    check(refuses({ ...fields, payloadSize: MAX_PAYLOAD + 1 }), 'one byte more is refused, not written as a wrapped size');
    check(refuses({ ...fields, payloadSize: 1, salt: SALT.slice(0, 8) }), 'a short salt is refused');
    check(refuses({ ...fields, payloadSize: 1, metadata: { hint: 'x'.repeat(70000) } }), 'metadata over 64 KB is refused');
}

console.log('\nthe decrypted file\'s type');
{
    check(safeMediaType('video/mp4') === 'video/mp4' && safeMediaType('audio/webm') === 'audio/webm'
        && safeMediaType('image/png') === 'image/png', 'video, audio and image types are kept');
    check(['text/html', 'application/xhtml+xml', 'image/svg+xml', 'video/mp4\n', undefined, 42].every((t) => safeMediaType(t) === 'application/octet-stream'),
        'anything else, which could run as the app if opened, becomes application/octet-stream');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
