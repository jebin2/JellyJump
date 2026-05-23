/**
 * MediaBunny Library Wrapper
 * Auto-detects the runtime environment and registers the appropriate backend:
 *   - Desktop (Electron): @mediabunny/server — FFmpeg-backed, hardware-accelerated
 *   - Browser: individual WebCodecs-based encoder/decoder plugins
 */

import * as MediaBunny from '../lib/mediabunny.js';

const isDesktop = typeof window !== 'undefined' && window.electronAPI?.isElectron;

if (isDesktop) {
    // Prefer FFmpeg-backed server package for hardware acceleration and extra codecs.
    // Falls back to browser plugins if native modules aren't available on this machine.
    try {
        const { registerMediabunnyServer } = require('@mediabunny/server');
        registerMediabunnyServer();
    } catch (e) {
        console.warn('[MediaBunny] @mediabunny/server unavailable, falling back to browser plugins:', e.message);
        const { registerMp3Encoder } = await import('../lib/mediabunny-mp3-encoder.js');
        const { registerAc3Decoder } = await import('../lib/mediabunny-ac3.js');
        const { registerFlacEncoder } = await import('../lib/mediabunny-flac-encoder.js');
        const { registerAacEncoder } = await import('../lib/mediabunny-aac-encoder.js');
        registerMp3Encoder();
        registerAc3Decoder();
        registerFlacEncoder();
        registerAacEncoder();
    }
} else {
    const { registerMp3Encoder } = await import('../lib/mediabunny-mp3-encoder.js');
    const { registerAc3Decoder } = await import('../lib/mediabunny-ac3.js');
    const { registerFlacEncoder } = await import('../lib/mediabunny-flac-encoder.js');
    const { registerAacEncoder } = await import('../lib/mediabunny-aac-encoder.js');

    registerMp3Encoder();
    registerAc3Decoder();
    registerFlacEncoder();
    registerAacEncoder();
}

export default MediaBunny;
export { MediaBunny };
