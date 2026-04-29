import { Logger } from '../../shared/utils/Logger.js';
import { startPlayerAudioVisualizer } from '../audio/AudioEngine.js';

export async function playPlayer(player) {
    player.stream.onPlay();

    const streamHandled = await player.stream.playStream();
    if (streamHandled) return;

    player._updateVolumeUI();

    if (player.isPlaying) return;
    if (!player.videoTrack && !player.audioTrack) return;

    Logger.log(`[Play] Starting playback - isAudioMode: ${player.isAudioMode}, playbackTimeAtStart: ${player.playbackTimeAtStart}`);

    try {
        player._initAudio();

        if (player.audioContext && player.audioContext.state === 'suspended') {
            const resumePromise = player.audioContext.resume();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('AudioContext resume timed out')), 3000)
            );
            await Promise.race([resumePromise, timeoutPromise]);
        }
    } catch (e) {
        Logger.warn('[Play] AudioContext blocked/failed:', e);
        Logger.log('[Play] Auto-muting due to audio block...');
        player._wasMutedForAutoplay = true;
        if (!player.config.muted) {
            player.config.muted = true;
            if (player.gainNode) player.gainNode.gain.value = 0;
            if (player.ui.muteBtn) player._updateVolumeUI();
        }
    }

    player.isPlaying = true;
    player._updatePlayPauseUI();

    if (player.isLive) {
        let forceRestart = false;
        Logger.log(`[Play:Live] isLive=${player.isLive}, videoTrack=${!!player.videoTrack}, audioContext=${!!player.audioContext}, audioCtxTime=${player.audioContext?.currentTime?.toFixed(3)}`);
        
        const lastPosition = player._getPlaybackTime();
        const isLastPosUnix = lastPosition > 1000000000;
        const isStartTsUnix = (player._liveStartTimestamp || 0) > 1000000000;

        if (lastPosition > 0 && isLastPosUnix === isStartTsUnix && Math.abs(lastPosition - (player._liveStartTimestamp || 0)) > 1.0) {
            player._liveStartTimestamp = lastPosition;
            Logger.log(`[Play:Live] Resuming from last position: ${player._liveStartTimestamp.toFixed(3)}`);
        }

        if (player.isLive && player._liveStartTimestamp) {
            const currentLiveEdge = await player.videoTrack.getDurationFromMetadata({ skipLiveWait: true });
            const drift = (currentLiveEdge ?? 0) - player._liveStartTimestamp;
            // If drift is too large (lagging or leading), reset to edge
            if (Math.abs(drift) > 60) {
                Logger.log(`[Play:Live] Resume position drift is too high (${drift.toFixed(1)}s) — resetting to edge`);
                player._liveStartTimestamp = null;
                forceRestart = true;
            }
        }

        if (!player._liveStartTimestamp || forceRestart) {
            if (player.videoTrack) {
                try {
                    const currentLiveEdge = await player.videoTrack.getDurationFromMetadata({ skipLiveWait: true });
                    const refreshInterval = await player.videoTrack.getLiveRefreshInterval();
                    const backoff = (refreshInterval || 6) * 3;
                    player._liveStartTimestamp = Math.max(0, (currentLiveEdge ?? 0) - backoff);
                    Logger.log(`[Play:Live] Calculated new live start: ${player._liveStartTimestamp.toFixed(3)}`);
                } catch (e) {
                    player._liveStartTimestamp = Date.now() / 1000 - 15;
                }
            } else {
                player._liveStartTimestamp = Date.now() / 1000 - 15;
            }
        } else {
            Logger.log(`[Play:Live] Using existing live start timestamp: ${player._liveStartTimestamp.toFixed(3)}`);
        }
        
        await player._startLiveVideoLoop(forceRestart);
        player._updateStreamUI();
        return; // IMPORTANT: Prevent VOD logic below from clobbering the live loop
    }

    const currentPosition = player._getPlaybackTime();
    if (player.duration > 1.0 && currentPosition >= player.duration - 0.5) {
        Logger.log(`[Play] Resetting to start (position=${currentPosition.toFixed(2)}, duration=${player.duration.toFixed(2)})`);
        player.playbackTimeAtStart = 0;
        await player._startVideoIterator();
    } else if (!player.videoFrameIterator) {
        await player._startVideoIterator();
    }

    player.fallbackStartTime = performance.now();

    if (player.audioSink) {
        if (!player.isLive) {
            const startTime = player.playbackTimeAtStart;
            if (player.audioBufferIterator) await player.audioBufferIterator.return();
            Logger.log(`[Play] Starting audio iterator at time: ${startTime.toFixed(2)}s`);
            player.audioBufferIterator = player.audioSink.buffers(startTime);

            const firstResult = await player.audioBufferIterator.next();
            const vodPrefetchedBuffer = firstResult?.value ?? null;

            const vodAnchorWall = player.audioContext.currentTime + 0.02;
            const vodAnchorContent = vodPrefetchedBuffer?.timestamp ?? startTime;
            player._vodAnchorWall = vodAnchorWall;
            player._vodAnchorContent = vodAnchorContent;
            Logger.log(`[Play] VOD anchor prefetched — wall=${vodAnchorWall.toFixed(3)}, content=${vodAnchorContent.toFixed(3)}, buffer=${vodPrefetchedBuffer ? 'ok' : 'null'}`);

            player._runAudioIterator(player.audioBufferIterator, vodAnchorWall, vodAnchorContent, vodPrefetchedBuffer);
        }

        await startPlayerAudioVisualizer(player);
    }

    player._startRenderLoop();

    if (player.controlBarMode === 'overlay') {
        setTimeout(() => {
            if (player.isPlaying && player.controlBarMode === 'overlay') {
                player._startAutoHideTimer();
            }
        }, 500);
    }

    if (player.ui.playOverlay) {
        player.ui.playOverlay.style.display = 'none';
    }
}

