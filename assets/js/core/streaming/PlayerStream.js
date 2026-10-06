import { MediaBunny } from '../MediaBunny.js';
import { PlaybackAnchor } from '../playback/PlaybackAnchor.js';
import { scheduleLiveFrame } from './LiveFrameSchedule.js';
import { StreamVideoSource } from './StreamVideoSource.js';
import { Logger } from '../../shared/utils/Logger.js';
import { CanvasRecorder } from './CanvasRecorder.js';

export class PlayerStream {
    constructor(player) {
        this.player = player;

        // Stream state
        this.isStreamMode = false;
        this.isWebcamMode = false;
        this.isLive = false;
        this._liveStartTimestamp = null;
        this.anchor = new PlaybackAnchor();
        this.video = new StreamVideoSource(player, this);
        this._liveAvSyncMonitor = null;
        // Declared rather than sprung into existence mid-method, which is how
        // both of these used to appear: a timer handle whose field only
        // existed once something had started it, and a guard that read as
        // undefined until the loop first ran.
        this._liveBadgeTimer = null;
        this._isLiveLoopActive = false;
        this._wasMutedForAutoplay = false;
        this._isFetchingLiveFrame = false;
        this._isMediaReady = false;

        // Recording lives in its own component now: it reads the canvas and
        // needs three events from here, so there is no reason for its eleven
        // fields to sit among the stream's.
        this.recorder = new CanvasRecorder(player, () => this._isMediaReady);
    }

    // ─── Load lifecycle ─────────────────────────────────────────────────────────

    resetForLoad() {
        this.isStreamMode = false;
        this.isWebcamMode = false;
        this.isLive = false;
        // The other way out of the camera: loading a file never reaches
        // stopWebcamStreamMode. Left on, canvas mode would keep suppressing
        // the CSS filters that playback draws with, and the filter panel
        // would look broken for the rest of the session.
        this.player._syncOverlayBaking?.();

        if (this.video.streamVideo && this.video.streamVideo.srcObject) {
            Logger.log('[Player] Clearing webcam stream in load()');
            this.video.streamVideo.srcObject = null;
        }
        this.video.hideStreamVideo();
        this.video.stopStreamRenderLoop();
    }

    // ─── Play / Pause hooks ──────────────────────────────────────────────────────

    onPlay() {
        this.recorder.onPlaybackResumed(this._isMediaReady);
    }


    onPause() {
        this.recorder.onPlaybackPaused();
    }


    syncVolumeState() {
        const player = this.player;
        if (!this.isStreamMode || !this.video.streamVideo) return;

        this.video.streamVideo.volume = player.config.volume;
        this.video.streamVideo.muted = player.config.muted;

        if (player.config.muted) {
            this.video.streamVideo.setAttribute('muted', '');
        } else {
            this.video.streamVideo.removeAttribute('muted');
        }
    }

    // ─── Stream video element ────────────────────────────────────────────────────

    // ─── Stream render loop ──────────────────────────────────────────────────────

    // ─── Stream UI ───────────────────────────────────────────────────────────────

    updateStreamUI() {
        const player = this.player;

        if (this.isLive) {
            if (!player.ui.liveBadge) {
                player.ui.liveBadge = document.createElement('button');
                player.ui.liveBadge.className = 'jellyjump-live-badge';
                player.ui.liveBadge.textContent = 'LIVE';
                player.ui.liveBadge.onclick = () => this.jumpToLiveEdge();

                const timeContainer = player.ui.timeDisplay?.parentNode;
                if (timeContainer) timeContainer.insertBefore(player.ui.liveBadge, player.ui.timeDisplay);
            }
            player.ui.liveBadge.style.display = 'inline-flex';
            player.ui.progressContainer?.classList.add('live-mode-hidden');
            player.ui.timeDisplay?.classList.add('live-mode-hidden');

            // Periodic check for live drift
            if (!this._liveBadgeTimer) {
                this._liveBadgeTimer = setInterval(() => this._updateLiveBadgeState(), 1000);
            }
        } else {
            if (this._liveBadgeTimer) {
                clearInterval(this._liveBadgeTimer);
                this._liveBadgeTimer = null;
            }
            if (player.ui.liveBadge) player.ui.liveBadge.style.display = 'none';
            player.ui.progressContainer?.classList.remove('live-mode-hidden');
            player.ui.timeDisplay?.classList.remove('live-mode-hidden');
        }

        this.video.setStreamModeControls(true);
    }

