// @ts-check
/**
 * Values the player takes on for a while, for a tool, and gives back
 * exactly (ARCHITECTURE_PLAN.md §3.4, ADR 0009).
 *
 *   const release = player.override({ playbackRate: 1, filters: null, controlBarMode: 'fixed' });
 *   …
 *   release(); // speed, filters and control bar as they were; nothing saved
 *
 * The edit panel shows the video as it will be saved, so it wants no
 * filters and normal speed while it is open; Cut and GIF loop a range on
 * the main player. Each used to save what it changed by hand and put it
 * back, and changing the speed this way also saved it as the user's choice.
 *
 * Overrides stack. For each value, what the player shows is the most recent
 * override still held that sets it; when none is left, the value from
 * before the first one comes back. Released in any order, the result is the
 * same. Overrides never touch the saved settings.
 *
 * Changing an overridden value directly while held (setPreviewRange moving a
 * loop) is allowed: it is the tool's to change, and released all the same.
 */

/**
 * @typedef {{
 *   playbackRate?: number,
 *   filters?: Object|null,
 *   controlBarMode?: 'fixed'|'overlay',
 *   loop?: {mode: string, start: number|null, end: number|null},
 * }} OverrideValues
 */

/**
 * How each value is read from the player and put on it.
 * @type {Record<string, {read: (p: any) => unknown, apply: (p: any, value: any) => void}>}
 */
const FACETS = {
    playbackRate: {
        read: (p) => p.playbackRate,
        apply: (p, rate) => {
            if (p.playbackRate === rate) return;
            const done = p.setPlaybackRate?.(rate, { persist: false });
            done?.catch?.(() => {}); // a player torn down meanwhile
        },
    },
    filters: {
        read: (p) => (p.videoFilters?.isActive() ? p.videoFilters.getState() : null),
        apply: (p, state) => {
            if (!p.videoFilters) return;
            if (state) p.videoFilters.setState(state); // announces filterschange
            else p.videoFilters.reset();
        },
    },
    controlBarMode: {
        read: (p) => p.controlBarMode,
        apply: (p, mode) => {
            if (p.controlBarMode === mode) return;
            p.controlBarMode = mode;
            p.controlBar?.applyMode(); // not saveMode: the user's choice stays saved
        },
    },
    loop: {
        read: (p) => ({ mode: p.loopMode, start: p.loopStart, end: p.loopEnd }),
        apply: (p, loop) => {
            p.setLoop(loop.mode, loop.start, loop.end);
        },
    },
};

export class PlayerOverrides {
    /** @param {Object} player */
    constructor(player) {
        this.player = player;
        /** @type {Array<{values: OverrideValues}>} oldest first */
        this.layers = [];
        /** @type {Map<string, unknown>} each overridden value as it was before the first override of it */
        this.base = new Map();
    }

    /**
     * @param {OverrideValues} values
     * @returns {() => void} release; calling it again does nothing
     */
    push(values) {
        const names = Object.keys(values).filter((name) => {
            if (!Object.hasOwn(FACETS, name)) throw new Error(`Cannot override ${name}`);
            return true;
        });
        for (const name of names) {
            if (!this.base.has(name)) this.base.set(name, FACETS[name].read(this.player));
        }
        const layer = { values };
        this.layers.push(layer);
        for (const name of names) FACETS[name].apply(this.player, /** @type {any} */ (values)[name]);

        let released = false;
        return () => {
            if (released) return;
            released = true;
            const at = this.layers.indexOf(layer);
            if (at === -1) return;
            const wasTop = names.filter((name) => this._top(name) === layer);
            this.layers.splice(at, 1);
            for (const name of names) {
                const top = this._top(name);
                if (top) {
                    // Another override still holds it. Only the one that was
                    // showing changes what the player shows.
                    if (wasTop.includes(name)) FACETS[name].apply(this.player, /** @type {any} */ (top.values)[name]);
                } else {
                    FACETS[name].apply(this.player, this.base.get(name));
                    this.base.delete(name);
                }
            }
        };
    }

    /** Whether any override holds this value now. @param {string} name */
    holds(name) {
        return this.base.has(name);
    }

    /** @param {string} name */
    _top(name) {
        for (let i = this.layers.length - 1; i >= 0; i--) {
            if (Object.hasOwn(this.layers[i].values, name)) return this.layers[i];
        }
        return null;
    }
}
