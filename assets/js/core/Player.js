// @ts-check
/**
 * Core Player Class
 * Composition root — delegates to focused sub-modules for audio, rendering,
 * playback state, UI updates, and stream/media lifecycle management.
 */

import '../shared/media/MediaBunny.js'; // registers the codec plugins
import { Settings } from '../shared/settings/Settings.js';
import { PlayerOverrides } from './PlayerOverrides.js';
import { ScreenWakeLock } from './playback/ScreenWakeLock.js';
import { onPlayerEvent, offPlayerEvent, triggerPlayerEvent, clearPlayerEvents } from './PlayerEvents.js';
import {
    PLAYER_CONFIG,
    PLAYER_CONTROL_DEFAULTS,
    CONTROL_BAR_MODE_DEFAULT
} from './config.js';
import {
    presentPlayerFrame, addPlayerRenderCallback, removePlayerRenderCallback,
    playerOverlayTimeMs, redrawPlayer,
} from './playback/FramePresenter.js';
import { closePlayerAudioContext, restorePlayerAutoplayAudio, syncPlayerVolume } from './audio/AudioEngine.js';
import {
    resetPlayer,
    resetPlayerUI,
    loadPlayerMedia
} from './playback/MediaLifecycle.js';
import {
    togglePlayerPlay,
    seekPlayerTo,
    requestPlayerSeek,
    stepPlayerFrame,
} from './playback/PlaybackState.js';
import { playPlayer, pausePlayer, setPlayerPlaybackRate } from './playback/PlaybackTransport.js';
import {
    cancelYouTubeAutoplayRetry,
    teardownPlayerYouTube,
} from './youtube/YouTubePlayback.js';
import { PlayerStream } from './streaming/PlayerStream.js';

import { Logger } from '../shared/utils/Logger.js';
import { MediaTracks } from './playback/MediaTracks.js';
import { PlaybackEpoch } from './playback/PlaybackEpoch.js';
import { PlaybackAnchor } from './playback/PlaybackAnchor.js';
import { BroadcastStream } from './streaming/BroadcastStream.js';
import { WatchParty } from './streaming/WatchParty.js';
import { VideoFrameQueue } from './playback/VideoFrameQueue.js';
import { AudioBufferQueue } from './audio/AudioBufferQueue.js';
import { ReversePlayback } from './playback/ReversePlayback.js';
import { PlayerTiming } from './PlayerTiming.js';
import { PlayerStateEvents } from './PlayerStateEvents.js';

