import { Logger } from '../../shared/utils/Logger.js';
import { MediaBunny } from '../../core/MediaBunny.js';
import { createMediaBunnyInput } from '../shared/InputFactory.js';

/**
 * Trim without re-encoding, through Mediabunny's copy conversion.
 *
 * This used to copy packets by hand, and it could only start the output at a
 * key frame -- so a trim landing mid-GOP silently began early. Measured on a
 * clip with key frames every two seconds, asking for 3s-5s produced a three
 * second file whose first frame was the source's frame at 2.0s: a whole
 * second of footage the user had cut off, handed back to them anyway.
 *
 * Mediabunny 1.56 made copy conversions work for arbitrary trim ranges by
 * writing an edit list, so the file may still *contain* the packets back to
 * the preceding key frame while playing from exactly where it was asked to.
 * The same request now yields a two second file starting at exactly 3.0s,
 * pixel-identical to the source frame there.
 *
 * @param {Blob|File|string} source
 * @param {{start: number, end: number}} trim
 * @param {(progress: number) => void} [onProgress]
 * @returns {Promise<Blob>}
 */
export async function losslessTrim({ source, trim, onProgress }) {
    Logger.log('[MediaProcessor] Starting lossless trim...', trim);

    let input = null;
    try {
        input = createMediaBunnyInput(source);

        const output = new MediaBunny.Output({
            format: new MediaBunny.Mp4OutputFormat(),
            target: new MediaBunny.BufferTarget(),
        });

        const conversion = await MediaBunny.Conversion.init({
            input,
            output,
            trim,
            copy: {
                // 'preferred', not 'forced': forced discards any track it
                // cannot copy, which would hand back a silent video rather
                // than one whose audio was re-encoded.
                mode: 'preferred',
                // Never drop media that was asked for. The region may be
                // widened to the preceding key frame to make the copy
                // possible; the edit list hides that on playback.
                boundaryPolicy: 'expand',
                // shiftTolerance is left at its default of 0, which keeps
                // output timestamps exactly aligned with the input's.
            },
        });

        if (onProgress) conversion.onProgress = onProgress;

        await conversion.execute();
        onProgress?.(1);

        return new Blob([output.target.buffer], { type: 'video/mp4' });
    } finally {
        if (input && typeof input.dispose === 'function') {
            try { input.dispose(); } catch (e) { Logger.warn('losslessTrim: dispose error', e); }
        }
    }
}
