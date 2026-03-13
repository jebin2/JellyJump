/**
 * MediaBunny Library Wrapper
 * Centralizes the import of the MediaBunny library.
 */

import * as MediaBunny from '../lib/mediabunny.js';
import { registerMp3Encoder } from '../lib/mediabunny-mp3-encoder.js';
import { registerAc3Decoder } from '../lib/mediabunny-ac3.js';
import { registerFlacEncoder } from '../lib/mediabunny-flac-encoder.js';
import { registerAacEncoder } from '../lib/mediabunny-aac-encoder.js';

registerMp3Encoder();
registerAc3Decoder();
registerFlacEncoder();
registerAacEncoder();

export default MediaBunny;
export { MediaBunny };