/**
 * Which of the player's loaders a playlist item belongs to.
 *
 * selectItem is a two-hundred-and-sixty-line method, and most of its length is
 * the five ways an item can be opened: a live camera the screen recorder still
 * holds, a YouTube watch page, an HLS or live URL, a file that has to be
 * fetched first, and a file already in hand. Which one applies is decided by a
 * run of `if`s that each end in their own `return`, so the order is the
 * decision -- and nothing tested it.
 *
 * The order is not arbitrary. YouTube is checked before the stream test
 * because a watch page can be a live broadcast, and everything below the
 * YouTube branch assumes a fetchable media file: the cache path would download
 * HTML and the demuxer would reject it. The stream test is checked before the
 * fetch path for the same reason in reverse -- an HLS playlist is fetched by
 * the demuxer, not by us.
 *
 * Only the choice lives here. Every side effect -- the toast, the load guard,
 * the badge, the cache lookup -- stays in selectItem.
 */

/**
 * @param {object} video - the playlist item
 * @param {object} [context]
 * @param {boolean} [context.hasWebcamStream] - whether the screen recorder
 *        still holds the live stream this item refers to. Without it a webcam
 *        item cannot be restored, and it falls through to the ordinary paths
 *        exactly as it did before.
 * @returns {'needsReload'|'webcam'|'youtube'|'stream'|'fetch'|'local'}
 */
export function classifyPlaylistItem(video, { hasWebcamStream = false } = {}) {
    if (!video) return 'local';

    // A local file whose handle did not survive the reload cannot be opened at
    // all, so this comes first: nothing below could do anything with it.
    if (video.needsReload) return 'needsReload';

    if (video.isWebcam && hasWebcamStream) return 'webcam';

    if (video.isYouTube) return 'youtube';

    if (video.isLive || video.isStream || (video.url && video.url.includes('.m3u8'))) {
        return 'stream';
    }

    return video.blob_url ? 'local' : 'fetch';
}
