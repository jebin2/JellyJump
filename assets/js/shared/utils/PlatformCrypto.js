/**
 * PlatformCrypto — JJC4 format
 *
 * A transcode-survivable encrypted video format.  The encrypted payload is
 * embedded INSIDE a carrier MP4's actual pixel and audio content so that
 * any platform's re-encoding cannot strip it.
 *
 * Two independent channels carry data:
 *
 *   Audio track — carries the crypto parameters (salt, IV, HMAC, metadata).
 *     Uses 16-tone OOK at 800–6800 Hz, 200 ms symbols.
 *     Repeated 3× for robustness. Survives AAC 128 kbps transcoding.
 *
 *   Video strip — carries the encrypted payload as 16×16-pixel black/white
 *     blocks across the frame. The payload is split into 395-byte shards
 *     protected by Reed–Solomon erasure coding (200 data + 50 parity per
 *     generation → 25% overhead, up to 20% of frames per generation may be
 *     lost). Survives H.264/H.265 transcoding at typical platform bitrates.
 *
 * Carrier MP4 structure:
 *   Video: 1280×720, 30 fps
 *     Top 80%  — animated placeholder ("This video is encrypted")
 *     Bottom 20% — visual data strip
 *   Audio: 48 kHz mono, AAC
 *     Header tones (3 repetitions) + silence to match video duration
 *
 * File size guideline:
 *   ~9.5 KB/sec of usable visual-strip capacity at 30 fps after 25% parity.
 *   Short-form platforms (≈140 s limit) → ≈1.3 MB max payload.
 *   Long-form platforms (≈10 min limit) → ≈5.7 MB max.
 *   Hard cap: 65 535 shards (uint16 header index) → ≈20 MB payload.
 *
 * Crypto: AES-256-CTR + HMAC-SHA256 + PBKDF2 (100k iter).
 * Detection: "JJC4" magic in the audio header.
 */

import { Logger } from './Logger.js';
import { CryptoHelper } from './CryptoHelper.js';
import { DOMAIN } from '../config.js';
import {
    encodeAudio, decodeAudio, audioDurationSec, AUDIO_SAMPLE_RATE,
} from './AudioDataCodec.js';
import {
    encodeFrameToI420, decodeFrame,
    planShards, buildShards, interleavedShardOrder, assembleShardsRS,
    RS_DATA_SHARDS, RS_PARITY_SHARDS,
    DATA_BYTES_PER_FRAME, FPS, VIDEO_W, VIDEO_H,
    I420_Y_SIZE, I420_UV_SIZE, I420_SIZE,
    stripDurationSec,
} from './VisualStripCodec.js';

const MAGIC = 'JJC4';
const VERSION = 4;                 // format version carried in the audio header
// The frame header's shard index is uint32, so the format itself imposes no
// practical ceiling — up to 2^32-1 shards. Size is bounded by memory instead.
const MAX_TOTAL_SHARDS = 0xFFFFFFFF;
const AUDIO_REPEAT = 3;   // transmit the audio header this many times
const AUDIO_GAP_SEC = 1;  // silence between audio repetitions

export class PlatformCrypto {
    static MAGIC = MAGIC;

