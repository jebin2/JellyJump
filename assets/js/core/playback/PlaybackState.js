import { Logger } from '../../shared/utils/Logger.js';


export function getPlayerPlaybackTime(player) {
    // The element is the clock when it is the one playing: reading anything
    // else would drift away from the audio the user is actually hearing.
    if (player.engine === 'native' && player.native) {
        return player.native.getTime();
    }

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

/**
 * The current item is over: stop, sit exactly on the end, and tell whoever is
 * listening — which is how the playlist advances.
 *
 * Shared with the render loop rather than living only there. Reaching the end
 * by playing into it and reaching it by seeking to it are the same event, and
 * when only the loop knew about it a seek to the end wedged: playback was not
 * resumed (there is nothing left to play) and nothing ended the item either, so
 * it sat paused on the last frame. The next play() then saw a position at the
 * end and restarted from zero, which is what that looked like from outside.
 */
export function completePlayerMedia(player) {
    // 'one' means repeat this item, so the end is not an end at all.
    if (player.loopMode === 'one') {
        player._seekTo(0);
        return;
    }

    player.pause();
    player.playbackTimeAtStart = player.duration;
    player.currentTime = player.duration;
    player._updateProgress();
    if (player.onEnded) player.onEnded();
}

export async function seekPlayerTo(player, time) {
    Logger.log(`[Seek] _seekTo time=${time.toFixed(3)}, vodAnchorWall=${player._vodAnchorWall?.toFixed(3)}, vodAnchorContent=${player._vodAnchorContent?.toFixed(3)}, playbackTime=${player._getPlaybackTime().toFixed(3)}`);

    player._setLoading(true);

    const wasPlaying = player.isPlaying;
    if (wasPlaying) player.pause(false);

    // Re-resume the context NOW, while still inside the tap's user-gesture
    // window. pause() suspends it, and by the time play() tries to resume
    // (after the async iterator rebuild), iOS no longer counts the tap as
    // a gesture - resume stalls, the timeout fallback auto-mutes, and the
    // video resumes silent until the next tap restores it.
    // NOT gated on wasPlaying: bar seeks arrive here from playerScrubStart,
    // which already paused (so wasPlaying is false) - the context still
    // needs waking for the play() that playerScrubEnd issues. Resuming a
    // running context is a no-op, and with playback paused there are no
    // scheduled buffers, so this can't make a paused player audible.
    if (player.audioContext) {
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

    // Seeking to the end of something that was playing ends it, exactly as
    // playing into the end would. There is nothing left to resume, and the
    // render loop cannot notice on its own because it only checks while
    // playing — which this no longer is.
    const landedAtEnd = !player.isLive
        && player.duration > 0
        && player.playbackTimeAtStart >= player.duration;

    if (wasPlaying && landedAtEnd) {
        // Anything still queued belongs to the item being left, not to whatever
        // the playlist moves on to.
        player._pendingSeekTime = null;
        completePlayerMedia(player);
        return;
    }

    if (wasPlaying) {
        await player.play();
    }
}

/**
 * Seek to a position that may be superseded before it lands.
 *
 * Every _seekTo tears down and rebuilds the video iterator — a decoder spin-up
 * from the nearest key frame — which takes far longer than the gap between
 * repeat events from a held arrow key or a dragged scrub bar. Firing one per
 * event floods the pipeline with concurrent decoders and, worse, leaves a
 * backlog that keeps landing after the input stops: the video goes on
 * forwarding for a moment after the key is released.
 *
 * So only the newest requested position is kept, and seeks run one at a time.
 * A held key settles on its final position one seek after release instead of
 * replaying every step of the hold.
 */
export function requestPlayerSeek(player, time) {
    const target = Math.max(0, Math.min(player.duration, time));

    // Move the clock and the bar now. The decode is coalesced, so without this
    // the position would sit still for the whole hold and then jump — and each
    // repeat would measure its step from a stale currentTime, so holding the
    // key would crawl instead of scanning.
    player._pendingSeekTime = target;
    player.currentTime = target;
    player._updateProgress();

    if (player._seekLoopActive) return;
    player._seekLoopActive = true;
    (async () => {
        try {
            while (player._pendingSeekTime != null) {
                const next = player._pendingSeekTime;
                player._pendingSeekTime = null;
                await player._seekTo(next);
            }
        } finally {
            player._seekLoopActive = false;
        }
    })();
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

    // Wake the context pause() just suspended while we are guaranteed to be
    // inside the input event (scrub start is always user input), so the
    // play() on scrub end finds it running instead of stalling on iOS.
    if (player.scrubWasPlaying && player.audioContext) {
        player.audioContext.resume().catch(() => { });
    }

    player._seek(e);

    player._scrubMoveHandler = (e) => player._onScrubMove(e);
    player._scrubEndHandler = (e) => player._onScrubEnd(e);

    document.addEventListener('mousemove', player._scrubMoveHandler);
    document.addEventListener('mouseup', player._scrubEndHandler);
}

export function playerScrubMove(player, e) {
    if (!player.isScrubbing) return;
    e.preventDefault();

    const rect = player.ui.progressContainer.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    requestPlayerSeek(player, pos * player.duration);
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
