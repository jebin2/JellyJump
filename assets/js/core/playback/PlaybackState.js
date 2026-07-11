import { Logger } from '../../shared/utils/Logger.js';


export function getPlayerPlaybackTime(player) {
    if (player.isStreamMode && player.streamVideo) {
        return player.streamVideo.currentTime;
    }

    const isLive = player.isLive;
    const anchorWall = isLive ? player.stream?._liveAnchorWall : player._vodAnchorWall;
    const anchorContent = isLive ? player.stream?._liveAnchorContent : player._vodAnchorContent;

    if (anchorWall !== undefined && anchorContent !== undefined && player.audioContext && player.audioContext.state === 'running') {
        const elapsed = player.audioContext.currentTime - anchorWall;
        const newPosition = anchorContent + (elapsed * player.playbackRate);
        if (newPosition >= anchorContent - 0.1) {
            return newPosition;
        }
        return anchorContent;
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
        if (!player.isLive) {
            player._setLoading(true);
            const currentTime = player._getPlaybackTime();
            Logger.log(`[Visibility] Tab visible, syncing VOD video to: ${currentTime.toFixed(2)}s`);
            await player._startVideoIterator();
            player._setLoading(false);
        } else {
            // For LIVE streams, we don't restart the loop or jump to the edge.
            // Our catch-up logic in PlayerStream handles syncing automatically
            // by skipping frames until we are back in line with the audio clock.
            Logger.log('[Visibility] Tab visible, allowing Live loop to catch up naturally');
        }

        player._wasHiddenWhilePlaying = false;
    }
}

export function togglePlayerPlay(player) {
    player._restoreAutoplayAudio('Play button pressed');

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

    // Re-resume the context NOW, while still inside the tap's user-gesture
    // window. pause() suspends it, and by the time play() below tries to
    // resume (after the async iterator rebuild), iOS no longer counts the
    // tap as a gesture - resume stalls, the timeout fallback auto-mutes,
    // and the video resumes silent until a manual pause/play.
    if (wasPlaying && player.audioContext && player.audioContext.state !== 'running') {
        player.audioContext.resume().catch(() => { });
    }

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

    // Coalesce scrub seeks: every seek tears down and rebuilds the video
    // iterator (a decoder spin-up from the nearest key frame), so running one
    // per mousemove floods the pipeline with concurrent decoders. Remember
    // only the newest requested position and seek serially.
    const rect = player.ui.progressContainer.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    player._pendingScrubTime = pos * player.duration;

    if (player._scrubSeekActive) return;
    player._scrubSeekActive = true;
    (async () => {
        try {
            while (player._pendingScrubTime != null) {
                const time = player._pendingScrubTime;
                player._pendingScrubTime = null;
                await player._seekTo(time);
            }
        } finally {
            player._scrubSeekActive = false;
        }
    })();
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
