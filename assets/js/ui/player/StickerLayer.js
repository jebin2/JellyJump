import { AnimatedImage } from '../../shared/utils/AnimatedImage.js';
import { Logger } from '../../shared/utils/Logger.js';

/**
 * StickerLayer - flowers, emoji and animated GIFs drawn over the camera.
 *
 * Drawn into the canvas from an afterFrameRender callback, the same way the
 * watermark preview does, which means the recorder gets them for free: it
 * reads canvas pixels, and this writes canvas pixels.
 *
 * Positions are stored as fractions of the frame, never as screen pixels. A
 * sticker therefore lands in the same place in the recording as on screen at
 * any window size, and survives the camera changing resolution mid-session.
 *
 * The selection outline and drag handle are DOM, deliberately: anything drawn
 * on the canvas to help you place a sticker would be recorded along with it.
 */

/** The built-in set. Glyphs, not files: nothing to ship, decode or leak. */
export const STICKER_EMOJI = [
    '🌸', '🌺', '🌻', '🌹', '🌷', '💐', '🍀', '🌿',
    '❤️', '💖', '✨', '⭐', '🔥', '🌈', '👑', '🦋',
    '😎', '🥳', '🤍', '💫', '🎈', '🎀', '🍓', '🧁',
];

/**
 * Motions a placed sticker can be given. Each is a function of time, for the
 * same reason the falling decorations are: a sticker that bobs must bob to
 * the same place every time the video reaches that moment.
 *
 * Returned as a transform rather than applied, so the draw stays in one place.
 * @type {Object<string, {label: string, at: (t: number) => {dx: number, dy: number, scale: number, rotate: number}}>}
 */
export const STICKER_MOTIONS = {
    bob: {
        label: '↕ Bob',
        at: t => ({ dx: 0, dy: Math.sin(t * 2.4) * 0.12, scale: 1, rotate: 0 }),
    },
    pulse: {
        label: '💓 Pulse',
        // Sharper on the beat than a sine, so a thumbs-up reads as a thump.
        at: t => ({ dx: 0, dy: 0, scale: 1 + Math.pow(Math.max(0, Math.sin(t * 3)), 3) * 0.22, rotate: 0 }),
    },
    spin: {
        label: '🔄 Spin',
        at: t => ({ dx: 0, dy: 0, scale: 1, rotate: t * 1.8 }),
    },
    wobble: {
        label: '🙃 Wobble',
        at: t => ({ dx: 0, dy: 0, scale: 1, rotate: Math.sin(t * 3.2) * 0.28 }),
    },
    drift: {
        label: '🎈 Float',
        at: t => ({ dx: Math.sin(t * 0.9) * 0.06, dy: Math.cos(t * 1.3) * 0.05, scale: 1, rotate: Math.sin(t) * 0.1 }),
    },
};

/** A new sticker's width, as a fraction of the frame. */
const DEFAULT_WIDTH = 0.22;
/** Nothing smaller than this can still be grabbed on a phone. */
const MIN_WIDTH = 0.05;

let nextId = 1;

export class StickerLayer {
    /** @param {Object} player - CorePlayer; needs .canvas, .container, render hooks */
    constructor(player) {
        this.player = player;
        this.stickers = [];
        this.editing = false;
        this.selectedId = null;

        this._overlay = null;
        this._boxes = new Map();

        this._draw = this._draw.bind(this);
        this.player.addRenderCallback?.(this._draw);
        this._ensureOverlay();
    }

    // --- contents --------------------------------------------------------

    /**
     * @param {string} char
     * @returns {Object} the new sticker
     */
    addEmoji(char) {
        return this._add({ kind: 'emoji', value: char, aspect: 1 });
    }

