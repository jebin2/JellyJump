import { MediaBunny, ensureDecodersFor } from '../MediaBunny.js';
import { Logger } from '../../shared/utils/Logger.js';
import { parseYouTubeUrl } from '../../shared/utils/YouTubeUrl.js';
import { StreamDetector } from '../../shared/utils/StreamDetector.js';
import { loadPlayerYouTube, teardownPlayerYouTube } from '../youtube/YouTubePlayback.js';

/**
 * Choose an audio track the browser can actually decode.
 *
 * The container's primary track is often one WebCodecs has no decoder for —
 * BluRay rips typically list DTS or TrueHD first with an AC-3 or AAC track
 * behind it. Taking the primary track unconditionally gave those files video
 * with permanent silence, even though a playable track was sitting right
 * there. Prefer the primary track, then fall back to the first decodable one.
 *
 * DTS is now decodable too, but only once its plugin is loaded, so the tracks
 * are inspected before anything is asked whether it can decode — otherwise the
 * answer would be no for the very files the plugin exists for.
 *
 * @returns {Promise<Object|null>} null when nothing is decodable (video still plays)
 */
export async function pickDecodableAudioTrack(input) {
    const tracks = await input.getAudioTracks();
    await ensureDecodersFor(tracks);

    const primary = await input.getPrimaryAudioTrack();
    if (primary && await primary.canDecode()) return primary;

    for (const track of tracks) {
        if (track === primary) continue;
        if (await track.canDecode()) {
            Logger.warn(`[MediaLifecycle] Primary audio track (${primary ? await primary.getCodec() : 'unknown codec'}) can't be decoded here — using ${await track.getCodec()} (${track.languageCode || 'und'}) instead`);
            return track;
        }
    }

    if (tracks.length > 0) {
        Logger.warn(`[MediaLifecycle] No decodable audio track (${tracks.length} present) — playing video without sound`);
    }
    return null;
}

export function clearPlayerCanvas(player) {
    if (player.ctx && player.canvas) {
        player.ctx.clearRect(0, 0, player.canvas.width, player.canvas.height);
    }
}

export function disposeMediaBunnyResources(player) {
    player.media.dispose();
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
        await player.frames.close();
    } catch (e) { }
    try {
        await player._closeAudioBufferIterator();
    } catch (e) { }

    disposeMediaBunnyResources(player);

    player.media.videoTrack = null;
    player.media.audioTrack = null;
    player.currentVideoId = null;

    player._updateTimeDisplay();
    player._updateProgress();
    if (player.ui?.loader) player.ui.loader.style.display = 'none';

    player._stopQueuedAudio();

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

    await player.frames.close();
    await player.audioBuffers.settle();
    await player._closeAudioBufferIterator();
    player.epoch.bump();
    player.playbackTimeAtStart = 0;
    player.audioContextStartTime = null;
    player._stopQueuedAudio();
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

    player.subtitles.reset();
}

