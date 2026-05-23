/**
 * MediaBunny Library Wrapper
 * Auto-detects the runtime environment and registers the appropriate backend:
 *   - Desktop (Electron): @mediabunny/server — FFmpeg-backed, hardware-accelerated
 *   - Browser: individual WebCodecs-based encoder/decoder plugins
 */

import * as MediaBunny from '../lib/mediabunny.js';

const isDesktop = typeof window !== 'undefined' && window.electronAPI?.isElectron;

if (isDesktop) {
    // Node.js context available — use FFmpeg-backed server package.
    // This replaces all individual encoder/decoder registrations and adds:
    // hardware acceleration, zero-copy paths, HEVC, VP9 alpha, Vorbis, E-AC-3, etc.
    const { registerMediabunnyServer } = require('@mediabunny/server');
    registerMediabunnyServer();
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
