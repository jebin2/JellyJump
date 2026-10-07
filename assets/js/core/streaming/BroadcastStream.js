import { Logger } from '../../shared/utils/Logger.js';

/**
 * The player's output as a MediaStream, for sending to someone else.
 *
 * Everything the player draws goes through presentFrame onto one canvas --
 * a demuxed file, an HLS stream, the camera, with filters, stickers and
 * decorations already composited. So the canvas is a faithful picture of what
 * the viewer should see, and capturing it needs no knowledge of which source is
 * playing.
 *
 * Audio is taken from the gain node rather than from a video element. There is
 * no video element on the ordinary playback path -- mediabunny decodes into
 * Web Audio -- so the existing recording feature, which captures from
 * `player.video || player.streamVideo`, only finds audio in camera and stream
 * mode. Tapping the gain node works for every source, and it is additive: the
 * node keeps its connection to audioContext.destination, so tapping it does not
 * make the player silent.
 *
 * Nothing here knows about peers or networks. It produces a stream; who it is
 * sent to is someone else's problem.
 */
/**
 * How often the canvas is nudged so the capture keeps producing while nothing
 * is being drawn. Low, because this exists to stop the picture vanishing, not
 * to carry playback.
 */
const HEARTBEAT_MS = 500;

export class BroadcastStream {
    constructor(player) {
        this.player = player;
        this._stream = null;
        this._audioTap = null;
        this._heartbeat = null;
    }

    /** True while there is a stream to send. */
    get isOpen() { return this._stream !== null; }

    /** The outgoing stream, or null. */
    get stream() { return this._stream; }

    /** True once audio has been attached; false when it was not available. */
    get hasAudio() { return !!this._stream?.getAudioTracks().length; }

    /**
     * Start capturing. Audio is attached if the graph exists yet -- it does not
     * until the first play() -- and can be attached later with attachAudio().
     * @param {{fps?: number}} [options]
     * @returns {MediaStream|null} null when there is no canvas to capture
     */
    open({ fps = 30 } = {}) {
        if (this._stream) return this._stream;

        const canvas = this.player.canvas;
        if (!canvas || typeof canvas.captureStream !== 'function') {
            Logger.warn('[Broadcast] No capturable canvas');
            return null;
        }

        this._stream = canvas.captureStream(fps);
        Logger.log(`[Broadcast] Capturing ${canvas.width}x${canvas.height} at ${fps}fps`);
        this._startHeartbeat();
        this.attachAudio();
        return this._stream;
    }

    /**
     * Add the player's audio to the stream, if the graph is up.
     *
     * Separate from open() because the AudioContext is not created until
     * playback starts, so a broadcast begun from a paused player would
     * otherwise be silent for good.
     * @returns {boolean} whether audio is now attached
     */
    attachAudio() {
        if (!this._stream || this._audioTap) return this.hasAudio;

        const { audioContext, gainNode } = this.player;
        if (!audioContext || !gainNode) return false;

        this._audioTap = audioContext.createMediaStreamDestination();
        gainNode.connect(this._audioTap);

        const [track] = this._audioTap.stream.getAudioTracks();
        if (!track) {
            gainNode.disconnect(this._audioTap);
            this._audioTap = null;
            return false;
        }

        this._stream.addTrack(track);
        Logger.log('[Broadcast] Audio attached from the gain node');
        return true;
    }

    /**
     * Keep the capture producing while nothing is drawing to the canvas.
     *
     * captureStream only emits a frame when the canvas is modified, so a paused
     * player produces nothing at all and a viewer who joins sees black until
     * playback resumes -- there is no "current frame" to send, only a history
     * of modifications. requestFrame() looks like the answer and is not: it has
     * effect only on a manual-mode track, one made by captureStream() with no
     * frame rate, and does nothing for this one. Measured: eight calls, zero
     * frames delivered.
     *
     * So the canvas is drawn onto itself, which is a real pixel operation and
     * visually nothing, twice a second. A zero-alpha pixel also works and is
     * cheaper, but it is the sort of write a browser is entitled to optimise
     * away, and this has to be reliable rather than clever. It runs whether or
     * not playback is running: a player can report isPlaying while drawing
     * nothing, and at twice a second the redundant draws cost nothing.
     */
    _startHeartbeat() {
        clearInterval(this._heartbeat);
        this._heartbeat = setInterval(() => {
            const { canvas, ctx } = this.player;
            if (!this._stream || !canvas || !ctx || !canvas.width || !canvas.height) return;
            try {
                ctx.drawImage(canvas, 0, 0);
            } catch (e) {
                // A canvas can be briefly unusable mid-resize; the next tick is fine.
            }
        }, HEARTBEAT_MS);
    }

    /** Stop capturing and release the tap. */
    close() {
        clearInterval(this._heartbeat);
        this._heartbeat = null;
        if (this._audioTap) {
            // Only this tap: the gain node's own connection to the speakers is
            // a separate edge and must survive.
            try { this.player.gainNode?.disconnect(this._audioTap); } catch (e) { /* already gone */ }
            this._audioTap = null;
        }
        if (this._stream) {
            for (const track of this._stream.getTracks()) track.stop();
            this._stream = null;
            Logger.log('[Broadcast] Stopped');
        }
    }
}