export class CorePlayer {
    /**
     * @param {string} containerId
     * @param {Object} [options] see core/config.js
     * @param {Object|null} [view] what the player shows itself with
     *   (ui/player/createPlayer.js); without one it has no controls.
     */
    constructor(containerId, options = {}, view = null) {
        /** The screen side, handed in: the core imports nothing from ui/. */
        this.view = view;
        /** Load, seek and dropped-frame timings for Diagnostics. */
        this.timing = new PlayerTiming();
        /** Fires the §4.1 events when the state they describe changes. */
        this.announce = new PlayerStateEvents(this);
        /** The stack of temporary values (`override`), made on first use. @type {PlayerOverrides|null} */
        this._overrides = null;
        this.container = document.getElementById(containerId);
        if (!this.container) {
            Logger.error(`Container with ID "${containerId}" not found.`);
            return;
        }

        this.config = { ...PLAYER_CONFIG, ...options };
        this.canvas = null;
        this.ctx = null;
        this._wakeLock = new ScreenWakeLock();
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.playbackRate = Number(Settings.get('speed', 1)) || 1.0;
        this.loopMode = this.config.controls ? this.config.controls.loopMode : 'off';
        this.loopStart = null;
        this.loopEnd = null;
        this.animationFrameId = null;

        // Which pipeline is playing. 'mediabunny' decodes and paints frames
        // itself; 'youtube' hands the video to YouTube's iframe and can only
        // drive it. Features ask capabilities rather than testing this, so a
        // third engine later does not mean editing every menu again.
        this.engine = 'mediabunny';
        this.capabilities = { canvasFrames: true, audioGraph: true };
        this.youtube = null;

        this.controlBarMode = options.controlBarMode || CONTROL_BAR_MODE_DEFAULT;
        this.autoHideTimer = null;

        this.config.controls = {
            ...PLAYER_CONTROL_DEFAULTS,
            ...this.config.controls
        };

        // The demuxed source and what is read from it. Owned by the
        // component; exposed below as read-only views so the nine files that
        // read these keep working untouched.
        this.media = new MediaTracks();

        // Subtitles
        this.onSubtitleChange = null;

        // Screenshot Manager — lazily initialized
        this.screenshotManager = null;

        // Web Audio API
        this.audioContext = null;
        this.gainNode = null;
        this.mixNode = null;
        this.nextAudioTime = 0;
        this.isAudioInitialized = false;
        this.currentAudioSource = null;
        this.activeSources = [];
        this.vodAnchor = new PlaybackAnchor();
        this.playbackId = 0;

        // MediaBunny playback state
        this.queuedAudioNodes = new Set();
        this.epoch = new PlaybackEpoch();
        this.frames = new VideoFrameQueue(this.epoch);
        this.audioBuffers = new AudioBufferQueue();
        this.broadcast = new BroadcastStream(this);
        this.watchParty = new WatchParty(this);
        this.playbackTimeAtStart = 0;
        this.audioContextStartTime = null;

        /** Seeks coalesced by requestSeek: the latest target, and whether one is decoding. */
        this.seekQueue = { pending: null, active: false };
        /** Reopening a frame queue that closed while playing (RenderLoop). */
        this.frameReopen = { attempts: 0, timer: null };

        // Scrubbing state
        this.isScrubbing = false;
        this.scrubWasPlaying = false;

        // Render Callbacks
        this.afterFrameRenderCallbacks = [];

        // The controls' elements, filled in by the view (ui/player/createPlayer.js).
        this.ui = {};

        this.isLoading = false;
        this.bezelTimer = null;

        // Navigation callbacks
        this.onNext = null;
        this.onPrevious = null;
        this.onEnded = null;

        this.currentVideoId = null;
        this.sourceUrl = null;

        // Stream / Webcam playback
        this.stream = null;

        // Audio-only playback
        this.audioVisualizer = null;
        this.isAudioMode = false;
        this.audioElement = null;

        this.stream = new PlayerStream(this);
        const parts = view?.parts(this) ?? {};
        this.keyboard = parts.keyboard ?? null;
        this.subtitles = parts.subtitles ?? null;
        // Playing backwards runs beside the forward pipeline, not through it.
        this.reverse = new ReversePlayback(this);
        // Which way Play goes. A setting, like speed: once backward, play,
        // pause, seeks and speed changes all keep going backward until it is
        // switched back, or another file is opened.
        this.direction = 'forward';
        this.loop = parts.loop ?? null;
        this.thumbnails = parts.thumbnails ?? null;
        this.controlBar = parts.controlBar ?? null;
        this.view?.mount(this);
    }

    // ─── Event emitter ───────────────────────────────────────────────────────────
    /** Listen to an event (the §4.1 list: play, pause, timeupdate, …). @param {string} event @param {(data: any) => void} callback */
    on(event, callback) { onPlayerEvent(this, event, callback); }
    /** Stop listening. @param {string} event @param {(data: any) => void} callback */
    off(event, callback) { offPlayerEvent(this, event, callback); }
    /** Fire an event; the core's parts use it. @param {string} event @param {Object} [data] */
    trigger(event, data = {}) { triggerPlayerEvent(this, event, data); }

    // ─── UI Updates ──────────────────────────────────────────────────────────────
    /** Show or hide the spinner; the playlist shows it while it fetches a file. @param {boolean} isLoading */
    setLoading(isLoading) {
        this.isLoading = isLoading;
        this.announce.loading();
    }
    _showBezel(icon, text) { this.view?.showBezel(this, icon, text); }

