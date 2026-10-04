import { MediaBunny } from '../MediaBunny.js';
import { Logger } from '../../shared/utils/Logger.js';
import { RecordingClock } from './RecordingClock.js';

/**
 * CanvasRecorder - writes an MP4 from whatever is on the player's canvas.
 *
 * Lifted out of PlayerStream, which was holding this alongside the stream
 * video element, the live loop and the camera: four jobs, thirty-four fields,
 * and no way to work on any one of them without reading all of it.
 *
 * It is not stream-specific. It records the canvas, and since every source --
 * decoded file, live stream, camera -- now reaches the canvas through one
 * path, this works for all of them. The camera is simply the only caller
 * today.
 *
 * What it needs from outside is small and explicit: the canvas to read, a way
 * to ask whether playback is running, and three events -- playback resumed,
 * playback paused, a frame was presented. Everything else is its own.
 */
export class CanvasRecorder {
    /**
     * @param {Object} player - needs .canvas and .isPlaying
     * @param {() => boolean} isMediaReady - whether frames are worth recording
     */
    constructor(player, isMediaReady) {
        this.player = player;
        this._isMediaReady = isMediaReady;

        /** Played time, not wall time. Tested on its own in RecordingClock. */
        this.clock = new RecordingClock();

        this._isRecording = false;
        this._chunks = null;
        this._output = null;
        this._audioSource = null;
        this._readyForMoreFrames = true;
        this._captureInterval = null;
        this._audioContext = null;
        this._audioStreamSource = null;
        this._audioProcessor = null;
    }

    get isRecording() { return this._isRecording; }

    /**
     * Playback resumed. The audio graph is woken and the clock is told there
     * was a gap, so the pause does not land in the file.
     */
    onPlaybackResumed(mediaReady = true) {
        if (!this._isRecording) return;
        if (this._audioContext?.state === 'suspended') this._audioContext.resume();
        if (mediaReady) this.clock.markDiscontinuity();
    }

    /** Playback paused. */
    onPlaybackPaused() {
        if (!this._isRecording) return;
        if (this._audioContext?.state === 'running') this._audioContext.suspend();
        this.clock.markDiscontinuity();
    }

    /**
     * A frame reached the canvas after a spell of not doing so. Raising the
     * discontinuity here is what keeps the recording's timeline continuous
     * across a stall rather than stretching it by the length of the stall.
     */
    onFramePresented() {
        if (this._isRecording) this.clock.markDiscontinuity();
    }

    /**
     * @param {{audioTrack?: MediaStreamTrack}} options
     */
    async start(options = {}) {
        if (this._isRecording) return;
        const player = this.player;

        this._isRecording = true;
        this._chunks = [];
        this._audioSource = null;
        this._readyForMoreFrames = true;
        this.clock.start(performance.now());
        this._audioContext = null;
        this._audioStreamSource = null;
        this._audioProcessor = null;

        const { audioTrack } = options;
        const audioIsEncodable = await MediaBunny.canEncodeAudio('opus', {
            quality: new MediaBunny.Quality({ bitrate: 128000 }),
        });

        this._output = new MediaBunny.Output({
            format: new MediaBunny.Mp4OutputFormat({ fastStart: 'fragmented' }),
            target: new MediaBunny.StreamTarget(new WritableStream({
                write: (chunk) => { this._chunks.push(chunk.data); },
            })),
        });

        const frameRate = 30;
        Logger.log('[Record] Video bitrate: 50 Mbps (raw quality)');
        const videoSource = new MediaBunny.CanvasSource(player.canvas, {
            codec: 'avc',
            quality: new MediaBunny.Quality({ bitrate: 50_000_000 }),
            keyFrameInterval: 2,
            latencyMode: 'realtime',
            width: player.canvas.width,
            height: player.canvas.height,
            sizeChangeBehavior: 'contain',
        });
        this._output.addVideoTrack(videoSource, { frameRate });

        if (audioTrack && audioIsEncodable) this._startAudio(audioTrack);

        await this._output.start();

        // A recording begun while paused should start paused, or its audio
        // runs ahead of a picture that is not moving.
        if (!player.isPlaying && this._audioSource?.pause) {
            try {
                this._audioSource.pause();
                Logger.log('[Record] Audio started paused, because the player is');
            } catch (e) {
                Logger.error('[Record] Could not start audio paused', e);
            }
        }

        const addFrame = async () => {
            if (!this._isRecording || !player.isPlaying || !this._isMediaReady()) return;
            if (!this._readyForMoreFrames) return;

            // null means this frame is the one re-anchoring the clock after a
            // gap, so it is skipped rather than written at a timestamp that
            // would carry the gap into the file.
            const timestamp = this.clock.nextVideoTimestamp(performance.now());
            if (timestamp === null) return;

            this._readyForMoreFrames = false;
            try {
                await videoSource.add(timestamp, 1 / frameRate);
            } catch (e) {
                Logger.warn('[Record] Frame add error', e);
            }
            this._readyForMoreFrames = true;
        };

        this._captureInterval = setInterval(() => {
            addFrame().catch(e => Logger.error(e));
        }, 1000 / frameRate);

        Logger.log('[Record] Canvas recording started');
    }

