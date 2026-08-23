import { Logger } from '../../shared/utils/Logger.js';
import { YouTubeEngine } from './YouTubeEngine.js';

/**
 * The player driving a YouTube video instead of its own decode pipeline.
 *
 * Kept beside the engine rather than spread through Player: the transport
 * methods each need one branch, and everything else about this mode lives
 * here. `player.engine` is what those branches test.
 *
 * What this mode deliberately does not do is reimplement the end of a video.
 * YouTube's ENDED state routes into completePlayerMedia, the same function the
 * render loop and a seek to the end use, so auto-advance and every loop mode
 * behave identically to a local file with no logic duplicated for them.
 */

/**
 * Switch the player between its own pipeline and YouTube's, in one place.
 *
 * Written as a single toggle rather than as matching blocks in load and
 * teardown: two mirrored lists drift, and a mode that half-restores leaves a
 * hidden canvas or a missing control bar behind on the next video.
 *
 * The canvas stays in the DOM either way, so layout and fullscreen are
 * unchanged — it is simply not what is being looked at.
 *
 * The control bar is hidden for YouTube because the embed draws its own over
 * the video, and two scrub bars disagreeing with each other is worse than one.
 * Inline display rather than a class, so the auto-hide logic that toggles
 * `visible` cannot bring it back. Navigation is not lost: the playlist panel is
 * separate, and the video still auto-advances when it ends.
 */
function applyYouTubeMode(player, on) {
    player.engine = on ? 'youtube' : 'mediabunny';
    // Frames cannot be read out of a cross-origin iframe and no AudioContext
    // can attach to it, so the features built on either are unavailable.
    player.capabilities = { canvasFrames: !on, audioGraph: !on };

    if (player.canvas) player.canvas.style.visibility = on ? 'hidden' : '';
    if (player.ui?.controls) player.ui.controls.style.display = on ? 'none' : '';
    if (player.ui?.playOverlay) player.ui.playOverlay.style.display = on ? 'none' : '';
}

/**
 * Start playing a YouTube video.
 * @param {Object} player
 * @param {{id: string, start: number}} video
 * @param {boolean} autoplay
 */
export async function loadPlayerYouTube(player, video, autoplay) {
    const mount = player.canvas?.parentElement;
    if (!mount) throw new Error('No player container to mount the video in');

    applyYouTubeMode(player, true);

    player.duration = 0;
    player.currentTime = video.start || 0;
    player.isPlaying = false;

    // Muted autoplay is the only autoplay a phone allows, and unlike the
    // decode pipeline a tap does not help: the gesture does not cross into a
    // cross-origin iframe, so even "the user just tapped this item" is not
    // enough for YouTube to start with sound. Starting muted is the difference
    // between playing and sitting on a still frame.
    //
    // Flagged the same way the decode path flags it, so the first interaction
    // restores the sound rather than leaving it silently muted.
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    // Remembered before muting: the sound is turned back on the moment the
    // video is actually playing, so the mute lasts a fraction of a second
    // rather than until the user reaches for the control on every video.
    player._youtubeWantsSound = !player.config.muted;
    if (autoplay && isMobile && !player.config.muted) {
        player.config.muted = true;
        player._wasMutedForAutoplay = true;
        player._updateVolumeUI();
    }

    player.youtube = new YouTubeEngine({
        mount,
        videoId: video.id,
        start: video.start,
        autoplay,
        muted: player.config.muted,
        onReady: () => {
            player._setLoading(false);
            // The embed starts at its own defaults, so the player's current
            // volume, mute and speed are pushed once it can accept them.
            syncYouTubeAudio(player);
            if (player.playbackRate !== 1) player.youtube?.setRate(player.playbackRate);

            // Asked again, out loud. autoplay in the URL is a request the
            // player may quietly decline — a second video loads into a fresh
            // iframe that never saw the tap which started the first, and it
            // sits on a still frame. Calling play once it is ready costs
            // nothing when autoplay already worked.
            if (autoplay) player.youtube?.play();
        },
        onDuration: (duration) => {
            player.duration = duration;
            player._updateProgress();
        },
        onStateChange: (state) => {
            if (state === 'playing') {
                player.isPlaying = true;
                player._updatePlayPauseUI();
                startYouTubeTicker(player);
                unmuteOncePlaying(player);
            } else if (state === 'paused') {
                player.isPlaying = false;
                player._updatePlayPauseUI();
            } else if (state === 'ended') {
                player.isPlaying = false;
                player._updatePlayPauseUI();
                stopYouTubeTicker(player);
                // Same completion as a local file: the playlist advances, and
                // loop-one restarts, without either being special-cased here.
                player._completeMedia();
            }
        },
        onError: (message) => {
            Logger.error('[YouTube]', message);
            player._setLoading(false);
            if (player.onStreamError && player.currentVideoId) {
                player.onStreamError(player.currentVideoId, message);
            }
        },
    });

    await player.youtube.mount();
    Logger.log(`[YouTube] Mounted ${video.id}${video.start ? ` at ${video.start}s` : ''}`);
}

