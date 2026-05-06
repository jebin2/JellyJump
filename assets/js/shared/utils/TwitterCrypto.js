/**
 * TwitterCrypto — JJC3 format
 *
 * A transcode-survivable encrypted video format.  The encrypted payload is
 * embedded INSIDE a carrier MP4's actual pixel and audio content so that
 * Twitter's (or any platform's) re-encoding cannot strip it.
 *
 * Two independent channels carry data:
 *
 *   Audio track — carries the crypto parameters (salt, IV, HMAC, metadata).
 *     Uses 16-tone OOK at 800–6800 Hz, 200 ms symbols.
 *     Repeated 3× for robustness. Survives AAC 128 kbps transcoding.
 *
 *   Video strip — carries the encrypted payload as 16×16-pixel black/white
 *     blocks in the bottom 20% of a 1280×720 frame.  Each chunk is written
 *     twice (primary + backup) for single-frame-loss recovery.
 *     Survives H.264/H.265 transcoding at typical platform bitrates.
 *
 * Carrier MP4 structure:
 *   Video: 1280×720, 30 fps
 *     Top 80%  — animated placeholder ("This video is encrypted")
 *     Bottom 20% — visual data strip
 *   Audio: 48 kHz mono, AAC
 *     Header tones (3 repetitions) + silence to match video duration
 *
 * File size guideline:
 *   ~1 200 bytes/sec of usable visual-strip capacity at 30 fps after ×2 repeat.
 *   Twitter tweet timeline limit ≈ 140 s → ≈ 168 KB max payload.
 *   Twitter DMs allow up to 10 min → ≈ 720 KB max.
 *
 * Crypto: identical to JJC2 (AES-256-CTR + HMAC-SHA256 + PBKDF2 100k iter).
 * Detection: "JJC3" magic in the audio header.
 */

import { Logger } from './Logger.js';
import { CryptoHelper } from './CryptoHelper.js';
import {
    encodeAudio, decodeAudio, audioDurationSec, AUDIO_SAMPLE_RATE,
} from './AudioDataCodec.js';
import {
    encodeFrame, decodeFrame, assembleChunks,
    DATA_BYTES_PER_FRAME, FPS, FRAME_COPIES, VIDEO_W, VIDEO_H,
    stripDurationSec, framesNeeded,
} from './VisualStripCodec.js';

const MAGIC = 'JJC3';
const AUDIO_REPEAT = 3;   // transmit the audio header this many times
const AUDIO_GAP_SEC = 1;  // silence between audio repetitions

export class TwitterCrypto {
    static MAGIC = MAGIC;

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Encrypt a file into a JJC3 carrier MP4.
     * @param {Blob} blob
     * @param {string} password
     * @param {Object} [options]
     * @param {string}   [options.filename]
     * @param {string}   [options.mimeType]
     * @param {string}   [options.hint]
     * @param {Function} [options.onProgress]  (0..1)
     * @returns {Promise<Blob>}
     */
    static async encrypt(blob, password, options = {}) {
        const { filename, mimeType, hint, onProgress } = options;
        const progress = (v) => onProgress && onProgress(v);

        Logger.log(`[TwitterCrypto] ENCRYPT start — ${blob.size} bytes`);
        progress(0);

        // ── Step 1: Derive keys + encrypt payload ─────────────────────────
        const salt = crypto.getRandomValues(new Uint8Array(CryptoHelper.SALT_SIZE));
        const iv   = crypto.getRandomValues(new Uint8Array(CryptoHelper.IV_SIZE));
        const { aesKey, hmacKey } = await CryptoHelper.deriveKeys(password, salt);
        Logger.log('[TwitterCrypto] Keys derived');

        const fileData = new Uint8Array(await blob.arrayBuffer());
        const ciphertext = new Uint8Array(fileData);
        await CryptoHelper._xorRegion(ciphertext, 0, ciphertext.length, aesKey, iv, 0);
        progress(0.25);

        const hmac = await CryptoHelper._computeHmac(hmacKey, ciphertext);
        Logger.log('[TwitterCrypto] HMAC computed');
        progress(0.35);

        // ── Step 2: Build audio header bytes ──────────────────────────────
        // Layout: magic(4) + version(2) + payloadSize(4) + metadataSize(2)
        //       + salt(16) + iv(16) + hmac(32) + metadata JSON
        const metadata = {};
        if (filename) metadata.name = filename;
        if (mimeType)  metadata.type = mimeType;
        if (hint)      metadata.hint = hint;
        const metaBytes   = new TextEncoder().encode(JSON.stringify(metadata));
        const payloadSize = ciphertext.length;

        const headerFixed = new Uint8Array(4 + 2 + 4 + 2 + 16 + 16 + 32); // 76 bytes
        const hdv = new DataView(headerFixed.buffer);
        headerFixed.set(new TextEncoder().encode(MAGIC), 0);         // magic
        hdv.setUint16(4, 3, false);                                  // version = 3
        hdv.setUint32(6, payloadSize, false);                        // payloadSize
        hdv.setUint16(10, metaBytes.length, false);                  // metadataSize
        headerFixed.set(salt, 12);                                   // salt
        headerFixed.set(iv,   28);                                   // iv
        headerFixed.set(hmac, 44);                                   // hmac

        const audioHeaderBytes = new Uint8Array(headerFixed.length + metaBytes.length);
        audioHeaderBytes.set(headerFixed, 0);
        audioHeaderBytes.set(metaBytes, headerFixed.length);
        Logger.log(`[TwitterCrypto] Audio header — ${audioHeaderBytes.length} B (fixed=76 meta=${metaBytes.length})`);

        // ── Step 3: Compute durations ──────────────────────────────────────
        const singleAudioSec = audioDurationSec(audioHeaderBytes.length);
        const totalAudioSec  = singleAudioSec * AUDIO_REPEAT +
                               AUDIO_GAP_SEC  * (AUDIO_REPEAT - 1);

        const totalStrip   = ciphertext.length;
        const videoDataSec = stripDurationSec(totalStrip);
        const videoSec     = Math.max(totalAudioSec + 2, videoDataSec) + 1; // 1 s tail
        const totalFrames  = Math.ceil(videoSec * FPS);

        Logger.log(`[TwitterCrypto] payload=${payloadSize} B, audioSec=${totalAudioSec.toFixed(1)}, videoSec=${videoSec.toFixed(1)}, totalFrames=${totalFrames}`);
        progress(0.40);

        // ── Step 4: Generate carrier MP4 ─────────────────────────────────
        const mp4Blob = await TwitterCrypto._generateCarrierMp4({
            ciphertext,
            audioHeaderBytes,
            totalAudioSec,
            totalFrames,
            singleAudioSec,
            hint,
            onProgress: (v) => progress(0.40 + v * 0.55),
        });

        progress(1);
        Logger.log(`[TwitterCrypto] ENCRYPT done — ${mp4Blob.size} bytes`);
        return mp4Blob;
    }

