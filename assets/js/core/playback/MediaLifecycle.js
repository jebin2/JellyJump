import { MediaBunny } from '../MediaBunny.js';
import { Logger } from '../../shared/utils/Logger.js';

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
    player._hasSnappedAnchor = false;
    player.fallbackStartTime = undefined;
    player.isLive = false;
    if (player.stream) {
        player.stream.isLive = false;
        player._cleanupHLS();
    }
    
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
    Logger.log(`[MediaLifecycle] Setting up tracks for ${url} (isHls: ${isHls})`);
    player.input = new MediaBunny.Input({
        source: new MediaBunny.UrlSource(url, urlSourceOptions),
        formats: [...(MediaBunny.HLS_FORMATS || []), ...MediaBunny.ALL_FORMATS]
    });

    if (!isHls) {
        player.duration = await player.input.computeDuration();
        player._updateTimeDisplay();
    }

    try {
        Logger.log('[MediaLifecycle] Fetching primary video track...');
        player.videoTrack = await player.input.getPrimaryVideoTrack();
        
        if (player.videoTrack) {
            Logger.log(`[MediaLifecycle] Video track found: ${player.videoTrack.codec}`);
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
            Logger.log(`[MediaLifecycle] Video dimensions: ${player.canvas.width}x${player.canvas.height}`);
        } else {
            Logger.log('[MediaLifecycle] No video track found - enabling Audio Mode');
            player.isAudioMode = true;
            const containerRect = player.container.getBoundingClientRect();
            player.canvas.width = containerRect.width || 1280;
            player.canvas.height = containerRect.height || 720;
        }

        Logger.log('[MediaLifecycle] Fetching primary audio track...');
        player.audioTrack = await player.input.getPrimaryAudioTrack();
        if (!player.audioTrack) {
            const audioTracks = await player.input.getAudioTracks();
            if (audioTracks.length > 0) player.audioTrack = audioTracks[0];
        }

        if (player.audioTrack) {
            Logger.log(`[MediaLifecycle] Audio track found: ${player.audioTrack.codec}`);
            player.audioSink = new MediaBunny.AudioBufferSink(player.audioTrack);
        }
    } catch (e) {
        Logger.error('[MediaLifecycle] Error setting up media tracks:', e);
        throw e;
    }

    player._updateAudioTracks();
}

