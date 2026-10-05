import { Logger } from '../../shared/utils/Logger.js';

/**
 * MediaTracks - the demuxed source and the tracks and sinks read from it.
 *
 * These five things were fields on Player, written by the load pipeline and
 * read by nine other files. They belong together: a sink is meaningless
 * without the track it reads, and a track is meaningless without the input it
 * came from, so disposing one without the others is always a mistake.
 *
 * Named for what it holds rather than MediaSource, which is a DOM global and
 * something else entirely.
 *
 * Opening a source is deliberately *not* here. That code also sets the
 * duration, the frame rate, the canvas size and whether this is audio-only --
 * it is "open a file and configure the player", which belongs to the load
 * pipeline. This owns the handles and their disposal, nothing more.
 */
export class MediaTracks {
    constructor() {
        this.input = null;
        this.videoTrack = null;
        this.videoSink = null;
        this.audioTrack = null;
        this.audioSink = null;
    }

    /**
     * Release the sinks and the input, in that order.
     *
     * The tracks are left alone on purpose: this mirrors exactly what the
     * load pipeline did before, where the two track fields were cleared
     * separately by the callers that wanted them cleared.
     */
    dispose() {
        for (const handle of [this.videoSink, this.audioSink, this.input]) {
            if (!handle?.dispose) continue;
            try {
                handle.dispose();
            } catch (e) {
                // Disposal is best-effort; a handle that will not close must
                // not stop the others being released.
                Logger.warn('[MediaTracks] dispose failed:', e);
            }
        }
        this.videoSink = null;
        this.audioSink = null;
        this.input = null;
    }
}
