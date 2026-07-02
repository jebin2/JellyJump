/**
 * Media processing worker (browser only).
 * Runs the heavy demux/decode/encode/mux pipelines off the main thread so
 * playback and UI stay responsive during conversions. The desktop app never
 * uses this worker: its processing runs in the renderer where
 * @mediabunny/server provides FFmpeg-backed codecs via Node.
 *
 * Importing core/MediaBunny.js here registers the browser codec plugins in
 * this worker's own mediabunny instance.
 */
import { Logger } from '../../shared/utils/Logger.js';
import { process as transcode } from '../transcode/TranscodeService.js';
import { processHls } from '../hls/HlsService.js';
import { reverseVideo, changeVideoSpeed } from '../speed/SpeedService.js';
import { PlatformCrypto } from '../../shared/utils/PlatformCrypto.js';

const OPS = {
    process: transcode,
    processHls,
    reverseVideo,
    changeVideoSpeed,
    encryptPlatform: ({ blob, password, opts, signal, onProgress }) =>
        PlatformCrypto.encrypt(blob, password, { ...opts, signal, onProgress }),
    decryptPlatform: ({ blob, password, signal, onProgress }) =>
        PlatformCrypto.decrypt(blob, password, onProgress, signal),
};

// AbortControllers for in-flight jobs, keyed by job id (for 'cancel' messages)
const controllers = new Map();

self.onmessage = async (event) => {
    const { id, op, options, type } = event.data;

    if (type === 'cancel') {
        controllers.get(id)?.abort();
        return;
    }

    const fn = OPS[op];
    if (!fn) {
        self.postMessage({ id, type: 'error', error: `Unknown operation: ${op}` });
        return;
    }

    const controller = new AbortController();
    controllers.set(id, controller);

    try {
        const result = await fn({
            ...options,
            signal: controller.signal,
            onProgress: (value) => self.postMessage({ id, type: 'progress', value }),
        });

        // HLS results are a Map<string, ArrayBuffer>; transfer the buffers
        // instead of copying them. Blobs are cheap to clone as-is.
        const transfer = [];
        if (result instanceof Map) {
            for (const value of result.values()) {
                if (value instanceof ArrayBuffer) transfer.push(value);
                else if (ArrayBuffer.isView(value)) transfer.push(value.buffer);
            }
        }

        self.postMessage({ id, type: 'done', value: result }, transfer);
    } catch (error) {
        Logger.error(`[MediaWorker] ${op} failed:`, error);
        self.postMessage({
            id,
            type: 'error',
            error: error?.message || String(error),
            errorName: error?.name,
        });
    } finally {
        controllers.delete(id);
    }
};
