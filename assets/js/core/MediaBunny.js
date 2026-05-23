/**
 * MediaBunny Library Wrapper
 * Auto-detects the runtime environment and registers the appropriate backend:
 *   - Desktop (Electron): @mediabunny/server — FFmpeg-backed, hardware-accelerated
 *     Falls back to browser plugins if native modules are unavailable.
 *   - Browser: individual WebCodecs-based encoder/decoder plugins
 */

import * as MediaBunny from '../lib/mediabunny.js';
import { registerMp3Encoder } from '../lib/mediabunny-mp3-encoder.js';
import { registerAc3Decoder } from '../lib/mediabunny-ac3.js';
import { registerFlacEncoder } from '../lib/mediabunny-flac-encoder.js';
import { registerAacEncoder } from '../lib/mediabunny-aac-encoder.js';

function registerBrowserPlugins() {
    registerMp3Encoder();
    registerAc3Decoder();
    registerFlacEncoder();
    registerAacEncoder();
}

const isDesktop = typeof window !== 'undefined' && window.electronAPI?.isElectron;

if (isDesktop) {
    try {
        const { registerMediabunnyServer } = require('@mediabunny/server');
        registerMediabunnyServer();
    } catch (e) {
        console.warn('[MediaBunny] @mediabunny/server unavailable, falling back to browser plugins:', e.message);
        registerBrowserPlugins();
    }
} else {
    registerBrowserPlugins();
}

export default MediaBunny;
export { MediaBunny };
