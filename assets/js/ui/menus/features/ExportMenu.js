import { MediaProcessor } from '../../../core/MediaProcessor.js';
import { MediaMetadata } from '../../../shared/utils/MediaMetadata.js';
import { formatTime, parseTime } from '../../../shared/utils/mediaUtils.js';
import { openProcessMenu, FOOTER_CONFIGS } from '../core/MenuFactory.js';
import { STICKER_MOTIONS } from '../../player/StickerLayer.js';
import { BORDER_PRESETS, RAIN_PRESETS } from '../../player/DecorationLayer.js';
import { runMenuJob } from '../core/MenuJob.js';
import { html } from '../../../shared/utils/html.js';

/**
 * Export Menu - writes a file with whatever is on screen baked into it.
 *
 * The colour effects, stickers and decorations live on the *player*, not on the
 * playlist item, so this only makes sense for the item that is actually
 * playing. Offering it for any other row would silently export one video with
 * another's effects.
 */
export class ExportMenu {
    /**
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist
     */
    static async init(item, playlist) {
        const player = playlist.player;
        const active = playlist.items[playlist.activeIndex];
        const isPlayingThis = !!player && !!active && active.id === item.id;

        const { modal, content } = openProcessMenu(
            'Export with effects', 'export-fx-content-template', FOOTER_CONFIGS.exportFx,
        );
        if (!modal) return;

        const summary = content.querySelector('.export-fx-summary');
        const empty = content.querySelector('.export-fx-empty');
        const startInput = content.querySelector('#export-fx-start');
        const endInput = content.querySelector('#export-fx-end');
        const exportBtn = content.querySelector('.export-fx-btn');
        const downloadBtn = content.querySelector('.download-btn');
        const progressSection = content.querySelector('.progress-section');
        const progressPercentage = content.querySelector('.progress-percentage');
        const errorMessage = content.querySelector('.error-message');
        const successMessage = content.querySelector('.success-message');

        // Subtitles loaded into or generated on the player go into the file
        // as tracks of their own, switchable in the viewer's player.
        const subtitleTracks = isPlayingThis ? (player.subtitles?.tracks ?? []).filter(t => t.cues?.length) : [];
        const subtitleToggle = content.querySelector('#export-fx-subtitles-toggle');
        if (subtitleTracks.length) {
            const names = subtitleTracks.map(t => t.name).join(', ');
            content.querySelector('.export-fx-subtitles-label').textContent =
                `Include ${subtitleTracks.length === 1 ? 'the subtitle track' : `${subtitleTracks.length} subtitle tracks`} (${names})`;
            content.querySelector('.export-fx-subtitles').classList.remove('hidden');
        }

        if (!isPlayingThis) {
            empty.textContent = 'Play this video first. The effects live on the player, '
                + 'so they can only be baked into the video that is on screen.';
        } else if (modal.isPanel) {
            empty.textContent = 'Nothing is applied yet. Add a colour effect, a sticker, a border '
                + 'or some rain with the player\'s Filters button.';
        }

        // What is on the player, listed again whenever it changes.
        const refresh = () => {
            const applied = isPlayingThis ? ExportMenu._describe(player) : [];
            summary.innerHTML = html`${applied.map(line => html`<li>${line}</li>`)}`;
            // Subtitles alone are worth exporting: they turn a video and a
            // separate caption file into one file that carries both.
            const nothing = !isPlayingThis || (applied.length === 0 && !subtitleTracks.length);
            empty.classList.toggle('hidden', !nothing);
            exportBtn.disabled = nothing;
        };
        refresh();

        // In the edit panel the player's Filters panel stays usable beside
        // this one, so what it lists can change while it is open.
        if (modal.isPanel && isPlayingThis && player.container) {
            let frame = 0;
            const later = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(refresh); };
            for (const type of ['input', 'change', 'click']) player.container.addEventListener(type, later);
            modal.onCleanup(() => {
                cancelAnimationFrame(frame);
                for (const type of ['input', 'change', 'click']) player.container.removeEventListener(type, later);
            });
        }

        await playlist._ensureMetadata(item);
        let duration = 0;
        if (typeof item.duration === 'string' && item.duration !== '--:--') {
            duration = parseTime(item.duration);
        }
        startInput.value = formatTime(0);
        endInput.value = formatTime(duration);

        exportBtn.addEventListener('click', async () => {
            // The colour effects as they are now. The job may wait behind
            // another, and the edit panel puts the player's effects away
            // again when this tool closes; a copy keeps what was asked for.
            const live = player.videoFilters;
            const filters = live ? Object.assign(Object.create(Object.getPrototypeOf(live)), live) : null;
            await runMenuJob({
                name: 'Export FX',
                subject: item.title,
                background: true,
                modal,
                failureText: (err) => err.message || 'Export failed.',
                work: async ({ signal, onProgress }) => {
                    const start = parseTime(startInput.value) || 0;
                    const end = parseTime(endInput.value) || duration;
                    if (!(end > start)) throw new Error('The end has to come after the start.');

                    const source = await MediaMetadata.getSourceBlob(item, () => playlist._saveState());
                    const blob = await MediaProcessor.process({
                        source,
                        format: 'mp4',
                        quality: 100,
                        // Only pass a range when it is actually a range: a trim
                        // covering the whole video still costs a seek and a
                        // boundary decision for nothing.
                        ...(start > 0 || end < duration ? { trim: { start, end } } : {}),
                        overlays: {
                            filters,
                            stickers: player.stickers,
                            decorations: player.decorations,
                        },
                        subtitles: subtitleTracks.length && subtitleToggle?.checked
                            ? subtitleTracks.map(t => ({ name: t.name, cues: t.cues }))
                            : null,
                        onProgress,
                        signal,
                    });
                    return { blob, start, end };
                },
                done: ({ blob, start, end }) => {
                    const base = item.title.replace(/\.[^/.]+$/, '');
                    const filename = `${base} - effects.mp4`;
                    const { url } = playlist.insertProcessedItem(item, blob, filename, {
                        type: 'video/mp4',
                        duration: formatTime(end - start),
                    });
                    downloadBtn.href = url;
                    downloadBtn.download = filename;
                    downloadBtn.classList.remove('hidden');
                },
            });
        });
    }

    /**
     * What the viewer will actually get, in their words rather than ours.
     * @private
     */
    static _describe(player) {
        const lines = [];
        const filters = player.videoFilters;

        if (filters?.isActive?.()) {
            const effect = filters.effect ? filters.effects[filters.effect]?.label : null;
            const adjusted = filters.brightness !== 100 || filters.contrast !== 100
                || filters.saturation !== 100 || filters.sepia > 0 || filters.grayscale > 0
                || filters.hueRotate !== 0 || filters.blur > 0 || filters.invert > 0;
            if (effect) lines.push(`Effect: ${effect}`);
            if (adjusted) lines.push('Colour adjustments');
        }

        const stickers = player.stickers?.stickers ?? [];
        if (stickers.length) {
            const moving = stickers.filter(s => STICKER_MOTIONS[s.motion]).length;
            lines.push(`${stickers.length} sticker${stickers.length === 1 ? '' : 's'}`
                + (moving ? `, ${moving} moving` : ''));
        }

        const decorations = player.decorations;
        if (decorations?.border) lines.push(`Border: ${BORDER_PRESETS[decorations.border]?.label ?? decorations.border}`);
        if (decorations?.rain) {
            lines.push(`${RAIN_PRESETS[decorations.rain]?.label ?? decorations.rain}`
                + ` (${decorations.density} at a time)`);
        }

        return lines;
    }
}
