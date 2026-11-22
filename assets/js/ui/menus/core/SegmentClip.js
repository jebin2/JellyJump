// @ts-check
/**
 * "Add clip" in Scenes and Motion: one found segment, cut out as a video of
 * its own.
 *
 * Both tools did the cut themselves, inside their dialog: the job tray did
 * not see it, it could not be cancelled, and the clip went to the end of the
 * playlist by a path of its own (BUG-3). Now it is a job like every other
 * tool's: it shows in the tray, can be cancelled, and its clip goes in after
 * the video it came from (insertProcessedItem), where the edit panel and the
 * tray find it.
 */
import { runMenuJob } from './MenuJob.js';
import { MediaProcessor } from '../../../processing/MediaProcessor.js';
import { MediaMetadata } from '../../../shared/utils/MediaMetadata.js';
import { formatTime } from '../../../shared/utils/mediaUtils.js';

/**
 * @param {Object} options
 * @param {Object} options.item - the video the segment is in
 * @param {Object} options.playlist
 * @param {Object} options.surface - the tool's surface (dialog or edit panel)
 * @param {number} options.start - seconds
 * @param {number} options.end - seconds
 * @param {number} options.index - the segment's number, for its name
 * @param {string} options.kind - 'Scene' or 'Motion', for its name
 * @param {string} options.folder - the folder the clips go in
 * @param {HTMLButtonElement} options.button - the row's Add button: off while
 *   the clip is made, a tick once it is in the playlist, back on if it failed
 */
export function addSegmentClip({ item, playlist, surface, start, end, index, kind, folder, button }) {
    const title = `${item.title.replace(/\.[^/.]+$/, '')} - ${kind} ${index}.mp4`;
    button.disabled = true;
    button.title = 'Added to Jobs';
    const finished = runMenuJob({
        name: `${kind} ${index}`,
        subject: item.title,
        background: true,
        keepOpen: true, // more clips can be added from the same list
        modal: surface,
        work: async ({ signal, onProgress }) => {
            const source = await MediaMetadata.getSourceBlob(item, () => playlist.save());
            return MediaProcessor.process({ source, format: 'mp4', quality: 100, trim: { start, end }, onProgress, signal });
        },
        done: (blob) => {
            playlist.insertProcessedItem(item, blob, title, {
                type: 'video/mp4',
                duration: formatTime(end - start),
                extra: { path: `${folder}/${title}` },
            });
        },
    });
    finished.then((outcome) => {
        if (!button.isConnected) return;
        if (outcome.ok) {
            button.querySelector('use')?.setAttribute('href', 'assets/icons/sprite.svg#icon-check');
            button.classList.add('text-success');
            button.title = 'Added';
        } else {
            button.disabled = false;
            button.title = 'Add Clip';
        }
    });
    return finished;
}
