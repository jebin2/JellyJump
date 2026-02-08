import { Logger } from "../../utils/Logger.js";

/**
 * Screen Recorder Menu Handler
 * Handles recording of the screen/window/tab with Multi-Mode Facecam support.
 */
export class ScreenRecorderMenu {
    static isRecording = false;
    static mediaRecorder = null;
    static chunks = [];
    static stream = null;

    // Facecam State
    static facecamStream = null;
    static facecamVideo = null;     // used for PiP and In-Page
    static facecamContainer = null; // used for In-Page
    static facecamWindow = null;    // used for Popup
    static currentMode = 'off';

    /**
     * Show Recording Options Modal
     * @param {Playlist} playlist 
     */
    static async showOptions(playlist) {
        if (this.isRecording) {
            this.stopRecording(playlist);
            return;
        }

        const template = document.getElementById('screen-record-options-modal-template');
        if (!template) {
            this.init(playlist);
            return;
        }

        const clone = template.content.cloneNode(true);
        const modalOverlay = clone.querySelector('.mb-modal-overlay');
        document.body.appendChild(modalOverlay);

        const closeBtn = modalOverlay.querySelector('.mb-modal-close');
        const cancelBtn = modalOverlay.querySelector('.mb-modal-cancel');
        const startBtn = modalOverlay.querySelector('.mb-modal-start');
        const hint = modalOverlay.querySelector('#facecam-hint');
        const radios = modalOverlay.querySelectorAll('input[name="facecam-mode"]');
        const preferTabCheckbox = modalOverlay.querySelector('#prefer-current-tab');
        const enableFacecamCheckbox = modalOverlay.querySelector('#enable-facecam');
        const facecamOptions = modalOverlay.querySelector('#facecam-options');

        // Option Containers
        const optPiP = modalOverlay.querySelector('.option-pip');
        const optPopup = modalOverlay.querySelector('.option-popup');
        const optInPage = modalOverlay.querySelector('.option-in-page');

        // Dynamic Visibility Function
        const updateVisibility = () => {
            const isTabOnly = preferTabCheckbox.checked;
            const isFacecamEnabled = enableFacecamCheckbox.checked;

            if (!isFacecamEnabled) {
                facecamOptions.style.display = 'none';
                hint.className = 'hidden';
                return;
            }

            facecamOptions.style.display = 'block';

            if (isTabOnly) {
                // Show In-Page, Hide PiP/Popup
                if (optInPage) optInPage.style.display = 'flex';
                if (optPiP) optPiP.style.display = 'none';
                if (optPopup) optPopup.style.display = 'none';

                // Auto-select In-Page if currently off/pip/popup (or nothing selected)
                const current = Array.from(radios).find(r => r.checked);
                if (!current || (current.value !== 'in-page')) {
                    const inPageRadio = modalOverlay.querySelector('input[value="in-page"]');
                    if (inPageRadio) {
                        inPageRadio.checked = true;
                        inPageRadio.dispatchEvent(new Event('change'));
                    }
                }
            } else {
                // Show PiP/Popup, Hide In-Page
                if (optInPage) optInPage.style.display = 'none';
                if (optPiP) optPiP.style.display = 'flex';
                if (optPopup) optPopup.style.display = 'flex';

                // Auto-select PiP if currently in-page (or nothing selected)
                const current = Array.from(radios).find(r => r.checked);
                if (!current || (current.value === 'in-page')) {
                    const pipRadio = modalOverlay.querySelector('input[value="pip"]');
                    if (pipRadio) {
                        pipRadio.checked = true;
                        pipRadio.dispatchEvent(new Event('change'));
                    }
                }
            }
        };

        // Attach Checkbox Listeners
        preferTabCheckbox.addEventListener('change', updateVisibility);
        enableFacecamCheckbox.addEventListener('change', updateVisibility);

        // Mic Selector Elements (Screen tab)
        const captureAudioCheckbox = modalOverlay.querySelector('#capture-audio');
        const micSelectorContainer = modalOverlay.querySelector('#mic-selector-container');
        const micDeviceSelect = modalOverlay.querySelector('#mic-device-select');

        // Mic Selector Elements (Webcam tab)
        const webcamCaptureAudioCheckbox = modalOverlay.querySelector('#webcam-capture-audio');
        const webcamMicSelectorContainer = modalOverlay.querySelector('#webcam-mic-selector-container');
        const webcamMicDeviceSelect = modalOverlay.querySelector('#webcam-mic-device-select');

        // Helper to populate mic dropdown
        const populateMicDropdown = async (selectElement) => {
            try {
                await navigator.mediaDevices.getUserMedia({ audio: true });
                const devices = await navigator.mediaDevices.enumerateDevices();
                const audioInputs = devices.filter(d => d.kind === 'audioinput');

                selectElement.innerHTML = audioInputs.map(d =>
                    `<option value="${d.deviceId}">${d.label || 'Microphone ' + (audioInputs.indexOf(d) + 1)}</option>`
                ).join('');
            } catch (err) {
                selectElement.innerHTML = '<option value="">Mic access denied</option>';
            }
        };

        // Screen tab mic checkbox logic
        captureAudioCheckbox.addEventListener('change', async () => {
            if (captureAudioCheckbox.checked) {
                micSelectorContainer.style.display = 'block';
                await populateMicDropdown(micDeviceSelect);
            } else {
                micSelectorContainer.style.display = 'none';
            }
        });

        // Webcam tab mic checkbox logic
        if (webcamCaptureAudioCheckbox) {
            webcamCaptureAudioCheckbox.addEventListener('change', async () => {
                if (webcamCaptureAudioCheckbox.checked) {
                    webcamMicSelectorContainer.style.display = 'block';
                    await populateMicDropdown(webcamMicDeviceSelect);
                } else {
                    webcamMicSelectorContainer.style.display = 'none';
                }
            });
        }

        // Initial State
        preferTabCheckbox.checked = false;
        enableFacecamCheckbox.checked = false;
        updateVisibility();

        // Handle Hint Logic
        radios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (!hint) return;

                if (e.target.value === 'pip') {
                    // Start of Selection
                    hint.innerHTML = '<strong>Tip:</strong> If Facecam hides behind apps, try <strong>Popup Window</strong> mode.';
                    hint.className = 'alert alert-info text-xs mb-lg';
                } else if (e.target.value === 'popup') {
                    hint.innerHTML = '<strong>Tip:</strong> Right-Click window title -> Select <strong>"Sticky"</strong> or "Always on Top".';
                    hint.className = 'alert alert-warning text-xs mb-lg';
                } else if (e.target.value === 'in-page') {
                    hint.innerHTML = '<strong>Tip:</strong> Facecam only visible inside this browser tab.';
                    hint.className = 'alert alert-success text-xs mb-lg';
                } else {
                    hint.className = 'hidden';
                }
            });
        });

        const closeModal = () => {
            if (modalOverlay.parentNode) {
                document.body.removeChild(modalOverlay);
            }
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);

        // Prevent closing on overlay click
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                e.preventDefault();
                e.stopPropagation();
            }
        });

        // Tab Logic
        const tabScreen = modalOverlay.querySelector('#tab-screen-record');
        const tabWebcam = modalOverlay.querySelector('#tab-webcam-record');
        const screenOptions = modalOverlay.querySelector('#screen-record-options');
        const webcamOptions = modalOverlay.querySelector('#webcam-record-options');
        let currentMode = 'screen'; // 'screen' or 'webcam'

        const switchTab = (mode) => {
            currentMode = mode;
            if (mode === 'screen') {
                tabScreen.classList.add('active');
                tabWebcam.classList.remove('active');
                screenOptions.style.display = 'block';
                webcamOptions.style.display = 'none';
                webcamOptions.classList.add('hidden');
            } else {
                tabScreen.classList.remove('active');
                tabWebcam.classList.add('active');
                screenOptions.style.display = 'none';
                webcamOptions.style.display = 'block';
                webcamOptions.classList.remove('hidden');
            }
        };

        if (tabScreen && tabWebcam) {
            tabScreen.addEventListener('click', () => switchTab('screen'));
            tabWebcam.addEventListener('click', () => switchTab('webcam'));
        }

        startBtn.addEventListener('click', () => {
            if (currentMode === 'webcam') {
                const captureAudio = webcamCaptureAudioCheckbox ? webcamCaptureAudioCheckbox.checked : true;
                const micDeviceId = captureAudio && webcamMicDeviceSelect ? webcamMicDeviceSelect.value : null;
                closeModal();
                this._startWebcamRecording(playlist, captureAudio, micDeviceId);
                return;
            }

            const isFacecamEnabled = enableFacecamCheckbox ? enableFacecamCheckbox.checked : false;
            let mode = 'off';

            if (isFacecamEnabled) {
                const selected = Array.from(radios).find(r => r.checked);
                mode = selected ? selected.value : 'off';
            }

            const preferCurrentTab = preferTabCheckbox ? preferTabCheckbox.checked : false;
            const captureAudio = captureAudioCheckbox ? captureAudioCheckbox.checked : false;
            const micDeviceId = captureAudio && micDeviceSelect ? micDeviceSelect.value : null;
            const disableEchoCancelCheckbox = modalOverlay.querySelector('#disable-echo-cancel');
            const disableEchoCancel = disableEchoCancelCheckbox ? disableEchoCancelCheckbox.checked : false;

            closeModal();
            this._startRecording(playlist, mode, preferCurrentTab, captureAudio, micDeviceId, disableEchoCancel);
        });
    }

    static async init(playlist) {
        if (this.isRecording) {
            this.stopRecording(playlist);
            return;
        }
        this._startRecording(playlist, 'off', false);
    }

    /**
     * Start Recording
     * @param {Playlist} playlist 
     * @param {string} mode - 'pip', 'popup', 'in-page', 'off'
     * @param {boolean} preferCurrentTab - Whether to restrict to current tab
     */
    static async _startWebcamRecording(playlist, captureAudio = true, micDeviceId = null) {
        try {
            // Build audio constraints
            let audioConstraints = captureAudio;
            if (captureAudio && micDeviceId) {
                audioConstraints = {
                    deviceId: { exact: micDeviceId },
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                };
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: audioConstraints
            });

            this.stream = stream;
            this.isRecording = true;
            this.currentMode = 'webcam';
            this.playlist = playlist;

            // Delegate to CorePlayer (split API)
            if (window.player) {
                // 1. Load Webcam Stream (setup preview)
                await window.player.loadWebcamStream(stream);
                // 2. Start Canvas Recording
                const audioTrack = captureAudio ? stream.getAudioTracks()[0] : null;
                await window.player.startCanvasRecording({ audioTrack });
            } else {
                throw new Error("CorePlayer not available");
            }

            // Update UI State
            this._updateButtonState(true);
            this._addLiveCameraItem(playlist);

            const audioStatus = captureAudio ? '🎤 Mic ON' : '🔇 No Audio';
            playlist._showToast(`Webcam recording started (${audioStatus})`, 'info');

        } catch (err) {
            console.error("Error starting webcam:", err);
            playlist._showToast('Webcam access denied or error.', 'error');
        }
    }

    static async _startRecording(playlist, mode, preferCurrentTab = false, captureAudio = false, micDeviceId = null, disableEchoCancel = false) {
        try {
            this.chunks = [];
            this.currentMode = mode;

            // 1. Start Facecam
            if (mode !== 'off') {
                await this._startFacecam(playlist, mode);
            }

            // 2. Request Screen Stream (video only)
            const constraints = {
                video: {
                    cursor: "always"
                },
                audio: false
            };

            if (preferCurrentTab) {
                constraints.video.displaySurface = "browser";
                constraints.selfBrowserSurface = "include";
                constraints.preferCurrentTab = true;
            }

            this.stream = await navigator.mediaDevices.getDisplayMedia(constraints);
            let combinedStream = this.stream;

            // 3. If audio requested, get microphone and create combined stream
            if (captureAudio) {
                try {
                    // When disableEchoCancel is true, we disable all audio processing
                    // to allow capturing speaker audio through the mic
                    const audioConstraints = {
                        echoCancellation: !disableEchoCancel,
                        noiseSuppression: !disableEchoCancel,
                        autoGainControl: !disableEchoCancel
                    };
                    if (micDeviceId) {
                        audioConstraints.deviceId = { exact: micDeviceId };
                    }

                    Logger.log(`[ScreenRecorder] Audio constraints: echoCancellation=${!disableEchoCancel}`);
                    const micStream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
                    this.micStream = micStream;

                    const micTracks = micStream.getAudioTracks();
                    Logger.log(`[ScreenRecorder] Mic tracks: ${micTracks.length}`);
                    if (micTracks.length > 0) {
                        Logger.log(`[ScreenRecorder] Using mic: ${micTracks[0].label}`);
                    }

                    const videoTrack = this.stream.getVideoTracks()[0];
                    const audioTrack = micStream.getAudioTracks()[0];
                    combinedStream = new MediaStream([videoTrack, audioTrack]);

                    Logger.log(`[ScreenRecorder] Combined stream: video=${combinedStream.getVideoTracks().length}, audio=${combinedStream.getAudioTracks().length}`);
                } catch (micErr) {
                    Logger.warn('[ScreenRecorder] Microphone access denied:', micErr);
                    playlist._showToast('Microphone access denied', 'warning');
                }
            }

            combinedStream.getVideoTracks()[0].onended = () => {
                this.stopRecording(playlist);
            };

            const options = { mimeType: 'video/webm;codecs=vp9,opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'video/webm;codecs=vp9';
                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                    delete options.mimeType;
                }
            }

            this.mediaRecorder = new MediaRecorder(combinedStream, options);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.chunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this._saveRecording(playlist);
            };

            this.mediaRecorder.start(1000);
            this.isRecording = true;

            const audioTracks = combinedStream.getAudioTracks();
            this._updateButtonState(true);
            const audioStatus = captureAudio ? (audioTracks.length > 0 ? '🎤 Mic ON' : '⚠️ No mic') : '🔇 No Audio';
            playlist._showToast(`Recording started (${audioStatus})`, 'info');

        } catch (err) {
            Logger.error('ScreenRecorder: Start Error', err);
            if (err.name !== 'NotAllowedError') {
                playlist._showToast('Failed to start recording: ' + err.message, 'error');
            }
            this._stopFacecam();
            this.isRecording = false;
        }
    }

    /**
     * Start Facecam based on mode
     */
    static async _startFacecam(playlist, mode) {
        try {
            this.facecamStream = await navigator.mediaDevices.getUserMedia({
                video: { width: 320, height: 240, facingMode: "user" },
                audio: false
            });

            if (mode === 'pip') {
                await this._startPiPMode(playlist);
            } else if (mode === 'popup') {
                await this._startPopupMode(playlist);
            } else if (mode === 'in-page') {
                await this._startInPageMode(playlist);
            }

        } catch (err) {
            Logger.error('ScreenRecorder: Facecam Error', err);
            playlist._showToast('Facecam failed: ' + err.message, 'error');
            this._stopFacecam();
        }
    }

    // --- Mode Implementations ---

    static async _startPiPMode(playlist) {
        this.facecamVideo = document.createElement('video');
        this.facecamVideo.srcObject = this.facecamStream;
        this.facecamVideo.muted = true;
        this.facecamVideo.playsInline = true;
        // Ideally hide it but keep it in DOM for PiP
        this.facecamVideo.style.position = 'fixed';
        this.facecamVideo.style.opacity = '0';
        this.facecamVideo.style.pointerEvents = 'none';
        document.body.appendChild(this.facecamVideo);

        await this.facecamVideo.play();

        if (this.facecamVideo.requestPictureInPicture) {
            await this.facecamVideo.requestPictureInPicture();
        } else {
            throw new Error('PiP not supported');
        }
    }

    static async _startPopupMode(playlist) {
        const width = 320;
        const height = 240;
        const left = (window.screen.width / 2) - (width / 2);
        const top = (window.screen.height / 2) - (height / 2);

        this.facecamWindow = window.open('', 'Facecam',
            `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
        );

        if (!this.facecamWindow) {
            throw new Error('Popup blocked. Allow popups for this site.');
        }

        // Setup Popup Content
        this.facecamWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Facecam</title>
                <style>
                    body { margin: 0; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; height: 100vh; }
                    video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
                </style>
            </head>
            <body>
                <video id="v" autoplay playsinline muted></video>
            </body>
            </html>
        `);

        const video = this.facecamWindow.document.getElementById('v');
        video.srcObject = this.facecamStream;

        // Handle popup close
        this.facecamWindow.onbeforeunload = () => {
            this.facecamWindow = null; // Mark as closed
        };
    }

    static async _startInPageMode(playlist) {
        // Container
        this.facecamContainer = document.createElement('div');
        Object.assign(this.facecamContainer.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            overflow: 'hidden',
            zIndex: '9999',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            border: '3px solid white',
            cursor: 'move',
            touchAction: 'none'
        });

        // Video
        this.facecamVideo = document.createElement('video');
        this.facecamVideo.srcObject = this.facecamStream;
        this.facecamVideo.muted = true;
        this.facecamVideo.playsInline = true;
        Object.assign(this.facecamVideo.style, {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: 'scaleX(-1)' // Mirror effect
        });

        this.facecamContainer.appendChild(this.facecamVideo);
        document.body.appendChild(this.facecamContainer);

        await this.facecamVideo.play();
        this._enableDrag(this.facecamContainer);
    }

    /**
     * Enable dragging for In-Page element
     */
    static _enableDrag(element) {
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        const dragStart = (e) => {
            if (e.type === "touchstart") {
                initialX = e.touches[0].clientX - xOffset;
                initialY = e.touches[0].clientY - yOffset;
            } else {
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
            }
            if (e.target === element || element.contains(e.target)) {
                isDragging = true;
            }
        };

        const dragEnd = (e) => {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        };

        const drag = (e) => {
            if (isDragging) {
                e.preventDefault();
                if (e.type === "touchmove") {
                    currentX = e.touches[0].clientX - initialX;
                    currentY = e.touches[0].clientY - initialY;
                } else {
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                }

                xOffset = currentX;
                yOffset = currentY;

                element.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            }
        };

        element.addEventListener("touchstart", dragStart, { passive: false });
        element.addEventListener("touchend", dragEnd, { passive: false });
        element.addEventListener("touchmove", drag, { passive: false });

        element.addEventListener("mousedown", dragStart);
        document.addEventListener("mouseup", dragEnd);
        document.addEventListener("mousemove", drag);

        element._cleanupDrag = () => {
            document.removeEventListener("mouseup", dragEnd);
            document.removeEventListener("mousemove", drag);
        };
    }

    // --- Cleanup ---

    static _stopFacecam() {
        // Stop Stream
        if (this.facecamStream) {
            this.facecamStream.getTracks().forEach(track => track.stop());
            this.facecamStream = null;
        }

        // Cleanup PiP
        if (this.facecamVideo && document.pictureInPictureElement === this.facecamVideo) {
            document.exitPictureInPicture().catch(() => { });
        }
        if (this.facecamVideo && this.facecamVideo.parentNode) {
            this.facecamVideo.parentNode.removeChild(this.facecamVideo);
        }
        this.facecamVideo = null;

        // Cleanup Popup
        if (this.facecamWindow) {
            this.facecamWindow.close();
            this.facecamWindow = null;
        }

        // Cleanup In-Page
        if (this.facecamContainer) {
            if (this.facecamContainer._cleanupDrag) this.facecamContainer._cleanupDrag();
            if (this.facecamContainer.parentNode) this.facecamContainer.parentNode.removeChild(this.facecamContainer);
            this.facecamContainer = null;
        }
    }

    static async stopRecording(playlist) {
        if (this.currentMode === 'webcam') {
            this.isRecording = false;
            this._updateButtonState(false);
            this._removeLiveCameraItem(playlist);

            // Stop Canvas Recording
            if (window.player && typeof window.player.stopCanvasRecording === 'function') {
                playlist._showToast('Finalizing webcam recording...', 'info');
                const blob = await window.player.stopCanvasRecording();
                if (blob) {
                    this._saveRecordingBlob(playlist, blob);
                } else {
                    playlist._showToast('No recording data found.', 'warning');
                }
                // Stop Webcam Stream Mode (preview cleanup)
                window.player.stopWebcamStreamMode();
            }

            // Cleanup local stream reference
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }
            return;
        }

        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();

            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }

            // Cleanup mic stream if it exists
            if (this.micStream) {
                this.micStream.getTracks().forEach(track => track.stop());
                this.micStream = null;
            }

            this._stopFacecam();

            this.isRecording = false;
            this._updateButtonState(false);
            playlist._showToast('Processing recording...', 'info');
        }
    }

    static _saveRecording(playlist) {
        if (this.chunks.length === 0) return;

        try {
            const blob = new Blob(this.chunks, { type: 'video/webm' });
            this._saveRecordingBlob(playlist, blob);

        } catch (err) {
            Logger.error('ScreenRecorder: Save Error', err);
            playlist._showToast('Failed to save recording', 'error');
        } finally {
            this.chunks = [];
            this.isRecording = false;
            this.mediaRecorder = null;
            this.stream = null;
            this._stopFacecam();
            this._updateButtonState(false);
        }
    }

    static _saveRecordingBlob(playlist, blob) {
        const date = new Date();
        const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
        const filename = `Recording_${timestamp}.${ext}`;
        const file = new File([blob], filename, { type: blob.type });

        const newItem = {
            title: filename,
            url: URL.createObjectURL(blob),
            file: file,
            duration: 'Loading...',
            type: 'video',
            isLocal: true,
            path: filename,
            id: Date.now().toString(),
            mimeType: blob.type,
            fileSize: blob.size
        };

        if (typeof playlist.addItems === 'function') {
            playlist.addItems([newItem]);
        } else {
            // Fallback if addItems not available (e.g. old Playlist version)
            playlist.files.push(newItem);
            if (playlist.renderPlaylist) playlist.renderPlaylist();
            if (playlist.loadMedia) playlist.loadMedia(playlist.files.length - 1);
        }
        playlist._showToast('Recording saved to playlist', 'success');
    }

    static _updateButtonState(isRecording) {
        const btn = document.getElementById('mb-tools');
        if (!btn) return;

        if (isRecording) {
            btn.classList.add('recording-active');
            btn.innerHTML = `
                <svg width="16" height="16" fill="currentColor" class="text-danger animate-pulse">
                    <use href="assets/icons/sprite.svg#icon-record"></use>
                </svg>
            `;
            btn.title = "Stop Recording";
        } else {
            btn.classList.remove('recording-active');
            btn.innerHTML = `
                <svg width="16" height="16" fill="currentColor">
                    <use href="assets/icons/sprite.svg#icon-sliders"></use>
                </svg>
            `;
            btn.title = "Tools";
        }
    }

    // --- Playlist Helpers ---

    static _addLiveCameraItem(playlist) {
        // Remove existing if any (safety)
        this._removeLiveCameraItem(playlist);

        const liveItem = {
            id: 'live-webcam',
            title: '📹 LIVE: Camera Feed',
            isLive: true,
            isWebcam: true,
            type: 'video',
            isLocal: true,
            duration: 'LIVE',
            thumbnail: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0icmVkIj48Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIvPjwvc3ZnPg=='
        };

        playlist.items.unshift(liveItem);
        playlist.render();
    }

    static _removeLiveCameraItem(playlist) {
        const index = playlist.items.findIndex(item => item.id === 'live-webcam');
        if (index > -1) {
            playlist.items.splice(index, 1);
            playlist.render();
        }
    }
}
