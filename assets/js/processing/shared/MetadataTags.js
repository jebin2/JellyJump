import { Logger } from '../../shared/utils/Logger.js';

/**
 * Carry a source file's descriptive tags -- title, artist, cover art, and
 * the rest Mediabunny reads -- onto an output a service builds by hand.
 *
 * A Mediabunny Conversion does this by itself. The pipelines that assemble
 * their own Output (merge, speed, reverse, extraction with speed, and the
 * composable conversions of combine, which leave tags to their owner) were
 * writing files with none: a sped-up music video lost its title and cover.
 *
 * Same rule as Conversion: the container-specific `raw` tags only travel
 * when the output is the same kind of file, since they mean nothing in
 * another container. Must run before output.start(). A source whose tags
 * cannot be read just gives an output without them.
 *
 * @param {Object} input - a Mediabunny Input
 * @param {Object} output - a Mediabunny Output not yet started
 */
export async function copyMetadataTags(input, output) {
    try {
        const tags = await input.getMetadataTags();
        if (!tags || Object.keys(tags).length === 0) return;

        const copied = { ...tags };
        const inputFormat = await input.getFormat().catch(() => null);
        if (copied.raw && inputFormat?.mimeType !== output.format.mimeType) delete copied.raw;
        if (Object.keys(copied).length === 0) return;

        output.setMetadataTags(copied);
    } catch (error) {
        Logger.warn('[MetadataTags] Could not copy the source\'s tags', error);
    }
}