    /**
     * @param {File|Blob} file - a PNG, JPEG, WebP or animated GIF
     * @returns {Promise<Object|null>} the new sticker, or null if it would not decode
     */
    async addFile(file) {
        const sticker = this._add({ kind: 'image', value: file.name || 'image', aspect: 1, media: null });
        try {
            // Decoded against the frame's width, not the sticker's: the
            // sticker's is a thing the user drags, and a decode per drag is
            // the work this design exists to avoid.
            sticker.media = await AnimatedImage.load(file, this.player.canvas?.width || 1280);
            sticker.aspect = sticker.media.width / sticker.media.height || 1;
            this._syncBoxes();
            this._repaintIfPaused();
            return sticker;
        } catch (error) {
            Logger.warn('[Stickers] Could not decode that image:', error);
            this.remove(sticker.id);
            return null;
        }
    }

    /**
     * Add a sticker from a link.
     *
     * Fetched rather than pointed at with an <img>: what comes back is a blob,
     * which is same-origin, so the canvas is never tainted. A cross-origin
     * image drawn directly would taint it and take the recording and the
     * screenshots down with it -- silently, since a tainted canvas throws only
     * when something tries to read it back.
     *
     * @param {string} rawUrl
     * @returns {Promise<Object|null>} the new sticker
     * @throws {Error} with a message meant for the user
     */
    async addFromUrl(rawUrl) {
        let url;
        try { url = new URL(String(rawUrl).trim()); } catch { throw new Error('That does not look like a link.'); }
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            throw new Error('Only http and https links can be loaded.');
        }

