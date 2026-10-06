import { MediaBunny } from '../MediaBunny.js';
import { Logger } from '../../shared/utils/Logger.js';
import { CanvasRecorder } from './CanvasRecorder.js';

export class PlayerStream {
    constructor(player) {
        this.player = player;

        // Stream state
        this.streamVideo = null;
        this.isStreamMode = false;
        this.isWebcamMode = false;
        this.isLive = false;
        this._liveStartTimestamp = null;
        this._liveAnchorWall = null;
        this._liveAnchorContent = null;
        this._liveAnchorWallOverride = null;
        this._liveAvSyncPaused = false;
        this._liveAvSyncMonitor = null;
        // Declared rather than sprung into existence mid-method, which is how
        // both of these used to appear: a timer handle whose field only
        // existed once something had started it, and a guard that read as
        // undefined until the loop first ran.
        this._liveBadgeTimer = null;
        this._isLiveLoopActive = false;
        this._wasMutedForAutoplay = false;
        this.streamRenderLoopId = null;
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

        if (this.streamVideo && this.streamVideo.srcObject) {
            Logger.log('[Player] Clearing webcam stream in load()');
            this.streamVideo.srcObject = null;
        }
        this.hideStreamVideo();
        this.stopStreamRenderLoop();
    }

    // ─── Play / Pause hooks ──────────────────────────────────────────────────────

    onPlay() {
        this.recorder.onPlaybackResumed(this._isMediaReady);
    }

    async playStream() {
        if (!this.isStreamMode || !this.streamVideo) return false;

        const player = this.player;
        player._setLoading(true);

        try {
            await this.streamVideo.play();
            player.isPlaying = true;
            player._updatePlayPauseUI();
            if (player.ui.playOverlay) player.ui.playOverlay.style.display = 'none';

            if (player.controlBarMode === 'overlay') {
                setTimeout(() => {
                    if (player.isPlaying && player.controlBarMode === 'overlay') {
                        player._startAutoHideTimer();
                    }
                }, 500);
            }
        } catch (e) {
            Logger.warn('[Stream] Play failed:', e.message);

            if (e.name === 'AbortError') {
                Logger.log('[Stream] Play aborted (user paused), not retrying');
                return true;
            }

            Logger.log('[Stream] Autoplay/Play failed (' + e.name + '), trying muted...');
            try {
                player.config.muted = true;
                this.streamVideo.muted = true;
                this.streamVideo.setAttribute('muted', '');
                player._updateVolumeUI();
                await this.streamVideo.play();
                player.isPlaying = true;
                player._updatePlayPauseUI();
                Logger.log('[Stream] Playing muted (touch/click to unmute)');
            } catch (mutedError) {
                Logger.error('[Stream] Even muted play failed:', mutedError);
                if (mutedError.name !== 'AbortError') {
                    player._setLoading(false);
                }
            }
        }

        player._setLoading(false);
        return true;
    }

    onPause() {
        this.recorder.onPlaybackPaused();
    }

    pauseStream(showOverlay) {
        if (!this.isStreamMode || !this.streamVideo) return false;

        const player = this.player;
        this.streamVideo.pause();
        player.isPlaying = false;
        player._clearAutoHideTimer();

        if (showOverlay) player._setLoading(false);

        player._updatePlayPauseUI();
        if (player.ui.playOverlay) {
            const shouldShow = showOverlay && player.config.controls.playOverlay;
            player.ui.playOverlay.style.display = shouldShow ? 'flex' : 'none';
        }
        return true;
    }

    syncVolumeState() {
        const player = this.player;
        if (!this.isStreamMode || !this.streamVideo) return;

        this.streamVideo.volume = player.config.volume;
        this.streamVideo.muted = player.config.muted;

        if (player.config.muted) {
            this.streamVideo.setAttribute('muted', '');
        } else {
            this.streamVideo.removeAttribute('muted');
        }
    }

    // ─── Stream video element ────────────────────────────────────────────────────

    createStreamVideo() {
        if (this.streamVideo) return;

        const player = this.player;
        this.streamVideo = document.createElement('video');
        this.streamVideo.className = 'jellyjump-stream-video jellyjump-video';
        this.streamVideo.setAttribute('playsinline', '');
        this.streamVideo.setAttribute('webkit-playsinline', '');
        this.streamVideo.crossOrigin = player.config.withCredentials ? 'use-credentials' : 'anonymous';

        if (player.config.muted) {
            this.streamVideo.muted = true;
            this.streamVideo.setAttribute('muted', '');
        }
        this.streamVideo.volume = player.config.volume;

        this.streamVideo.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;opacity:0;z-index:-1';

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
            this.streamVideo.style.width = '100%';
            this.streamVideo.style.height = '100%';
            this.streamVideo.style.visibility = 'visible';
        } else {
            this.streamVideo.style.width = '1px';
            this.streamVideo.style.height = '1px';
            this.streamVideo.style.visibility = 'hidden';
        }

