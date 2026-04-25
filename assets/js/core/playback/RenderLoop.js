import { Logger } from '../../utils/Logger.js';

export async function updatePlayerNextFrame(player) {
    const currentAsyncId = player.asyncId;

    while (true) {
        if (!player.videoFrameIterator) break;
        const result = await player.videoFrameIterator.next();
        const newNextFrame = result.value ?? null;

        if (!newNextFrame) break;
        if (currentAsyncId !== player.asyncId) break;

        const playbackTime = player._getPlaybackTime();
        if (newNextFrame.timestamp <= playbackTime) {
            Logger.log(`[FrameSync] Late frame: ts=${newNextFrame.timestamp.toFixed(3)}, playback=${playbackTime.toFixed(3)}, behind=${((playbackTime - newNextFrame.timestamp) * 1000).toFixed(0)}ms`);
            player.ctx.clearRect(0, 0, player.canvas.width, player.canvas.height);
            player.ctx.drawImage(newNextFrame.canvas, 0, 0, player.canvas.width, player.canvas.height);

            if (!player._isMediaReady) {
                player._isMediaReady = true;
                if (player.isPlaying) player._resumeRecordingSmartPause();
            }

            if (player.afterFrameRenderCallbacks.length > 0) {
                player.afterFrameRenderCallbacks.forEach(cb => cb(player.canvas, player.ctx));
            }
        } else {
            player.nextFrame = newNextFrame;
            break;
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

            if (!player.isLive && playbackTime >= player.duration) {
                if (player.loopMode === 'one') {
                    player._seekTo(0);
                    return;
                } else {
                    player.pause();
                    player.playbackTimeAtStart = player.duration;
                    if (player.onEnded) player.onEnded();
                }
            }

            if (player.loopMode === 'one' && player.loopStart !== null && player.loopEnd !== null) {
                if (playbackTime >= player.loopEnd) {
                    player._seekTo(player.loopStart);
                    return;
                }
            }

            if (player.nextFrame && player.nextFrame.timestamp <= playbackTime) {
                player.ctx.clearRect(0, 0, player.canvas.width, player.canvas.height);
                player.ctx.drawImage(player.nextFrame.canvas, 0, 0, player.canvas.width, player.canvas.height);

                if (player.afterFrameRenderCallbacks.length > 0) {
                    player.afterFrameRenderCallbacks.forEach(cb => cb(player.canvas, player.ctx));
                }

                player.nextFrame = null;
                player._updateNextFrame();
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
