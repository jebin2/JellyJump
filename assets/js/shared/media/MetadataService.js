// @ts-check
import { Logger } from '../utils/Logger.js';
import { MediaBunny, ensureDecodersFor, codecOf } from './MediaBunny.js';
import { createMediaBunnyInput } from './InputFactory.js';

/**
 * Every track's details, read once.
 * @param {any} input - a MediaBunny Input (vendored, not type-checked)
 */
async function getTrackDetails(input) {
    const videoTracks = await input.getVideoTracks();
    const audioTracks = await input.getAudioTracks();

    // This panel reports whether each track is decodable, so the on-demand
    // decoders have to be loaded before it asks — otherwise it says no about a
    // DTS or TrueHD track the player would go on to play perfectly well.
    await ensureDecodersFor(audioTracks);

    const formatTrackInfo = async (/** @type {any[]} */ tracks) => {
        return Promise.all(tracks.map(async (/** @type {any} */ track) => {
            const duration = await track.computeDuration();
            const codecString = await track.getCodecParameterString();
            return {
                id: track.id,
                type: track.type,
                language: track.languageCode,
                codec: await codecOf(track),
                codecString,
                duration,
                width: track.width || track.displayWidth,
                height: track.height || track.displayHeight,
                displayWidth: track.displayWidth,
                displayHeight: track.displayHeight,
                codedWidth: track.codedWidth,
                codedHeight: track.codedHeight,
                rotation: track.rotation || 0,
                channels: track.numberOfChannels,
                sampleRate: track.sampleRate,
                _track: track
            };
        }));
    };

    return {
        video: await formatTrackInfo(videoTracks),
        audio: await formatTrackInfo(audioTracks)
    };
}

/**
 * A file's or address's duration, tracks, and video and audio details.
 * @param {string|Blob} source
 */
export async function getMetadata(source) {
    const input = createMediaBunnyInput(source, 'metadata');

    try {
        const { video, audio } = await getTrackDetails(input);

        /** @type {import('../types.js').VideoInfo|null} */
        let videoInfo = null;
        let audioInfo = null;
        let duration = 0;

        if (video && video.length > 0) {
            const videoTrackInfo = video[0];
            const videoTrack = videoTrackInfo._track;
            duration = videoTrackInfo.duration;

            /** @type {import('../types.js').VideoInfo} */
            const info = {
                width: videoTrackInfo.width,
                height: videoTrackInfo.height,
                displayWidth: videoTrack.displayWidth,
                displayHeight: videoTrack.displayHeight,
                codedWidth: videoTrack.codedWidth,
                codedHeight: videoTrack.codedHeight,
                codec: videoTrackInfo.codec,
                rotation: videoTrack.rotation || 0,
                // Asked here rather than left for the Info panel to find out:
                // the panel falls back to this value whenever its own read of
                // the file fails, and a hardcoded false then said "No" for
                // every HDR file. It reads only the track's colour metadata, so
                // it costs nothing like the packet scan below. (Before
                // mediabunny 1.66 it also called wide-gamut SDR HDR.)
                hasHDR: await videoTrack.hasHighDynamicRange().catch(() => false),
                // Whether this browser can actually decode it. Determined here
                // because the track is already open — asking later would mean
                // reopening the file just to answer it. HEVC is the common case:
                // the desktop lists it happily and nothing can play it.
                decodable: await videoTrack.canDecode().catch(() => false)
            };

            try {
                const stats = await videoTrack.computePacketStats(50);
                info.fps = Math.round(stats.averagePacketRate);
                info.bitrate = stats.averageBitrate;
            } catch (e) {
                Logger.warn('Failed to compute packet stats:', e);
                info.fps = 0;
                info.bitrate = 0;
            }
            videoInfo = info;
        }

        if (audio && audio.length > 0) {
            const audioTrackInfo = audio[0];
            if (!duration) duration = audioTrackInfo.duration;

            audioInfo = {
                codec: audioTrackInfo.codec,
                channels: audioTrackInfo.channels,
                sampleRate: audioTrackInfo.sampleRate,
                languageCode: audioTrackInfo.language,
                // Undecodable audio is not fatal — the video still plays silent,
                // and the player already falls back to another track when there
                // is one — so this is reported rather than treated as an error.
                decodable: await audioTrackInfo._track?.canDecode().catch(() => false) ?? false
            };
        }

        const videoTracks = video.map(({ _track, ...rest }) => rest);
        const audioTracks = audio.map(({ _track, ...rest }) => rest);

        return { videoInfo, audioInfo, duration, videoTracks, audioTracks };
    } finally {
        if (input && typeof input.dispose === 'function') {
            try { input.dispose(); } catch (e) { Logger.warn('Error disposing input in getMetadata:', e); }
        }
    }
}

/**
 * Frame rate and bitrate of a file's video, from its first `count` packets.
 * @param {Blob} source
 * @param {number} [count]
 */
export async function getVideoStats(source, count = 50) {
    const blobSource = new MediaBunny.BlobSource(source);
    const input = new MediaBunny.Input({ source: blobSource, formats: MediaBunny.ALL_FORMATS });

    try {
        const videoTrack = await input.getPrimaryVideoTrack();
        if (!videoTrack) return null;
        return await videoTrack.computePacketStats(count);
    } finally {
        if (input && typeof input.dispose === 'function') {
            try { input.dispose(); } catch (e) { Logger.warn('Error disposing input in getVideoStats:', e); }
        }
    }
}