    /**
     * Decrypt a JJC3 carrier MP4.
     * @param {Blob} blob
     * @param {string} password
     * @param {Function} [onProgress]
     * @returns {Promise<{blob: Blob, metadata: Object}>}
     */
    static async decrypt(blob, password, onProgress) {
        const progress = (v) => onProgress && onProgress(v);
        Logger.log(`[TwitterCrypto] DECRYPT start — ${blob.size} bytes`);
        progress(0);

        const { MediaBunny } = await import('../../core/MediaBunny.js');

        const blobSource = new MediaBunny.BlobSource(blob);
        const input = new MediaBunny.Input({
            source: blobSource,
            formats: MediaBunny.ALL_FORMATS,
        });

        // ── Step 1: Decode audio header ───────────────────────────────────
        const audioTracks = await input.getAudioTracks();
        if (!audioTracks.length) throw new Error('JJC3: no audio track found');

        const audioSink = new MediaBunny.AudioSampleSink(audioTracks[0]);
        const audioChunks = [];
        let totalAudioSamples = 0;
        const maxAudioSamples = AUDIO_SAMPLE_RATE * 20; // first repetition fits within 20 s

        for await (const sample of audioSink.samples()) {
            const buf = sample.toAudioBuffer();
            const ch = new Float32Array(buf.getChannelData(0));
            audioChunks.push(ch);
            totalAudioSamples += ch.length;
            sample.close();
            if (totalAudioSamples >= maxAudioSamples) break;
        }

        const allAudioSamples = new Float32Array(totalAudioSamples);
        let audioPos = 0;
        for (const chunk of audioChunks) {
            allAudioSamples.set(chunk, audioPos);
            audioPos += chunk.length;
        }

        Logger.log(`[TwitterCrypto] Audio read — ${audioChunks.length} chunks, ${totalAudioSamples} samples (${(totalAudioSamples / AUDIO_SAMPLE_RATE).toFixed(2)} s)`);
        progress(0.15);

        const headerBytes = decodeAudio(allAudioSamples);
        if (!headerBytes) throw new Error('JJC3: could not decode audio header');
        Logger.log(`[TwitterCrypto] Audio header decoded — ${headerBytes.length} B`);

        const magic = new TextDecoder().decode(headerBytes.slice(0, 4));
        if (magic !== MAGIC) throw new Error('JJC3: wrong magic in audio header');

        const hdv          = new DataView(headerBytes.buffer, headerBytes.byteOffset);
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

        Logger.log(`[TwitterCrypto] Header parsed — payloadSize=${payloadSize} B, salt=${salt.length}B iv=${iv.length}B hmac=${storedHmac.length}B meta=${JSON.stringify(metadata)}`);
        progress(0.20);

        // ── Step 2: Decode visual strip ───────────────────────────────────
        const videoTracks = await input.getVideoTracks();
        if (!videoTracks.length) throw new Error('JJC3: no video track found');

        const videoTrack = videoTracks[0];
        const duration   = await videoTrack.computeDuration();
        const numFrames  = Math.round(duration * FPS);

        const canvas = document.createElement('canvas');
        canvas.width  = VIDEO_W;
        canvas.height = VIDEO_H;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const timestamps = (async function*() {
            for (let i = 0; i < numFrames; i++) yield i / FPS;
        })();

        const decodedFrames = [];
        let frameCount = 0;

        const videoSink = new MediaBunny.VideoSampleSink(videoTrack);
        for await (const sample of videoSink.samplesAtTimestamps(timestamps)) {
            if (!sample) { frameCount++; continue; }
            sample.draw(ctx, 0, 0, VIDEO_W, VIDEO_H);
            const imageData = ctx.getImageData(0, 0, VIDEO_W, VIDEO_H);
            const decoded = decodeFrame(imageData);
            if (decoded) decodedFrames.push(decoded);
            sample.close();
            frameCount++;
            if (frameCount % 30 === 0) {
                progress(0.20 + (frameCount / numFrames) * 0.55);
                await new Promise(r => setTimeout(r, 0));
            }
        }

        Logger.log(`[TwitterCrypto] Decoded ${decodedFrames.length} valid frames from ${numFrames} total`);
        progress(0.75);

        const ciphertext = assembleChunks(decodedFrames, payloadSize);
        Logger.log(`[TwitterCrypto] Ciphertext assembled — ${ciphertext.length} B`);
        progress(0.82);

        // ── Step 3: Verify HMAC + decrypt ────────────────────────────────
        const { aesKey, hmacKey } = await CryptoHelper.deriveKeys(password, salt);
        Logger.log('[TwitterCrypto] Keys derived');

        const computedHmac = await CryptoHelper._computeHmac(hmacKey, ciphertext);
        if (!CryptoHelper._constantTimeEqual(storedHmac, computedHmac)) {
            throw new Error('Integrity check failed. File tampered or wrong password.');
        }
        Logger.log('[TwitterCrypto] HMAC OK — decrypting…');
        progress(0.90);

        const plaintext = new Uint8Array(ciphertext);
        await CryptoHelper._xorRegion(plaintext, 0, plaintext.length, aesKey, iv, 0);

        const outputType = metadata.type || 'application/octet-stream';
        Logger.log(`[TwitterCrypto] DECRYPT done — ${plaintext.length} B (type=${outputType})`);
        progress(1);
        return { blob: new Blob([plaintext], { type: outputType }), metadata };
    }

