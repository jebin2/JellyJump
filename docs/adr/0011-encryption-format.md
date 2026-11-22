# 0011. The JJC4 encrypted carrier format

Status: Accepted; written review pending (plan step O7)

## Context

Users want to share a video through platforms that re-encode everything
they receive, while only people with a password can watch it. An encrypted
file uploaded as-is is rejected or destroyed by re-encoding.

## Decision

`shared/utils/PlatformCrypto.js` writes the encrypted video into the
pixels of an ordinary-looking carrier MP4 (1280×720, 30 fps, silent audio):

- Crypto (`CryptoHelper.js`): PBKDF2-SHA-256, 100,000 iterations, 16-byte
  random salt, deriving 512 bits — the first 256 for AES-256-CTR (16-byte
  IV), the second 256 for HMAC-SHA-256 over the ciphertext, checked in
  constant time before anything is decrypted.
- Carriage: the payload is cut into 395-byte shards protected by
  Reed–Solomon erasure coding (200 data + 50 parity per generation) and
  drawn as 16×16-pixel black/white blocks. Header frames, starting with the
  `JJC4` magic and holding the salt, IV, HMAC and metadata, repeat about
  once a second.
- Capacity: about 9.5 KB of payload per second of carrier.

## Consequences

- Survives typical H.264/H.265 re-encoding; up to 20% of a generation's
  frames may be lost.
- Large payloads make long carriers.
- To be settled in the review: the file's header comment says detection is
  "in the audio header" while the header now travels in the video strip, and
  it states a 65,535-shard cap while the code uses a 32-bit index without
  one. Fixed test vectors are to be added (O7).
