import { Modal } from '../Modal.js';

/**
 * Record Menu Handler
 * Handles recording of the current stream/video
 */
export class RecordMenu {
    static isRecording = false;
    static mediaRecorder = null;
    static writable = null;
    static fileHandle = null;
    static chunks = [];

    /**
     * Initialize and handle recording
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(item, playlist) {
        if (!playlist.player || !playlist.player.canvas) {
            console.error('RecordMenu: Player canvas not available');
            playlist._showToast('Error: Player not ready', 'error');
            return;
        }

        // Check if item is active
        if (!this.checkActiveItem(item, playlist)) {
            playlist._showToast('Please play this video to record it', 'warning');
            // Optionally play it for them?
            // playlist.selectItem(playlist.items.indexOf(item));
            return;
        }

        // Toggle logic
        if (this.isRecording) {
            this.stopRecording(playlist);
            return;
        }

        // Check playback state
        if (playlist.player.paused) {
            playlist._showToast('Recording started. Play video to capture.', 'info');
        }

        // Check if File System Access API is supported
        const supportsFileSystem = 'showSaveFilePicker' in window;

        if (!supportsFileSystem) {
            this._startRecordingFallback(playlist);
            return;
        }

        try {
            // 1. Ask user where to save FIRST
            const handle = await window.showSaveFilePicker({
                suggestedName: `recording_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`,
                types: [{
                    description: 'WebM Video',
                    accept: { 'video/webm': ['.webm'] },
                }],
            });

            this.writable = await handle.createWritable();
            this.fileHandle = handle;
            this._startRecording(playlist, true);

        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('RecordMenu: Error', err);
                playlist._showToast('Failed to start recording: ' + err.message, 'error');
            }
        }
    }

    /**
     * Start Recording (Internal)
     * @param {Playlist} playlist 
     * @param {boolean} useFileSystem 
     */
    static _startRecording(playlist, useFileSystem) {
        try {
            // Capture Video from Canvas
            const videoStream = playlist.player.canvas.captureStream(30); // 30 FPS

            // Capture Audio from Video Element
            let audioStream;
            // Try to find the video element. HLSPlayer attaches it to this.video, 
            // and Player.js usually has it as this.video or this.hlsPlayer.video
            const videoEl = playlist.player.video || (playlist.player.hlsPlayer && playlist.player.hlsPlayer.video);

            if (videoEl) {
                // Try standard captureStream, fallback to mozCaptureStream
                if (videoEl.captureStream) {
                    audioStream = videoEl.captureStream();
                } else if (videoEl.mozCaptureStream) {
                    audioStream = videoEl.mozCaptureStream();
                }
            }

            // Combine Tracks
            const tracks = [...videoStream.getVideoTracks()];
            if (audioStream) {
                const audioTracks = audioStream.getAudioTracks();
                if (audioTracks.length > 0) {
                    tracks.push(...audioTracks);
                    console.log('RecordMenu: Audio tracks added');
                } else {
                    console.warn('RecordMenu: No audio tracks found on video element stream');
                }
            } else {
                console.warn('RecordMenu: Could not capture audio stream from video element');
            }

            const combinedStream = new MediaStream(tracks);

            this.mediaRecorder = new MediaRecorder(combinedStream, {
                mimeType: 'video/webm;codecs=vp9,opus' // Try VP9 + Opus
            });

            this.mediaRecorder.ondataavailable = async (event) => {
                if (event.data.size > 0) {
                    if (useFileSystem && this.writable) {
                        await this.writable.write(event.data);
                    } else if (!useFileSystem) {
                        // Fallback: Store in memory
                        if (!this.chunks) this.chunks = [];
                        this.chunks.push(event.data);
                    }
                }
            };

            this.mediaRecorder.onstop = async () => {
                if (useFileSystem && this.writable) {
                    await this.writable.close();
                    playlist._showToast('Recording saved successfully!', 'success');

                    // Add to playlist
                    if (this.fileHandle) {
                        try {
                            const file = await this.fileHandle.getFile();
                            playlist.handleFiles([file]);
                        } catch (e) {
                            console.error('RecordMenu: Failed to add to playlist', e);
                        }
                    }
                } else if (!useFileSystem) {
                    // Fallback Download
                    const filename = `recording_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
                    const blob = new Blob(this.chunks, { type: 'video/webm' });

                    // Create File object for playlist
                    const file = new File([blob], filename, { type: 'video/webm' });
                    playlist.handleFiles([file]);

                    // Trigger Download
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    setTimeout(() => {
                        document.body.removeChild(a);
                        window.URL.revokeObjectURL(url);
                    }, 100);
                    playlist._showToast('Recording saved to Downloads', 'success');
                    this.chunks = [];
                }

                this.isRecording = false;
                this.mediaRecorder = null;
                this.writable = null;
                this.fileHandle = null;
            };

            this.mediaRecorder.start(1000); // Write chunks every second
            this.isRecording = true;
            playlist._showToast('Recording started. Play video to capture.', 'info');

        } catch (err) {
            console.error('RecordMenu: Start Error', err);
            playlist._showToast('Failed to start recording: ' + err.message, 'error');
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
            playlist._showToast('Stopping recording...', 'info');
        }
    }

    /**
     * Fallback recording for browsers without File System Access API
     * @private
     */
    static _startRecordingFallback(playlist) {
        this.chunks = [];
        this._startRecording(playlist, false);
    }

    /**
     * Handle Playlist Item Change
     * Stops recording if active
     * @param {Playlist} playlist 
     */
    static handleItemChange(playlist) {
        if (this.isRecording) {
            console.log('RecordMenu: Item changed, stopping recording...');
            this.stopRecording(playlist);
        }
    }

    /**
     * Check if the item is currently active/playing
     * @param {Object} item 
     * @param {Playlist} playlist 
     * @returns {boolean}
     */
    static checkActiveItem(item, playlist) {
        if (!playlist || playlist.activeIndex === -1) return false;
        const activeItem = playlist.items[playlist.activeIndex];
        return activeItem === item;
    }
}