    // ─── Loop ────────────────────────────────────────────────────────────────────
    /** Set the A marker at the current position (the `[` key). */
    setLoopStart() { this.loop.setLoopStart(); }
    /** Set the B marker at the current position (the `]` key). */
    setLoopEnd() { this.loop.setLoopEnd(); }
    /** Clear the A-B markers, keeping the loop mode. */
    clearLoopMarkers() { this.loop.clearLoopMarkers(); }
    /** Loop off and the markers cleared. */
    resetLoop() { this.loop.resetLoop(); }
    /**
     * Loop `mode` ('off', 'one', 'playlist'); in 'one', `start` and `end`
     * (seconds, or null) make it an A-B loop. Leaving one out keeps it.
     * @param {string} [mode] @param {number|null} [start] @param {number|null} [end]
     */
    setLoop(mode = this.loopMode, start = this.loopStart, end = this.loopEnd) {
        this.loopMode = mode;
        this.loopStart = start;
        this.loopEnd = end;
        this.announce.loop();
    }

    // ─── Subtitle / audio track helpers ─────────────────────────────────────────
    /** Show the subtitle track with this id. @param {string|number} trackId */
    switchSubtitleTrack(trackId) { this.subtitles.switchSubtitleTrack(trackId); }
    /** Play the file's audio track with this id. @param {string|number} trackId */
    async switchAudioTrack(trackId) { return this.subtitles.switchAudioTrack(trackId); }
    /** Add a subtitle file (VTT or SRT) and show it. @param {string} url @param {string} [name] */
    async loadSubtitle(url, name) { return this.subtitles.loadSubtitle(url, name); }
    /** Make subtitles from the audio, on the device. @param {Object} [opts] */
    async generateSubtitles(opts) { return this.subtitles.generateSubtitles(opts); }

    // ─── Control Bar Mode ────────────────────────────────────────────────────────
    /** Switch the control bar between overlay and fixed (saved as the user's choice). */
    toggleControlBarMode() { this.controlBar.toggleMode(); }
    _applyControlBarMode() { this.controlBar.applyMode(); } // announces controlbarmodechange

    // ─── Stream helpers ──────────────────────────────────────────────────────────
    /** Show a camera (or screen) stream instead of a file. @param {MediaStream} stream */
    async loadWebcamStream(stream) { return this.stream.loadWebcamStream(stream); }
    /** Record what the canvas shows, with its layers. @param {Object} [options] see CanvasRecorder */
    async startCanvasRecording(options = {}) { return this.stream.startCanvasRecording(options); }
    /** Stop recording; resolves with the recording, or null if none was running. */
    async stopCanvasRecording() { return this.stream.stopCanvasRecording(); }
    /** Stop the camera and leave camera mode. */
    stopWebcamStreamMode() { this.stream.stopWebcamStreamMode(); }

    // ─── Audio ───────────────────────────────────────────────────────────────────
    async _closeAudioContext() { return closePlayerAudioContext(this); }
    /** Unmute what autoplay muted, now that the user has interacted. @param {string} sourceLabel for the log */
    restoreAutoplayAudio(sourceLabel) { return restorePlayerAutoplayAudio(this, sourceLabel); }

    // ─── Media Lifecycle ─────────────────────────────────────────────────────────
    /** Stop and unload everything: the end of playback, not a step between two videos. */
    async reset() {
        // A reset is the end of playback, not a step between two videos, so
        // the kept-alive embed goes with it.
        teardownPlayerYouTube(this);
        return resetPlayer(this);
    }
    /** Blank the picture and the bar before the next item loads. */
    resetUI() { resetPlayerUI(this); }

    // ─── Playback State ──────────────────────────────────────────────────────────
    /** Play if paused, pause if playing (either direction). */
    togglePlay() {
        if (this.reverse?.active) { this.pause(); return; }
        if (this.direction === 'backward' && this.engine !== 'youtube') { this.play(); return; }
        togglePlayerPlay(this);
    }

