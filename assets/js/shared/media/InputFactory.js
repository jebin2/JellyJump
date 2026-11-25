// @ts-check
import { MediaBunny } from './MediaBunny.js';
import { mediaFetchFn } from '../net/mediaFetch.js';
import { createBufferedSource, findOpenRemote } from './buffer/RemotePlayback.js';

export const AUDIO_BITRATE_BPS = 128000;

/**
 * A MediaBunny Input for an address (HLS included) or a file. An address
 * playing through the remote buffer is read from it.
 * @param {string|Blob} source
 * @param {string} [label] - who reads, in the network log (mediaFetch.js)
 * @returns {any} a MediaBunny Input
 */
export function createMediaBunnyInput(source, label = 'media') {
    if (typeof source === 'string') {
        // The file playing is read from its buffer: the bytes are there, or
        // being fetched once for both. Not for the player's read-ahead: these
        // reads do not move it.
        const playing = findOpenRemote(source);
        if (playing) return new MediaBunny.Input({ source: createBufferedSource(playing), formats: MediaBunny.ALL_FORMATS });
        return new MediaBunny.Input({ source: new MediaBunny.UrlSource(source, { fetchFn: mediaFetchFn(label) }), formats: [...MediaBunny.HLS_FORMATS, ...MediaBunny.ALL_FORMATS] });
    }
    return new MediaBunny.Input({ source: new MediaBunny.BlobSource(source), formats: MediaBunny.ALL_FORMATS });
}

/**
 * The encoding quality for a transcode, as a Mediabunny Quality.
 *
 * When the source bitrate is known, the output gets that share of it -- the
 * "respective to the video" behaviour, which a quality level alone cannot
 * express. When it is not known, the share becomes a Mediabunny quality level
 * instead, which sizes the bitrate for the codec and resolution actually being
 * encoded rather than a fixed 4 Mbps at 720p for every codec.
 *
 * @param {'high'|'medium'|'low'|number} quality - a preset, or 0..100
 * @param {number} sourceBitrate - bits per second, already scaled to the
 *   output's pixel count; 0 when unknown
 * @returns {{ quality: Object, bitrate: number|null }} bitrate is set only
 *   when one was chosen here, so it can be logged
 */
export function chooseQuality(quality, sourceBitrate = 0) {
    let q = 100;
    if (typeof quality === 'number') {
        q = quality;
    } else if (quality === 'medium') {
        q = 60;
    } else if (quality === 'low') {
        q = 30;
    }
    const fraction = Math.min(1, Math.max(0, q / 100));

    if (sourceBitrate > 0) {
        // Floored, because Mediabunny rejects a bitrate of zero, which a
        // quality of 0 or a tiny source would otherwise produce.
        const bitrate = Math.max(MIN_VIDEO_BITRATE, Math.floor(sourceBitrate * fraction));
        return { quality: new MediaBunny.Quality({ bitrate }), bitrate };
    }
    // Scaled so 100% lands on 'high', the level a transcode at 100% gets
    // (it skips bitrate control and takes the Conversion's default). Mapped
    // straight across instead, 90% would sit above 'high' and give a bigger
    // file than 100%.
    return { quality: new MediaBunny.Quality(fraction * QUALITY_LEVEL_HIGH), bitrate: null };
}

/** Where 'high' sits on Mediabunny's 0..1 quality scale. */
const QUALITY_LEVEL_HIGH = 0.75;

/** The least a video is given: watchable at small sizes, never zero. */
const MIN_VIDEO_BITRATE = 100_000;
