/**
 * MediaBunny Library Wrapper
 * Auto-detects the runtime environment and registers the appropriate backend:
 *   - Desktop (Electron): @mediabunny/server — FFmpeg-backed, hardware-accelerated
 *     Falls back to browser plugins if native modules are unavailable.
 *   - Browser: individual WebCodecs-based encoder/decoder plugins.
 *
 * Decoders (AC-3, ProRes) register eagerly — playback needs them the moment a
 * track is opened. The encoder plugins (~1.6 MB minified) load on demand via
 * ensureEncoders(), which every encoding service awaits before it starts.
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
let useBrowserPlugins = !isDesktop;

if (isDesktop) {
    try {
        const { registerMediabunnyServer } = require('@mediabunny/server');
        registerMediabunnyServer();
    } catch (e) {
        console.warn('[MediaBunny] @mediabunny/server unavailable, falling back to browser plugins:', e.message);
        useBrowserPlugins = true;
    }
}

if (useBrowserPlugins) {
    registerAc3Decoder();
    registerProresDecoder();
}

let encodersPromise = null;

/**
 * Load and register the MP3/FLAC/AAC encoder plugins.
 * No-op on desktop where @mediabunny/server already provides all encoders.
 * Must be awaited before any operation that encodes audio.
 */
export function ensureEncoders() {
    if (!useBrowserPlugins) return Promise.resolve();
    if (!encodersPromise) {
        encodersPromise = Promise.all([
            import('../lib/mediabunny-mp3-encoder.js'),
            import('../lib/mediabunny-flac-encoder.js'),
            import('../lib/mediabunny-aac-encoder.js'),
        ]).then(([mp3, flac, aac]) => {
            mp3.registerMp3Encoder();
            flac.registerFlacEncoder();
            aac.registerAacEncoder();
        }).catch((error) => {
            encodersPromise = null; // allow retry on transient load failure
            throw error;
        });
    }
    return encodersPromise;
}

export default MediaBunny;
export { MediaBunny };