    /**
     * Payload size above which the carrier is streamed to a disk file instead
     * of assembled in RAM. BufferTarget accumulates the whole carrier as one
     * ArrayBuffer (~2 GB engine limit); at ~20× payload→carrier expansion,
     * ~64 MB of payload is a safe in-RAM ceiling. Larger payloads must supply
     * a writable stream (see options.target / options.fileStream).
     */
    static IN_RAM_PAYLOAD_LIMIT = 64 * 1024 * 1024;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Encrypt a file into a JJC4 carrier MP4.
     * @param {Blob} blob
     * @param {string} password
     * @param {Object} [options]
     * @param {string}   [options.filename]
     * @param {string}   [options.mimeType]
     * @param {string}   [options.hint]
     * @param {Function} [options.onProgress]  (0..1)
     * @param {AbortSignal} [options.signal]
     * @returns {Promise<Blob>}
     */
    static async encrypt(blob, password, options = {}) {
        const { filename, mimeType, hint, onProgress, signal } = options;
        const progress = (v) => onProgress && onProgress(v);

        const t0 = performance.now();
        const ms = (a, b) => `${(b - a).toFixed(1)}ms`;

        Logger.log(`[PlatformCrypto] ──── ENCRYPT START — ${(blob.size / 1048576).toFixed(2)} MB ────`);
        const step = (n, msg) => Logger.log(`[PlatformCrypto] [t=${ms(t0, performance.now())}] STEP ${n}/6 — ${msg}`);
        progress(0);

        // ── Step 1: Derive keys + encrypt payload ─────────────────────────
        let t = performance.now();
        const salt = crypto.getRandomValues(new Uint8Array(CryptoHelper.SALT_SIZE));
        const iv   = crypto.getRandomValues(new Uint8Array(CryptoHelper.IV_SIZE));
        const { aesKey, hmacKey } = await CryptoHelper.deriveKeys(password, salt);
        step(1, `keys derived (PBKDF2) in ${ms(t, performance.now())}`);

        t = performance.now();
        const ciphertext = new Uint8Array(await blob.arrayBuffer());
        step(2, `read ${(ciphertext.length / 1048576).toFixed(2)} MB into memory in ${ms(t, performance.now())}`);

        t = performance.now();
        await CryptoHelper._xorRegion(ciphertext, 0, ciphertext.length, aesKey, iv, 0);
        step(3, `AES-256-CTR encrypt (${(ciphertext.length / 1048576).toFixed(2)} MB) in ${ms(t, performance.now())}`);
        progress(0.25);

        t = performance.now();
        const hmac = await CryptoHelper._computeHmac(hmacKey, ciphertext);
        step(4, `HMAC-SHA256 integrity tag in ${ms(t, performance.now())}`);
        progress(0.35);

        // ── Step 2: Build audio header bytes ──────────────────────────────
        // Layout: magic(4) + version(2) + payloadSize(4) + metadataSize(2)
        //       + salt(16) + iv(16) + hmac(32) + metadata JSON
        const metadata = { rs: [RS_DATA_SHARDS, RS_PARITY_SHARDS] }; // v4 RS params
        if (filename) metadata.name = filename;
        if (mimeType)  metadata.type = mimeType;
        if (hint)      metadata.hint = hint;
        const metaBytes   = new TextEncoder().encode(JSON.stringify(metadata));
        const payloadSize = ciphertext.length;

        // v4 shard plan — encoder and decoder derive the identical plan from
        // (payloadSize, rs) alone, so nothing else needs to travel in-band.
        const plan = planShards(payloadSize);
        if (plan.totalShards > MAX_TOTAL_SHARDS) {
            throw new Error(`File too large to encrypt: ${(payloadSize / 1048576).toFixed(1)} MB exceeds the format's shard limit.`);
        }
        // Above the in-RAM ceiling the carrier must stream to a disk file
        // (BufferTarget can't hold a >2 GB ArrayBuffer). The caller supplies a
        // FileSystemFileHandle via options.fileHandle for that path.
        const streamToDisk = payloadSize > PlatformCrypto.IN_RAM_PAYLOAD_LIMIT;
        if (streamToDisk && !options.fileHandle) {
            throw new Error(`File too large to encrypt in memory: ${(payloadSize / 1048576).toFixed(1)} MB. A save location is required to stream the carrier to disk.`);
        }

        const headerFixed = new Uint8Array(4 + 2 + 4 + 2 + 16 + 16 + 32); // 76 bytes
        const hdv = new DataView(headerFixed.buffer);
        headerFixed.set(new TextEncoder().encode(MAGIC), 0);         // magic
        hdv.setUint16(4, VERSION, false);                            // version = 4
        hdv.setUint32(6, payloadSize, false);                        // payloadSize
        hdv.setUint16(10, metaBytes.length, false);                  // metadataSize
        headerFixed.set(salt, 12);                                   // salt
        headerFixed.set(iv,   28);                                   // iv
        headerFixed.set(hmac, 44);                                   // hmac

        const audioHeaderBytes = new Uint8Array(headerFixed.length + metaBytes.length);
        audioHeaderBytes.set(headerFixed, 0);
        audioHeaderBytes.set(metaBytes, headerFixed.length);
        Logger.log(`[PlatformCrypto] Audio header — ${audioHeaderBytes.length} B (fixed=76 meta=${metaBytes.length})`);

        // ── Step 3: Compute durations ──────────────────────────────────────
        const singleAudioSec = audioDurationSec(audioHeaderBytes.length);
        const totalAudioSec  = singleAudioSec * AUDIO_REPEAT +
                               AUDIO_GAP_SEC  * (AUDIO_REPEAT - 1);

        const videoDataSec = plan.totalShards / FPS;
        const videoSec     = Math.max(totalAudioSec + 2, videoDataSec) + 1; // 1 s tail
        const totalFrames  = Math.ceil(videoSec * FPS);

        step(5, `planned carrier: payload=${(payloadSize/1048576).toFixed(2)}MB → ${plan.totalShards} shards (${plan.generations.length} gen), ${videoSec.toFixed(1)}s video, ${totalFrames} frames`);
        // Loud heads-up when the carrier will be very long — the encode time
        // and file size scale linearly with frame count, so this is where a
        // multi-GB payload turns into an hours-long job.
        if (videoSec > 600) {
            const encMin = (totalFrames / 500 / 60).toFixed(0); // ~500 fps observed
            Logger.warn(`[PlatformCrypto] ⚠ large carrier: ${(videoSec/3600).toFixed(1)}h video, ${totalFrames} frames — encode will take roughly ${encMin} min and the output file will be very large.`);
        }
        progress(0.40);

        // ── Step 4: Generate carrier MP4 ─────────────────────────────────
        const mp4Blob = await PlatformCrypto._generateCarrierMp4({
            ciphertext,
            plan,
            audioHeaderBytes,
            totalAudioSec,
            totalFrames,
            singleAudioSec,
            hint,
            signal,
            t0,
            fileHandle: options.fileHandle,   // present → stream carrier to disk
            onProgress: (v) => progress(0.40 + v * 0.55),
        });

        progress(1);
        const totalMs = performance.now() - t0;
        if (mp4Blob) {
            Logger.log(`[PlatformCrypto] ──── ENCRYPT DONE — ${(mp4Blob.size/1048576).toFixed(2)} MB in ${(totalMs/1000).toFixed(1)}s ────`);
        } else {
            Logger.log(`[PlatformCrypto] ──── ENCRYPT DONE — streamed to disk in ${(totalMs/1000).toFixed(1)}s ────`);
        }
        return mp4Blob; // null when streamed straight to a disk file
    }