    /**
     * Read metadata from a JJC3 file without decrypting the payload.
     * Returns null if not a JJC3 file.
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

            // Only read enough audio to find the first header (first AUDIO_REPEAT occurrence)
            const audioSink = new MediaBunny.AudioSampleSink(audioTracks[0]);
            const chunks = [];
            let totalSamples = 0;
            const maxSamples = AUDIO_SAMPLE_RATE * 20; // read up to 20 s

            for await (const sample of audioSink.samples()) {
                const buf = sample.toAudioBuffer();
                const ch  = new Float32Array(buf.getChannelData(0));
                chunks.push(ch);
                totalSamples += ch.length;
                sample.close();
                if (totalSamples >= maxSamples) break;
            }

            const allSamples = new Float32Array(totalSamples);
            let pos = 0;
            for (const c of chunks) { allSamples.set(c, pos); pos += c.length; }

            const headerBytes = decodeAudio(allSamples);
            if (!headerBytes) return null;

            const magic = new TextDecoder().decode(headerBytes.slice(0, 4));
            if (magic !== MAGIC) return null;

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
            Logger.log(`[TwitterCrypto] readMetadata: ${e.message}`);
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

    static async _generateCarrierMp4({
        ciphertext, audioHeaderBytes, totalAudioSec, totalFrames,
        singleAudioSec, hint, onProgress,
    }) {
        const { MediaBunny } = await import('../../core/MediaBunny.js');

        const output = new MediaBunny.Output({
            format: new MediaBunny.Mp4OutputFormat(),
            target: new MediaBunny.BufferTarget(),
        });

        // ── Video source ───────────────────────────────────────────────────
        const canvas = document.createElement('canvas');
        canvas.width  = VIDEO_W;
        canvas.height = VIDEO_H;
        const ctx = canvas.getContext('2d');

        const canvasSource = new MediaBunny.CanvasSource(canvas, {
            codec:   'avc',
            bitrate: MediaBunny.QUALITY_HIGH,
        });

        // ── Audio source ───────────────────────────────────────────────────
        const supportedAudioCodecs = await MediaBunny.getEncodableAudioCodecs(['aac', 'flac', 'opus']);
        if (!supportedAudioCodecs.length) throw new Error('JJC3: no encodable audio codec');
        const audioCodec = supportedAudioCodecs[0];
        Logger.log(`[TwitterCrypto] Audio codec: ${audioCodec}`);

        const audioSource = new MediaBunny.AudioSampleSource({ codec: audioCodec, bitrate: 128_000 });

        output.addVideoTrack(canvasSource);
        output.addAudioTrack(audioSource);
        await output.start();

        // ── Feed audio ─────────────────────────────────────────────────────
        const headerFloat32 = encodeAudio(audioHeaderBytes);
        const gapSamples    = Math.round(AUDIO_SAMPLE_RATE * AUDIO_GAP_SEC);
        const silenceFloat  = new Float32Array(gapSamples); // zeros = silence

        // Repeat the header AUDIO_REPEAT times with gaps
        const totalAudioArray = TwitterCrypto._buildAudioArray(
            headerFloat32, silenceFloat, AUDIO_REPEAT, totalAudioSec
        );

        Logger.log(`[TwitterCrypto] Audio signal — ${(totalAudioArray.length / AUDIO_SAMPLE_RATE).toFixed(2)} s, feeding…`);
        await TwitterCrypto._feedAudio(audioSource, totalAudioArray);
        Logger.log('[TwitterCrypto] Audio fed, encoding video frames…');

        // ── Feed video frames ──────────────────────────────────────────────
        const totalChunks = Math.ceil(ciphertext.length / DATA_BYTES_PER_FRAME);
        const frameDuration = 1 / FPS;
        let frameIdx = 0;

        // Interleaved layout: encode all chunks for repeat 0, then all for repeat 1, etc.
        // Each copy of a chunk lands in a completely different section of the video,
        // giving it an independent H.264 I-frame. If one I-frame is heavily quantized
        // (Twitter encodes at ~133 kbps), only that copy is affected — the others survive.
        for (let repeatIdx = 0; repeatIdx < FRAME_COPIES; repeatIdx++) {
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                const start = chunkIndex * DATA_BYTES_PER_FRAME;
                const end   = Math.min(start + DATA_BYTES_PER_FRAME, ciphertext.length);
                const chunk = new Uint8Array(DATA_BYTES_PER_FRAME);
                chunk.set(ciphertext.slice(start, end));

                TwitterCrypto._drawPlaceholder(ctx, hint);
                encodeFrame(ctx, chunkIndex, totalChunks, repeatIdx, chunk);
                await canvasSource.add(frameIdx * frameDuration, frameDuration);
                frameIdx++;

                if (frameIdx % 30 === 0) {
                    onProgress && onProgress(frameIdx / totalFrames);
                    await new Promise(r => setTimeout(r, 0));
                }
            }
        }

        // Tail frames: placeholder only, no data
        while (frameIdx < totalFrames) {
            TwitterCrypto._drawPlaceholder(ctx, hint);
            await canvasSource.add(frameIdx * frameDuration, frameDuration);
            frameIdx++;

            if (frameIdx % 30 === 0) {
                onProgress && onProgress(frameIdx / totalFrames);
                await new Promise(r => setTimeout(r, 0));
            }
        }

        Logger.log(`[TwitterCrypto] Video encoded — ${frameIdx} frames (${FRAME_COPIES} passes × ${totalChunks} chunks + ${frameIdx - totalChunks * FRAME_COPIES} tail)`);
        canvasSource.close();
        audioSource.close();
        await output.finalize();

        const mp4Blob = new Blob([output.target.buffer], { type: 'video/mp4' });

        if (typeof output.dispose === 'function') output.dispose();

        return mp4Blob;
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
            const slice = float32Array.slice(offset, Math.min(offset + CHUNK, float32Array.length));
            // AudioBuffer constructor requires no AudioContext — avoids autoplay-policy warnings
            const buffer = new AudioBuffer({ numberOfChannels: 1, length: slice.length, sampleRate: AUDIO_SAMPLE_RATE });
            buffer.getChannelData(0).set(slice);

            const samples = MB.AudioSample.fromAudioBuffer(buffer, timestamp);
            const arr = Array.isArray(samples) ? samples : [samples];
            for (const s of arr) {
                await audioSource.add(s);
                timestamp += s.duration;
                s.close();
            }
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
        ctx.fillText('voidall.com/JellyJump', cx, ty);

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

}

// Module-level mediabunny cache so _feedAudio can use AudioSample.fromAudioBuffer
let _MB;
async function _getMediaBunny() {
    if (!_MB) _MB = (await import('../../core/MediaBunny.js')).MediaBunny;
    return _MB;
}