export async function handlePlayerHlsState(player) {
    Logger.log('[MediaLifecycle] Handling HLS state...');
    player.isLive = player.videoTrack ? await player.videoTrack.isLive() : false;
    
    // Sync with stream controller
    if (player.streamController) {
        player.streamController.isLive = player.isLive;
    }

    Logger.log(`[Live:Load] isLive=${player.isLive}, videoTrack=${!!player.videoTrack}, audioTrack=${!!player.audioTrack}, audioSink=${!!player.audioSink}`);

    if (player.isLive) {
        player.playbackRate = 1;
        player._updateSpeedMenu();

        Logger.log('[MediaLifecycle] Fetching live duration and refresh interval...');
        const [currentDur, refreshInterval] = await Promise.all([
            player.videoTrack.getDurationFromMetadata({ skipLiveWait: true }),
            player.videoTrack.getLiveRefreshInterval(),
        ]);
        
        // Start 3 segments back to avoid stuttering at the live edge
        const backoff = (refreshInterval || 6) * 3;
        const startTs = Math.max(0, (currentDur ?? 0) - backoff);
        
        player._liveStartTimestamp = startTs;
        if (player.streamController) {
            player.streamController._liveStartTimestamp = startTs;
        }
        
        Logger.log(`[Live:Load] liveEdge=${(currentDur ?? 0).toFixed(3)}, refreshInterval=${refreshInterval ?? 6}s, starting at=${startTs.toFixed(3)} (backoff: ${backoff}s)`);
        player.duration = 0;
    } else {
        player._liveStartTimestamp = null;
        if (player.streamController) {
            player.streamController._liveStartTimestamp = null;
        }
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

export async function startPlayerVideoIterator(player) {
    if (!player.videoSink) return;

    if (player._isFetchingFrame) {
        Logger.debug('[VideoIterator] Skipping startVideoIterator - already fetching');
        return;
    }
    player._isFetchingFrame = true;

    player.asyncId++;
    const currentAsyncId = player.asyncId;

    let firstFrame = null;
    let secondFrame = null;
    try {
        if (player.videoFrameIterator) await player.videoFrameIterator.return();

        const startTime = player._getPlaybackTime();
        Logger.log(`[VideoIterator] Initializing canvases at time: ${startTime.toFixed(3)}s (asyncId=${currentAsyncId})`);
        player.videoFrameIterator = player.videoSink.canvases(startTime);
        if (!player.videoFrameIterator) {
            Logger.warn('[VideoIterator] videoSink returned null iterator for time:', player._getPlaybackTime());
            return;
        }

        try {
            firstFrame = (await player.videoFrameIterator.next()).value ?? null;
            secondFrame = (await player.videoFrameIterator.next()).value ?? null;
        } catch (e) {
            Logger.warn('[VideoIterator] Failed to get initial frames, will retry on next play:', e);
            player.videoFrameIterator = null;
            return;
        }

        if (currentAsyncId !== player.asyncId) return;

        player.nextFrame = secondFrame;

        if (firstFrame) {
            player.ctx.drawImage(firstFrame.canvas, 0, 0, player.canvas.width, player.canvas.height);
            if (player.afterFrameRenderCallbacks.length > 0) {
                player.afterFrameRenderCallbacks.forEach(cb => cb(player.canvas, player.ctx));
            }
        }
    } finally {
        player._isFetchingFrame = false;
    }
}

export async function extractAndDrawPlayerFrame(player, timestamp) {
    if (!player.videoSink) return;

    const iterator = player.videoSink.canvases(timestamp);
    const result = await iterator.next();
    const frame = result.value;

    if (frame) {
        player.ctx.drawImage(frame.canvas, 0, 0, player.canvas.width, player.canvas.height);
        if (player.afterFrameRenderCallbacks.length > 0) {
            player.afterFrameRenderCallbacks.forEach(cb => cb(player.canvas, player.ctx));
        }
    }

    await iterator.return();
}

export async function handlePlayerInitialFrame(player, autoplay = false) {
    if (player.isLive) {
        if (autoplay) await player.play().catch(e => Logger.warn('Live autoplay failed:', e));
        return;
    }

    const savedState = player._loadPlaybackState();
    let startTimestamp = 0;

    if (savedState && savedState.videoIdentifier === player.currentVideoId) {
        Logger.log('Restoring playback state:', savedState);
        startTimestamp = savedState.timestamp;
    } else {
        Logger.log('No saved state, using default frame');
        if (!autoplay) {
            const middleTimestamp = player.duration * 0.5;
            if (player.videoTrack) await player._extractAndDrawFrame(middleTimestamp);
            return;
        }
    }

    player.playbackTimeAtStart = startTimestamp;
    player.currentTime = startTimestamp;
    player._updateProgress();

    Logger.log(`[InitialFrame] Restored state - isAudioMode: ${player.isAudioMode}, playbackTimeAtStart: ${player.playbackTimeAtStart}, currentTime: ${player.currentTime}`);

    if (autoplay) {
        try {
            const playPromise = player.play();
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Autoplay timeout')), 10000)
            );
            await Promise.race([playPromise, timeoutPromise]);
        } catch (e) {
            Logger.warn('Autoplay failed or timed out:', e);

            if (!player.config.muted) {
                Logger.log('Attempting fallback to muted autoplay...');
                player.config.muted = true;
                if (player.ui.muteBtn) player._updateVolumeUI();

                try {
                    if (player.audioContext && player.audioContext.state === 'running') {
                        try { await player.audioContext.suspend(); } catch (ignore) { }
                    }
                    await player.play();
                    return;
                } catch (retryErr) {
                    Logger.warn('Muted autoplay fallback also failed:', retryErr);
                }
            }

            Logger.warn('Falling back to paused state.');
            player.isPlaying = false;
            player._updatePlayPauseUI();

            if (player.audioBufferIterator) {
                player.audioBufferIterator.return().catch(() => { });
                player.audioBufferIterator = null;
            }
            if (player.audioContext && player.audioContext.state === 'running') {
                try { await player.audioContext.suspend(); } catch (e) { }
            }

            for (const node of player.queuedAudioNodes) {
                try { node.stop(); } catch (e) { }
            }
            player.queuedAudioNodes.clear();

            if (player.audioContext) {
                try { player.audioContext.close(); } catch (e) { }
                player.audioContext = null;
                player.gainNode = null;
                player.isAudioInitialized = false;
            }

            try {
                await player._startVideoIterator();
            } catch (e) {
                Logger.warn('Fallback video iterator failed:', e);
            }

            if (player.ui.playOverlay && player.config.controls.playOverlay) player.ui.playOverlay.style.display = 'flex';
            player.isPlaying = false;
        }
    } else {
        try {
            await player._startVideoIterator();
        } catch (e) {
            Logger.warn('Initial video iterator failed:', e);
        }
    }
    player._updateVolumeUI();
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
