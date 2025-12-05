/**
 * MediaBunny Library Wrapper
 * Centralizes the import of the MediaBunny library.
 */

import * as MediaBunny from '../lib/mediabunny.js';
import { registerMp3Encoder } from '../lib/mediabunny-mp3-encoder.js';

registerMp3Encoder();

export default MediaBunny;
export { MediaBunny };