        const wrapper = player.container.querySelector('.jellyjump-video-wrapper') || player.container;
        wrapper.appendChild(this.streamVideo);
    }

    showStreamVideo() {
        if (this.player.canvas) this.player.canvas.style.display = 'block';
    }

    hideStreamVideo() {
        if (this.streamVideo) this.streamVideo.style.display = 'none';
        if (this.player.canvas) this.player.canvas.style.display = 'block';
        this.setStreamModeControls(false);
    }

    setupStreamVideoEvents() {
        if (!this.streamVideo) return;

        const player = this.player;

        this.streamVideo.onplaying = () => {
            if (this.isStreamMode) {
                player._setLoading(false);
                this.hideStreamError();
            }
        };

        this.streamVideo.onended = () => {
            if (this.isStreamMode && player.onEnded) player.onEnded();
        };

        this.streamVideo.onplay = () => {
            if (this.streamVideo.paused) {
                Logger.log('[Stream] Ignoring stale onplay event - video is paused');
                return;
            }
            player.isPlaying = true;
            player._updatePlayPauseUI();
            if (player.ui.playOverlay) player.ui.playOverlay.style.display = 'none';
            this.startStreamRenderLoop();
            if (player.controlBarMode === 'overlay') {
                setTimeout(() => {
                    if (player.isPlaying && player.controlBarMode === 'overlay') {
                        player._startAutoHideTimer();
                    }
                }, 500);
            }
        };

        this.streamVideo.onpause = () => {
            player.isPlaying = false;
            player._clearAutoHideTimer();
            this.stopStreamRenderLoop();
            player._updatePlayPauseUI();
        };

        this.streamVideo.onloadedmetadata = () => {
            if (this.streamVideo.videoWidth && this.streamVideo.videoHeight) {
                player.canvas.width = this.streamVideo.videoWidth;
                player.canvas.height = this.streamVideo.videoHeight;
                Logger.log('[Stream] Canvas size set to:', player.canvas.width, 'x', player.canvas.height);
                this.renderStreamFrame();
            }
        };

        this.streamVideo.addEventListener('click', () => {
            if (player.config.controls.playOverlay) player.togglePlay();
        });
    }

    // ─── Stream render loop ──────────────────────────────────────────────────────

    startStreamRenderLoop() {
        if (this.streamRenderLoopId) return;

        const player = this.player;
        const render = () => {
            if (!player.isPlaying || !this.streamVideo) {
                this.stopStreamRenderLoop();
                return;
            }
            // Through renderStreamFrame rather than a second copy of it. This
            // loop used to draw the frame itself, which meant the camera was
            // the one render path in the app that never ran
            // afterFrameRenderCallbacks -- so nothing could draw over it.
            this.renderStreamFrame();
            this.streamRenderLoopId = requestAnimationFrame(render);
        };
        this.streamRenderLoopId = requestAnimationFrame(render);
    }

    stopStreamRenderLoop() {
        if (this.streamRenderLoopId) {
            cancelAnimationFrame(this.streamRenderLoopId);
            this.streamRenderLoopId = null;
            Logger.log('[Stream] Stopped canvas render loop');
        }
    }
    renderStreamFrame() {
        const player = this.player;
        if (!this.streamVideo || !player.ctx || !player.canvas) return;
        if (this.streamVideo.readyState < 2) return;

        player.presentFrame(this.streamVideo);

        if (!this._isMediaReady) {
            this._isMediaReady = true;
            if (player.isPlaying) this.resumeRecordingSmartPause();
        }
    }

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

        this.setStreamModeControls(true);
    }

    async jumpToLiveEdge() {
        const player = this.player;
        if (!this.isLive || !player.videoTrack) return;

        this._liveAnchorWall = null;
        this._liveAnchorContent = null;
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
        if (this._liveAnchorWall && player.audioContext) {
            const elapsedSinceAnchor = player.audioContext.currentTime - this._liveAnchorWall;
            const liveWallPos = this._liveAnchorContent + elapsedSinceAnchor;
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

    setStreamModeControls(isStreamMode) {
        const { ui } = this.player;
        [ui.ccBtn, ui.speedBtn, ui.loopBtn].forEach(control => {
            control?.classList.toggle('stream-mode-hidden', isStreamMode);
        });
    }

    setWebcamModeControls(isWebcamMode) {
        const player = this.player;
        const controls = [
            player.ui.progressContainer, player.ui.timeDisplay,
            player.ui.prevBtn, player.ui.nextBtn,
            player.ui.volumeSlider, player.ui.muteBtn,
            player.ui.ccBtn, player.ui.speedBtn,
            player.ui.audioBtn, player.ui.audioSettingsBtn,
            player.ui.loopBtn
        ];

        if (player.screenshotManager?.ui?.btn) controls.push(player.screenshotManager.ui.btn);


        controls.forEach(control => control?.classList.toggle('webcam-mode-hidden', isWebcamMode));

        if (isWebcamMode) {
            // The filters button stays: its effects are baked into the frame
            // in camera mode, so what you see is what gets recorded. It was
            // hidden while they were CSS-only, when turning one on would have
            // changed the preview and left the recording untouched.
            player.ui.audioPanel?.classList.remove('visible');
            player.ui.loopPanel?.classList.remove('visible');
        }
    }

    // ─── HLS / Live cleanup ──────────────────────────────────────────────────────

    cleanupHLS() {
        this.isStreamMode = false;
        this.isLive = false;
        this._isLiveLoopActive = false;
        this._liveStartTimestamp = null;
        this._liveAnchorWall = null;
        this._liveAnchorContent = null;

        if (this._liveAvSyncMonitor) {
            clearInterval(this._liveAvSyncMonitor);
            this._liveAvSyncMonitor = null;
        }
        this._liveAvSyncPaused = false;

        const { ui } = this.player;
        if (ui.liveBadge) {
            ui.liveBadge.remove();
            ui.liveBadge = null;
        }
        ui.progressContainer?.classList.remove('live-mode-hidden');
        ui.timeDisplay?.classList.remove('live-mode-hidden');

        this.hideStreamError();
    }

    // ─── Error overlay ───────────────────────────────────────────────────────────

    createErrorOverlay() {
        const player = this.player;
        const overlay = document.createElement('div');
        overlay.className = 'jellyjump-error-overlay';
        overlay.style.display = 'none';
        overlay.innerHTML = `
            <div class="jellyjump-error-content">
                <span class="jellyjump-error-icon">⚠️</span>
                <h3 class="jellyjump-error-title">Stream Error</h3>
                <p class="jellyjump-error-message">Failed to load stream.</p>
                <p class="jellyjump-error-suggestion"></p>
                <div class="jellyjump-error-actions">
                    <button class="jellyjump-btn-secondary jellyjump-error-retry">Retry</button>
                    <button class="hidden jellyjump-btn-secondary jellyjump-error-dismiss">Dismiss</button>
                </div>
            </div>
        `;

        const wrapper = player.container.querySelector('.jellyjump-video-wrapper') || player.container;
        wrapper.appendChild(overlay);
        player.ui.errorOverlay = overlay;

        overlay.querySelector('.jellyjump-error-retry').addEventListener('click', () => {
            this.hideStreamError();
            if (player.sourceUrl) player.load(player.sourceUrl, false, player.currentVideoId);
        });
        overlay.querySelector('.jellyjump-error-dismiss').addEventListener('click', () => this.hideStreamError());
    }

    showStreamError(errorDetails) {
        const { ui } = this.player;
        if (!ui.errorOverlay) return;

        const overlay = ui.errorOverlay;
        overlay.querySelector('.jellyjump-error-icon').textContent = errorDetails.icon || '⚠️';
        overlay.querySelector('.jellyjump-error-title').textContent = errorDetails.title || 'Stream Error';
        overlay.querySelector('.jellyjump-error-message').textContent = errorDetails.message || 'Failed to load stream.';
        overlay.querySelector('.jellyjump-error-suggestion').textContent = errorDetails.suggestion || '';
        overlay.querySelector('.jellyjump-error-retry').style.display = errorDetails.recoverable ? 'inline-block' : 'none';

        this.player._setLoading(false);
        overlay.style.display = 'flex';

        if (window.parent && window.parent !== window) {
            window.parent.postMessage({
                type: 'streamError',
                error: {
                    type: errorDetails.type,
                    title: errorDetails.title,
                    message: errorDetails.message,
                    recoverable: errorDetails.recoverable
                }
            }, '*');
        }
    }

    hideStreamError() {
        if (this.player.ui.errorOverlay) this.player.ui.errorOverlay.style.display = 'none';
    }

    // ─── Webcam stream ───────────────────────────────────────────────────────────

    async loadWebcamStream(stream) {
        const player = this.player;
        player._setLoading(true);
        this._isMediaReady = false;

        player.pause(false);
        await player._cleanupMediaBunny();

        this.createStreamVideo();
        this.setupStreamVideoEvents();

        this.streamVideo.srcObject = stream;
        this.streamVideo.muted = true;
        this.streamVideo.autoplay = true;

        this.isStreamMode = true;
        this.isWebcamMode = true;
        player.isPlaying = true;
        this.showStreamVideo();
        player._syncOverlayBaking?.();
        this.setWebcamModeControls(true);
        player._setLoading(false);

        try {
            await player.play();
        } catch (err) {
            if (err.name !== 'AbortError') throw err;
            Logger.log('[Stream] Webcam play() interrupted (expected if switching back quickly).');
        }

        if (this.streamVideo.videoWidth && this.streamVideo.videoHeight) {
            player.canvas.width = this.streamVideo.videoWidth;
            player.canvas.height = this.streamVideo.videoHeight;
        }

        this.startStreamRenderLoop();
        player._updatePlayPauseUI();
    }

    stopWebcamStreamMode() {
        if (this.streamVideo) {
            this.streamVideo.srcObject = null;
            this.streamVideo.pause();
        }
        this.isStreamMode = false;
        // After the flag, not before: the decision reads isStreamMode, and
        // asking while it still said "camera" left baking switched on.
        this.player._syncOverlayBaking?.();
        this.player.isPlaying = false;
        this.stopStreamRenderLoop();
        this.player._updatePlayPauseUI();
    }

    // ─── Canvas recording ────────────────────────────────────────────────────────
    //
    // Kept as delegates so Player and ScreenRecorderMenu are untouched. The
    // only stream-specific part left is finding an audio track on the
    // element, which is knowledge the recorder should not need.

    async startCanvasRecording(options = {}) {
        let { audioTrack } = options;
        if (!audioTrack && this.streamVideo?.srcObject) {
            const source = this.streamVideo.srcObject;
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

            this._liveAnchorWall = anchorWall;
            this._liveAnchorContent = anchorContent;

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
                player._runAudioIterator(audioIterator, this._liveAnchorWall, this._liveAnchorContent);
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
                if (!player._hasSnappedAnchor && this.isLive && Math.abs(frame.timestamp - anchorContent) > 120) {
                    // This frame is from a stale segment (likely pre-pause cache). Discard it.
                    if (frameCount % 60 === 0) {
                        Logger.warn(`[Live:Video] Discarding stale frame (ts=${frame.timestamp.toFixed(3)}, expected=${anchorContent.toFixed(3)})`);
                    }
                    continue; 
                }

                if (!player._hasSnappedAnchor) {
                    this._liveAnchorContent = frame.timestamp;
                    this._liveAnchorWall = player.audioContext ? player.audioContext.currentTime : 0;
                    player._hasSnappedAnchor = true;
                    Logger.log(`[Live] Anchor snapped to first frame — content=${frame.timestamp.toFixed(3)}, wall=${this._liveAnchorWall.toFixed(3)}`);
                    
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
                const dynamicAnchorWall = this._liveAnchorWall;
                const dynamicAnchorContent = this._liveAnchorContent;

                if (dynamicAnchorWall !== null && dynamicAnchorContent !== null && player.audioContext) {
                    const currentTime = player.audioContext.currentTime;
                    const outputLatency = player.audioContext.outputLatency || 0;
                    const targetWall = dynamicAnchorWall + (frame.timestamp - dynamicAnchorContent) + outputLatency;
                    const drift = currentTime - targetWall;

                    if (drift > 0.25) {
                        if (frameCount % 120 === 0 || drift > 2.0) {
                            if (frameCount % 120 === 0) Logger.log(`[Live:Video] Catching up — behind=${drift.toFixed(3)}s, frame=${frameCount}`);
                            if (drift > 1.0) {
                                player._setLoading(true);
                                this._updateLiveBadgeState();
                            }
                        }

                        if (drift > 30.0) {
                            Logger.warn(`[Live:Video] Massive drift detected (${drift.toFixed(1)}s) — jumping to live edge`);
                            if (player.videoTrack) {
                                const currentLiveEdge = await player.videoTrack.getDurationFromMetadata({ skipLiveWait: true });
                                this._liveStartTimestamp = currentLiveEdge ?? 0;
                                setTimeout(() => this.startLiveVideoLoop(true), 0);
                                break; 
                            }
                        }

                        if (!isBackground) {
                            player.presentFrame(frame.canvas);
                        }
                        continue;
                    }

                    if (!audioStarted) startAudio();
                    player._setLoading(false);

                    if (isBackground) {
                        await new Promise(r => setTimeout(r, 100));
                    } else {
                        if (currentTime < targetWall - 0.005) {
                            await new Promise(r => {
                                const check = () => {
                                    if (player.epoch.isStale(epoch) || !player.isPlaying) { r(); return; }
                                    if (player.audioContext.currentTime >= targetWall - 0.005) { r(); return; }
                                    requestAnimationFrame(check);
                                };
                                requestAnimationFrame(check);
                            });
                        }

                        player.presentFrame(frame.canvas, { clear: true });
                        drawnCount++;

                        if (drawnCount % 120 === 0) {
                            Logger.log(`[Live:Video] Sync status — late=${((player.audioContext.currentTime - targetWall) * 1000).toFixed(1)}ms, drawn=${drawnCount}, total=${frameCount}`);
                        }

                    }
                } else {
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
