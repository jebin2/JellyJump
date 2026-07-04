// Web Worker: browser-side Whisper transcription via transformers.js (ONNX Runtime).
//
// Runs 100% off the main thread so playback, EQ and UI never jank while a
// video is being transcribed. The model is fetched from the Hugging Face Hub
// on first use and cached by the browser (Cache Storage) so subsequent runs
// skip the download.
//
// Protocol (main thread -> worker):
//   { type: 'transcribe', audio: Float32Array(16kHz mono), language, task }
// Protocol (worker -> main thread):
//   { type: 'model-progress', stage, name, file, loaded, total, progress }  download
//   { type: 'device',   device }                                       chosen backend
//   { type: 'inference-start', durationS, chunksTotal }                inference begins
//   { type: 'progress', chunksDone, chunksTotal, progress }            inference progress
//   { type: 'segment',  start, end, text }                             live transcription
//   { type: 'result',   text, chunks: [{ text, timestamp: [start, end] }] }
//   { type: 'error',    message }

import { pipeline, env, WhisperTextStreamer } from '@huggingface/transformers';

// We always pull the model from the Hub; there are no local model files bundled.
env.allowLocalModels = false;
// NOTE: when the page is cross-origin isolated (COOP/COEP headers), onnxruntime-web
// automatically runs multi-threaded WASM (SharedArrayBuffer), which roughly halves
// CPU-fallback transcription time. See the server headers in vite.config.js.

// The `_timestamped` export includes cross-attentions, which are required for
// word-level timestamps (return_timestamps: 'word').
const MODEL_ID = 'onnx-community/whisper-base_timestamped';

// The Whisper context window is 30s. We slide it with a 5s stride on each side
// and let the pipeline stitch + de-duplicate the overlaps for us.
const CHUNK_LENGTH_S = 30;
const STRIDE_LENGTH_S = 5;
const SAMPLE_RATE = 16000;

let transcriberPromise = null;
let activeDevice = null;

/**
 * Lazily build the ASR pipeline, preferring WebGPU and transparently falling
 * back to WASM (CPU) when WebGPU is unavailable or fails to initialise.
 *
 * The encoder is kept at fp32 while the decoder is quantised to q4 — quantising
 * the encoder degrades feature quality and produces garbled output on accented
 * or noisy audio, so we only quantise the decoder where it is safe.
 */
async function getTranscriber() {
    if (transcriberPromise) return transcriberPromise;

    const progress_callback = (p) => {
        // p: { status, file, name, loaded, total, progress }
        // status transitions per file: initiate -> download -> progress* -> done
        self.postMessage({
            type: 'model-progress',
            stage: p.status,
            name: p.name,
            file: p.file,
            loaded: p.loaded,
            total: p.total,
            progress: typeof p.progress === 'number' ? p.progress : undefined,
        });
    };

    const buildFor = async (device) => {
        const t = await pipeline('automatic-speech-recognition', MODEL_ID, {
            device,
            dtype: {
                encoder_model: 'fp32',
                decoder_model_merged: 'q4',
            },
            progress_callback,
        });
        activeDevice = device;
        self.postMessage({ type: 'device', device });
        return t;
    };

    transcriberPromise = (async () => {
        // `'gpu' in navigator` is not enough: some browsers expose the API but
        // fail to return an adapter (headless, blocked drivers, VMs). And when
        // WebGPU is chosen but the adapter is missing, the failure surfaces
        // later during inference — not at pipeline-build time — so we must
        // decide up front by actually requesting an adapter.
        if (await webgpuUsable()) {
            try {
                return await buildFor('webgpu');
            } catch (e) {
                self.postMessage({
                    type: 'model-progress',
                    stage: 'webgpu-fallback',
                    message: String(e && e.message || e),
                });
            }
        }
        return buildFor('wasm');
    })();

    return transcriberPromise;
}

async function webgpuUsable() {
    try {
        if (typeof navigator === 'undefined' || !('gpu' in navigator)) return false;
        const adapter = await navigator.gpu.requestAdapter();
        return !!adapter;
    } catch {
        return false;
    }
}