    /**
     * Switch which way Play goes. While playing, the switch takes effect at
     * once, from where playback is; while paused, the next Play goes the new
     * way.
     * @returns {Promise<{reason?: string}>} a reason, in words for the user,
     *   when playing backwards is not possible for this media
     */
    async toggleDirection() {
        if (this.direction === 'forward') {
            const reason = this.reverse.unavailableReason;
            if (reason) return { reason };
            const wasPlaying = this.isPlaying;
            this.direction = 'backward';
            this.announce.playState();
            if (wasPlaying) {
                const result = await this._playBackward();
                return result.started ? {} : { reason: result.reason };
            }
            return {};
        }
        const wasReversing = this.reverse.active;
        this.direction = 'forward';
        this.announce.playState();
        if (wasReversing) {
            await this.reverse.stop();
            await this.play();
        }
        return {};
    }
    /** Go to `time` (seconds); resolves once the frame there is shown. @param {number} time */
    async seek(time) {
        this.timing.seekStarted();
        // Playing backwards carries on from wherever the seek lands.
        const wasReversing = !!this.reverse?.active;
        if (wasReversing) await this.reverse.stop({ reposition: false });
        if (this.engine === 'youtube') {
            this.youtube?.seek(time);
            this.currentTime = Math.max(0, time);
            this.announce.progress();
            return;
        }
        await seekPlayerTo(this, time);
        if (wasReversing) await this._playBackward();
    }
    /**
     * Seek, for a burst of seeks (a held key, a dragged bar): the position
     * moves at once, and the decode goes only to the latest target.
     * @param {number} time
     */
    requestSeek(time) { requestPlayerSeek(this, time); }
    /** One frame forward (1) or back (-1), paused. @param {1|-1} direction */
    stepFrame(direction) { stepPlayerFrame(this, direction); }

    /**
     * Open `url` (a file's blob URL, a stream, a YouTube link); resolves when it
     * is ready. @param {string} url @param {boolean} [autoplay] @param {string|null} [videoId]
     * the playlist item, for saved progress @param {Array|null} [savedSubtitles]
     */
    async load(url, autoplay = false, videoId = null, savedSubtitles = null) {
        this.timing.loadStarted();
        return loadPlayerMedia(this, url, autoplay, videoId, savedSubtitles);
    }

    /** Play, in the current direction. */
    async play() {
        if (this.engine === 'youtube') { this.youtube?.play(); return; }
        if (this.direction === 'backward') return this._playBackward();
        // Forwards from wherever playing backwards got to.
        if (this.reverse?.active) await this.reverse.stop();
        return playPlayer(this);
    }

    /**
     * Play backwards, saying why if it cannot start.
     * @private
     */
    async _playBackward() {
        if (this.reverse.active) return { started: true };
        const result = await this.reverse.start();
        if (!result.started && result.reason) this.trigger('reversefailed', { reason: result.reason });
        return result;
    }

    /** Pause. `showOverlay` false: a pause that is one step of something else (a stream then leaves its loading state alone). @param {boolean} [showOverlay] */
    pause(showOverlay = true) {
        if (this.reverse?.active) {
            this.reverse.stop();
            return;
        }
        if (this.engine === 'youtube') {
            // Pausing overrules a pending autoplay retry: without this, a video
            // stopped within the retry window would start itself again.
            cancelYouTubeAutoplayRetry(this);
            this.youtube?.pause();
            return;
        }
        return pausePlayer(this, showOverlay);
    }

    // ─── Playback Rate ───────────────────────────────────────────────────────────
    /**
     * @param {number} rate - 0.25–2
     * @param {{persist?: boolean}} [options] - persist: false for a speed a
     *   tool sets for a while (see override), not the user's choice
     */
    async setPlaybackRate(rate, { persist = true } = {}) {
        if (this.engine === 'youtube') {
            this.playbackRate = rate;
            this.youtube?.setRate(rate);
            return;
        }
        // Playing backwards picks the new speed up from where it is.
        const wasReversing = !!this.reverse?.active;
        if (wasReversing) await this.reverse.stop({ reposition: false });
        await setPlayerPlaybackRate(this, rate, { persist });
        if (wasReversing) await this._playBackward();
    }

