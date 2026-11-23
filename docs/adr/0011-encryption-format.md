# 0011. The JJC4 encrypted carrier format

Status: Accepted. Written design and review done (plan step O7); two
findings open, see Review.

## Context

Users want to share a video through platforms that re-encode everything
they receive, while only people with a password can watch it. An encrypted
file uploaded as-is is rejected or destroyed by re-encoding.

## Decision

`shared/utils/PlatformCrypto.js` writes the encrypted video into the
pixels of an ordinary-looking carrier MP4 (1280×720, 30 fps, silent audio).

### Cryptography (`shared/utils/CryptoHelper.js`)

| | |
|---|---|
| Key derivation | PBKDF2-HMAC-SHA-256, 100,000 iterations, a fresh 16-byte random salt per file, 512 bits out |
| Keys | bits 0–255: AES-256 key; bits 256–511: HMAC-SHA-256 key. One password, two independent keys |
| Encryption | AES-256-CTR over the whole file |
| Counter block | the IV's first 12 bytes (random) as the nonce, then a 32-bit big-endian block number from 0. The IV's last 4 bytes are written but not used |
| Integrity | HMAC-SHA-256 over the ciphertext (encrypt-then-MAC), compared in constant time, before any byte is decrypted |
| Randomness | `crypto.getRandomValues` for salt and IV |

Nonce handling: every file gets a new salt, so every file gets new keys; a
repeated IV under different keys does no harm. Within a file the block
number would wrap after 2^32 blocks (64 GiB), past the format's 4 GiB cap.

### Header (`shared/utils/JJC4Header.js`)

| Offset | Size | Field |
|---:|---:|---|
| 0 | 4 | magic `JJC4` |
| 4 | 2 | version, big-endian; 5 |
| 6 | 4 | payload (ciphertext) size, big-endian; at most 2^32−1 |
| 10 | 2 | metadata size, big-endian |
| 12 | 16 | salt |
| 28 | 16 | IV |
| 44 | 32 | HMAC |
| 76 | n | metadata, UTF-8 JSON: `rs` (Reed–Solomon data and parity counts), and optionally `name`, `type`, `hint` |

The header is split across as many video frames as it needs (one, unless
the name and hint are long), each marked with a shard index at or above
`0xFFFF0000`, and written again every 30 frames and at the end.

### Carriage (`shared/utils/VisualStripCodec.js`)

The ciphertext is cut into 395-byte shards protected by Reed–Solomon
erasure coding (200 data + 50 parity per generation) and drawn as
16×16-pixel black/white blocks, one shard per frame with its index and a
CRC. Capacity is about 9.5 KB of ciphertext per second of carrier.

### Decryption

Read the header from the first 150 frames; refuse any version but 5;
collect CRC-valid shards until every generation can be rebuilt; rebuild;
derive keys; check the HMAC; decrypt. The decrypted file takes the
metadata's `type` only if it is a video, audio or (non-SVG) image type;
otherwise `application/octet-stream`.

## Review

Checked against the plan's checklist (algorithms, key derivation, nonce
handling, header layout, test vectors):

- [x] Standard primitives from Web Crypto only; nothing hand-rolled but the
      counter block, which `crypto-vectors-test` checks against Node's
      AES-CTR.
- [x] Separate keys for encryption and MAC from one derivation.
- [x] Encrypt-then-MAC; the tag checked in constant time before
      decrypting; a wrong password and a damaged file fail the same way.
- [x] Fresh random salt and IV per file; no nonce reuse under one key.
- [x] Fixed test vectors (key derivation, ciphertext, HMAC, counter block,
      header bytes) in `scripts/crypto-vectors-test.mjs`, computed with
      `node:crypto`, which the app does not use.
- [x] Header layout written down and pinned by a vector.

Findings:

| # | Finding | Status |
|---|---|---|
| F1 | **The header is not covered by the HMAC.** Whoever can edit the carrier can change the IV (the file then decrypts to wrong bytes with no error, since the ciphertext's tag still matches) or the `name`, `type` and `hint` (shown before the password is asked for). Changing the salt, size or `rs` fails the HMAC. | Open: needs format version 6, HMAC over header and ciphertext; version 5 kept readable |
| F2 | **100,000 PBKDF2 rounds is below current guidance** (OWASP: 600,000 for PBKDF2-SHA-256). A carrier is public by design, so a weak password can be guessed offline. The count is not stored in the header, so raising it is also a version 6 change (store it). | Open, with F1 |
| F3 | Any non-empty password is accepted. | Open: a minimum length or strength hint in the Encrypt dialog |
| F4 | A payload over 4 GiB had its size silently truncated to 32 bits in the header. | Fixed: refused before encoding |
| F5 | The decrypted file's type came straight from the unauthenticated metadata; `text/html` opened from the app would run as the app. | Fixed: media types only (`safeMediaType`) |
| F6 | The log ring, which a bug report copies, held the file name and hint from every decrypted header. | Fixed: only the metadata's field names are logged |
| F7 | `PlatformCrypto`'s header comment said the header is in the audio and that the format is capped at 65,535 shards. | Fixed: it is in the video strip; the cap is the 4 GiB size field |

What the format does not hide, by design: that a video is a JellyJump
carrier, the payload's size (from the carrier's length), and the hint.

## Consequences

- Survives typical H.264/H.265 re-encoding; up to 20% of a generation's
  frames may be lost.
- Large payloads make long carriers; the whole ciphertext is held in memory
  to check the HMAC.
- Version 6 (F1, F2) changes what is written; carriers already shared stay
  readable only if the reader keeps version 5.
