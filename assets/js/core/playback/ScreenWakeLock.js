/**
 * Keeps the screen awake while the player is playing.
 *
 * A browser holds a wake lock by itself only for a playing <video> element.
 * MediaBunny decodes frames and draws them on a canvas, so there is no such
 * element and nothing tells the system a video is on: the screensaver starts,
 * the display sleeps, and a phone locks in the middle of a film. The Screen
 * Wake Lock API asks for the same thing explicitly.
 *
 * The browser drops the lock whenever the page is hidden, so it is taken again
 * when the page comes back while still playing. Unsupported browsers, and
 * requests the browser refuses (a hidden page, a denying permissions policy),
 * are ignored: a lock is a nicety, never a reason for playback to fail.
 */
export class ScreenWakeLock {
    constructor() {
        this._wanted = false;
        this._sentinel = null;
        this._pending = null;
        this._onVisibility = () => {
            if (this._wanted && document.visibilityState === 'visible') this._acquire();
        };
        document.addEventListener('visibilitychange', this._onVisibility);
    }

    /** Hold the lock while `playing` is true; release it otherwise. */
    set(playing) {
        this._wanted = !!playing;
        if (this._wanted) this._acquire();
        else this._release();
    }

    destroy() {
        document.removeEventListener('visibilitychange', this._onVisibility);
        this.set(false);
    }

    async _acquire() {
        if (this._sentinel || this._pending || !('wakeLock' in navigator)) return;
        if (document.visibilityState !== 'visible') return;
        this._pending = navigator.wakeLock.request('screen').then(
            (sentinel) => {
                this._pending = null;
                // Paused while the request was in flight.
                if (!this._wanted) { sentinel.release().catch(() => {}); return; }
                this._sentinel = sentinel;
                sentinel.addEventListener('release', () => {
                    if (this._sentinel === sentinel) this._sentinel = null;
                });
            },
            () => { this._pending = null; }
        );
    }

    _release() {
        const sentinel = this._sentinel;
        this._sentinel = null;
        sentinel?.release().catch(() => {});
    }
}
