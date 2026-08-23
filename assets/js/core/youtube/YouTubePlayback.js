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

    player.youtube = new YouTubeEngine({
        mount,
        videoId: video.id,
        start: video.start,
        autoplay,
        onReady: () => {
            player._setLoading(false);
            // The embed starts at its own defaults, so the player's current
            // volume, mute and speed are pushed once it can accept them.
            syncYouTubeAudio(player);
            if (player.playbackRate !== 1) player.youtube?.setRate(player.playbackRate);
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