    // ─── Temporary values ────────────────────────────────────────────────────────
    /**
     * Take on values for a while (speed, filters, control bar mode, loop)
     * and give them back exactly on release, without saving anything.
     * Overrides stack; see PlayerOverrides.
     * @param {import('./PlayerOverrides.js').OverrideValues} values
     * @returns {() => void} release
     */
    override(values) {
        this._overrides ??= new PlayerOverrides(this);
        return this._overrides.push(values);
    }

    // ─── Volume / Mute ───────────────────────────────────────────────────────────
    /** 0–1, as the user set it (see isMuted). @type {number} */
    get volume() { return this.config.volume; }
    /** @type {boolean} */
    get isMuted() { return this.config.muted; }

    /**
     * @param {number} value 0–1
     * @param {{bezel?: boolean}} [options] bezel: false while a slider is dragged
     */
    setVolume(value, { bezel = true } = {}) {
        this.config.volume = Math.max(0, Math.min(1, value));
        if (this.config.volume > 0) this.config.muted = false;

        this.stream.syncVolumeState();
        syncPlayerVolume(this);
        this.announce.volume();
        if (!bezel) return;

        const volumePercent = Math.round(this.config.volume * 100);
        let icon = 'icon-volume-high';
        if (this.config.muted || this.config.volume === 0) icon = 'icon-volume-mute';
        this._showBezel(icon, this.config.muted ? 'Muted' : `${volumePercent}%`);
    }

    /** Mute or unmute, keeping the volume. */
    toggleMute() {
        this.config.muted = !this.config.muted;

        this.stream.syncVolumeState();
        syncPlayerVolume(this);
        this.announce.volume();
    }

    /** What Play does when nothing is loaded (the playlist picks an item). @param {() => void} callback */
    setPlayCallback(callback) { this.onPlayRequest = callback; }

    /** What Previous and Next do (the playlist). @param {() => void} onPrevious @param {() => void} onNext */
    setNavigationCallbacks(onPrevious, onNext) {
        this.onPrevious = onPrevious;
        this.onNext = onNext;
    }

    /** The clock animated overlays run on, in ms (FramePresenter). */
    overlayTimeMs() { return playerOverlayTimeMs(this); }
    /** Redraw what is on screen (FramePresenter). @param {{overlaysChanged?: boolean}} [options] */
    redraw(options) { redrawPlayer(this, options); }

    // ─── The current source ──────────────────────────────────────────────────────
    //
    // Read-only on purpose. Everything that writes these goes through
    // player.media -- the load pipeline, and one place in the subtitle code
    // that swaps the audio track.
    //
    // Assigning to one of these cannot shadow the component: the getter keeps
    // returning the real value either way. Inside the app it also fails
    // loudly, since every file is an ES module and therefore strict -- checked
    // in a browser, a strict-mode assignment throws TypeError while the same
    // line typed into a console is silently discarded. Worth knowing before
    // concluding from the console that the write worked.

    /**
     * Whether playback is running.
     *
     * An accessor rather than a field because four engines write it -- the
     * transport, the live stream, the webcam path and the YouTube embed, in
     * five files and eighteen places -- and the play/pause button has to
     * follow every one of them. Twelve of those writes remembered to call
     * announce.playState() on the next line. The other five did not, and
     * relied on something nearby doing it: the webcam path plays immediately
     * afterwards, and one is a redundant second assignment of a value already
     * set. That leaves the three YouTube sites -- load, suspend and teardown
     * -- where nothing visibly pairs with the write. Measuring those needs the
     * real embed, so whether the button was ever actually stale there is
     * unverified.
     *
     * Making it a setter turns the convention into something the code cannot
     * forget, whichever of those five was a latent bug and which was merely
     * fragile. On every path that can be driven in a test -- load, play,
     * pause, seek both ways, reaching the end, reload while playing, and the
     * webcam -- the button behaves exactly as it did before.
     *
     * Every existing write keeps its exact syntax, and the explicit
     * calls that were already there are left alone -- they also refresh the
     * overlay, which depends on isLoading and so can need updating when the
     * flag itself has not moved.
     */
    get isPlaying() { return this._isPlaying; }
    set isPlaying(value) {
        if (this._isPlaying === value) return;
        this._isPlaying = value;
        // Nothing else keeps the screen awake for a canvas-drawn video.
        this._wakeLock?.set(value);
        // The constructor sets this before `ui` is built, and the reset paths
        // can run while it is being rebuilt.
        if (this.ui) this.announce.playState();
    }

