/**
 * Fill the playlist from a shared library's streaming listing.
 *
 * The listing streams because a large library is megabytes, and waiting for all
 * of it leaves the playlist empty for the whole download with nothing to show.
 *
 * What it must not do is render as it goes. render() rebuilds the tree from
 * scratch and drops the scroll position with it, so rendering per batch made
 * the list unusable for as long as the download lasted: expanding a folder or
 * picking an item was undone a few hundred milliseconds later, and every open
 * drawer restarted at its first batch of rows.
 *
 * So the library announces itself once, as a single folder row marked loading,
 * and the rest of the listing arrives behind it — items go into the model, the
 * row's count is updated in place, and nothing is rebuilt until the listing is
 * done. Two renders per library, whatever its size.
 */
import { generateId } from '../utils/mediaUtils.js';

/**
 * @param {string} url - the share link
 * @param {object} deps
 * @param {Function} deps.fetchStreaming - (url, onBatch) => Promise<{total, complete, expected}>
 * @param {Function} deps.addItems - hands one batch to the model
 * @param {Function} deps.render - full playlist render
 * @param {Function} deps.setLoading - (url, boolean) marks the row as loading
 * @param {Function} [deps.onProgress] - (url, count) update the row in place
 * @param {Function} [deps.onAnnounce] - run once the folder is actually on screen
 * @returns {Promise<object>} the fetch result plus `streamed`, the count seen here
 */
export async function streamLibraryInto(url, {
    fetchStreaming,
    addItems,
    render,
    setLoading,
    onProgress,
    onAnnounce,
}) {
    let streamed = 0;
    let announced = false;

    setLoading(url, true);

    try {
        const result = await fetchStreaming(url, (batch) => {
            if (!batch || batch.length === 0) return;

            for (const item of batch) {
                if (!item.id) item.id = generateId();
            }
            addItems(batch);
            streamed += batch.length;

            if (!announced) {
                announced = true;
                // The one render that puts the folder on screen. Everything
                // after this is an update to that row, not a rebuild.
                render();
                // Only once there is something to look at, so whatever was
                // covering the playlist gets out of the way of a real folder.
                onAnnounce?.();
                return;
            }

            onProgress?.(url, streamed);
        });

        return { ...result, streamed };
    } finally {
        // Cleared before the closing render so the row comes back with an arrow
        // instead of a spinner. In a finally because a listing that fails half
        // way should leave a usable folder, not one that spins for the rest of
        // the session.
        setLoading(url, false);
        render();
    }
}
