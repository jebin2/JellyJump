import { Logger } from '../../shared/utils/Logger.js';

/**
 * A MediaStream shown through a <video> element: the camera, and the screen
 * recorder's capture.
 *
 * PlayerStream held two unrelated pipelines. One demuxes an HLS playlist and
 * paces frames against an audio anchor; this one takes a live MediaStream the
 * browser hands over, puts it in a hidden <video>, and copies that element to
 * the canvas once per animation frame. They share the word "stream" and
 * nothing else, so changing the camera meant reading past the live-HLS loop
 * and the other way round.
 *
 * It holds the player, as every component here does, and the controller that
 * owns it -- for the three things that are genuinely the controller's: the
 * isStreamMode / isWebcamMode / _isMediaReady flags, which the player exposes
 * as its own, and telling the recorder a frame was presented.
 */
export class StreamVideoSource {
    constructor(player, stream) {
        this.player = player;
        this.stream = stream;
        this.streamVideo = null;
        this.streamRenderLoopId = null;
    }

    async loadWebcamStream(stream) {
        const player = this.player;
        player._setLoading(true);
        this.stream._isMediaReady = false;

        player.pause(false);
        await player._cleanupMediaBunny();

        this.createStreamVideo();
        this.setupStreamVideoEvents();

        this.streamVideo.srcObject = stream;
        this.streamVideo.muted = true;
        this.streamVideo.autoplay = true;

        this.stream.isStreamMode = true;
        this.stream.isWebcamMode = true;
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
        this.stream.isStreamMode = false;
        // After the flag, not before: the decision reads isStreamMode, and
        // asking while it still said "camera" left baking switched on.
        this.player._syncOverlayBaking?.();
        this.player.isPlaying = false;
        this.stopStreamRenderLoop();
        this.player._updatePlayPauseUI();
    }

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

    setupStreamVideoEvents() {
        if (!this.streamVideo) return;

        const player = this.player;

        this.streamVideo.onplaying = () => {
            if (this.stream.isStreamMode) player._setLoading(false);
        };

        this.streamVideo.onended = () => {
            if (this.stream.isStreamMode && player.onEnded) player.onEnded();
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

    showStreamVideo() {
        if (this.player.canvas) this.player.canvas.style.display = 'block';
    }

    hideStreamVideo() {
        if (this.streamVideo) this.streamVideo.style.display = 'none';
        if (this.player.canvas) this.player.canvas.style.display = 'block';
        this.setStreamModeControls(false);
    }

    async playStream() {
        if (!this.stream.isStreamMode || !this.streamVideo) return false;

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

    pauseStream(showOverlay) {
        if (!this.stream.isStreamMode || !this.streamVideo) return false;

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

        if (!this.stream._isMediaReady) {
            this.stream._isMediaReady = true;
            if (player.isPlaying) this.stream.resumeRecordingSmartPause();
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
}
