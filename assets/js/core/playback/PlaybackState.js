import { saveProgress, loadProgress } from '../../shared/settings/Progress.js';
import { isPlayerStalled } from './BufferingGuard.js';
import { Logger } from '../../shared/utils/Logger.js';
import { startPlayerVideoIterator } from './VideoIterator.js';

/** Players whose tab was hidden while they played, to resync on return. @type {WeakSet<object>} */
const hiddenWhilePlaying = new WeakSet();
/** The document listeners a scrub added, per player, for its end. @type {WeakMap<object, {move: EventListener, end: EventListener}>} */
const scrubHandlers = new WeakMap();

export function getPlayerPlaybackTime(player) {
    if (player.isStreamMode && player.streamVideo) {
        return player.streamVideo.currentTime;
    }

    const anchor = player.isLive ? player.stream?.anchor : player.vodAnchor;

    // Held while waiting for data (BufferingGuard): the context is suspended
    // then, so its time, and with it the position, stand still.
    if (anchor?.isAnchored && player.audioContext
        && (player.audioContext.state === 'running' || isPlayerStalled(player))) {
        return anchor.positionAt(player.audioContext.currentTime, player.playbackRate);
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
        hiddenWhilePlaying.add(player);
        Logger.log(`[Visibility] Tab hidden at playback time: ${getPlayerPlaybackTime(player).toFixed(2)}s`);
    } else if (hiddenWhilePlaying.has(player)) {
        if (!player.isLive) {
            player.setLoading(true);
            const currentTime = getPlayerPlaybackTime(player);
            Logger.log(`[Visibility] Tab visible, syncing VOD video to: ${currentTime.toFixed(2)}s`);
            await startPlayerVideoIterator(player);
            player.setLoading(false);
        } else {
            // For LIVE streams, we don't restart the loop or jump to the edge.
            // Our catch-up logic in PlayerStream handles syncing automatically
            // by skipping frames until we are back in line with the audio clock.
            Logger.log('[Visibility] Tab visible, allowing Live loop to catch up naturally');
        }

        hiddenWhilePlaying.delete(player);
    }
}

export function togglePlayerPlay(player) {
    player.restoreAutoplayAudio('Play button pressed');

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
    // Held in editor mode this repeats at the key-repeat rate, far faster than
    // a decoder rebuild, so it goes through the coalescing path for the same
    // reason the relative-seek keys do. _requestSeek also moves currentTime
    // synchronously, so each repeat steps from the position the last one asked
    // for rather than from whatever has finished decoding.
    requestPlayerSeek(player, player.currentTime + (direction * frameDuration));
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
        player.seek(0);
        return;
    }

    player.pause();
    player.playbackTimeAtStart = player.duration;
    player.currentTime = player.duration;
    player.announce.progress();
    player.announce?.ended();
    if (player.onEnded) player.onEnded();
}

export async function seekPlayerTo(player, time) {
    Logger.log(`[Seek] seek time=${time.toFixed(3)}, vodAnchorWall=${player.vodAnchor.wall?.toFixed(3)}, vodAnchorContent=${player.vodAnchor.content?.toFixed(3)}, playbackTime=${getPlayerPlaybackTime(player).toFixed(3)}`);

    player.setLoading(true);

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
    player.announce.progress();

    player.vodAnchor.clear();

    try {
        await startPlayerVideoIterator(player);
    } finally {
        player.setLoading(false);
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
        player.seekQueue.pending = null;
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
 * Every seek tears down and rebuilds the video iterator — a decoder spin-up
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
    player.seekQueue.pending = target;
    player.currentTime = target;
    player.announce.progress();

    if (player.seekQueue.active) return;
    player.seekQueue.active = true;
    (async () => {
        try {
            while (player.seekQueue.pending != null) {
                const next = player.seekQueue.pending;
                player.seekQueue.pending = null;
                await player.seek(next);
            }
        } finally {
            player.seekQueue.active = false;
        }
    })();
}

export function playerSeek(player, e) {
    const rect = player.ui.progressContainer.getBoundingClientRect();
    let pos = (e.clientX - rect.left) / rect.width;
    pos = Math.max(0, Math.min(1, pos));
    // Clicks on the bar can land faster than a seek completes, and a bare
    // _seekTo per click runs them concurrently: the clock ends up on the last
    // click while the canvas can keep a frame decoded for an earlier one, so
    // the picture disagrees with the position it reports. Coalescing makes the
    // newest click the only one that paints.
    requestPlayerSeek(player, pos * player.duration);
}

export function playerScrubStart(player, e) {
    player.isScrubbing = true;
    // Playing backwards counts as playing: it resumes, backwards, on release.
    player.scrubWasPlaying = player.isPlaying || !!player.reverse?.active;

    if (player.scrubWasPlaying) player.pause(false);

    // Wake the context pause() just suspended while we are guaranteed to be
    // inside the input event (scrub start is always user input), so the
    // play() on scrub end finds it running instead of stalling on iOS.
    if (player.scrubWasPlaying && player.audioContext) {
        player.audioContext.resume().catch(() => { });
    }

    playerSeek(player, e);

    const handlers = {
        move: (/** @type {MouseEvent} */ e) => playerScrubMove(player, e),
        end: (/** @type {MouseEvent} */ e) => playerScrubEnd(player, e),
    };
    scrubHandlers.set(player, handlers);
    document.addEventListener('mousemove', handlers.move);
    document.addEventListener('mouseup', handlers.end);
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
    const handlers = scrubHandlers.get(player);
    scrubHandlers.delete(player);
    if (handlers) {
        document.removeEventListener('mousemove', handlers.move);
        document.removeEventListener('mouseup', handlers.end);
    }

    if (player.scrubWasPlaying) player.play();
}

export function savePlayerPlaybackState(player) {
    if (!player.currentVideoId || player.duration < 1) return;

    saveProgress(player.currentVideoId, player.currentTime);
}

export function loadPlayerPlaybackState(player) {
    const time = loadProgress(player.currentVideoId);
    return time === null ? null : { videoIdentifier: player.currentVideoId, timestamp: time };
}
