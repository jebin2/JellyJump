/**
 * MediaBunny Library Wrapper
 * Registers codec backends for both runtimes:
 *   - Desktop (Electron): tries @mediabunny/server — FFmpeg-backed via Node.
 *   - Everywhere: the WebCodecs-based browser plugins.
 *
 * Decoders (AC-3, ProRes) register eagerly — playback needs them the moment a
 * track is opened. The encoder plugins (~1.6 MB minified) load on demand via
 * ensureEncoders(), which every encoding service awaits before it starts.
 *
 * Nothing here trusts the server import to have worked. @mediabunny/server
 * requires its own copy of mediabunny from node_modules, so registering into it
 * leaves this module's instance untouched — mediabunny says as much with its
 * "loaded twice" warning, and the encodable-codec list is provably identical
 * before and after the call. Treating a successful require() as a live backend
 * meant desktop skipped the browser plugins and ended up with no AAC/MP3/FLAC
 * encoder and no AC-3/ProRes decoder at all. So the browser plugins always
 * register, and ensureEncoders() asks what can actually be encoded rather than
 * inferring it from which import succeeded.
 */

import * as MediaBunny from '../lib/mediabunny.js';
import { registerAc3Decoder } from '../lib/mediabunny-ac3.js';
import { registerProresDecoder } from '../lib/mediabunny-prores.js';
import { Logger } from '../shared/utils/Logger.js';

// Match the project Logger convention: full logs in dev, errors only in production.
if (!Logger.isEnabled()) {
    MediaBunny.Logging.level = MediaBunny.LogLevel.Errors;
}

const isDesktop = typeof window !== 'undefined' && window.electronAPI?.isElectron;

if (isDesktop) {
    try {
        const { registerMediabunnyServer } = require('@mediabunny/server');
        registerMediabunnyServer();
    } catch (e) {
        Logger.warn('[MediaBunny] @mediabunny/server unavailable:', e.message);
    }
}

registerAc3Decoder();
registerProresDecoder();

let encodersPromise = null;

/**
 * Load and register the MP3/FLAC/AAC encoder plugins.
 * Must be awaited before any operation that encodes audio.
 *
 * AAC stands in for the whole set: it is the one codec these plugins add that
 * the server backend would also provide, so if it is already encodable the
 * backend is genuinely live and the plugins are redundant.
 */
export function ensureEncoders() {
    if (!encodersPromise) {
        encodersPromise = MediaBunny.canEncodeAudio('aac').then((haveNativeAac) => {
            if (haveNativeAac) {
                Logger.log('[MediaBunny] Native AAC encoder present — skipping browser encoder plugins');
                return;
            }
            return Promise.all([
                import('../lib/mediabunny-mp3-encoder.js'),
                import('../lib/mediabunny-flac-encoder.js'),
                import('../lib/mediabunny-aac-encoder.js'),
            ]).then(([mp3, flac, aac]) => {
                mp3.registerMp3Encoder();
                flac.registerFlacEncoder();
                aac.registerAacEncoder();
            });
        }).catch((error) => {
            encodersPromise = null; // allow retry on transient load failure
            throw error;
        });
    }
    return encodersPromise;
}

export default MediaBunny;
export { MediaBunny };