    /** @private */
    _startAudio(audioTrack) {
        try {
            this._audioSource = new MediaBunny.AudioSampleSource({
                codec: 'opus',
                quality: new MediaBunny.Quality({ bitrate: 128000 }),
                sampleRate: 48000,
            });
            this._output.addAudioTrack(this._audioSource);

            this._audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
            this._audioStreamSource = this._audioContext.createMediaStreamSource(new MediaStream([audioTrack]));
            this._audioProcessor = this._audioContext.createScriptProcessor(4096, 2, 2);

            this._audioProcessor.onaudioprocess = (e) => {
                if (!this._isRecording || !this._isMediaReady()) return;

                const inputBuffer = e.inputBuffer;
                // null covers a buffer arriving while the clock is unanchored
                // and a timestamp that had gone non-finite; neither is worth
                // writing into the file.
                const timestamp = this.clock.nextAudioTimestamp(inputBuffer.duration);
                if (timestamp === null) return;

                try {
                    const samples = MediaBunny.AudioSample.fromAudioBuffer(inputBuffer, timestamp);
                    for (const sample of Array.isArray(samples) ? samples : [samples]) {
                        if (!this._audioSource) { sample.close(); continue; }
                        this._audioSource.add(sample)
                            .then(() => sample.close())
                            .catch(err => {
                                Logger.warn('[Record] Failed to add audio sample:', err);
                                sample.close();
                            });
                    }
                } catch (err) {
                    Logger.warn('[Record] Audio encode error:', err);
                }
            };

            this._audioStreamSource.connect(this._audioProcessor);
            this._audioProcessor.connect(this._audioContext.destination);
            Logger.log('[Record] Audio pipeline started');
        } catch (e) {
            Logger.error('[Record] Audio setup failed', e);
            this._audioSource = null;
        }
    }

    /**
     * @returns {Promise<Blob|null>} the finished MP4, or null if nothing was
     *   captured or no recording was running
     */
    async stop() {
        if (!this._isRecording) return null;

        this._isRecording = false;
        clearInterval(this._captureInterval);
        this._captureInterval = null;
        Logger.log('[Record] Finalizing...');

        if (this._audioProcessor) {
            this._audioProcessor.disconnect();
            this._audioProcessor.onaudioprocess = null;
            this._audioProcessor = null;
        }
        if (this._audioStreamSource) {
            this._audioStreamSource.disconnect();
            this._audioStreamSource = null;
        }
        if (this._audioContext) {
            await this._audioContext.close();
            this._audioContext = null;
        }

        if (this._output) await this._output.finalize();
        this._audioSource = null;

        const chunks = this._chunks;
        this._output = null;
        this._chunks = null;
        return chunks?.length > 0 ? new Blob(chunks, { type: 'video/mp4' }) : null;
    }
}