    async jumpToLiveEdge() {
        const player = this.player;
        if (!this.isLive || !player.videoTrack) return;

        this.anchor.clear();
        player.epoch.bump();

        Logger.log('[Live] User requested jump to live edge');
        player._setLoading(true);

        try {
            const currentLiveEdge = await player.videoTrack.getDurationFromMetadata({ skipLiveWait: true });
            const refreshInterval = await player.videoTrack.getLiveRefreshInterval();
            // Use a more aggressive backoff (2 segments) for manual jumps to stay closer to edge
            const backoff = (refreshInterval || 6) * 2;

            const targetTs = Math.max(0, (currentLiveEdge ?? 0) - backoff);
            player._liveStartTimestamp = targetTs;
            this._liveStartTimestamp = targetTs;

            // Restart the loop at the edge
            this.startLiveVideoLoop(true);
        } catch (e) {
            Logger.warn('[Live] Failed to jump to live edge:', e);
            player._setLoading(false);
        }
    }

    _updateLiveBadgeState() {
        const player = this.player;
        if (!player.ui.liveBadge || !this.isLive) return;

        const currentTime = player._getPlaybackTime();

        // We estimate the current live edge based on our anchor and elapsed wall time
        // isAnchored, not truthiness: a real anchor at wall 0 -- which is what
        // a fresh AudioContext gives -- used to read as no anchor, and this
        // stopped measuring drift without saying so.
        if (this.anchor.isAnchored && player.audioContext) {
            const elapsedSinceAnchor = player.audioContext.currentTime - this.anchor.wall;
            const liveWallPos = this.anchor.content + elapsedSinceAnchor;
            const drift = liveWallPos - currentTime;

            // If we are more than 10s behind the "moving" live anchor, mark as not-live
            if (drift > 10.0) {
                if (!player.ui.liveBadge.classList.contains('not-live')) {
                    player.ui.liveBadge.classList.add('not-live');
                    player.ui.liveBadge.textContent = 'NOT LIVE';
                }
                player.ui.liveBadge.title = `You are ${Math.round(drift)}s behind. Click to go live.`;
            } else {
                if (player.ui.liveBadge.classList.contains('not-live')) {
                    player.ui.liveBadge.classList.remove('not-live');
                    player.ui.liveBadge.textContent = 'LIVE';
                }
                player.ui.liveBadge.title = 'You are live';
            }
        }
    }


    // ─── Stream video (camera / screen capture) ──────────────────────────────────
    // Delegated: the pipeline lives in StreamVideoSource, but the transport and
    // the player facade have always asked the controller.
    get streamVideo() { return this.video.streamVideo; }
    async playStream() { return this.video.playStream(); }
    pauseStream(showOverlay) { return this.video.pauseStream(showOverlay); }
    async loadWebcamStream(stream) { return this.video.loadWebcamStream(stream); }
    stopWebcamStreamMode() { return this.video.stopWebcamStreamMode(); }
    renderStreamFrame() { return this.video.renderStreamFrame(); }
    setStreamModeControls(on) { return this.video.setStreamModeControls(on); }
    setWebcamModeControls(on) { return this.video.setWebcamModeControls(on); }

    // ─── HLS / Live cleanup ──────────────────────────────────────────────────────

    cleanupHLS() {
        this.isStreamMode = false;
        this.isLive = false;
        this._isLiveLoopActive = false;
        this._liveStartTimestamp = null;
        this.anchor.reset();

        if (this._liveAvSyncMonitor) {
            clearInterval(this._liveAvSyncMonitor);
            this._liveAvSyncMonitor = null;
        }

        const { ui } = this.player;
        if (ui.liveBadge) {
            ui.liveBadge.remove();
            ui.liveBadge = null;
        }
        ui.progressContainer?.classList.remove('live-mode-hidden');
        ui.timeDisplay?.classList.remove('live-mode-hidden');
    }

    // ─── Webcam stream ───────────────────────────────────────────────────────────

    // ─── Canvas recording ────────────────────────────────────────────────────────
    //
    // Kept as delegates so Player and ScreenRecorderMenu are untouched. The
    // only stream-specific part left is finding an audio track on the
    // element, which is knowledge the recorder should not need.

