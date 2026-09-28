import { MediaBunny } from '../../core/MediaBunny.js';

export const AUDIO_BITRATE_BPS = 128000;

export function createMediaBunnyInput(source) {
    if (typeof source === 'string') {
        return new MediaBunny.Input({ source: new MediaBunny.UrlSource(source), formats: [...MediaBunny.HLS_FORMATS, ...MediaBunny.ALL_FORMATS] });
    }
    return new MediaBunny.Input({ source: new MediaBunny.BlobSource(source), formats: MediaBunny.ALL_FORMATS });
}

export function getBitrate(quality, pixelCount, sourceBitrate = 0) {
    let q = 100;
    if (typeof quality === 'number') {
        q = quality;
    } else if (quality === 'high') {
        q = 100;
    } else if (quality === 'medium') {
        q = 60;
    } else if (quality === 'low') {
        q = 30;
    }

    let targetBitrate;
    if (sourceBitrate > 0) {
        targetBitrate = sourceBitrate * (q / 100);
    } else {
        const basePixels = 1280 * 720;
        const standardBitrate = 4000000;
        const pixelFactor = pixelCount > 0 ? pixelCount / basePixels : 1;
        targetBitrate = standardBitrate * pixelFactor * (q / 100);
    }

    return Math.floor(targetBitrate);
}
