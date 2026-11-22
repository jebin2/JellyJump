import { MediaBunny, ensureEncoders } from '../../shared/media/MediaBunny.js';
import { Logger } from '../../shared/utils/Logger.js';

/**
 * TrackRecorder - records live MediaStream tracks (a shared screen, a
 * microphone) into a WebM through Mediabunny.
 *
 * It replaces MediaRecorder, whose WebM has no duration and no cues: such a
 * file plays, but its length shows as unknown and seeking in it is slow or
 * does not work. Mediabunny writes both, and keeps the two tracks in sync with
 * each other from the first sample.
 *
 * The file is written to the browser's private storage (OPFS) as it is
 * recorded, not held in memory: an hour of screen at high quality runs to
 * gigabytes, which a growing in-memory buffer would need about twice of at its
 * peak, and losing the tab to that loses the whole recording. Mediabunny
 * writes each piece at its position in the file, so the duration and cues can
 * still go in at the end -- an append-only file could not have them. Where
 * OPFS file streams are missing (Safari), it falls back to memory.
 */

const FILE_PREFIX = 'jj-recording-';

/** Recordings made by this page; their files may still be in use. */
const ownFiles = new Set();

/** Untouched for this long, a recording is no longer open anywhere. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Delete recordings left by earlier visits. They are not removed when the
 * page that made them goes, and would otherwise build up for ever. Only old
 * ones: another tab of the app may be recording, or still playing a recording
 * it made, and its files must survive this tab tidying up.
 */
async function removeStaleRecordings(root) {
    try {
        const cutoff = Date.now() - STALE_AFTER_MS;
        for await (const [name, handle] of root.entries()) {
            if (!name.startsWith(FILE_PREFIX) || ownFiles.has(name) || handle.kind !== 'file') continue;
            const { lastModified } = await handle.getFile();
            if (lastModified < cutoff) {
                await root.removeEntry(name).catch(() => { /* in use elsewhere */ });
            }
        }
    } catch (error) {
        Logger.warn('[TrackRecorder] Could not tidy old recordings', error);
    }
}

/**
 * Where the recording is written.
 * @returns {Promise<{ target: Object, finish: () => Promise<Blob>, discard: () => Promise<void> }>}
 */
async function openStorage() {
    try {
        const root = await navigator.storage?.getDirectory?.();
        if (root) {
            await removeStaleRecordings(root);
            const name = `${FILE_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webm`;
            const handle = await root.getFileHandle(name, { create: true });
            if (typeof handle.createWritable === 'function') {
                const writable = await handle.createWritable();
                ownFiles.add(name);
                return {
                    target: new MediaBunny.StreamTarget(writable, { chunked: true }),
                    // A File backed by the disk, not a copy in memory.
                    finish: async () => new Blob([await handle.getFile()], { type: 'video/webm' }),
                    discard: async () => {
                        ownFiles.delete(name);
                        await root.removeEntry(name).catch(() => { /* already gone */ });
                    },
                };
            }
            await root.removeEntry(name).catch(() => { /* already gone */ });
        }
    } catch (error) {
        Logger.warn('[TrackRecorder] Browser storage unavailable; recording in memory', error);
    }

    const target = new MediaBunny.BufferTarget();
    return {
        target,
        finish: async () => new Blob([target.buffer], { type: 'video/webm' }),
        discard: async () => {},
    };
}

const VIDEO_CODECS = ['vp9', 'vp8', 'av1'];
const AUDIO_CODECS = ['opus', 'vorbis'];

/**
 * @param {Object} options
 * @param {MediaStreamTrack} options.videoTrack
 * @param {MediaStreamTrack} [options.audioTrack]
 * @param {(error: Error) => void} [options.onError] - the recording failed
 *   while running; it has already been cancelled
 * @returns {Promise<{ hasAudio: boolean, stop: () => Promise<Blob> }>}
 */
export async function startTrackRecording({ videoTrack, audioTrack = null, onError }) {
    await ensureEncoders();

    const { width, height } = videoTrack.getSettings();
    const videoCodec = await MediaBunny.getFirstEncodableVideoCodec(VIDEO_CODECS, { width, height });
    if (!videoCodec) throw new Error('This browser cannot encode a WebM video.');

    const storage = await openStorage();
    // Anything failing before the recording is running must not leave the
    // file behind, or its stream open.
    let output = null;
    let sources;
    let hasAudio;
    let failed;
    try {
        const format = new MediaBunny.WebMOutputFormat();
        output = new MediaBunny.Output({ format, target: storage.target });

        sources = [];
        const videoSource = new MediaBunny.MediaStreamVideoTrackSource(videoTrack, {
            codec: videoCodec,
            quality: MediaBunny.QUALITY_HIGH,
        });
        output.addVideoTrack(videoSource);
        sources.push(videoSource);

        hasAudio = false;
        if (audioTrack) {
            const audioCodec = await MediaBunny.getFirstEncodableAudioCodec(AUDIO_CODECS);
            if (audioCodec) {
                const audioSource = new MediaBunny.MediaStreamAudioTrackSource(audioTrack, {
                    codec: audioCodec,
                    quality: MediaBunny.QUALITY_HIGH,
                });
                output.addAudioTrack(audioSource);
                sources.push(audioSource);
                hasAudio = true;
            } else {
                Logger.warn('[TrackRecorder] No WebM audio codec can be encoded; recording without sound');
            }
        }

        failed = false;
        for (const source of sources) {
            source.errorPromise.catch((error) => {
                if (failed) return;
                failed = true;
                Logger.error('[TrackRecorder] Recording failed', error);
                output.cancel().catch(() => { /* already gone */ }).finally(() => storage.discard());
                onError?.(error);
            });
        }

        await output.start();
    } catch (error) {
        await output?.cancel().catch(() => { /* never started */ });
        await storage.discard();
        throw error;
    }
    Logger.log(`[TrackRecorder] Recording ${width}x${height} ${videoCodec}${hasAudio ? ' with audio' : ''}`);

    return {
        hasAudio,
        async stop() {
            if (failed) throw new Error('The recording failed.');
            try {
                await output.finalize();
            } catch (error) {
                await storage.discard();
                throw error;
            }
            return storage.finish();
        },
    };
}