    async startCanvasRecording(options = {}) {
        let { audioTrack } = options;
        if (!audioTrack && this.video.streamVideo?.srcObject) {
            const source = this.video.streamVideo.srcObject;
            if (source.getAudioTracks?.().length > 0) audioTrack = source.getAudioTracks()[0];
        }
        return this.recorder.start({ ...options, audioTrack });
    }

    async stopCanvasRecording() {
        return this.recorder.stop();
    }

    resumeRecordingSmartPause() {
        this.recorder.onFramePresented();
    }

    // ─── Live video loop ─────────────────────────────────────────────────────────

    async startLiveVideoLoop(force = false) {
        const player = this.player;

        if (this._isLiveLoopActive && !force) {
            Logger.log('[Live:Video] Loop already active, ignoring redundant start');
            return;
        }

        if (!player.videoSink) {
            Logger.warn('[Live:Video] No videoSink - cannot start');
            return;
        }

        let epoch = -1;
        let frameCount = 0;
        let drawnCount = 0;

        try {
            this._isLiveLoopActive = true;
            epoch = player.epoch.bump();

            Logger.log(`[Live:Video] Loop starting — epoch=${epoch}, liveStartTs=${this._liveStartTimestamp?.toFixed(3)}, audioSink=${!!player.audioSink}, audioContext=${!!player.audioContext}, audioContextState=${player.audioContext?.state}`);

            if (player.frames.isOpen) {
                Logger.log(`[Live:Video] Closing existing frame queue`);
                await player.frames.close().catch(() => { });
            }
            if (player.audioBuffers.isOpen) {
                Logger.log(`[Live:Video] Closing existing audio queue`);
                await player.audioBuffers.close().catch(() => { });
            }

            player._setLoading(true);
            const resumePosition = this._liveStartTimestamp;

            // ─── Instant Anchoring (Official Pattern) ───
            const anchorWall = player.audioContext ? player.audioContext.currentTime : 0;
            const anchorContent = resumePosition ?? 0;

            this.anchor.set(anchorWall, anchorContent);

            Logger.log(`[Live] Instant Anchor set — wall=${anchorWall.toFixed(3)}, content=${anchorContent.toFixed(3)}`);

            // Start iterators in parallel
            const videoIterator = player.frames.open(player.videoSink, anchorContent);
            const audioIterator = player.audioBuffers.open(player.audioSink, anchorContent);

            let audioStarted = false;
            const startAudio = () => {
                // holds(), not just a non-null local: this runs from inside the
                // frame loop, after awaits, so a resync may have closed the
                // queue since it was opened. Reading the field live used to be
                // what stopped audio starting in that case. The null check
                // stays because an item with no audio sink opens to null, and
                // an empty queue holds null too.
                if (audioStarted || !audioIterator || !player.audioBuffers.holds(audioIterator)
                    || !player.audioContext) return;
                audioStarted = true;
                Logger.log(`[Live:Audio] Starting audio sync loop`);
                player._runAudioIterator(audioIterator, this.anchor.wall, this.anchor.content);
            };

            player._setLoading(false);
            this._isFetchingLiveFrame = false;
            this._isMediaReady = true;
            if (player.isPlaying) this.resumeRecordingSmartPause();

            // ─── Main Video Rendering Loop (Official Pattern) ───
            const myIterator = videoIterator;

            while (true) {
                let result;
                try {
                    // Watchdog: If a frame takes > 6s to arrive, something is wrong
                    result = await Promise.race([
                        myIterator.next(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000))
                    ]);
                } catch (e) {
                    Logger.warn(`[Live:Video] Iterator stalled or failed: ${e.message} — forcing resync`);
                    await player._startLiveVideoLoop(true); // force restart
                    break;
                }

                if (result.done || !result.value) break;
                const frame = result.value;
                frameCount++;

                // Validate frame timestamp for Live streams
                if (!this.anchor.hasSnapped && this.isLive && Math.abs(frame.timestamp - anchorContent) > 120) {
                    // This frame is from a stale segment (likely pre-pause cache). Discard it.
                    if (frameCount % 60 === 0) {
                        Logger.warn(`[Live:Video] Discarding stale frame (ts=${frame.timestamp.toFixed(3)}, expected=${anchorContent.toFixed(3)})`);
                    }
                    continue; 
                }

                if (!this.anchor.hasSnapped) {
                    this.anchor.snapTo(
                        player.audioContext ? player.audioContext.currentTime : 0,
                        frame.timestamp,
                    );
                    Logger.log(`[Live] Anchor snapped to first frame — content=${frame.timestamp.toFixed(3)}, wall=${this.anchor.wall.toFixed(3)}`);
                    
                    player.presentFrame(frame.canvas, { clear: true });
                    startAudio();
                }

                if (player.epoch.isStale(epoch) || !this.isLive || !player.isPlaying) {
                    Logger.log(`[Live:Video] Loop breaking — active=${player.isPlaying}, live=${this.isLive}`);
                    break;
                }

                if (player.canvas.width !== frame.canvas.width || player.canvas.height !== frame.canvas.height) {
                    player.canvas.width = frame.canvas.width;
                    player.canvas.height = frame.canvas.height;
                }

                const isBackground = document.hidden;
                const schedule = player.audioContext
                    ? scheduleLiveFrame({
                        anchor: this.anchor,
                        frameTimestamp: frame.timestamp,
                        now: player.audioContext.currentTime,
                        outputLatency: player.audioContext.outputLatency || 0,
                    })
                    : { kind: 'unanchored' };

                let action = schedule.kind;
                if (action === 'jumpToEdge') {
                    Logger.warn(`[Live:Video] Massive drift detected (${schedule.drift.toFixed(1)}s) — jumping to live edge`);
                    if (player.videoTrack) {
                        const currentLiveEdge = await player.videoTrack.getDurationFromMetadata({ skipLiveWait: true });
                        this._liveStartTimestamp = currentLiveEdge ?? 0;
                        setTimeout(() => this.startLiveVideoLoop(true), 0);
                        break;
                    }
                    // Nothing to ask where the edge is, so catch up instead.
                    action = 'catchUp';
                }

                if (action === 'catchUp') {
                    // The periodic report and the spinner both depend on how
                    // many frames have gone by, so they stay here.
                    if (frameCount % 120 === 0 || schedule.loud) {
                        if (frameCount % 120 === 0) Logger.log(`[Live:Video] Catching up — behind=${schedule.drift.toFixed(3)}s, frame=${frameCount}`);
                        if (schedule.showLoading) {
                            player._setLoading(true);
                            this._updateLiveBadgeState();
                        }
                    }

                    if (!isBackground) {
                        player.presentFrame(frame.canvas);
                    }
                    continue;
                }

                if (action === 'present') {
                    if (!audioStarted) startAudio();
                    player._setLoading(false);

                    if (isBackground) {
                        await new Promise(r => setTimeout(r, 100));
                    } else {
                        if (player.audioContext.currentTime < schedule.waitUntil) {
                            await new Promise(r => {
                                const check = () => {
                                    if (player.epoch.isStale(epoch) || !player.isPlaying) { r(); return; }
                                    if (player.audioContext.currentTime >= schedule.waitUntil) { r(); return; }
                                    requestAnimationFrame(check);
                                };
                                requestAnimationFrame(check);
                            });
                        }

                        player.presentFrame(frame.canvas, { clear: true });
                        drawnCount++;

                        if (drawnCount % 120 === 0) {
                            Logger.log(`[Live:Video] Sync status — late=${((player.audioContext.currentTime - schedule.targetWall) * 1000).toFixed(1)}ms, drawn=${drawnCount}, total=${frameCount}`);
                        }
                    }
                } else if (action === 'unanchored') {
                    if (!isBackground) {
                        player.presentFrame(frame.canvas);
                        await new Promise(r => requestAnimationFrame(r));
                    } else {
                        await new Promise(r => setTimeout(r, 100));
                    }
                }
            }
        } catch (e) {
            Logger.warn(`[Live:Video] Loop error: ${e.message}`);
        } finally {
            if (!player.epoch.isStale(epoch)) {
                this._isLiveLoopActive = false;
            }
            if (!player.epoch.isStale(epoch)) player._setLoading(false);
            Logger.log(`[Live:Video] Loop exited — total=${frameCount ?? 0}, drawn=${drawnCount ?? 0}`);
        }
    }
}