    /**
     * Decrypt a JJC4 carrier MP4.
     * @param {Blob} blob
     * @param {string} password
     * @param {Function} [onProgress]
     * @param {AbortSignal} [signal]
     * @returns {Promise<{blob: Blob, metadata: Object}>}
     */
    static async decrypt(blob, password, onProgress, signal) {
        const progress = (v) => onProgress && onProgress(v);
        Logger.log(`[PlatformCrypto] DECRYPT start — ${blob.size} bytes`);
        progress(0);

        const { MediaBunny } = await import('../../core/MediaBunny.js');

        const blobSource = new MediaBunny.BlobSource(blob);
        const input = new MediaBunny.Input({
            source: blobSource,
            formats: MediaBunny.ALL_FORMATS,
        });

        // ── Step 1: Decode audio header ───────────────────────────────────
        const audioTracks = await input.getAudioTracks();
        if (!audioTracks.length) throw new Error('JJC4: no audio track found');

        const headerBytes = await PlatformCrypto._readAndDecodeAudio(audioTracks[0]);
        if (!headerBytes) throw new Error('JJC4: could not decode audio header');
        Logger.log(`[PlatformCrypto] Audio header decoded — ${headerBytes.length} B`);
        progress(0.15);

        const hdv          = new DataView(headerBytes.buffer, headerBytes.byteOffset);
        const version      = hdv.getUint16(4,  false);
        const payloadSize  = hdv.getUint32(6,  false);
        const metadataSize = hdv.getUint16(10, false);
        const salt         = headerBytes.slice(12, 28);
        const iv           = headerBytes.slice(28, 44);
        const storedHmac   = headerBytes.slice(44, 76);
        let metadata = {};
        if (metadataSize > 0) {
            try {
                metadata = JSON.parse(
                    new TextDecoder().decode(headerBytes.slice(76, 76 + metadataSize))
                );
            } catch { /* ignore parse errors */ }
        }

        Logger.log(`[PlatformCrypto] Header parsed — version=${version} payloadSize=${payloadSize} B, salt=${salt.length}B iv=${iv.length}B hmac=${storedHmac.length}B meta=${JSON.stringify(metadata)}`);
        progress(0.20);

        // Reed–Solomon shards — derive the identical plan the encoder used
        // from (payloadSize, rs) alone.
        if (version < VERSION) {
            throw new Error(`Unsupported JJC version ${version} (expected ${VERSION}). This file was made by an incompatible build.`);
        }
        const rs = Array.isArray(metadata.rs) && metadata.rs.length === 2
            ? metadata.rs : [RS_DATA_SHARDS, RS_PARITY_SHARDS];
        const plan = planShards(payloadSize, rs[0], rs[1]);
        const shardSlots = new Array(plan.totalShards).fill(null);
        const genOf = new Uint16Array(plan.totalShards);
        plan.generations.forEach((g, gi) => genOf.fill(gi, g.start, g.start + g.k + g.m));
        const genHave = new Uint32Array(plan.generations.length);
        let gensComplete = 0;
        Logger.log(`[PlatformCrypto] RS plan — ${plan.totalShards} shards, ${plan.generations.length} generation(s), rs=[${rs}]`);

        // ── Step 2: Decode visual strip ───────────────────────────────────
        const videoTracks = await input.getVideoTracks();
        if (!videoTracks.length) throw new Error('JJC4: no video track found');

        const videoTrack = videoTracks[0];
        const duration   = await videoTrack.computeDuration();
        const numFrames  = Math.round(duration * FPS);

        const canvas = PlatformCrypto._createCanvas(VIDEO_W, VIDEO_H);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        let frameCount = 0;

        // Iterate the track's ACTUAL frames — never sample at computed
        // timestamps. WebM stores timestamps in integer milliseconds, so
        // sampling at exact i/30 s falls just before every third stored
        // timestamp and silently returns the previous frame, losing ⅓ of all
        // shards. Each frame self-identifies via its header, so decoding
        // needs no timing assumptions at all.
        const videoSink = new MediaBunny.VideoSampleSink(videoTrack);
        for await (const sample of videoSink.samples()) {
            sample.draw(ctx, 0, 0, VIDEO_W, VIDEO_H);
            const imageData = ctx.getImageData(0, 0, VIDEO_W, VIDEO_H);
            const decoded = decodeFrame(imageData);
            if (decoded && decoded.valid) {
                // CRC-valid frames fill shard slots; failed/absent frames are
                // erasures — Reed–Solomon heals them at assembly.
                const idx = decoded.shardIndex;
                if (idx < plan.totalShards && !shardSlots[idx]) {
                    shardSlots[idx] = decoded.data;
                    const gi = genOf[idx];
                    if (++genHave[gi] === plan.generations[gi].k) gensComplete++;
                }
            }
            sample.close();
            frameCount++;

            // Early exit — every generation has ≥ k shards, so RS can finish.
            if (gensComplete === plan.generations.length) {
                Logger.log(`[PlatformCrypto] Early exit — all ${plan.generations.length} generation(s) recoverable at frame ${frameCount}/${numFrames}`);
                break;
            }

            if (frameCount % 30 === 0) {
                signal?.throwIfAborted();
                let have = 0;
                for (let gi = 0; gi < genHave.length; gi++) {
                    have += Math.min(genHave[gi], plan.generations[gi].k);
                }
                progress(0.20 + (have / plan.totalDataShards) * 0.55);
                await new Promise(r => setTimeout(r, 0));
            }
        }

        Logger.log(`[PlatformCrypto] Frame scan done — ${frameCount} frames read (${numFrames} total)`);
        progress(0.75);

        const ciphertext = assembleShardsRS(shardSlots, plan, payloadSize);
        Logger.log(`[PlatformCrypto] Ciphertext assembled — ${ciphertext.length} B`);
        progress(0.82);

        // ── Step 3: Verify HMAC + decrypt ────────────────────────────────
        const { aesKey, hmacKey } = await CryptoHelper.deriveKeys(password, salt);
        Logger.log('[PlatformCrypto] Keys derived');

        const computedHmac = await CryptoHelper._computeHmac(hmacKey, ciphertext);
        if (!CryptoHelper._constantTimeEqual(storedHmac, computedHmac)) {
            throw new Error('Integrity check failed. File tampered or wrong password.');
        }
        Logger.log('[PlatformCrypto] HMAC OK — decrypting…');
        progress(0.90);

        const plaintext = new Uint8Array(ciphertext);
        await CryptoHelper._xorRegion(plaintext, 0, plaintext.length, aesKey, iv, 0);

        const outputType = metadata.type || 'application/octet-stream';
        Logger.log(`[PlatformCrypto] DECRYPT done — ${plaintext.length} B (type=${outputType})`);
        progress(1);
        return { blob: new Blob([plaintext], { type: outputType }), metadata };
    }