    // ─── Stream state ────────────────────────────────────────────────────────────
    // These live on PlayerStream, and the player exposes them because the UI,
    // the render loop and the transport all ask the player. They used to be
    // installed onto each instance by a loop over a key list in
    // StreamController, which meant that grepping Player.js for `isLive` --
    // read 27 times across the app, four of them every frame -- found nothing
    // at all, and the only way to learn the property existed was to find the
    // list. Written out, the player's surface is its source.
    //
    // The getters tolerate a missing stream: there is a window in the
    // constructor, between `this.stream = null` and the real one being built,
    // where nothing reads them today but a read would otherwise throw.
    /** Showing a live stream or camera rather than a file (PlayerStream). @type {boolean} */
    get isStreamMode() { return this.stream?.isStreamMode; }
    set isStreamMode(value) { this.stream.isStreamMode = value; }

    /** The source is live: no duration, no seeking past the edge. @type {boolean} */
    get isLive() { return this.stream?.isLive; }
    set isLive(value) { this.stream.isLive = value; }

    // Read-only: the stream owns its video element. A setter used to sit
    // here forwarding to a getter-only property, so calling it would throw.
    /** The element a live stream or camera plays in. @type {HTMLVideoElement|null} */
    get streamVideo() { return this.stream?.streamVideo; }

    /** Showing the camera. @type {boolean} */
    get isWebcamMode() { return this.stream?.isWebcamMode; }
    set isWebcamMode(value) { this.stream.isWebcamMode = value; }

    /** The loaded file, read-only (from `player.media`). */
    get input() { return this.media.input; }
    /** Its video track. */
    get videoTrack() { return this.media.videoTrack; }
    /** Where its video frames are decoded from. */
    get videoSink() { return this.media.videoSink; }
    /** Its audio track. */
    get audioTrack() { return this.media.audioTrack; }
    /** Where its audio is decoded from. */
    get audioSink() { return this.media.audioSink; }

    /** Put one frame on the canvas, with the layers over it (FramePresenter). @param {CanvasImageSource} source @param {{clear?: boolean}} [options] */
    presentFrame(source, options) { presentPlayerFrame(this, source, options); }
    /** Draw over every frame (a layer). @param {Function} callback */
    addRenderCallback(callback) { addPlayerRenderCallback(this, callback); }
    /** @param {Function} callback */
    removeRenderCallback(callback) { removePlayerRenderCallback(this, callback); }

    /** Take the player apart: unload, listeners off, the view and layers removed. */
    async destroy() {
        await this.reset();

        this._wakeLock?.destroy();
        this._wakeLock = null;

        clearPlayerEvents(this);

        await this._closeAudioContext();

        // Listeners, observers and the overlays the view added.
        this.view?.unmount(this);

        // The component owns the generator, which holds decoded frames.
        this.thumbnails?.destroy();

        if (this.videoFilters) {
            this.videoFilters.destroy?.();
            this.videoFilters = null;
        }

        if (this.stickers) {
            // Holds decoded GIF frames, which outlive the reference to them.
            this.stickers.destroy?.();
            this.stickers = null;
        }

        if (this.decorations) {
            this.decorations.destroy?.();
            this.decorations = null;
        }

        if (this.canvas) {
            this.canvas.remove();
            this.canvas = null;
        }

        this.container.classList.remove('jellyjump-container');
        this.container = null;
    }
}
