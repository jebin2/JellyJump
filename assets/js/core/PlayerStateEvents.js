// @ts-check
/**
 * The player's state, announced as events (ARCHITECTURE_PLAN.md §4.1, H1).
 *
 * The core used to tell the UI about every change by calling it:
 * `_updatePlayPauseUI()`, `_updateVolumeUI()` and a dozen more, from 75
 * places. Those calls were where the state is known to have settled, so the
 * events fire from the same places: the core calls one method here, which
 * compares the state with what was last announced and fires only on a
 * change. The UI listens (ui/player/PlayerUIListeners.js, H2).
 *
 *   player.on('play', () => …)
 *   player.on('volumechange', ({volume, muted}) => …)
 *
 * Events: play, pause, directionchange, timeupdate, durationchange, loadingchange,
 * volumechange, ratechange, loopmodechange, ended, trackschange,
 * streamstatechange, controlbarmodechange, filterschange (and reversefailed,
 * bufferwaitchange and bufferchange, fired where they happen).
 */

/** @param {unknown} a @param {unknown} b */
const same = (a, b) => a === b || (Number.isNaN(a) && Number.isNaN(b));

export class PlayerStateEvents {
    /** @param {any} player */
    constructor(player) {
        this.player = player;
        /** @type {Record<string, unknown>} what was last announced */
        this.last = {};
        // Render loops fire timeupdate themselves; remember what they said, so
        // a progress refresh at the same time is not announced twice.
        player.on('timeupdate', (/** @type {{currentTime: number}} */ { currentTime }) => { this.last.time = currentTime; });
    }

    /**
     * Fire `event` if `key`'s value moved since it was last announced.
     * @param {string} key @param {unknown} value @param {string} event @param {Object} [data]
     */
    _changed(key, value, event, data) {
        if (Object.hasOwn(this.last, key) && same(this.last[key], value)) return false;
        this.last[key] = value;
        this.player.trigger(event, data ?? {});
        return true;
    }

    playState() {
        const p = this.player;
        const playing = !!p.isPlaying;
        this._changed('playing', playing, playing ? 'play' : 'pause');
        // Which way Play goes, whether playing backwards is running, and
        // whether it can run here: the play button shows all three.
        const direction = { direction: p.direction, reversing: !!p.reverse?.active, reverseUnavailable: p.reverse?.unavailableReason ?? null };
        this._changed('direction', `${direction.direction}|${direction.reversing}|${direction.reverseUnavailable}`, 'directionchange', direction);
    }

    progress() {
        const p = this.player;
        this._changed('duration', p.duration, 'durationchange', { duration: p.duration });
        if (!same(this.last.time, p.currentTime)) {
            p.trigger('timeupdate', { currentTime: p.currentTime });
        }
    }

    loading() {
        const loading = !!this.player.isLoading;
        this._changed('loading', loading, 'loadingchange', { loading });
    }

    volume() {
        const p = this.player;
        const volume = p.volume;
        const muted = !!p.isMuted;
        this._changed('volume', `${volume}|${muted}`, 'volumechange', { volume, muted });
    }

    rate() {
        const rate = this.player.playbackRate;
        this._changed('rate', rate, 'ratechange', { playbackRate: rate });
    }

    loop() {
        const p = this.player;
        const loop = { loopMode: p.loopMode, loopStart: p.loopStart, loopEnd: p.loopEnd };
        this._changed('loop', `${loop.loopMode}|${loop.loopStart}|${loop.loopEnd}`, 'loopmodechange', loop);
    }

    filters() {
        const f = this.player.videoFilters;
        const active = !!f?.isActive?.();
        const state = active ? JSON.stringify(f.getState?.() ?? null) : '';
        this._changed('filters', `${active}|${state}`, 'filterschange', { active });
    }

    controlBarMode() {
        const mode = this.player.controlBarMode;
        this._changed('controlBarMode', mode, 'controlbarmodechange', { mode });
    }

    /**
     * Announced every time a stream is loaded or started, changed or not:
     * the UI hides the controls a stream has no use for each time, as the
     * core did when it drew them (a file played in between shows them).
     */
    streamState() {
        const p = this.player;
        p.trigger('streamstatechange', { isStreamMode: !!p.isStreamMode, isWebcamMode: !!p.isWebcamMode, isLive: !!p.isLive });
    }

    /** Track lists are rebuilt as a whole; every rebuild is announced. */
    tracks() {
        this.player.trigger('trackschange', {});
    }

    ended() {
        this.player.trigger('ended', {});
    }
}
