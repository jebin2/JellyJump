/**
 * RecordingClock - how long a recording thinks it has been running.
 *
 * A recording's timestamps have to follow *played* time, not wall-clock time.
 * Pause the camera for ten seconds and the file must not gain ten seconds of
 * nothing; the frame after the pause belongs immediately after the frame
 * before it. That is the whole job, and it is arithmetic over three inputs:
 * the current wall time, whether anything is playing, and whether there has
 * just been a discontinuity.
 *
 * It lives apart from PlayerStream for one reason: this was the most
 * timing-sensitive logic in the app and had no test of any kind, because
 * testing it in place meant driving MediaBunny, an AudioContext and a canvas.
 * Out here it is a fake clock and a few assertions.
 *
 * Video and audio deliberately share the discontinuity flag, as they did
 * inline: the flag is raised on pause and on resume, the next video frame
 * clears it by re-anchoring, and audio buffers arriving in between are
 * dropped rather than written at a timestamp nobody can trust.
 */
export class RecordingClock {
    constructor() {
        this._videoSeconds = 0;
        this._audioSeconds = 0;
        this._lastWall = null;
        // Starts raised: the first frame anchors the clock rather than
        // measuring against a wall time that was never set.
        this._discontinuous = true;
    }

    /** Begin, or begin again, from zero. */
    start(now) {
        this._videoSeconds = 0;
        this._audioSeconds = 0;
        this._lastWall = now;
        this._discontinuous = true;
    }

    /**
     * Something interrupted the run -- a pause, or playback resuming after
     * one. The gap either side of this must not reach the file.
     */
    markDiscontinuity() {
        this._discontinuous = true;
    }

    get discontinuous() { return this._discontinuous; }
    get videoSeconds() { return this._videoSeconds; }
    get audioSeconds() { return this._audioSeconds; }

    /**
     * The timestamp for a frame presented at `now`, or null when this frame
     * is the one that re-anchors the clock and so must be skipped.
     *
     * @param {number} now - milliseconds, monotonic
     * @returns {number|null} seconds into the recording
     */
    nextVideoTimestamp(now) {
        if (this._discontinuous) {
            this._lastWall = now;
            this._discontinuous = false;
            return null;
        }
        this._videoSeconds += (now - this._lastWall) / 1000;
        this._lastWall = now;
        return this._videoSeconds;
    }

    /**
     * The timestamp for an audio buffer of `duration` seconds, or null while
     * the clock is unanchored.
     *
     * Audio advances by the length of what it is handed rather than by wall
     * time: the buffers are the measurement.
     *
     * @param {number} duration - seconds
     * @returns {number|null}
     */
    nextAudioTimestamp(duration) {
        if (this._discontinuous) return null;

        const timestamp = this._audioSeconds;
        // A non-finite timestamp would be written into the file and poison
        // every sample after it, so the run restarts its audio clock instead.
        if (!Number.isFinite(timestamp)) {
            this._audioSeconds = 0;
            return null;
        }
        this._audioSeconds += duration;
        return timestamp;
    }
}