    /**
     * Read metadata from a JJC4 file without decrypting the payload.
     * Returns null if not a JJC4 file.
     * @param {Blob} blob
     * @returns {Promise<Object|null>}
     */
    static async readMetadata(blob) {
        try {
            const { MediaBunny } = await import('../../core/MediaBunny.js');
            const blobSource = new MediaBunny.BlobSource(blob);
            const input = new MediaBunny.Input({
                source: blobSource,
                formats: MediaBunny.ALL_FORMATS,
            });

            const audioTracks = await input.getAudioTracks();
            if (!audioTracks.length) return null;

            const headerBytes = await PlatformCrypto._readAndDecodeAudio(audioTracks[0]);
            if (!headerBytes) return null;

            const metadataSize = new DataView(
                headerBytes.buffer, headerBytes.byteOffset
            ).getUint16(10, false);

            if (metadataSize > 0 && headerBytes.length >= 76 + metadataSize) {
                try {
                    return JSON.parse(
                        new TextDecoder().decode(headerBytes.slice(76, 76 + metadataSize))
                    );
                } catch { return {}; }
            }
            return {};
        } catch (e) {
            Logger.log(`[PlatformCrypto] readMetadata: ${e.message}`);
            return null;
        }
    }

    /**
     * Estimated video duration (seconds) for a given plaintext file size.
     */
    static estimatedDuration(fileSize) {
        const singleAudioSec = audioDurationSec(76 + 100); // 76 fixed + ~100 metadata
        const totalAudioSec  = singleAudioSec * AUDIO_REPEAT + AUDIO_GAP_SEC * (AUDIO_REPEAT - 1);
        const videoDataSec   = stripDurationSec(fileSize);
        return Math.max(totalAudioSec + 2, videoDataSec) + 1;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    static async _readAndDecodeAudio(audioTrack) {
        const MB = await _getMediaBunny();
        const audioSink = new MB.AudioSampleSink(audioTrack);
        const chunks = [];
        let totalSamples = 0;
        const maxSamples = AUDIO_SAMPLE_RATE * 60; // one full header repetition fits within 60 s

        for await (const sample of audioSink.samples()) {
            // Copy channel 0 as raw f32 — avoids AudioBuffer, which does not
            // exist inside workers.
            const bytesNeeded = sample.allocationSize({ format: 'f32-planar', planeIndex: 0 });
            const ch = new Float32Array(bytesNeeded / 4);
            sample.copyTo(ch, { format: 'f32-planar', planeIndex: 0 });
            chunks.push(ch);
            totalSamples += ch.length;
            sample.close();
            if (totalSamples >= maxSamples) break;
        }

        const allSamples = new Float32Array(totalSamples);
        let pos = 0;
        for (const c of chunks) { allSamples.set(c, pos); pos += c.length; }
        Logger.log(`[PlatformCrypto] Audio read — ${chunks.length} chunks, ${totalSamples} samples (${(totalSamples / AUDIO_SAMPLE_RATE).toFixed(2)} s)`);

        const headerBytes = decodeAudio(allSamples);
        if (!headerBytes) return null;

        const magic = new TextDecoder().decode(headerBytes.slice(0, 4));
        if (magic !== MAGIC) return null;

        return headerBytes;
    }

    static async _generateCarrierMp4({
        ciphertext, plan, audioHeaderBytes, totalAudioSec, totalFrames,
        singleAudioSec, hint, signal, t0, fileHandle, onProgress,
    }) {
        const ms  = (a, b) => `${(b - a).toFixed(1)}ms`;
        const rel = () => `t=${ms(t0, performance.now())}`;
        let t;

        t = performance.now();
        const { MediaBunny, ensureEncoders } = await import('../../core/MediaBunny.js');
        await ensureEncoders();
        Logger.log(`[PlatformCrypto] [${rel()}] MediaBunny import: ${ms(t, performance.now())}`);

        // Target: in-RAM BufferTarget (returns a Blob), or — for payloads too
        // big to hold as one ArrayBuffer — a StreamTarget that writes the
        // carrier straight to the caller's disk file as it's produced.
        let fileWritable = null;
        let bytesWritten = 0;   // running total streamed to disk (progress log)
        let target;
        if (fileHandle) {
            fileWritable = await fileHandle.createWritable();
            const sink = new WritableStream({
                // mediabunny emits { data: Uint8Array, position: number }
                async write(chunk) {
                    await fileWritable.write({ type: 'write', position: chunk.position, data: chunk.data });
                    bytesWritten = Math.max(bytesWritten, chunk.position + chunk.data.byteLength);
                },
            });
            target = new MediaBunny.StreamTarget(sink);
            Logger.log(`[PlatformCrypto] [${rel()}] streaming carrier to disk file`);
        } else {
            target = new MediaBunny.BufferTarget();
        }

        const output = new MediaBunny.Output({
            format: new MediaBunny.Mp4OutputFormat(),
            target,
        });

        // ── Video source — VideoSampleSource feeds raw RGBA frames directly, ──
        // bypassing the canvas GPU capture overhead of CanvasSource.
        // Hardware encoders are typically several times faster for 720p30, and
        // at QUALITY_HIGH bitrate the 16px B/W blocks stay fully readable — but
        // prefer-hardware is a hard requirement in mediabunny, so probe first
        // and fall back to the browser's own choice when unavailable.
        const hwEncode = await MediaBunny.canEncodeVideo('avc', {
            width: VIDEO_W, height: VIDEO_H, hardwareAcceleration: 'prefer-hardware',
        }).catch(() => false);
        Logger.log(`[PlatformCrypto] AVC hardware encoder available: ${hwEncode}`);

        const videoSampleSource = new MediaBunny.VideoSampleSource({
            codec:   'avc',
            quality: MediaBunny.QUALITY_HIGH,
            ...(hwEncode ? { hardwareAcceleration: 'prefer-hardware' } : {}),
        });

        // ── Audio source ───────────────────────────────────────────────────
        const supportedAudioCodecs = await MediaBunny.getEncodableAudioCodecs(['aac', 'flac', 'opus']);
        if (!supportedAudioCodecs.length) throw new Error('JJC4: no encodable audio codec');
        const audioCodec = supportedAudioCodecs[0];

        const audioSource = new MediaBunny.AudioSampleSource({
            codec: audioCodec,
            quality: new MediaBunny.Quality({ bitrate: 128_000 }),
        });

        output.addVideoTrack(videoSampleSource);
        output.addAudioTrack(audioSource);

        t = performance.now();
        await output.start();
        Logger.log(`[PlatformCrypto] [${rel()}] output.start(): ${ms(t, performance.now())}`);

        // ── Feed audio (concurrently with the video loop below — the Output
        // interleaves both tracks and applies backpressure per source) ──────
        const audioPromise = (async () => {
            let ta = performance.now();
            const headerFloat32 = encodeAudio(audioHeaderBytes);
            Logger.log(`[PlatformCrypto] [${rel()}] encodeAudio (${audioHeaderBytes.length}B → ${headerFloat32.length} samples): ${ms(ta, performance.now())}`);

            const gapSamples    = Math.round(AUDIO_SAMPLE_RATE * AUDIO_GAP_SEC);
            const silenceFloat  = new Float32Array(gapSamples);
            const totalAudioArray = PlatformCrypto._buildAudioArray(
                headerFloat32, silenceFloat, AUDIO_REPEAT, totalAudioSec
            );

            ta = performance.now();
            await PlatformCrypto._feedAudio(audioSource, totalAudioArray);
            Logger.log(`[PlatformCrypto] [${rel()}] _feedAudio (${(totalAudioArray.length/AUDIO_SAMPLE_RATE).toFixed(1)}s audio): ${ms(ta, performance.now())}`);
        })();

        // ── Feed video frames ──────────────────────────────────────────────
        const frameDuration = 1 / FPS;
        let frameIdx = 0;

        // RS shards: data shards are zero-copy views of the ciphertext; only
        // the 25% parity is newly allocated. One shard per frame, no repeats.
        let t2 = performance.now();
        const shards = buildShards(ciphertext, plan);
        const shardOrder = interleavedShardOrder(plan);
        Logger.log(`[PlatformCrypto] [${rel()}] RS encode (${plan.totalShards} shards, ${plan.generations.length} generations): ${ms(t2, performance.now())}`);

        // Pre-render placeholder once: canvas → RGBA → I420.
        // I420 is H.264's native format — feeding it directly skips the per-frame
        // RGBA→I420 conversion the encoder would otherwise do, and cuts buffer size
        // from 3.7 MB (RGBA) to 1.4 MB (I420).
        t = performance.now();
        const tmpCanvas = PlatformCrypto._createCanvas(VIDEO_W, VIDEO_H);
        const tmpCtx = tmpCanvas.getContext('2d');
        PlatformCrypto._drawPlaceholder(tmpCtx, hint);
        const placeholderRgba = tmpCtx.getImageData(0, 0, VIDEO_W, VIDEO_H).data;
        const placeholderI420 = PlatformCrypto._rgbaToI420(placeholderRgba, VIDEO_W, VIDEO_H);
        const i420Frame       = new Uint8Array(I420_SIZE);
        Logger.log(`[PlatformCrypto] [${rel()}] placeholder pre-render + RGBA→I420: ${ms(t, performance.now())}`);
        Logger.log(`[PlatformCrypto] [${rel()}] STEP 6/6 — encoding carrier video (${totalFrames} frames, ${plan.totalShards} shards)${fileHandle ? ' → streaming to disk' : ''}`);

        const I420_LAYOUT = [
            { offset: 0,                    stride: VIDEO_W       },
            { offset: I420_Y_SIZE,          stride: VIDEO_W >> 1  },
            { offset: I420_Y_SIZE + I420_UV_SIZE, stride: VIDEO_W >> 1 },
        ];

        // Per-frame timing accumulators — reported every REPORT_EVERY frames
        const REPORT_EVERY = 300;
        let tMemcpy = 0, tPixelWrite = 0, tSampleCreate = 0, tVideoSourceAdd = 0;
        const loopStart = performance.now();
        let windowStart = loopStart;
        const fmtDur = (sec) => sec >= 3600
            ? `${(sec / 3600).toFixed(1)}h`
            : sec >= 60 ? `${(sec / 60).toFixed(1)}m` : `${sec.toFixed(0)}s`;

        // One frame per shard — no repetition (RS parity replaces the old 3×
        // copies). Shards are emitted in interleaved round-robin order across
        // generations, so a burst of heavily-quantized frames (platforms
        // encode bit-starved opening GOPs) spreads its damage across
        // generations rather than exhausting one generation's parity budget.
        // Any leftover timeline (the carrier length is usually set by the audio
        // header) is filled with cheap static placeholder frames as a tail.
        const nData = shardOrder.length;

        for (frameIdx = 0; frameIdx < totalFrames; frameIdx++) {
            let frameData = placeholderI420;
            if (frameIdx < nData) {
                let ts;

                ts = performance.now();
                i420Frame.set(placeholderI420);
                tMemcpy += performance.now() - ts;

                ts = performance.now();
                const globalIdx = shardOrder[frameIdx];
                encodeFrameToI420(i420Frame, globalIdx, shards[globalIdx]);
                tPixelWrite += performance.now() - ts;

                frameData = i420Frame;
            }

            let ts = performance.now();
            const sample = new MediaBunny.VideoSample(frameData, {
                format:      'I420',
                codedWidth:  VIDEO_W,
                codedHeight: VIDEO_H,
                timestamp:   frameIdx * frameDuration,
                duration:    frameDuration,
                layout:      I420_LAYOUT,
            });
            tSampleCreate += performance.now() - ts;

            ts = performance.now();
            await videoSampleSource.add(sample);
            tVideoSourceAdd += performance.now() - ts;
            sample.close();

            if ((frameIdx + 1) % REPORT_EVERY === 0) {
                const now = performance.now();
                const windowMs = now - windowStart;
                const done = frameIdx + 1;
                const pct = done / totalFrames;
                const elapsedSec = (now - loopStart) / 1000;
                const etaSec = elapsedSec / pct - elapsedSec; // linear extrapolation
                // ── Step progress: overall %, elapsed, ETA, throughput ──
                Logger.log(
                    `[PlatformCrypto] [${rel()}] video ${(pct * 100).toFixed(1)}% ` +
                    `— frame ${done}/${totalFrames} (shards ${Math.min(done, nData)}/${nData}) ` +
                    `| elapsed ${fmtDur(elapsedSec)} ETA ${fmtDur(etaSec)} ` +
                    `| ${(REPORT_EVERY / (windowMs / 1000)).toFixed(0)} fps` +
                    (bytesWritten ? ` | ${(bytesWritten / 1048576).toFixed(0)}MB on disk` : '') +
                    ` | pixelWrite=${tPixelWrite.toFixed(0)}ms sampleCreate=${tSampleCreate.toFixed(0)}ms videoSourceAdd=${tVideoSourceAdd.toFixed(0)}ms`
                );
                tMemcpy = 0; tPixelWrite = 0; tSampleCreate = 0; tVideoSourceAdd = 0;
                windowStart = now;

                signal?.throwIfAborted();
                onProgress && onProgress(pct);
                await new Promise(r => setTimeout(r, 0));
            }
        }

        await audioPromise; // ensure the concurrent audio feed finished

        t = performance.now();
        videoSampleSource.close();
        audioSource.close();
        await output.finalize();
        Logger.log(`[PlatformCrypto] [${rel()}] output.finalize(): ${ms(t, performance.now())}`);

        // Streamed path: the writable is closed by finalize()'s stream close;
        // there is no in-RAM buffer to wrap, so signal completion with null.
        if (fileWritable) {
            if (typeof output.dispose === 'function') output.dispose();
            return null;
        }

        const mp4Blob = new Blob([output.target.buffer], { type: 'video/mp4' });
        if (typeof output.dispose === 'function') output.dispose();

        return mp4Blob;
    }

    /** Create a 2D-capable canvas that also works inside workers. */
    static _createCanvas(width, height) {
        if (typeof OffscreenCanvas !== 'undefined') {
            return new OffscreenCanvas(width, height);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return canvas;
    }

    static _buildAudioArray(headerFloat32, silenceFloat, repeats, totalDurationSec) {
        const partsLength = headerFloat32.length * repeats +
                            silenceFloat.length * (repeats - 1);
        const totalSamples = Math.max(
            partsLength,
            Math.ceil(totalDurationSec * AUDIO_SAMPLE_RATE)
        );
        const result = new Float32Array(totalSamples); // zero-initialized

        let pos = 0;
        for (let i = 0; i < repeats; i++) {
            result.set(headerFloat32, pos);
            pos += headerFloat32.length;
            if (i < repeats - 1) {
                // silence gap (already zero, just advance)
                pos += silenceFloat.length;
            }
        }
        return result;
    }

    static async _feedAudio(audioSource, float32Array) {
        const MB = await _getMediaBunny();
        const CHUNK = AUDIO_SAMPLE_RATE; // 1-second slices
        let timestamp = 0;

        for (let offset = 0; offset < float32Array.length; offset += CHUNK) {
            const slice = float32Array.subarray(offset, Math.min(offset + CHUNK, float32Array.length));
            // Build the AudioSample from raw f32 data directly — no Web Audio
            // objects involved, so this also works inside workers.
            const sample = new MB.AudioSample({
                data: slice,
                format: 'f32-planar',
                numberOfChannels: 1,
                sampleRate: AUDIO_SAMPLE_RATE,
                timestamp,
            });
            await audioSource.add(sample);
            timestamp += sample.duration;
            sample.close();
        }
    }

    static _drawPlaceholder(ctx, hint) {
        // Black frame; data blocks are drawn on top by encodeFrame
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, VIDEO_W, VIDEO_H);

        // Card centered on the full frame
        const cx = VIDEO_W / 2;
        const cy = VIDEO_H / 2;
        const hasHint = hint && hint.trim().length > 0;
        const cardW = 340;
        const cardPad = 22;
        // Heights derived from layout: pad(22)+lock(34)+title(28)+brand(22)+url(16)+pad(22)=144
        // + hint section: gap(22)+divider+gap(10)+hint(15)=47 → 191 total
        const cardH = hasHint ? 192 : 148;
        const cardX = Math.round(cx - cardW / 2);
        const cardY = Math.round(cy - cardH / 2);

        // Neobrutalist solid shadow
        ctx.fillStyle = '#00ff88';
        ctx.fillRect(cardX + 6, cardY + 6, cardW, cardH);

        // Card
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(cardX, cardY, cardW, cardH);
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 4;
        ctx.strokeRect(cardX + 2, cardY + 2, cardW - 4, cardH - 4);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        let ty = cardY + cardPad;

        ctx.font = '24px serif';
        ctx.fillStyle = '#00ff88';
        ctx.fillText('\u{1F512}', cx, ty);
        ty += 34;

        ctx.font = 'bold 20px Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('VIDEO IS ENCRYPTED', cx, ty);
        ty += 28;

        ctx.font = '14px Arial, sans-serif';
        ctx.fillStyle = '#00ff88';
        ctx.fillText('By JellyJump', cx, ty);
        ty += 22;

        ctx.font = '13px "Courier New", monospace';
        ctx.fillStyle = '#666666';
        ctx.fillText(DOMAIN, cx, ty);

        if (hasHint) {
            ty += 22;
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cardX + cardPad, ty);
            ctx.lineTo(cardX + cardW - cardPad, ty);
            ctx.stroke();
            ty += 10;

            ctx.font = '12px "Courier New", monospace';
            ctx.fillStyle = '#b0b0b0';
            ctx.fillText(`Hint: ${hint}`, cx, ty);
        }
    }

