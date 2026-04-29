import { Logger } from '../../shared/utils/Logger.js';
import { MediaBunny } from '../../core/MediaBunny.js';
import { createMediaBunnyInput } from '../shared/InputFactory.js';

async function getTrackDetails(input) {
    const videoTracks = await input.getVideoTracks();
    const audioTracks = await input.getAudioTracks();

    const formatTrackInfo = async (tracks) => {
        return Promise.all(tracks.map(async (track) => {
            const duration = await track.computeDuration();
            const codecString = await track.getCodecParameterString();
            return {
                id: track.id,
                type: track.type,
                language: track.languageCode,
                codec: track.codec,
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

export async function getMetadata(source) {
    const input = createMediaBunnyInput(source);

    try {
        const { video, audio } = await getTrackDetails(input);

        let videoInfo = null;
        let audioInfo = null;
        let duration = 0;

        if (video && video.length > 0) {
            const videoTrackInfo = video[0];
            const videoTrack = videoTrackInfo._track;
            duration = videoTrackInfo.duration;

            videoInfo = {
                width: videoTrackInfo.width,
                height: videoTrackInfo.height,
                displayWidth: videoTrack.displayWidth,
                displayHeight: videoTrack.displayHeight,
                codedWidth: videoTrack.codedWidth,
                codedHeight: videoTrack.codedHeight,
                codec: videoTrackInfo.codec,
                rotation: videoTrack.rotation || 0,
                hasHDR: false
            };

            try {
                const stats = await videoTrack.computePacketStats(50);
                videoInfo.fps = Math.round(stats.averagePacketRate);
                videoInfo.bitrate = stats.averageBitrate;
            } catch (e) {
                Logger.warn('Failed to compute packet stats:', e);
                videoInfo.fps = 0;
                videoInfo.bitrate = 0;
            }
        }

        if (audio && audio.length > 0) {
            const audioTrackInfo = audio[0];
            if (!duration) duration = audioTrackInfo.duration;

            audioInfo = {
                codec: audioTrackInfo.codec,
                channels: audioTrackInfo.channels,
                sampleRate: audioTrackInfo.sampleRate,
                languageCode: audioTrackInfo.language
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