export async function setupPlayerMediaTracks(player, url, isHls) {
    const urlSourceOptions = player.config.withCredentials ? { requestInit: { credentials: 'include' } } : {};
    Logger.log(`[MediaLifecycle] Setting up tracks for ${url} (isHls: ${isHls})`);
    player.media.input = new MediaBunny.Input({
        source: new MediaBunny.UrlSource(url, urlSourceOptions),
        formats: [...(MediaBunny.HLS_FORMATS || []), ...MediaBunny.ALL_FORMATS]
    });

    if (!isHls) {
        player.duration = await player.input.computeDuration();
        player._updateTimeDisplay();
    }

    try {
        Logger.log('[MediaLifecycle] Fetching primary video track...');
        player.media.videoTrack = await player.input.getPrimaryVideoTrack();
        
        if (player.videoTrack) {
            // getCodec(), not `.codec`. The synchronous getter throws for a
            // track whose codec is not known yet, which is every HLS track, and
            // this line sits outside the !isHls guard below -- so a logging
            // statement was aborting setup for every HLS stream, leaving the
            // duration at 0 and no audio track at all.
            Logger.log(`[MediaLifecycle] Video track found: ${await player.videoTrack.getCodec()}`);
            if (!isHls) {
                try {
                    // The dedicated frame-rate API, not packet stats: it
                    // probes ~256 packets instead of scanning the whole file,
                    // and it is more accurate where it counts. Measured on a
                    // 60s 720p clip, the scan returned 29.99983 fps in 22ms
                    // and this returns exactly 30 in 2ms -- and frameRate
                    // feeds frame-duration maths, where 29.99983 drifts.
                    const metrics = await player.videoTrack.computeFrameRateMetrics();
                    player.frameRate = metrics.bestGuessFrameRate || 30;
                    Logger.log(`Detected frame rate: ${player.frameRate} fps`);
                } catch (e) {
                    Logger.warn("Could not compute frame rate, defaulting to 30fps", e);
                    player.frameRate = 30;
                }
            } else {
                player.frameRate = 30;
            }

            player.media.videoSink = new MediaBunny.CanvasSink(player.videoTrack, {
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
        player.media.audioTrack = await pickDecodableAudioTrack(player.input);

        if (player.audioTrack) {
            Logger.log(`[MediaLifecycle] Audio track found: ${await player.audioTrack.getCodec()}`);
            player.media.audioSink = new MediaBunny.AudioBufferSink(player.audioTrack);
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

    // Bump the generation first, which is what actually stops whatever else is
    // in flight: every await in here and in updateNextFrame re-checks the epoch
    // and bails when it has moved on.
    //
    // This used to return early while a frame fetch was in flight, which is the
    // one case that matters — a seek arriving mid-catch-up. Refusing to rebuild
    // there left the old iterator sitting at the old position, and the catch-up
    // loop then ground all the way forward to the seek target one frame at a
    // time. That is the "picture keeps fast-forwarding after the key is
    // released" symptom: a seek must always win.
    const epoch = player.epoch.bump();
    player.frames.beginFetch();

    let firstFrame = null;
    let secondFrame = null;
    try {
        await player.frames.close();

        const startTime = player._getPlaybackTime();
        Logger.log(`[VideoIterator] Initializing canvases at time: ${startTime.toFixed(3)}s (epoch=${epoch})`);
        const iterator = player.frames.open(player.videoSink, startTime);
        if (!iterator) {
            Logger.warn('[VideoIterator] videoSink returned null iterator for time:', player._getPlaybackTime());
            return;
        }

        try {
            firstFrame = (await iterator.next()).value ?? null;
            secondFrame = (await iterator.next()).value ?? null;
        } catch (e) {
            Logger.warn('[VideoIterator] Failed to get initial frames, will retry on next play:', e);
            player.frames.dropIterator();
            return;
        }

        if (player.epoch.isStale(epoch)) return;

        player.frames.setPending(secondFrame);

        if (firstFrame) {
            player.presentFrame(firstFrame.canvas);
        }
    } finally {
        // Only if we are still the current generation: a newer start has taken
        // ownership of the flag and must not have it cleared out from under it.
        player.frames.endFetch(epoch);
    }
}

export async function extractAndDrawPlayerFrame(player, timestamp) {
    if (!player.videoSink) return;

    const iterator = player.videoSink.canvases(timestamp);
    const result = await iterator.next();
    const frame = result.value;

    if (frame) {
        player.presentFrame(frame.canvas);
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
                    await player._suspendAudioContext();
                    await player.play();
                    return;
                } catch (retryErr) {
                    Logger.warn('Muted autoplay fallback also failed:', retryErr);
                }
            }

            Logger.warn('Falling back to paused state.');
            player.isPlaying = false;
            player._updatePlayPauseUI();

            player._closeAudioBufferIteratorSoon();
            await player._suspendAudioContext();
            player._stopQueuedAudio();
            await player._closeAudioContext();

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
        await player.frames.close();
    } catch (e) { }

    try {
        await player._closeAudioBufferIterator();
    } catch (e) { }

    disposeMediaBunnyResources(player);

    player.media.videoTrack = null;
    player.media.audioTrack = null;
}


/**
 * Load a URL into the player.
 *
 * The orchestration lived on Player while every step it calls -- the cleanup,
 * the track setup, the HLS state, the initial frame -- already lived here, so
 * reading the load path meant moving between two files for no reason.
 *
 * The `options` argument is gone. Nothing ever read it: Playlist passed
 * `{ isAudio }` and no one looked, because isAudioMode is decided from the
 * tracks the file actually has rather than from what the playlist believed.
 */
export async function loadPlayerMedia(player, url, autoplay = false, videoId = null, savedSubtitles = null) {
    player.sourceUrl = url;
    try {
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        // Pre-emptively mute ONLY the autoplay iOS will actually block:
        // no transient user activation AND an audio pipeline never yet
        // unlocked by a gesture. Gesture-driven loads (tapping a playlist
        // item or Add Video) are allowed to play sound, and once the
        // context has been unlocked, video switches keep it. If a resume
        // still fails later, play()'s timeout fallback mutes and arms
        // restore-on-interaction, so nothing is left silently broken.
        const gestureActive = typeof navigator !== 'undefined' && navigator.userActivation
            ? navigator.userActivation.isActive
            : false;
        if (autoplay && isMobile && !player.config.muted && !gestureActive && !player.isAudioInitialized) {
            Logger.log('[Player] Mobile autoplay without user activation - enforcing muted playback');
            player.config.muted = true;
            // The AudioContext/gainNode survive across loads, so the flag
            // alone doesn't silence anything - sync the gain or the icon
            // shows muted while audio keeps playing.
            player._syncAudioGain();
            // Mark as auto-muted so the first user interaction restores
            // audio instead of leaving the video silent until a manual
            // unmute. Skipped when the user muted deliberately (guard
            // above): auto-restore must not override their choice.
            player._wasMutedForAutoplay = true;
            player._updateVolumeUI();
        }

        const youtube = parseYouTubeUrl(url);
        const isHls = !youtube && StreamDetector.detect(url) === StreamDetector.TYPE_HLS;
        if (isHls) player.isLive = true;

        await player._cleanupForLoad();

        // The embed is kept alive across YouTube videos and only dropped
        // here, where what comes next is finally known — leaving it would
        // park a hidden cross-origin iframe behind a local file.
        if (!youtube) teardownPlayerYouTube(player);

        // A YouTube link has no media stream to demux, so the whole track
        // setup below does not apply — YouTube's own player takes over the
        // picture and the sound.
        if (youtube) {
            player.currentVideoId = videoId || url;
            player._setLoading(true);
            await loadPlayerYouTube(player, youtube, autoplay);
            Logger.log('Media loaded successfully (youtube)');
            return;
        }

        // cleanup's pause() suspended the AudioContext; wake it now while
        // the tap's transient activation is still valid (same race as the
        // seek path), so play() below finds it already running.
        if (autoplay && player.audioContext) {
            player.audioContext.resume().catch(() => { });
        }

        player._setLoading(true);
        Logger.log(`Loading media: ${url}`);
        player.currentVideoId = videoId || url;

        await player._setupMediaTracks(url, isHls);

        if (isHls) await player._handleHLSState();
        if (savedSubtitles?.length > 0) player._restoreSavedSubtitles(savedSubtitles);

        await player._handleInitialFrame(autoplay);
        player._updateSubtitleMenu();

        if (!player.isLive) player._setLoading(false);
        Logger.log('Media loaded successfully');

    } catch (error) {
        Logger.error('Error loading media:', error);
        player._setLoading(false);
        if (player.onStreamError && player.currentVideoId) {
            player.onStreamError(player.currentVideoId, error.message || 'Failed to load media');
        }
    }
}