    /**
     * Convert RGBA ImageData pixels to a packed I420 (YUV 4:2:0) Uint8Array.
     * Done once per encrypt call for the placeholder frame.
     * BT.601 full-range coefficients, integer arithmetic.
     */
    static _rgbaToI420(rgba, width, height) {
        const ySize  = width * height;
        const uvSize = (width >> 1) * (height >> 1);
        const i420   = new Uint8Array(ySize + uvSize * 2);
        i420.fill(128, ySize); // neutral chroma for U and V

        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                const pi = (row * width + col) * 4;
                const R = rgba[pi], G = rgba[pi + 1], B = rgba[pi + 2];
                i420[row * width + col] = (77 * R + 150 * G + 29 * B) >> 8;
                if (row & 1 || col & 1) continue; // U/V subsampled 2×2
                const uvOff = ySize + (row >> 1) * (width >> 1) + (col >> 1);
                i420[uvOff]           = ((-43 * R -  85 * G + 128 * B + 32768) >> 8);
                i420[uvOff + uvSize]  = ((128 * R - 107 * G -  21 * B + 32768) >> 8);
            }
        }
        return i420;
    }

}

// Module-level mediabunny cache so _feedAudio can use AudioSample.fromAudioBuffer
let _MB;
async function _getMediaBunny() {
    if (!_MB) _MB = (await import('../../core/MediaBunny.js')).MediaBunny;
    return _MB;
}
