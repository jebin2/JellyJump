// Orchestrates AI subtitle generation for the player:
//   1. Extract 16kHz mono PCM from the decoded audio track (mediabunny).
//   2. Hand the PCM to a Web Worker running Whisper (transformers.js).
//   3. Turn the returned segments into WebVTT and load them as a subtitle track.
//
// All of the heavy lifting (model download + inference) happens in the worker,
// so the render loop, EQ and UI stay smooth throughout.

import { MediaBunny } from '../../core/MediaBunny.js';
import { Logger } from '../../shared/utils/Logger.js';
import { wordChunksToVTT } from '../../core/subtitles/SubtitleConverter.js';

const TARGET_RATE = 16000;      // Whisper input rate
const RESAMPLE_SEGMENT_S = 30;  // resample in ~30s batches to bound OfflineAudioContext churn

// The extraction pass is roughly the first slice of the whole job; the rest is
// model download + inference. Keep the two phases visually distinct.
const PHASE = {
    EXTRACT: 'extract',
    MODEL: 'model',
    TRANSCRIBE: 'transcribe',
};

/**
 * Downmix an AudioBuffer to a single mono Float32Array (channel average) in a
 * single pass over the output (cache-friendly for the common stereo case).
 */
function downmixToMono(audioBuffer) {
    const channels = audioBuffer.numberOfChannels;
    const frames = audioBuffer.length;
    const mono = new Float32Array(frames);

    if (channels === 1) {
        // Copy out: mediabunny may recycle the source buffer once we advance.
        mono.set(audioBuffer.getChannelData(0));
        return mono;
    }

    const data = [];
    for (let c = 0; c < channels; c++) data.push(audioBuffer.getChannelData(c));
    const inv = 1 / channels;
    for (let i = 0; i < frames; i++) {
        let sum = 0;
        for (let c = 0; c < channels; c++) sum += data[c][i];
        mono[i] = sum * inv;
    }
    return mono;
}

/**
 * A Float32Array that grows by doubling. Sized up front from the known media
 * duration so the common case is a single allocation with no final concat — the
 * PCM is written straight into its final home as it is produced.
 */
function createPcmSink(estimatedFrames) {
    let buf = new Float32Array(Math.max(TARGET_RATE, estimatedFrames | 0));
    let len = 0;
    return {
        push(chunk) {
            if (len + chunk.length > buf.length) {
                let cap = buf.length * 2;
                while (cap < len + chunk.length) cap *= 2;
                const bigger = new Float32Array(cap);
                bigger.set(buf.subarray(0, len));
                buf = bigger;
            }
            buf.set(chunk, len);
            len += chunk.length;
        },
        get length() { return len; },
        // A view over exactly the written region — no copy. Its .buffer is
        // transferable to the worker.
        view() { return buf.subarray(0, len); },
    };
}

/**
 * Extract the whole audio track as one 16kHz mono Float32Array.
 *
 * @param {object} player
 * @param {(fraction:number)=>void} onProgress  0..1 extraction progress
 * @returns {Promise<Float32Array>}
 */
async function extractPcm(player, onProgress) {
    const tracks = player.input ? await player.input.getAudioTracks() : [];
    const track = player.audioTrack || tracks[0];
    if (!track) throw new Error('This media has no audio track to transcribe.');

    // A dedicated sink so we never disturb the playback iterator.
    const sink = new MediaBunny.AudioBufferSink(track);
    const duration = player.duration || 0;
    Logger.log(`[Subtitles] Decoding audio track (${duration ? duration.toFixed(1) + 's' : 'unknown length'})…`);
    let loggedFormat = false;

    // Pre-size from duration (+ small margin) so we usually never reallocate,
    // and never build one giant array via a final concat.
    const out = createPcmSink(Math.ceil(((duration || 60) + 0.5) * TARGET_RATE));

    let nativeRate = 0;
    let segParts = [];       // native-rate mono pieces awaiting resample
    let segFrames = 0;       // frames accumulated in segParts

    const flushSegment = async () => {
        if (segFrames === 0) return;

        if (nativeRate === TARGET_RATE) {
            // Already at target rate — copy straight through, no resample.
            for (const p of segParts) out.push(p);
        } else {
            // OfflineAudioContext applies a proper anti-aliasing filter (linear
            // decimation would alias and hurt recognition accuracy). We fill the
            // source buffer directly from the pending parts — no interim concat.
            const targetFrames = Math.max(1, Math.round(segFrames * (TARGET_RATE / nativeRate)));
            const offline = new OfflineAudioContext(1, targetFrames, TARGET_RATE);
            const src = offline.createBuffer(1, segFrames, nativeRate);
            const ch = src.getChannelData(0);
            let off = 0;
            for (const p of segParts) { ch.set(p, off); off += p.length; }

            const node = offline.createBufferSource();
            node.buffer = src;
            node.connect(offline.destination);
            node.start(0);

            const rendered = await offline.startRendering();
            out.push(rendered.getChannelData(0));  // push() copies before GC
        }
        segParts = [];
        segFrames = 0;
    };

    let lastPct = -1;
    for await (const { buffer, timestamp } of sink.buffers(0)) {
        if (!buffer) continue;
        nativeRate = buffer.sampleRate;

        if (!loggedFormat) {
            loggedFormat = true;
            Logger.log(`[Subtitles] Source audio: ${nativeRate}Hz, ${buffer.numberOfChannels}ch → resampling to ${TARGET_RATE}Hz mono`);
        }

        segParts.push(downmixToMono(buffer));
        segFrames += buffer.length;

        if (segFrames >= RESAMPLE_SEGMENT_S * nativeRate) {
            await flushSegment();
        }

        // Throttle progress to whole-percent changes: the raw loop fires per
        // decoded buffer (thousands of times), and each report writes the DOM.
        if (duration > 0 && onProgress) {
            const pct = Math.floor(Math.min(0.999, (timestamp || 0) / duration) * 100);
            if (pct !== lastPct) { lastPct = pct; onProgress(pct / 100); }
        }
    }
    await flushSegment();

    if (out.length === 0) throw new Error('Could not decode any audio from this media.');
    if (onProgress) onProgress(1);

    return out.view();
}