        let response;
        try {
            // Credentials omitted deliberately: this is a public image, and the
            // page should not hand cookies to whatever host is typed in here.
            response = await fetch(url.href, { mode: 'cors', credentials: 'omit' });
        } catch {
            // A CORS refusal and a network failure are indistinguishable from
            // in here, by design, so the message covers both.
            throw new Error(`Couldn't load from ${url.host} — it may not allow other sites to fetch its images.`);
        }
        if (!response.ok) throw new Error(`${url.host} answered ${response.status}.`);

        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) {
            throw new Error(`That link is ${blob.type || 'not an image'}, not a picture.`);
        }
        return this.addFile(blob);
    }

    remove(id) {
        const i = this.stickers.findIndex(s => s.id === id);
        if (i === -1) return;
        // An AnimatedImage holds decoded frames; dropping the reference is not
        // enough to give them back.
        this.stickers[i].media?.destroy();
        this.stickers.splice(i, 1);
        if (this.selectedId === id) this.selectedId = null;
        this._syncBoxes();
        this._repaintIfPaused();
    }

    clear() {
        for (const s of this.stickers) s.media?.destroy();
        this.stickers = [];
        this.selectedId = null;
        this._syncBoxes();
        this._repaintIfPaused();
    }

    /** Show the outlines and let them be dragged. */
    setEditing(on) {
        this.editing = !!on;
        if (!this.editing) this.selectedId = null;
        this._syncBoxes();
    }

    destroy() {
        this.player.removeRenderCallback?.(this._draw);
        this._resizeObserver?.disconnect();
        this._resizeObserver = null;
        this.clear();
        this._overlay?.remove();
        this._overlay = null;
        this._boxes.clear();
    }

    /**
     * Redraw the frame that is already on screen.
     *
     * While playing, the next frame carries the change along. Paused, nothing
     * redraws -- and placing stickers is mostly something you do paused, so
     * without this a sticker you just added or dragged stayed invisible until
     * you hit play.
     * @private
     */
    _repaintIfPaused() {
        const player = this.player;
        if (player.isPlaying) return;
        if (player.isStreamMode) { player._renderStreamFrame?.(); return; }
        if (player.videoTrack) player._extractAndDrawFrame?.(player.currentTime);
    }

    /** @private */
    _add(props) {
        const sticker = {
            id: nextId++, x: 0.5 - DEFAULT_WIDTH / 2, y: 0.5 - DEFAULT_WIDTH / 2,
            w: DEFAULT_WIDTH, opacity: 1, ...props,
        };
        this.stickers.push(sticker);
        this.selectedId = sticker.id;
        this._syncBoxes();
        this._repaintIfPaused();
        return sticker;
    }

    // --- drawing ---------------------------------------------------------

    /**
     * Draw the stickers onto any canvas, at whatever size it is. Used for a
     * screenshot, which composites a freshly decoded frame at the file's own
     * resolution rather than the player canvas's -- the positions are
     * fractions of the frame, so they land in the same place either way.
     *
     * @param {HTMLCanvasElement} canvas
     * @param {CanvasRenderingContext2D} ctx
     */
    drawInto(canvas, ctx) { this._draw(canvas, ctx); }

    /** @private */
    _draw(canvas, ctx) {
        if (!this.stickers.length) return;
        // The video's own clock, not the wall clock, so a GIF sticker seeks
        // with the picture and a screenshot catches the frame you were
        // actually looking at.
        const now = this.player.overlayTimeMs?.() ?? performance.now();

        for (const s of this.stickers) {
            const w = s.w * canvas.width;
            const h = w / (s.aspect || 1);
            const motion = STICKER_MOTIONS[s.motion]?.at(now / 1000);
            const x = (s.x + (motion?.dx || 0)) * canvas.width;
            const y = (s.y + (motion?.dy || 0)) * canvas.height;

            ctx.save();
            ctx.globalAlpha = s.opacity;

            // Scale and spin happen about the sticker's middle; the outline
            // stays put, marking where the sticker lives rather than where
            // this instant of its motion has put it.
            if (motion && (motion.scale !== 1 || motion.rotate !== 0)) {
                ctx.translate(x + w / 2, y + h / 2);
                ctx.rotate(motion.rotate);
                ctx.scale(motion.scale, motion.scale);
                ctx.translate(-w / 2, -h / 2);
            } else {
                ctx.translate(x, y);
            }

            if (s.kind === 'emoji') {
                // fillText, not a cached sprite: a sticker can be half the
                // frame wide, where a 96px sprite would be visibly soft, and
                // there are only ever a handful of them.
                ctx.font = `${h}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
                ctx.textBaseline = 'top';
                ctx.fillText(s.value, 0, 0);
            } else if (s.media) {
                ctx.drawImage(s.media.frameAt(now), 0, 0, w, h);
            }
            ctx.restore();
        }
    }

    /**
     * Give the selected sticker a motion, or clear it.
     * @param {string|null} name - a key of STICKER_MOTIONS
     */
    setMotion(name) {
        const sticker = this.stickers.find(s => s.id === this.selectedId)
            || this.stickers[this.stickers.length - 1];
        if (!sticker) return;
        sticker.motion = (sticker.motion === name || !STICKER_MOTIONS[name]) ? null : name;
        this._repaintIfPaused();
    }

    // --- placement -------------------------------------------------------

    /**
     * The frame's rectangle on screen. The canvas is `object-fit: contain`, so
     * its element box is not where the picture is -- letterboxing has to come
     * out or every sticker lands offset from where it was dropped.
     * @private
     */
    _contentRect() {
        const canvas = this.player.canvas;
        const wrapper = this._overlay?.parentElement;
        if (!canvas?.width || !wrapper) return null;

        const box = canvas.getBoundingClientRect();
        const origin = wrapper.getBoundingClientRect();
        const aspect = canvas.width / canvas.height;

        let width = box.width, height = box.width / aspect;
        if (height > box.height) { height = box.height; width = box.height * aspect; }

        return {
            left: (box.left - origin.left) + (box.width - width) / 2,
            top: (box.top - origin.top) + (box.height - height) / 2,
            width, height,
            clientLeft: box.left + (box.width - width) / 2,
            clientTop: box.top + (box.height - height) / 2,
        };
    }

    /** @private */
    _ensureOverlay() {
        const wrapper = this.player?.container?.querySelector('.jellyjump-video-wrapper');
        if (!wrapper) return;

        this._overlay = document.createElement('div');
        this._overlay.className = 'jellyjump-sticker-layer';
        wrapper.appendChild(this._overlay);

        // Pointer events rather than mouse events: one path covers a mouse, a
        // finger and a stylus, and the camera is mostly used on a phone.
        this._overlay.addEventListener('pointerdown', e => this._onPointerDown(e));

        // The outlines are placed in screen pixels over a canvas that is
        // `object-fit: contain`, so they move whenever the box around them
        // does — rotating a phone, entering fullscreen, opening the playlist.
        if (typeof ResizeObserver !== 'undefined') {
            this._resizeObserver = new ResizeObserver(() => this._positionBoxes());
            this._resizeObserver.observe(wrapper);
        }
    }

    /** @private */
    _syncBoxes() {
        if (!this._overlay) return;
        this._overlay.classList.toggle('editing', this.editing);

        for (const [id, box] of this._boxes) {
            if (!this.stickers.some(s => s.id === id)) { box.remove(); this._boxes.delete(id); }
        }
        for (const s of this.stickers) {
            let box = this._boxes.get(s.id);
            if (!box) {
                box = document.createElement('div');
                box.className = 'jellyjump-sticker-box';
                box.dataset.stickerId = String(s.id);
                box.innerHTML = '<span class="jellyjump-sticker-handle" data-handle="resize"></span>'
                    + '<button class="jellyjump-sticker-remove" data-handle="remove" '
                    + 'aria-label="Remove sticker">&times;</button>';
                this._overlay.appendChild(box);
                this._boxes.set(s.id, box);
            }
            box.classList.toggle('selected', this.selectedId === s.id);
        }
        this._positionBoxes();
    }

    /** @private */
    _positionBoxes() {
        const rect = this._contentRect();
        if (!rect) return;
        for (const s of this.stickers) {
            const box = this._boxes.get(s.id);
            if (!box) continue;
            const w = s.w * rect.width;
            const h = w / (s.aspect || 1);
            box.style.left = `${rect.left + s.x * rect.width}px`;
            box.style.top = `${rect.top + s.y * rect.height}px`;
            box.style.width = `${w}px`;
            box.style.height = `${h}px`;
        }
    }

    /** @private */
    _onPointerDown(event) {
        if (!this.editing) return;
        const box = event.target.closest('.jellyjump-sticker-box');
        if (!box) return;

        const id = Number(box.dataset.stickerId);
        const sticker = this.stickers.find(s => s.id === id);
        if (!sticker) return;

        const handle = event.target.dataset?.handle;
        if (handle === 'remove') { this.remove(id); return; }

        this.selectedId = id;
        this._syncBoxes();

        const rect = this._contentRect();
        if (!rect) return;

        const startX = event.clientX, startY = event.clientY;
        const from = { x: sticker.x, y: sticker.y, w: sticker.w };
        const resizing = handle === 'resize';

        event.preventDefault();
        this._overlay.setPointerCapture(event.pointerId);

        const move = (e) => {
            const dx = (e.clientX - startX) / rect.width;
            const dy = (e.clientY - startY) / rect.height;
            if (resizing) {
                sticker.w = Math.max(MIN_WIDTH, Math.min(1, from.w + dx));
            } else {
                // Kept far enough inside that a sticker can always be grabbed
                // again; dragged fully off-frame it would be unreachable.
                sticker.x = Math.max(-from.w / 2, Math.min(1 - from.w / 2, from.x + dx));
                sticker.y = Math.max(-0.25, Math.min(0.95, from.y + dy));
            }
            this._positionBoxes();
            this._repaintIfPaused();
        };
        const up = () => {
            this._overlay.removeEventListener('pointermove', move);
            this._overlay.removeEventListener('pointerup', up);
            this._overlay.removeEventListener('pointercancel', up);
        };
        this._overlay.addEventListener('pointermove', move);
        this._overlay.addEventListener('pointerup', up);
        this._overlay.addEventListener('pointercancel', up);
    }
}
