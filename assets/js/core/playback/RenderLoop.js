import { Logger } from '../../shared/utils/Logger.js';
import { getPlayerPlaybackTime, completePlayerMedia } from './PlaybackState.js';
import { startPlayerVideoIterator } from './VideoIterator.js';
import { checkPlayerBuffering, isPlayerStalled, noteFramePresented, noteFrameLag, notePlaybackStarted } from './BufferingGuard.js';

/** Frames drawn since the media loaded, per player, for a sync log every 60. @type {WeakMap<object, number>} */
const frameSyncLogCount = new WeakMap();
/** Start the sync log's count again (a new media). @param {object} player */
export function resetPlayerFrameSyncLog(player) { frameSyncLogCount.set(player, 0); }

// How long to leave a closed queue alone before trying to open it again, and
// how many times to bother. Spaced out because the usual reason a rebuild gave
// up is that the source is slow, and hammering it would not help.
const REOPEN_DELAY_MS = 2000;
const REOPEN_ATTEMPTS = 3;

/**
 * Put the video back when a rebuild gave up under a running player.
 *
 * Abandoning a wedged iterator leaves the queue closed, and the pump above
 * refuses to run on a closed queue -- so without this the audio carries on
 * alone and the picture stays frozen until the person happens to seek, which
 * is exactly what a slow remote source produced: the spinner cleared, the
 * sound came back, and the video sat still. A few spaced-out attempts, then it
 * stops rather than retrying for ever behind a source that is simply gone.
 */
function _reopenClosedQueue(player) {
    if (player.frameReopen.timer || !player.isPlaying || player.isLive) return;
    if (player.frameReopen.attempts >= REOPEN_ATTEMPTS) return;
    player.frameReopen.attempts = player.frameReopen.attempts + 1;
    Logger.warn(`[FrameSync] The frame queue is closed while playing — reopening `
        + `(attempt ${player.frameReopen.attempts}/${REOPEN_ATTEMPTS})`);
    // player.reopenDelayMs overrides the wait, which is how the suite exercises
    // this inside a two-second fixture.
    player.frameReopen.timer = setTimeout(() => {
        player.frameReopen.timer = null;
        if (!player.frames.isOpen && player.isPlaying) startPlayerVideoIterator(player);
    }, player.reopenDelayMs ?? REOPEN_DELAY_MS);
}

export async function updatePlayerNextFrame(player) {
    if (player.frames.isFetching || !player.frames.isOpen) return;
    // Pumping again, so a later closure starts counting from scratch.
    player.frameReopen.attempts = 0;
    
    const epoch = player.epoch.current;
    const currentIterator = player.frames.iterator;
    player.frames.beginFetch();

    // The newest frame the loop skipped for being behind the clock, kept so the
    // canvas can be brought up to date once without showing the ones before it.
    let lateFrame = null;

    try {
        while (true) {
            // Re-check conditions after each potential await
            if (!player.frames.holds(currentIterator) || player.epoch.isStale(epoch)) break;
            
            const result = await currentIterator.next();
            if (player.epoch.isStale(epoch) || !player.frames.holds(currentIterator)) break;
            
            if (result.done) {
                Logger.log(`[FrameSync] Iterator finished (epoch=${epoch})`);
                if (player.frames.holds(currentIterator)) {
                    player.frames.dropIterator();
                }
                break;
            }

            const newNextFrame = result.value ?? null;
            if (!newNextFrame) {
                // Iterator might be temporarily empty, wait a bit
                await new Promise(r => setTimeout(r, 10));
                continue; 
            }

            const playbackTime = getPlayerPlaybackTime(player);
            if (newNextFrame.timestamp <= playbackTime) {
                noteFrameLag(player, playbackTime - newNextFrame.timestamp);
                // Late frame: skip it. Held rather than drawn — painting every
                // frame on the way past is what a fast-forward looks like, and
                // when the iterator is far behind (after a seek) that is a
                // visible scrub through everything in between. Only the last
                // one is worth showing, and only if nothing current turns up.
                lateFrame = newNextFrame;
                player.timing?.lateFrame();

                if (!player.stream?.isMediaReady) {
                    player.stream.isMediaReady = true;
                    if (player.isPlaying) player.stream?.resumeRecordingSmartPause();
                }
            } else {
                noteFrameLag(player, 0);
                player.frames.setPending(newNextFrame);
                break;
            }
        }

        // Nothing current to show, but the loop went past something: paint the
        // last one so the canvas lands on the caught-up picture rather than
        // holding whatever was there before. Skipped when a current frame was
        // found — the render loop is about to draw that instead.
        if (lateFrame && !player.frames.pending && !player.epoch.isStale(epoch)
            && player.ctx && player.canvas) {
            player.presentFrame(lateFrame.canvas, { clear: true });
            noteFramePresented(player);
        }
    } catch (e) {
        if (!player.epoch.isStale(epoch)) {
            if (e?.name === 'QuotaExceededError' || e?.message?.includes('Codec reclaimed')) {
                Logger.warn('[FrameSync] Codec reclaimed, restarting video iterator:', e);
                player.frames.discard();
                startPlayerVideoIterator(player);
            } else {
                Logger.error('[FrameSync] Iterator error:', e);
            }
        }
    } finally {
        player.frames.endFetch(epoch);
    }
}