/**
 * Position has to be polled — the IFrame API has no timeupdate — so this drives
 * the progress bar and subtitle timing the way the render loop does for a file.
 * It runs only while playing, so a paused tab costs nothing.
 */
export function startYouTubeTicker(player) {
    if (player._youtubeTicker) return;

    const tick = () => {
        if (player.engine !== 'youtube' || !player.youtube) return stopYouTubeTicker(player);

        player.currentTime = player.youtube.getTime();
        if (!player.duration) player.duration = player.youtube.getDuration();

        // A-B looping, on the same terms the render loop applies it to a file.
        // The markers can be set from the keyboard whatever is playing, so
        // without this they are accepted and then quietly ignored.
        if (player.loopMode === 'one' && player.loopStart !== null && player.loopEnd !== null
            && player.currentTime >= player.loopEnd) {
            player.youtube.seek(player.loopStart);
            player.currentTime = player.loopStart;
        }

        player._updateProgress();
        player.trigger('timeupdate', { currentTime: player.currentTime });

        player._youtubeTicker = requestAnimationFrame(tick);
    };

    player._youtubeTicker = requestAnimationFrame(tick);
}

export function stopYouTubeTicker(player) {
    if (!player._youtubeTicker) return;
    cancelAnimationFrame(player._youtubeTicker);
    player._youtubeTicker = null;
}

/**
 * Put everything back as it was, so the next load takes the normal path.
 * Called from the player's cleanup, which runs before every load.
 */
export function teardownPlayerYouTube(player) {
    if (player.engine !== 'youtube' && !player.youtube) return;

    stopYouTubeTicker(player);
    player.youtube?.destroy();
    player.youtube = null;

    applyYouTubeMode(player, false);
    player.isPlaying = false;
}

/**
 * Push the player's volume and mute to the embed.
 *
 * Called from the player's own volume funnel as well as at load: without it
 * the slider moved the Web Audio gain node, which a YouTube video does not go
 * through, so the control appeared to do nothing.
 */
export function syncYouTubeAudio(player) {
    if (player.engine !== 'youtube' || !player.youtube) return;
    player.youtube.setMuted(player.config.muted || player.config.volume === 0);
    player.youtube.setVolume(player.config.volume);
}

/**
 * Turn the sound back on once the video is genuinely playing.
 *
 * Muting is what gets autoplay past a phone, but leaving it muted means
 * reaching for the control on every video — and the restriction is on
 * *starting* with sound, not on unmuting something already playing.
 *
 * If the browser disagrees and pauses rather than unmutes, that is recovered
 * from: muted and playing beats unmuted and stopped. Checked rather than
 * assumed, because which browsers allow this differs and a silent failure here
 * would look like the video simply stopping for no reason.
 */
function unmuteOncePlaying(player) {
    if (!player._wasMutedForAutoplay || !player._youtubeWantsSound) return;
    // Once per video: a video that pauses and resumes must not fight this again.
    player._youtubeWantsSound = false;

    player._restoreAutoplayAudio('YouTube started playing');

    setTimeout(() => {
        if (player.engine !== 'youtube' || !player.youtube) return;
        if (player.isPlaying) return; // unmuting was allowed

        Logger.log('[YouTube] Unmuting stopped playback; staying muted');
        player.config.muted = true;
        player._wasMutedForAutoplay = true;
        player._syncAudioGain();
        player._updateVolumeUI();
        player.youtube.play();
    }, 500);
}
