import { Logger } from "../../utils/Logger.js";

/**
 * Screen Recorder Menu Handler
 * Handles recording of the screen/window/tab via getDisplayMedia
 */
export class ScreenRecorderMenu {
    static isRecording = false;
    static mediaRecorder = null;
    static chunks = [];
    static stream = null;

    /**
     * Initialize and handle recording
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(playlist) {
        // Toggle logic
        if (this.isRecording) {
            this.stopRecording(playlist);
            return;
        }

        // Start Recording
        this._startRecording(playlist);
    }

    /**
     * Start Recording
     * @param {Playlist} playlist 
     */
    static async _startRecording(playlist) {
        try {
            this.chunks = []; // Reset chunks

            // Request Screen Stream
            // Constraint: audio: false as per user request
            this.stream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: "always"
                },
                audio: false
            });

            // Handle user stopping via browser UI
            this.stream.getVideoTracks()[0].onended = () => {
                this.stopRecording(playlist);
            };

            // Use VP9 for better compression, fallback to VP8/H264
            const options = { mimeType: 'video/webm;codecs=vp9' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                Logger.warn('ScreenRecorder: VP9 not supported, falling back to default');
                delete options.mimeType;
            }

            this.mediaRecorder = new MediaRecorder(this.stream, options);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.chunks.push(event.data);
                }
            };

            this.mediaRecorder.onstop = () => {
                this._saveRecording(playlist);
            };

            this.mediaRecorder.start(1000); // Write chunks every second
            this.isRecording = true;

            // Update UI to show recording state (optional: could change button icon)
            this._updateButtonState(true);

            playlist._showToast('Screen recording started', 'info');

        } catch (err) {
            Logger.error('ScreenRecorder: Start Error', err);
            if (err.name !== 'NotAllowedError') { // Ignore if user cancelled
                playlist._showToast('Failed to start recording: ' + err.message, 'error');
            }
            this.isRecording = false;
        }
    }

    /**
     * Stop Recording
     * @param {Playlist} playlist 
     */
    static stopRecording(playlist) {
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
            // Stop all tracks to release camera/screen
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
                this.stream = null;
            }
            // Button update is handled in save or here? Better here for immediate feedback
            this.isRecording = false;
            this._updateButtonState(false);
            playlist._showToast('Processing recording...', 'info');
        }
    }

    /**
     * Save Recording to Playlist
     * @param {Playlist} playlist 
     */
    static _saveRecording(playlist) {
        if (this.chunks.length === 0) return;

        try {
            const blob = new Blob(this.chunks, { type: 'video/webm' });

            // Create meaningful filename
            const date = new Date();
            const timestamp = date.toISOString().replace(/[:.]/g, '-').slice(0, 19);
            const filename = `ScreenRecording_${timestamp}.webm`;

            // Create File object
            const file = new File([blob], filename, { type: 'video/webm' });

            // Create Playlist Item
            const newItem = {
                title: filename,
                url: URL.createObjectURL(blob),
                file: file,
                duration: 'Loading...', // Will be updated by metadata processor
                type: 'video',
                isLocal: true,
                path: filename,
                id: Date.now().toString(),
                mimeType: 'video/webm',
                fileSize: blob.size
            };

            // Add to Playlist
            playlist.addItems([newItem]);
            playlist._showToast('Recording saved to playlist', 'success');

            // Optionally auto-play the recording?
            // playlist.selectItem(playlist.items.length - 1);

        } catch (err) {
            Logger.error('ScreenRecorder: Save Error', err);
            playlist._showToast('Failed to save recording', 'error');
        } finally {
            this.chunks = [];
            this.isRecording = false;
            this.mediaRecorder = null;
            this.stream = null;
            this._updateButtonState(false);
        }
    }

    /**
     * Update Button UI
     * @param {boolean} isRecording 
     */
    static _updateButtonState(isRecording) {
        const btn = document.getElementById('mb-screen-record');
        if (!btn) return;

        if (isRecording) {
            btn.classList.add('recording-active'); // Add a class for styling (red pulse?)
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
                    <use href="assets/icons/sprite.svg#icon-record"></use>
                </svg>
            `;
            btn.title = "Record Screen";
        }
    }
}
