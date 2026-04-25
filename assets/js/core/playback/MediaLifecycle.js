import { MediaBunny } from '../MediaBunny.js';
import { Logger } from '../../utils/Logger.js';

export function clearPlayerCanvas(player) {
    if (player.ctx && player.canvas) {
        player.ctx.clearRect(0, 0, player.canvas.width, player.canvas.height);
    }
}

export function disposeMediaBunnyResources(player) {
    if (player.videoSink?.dispose) {
        try { player.videoSink.dispose(); } catch (e) { }
    }
    if (player.audioSink?.dispose) {
        try { player.audioSink.dispose(); } catch (e) { }
    }
    if (player.input?.dispose) {
        try { player.input.dispose(); } catch (e) { }
    }
    player.videoSink = null;
    player.audioSink = null;
    player.input = null;
}

export async function resetPlayer(player) {
    player.pause();

    if (player.isLive || player.isStreamMode) {
        player._cleanupHLS();
    }

    if (player.isAudioMode) {
        player._cleanupAudio();
    }

    clearPlayerCanvas(player);

    player.currentTime = 0;
    player.duration = 0;
    player.audioContextStartTime = null;
    player.fallbackStartTime = undefined;

    player._cleanupThumbnails();

    try {
        if (player.videoFrameIterator) {
            await player.videoFrameIterator.return();
        }
    } catch (e) { }
    try {
        if (player.audioBufferIterator) {
            await player.audioBufferIterator.return();
        }
    } catch (e) { }

    disposeMediaBunnyResources(player);

    player.videoTrack = null;
    player.audioTrack = null;
    player.videoFrameIterator = null;
    player.audioBufferIterator = null;
    player.nextFrame = null;
    player.currentVideoId = null;

    player._updateTimeDisplay();
    player._updateProgress();
    if (player.ui?.loader) player.ui.loader.style.display = 'none';

    if (player.audioContext) {
        player.activeSources.forEach(source => {
            try { source.stop(); } catch (e) { }
        });
        player.activeSources = [];
    }

    Logger.log('[Player] Reset complete - select a video to play');
}

export async function cleanupPlayerForLoad(player) {
    player._isMediaReady = false;
    player.pause(false);
    player._cleanupThumbnails();
    player._cleanupAudio();
    player._cleanupHLS();
    player.stream.resetForLoad();
    player._setWebcamModeControls(false);
    player.currentTime = 0;

    if (player.videoFrameIterator) await player.videoFrameIterator.return();
    if (player.audioIteratorCleanupPromise) await player.audioIteratorCleanupPromise;
    if (player.audioBufferIterator) await player.audioBufferIterator.return();
    player.videoFrameIterator = null;
    player.audioBufferIterator = null;
    player.nextFrame = null;
    player.asyncId++;
    player.playbackTimeAtStart = 0;
    player.audioContextStartTime = null;
    player.queuedAudioNodes.clear();
    player._vodAnchorWall = undefined;
    player._vodAnchorContent = undefined;
    player._frameSyncLogCount = 0;

    clearPlayerCanvas(player);
    player._updateTimeDisplay();
    disposeMediaBunnyResources(player);

    player.subtitleTracks = [];
    player.subtitleTrackCounter = 0;
    player.activeSubtitleTrackId = null;
    player.isSubtitlesEnabled = false;
    if (player.subtitleManager) player.subtitleManager.cues = [];
}

export async function setupPlayerMediaTracks(player, url, isHls) {
    const urlSourceOptions = player.config.withCredentials ? { requestInit: { credentials: 'include' } } : {};
    player.input = new MediaBunny.Input({
        source: new MediaBunny.UrlSource(url, urlSourceOptions),
        formats: [...MediaBunny.HLS_FORMATS, ...MediaBunny.ALL_FORMATS]
    });

    if (!isHls) {
        player.duration = await player.input.computeDuration();
        player._updateTimeDisplay();
    }

    player.videoTrack = await player.input.getPrimaryVideoTrack();
    if (player.videoTrack) {
        if (!isHls) {
            try {
                const stats = await player.videoTrack.computePacketStats();
                player.frameRate = stats.averagePacketRate || 30;
                Logger.log(`Detected frame rate: ${player.frameRate} fps`);
            } catch (e) {
                Logger.warn("Could not compute frame rate, defaulting to 30fps", e);
                player.frameRate = 30;
            }
        } else {
            player.frameRate = 30;
        }

        player.videoSink = new MediaBunny.CanvasSink(player.videoTrack, {
            poolSize: isHls ? 6 : 2,
            fit: 'contain'
        });
        player.canvas.width = await player.videoTrack.getDisplayWidth();
        player.canvas.height = await player.videoTrack.getDisplayHeight();
    } else {
        Logger.log('No video track found - enabling Audio Mode');
        player.isAudioMode = true;
        const containerRect = player.container.getBoundingClientRect();
        player.canvas.width = containerRect.width || 1280;
        player.canvas.height = containerRect.height || 720;
    }

    player.audioTrack = await player.input.getPrimaryAudioTrack();
    if (!player.audioTrack) {
        const audioTracks = await player.input.getAudioTracks();
        if (audioTracks.length > 0) player.audioTrack = audioTracks[0];
    }

    if (player.audioTrack) {
        player.audioSink = new MediaBunny.AudioSampleSink(player.audioTrack);
    }

    player._updateAudioTracks();
}

export async function handlePlayerHlsState(player) {
    player.isLive = player.videoTrack ? await player.videoTrack.isLive() : false;
    Logger.log(`[Live:Load] isLive=${player.isLive}, videoTrack=${!!player.videoTrack}, audioTrack=${!!player.audioTrack}, audioSink=${!!player.audioSink}`);

    if (player.isLive) {
        const [currentDur, refreshInterval] = await Promise.all([
            player.videoTrack.getDurationFromMetadata({ skipLiveWait: true }),
            player.videoTrack.getLiveRefreshInterval(),
        ]);
        player._liveStartTimestamp = currentDur ?? 0;
        Logger.log(`[Live:Load] liveStartTs=${player._liveStartTimestamp.toFixed(3)}, liveEdge=${(currentDur ?? 0).toFixed(3)}, refreshInterval=${refreshInterval ?? 6}s`);
        player.duration = 0;
    } else {
        player._liveStartTimestamp = null;
        player.duration = await player.input.getDurationFromMetadata() ?? 0;
        Logger.log(`[Live:Load] VOD duration=${player.duration.toFixed(3)}s`);
    }

    player._updateTimeDisplay();
    player._updateStreamUI();
}

export function cleanupPlayerAudioMode(player) {
    player.isAudioMode = false;

    if (player.audioVisualizer) {
        player.audioVisualizer.disconnect();
        player.audioVisualizer = null;
    }
}

export function resetPlayerUI(player) {
    clearPlayerCanvas(player);
    player.currentTime = 0;
    player.duration = 0;
    player._updateTimeDisplay();
    player._updateProgress();
}

export async function cleanupPlayerMediaBunny(player) {
    try {
        if (player.videoFrameIterator) {
            await player.videoFrameIterator.return();
        }
    } catch (e) { }
    player.videoFrameIterator = null;

    try {
        if (player.audioBufferIterator) {
            await player.audioBufferIterator.return();
        }
    } catch (e) { }
    player.audioBufferIterator = null;

    disposeMediaBunnyResources(player);

    player.videoTrack = null;
    player.audioTrack = null;
    player.nextFrame = null;
}
