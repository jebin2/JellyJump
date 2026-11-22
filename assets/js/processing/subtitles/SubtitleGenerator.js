// Orchestrates AI subtitle generation for the player:
//   1. Extract 16kHz mono PCM from the decoded audio track (mediabunny).
//   2. Hand the PCM to a Web Worker running Whisper (transformers.js).
//   3. Turn the returned segments into WebVTT and load them as a subtitle track.
//
// All of the heavy lifting (model download + inference) happens in the worker,
// so the render loop, EQ and UI stay smooth throughout.

import { MediaBunny } from '../../shared/media/MediaBunny.js';
import { Logger } from '../../shared/utils/Logger.js';
import { wordChunksToVTT } from '../../shared/media/SubtitleConverter.js';

const TARGET_RATE = 16000;      // Whisper input rate

// The extraction pass is roughly the first slice of the whole job; the rest is
// model download + inference. Keep the two phases visually distinct.
const PHASE = {
    EXTRACT: 'extract',
    MODEL: 'model',
    TRANSCRIBE: 'transcribe',
};

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

    const duration = player.duration || 0;
    Logger.log(`[Subtitles] Decoding audio track (${duration ? duration.toFixed(1) + 's' : 'unknown length'})…`);

    // Pre-size from duration (+ small margin) so we usually never reallocate,
    // and never build one giant array via a final concat.
    const out = createPcmSink(Math.ceil(((duration || 60) + 0.5) * TARGET_RATE));

    // Mediabunny resamples and downmixes, as one continuous stream rather
    // than in separate batches. It runs as a Conversion whose `process` sees
    // each sample after resampling and keeps its PCM; the conversion's own
    // output writes nowhere, and PCM there needs no encoder from the browser.
    //
    // Measured against the OfflineAudioContext this replaced: neither applies
    // an anti-aliasing filter (a 12 kHz tone folds to 4 kHz at full strength
    // in both, as Chrome resamples buffer playback by linear interpolation),
    // so recognition input is unchanged in that respect.
    let lastPct = -1;
    const conversion = await MediaBunny.Conversion.init({
        input: player.input,
        output: new MediaBunny.Output({
            format: new MediaBunny.MkvOutputFormat(),
            target: new MediaBunny.NullTarget(),
        }),
        video: { discard: true },
        // The track being played, which need not be the file's primary one.
        audio: (candidate) => candidate.id !== track.id ? { discard: true } : {
            sampleRate: TARGET_RATE,
            numberOfChannels: 1,
            codec: 'pcm-f32',
            forceTranscode: true,
            process: (sample) => {
                const pcm = new Float32Array(sample.numberOfFrames);
                sample.copyTo(pcm, { planeIndex: 0, format: 'f32-planar' });
                out.push(pcm);

                // Throttled to whole-percent changes: this runs per decoded
                // sample (thousands of times), and each report writes the DOM.
                if (duration > 0 && onProgress) {
                    const pct = Math.floor(Math.min(0.999, (sample.timestamp || 0) / duration) * 100);
                    if (pct !== lastPct) { lastPct = pct; onProgress(pct / 100); }
                }
                return null;
            },
        },
    });
    if (!conversion.isValid) {
        const reasons = conversion.discardedTracks.map(t => t.reason).join(', ');
        throw new Error(`Could not decode the audio of this media (${reasons}).`);
    }
    await conversion.execute();

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

        // chunks are word-level (return_timestamps: 'word'); pack each cue to
        // fill up to ~80% of the video width so wider videos get more words.
        const vtt = wordChunksToVTT(chunks, buildCueSizer(player));
        const cueCount = (vtt.match(/-->/g) || []).length;
        step(`4/4 Built VTT (${cueCount} cue${cueCount === 1 ? '' : 's'}). Loading track…`);
        report(PHASE.TRANSCRIBE, 1, 'Done');
        step(`✓ Done in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
        return vtt;
    } finally {
        worker.terminate();
    }
}

/**
 * Build a width-based cue sizer from the player's canvas so cue grouping fills
 * up to 80% of the video width. The font MUST match
 * PlayerSubtitles.renderSubtitles so measured widths equal rendered widths.
 * Returns {} (static fallback) if no canvas is available.
 */
function buildCueSizer(player) {
    const canvas = player?.canvas;
    if (!canvas?.width || !canvas?.height || typeof document === 'undefined') return {};
    const fontSize = Math.max(22, canvas.height * 0.055);
    const mctx = document.createElement('canvas').getContext('2d');
    if (!mctx) return {};
    mctx.font = `bold ${fontSize}px "Segoe UI", Roboto, Arial, sans-serif`;
    return {
        measure: (t) => mctx.measureText(t).width,
        maxWidth: canvas.width * 0.8,
    };
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
