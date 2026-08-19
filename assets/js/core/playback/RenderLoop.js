import { Logger } from '../../shared/utils/Logger.js';

export async function updatePlayerNextFrame(player) {
    if (player._isFetchingFrame || !player.videoFrameIterator) return;
    
    const currentAsyncId = player.asyncId;
    const currentIterator = player.videoFrameIterator;
    player._isFetchingFrame = true;

    // The newest frame the loop skipped for being behind the clock, kept so the
    // canvas can be brought up to date once without showing the ones before it.
    let lateFrame = null;

    try {
        while (true) {
            // Re-check conditions after each potential await
            if (!player.videoFrameIterator || player.videoFrameIterator !== currentIterator || player.asyncId !== currentAsyncId) break;
            
            const result = await currentIterator.next();
            if (player.asyncId !== currentAsyncId || player.videoFrameIterator !== currentIterator) break;
            
            if (result.done) {
                Logger.log(`[FrameSync] Iterator finished (asyncId=${currentAsyncId})`);
                if (player.videoFrameIterator === currentIterator) {
                    player.videoFrameIterator = null; 
                }
                break;
            }

            const newNextFrame = result.value ?? null;
            if (!newNextFrame) {
                // Iterator might be temporarily empty, wait a bit
                await new Promise(r => setTimeout(r, 10));
                continue; 
            }

            if (!player._hasSnappedAnchor && player.isLive) {
                player._liveAnchorContent = newNextFrame.timestamp;
                player._hasSnappedAnchor = true;
                Logger.log(`[Live] Anchor snapped to first frame ts=${newNextFrame.timestamp.toFixed(3)}`);
            }

            const playbackTime = player._getPlaybackTime();
            if (newNextFrame.timestamp <= playbackTime) {
                // Late frame: skip it. Held rather than drawn — painting every
                // frame on the way past is what a fast-forward looks like, and
                // when the iterator is far behind (after a seek) that is a
                // visible scrub through everything in between. Only the last
                // one is worth showing, and only if nothing current turns up.
                lateFrame = newNextFrame;

                if (!player._isMediaReady) {
                    player._isMediaReady = true;
                    if (player.isPlaying) player._resumeRecordingSmartPause();
                }
            } else {
                player.nextFrame = newNextFrame;
                break;
            }
        }

        // Nothing current to show, but the loop went past something: paint the
        // last one so the canvas lands on the caught-up picture rather than
        // holding whatever was there before. Skipped when a current frame was
        // found — the render loop is about to draw that instead.
        if (lateFrame && !player.nextFrame && player.asyncId === currentAsyncId
            && player.ctx && player.canvas) {
            player.ctx.clearRect(0, 0, player.canvas.width, player.canvas.height);
            player.ctx.drawImage(lateFrame.canvas, 0, 0, player.canvas.width, player.canvas.height);
            player.afterFrameRenderCallbacks.forEach(cb => cb(player.canvas, player.ctx));
        }
    } catch (e) {
        if (player.asyncId === currentAsyncId) {
            if (e?.name === 'QuotaExceededError' || e?.message?.includes('Codec reclaimed')) {
                Logger.warn('[FrameSync] Codec reclaimed, restarting video iterator:', e);
                player.videoFrameIterator = null;
                player.nextFrame = null;
                player._startVideoIterator();
            } else {
                Logger.error('[FrameSync] Iterator error:', e);
            }
        }
    } finally {
        if (player.asyncId === currentAsyncId) {
            player._isFetchingFrame = false;
        }
    }
}

export function startPlayerRenderLoop(player) {
    if (player.animationFrameId) return;

    const loop = () => {
        if (player.isPlaying) {
            const playbackTime = player._getPlaybackTime();
            player.currentTime = playbackTime;

            if (player._frameSyncLogCount === undefined) player._frameSyncLogCount = 0;
            player._frameSyncLogCount++;
            if (player._frameSyncLogCount % 60 === 0 && player._vodAnchorWall !== undefined && !player.isLive) {
                const nextTs = player.nextFrame?.timestamp;
                const drift = nextTs !== undefined ? ((nextTs - playbackTime) * 1000).toFixed(0) : 'n/a';
                Logger.log(`[FrameSync] frame=${player._frameSyncLogCount}, playback=${playbackTime.toFixed(3)}, nextFrameTs=${nextTs?.toFixed(3) ?? 'none'}, drift=${drift}ms, audioCtx=${player.audioContext?.currentTime?.toFixed(3)}`);
            }

            player.trigger('timeupdate', { currentTime: player.currentTime });

            if (!player.isLive && player.duration > 0 && playbackTime >= player.duration) {
                if (player.loopMode === 'one') {
                    player._seekTo(0);
                    return; // _seekTo resumes playback and restarts this loop
                }
                // Reached the end: stop and notify (playlist auto-advances)
                player.pause();
                player.playbackTimeAtStart = player.duration;
                player.currentTime = player.duration;
                player._updateProgress();
                if (player.onEnded) player.onEnded();
                return; // pause stopped the loop; play() restarts it
            }

            // Loop A-B: jump back to start marker when reaching the end marker
            if (!player.isLive && player.loopMode === 'one' && player.loopStart !== null && player.loopEnd !== null) {
                if (playbackTime >= player.loopEnd) {
                    player._seekTo(player.loopStart);
                    return; // _seekTo resumes playback and restarts this loop
                }
            }

            if (!player.isLive && !player.nextFrame && player.videoFrameIterator) {
                player._updateNextFrame();
            }

            if (player.nextFrame) {
                if (player.nextFrame.timestamp <= playbackTime) {
                    player.ctx.clearRect(0, 0, player.canvas.width, player.canvas.height);
                    player.ctx.drawImage(player.nextFrame.canvas, 0, 0, player.canvas.width, player.canvas.height);

                    if (player.afterFrameRenderCallbacks.length > 0) {
                        player.afterFrameRenderCallbacks.forEach(cb => cb(player.canvas, player.ctx));
                    }

                    player.nextFrame = null;
                    player._updateNextFrame();
                } else if (!player.isLive && player.nextFrame.timestamp > playbackTime + 1.0) {
                    // Insane drift: video is way ahead of audio (VOD only).
                    if (player._frameSyncLogCount % 60 === 0) {
                        Logger.warn(`[FrameSync] Video way ahead of audio (nextFrame=${player.nextFrame.timestamp.toFixed(3)}, playback=${playbackTime.toFixed(3)}). Re-seeking video iterator.`);
                    }
                    player.nextFrame = null;
                    player._startVideoIterator();
                }
            }

            player._updateProgress();

            if (player.isSubtitlesEnabled) {
                player._renderSubtitles(playbackTime);
            }
        }

        player.animationFrameId = requestAnimationFrame(loop);
    };

    player.animationFrameId = requestAnimationFrame(loop);
}
