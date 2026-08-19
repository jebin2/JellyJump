/**
 * MediaBunny Library Wrapper
 *
 * One set of WebCodecs-based plugins, used identically on desktop and in the
 * browser. Desktop once tried @mediabunny/server (FFmpeg via Node) first; that
 * was removed because it never worked — the package requires its own copy of
 * mediabunny from node_modules, so registering into it left this module's
 * instance untouched, which mediabunny itself reported with a "loaded twice"
 * warning and which the encodable-codec list confirmed was identical before and
 * after the call. It also dragged in node-av, ~170 MB of the desktop installer,
 * to do nothing.
 *
 * What loads when:
 *   eagerly     AC-3 and ProRes decoders — playback needs them the moment a
 *               track is opened.
 *   on demand   the MP3/FLAC/AAC encoders (~1.6 MB) via ensureEncoders(), and
 *               the DTS decoder (~1.6 MB) via ensureDtsDecoder(). Both are
 *               awaited by the code that needs them, so a library with no DTS
 *               in it never pays for the decoder.
 */

import * as MediaBunny from '../lib/mediabunny.js';
import { registerAc3Decoder } from '../lib/mediabunny-ac3.js';
import { registerProresDecoder } from '../lib/mediabunny-prores.js';
import { Logger } from '../shared/utils/Logger.js';

// Match the project Logger convention: full logs in dev, errors only in production.
if (!Logger.isEnabled()) {
    MediaBunny.Logging.level = MediaBunny.LogLevel.Errors;
}

registerAc3Decoder();
registerProresDecoder();

let encodersPromise = null;
let dtsPromise = null;

/**
 * Load and register the DTS decoder.
 *
 * DTS is the audio codec on Blu-ray discs, so it is the primary track on a
 * great many rips, and WebCodecs has no decoder for it — those files played as
 * video with permanent silence unless another audio track happened to be
 * present. Loaded on demand rather than eagerly because the decoder is ~1.6 MB
 * and most libraries never hit a DTS track at all.
 */
export function ensureDtsDecoder() {
    if (!dtsPromise) {
        dtsPromise = import('../lib/mediabunny-dts.js')
            .then(({ registerDtsDecoder }) => registerDtsDecoder())
            .catch((error) => {
                dtsPromise = null; // allow retry on transient load failure
                throw error;
            });
    }
    return dtsPromise;
}

/**
 * Register any on-demand decoder these tracks need, before asking whether they
 * can be decoded. Answering that question without this reports DTS as
 * undecodable and is self-fulfilling: nothing ever loads the decoder.
 * @param {Array<{codec: string}>} tracks
 */
export async function ensureDecodersFor(tracks) {
    if (tracks.some((track) => track?.codec === 'dts')) {
        await ensureDtsDecoder().catch((error) => {
            Logger.warn('[MediaBunny] DTS decoder failed to load:', error.message);
        });
    }
}

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
