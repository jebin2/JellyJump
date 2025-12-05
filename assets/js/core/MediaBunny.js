/**
 * MediaBunny Library Wrapper
 * Centralizes the import of the MediaBunny library.
 */

import * as MediaBunny from '../lib/mediabunny.js';

// Import and register MP3 encoder extension
const { registerMp3Encoder } = await import('../lib/mediabunny-mp3-encoder.js');
registerMp3Encoder();

export default MediaBunny;
export { MediaBunny };