async function transcribe({ audio, language, task }) {
    const transcriber = await getTranscriber();

    // The pipeline slides a 30s window over the audio, advancing by
    // `hop = window - 2*stride` seconds and calling model.generate() once per
    // window. That generate() count is the number of windows — our progress
    // denominator and the source of each window's absolute time offset.
    const hop = CHUNK_LENGTH_S - 2 * STRIDE_LENGTH_S;
    const durationS = audio.length / SAMPLE_RATE;
    const chunksTotal = durationS <= CHUNK_LENGTH_S
        ? 1
        : Math.ceil((durationS - CHUNK_LENGTH_S) / hop) + 1;

    self.postMessage({ type: 'inference-start', durationS, chunksTotal });

    let windowIndex = -1;    // 0-based window; bumped when each generate() starts
    let inWindowFrac = 0;    // 0..1 within the current window, from timestamp tokens
    let segStart = null;     // absolute start (s) of the segment being decoded
    let segText = '';        // text accumulated for the current segment

    // Absolute time of a within-window timestamp `t`, clamped to the real
    // duration so live output can never run past the end of the media.
    const clampAbs = (t) => Math.max(0, Math.min(durationS, windowIndex * hop + t));

    const emitProgress = () => {
        const done = Math.max(0, windowIndex);
        const progress = Math.min(1, (done + inWindowFrac) / chunksTotal);
        self.postMessage({ type: 'progress', chunksDone: done, chunksTotal, progress });
    };

    // A fresh WhisperTextStreamer per window: reusing one lets the half-open
    // timestamp-pair state bleed across window boundaries and produces bogus
    // segments. Each streamer surfaces:
    //   - callback_function(text): incremental transcribed text
    //   - on_chunk_start(t)/on_chunk_end(t): timestamp tokens (window-relative)
    const makeStreamer = () => new WhisperTextStreamer(transcriber.tokenizer, {
        skip_prompt: true,
        callback_function: (text) => { segText += text; },
        on_chunk_start: (t) => {
            segStart = clampAbs(t);
            segText = '';
            inWindowFrac = Math.max(inWindowFrac, Math.min(1, t / CHUNK_LENGTH_S));
            emitProgress();
        },
        on_chunk_end: (t) => {
            const end = clampAbs(t);
            const text = segText.trim();
            if (text && segStart != null && end >= segStart) {
                // Live segment — shows text as it is produced.
                self.postMessage({ type: 'segment', start: segStart, end, text });
            }
            segText = '';
        },
    });

    // model.generate() is called exactly once per window — the reliable window
    // signal. (streamer.end()/on_finalize is NOT reliable: it can fire more than
    // once per window, which previously pegged progress at 100% early and made
    // live timestamps drift to ~2x the real duration.)
    const origGenerate = transcriber.model.generate.bind(transcriber.model);
    transcriber.model.generate = (params) => {
        windowIndex++;
        inWindowFrac = 0;
        segStart = null;
        segText = '';
        emitProgress();
        return origGenerate({ ...params, streamer: makeStreamer() });
    };

    const output = await transcriber(audio, {
        chunk_length_s: CHUNK_LENGTH_S,
        stride_length_s: STRIDE_LENGTH_S,
        return_timestamps: 'word',
        // 'transcribe' keeps the source language; 'translate' renders English.
        task: task || 'transcribe',
        // undefined => auto-detect the spoken language.
        language: language || undefined,
        force_full_sequences: false,
    });

    const chunks = Array.isArray(output.chunks) ? output.chunks : [];
    self.postMessage({ type: 'result', text: output.text, chunks });
}

self.addEventListener('message', async (e) => {
    const msg = e.data || {};
    try {
        if (msg.type === 'transcribe') {
            await transcribe(msg);
        }
    } catch (err) {
        self.postMessage({ type: 'error', message: String(err && err.message || err) });
    }
});