/**
 * Generate subtitles for the currently loaded media.
 *
 * @param {object} player
 * @param {object} [opts]
 * @param {string} [opts.language]  ISO code, or undefined to auto-detect
 * @param {'transcribe'|'translate'} [opts.task]
 * @param {(state:{phase:string, progress:number, label:string, device?:string})=>void} [opts.onProgress]
 * @returns {Promise<string>} the generated VTT text
 */
export async function generateSubtitles(player, opts = {}) {
    const { language, task = 'transcribe', onProgress } = opts;
    const report = (phase, progress, label, extra = {}) => {
        onProgress?.({ phase, progress: Math.max(0, Math.min(1, progress)), label, ...extra });
    };
    // Step-by-step logger. Logger is a no-op off localhost, so these are free
    // in production and give a full play-by-play in development.
    const t0 = performance.now();
    const step = (msg) => Logger.log(`[Subtitles] ${msg}`);
    step(`▶ Starting subtitle generation (task=${task}, language=${language || 'auto-detect'})`);

    // Phase 1 — audio extraction (main thread, cheap relative to inference).
    step('1/4 Extracting audio…');
    report(PHASE.EXTRACT, 0, 'Extracting audio…');
    const pcm = await extractPcm(player, (f) => report(PHASE.EXTRACT, f, 'Extracting audio…'));
    step(`1/4 ✓ Audio ready: ${(pcm.length / 16000).toFixed(1)}s, ${pcm.length.toLocaleString()} samples @16kHz`);

    // Phases 2 & 3 — model + inference, in the worker.
    step('2/4 Spawning Whisper worker…');
    const worker = new Worker(new URL('./WhisperWorker.js', import.meta.url), { type: 'module' });

    // De-dupe the (noisy) model-download callbacks into one line per file.
    const filesStarted = new Set();
    const filesDone = new Set();

    try {
        const chunks = await new Promise((resolve, reject) => {
            worker.onerror = (e) => reject(new Error(e.message || 'Whisper worker crashed'));
            worker.onmessage = (e) => {
                const m = e.data || {};
                switch (m.type) {
                    case 'model-progress': {
                        if (m.stage === 'webgpu-fallback') {
                            step(`2/4 ⚠ WebGPU unavailable, falling back to CPU (${m.message})`);
                        } else if (m.file && (m.stage === 'initiate' || m.stage === 'download') && !filesStarted.has(m.file)) {
                            filesStarted.add(m.file);
                            step(`2/4 ↓ Downloading model file: ${m.file}`);
                        } else if (m.file && m.stage === 'done' && !filesDone.has(m.file)) {
                            filesDone.add(m.file);
                            step(`2/4 ✓ Downloaded ${m.file}${m.total ? ` (${formatBytes(m.total)})` : ''}`);
                        }
                        if (typeof m.progress === 'number') {
                            report(PHASE.MODEL, m.progress / 100, 'Downloading speech model…');
                        }
                        break;
                    }
                    case 'device':
                        step(`2/4 ✓ Model ready — running on ${m.device.toUpperCase()}`);
                        report(PHASE.MODEL, 1, 'Model ready…', { device: m.device });
                        break;
                    case 'inference-start':
                        step(`3/4 Transcribing ${m.durationS.toFixed(1)}s of audio (${m.chunksTotal} window${m.chunksTotal > 1 ? 's' : ''})…`);
                        break;
                    case 'segment':
                        // Live transcription, printed as each segment is decoded.
                        step(`🎙 ${formatClock(m.start)}–${formatClock(m.end)}  ${m.text}`);
                        break;
                    case 'progress':
                        report(PHASE.TRANSCRIBE, m.progress, 'Transcribing…');
                        break;
                    case 'result':
                        step(`3/4 ✓ Transcription complete: ${(m.chunks || []).length} segment(s)`);
                        resolve(m.chunks || []);
                        break;
                    case 'error':
                        reject(new Error(m.message || 'Transcription failed'));
                        break;
                }
            };

            // Transfer the PCM buffer so it isn't copied.
            worker.postMessage(
                { type: 'transcribe', audio: pcm, language, task },
                [pcm.buffer],
            );
        });

        // chunks are word-level (return_timestamps: 'word'); batch ~4 words/cue.
        const vtt = wordChunksToVTT(chunks, { wordsPerCue: 4 });
        const cueCount = (vtt.match(/-->/g) || []).length;
        step(`4/4 Built VTT (${cueCount} cue${cueCount === 1 ? '' : 's'}). Loading track…`);
        report(PHASE.TRANSCRIBE, 1, 'Done');
        step(`✓ Done in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
        return vtt;
    } finally {
        worker.terminate();
    }
}

function formatClock(seconds) {
    const s = Math.max(0, seconds || 0);
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
}

function formatBytes(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
