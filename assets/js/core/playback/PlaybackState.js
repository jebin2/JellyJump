import { Logger } from '../../utils/Logger.js';


export function getPlayerPlaybackTime(player) {
    if (player.isStreamMode && player.streamVideo) {
        return player.streamVideo.currentTime;
    }

    if (player._vodAnchorWall !== undefined && player._vodAnchorContent !== undefined && player.audioContext) {
        const elapsed = player.audioContext.currentTime - player._vodAnchorWall;
        const newPosition = player._vodAnchorContent + elapsed;
        if (newPosition >= player._vodAnchorContent - 0.1) {
            return newPosition;
        }
        return player._vodAnchorContent;
    }

    if (player.isPlaying && player.fallbackStartTime !== undefined) {
        const elapsedRealTime = (performance.now() - player.fallbackStartTime) / 1000;
        return elapsedRealTime * player.playbackRate + player.playbackTimeAtStart;
    }

    return player.playbackTimeAtStart;
}

export async function handlePlayerVisibilityChange(player) {
    if (player.isStreamMode) return;
    if (!player.isPlaying) return;

    if (document.hidden) {
        player._wasHiddenWhilePlaying = true;
        Logger.log(`[Visibility] Tab hidden at playback time: ${player._getPlaybackTime().toFixed(2)}s`);
    } else if (player._wasHiddenWhilePlaying) {
        player._setLoading(true);
        if (player.isLive && player.videoTrack) {
            const currentLiveEdge = await player.videoTrack.getDurationFromMetadata({ skipLiveWait: true });
            player._liveStartTimestamp = currentLiveEdge ?? 0;
            Logger.log(`[Visibility:Visible:Live] Live edge ${currentLiveEdge?.toFixed(3)}`);
            player._startLiveVideoLoop();
        } else if (player.isLive) {
            player._startLiveVideoLoop();
        } else {
            const currentTime = player._getPlaybackTime();
            Logger.log(`[Visibility] Tab visible, syncing video to: ${currentTime.toFixed(2)}s`);
            player._startVideoIterator();
        }

        player._wasHiddenWhilePlaying = false;
    }
}

export function togglePlayerPlay(player) {
    if (player._wasMutedForAutoplay && player.gainNode) {
        Logger.log('[Autoplay] Play button pressed, restoring audio...');
        player.config.muted = false;
        player.gainNode.gain.value = player.config.volume;
        player._wasMutedForAutoplay = false;
        player._updateVolumeUI();
    }

    if (!player.videoTrack && !player.audioTrack && !player.isStreamMode && !player.currentVideoId) {
        if (player.onPlayRequest) {
            player.onPlayRequest();
        }
        return;
    }

    if (player.isPlaying) {
        player.pause();
    } else {
        player.play();
    }
}

export function cyclePlayerSpeed(player, direction) {
    const speeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    let index = speeds.indexOf(player.playbackRate);
    if (index === -1) index = 3;

    index += direction;
    if (index >= 0 && index < speeds.length) {
        player.setPlaybackRate(speeds[index]);
    }
}

export function stepPlayerFrame(player, direction) {
    const fps = player.frameRate || 30;
    const frameDuration = 1 / fps;
    const newTime = player.currentTime + (direction * frameDuration);
    player._seekTo(Math.max(0, Math.min(player.duration, newTime)));
}

export async function seekPlayerTo(player, time) {
    Logger.log(`[Seek] _seekTo time=${time.toFixed(3)}, vodAnchorWall=${player._vodAnchorWall?.toFixed(3)}, vodAnchorContent=${player._vodAnchorContent?.toFixed(3)}, playbackTime=${player._getPlaybackTime().toFixed(3)}`);

    player._setLoading(true);

    const wasPlaying = player.isPlaying;
    if (wasPlaying) player.pause(false);

    player.playbackTimeAtStart = Math.max(0, Math.min(player.duration, time));
    player.currentTime = player.playbackTimeAtStart;
    player._updateProgress();

    player._vodAnchorWall = undefined;
    player._vodAnchorContent = undefined;

    try {
        await player._startVideoIterator();
    } finally {
        player._setLoading(false);
    }

    if (wasPlaying && player.playbackTimeAtStart < player.duration) {
        await player.play();
    }
}

export function playerSeek(player, e) {
    const rect = player.ui.progressContainer.getBoundingClientRect();
    let pos = (e.clientX - rect.left) / rect.width;
    pos = Math.max(0, Math.min(1, pos));
    player._seekTo(pos * player.duration);
}

export function playerScrubStart(player, e) {
    player.isScrubbing = true;
    player.scrubWasPlaying = player.isPlaying;

    if (player.isPlaying) player.pause(false);

    player._seek(e);

    player._scrubMoveHandler = (e) => player._onScrubMove(e);
    player._scrubEndHandler = (e) => player._onScrubEnd(e);

    document.addEventListener('mousemove', player._scrubMoveHandler);
    document.addEventListener('mouseup', player._scrubEndHandler);
}

export function playerScrubMove(player, e) {
    if (!player.isScrubbing) return;
    e.preventDefault();
    player._seek(e);
}

export function playerScrubEnd(player, e) {
    if (!player.isScrubbing) return;

    player.isScrubbing = false;
    document.removeEventListener('mousemove', player._scrubMoveHandler);
    document.removeEventListener('mouseup', player._scrubEndHandler);

    if (player.scrubWasPlaying) player.play();
}

export function savePlayerPlaybackState(player) {
    if (!player.currentVideoId || player.duration < 1) return;

    const state = {
        videoIdentifier: player.currentVideoId,
        timestamp: player.currentTime,
        savedAt: new Date().toISOString()
    };

    try {
        localStorage.setItem(`jellyjump-state-${player.currentVideoId}`, JSON.stringify(state));
    } catch (e) {
        Logger.warn('Failed to save playback state:', e);
    }
}

export function loadPlayerPlaybackState(player) {
    if (!player.currentVideoId) return null;
    try {
        const item = localStorage.getItem(`jellyjump-state-${player.currentVideoId}`);
        return item ? JSON.parse(item) : null;
    } catch (e) {
        return null;
    }
}