export function pausePlayer(player, showOverlay = true) {
    Logger.log('Player.pause() called');

    player.stream.onPause();

    const streamHandled = player.stream.pauseStream(showOverlay);
    if (streamHandled) return;

    const calculatedTime = player._getPlaybackTime();

    if (calculatedTime < 0.1 && player.currentTime > 1.0) {
        Logger.warn(`[Pause] Correction: _getPlaybackTime returned ${calculatedTime} but currentTime is ${player.currentTime}. Keeping ${player.currentTime}.`);
        player.playbackTimeAtStart = player.currentTime;
    } else {
        player.playbackTimeAtStart = calculatedTime;
    }
    player.isPlaying = false;
    player._clearAutoHideTimer();

    player._updatePlayPauseUI();

    if (player.audioBufferIterator) {
        const iterator = player.audioBufferIterator;
        player.audioBufferIterator = null;
        player.audioIteratorCleanupPromise = iterator.return().catch(e => {
            Logger.debug('Error closing audio iterator:', e);
        }).finally(() => {
            player.audioIteratorCleanupPromise = null;
        });
    }

    if (player.animationFrameId) {
        cancelAnimationFrame(player.animationFrameId);
        player.animationFrameId = null;
    }

    if (player.audioContext && player.audioContext.state === 'running') {
        player.audioContext.suspend();
    }

    for (const node of player.queuedAudioNodes) {
        try { node.stop(); } catch (e) { }
    }
    player.queuedAudioNodes.clear();

    player._savePlaybackState();

    if (player.ui.playOverlay && !player.isLoading) {
        const shouldShow = showOverlay && player.config.controls.playOverlay;
        player.ui.playOverlay.style.display = shouldShow ? 'flex' : 'none';
    }

    if (player.isAudioMode && player.audioVisualizer) {
        player.audioVisualizer.stop();
    }
}

export async function setPlayerPlaybackRate(player, rate) {
    if (rate < 0.25 || rate > 2) return;
    if (player.isLive) {
        if (player.playbackRate !== 1) {
            player.playbackRate = 1;
        }
        player._updateSpeedMenu();
        return;
    }

    const wasPlaying = player.isPlaying;
    const currentPosition = player._getPlaybackTime();

    if (wasPlaying) {
        player.pause();
        if (player.audioIteratorCleanupPromise) {
            await player.audioIteratorCleanupPromise;
        }
    }

    player.playbackRate = rate;
    localStorage.setItem('jellyjump-speed', rate);
    player._updateSpeedMenu();

    if (wasPlaying) {
        await player._seekTo(currentPosition);
        await player.play();
    }
}
