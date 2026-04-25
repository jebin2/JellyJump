import { MediaBunny } from '../MediaBunny.js';
import { Logger } from '../../utils/Logger.js';

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
                player.ui.liveBadge = document.createElement('span');
                player.ui.liveBadge.className = 'jellyjump-live-badge';
                player.ui.liveBadge.textContent = 'LIVE';
                player.ui.liveBadge.style.display = 'inline-flex';

                const timeContainer = player.ui.timeDisplay?.parentNode;
                if (timeContainer) timeContainer.insertBefore(player.ui.liveBadge, player.ui.timeDisplay);
            }
            player.ui.liveBadge.style.display = 'inline-flex';
            player.ui.progressContainer?.classList.add('live-mode-hidden');
            player.ui.timeDisplay?.classList.add('live-mode-hidden');
        } else {
            if (player.ui.liveBadge) player.ui.liveBadge.style.display = 'none';
            player.ui.progressContainer?.classList.remove('live-mode-hidden');
            player.ui.timeDisplay?.classList.remove('live-mode-hidden');
        }

        this.setStreamModeControls(true);
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
        this._liveStartTimestamp = null;

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

        const audioIsEncodable = await MediaBunny.canEncodeAudio('opus', { bitrate: 128000 });

        this._canvasOutput = new MediaBunny.Output({
            format: new MediaBunny.Mp4OutputFormat({ fastStart: 'fragmented' }),
            target: new MediaBunny.StreamTarget(new WritableStream({
                write: (chunk) => { this._canvasChunks.push(chunk.data); },
            })),
        });

        const frameRate = 30;
        const videoSource = new MediaBunny.CanvasSource(player.canvas, {
            codec: 'avc',
            bitrate: 50_000_000,
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
                    bitrate: 128000,
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

    async startLiveVideoLoop() {
        const player = this.player;

        if (!player.videoSink) {
            Logger.warn('[Live:Video] No videoSink - cannot start');
            return;
        }

        player.asyncId++;
        const asyncId = player.asyncId;

        Logger.log(`[Live:Video] Loop starting — asyncId=${asyncId}, liveStartTs=${this._liveStartTimestamp?.toFixed(3)}, audioSink=${!!player.audioSink}, audioContext=${!!player.audioContext}, audioContextState=${player.audioContext?.state}`);

        if (player.videoFrameIterator) {
            Logger.log(`[Live:Video] Closing existing videoFrameIterator`);
            await player.videoFrameIterator.return();
        }
        if (player.audioBufferIterator) {
            Logger.log(`[Live:Video] Closing existing audioBufferIterator`);
            await player.audioBufferIterator.return();
        }
        player.audioBufferIterator = null;

        player._setLoading(true);
        this._isFetchingLiveFrame = true;

        const resumePosition = this._liveStartTimestamp;
        const fetchStart = performance.now();
        player.videoFrameIterator = player.videoSink.canvases(resumePosition ?? undefined);

        let anchorWall = null;
        let anchorContent = null;
        let prefetchedAudioSample = null;
        let firstVideoFrame = null;

        const hasAudio = !!(player.audioSink && player.audioContext);

        if (hasAudio) {
            player.audioBufferIterator = player.audioSink.samples(resumePosition ?? 0);
            Logger.log(`[Live] Fetching first video+audio frames in parallel from ts=${resumePosition?.toFixed(3)}`);

            const [videoResult, audioResult] = await Promise.all([
                player.videoFrameIterator.next(),
                player.audioBufferIterator.next(),
            ]);

            const fetchMs = (performance.now() - fetchStart).toFixed(0);
            if (!videoResult.done && videoResult.value) firstVideoFrame = videoResult.value;
            if (!audioResult.done && audioResult.value) prefetchedAudioSample = audioResult.value;

            Logger.log(`[Live] Both first frames received in ${fetchMs}ms — videoTs=${firstVideoFrame?.timestamp?.toFixed(3)}, audioTs=${prefetchedAudioSample?.timestamp?.toFixed(3)}, audioCtx=${player.audioContext.currentTime.toFixed(3)}`);
        } else {
            Logger.log(`[Live:Video] No audio — fetching first video frame from ts=${this._liveStartTimestamp?.toFixed(3)}`);
            const videoResult = await player.videoFrameIterator.next();
            const fetchMs = (performance.now() - fetchStart).toFixed(0);
            if (!videoResult.done && videoResult.value) firstVideoFrame = videoResult.value;
            Logger.log(`[Live:Video] First frame in ${fetchMs}ms — ts=${firstVideoFrame?.timestamp?.toFixed(3)}`);
        }

        if (player.asyncId !== asyncId) {
            Logger.warn(`[Live] Cancelled after first-frame fetch — asyncId changed (${asyncId} → ${player.asyncId})`);
            prefetchedAudioSample?.close();
            player._setLoading(false);
            return;
        }

        if (!firstVideoFrame) {
            Logger.warn(`[Live:Video] No first video frame received — aborting`);
            prefetchedAudioSample?.close();
            player._setLoading(false);
            return;
        }

        if (player.audioContext) {
            const wallOverride = this._liveAnchorWallOverride;
            this._liveAnchorWallOverride = null;
            anchorWall = wallOverride ?? (player.audioContext.currentTime + 0.15); // 150ms ahead to absorb first-frame decode jitter
            anchorContent = this._liveStartTimestamp;
            this._liveAnchorWall = anchorWall;
            this._liveAnchorContent = anchorContent;
            Logger.log(`[Live] Anchor set — anchorWall=${anchorWall.toFixed(3)}, anchorContent=${anchorContent.toFixed(3)}, audioTs=${prefetchedAudioSample?.timestamp?.toFixed(3)}, audioCtxState=${player.audioContext.state}`);
        }

        if (prefetchedAudioSample && anchorWall !== null) {
            Logger.log(`[Live:Audio] Starting audio iterator — anchorWall=${anchorWall.toFixed(3)}, anchorContent=${anchorContent.toFixed(3)}`);
            player._runAudioIterator(anchorWall, anchorContent, prefetchedAudioSample);
        } else if (hasAudio) {
            Logger.warn(`[Live:Audio] No prefetched audio sample — audio will not play`);
        }

        // Draw first video frame
        if (player.canvas.width !== firstVideoFrame.canvas.width || player.canvas.height !== firstVideoFrame.canvas.height) {
            Logger.log(`[Live:Video] Canvas resize: ${player.canvas.width}x${player.canvas.height} → ${firstVideoFrame.canvas.width}x${firstVideoFrame.canvas.height}`);
            player.canvas.width = firstVideoFrame.canvas.width;
            player.canvas.height = firstVideoFrame.canvas.height;
        }
        player.ctx.clearRect(0, 0, player.canvas.width, player.canvas.height);
        player.ctx.drawImage(firstVideoFrame.canvas, 0, 0, player.canvas.width, player.canvas.height);
        if (player.afterFrameRenderCallbacks.length > 0) {
            player.afterFrameRenderCallbacks.forEach(cb => cb(player.canvas, player.ctx));
        }
        player._setLoading(false);
        this._isFetchingLiveFrame = false;
        this._isMediaReady = true;
        if (player.isPlaying) this.resumeRecordingSmartPause();
        Logger.log(`[Live:Video] First frame drawn — audioCtx=${player.audioContext?.currentTime?.toFixed(3)}`);

        // Continuous frame loop (frames 2, 3, …)
        const myIterator = player.videoFrameIterator;
        let frameCount = 1;
        let drawnFrames = 1;
        let lastDrawMs = performance.now();
        let lastFrameDrawMs = lastDrawMs;
        let totalLateMs = 0;
        const fallbackFrameDurationMs = 1000 / (player.frameRate || 30);

        try {
            for await (const frame of myIterator) {
                frameCount++;

                if (player.asyncId !== asyncId || !this.isLive || !player.isPlaying) {
                    Logger.log(`[Live:Video] Breaking loop at frame ${frameCount} — asyncId=${player.asyncId === asyncId}, isLive=${this.isLive}, isPlaying=${player.isPlaying}`);
                    break;
                }

                if (player.canvas.width !== frame.canvas.width || player.canvas.height !== frame.canvas.height) {
                    Logger.log(`[Live:Video] Canvas resize: ${player.canvas.width}x${player.canvas.height} → ${frame.canvas.width}x${frame.canvas.height}`);
                    player.canvas.width = frame.canvas.width;
                    player.canvas.height = frame.canvas.height;
                }

                let targetWall = null;
                if (anchorWall !== null && anchorContent !== null && player.audioContext) {
                    targetWall = anchorWall + (frame.timestamp - anchorContent);
                    const behindSec = player.audioContext.currentTime - targetWall;

                    if (behindSec > 3.0) {
                        // Genuine deep stall (tab backgrounded, network outage) — jump to live edge
                        Logger.warn(`[Live:Video] Deep resync: ${behindSec.toFixed(1)}s behind audio — jumping to live edge`);
                        player._setLoading(true);
                        if (player.videoTrack) {
                            const currentLiveEdge = await player.videoTrack.getDurationFromMetadata({ skipLiveWait: true });
                            this._liveStartTimestamp = currentLiveEdge ?? 0;
                            Logger.log(`[Live:Video] Jumping to live edge: ${this._liveStartTimestamp.toFixed(3)}`);
                            this.startLiveVideoLoop();
                            return;
                        }
                    }
                    // Minor drift (segment fetch latency): targetWall is in the past, so the
                    // timing await below resolves immediately and frames draw at full speed
                    // until video catches up to audio — no intervention needed.

                    await new Promise(r => {
                        const check = () => {
                            if (player.asyncId !== asyncId || !player.isPlaying) { r(); return; }
                            if (player.audioContext.currentTime >= targetWall - 0.002) { r(); return; } // 2ms early-draw tolerance
                            requestAnimationFrame(check);
                        };
                        requestAnimationFrame(check);
                    });
                } else {
                    const targetMs = lastDrawMs + fallbackFrameDurationMs;
                    await new Promise(r => {
                        const check = () => {
                            if (player.asyncId !== asyncId || !player.isPlaying) { r(); return; }
                            if (performance.now() >= targetMs - 2) { r(); return; }
                            requestAnimationFrame(check);
                        };
                        requestAnimationFrame(check);
                    });
                }

                if (player.asyncId !== asyncId || !this.isLive || !player.isPlaying) break;

                const drawMs = performance.now();
                if (targetWall !== null && player.audioContext) {
                    const lateMs = (player.audioContext.currentTime - targetWall) * 1000;
                    totalLateMs += lateMs;
                    drawnFrames++;
                    if (drawnFrames % 60 === 0) {
                        const intervalMs = lastFrameDrawMs > 0 ? (drawMs - lastFrameDrawMs).toFixed(1) : '—';
                        Logger.log(`[Live:Video] Drawn ${drawnFrames} (total ${frameCount}) — late=${lateMs.toFixed(1)}ms, avgLate=${(totalLateMs / drawnFrames).toFixed(1)}ms, interval=${intervalMs}ms, audioCtx=${player.audioContext.currentTime.toFixed(3)}, target=${targetWall.toFixed(3)}`);
                    }
                }

                player.ctx.clearRect(0, 0, player.canvas.width, player.canvas.height);
                player.ctx.drawImage(frame.canvas, 0, 0, player.canvas.width, player.canvas.height);
                if (player.afterFrameRenderCallbacks.length > 0) {
                    player.afterFrameRenderCallbacks.forEach(cb => cb(player.canvas, player.ctx));
                }

                lastDrawMs = drawMs;
                lastFrameDrawMs = drawMs;
            }
            Logger.log(`[Live:Video] Loop exited normally — total=${frameCount}, drawn=${drawnFrames}, skipped=${frameCount - drawnFrames}`);
        } catch (e) {
            Logger.warn(`[Live:Video] Loop error after ${frameCount} frames: ${e.message}`);
        } finally {
            // Only clear loading state if we're still the active loop — a newer loop may have
            // already set _setLoading(true) and must not be interrupted by this stale finally.
            if (player.asyncId === asyncId) player._setLoading(false);
        }
    }
}
