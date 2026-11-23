// @ts-check
/**
 * What Diagnostics shows and "Copy" copies (ARCHITECTURE_PLAN.md §3.7, P4):
 * the version and build, the browser and what it can decode and encode,
 * storage use, recent errors, recent jobs and the metrics.
 *
 * No file names, folder paths or URLs: errors pass through redact(), jobs
 * are listed by tool, never by what they were run on.
 */
import { config } from '../config/index.js';
import { Logger } from '../utils/Logger.js';
import { JobQueue } from '../services/JobQueue.js';
import { Metrics } from './Metrics.js';
import { redact } from './redact.js';

/** What is asked of the codec APIs: the formats people bring, and what the tools write. */
const VIDEO_CODECS = [
    ['H.264', 'avc1.42E01E'],
    ['HEVC', 'hvc1.1.6.L93.B0'],
    ['VP9', 'vp09.00.10.08'],
    ['AV1', 'av01.0.04M.08'],
];
const AUDIO_CODECS = [
    ['AAC', 'mp4a.40.2'],
    ['Opus', 'opus'],
    ['MP3', 'mp3'],
];

/**
 * @param {any} api - VideoDecoder, AudioEncoder, …
 * @param {Object} configuration
 */
async function supported(api, configuration) {
    if (!api?.isConfigSupported) return false;
    try {
        return !!(await api.isConfigSupported(configuration)).supported;
    } catch {
        return false;
    }
}

async function codecSupport() {
    const g = /** @type {any} */ (globalThis);
    /** @type {Record<string, {decode: boolean, encode: boolean}>} */
    const out = {};
    for (const [name, codec] of VIDEO_CODECS) {
        out[name] = {
            decode: await supported(g.VideoDecoder, { codec, codedWidth: 1280, codedHeight: 720 }),
            encode: await supported(g.VideoEncoder, { codec, width: 1280, height: 720, bitrate: 2_000_000, framerate: 30 }),
        };
    }
    for (const [name, codec] of AUDIO_CODECS) {
        out[name] = {
            decode: await supported(g.AudioDecoder, { codec, sampleRate: 48000, numberOfChannels: 2 }),
            encode: await supported(g.AudioEncoder, { codec, sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 }),
        };
    }
    return out;
}

async function storageUse() {
    try {
        const estimate = await navigator.storage?.estimate?.();
        const persisted = await navigator.storage?.persisted?.();
        if (!estimate) return null;
        return { usage: estimate.usage ?? 0, quota: estimate.quota ?? 0, persisted: !!persisted };
    } catch {
        return null;
    }
}

/** Everything Diagnostics shows, as data. */
export async function collectDiagnostics() {
    const nav = /** @type {any} */ (globalThis.navigator ?? {});
    const storage = await storageUse();
    if (storage) Metrics.record('storageUsed', storage.usage, 'bytes');
    return {
        app: { version: config.version, build: config.buildId },
        browser: {
            userAgent: nav.userAgent ?? 'unknown',
            crossOriginIsolated: !!globalThis.crossOriginIsolated,
            cores: nav.hardwareConcurrency ?? null,
            memoryGB: nav.deviceMemory ?? null,
            screen: globalThis.screen ? `${screen.width}x${screen.height} @${globalThis.devicePixelRatio ?? 1}x` : null,
        },
        codecs: await codecSupport(),
        storage,
        errors: Logger.entries()
            .filter((e) => e.level === 'error')
            .slice(-10)
            .map((e) => ({ time: new Date(e.time).toISOString(), message: redact(e.message).slice(0, 300) })),
        jobs: JobQueue.list().slice(-10).map((job) => ({
            tool: job.name,
            status: job.status,
            seconds: job.startedAt !== undefined && job.finishedAt !== undefined
                ? Math.round((job.finishedAt - job.startedAt) / 100) / 10 : null,
            error: job.errorCode ?? null,
        })),
        metrics: Metrics.summary(),
    };
}

/** @param {number} bytes */
function size(bytes) {
    if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
    if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
    return `${Math.round(bytes / 1e3)} KB`;
}

/** @param {number} value @param {string} unit */
function amount(value, unit) {
    if (unit === 'bytes') return size(value);
    return `${Math.round(value)} ${unit}`;
}

/**
 * The text "Copy" puts on the clipboard, for a bug report.
 * @param {Awaited<ReturnType<typeof collectDiagnostics>>} d
 */
export function formatDiagnostics(d) {
    const yes = (/** @type {boolean} */ v) => (v ? 'yes' : 'no');
    const lines = [
        `JellyJump ${d.app.version} (build ${d.app.build})`,
        `Browser: ${d.browser.userAgent}`,
        `Cross-origin isolated: ${yes(d.browser.crossOriginIsolated)}; cores ${d.browser.cores ?? '?'}; memory ${d.browser.memoryGB ?? '?'} GB; screen ${d.browser.screen ?? '?'}`,
        '',
        'Codecs (decode / encode):',
        ...Object.entries(d.codecs).map(([name, s]) => `  ${name}: ${yes(s.decode)} / ${yes(s.encode)}`),
        '',
        `Storage: ${d.storage ? `${size(d.storage.usage)} of ${size(d.storage.quota)}${d.storage.persisted ? ', persistent' : ''}` : 'unknown'}`,
        '',
        'Metrics (last / median / 95th percentile / worst, over n):',
    ];
    const values = Object.entries(d.metrics.values);
    if (!values.length) lines.push('  none yet');
    for (const [name, m] of values) {
        lines.push(`  ${name}: ${amount(m.last, m.unit)} / ${amount(m.median, m.unit)} / ${amount(m.p95, m.unit)} / ${amount(m.max, m.unit)}, n=${m.count}`);
    }
    for (const [name, n] of Object.entries(d.metrics.counters)) lines.push(`  ${name}: ${n}`);
    lines.push('', 'Recent jobs:');
    if (!d.jobs.length) lines.push('  none');
    for (const job of d.jobs) {
        lines.push(`  ${job.tool}: ${job.status}${job.seconds !== null ? `, ${job.seconds} s` : ''}${job.error ? `, ${job.error}` : ''}`);
    }
    lines.push('', 'Recent errors:');
    if (!d.errors.length) lines.push('  none');
    for (const error of d.errors) lines.push(`  ${error.time} ${error.message}`);
    return lines.join('\n');
}
