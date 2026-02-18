/**
 * MediaBunny Library Wrapper
 * Centralizes the import of the MediaBunny library.
 */

import * as MediaBunny from '../lib/mediabunny.js';
import { registerMp3Encoder } from '../lib/mediabunny-mp3-encoder.js';
import { registerAc3Decoder } from '../lib/mediabunny-ac3.js';

registerMp3Encoder();
registerAc3Decoder();

export default MediaBunny;
export { MediaBunny };