export function startPlayerRenderLoop(player) {
    if (player.animationFrameId) return;
    // Counted from here: the frame shown before a seek is not a gap.
    notePlaybackStarted(player);

    const loop = () => {
        if (player.isPlaying) {
            const playbackTime = getPlayerPlaybackTime(player);
            player.currentTime = playbackTime;
            checkPlayerBuffering(player);

            const frameSyncCount = (frameSyncLogCount.get(player) ?? 0) + 1;
            frameSyncLogCount.set(player, frameSyncCount);
            // Not while waiting for data: the same line every second, which
            // filled most of a saved log (the wait has its own lines).
            if (frameSyncCount % 60 === 0 && player.vodAnchor.isAnchored && !player.isLive && !isPlayerStalled(player)) {
                const nextTs = player.frames.pending?.timestamp;
                const drift = nextTs !== undefined ? ((nextTs - playbackTime) * 1000).toFixed(0) : 'n/a';
                Logger.log(`[FrameSync] frame=${frameSyncCount}, playback=${playbackTime.toFixed(3)}, nextFrameTs=${nextTs?.toFixed(3) ?? 'none'}, drift=${drift}ms, audioCtx=${player.audioContext?.currentTime?.toFixed(3)}`);
            }

            player.trigger('timeupdate', { currentTime: player.currentTime });

            if (!player.isLive && player.duration > 0 && playbackTime >= player.duration) {
                // Same completion a seek to the end goes through, so both ways
                // of arriving there behave identically. It stops the loop
                // either way: pause() for a real end, seek for loop-one.
                completePlayerMedia(player);
                return;
            }

            // Loop A-B: jump back to start marker when reaching the end marker
            if (!player.isLive && player.loopMode === 'one' && player.loopStart !== null && player.loopEnd !== null) {
                if (playbackTime >= player.loopEnd) {
                    player.seek(player.loopStart);
                    return; // seek resumes playback and restarts this loop
                }
            }

            if (!player.isLive && !player.frames.pending) {
                if (player.frames.isOpen) updatePlayerNextFrame(player);
                // A rebuild that gave up leaves the queue closed, and the pump
                // will not run on one — so the picture would stay frozen under
                // a player that is otherwise still going.
                else _reopenClosedQueue(player);
            }

            if (player.frames.pending) {
                if (player.frames.pending.timestamp <= playbackTime) {
                    player.presentFrame(player.frames.pending.canvas, { clear: true });
                    noteFramePresented(player);

                    player.frames.clearPending();
                    updatePlayerNextFrame(player);
                } else if (!player.isLive && player.frames.pending.timestamp > playbackTime + 1.0) {
                    // Insane drift: video is way ahead of audio (VOD only).
                    if (frameSyncCount % 60 === 0) {
                        Logger.warn(`[FrameSync] Video way ahead of audio (pending=${player.frames.pending.timestamp.toFixed(3)}, playback=${playbackTime.toFixed(3)}). Re-seeking video iterator.`);
                    }
                    player.frames.clearPending();
                    startPlayerVideoIterator(player);
                }
            }

            player.announce.progress();

            if (player.subtitles.enabled) {
                player.subtitles?.renderSubtitles(playbackTime);
            }
        }

        player.animationFrameId = requestAnimationFrame(loop);
    };

    player.animationFrameId = requestAnimationFrame(loop);
}
