import { Logger } from "../../../shared/utils/Logger.js";
import { initPlayerAudio, tapPlayerAudio } from '../../../core/audio/AudioEngine.js';

/**
 * Record Menu Handler
 * Handles recording of the current stream/video
 */
export class RecordMenu {
    static isRecording = false;
    /** The player's sound for the recording, from tapPlayerAudio. */
    static audioTap = null;
    /** Settles once a start in progress has finished, either way. */
    static _starting = null;

    /**
     * Initialize and handle recording
     * @param {Object} item - Playlist item
     * @param {Playlist} playlist - Playlist instance
     */
    static async init(item, playlist) {
        if (!playlist.player || !playlist.player.canvas) {
            Logger.error('RecordMenu: Player canvas not available');
            playlist._showToast('Error: Player not ready', 'error');
            return;
        }

        // Check if item is active
        if (!this.checkActiveItem(item, playlist)) {
            playlist._showToast('Please play this video to record it', 'warning');
            return;
        }

        // Toggle logic
        if (this.isRecording) {
            this.stopRecording(playlist);
            return;
        }

        await this._startRecording(playlist);
    }

    /**
     * Start Recording.
     *
     * Recorded by the player's own CanvasRecorder, through Mediabunny: frames
     * are taken only while the video plays, so pausing does not pad the file,
     * and the picture includes everything drawn on the canvas.
     * @param {Playlist} playlist
     */
    static _startRecording(playlist) {
        // Marked as recording at once, so the button flips and a second click
        // means stop; stopRecording waits for this to finish before stopping.
        this.isRecording = true;
        this._starting = this._start(playlist).finally(() => { this._starting = null; });
        return this._starting;
    }

    static async _start(playlist) {
        const player = playlist.player;
        try {
            await player.startCanvasRecording({ audioTrack: await this._tapAudio(player) });

            playlist._showToast(
                !player.isPlaying ? 'Recording started. Play video to capture.' : 'Recording started.',
                'info',
            );
        } catch (err) {
            Logger.error('RecordMenu: Start Error', err);
            playlist._showToast('Failed to start recording: ' + err.message, 'error');
            this._releaseAudioTap();
            this.isRecording = false;
        }
    }

    /**
     * The sound to record, or null to let the recorder find its own.
     *
     * A file or HLS stream plays through the player's Web Audio graph, which
     * is tapped ahead of the volume control: muting or turning down the
     * player while recording does not silence the file. A camera or a
     * received watch-party stream plays through its own media element
     * instead, so the graph has nothing in it; for those the recorder takes
     * the element's audio track itself.
     * @returns {Promise<MediaStreamTrack|null>}
     */
    static async _tapAudio(player) {
        if (player.isStreamMode || player.isWebcamMode) return null;

        // The player builds its audio graph on first play; a recording
        // started before that would have no output to tap. This runs from
        // the menu click, so the context is allowed to start.
        if (!player.audioContext) await initPlayerAudio(player);
        this.audioTap = tapPlayerAudio(player, { beforeVolume: true });
        if (!this.audioTap) Logger.warn('RecordMenu: No audio to record; recording picture only');
        return this.audioTap?.track ?? null;
    }

    static _releaseAudioTap() {
        this.audioTap?.release();
        this.audioTap = null;
    }

    /**
     * Stop Recording
     * @param {Playlist} playlist
     */
    static async stopRecording(playlist) {
        if (!this.isRecording) return;
        if (this._starting) {
            await this._starting;
            // The start failed and has already said so.
            if (!this.isRecording) return;
        }
        this.isRecording = false;
        const player = playlist.player;
        playlist._showToast('Stopping recording...', 'info');

        let blob = null;
        try {
            blob = await player.stopCanvasRecording();
        } catch (err) {
            Logger.error('RecordMenu: Stop Error', err);
        } finally {
            this._releaseAudioTap();
        }

        if (!blob) {
            playlist._showToast('Nothing was recorded. Play the video while recording.', 'warning');
            return;
        }
        this._saveRecording(playlist, blob);
    }

    /** Add the recording to the playlist and download it. */
    static _saveRecording(playlist, blob) {
        const filename = `recording_${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`;

        const itemPath = playlist.items[playlist.activeIndex]?.path || playlist.items[playlist.activeIndex]?.title || '';
        const file = new File([blob], filename, { type: 'video/mp4' });
        playlist.addItems([{
            title: filename,
            url: URL.createObjectURL(blob),
            file: file,
            duration: 'Loading...',
            type: 'video',
            isLocal: true,
            path: `${itemPath}/${filename}`,
            id: Date.now().toString(),
        }]);

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

        playlist._showToast('Recording saved', 'success');
    }

    /**
     * Handle Playlist Item Change
     * Stops recording if active
     * @param {Playlist} playlist 
     */
    static handleItemChange(playlist) {
        if (this.isRecording) {
            Logger.log('RecordMenu: Item changed, stopping recording...');
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
