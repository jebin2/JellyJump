import { MediaBunny } from '../MediaBunny.js';
import { Logger } from '../../shared/utils/Logger.js';

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
        this._wasMutedForAutoplay = false;
        this.streamRenderLoopId = null;
        this._isFetchingLiveFrame = false;
        this._isMediaReady = false;

        // Recording state
        this._isCanvasRecording = false;
        this._canvasChunks = null;
        this._canvasOutput = null;
        this._canvasAudioSource = null;
        this._canvasReadyForMoreFrames = true;
        this._canvasLastFrameNumber = -1;
        this._canvasRecordedDuration = 0;
        this._lastFrameWallTime = null;
        this._resetRecordingClock = false;
        this._recordingAudioContext = null;
        this._audioStreamSource = null;
        this._audioProcessor = null;
        this._audioRecordedDuration = 0;
        this._canvasRecordingPausedTime = 0;
        this._canvasPauseStartTime = null;
        this._canvasStartTime = null;
        this._canvasCaptureInterval = null;
    }

    // ─── Load lifecycle ─────────────────────────────────────────────────────────

    resetForLoad() {
        this.isStreamMode = false;
        this.isWebcamMode = false;
        this.isLive = false;

        if (this.streamVideo && this.streamVideo.srcObject) {
            Logger.log('[Player] Clearing webcam stream in load()');
            this.streamVideo.srcObject = null;
        }
        this.hideStreamVideo();
        this.stopStreamRenderLoop();
    }

    // ─── Play / Pause hooks ──────────────────────────────────────────────────────

    onPlay() {
        if (!this._isCanvasRecording) return;
        if (this._recordingAudioContext && this._recordingAudioContext.state === 'suspended') {
            this._recordingAudioContext.resume();
        }
        if (this._isMediaReady) {
            this.resumeRecordingSmartPause();
        }
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
        if (!this._isCanvasRecording) return;
        if (this._recordingAudioContext && this._recordingAudioContext.state === 'running') {
            this._recordingAudioContext.suspend();
        }
        this._resetRecordingClock = true;
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
            player.ctx.drawImage(this.streamVideo, 0, 0, player.canvas.width, player.canvas.height);
            this._isMediaReady = true;
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

        player.ctx.drawImage(this.streamVideo, 0, 0, player.canvas.width, player.canvas.height);

        if (!this._isMediaReady) {
            this._isMediaReady = true;
            if (player.isPlaying) this.resumeRecordingSmartPause();
        }

        for (const cb of player.afterFrameRenderCallbacks) {
            try { cb(player.canvas, player.ctx); } catch (e) { Logger.warn('After-frame callback error:', e); }
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
        player.asyncId++;

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
            player.ui.filtersBtn, player.ui.loopBtn
        ];

        if (player.screenshotManager?.ui?.btn) controls.push(player.screenshotManager.ui.btn);

        controls.forEach(control => control?.classList.toggle('webcam-mode-hidden', isWebcamMode));

        if (isWebcamMode) {
            player.ui.filterPanel?.classList.remove('visible');
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
        this.player.isPlaying = false;
        this.stopStreamRenderLoop();
        this.player._updatePlayPauseUI();
    }

    // ─── Canvas recording ────────────────────────────────────────────────────────

    async startCanvasRecording(options = {}) {
        if (this._isCanvasRecording) return;

        const player = this.player;
        Logger.log('[Stream] Video Bitrate: 50 Mbps (Raw Quality)');

        this._isCanvasRecording = true;
        this._canvasChunks = [];
        this._canvasAudioSource = null;
        this._canvasReadyForMoreFrames = true;
        this._canvasLastFrameNumber = -1;
        this._canvasRecordedDuration = 0;
        this._lastFrameWallTime = performance.now();
        this._resetRecordingClock = true;
        this._recordingAudioContext = null;
        this._audioStreamSource = null;
        this._audioProcessor = null;
        this._audioRecordedDuration = 0;
        this._canvasRecordingPausedTime = 0;
        this._canvasPauseStartTime = null;

        let audioTrack = options.audioTrack;
        if (!audioTrack && this.streamVideo?.srcObject) {
            const streamSrc = this.streamVideo.srcObject;
            if (streamSrc.getAudioTracks?.().length > 0) {
                audioTrack = streamSrc.getAudioTracks()[0];
            }
        }

        const audioIsEncodable = await MediaBunny.canEncodeAudio('opus', {
            quality: new MediaBunny.Quality({ bitrate: 128000 }),
        });

        this._canvasOutput = new MediaBunny.Output({
            format: new MediaBunny.Mp4OutputFormat({ fastStart: 'fragmented' }),
            target: new MediaBunny.StreamTarget(new WritableStream({
                write: (chunk) => { this._canvasChunks.push(chunk.data); },
            })),
        });

        const frameRate = 30;
        const videoSource = new MediaBunny.CanvasSource(player.canvas, {
            codec: 'avc',
            quality: new MediaBunny.Quality({ bitrate: 50_000_000 }),
            keyFrameInterval: 2,
            latencyMode: 'realtime',
            width: player.canvas.width,
            height: player.canvas.height,
            sizeChangeBehavior: 'contain'
        });
        this._canvasOutput.addVideoTrack(videoSource, { frameRate });

        if (audioTrack && audioIsEncodable) {
            try {
                this._canvasAudioSource = new MediaBunny.AudioSampleSource({
                    codec: 'opus',
                    quality: new MediaBunny.Quality({ bitrate: 128000 }),
                    sampleRate: 48000
                });
                this._canvasOutput.addAudioTrack(this._canvasAudioSource);

                this._recordingAudioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
                this._audioStreamSource = this._recordingAudioContext.createMediaStreamSource(new MediaStream([audioTrack]));
                this._audioProcessor = this._recordingAudioContext.createScriptProcessor(4096, 2, 2);

                this._audioProcessor.onaudioprocess = (e) => {
                    if (!this._isCanvasRecording || this._resetRecordingClock || !this._isMediaReady) return;

                    const inputBuffer = e.inputBuffer;
                    const timestamp = this._audioRecordedDuration;
                    this._audioRecordedDuration += inputBuffer.duration;

                    try {
                        const currentTimestamp = Number(timestamp);
                        if (isNaN(currentTimestamp)) {
                            Logger.warn('[Record] Timestamp is NaN, resetting to 0');
                            this._audioRecordedDuration = 0;
                            return;
                        }

                        const syncedSamples = MediaBunny.AudioSample.fromAudioBuffer(inputBuffer, currentTimestamp);
                        const samplesToAdd = Array.isArray(syncedSamples) ? syncedSamples : [syncedSamples];
                        samplesToAdd.forEach(s => {
                            if (this._canvasAudioSource) {
                                this._canvasAudioSource.add(s).then(() => s.close()).catch(err => {
                                    Logger.warn('[Record] Failed to add audio sample:', err);
                                    s.close();
                                });
                            } else {
                                s.close();
                            }
                        });
                    } catch (err) {
                        Logger.warn('[Record] Audio encode error:', err);
                    }
                };

                this._audioStreamSource.connect(this._audioProcessor);
                this._audioProcessor.connect(this._recordingAudioContext.destination);
                Logger.log('[Record] Manual Audio Pipeline Started');
            } catch (e) {
                Logger.error('[Record] Audio setup failed', e);
                this._canvasAudioSource = null;
            }
        }

        await this._canvasOutput.start();
        this._canvasStartTime = performance.now();

        if (!player.isPlaying && this._canvasAudioSource) {
            try {
                if (typeof this._canvasAudioSource.pause === 'function') {
                    this._canvasAudioSource.pause();
                    Logger.log('[Record] Initialized recording audio in PAUSED state (player is paused)');
                }
            } catch (e) {
                Logger.error('[Record] Failed to set initial pause state for recording audio', e);
            }
        }

        const addVideoFrame = async () => {
            if (!this._isCanvasRecording || !player.isPlaying || !this._isMediaReady) return;
            if (!this._canvasReadyForMoreFrames) return;

            const now = performance.now();
            if (this._resetRecordingClock) {
                this._lastFrameWallTime = now;
                this._resetRecordingClock = false;
                return;
            }

            const delta = (now - this._lastFrameWallTime) / 1000;
            this._lastFrameWallTime = now;
            this._canvasRecordedDuration += delta;

            this._canvasReadyForMoreFrames = false;
            try {
                await videoSource.add(this._canvasRecordedDuration, 1 / frameRate);
            } catch (e) {
                Logger.warn('Frame add error', e);
            }
            this._canvasReadyForMoreFrames = true;
        };

        this._canvasCaptureInterval = setInterval(() => {
            addVideoFrame().catch(e => Logger.error(e));
        }, 1000 / frameRate);

        Logger.log('[Stream] Canvas Recording Started (MediaBunny)');
    }

    resumeRecordingSmartPause() {
        if (this._isCanvasRecording) this._resetRecordingClock = true;
    }

    async stopCanvasRecording() {
        if (!this._isCanvasRecording) return null;

        this._isCanvasRecording = false;
        clearInterval(this._canvasCaptureInterval);
        Logger.log('[Stream] Finalizing Canvas Recording...');

        if (this._audioProcessor) {
            this._audioProcessor.disconnect();
            this._audioProcessor.onaudioprocess = null;
            this._audioProcessor = null;
        }
        if (this._audioStreamSource) {
            this._audioStreamSource.disconnect();
            this._audioStreamSource = null;
        }
        if (this._recordingAudioContext) {
            await this._recordingAudioContext.close();
            this._recordingAudioContext = null;
        }

        if (this._canvasOutput) await this._canvasOutput.finalize();
        this._canvasAudioSource = null;

        if (this._canvasChunks?.length > 0) {
            const blob = new Blob(this._canvasChunks, { type: 'video/mp4' });
            this._canvasOutput = null;
            this._canvasChunks = null;
            return blob;
        }
        return null;
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

        let asyncId = -1;
        let frameCount = 0;
        let drawnCount = 0;

        try {
            this._isLiveLoopActive = true;
            player.asyncId++;
            asyncId = player.asyncId;

            Logger.log(`[Live:Video] Loop starting — asyncId=${asyncId}, liveStartTs=${this._liveStartTimestamp?.toFixed(3)}, audioSink=${!!player.audioSink}, audioContext=${!!player.audioContext}, audioContextState=${player.audioContext?.state}`);

            if (player.videoFrameIterator) {
                Logger.log(`[Live:Video] Closing existing videoFrameIterator`);
                const it = player.videoFrameIterator;
                player.videoFrameIterator = null;
                await it.return().catch(() => { });
            }
            if (player.audioBufferIterator) {
                Logger.log(`[Live:Video] Closing existing audioBufferIterator`);
                const it = player.audioBufferIterator;
                player.audioBufferIterator = null;
                await it.return().catch(() => { });
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
            player.videoFrameIterator = player.videoSink.canvases(anchorContent);
            player.audioBufferIterator = player.audioSink ? player.audioSink.buffers(anchorContent) : null;

            let audioStarted = false;
            const startAudio = () => {
                if (audioStarted || !player.audioBufferIterator || !player.audioContext) return;
                audioStarted = true;
                Logger.log(`[Live:Audio] Starting audio sync loop`);
                player._runAudioIterator(player.audioBufferIterator, this._liveAnchorWall, this._liveAnchorContent);
            };

            player._setLoading(false);
            this._isFetchingLiveFrame = false;
            this._isMediaReady = true;
            if (player.isPlaying) this.resumeRecordingSmartPause();

            // ─── Main Video Rendering Loop (Official Pattern) ───
            const myIterator = player.videoFrameIterator;

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
                    
                    player.ctx.clearRect(0, 0, player.canvas.width, player.canvas.height);
                    player.ctx.drawImage(frame.canvas, 0, 0, player.canvas.width, player.canvas.height);
                    startAudio();
                }

                if (player.asyncId !== asyncId || !this.isLive || !player.isPlaying) {
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
                            player.ctx.drawImage(frame.canvas, 0, 0, player.canvas.width, player.canvas.height);
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
                                    if (player.asyncId !== asyncId || !player.isPlaying) { r(); return; }
                                    if (player.audioContext.currentTime >= targetWall - 0.005) { r(); return; }
                                    requestAnimationFrame(check);
                                };
                                requestAnimationFrame(check);
                            });
                        }

                        player.ctx.clearRect(0, 0, player.canvas.width, player.canvas.height);
                        player.ctx.drawImage(frame.canvas, 0, 0, player.canvas.width, player.canvas.height);
                        drawnCount++;

                        if (drawnCount % 120 === 0) {
                            Logger.log(`[Live:Video] Sync status — late=${((player.audioContext.currentTime - targetWall) * 1000).toFixed(1)}ms, drawn=${drawnCount}, total=${frameCount}`);
                        }

                        for (const cb of player.afterFrameRenderCallbacks) {
                            try { cb(player.canvas, player.ctx); } catch (e) { }
                        }
                    }
                } else {
                    if (!isBackground) {
                        player.ctx.drawImage(frame.canvas, 0, 0, player.canvas.width, player.canvas.height);
                        await new Promise(r => requestAnimationFrame(r));
                    } else {
                        await new Promise(r => setTimeout(r, 100));
                    }
                }
            }
        } catch (e) {
            Logger.warn(`[Live:Video] Loop error: ${e.message}`);
        } finally {
            if (player.asyncId === asyncId) {
                this._isLiveLoopActive = false;
            }
            if (player.asyncId === asyncId) player._setLoading(false);
            Logger.log(`[Live:Video] Loop exited — total=${frameCount ?? 0}, drawn=${drawnCount ?? 0}`);
        }
    }
}
