import { Logger } from '../../shared/utils/Logger.js';
import { Toast } from '../../shared/utils/Toast.js';
import { MenuRouter } from '../menus/core/MenuRouter.js';
import { renderToolGrid } from '../menus/core/ToolGrid.js';
import { offerPanelSurface, takePanelSurface } from '../menus/core/MenuSurface.js';
import { itemToolSections } from '../menus/features/ItemToolsMenu.js';
import { JobQueue } from '../../shared/services/JobQueue.js';
import { StorageService } from '../../shared/services/StorageService.js';
import { html, trusted } from '../../shared/utils/html.js';
import { isDesktop } from '../../shared/platform/Platform.js';

/**
 * EditPanel - editing a video in the sidebar, with the main player as preview.
 *
 * The tools used to open as dialogs over the player, each with a small player
 * of its own, and closed when their job was queued. The panel takes the
 * sidebar's place instead: its tool list, then a tool's settings, while the
 * video stays in the big player beside it.
 *
 * Edits stack. When an applied edit is done, its result takes the original's
 * place in the player and the panel, so the next edit is made on top of it.
 * The playlist holds one edited copy beside the original, replaced at each
 * step, and named after the original ("clip-edited.mp4"); Undo goes one step
 * back and Reset back to the original, which is never changed.
 *
 * The edits are remembered with the copy: the panel opened on it again, after
 * going back to the playlist or after a reload, can still undo them. The
 * earlier copies' files stay in storage for that, until Undo or Reset no
 * longer needs them.
 */

/**
 * Tools that open in a dialog even from the panel: Info is a report to read,
 * and Record belongs to a stream, which has no edits.
 */
const DIALOG_TOOLS = new Set(['info', 'record']);

/**
 * Tools whose result is the edited video, to edit further. A GIF and an
 * encrypted file are ends in themselves: they go to the playlist as before.
 */
const STACKING_TOOLS = new Set([
    'convert', 'reverse', 'resize', 'rotate',
    'trim', 'multicut',
    'crop', 'blur', 'watermark', 'remove-bg',
]);

/** Where the edits are remembered between visits, for the copies they made. */
const HISTORY_KEY = 'jellyjump-edit-history';

/**
 * Whether earlier copies can be read back from storage. The desktop app
 * stores no edited copy, so there Undo needs them in memory, and the edits
 * are not remembered past the session.
 */
const STORES_COPIES = !isDesktop();

/** IndexedDBService stores no file larger than this; such a copy stays in memory. */
const MAX_STORED_FILE = 500 * 1024 * 1024;

/** Fired by Playlist.selectItem, so the panel can follow what is playing. */
export const ITEM_SELECTED_EVENT = 'jellyjump:item-selected';

const ICON = (name, size = 16) =>
    `<svg width="${size}" height="${size}" fill="currentColor" aria-hidden="true"><use href="assets/icons/sprite.svg#${name}"></use></svg>`;

/**
 * A tool's place in the panel, with the methods a tool calls on its Modal, so
 * the tools need not know which one they were given.
 */
class PanelSurface {
    /**
     * @param {EditPanel} panel
     * @param {string} action - the tool, so the panel can reopen it for another item
     */
    constructor(panel, action) {
        this.isPanel = true;
        this.panel = panel;
        this.action = action;
        this.options = {};
        this._cleanupCallbacks = [];
        this._closed = false;

        this.modal = document.createElement('div');
        this.modal.className = 'edit-panel-tool';
        this.body = document.createElement('div');
        this.body.className = 'mb-modal-body edit-panel-tool-body';
        this.footer = document.createElement('div');
        this.footer.className = 'mb-modal-footer edit-panel-tool-footer hidden';
        this.modal.append(this.body, this.footer);

        // A tool locks its dialog's close button while it must not be left;
        // here that is the panel's back button.
        this.closeBtn = panel.backBtn;
    }

    setTitle(text) { this.panel._setToolTitle(text); }

    setBody(content) {
        this.body.innerHTML = '';
        if (typeof content === 'string') this.body.innerHTML = content;
        else this.body.appendChild(content);
    }

    setFooter(content) {
        this.footer.innerHTML = '';
        if (!content) { this.footer.classList.add('hidden'); return; }
        this.footer.classList.remove('hidden');
        if (typeof content === 'string') this.footer.innerHTML = content;
        else this.footer.appendChild(content);
    }

    open() { this.panel._mountTool(this); }

    onCleanup(callback) {
        if (typeof callback === 'function') this._cleanupCallbacks.push(callback);
    }

    close() {
        if (this._closed) return;
        this._closed = true;
        for (const cb of this._cleanupCallbacks) {
            try { cb(); } catch (e) { Logger.warn('Edit panel cleanup error:', e); }
        }
        this._cleanupCallbacks.length = 0;
        this.options.onClose?.();
        this.modal.remove();
        this.panel._unmountTool(this);
    }

    /**
     * Runs when Apply has queued a job.
     * @param {string} name
     * @param {Object} job - from the JobQueue
     * @param {Promise<{ok: boolean, cancelled?: boolean}>} finished
     */
    jobQueued(name, job, finished) { this.panel._applied(this, name, job, finished); }

    querySelector(selector) { return this.modal.querySelector(selector); }
    querySelectorAll(selector) { return this.modal.querySelectorAll(selector); }
}

export class EditPanel {
    /**
     * @param {Object} playlist - Playlist instance
     * @param {HTMLElement} section - the sidebar
     * @param {HTMLElement|null} before - the panel goes in front of this (the job tray)
     */
    constructor(playlist, section, before = null) {
        this.playlist = playlist;
        this.section = section;
        /** @type {Object|null} the item being edited */
        this.item = null;
        /** @type {PanelSurface|null} the open tool */
        this.surface = null;
        /**
         * The edits made to `original`: each step's result, with its file
         * kept for Undo (the playlist lets go of the file of an item it moves
         * away from; after a reload it is read back from storage), and the
         * edit being applied.
         * @type {{original: Object, steps: Array<{item: Object, file: File|null, name: string}>,
         *   pending: {job: Object, name: string, action: string, named?: boolean}|null}|null}
         */
        this.session = null;
        /**
         * Sessions to go back to, by the id of the copy they made last.
         * @type {Map<string, Object>}
         */
        this.histories = new Map();
        /**
         * Sessions left while an edit was being applied, by the id of the
         * video it was applied to: opened again, the panel waits for it
         * again and takes its result, rather than starting afresh.
         * @type {Map<string, Object>}
         */
        this.waiting = new Map();
        this._historiesLoaded = false;
        this.storage = new StorageService();
        playlist.nameProcessedItem = (source, filename) => this._nameCopy(source, filename);

        this.el = document.createElement('section');
        this.el.className = 'edit-panel hidden';
        this.el.setAttribute('aria-label', 'Edit video');
        this.el.innerHTML = String(html`
            <header class="edit-panel-header">
                <button class="edit-panel-back" type="button">${trusted(ICON('icon-chevron-left', 14))}<span class="edit-panel-back-label">Playlist</span></button>
                <div class="edit-panel-heading">
                    <h2 class="edit-panel-title">Edit</h2>
                    <p class="edit-panel-item"></p>
                </div>
            </header>
            <div class="edit-panel-history hidden">
                <span class="edit-panel-steps"></span>
                <button class="edit-panel-undo" type="button" title="Take back the last edit">Undo</button>
                <button class="edit-panel-reset" type="button" title="Back to the original video">Reset</button>
                <span class="edit-panel-confirm hidden">
                    <span class="edit-panel-confirm-text">Discard every edit?</span>
                    <button class="edit-panel-confirm-yes" type="button">Discard</button>
                    <button class="edit-panel-confirm-no" type="button">Keep</button>
                </span>
            </div>
            <div class="edit-panel-busy hidden" role="status" aria-live="polite">
                <div class="edit-panel-busy-row">
                    <span class="edit-panel-busy-text"></span>
                    <button class="edit-panel-busy-cancel" type="button">Cancel</button>
                </div>
                <div class="edit-panel-busy-bar"><div></div></div>
            </div>
            <div class="edit-panel-tools"></div>
            <div class="edit-panel-note hidden" role="status" aria-live="polite"></div>
        `);
        section.insertBefore(this.el, before);

        this.backBtn = this.el.querySelector('.edit-panel-back');
        this.backLabel = this.el.querySelector('.edit-panel-back-label');
        this.titleEl = this.el.querySelector('.edit-panel-title');
        this.itemEl = this.el.querySelector('.edit-panel-item');
        this.toolsEl = this.el.querySelector('.edit-panel-tools');
        this.noteEl = this.el.querySelector('.edit-panel-note');
        this.historyEl = this.el.querySelector('.edit-panel-history');
        this.stepsEl = this.el.querySelector('.edit-panel-steps');
        this.undoBtn = this.el.querySelector('.edit-panel-undo');
        this.resetBtn = this.el.querySelector('.edit-panel-reset');
        this.busyEl = this.el.querySelector('.edit-panel-busy');
        this.busyText = this.el.querySelector('.edit-panel-busy-text');
        this.busyBar = this.el.querySelector('.edit-panel-busy-bar > div');

        this.backBtn.addEventListener('click', () => this.back());
        this.confirmEl = this.el.querySelector('.edit-panel-confirm');
        this.undoBtn.addEventListener('click', () => this.undo());
        // Reset throws away every edit, so it asks first.
        this.resetBtn.addEventListener('click', () => this._confirmReset(true));
        this.el.querySelector('.edit-panel-confirm-yes').addEventListener('click', () => {
            this._confirmReset(false);
            this.reset();
        });
        this.el.querySelector('.edit-panel-confirm-no').addEventListener('click', () => this._confirmReset(false));
        this.el.querySelector('.edit-panel-busy-cancel')
            .addEventListener('click', () => this.session?.pending?.job.cancel());

        this._onSelected = (e) => this._follow(e.detail?.item);
        window.addEventListener(ITEM_SELECTED_EVENT, this._onSelected);

        this._onKeydown = (e) => this._keydown(e);
        document.addEventListener('keydown', this._onKeydown);
    }

    get isOpen() { return !this.el.classList.contains('hidden'); }

    /**
     * Edit the playlist item at this index; the main player switches to it.
     * @param {number} index
     */
    open(index) {
        const item = this.playlist.items[index];
        if (item) this.openItem(item);
    }

    /**
     * @param {Object} item - a playlist item
     * @param {{focus?: boolean, step?: boolean}} [options] - focus moves to
     *   the panel unless it is following the player rather than answering a
     *   click; `step` moves along the edits rather than to another video
     */
    openItem(item, { focus = true, step = false } = {}) {
        if (!this._leaveTool()) return;
        this.item = item;
        if (!step) {
            if (this.session) this._shelve(this.session);
            this.session = this._resume(item) ?? { original: item, steps: [], pending: null };
        }
        this.section.classList.add('editing');
        this._quietPlayer();
        this.el.classList.remove('hidden');
        this._showTools();

        // The player is the preview, so it shows what is being edited.
        const index = this.playlist.items.indexOf(item);
        if (index !== -1 && this.playlist.activeIndex !== index) {
            this.playlist.selectItem(index, false);
        }
        this.playlist.player?._restoreAutoplayAudio?.('Edit panel opened');
        if (focus) this.backBtn.focus({ preventScroll: true });
    }

    /** Back to the playlist. */
    close() {
        if (!this._leaveTool()) return;
        this.item = null;
        // The edits so far are remembered with the copy. An edit still being
        // applied finishes as an ordinary job, its result in the playlist,
        // unless its video is opened again before it is done: the panel then
        // waits for it again, locked, and takes the result as a step.
        if (this.session) this._shelve(this.session);
        this.session = null;
        this._renderSession();
        this.el.classList.add('hidden');
        this.section.classList.remove('editing');
        this._restorePlayer();
        this._note('');
        // Back to the row it was opened from.
        this.playlist.scrollToPlaying?.();
    }

    /** One step back: from a tool to the tool list, from there to the playlist. */
    back() {
        if (this.surface) this._leaveTool();
        else this.close();
    }

    /** Close the open tool, unless it is busy. @returns {boolean} whether it closed */
    _leaveTool() {
        if (!this.surface) return true;
        if (this.backBtn.disabled) {
            Toast.show('Wait for this to finish, or cancel it first.', 3000);
            return false;
        }
        this.surface.close();
        // A tool can refuse to close (Convert, while it makes HLS).
        return !this.surface;
    }

    _showTools() {
        const { sections, limited } = itemToolSections(this.item);
        const grid = renderToolGrid(sections, { columns: limited ? 3 : 4 });
        grid.addEventListener('click', (e) => {
            const tile = e.target.closest('.tools-tile');
            if (tile) this._openTool(tile.dataset.action);
        });
        this.toolsEl.replaceChildren(grid);
        this.toolsEl.classList.remove('hidden');
        this._renderSession();
        this.titleEl.textContent = 'Edit';
        this.itemEl.textContent = this.item.title;
        this.itemEl.title = this.item.title;
        this.backLabel.textContent = 'Playlist';
        this.backBtn.setAttribute('aria-label', 'Back to the playlist');
    }

    async _openTool(action) {
        const index = this.playlist.items.indexOf(this.item);
        if (index === -1) {
            Toast.show('That video is no longer in the playlist.', 3000, true);
            this.close();
            return;
        }
        this._note('');

        if (DIALOG_TOOLS.has(action)) {
            // A dialog over the player, which waits meanwhile.
            this.playlist.player?.pause();
            MenuRouter.init(action, index, this.playlist);
            return;
        }

        offerPanelSurface(new PanelSurface(this, action));
        try {
            await MenuRouter.init(action, index, this.playlist);
        } finally {
            // Refused before it opened (a YouTube item, say): the offer must
            // not be left for the next dialog to take.
            takePanelSurface();
        }
    }

    _mountTool(surface) {
        if (this.surface && this.surface !== surface) this.surface.close();
        this.surface = surface;
        if (surface.action === 'export-fx') this._lendEffects(surface);
        this.toolsEl.classList.add('hidden');
        this.el.insertBefore(surface.modal, this.noteEl);
        this.backLabel.textContent = 'All tools';
        this.backBtn.setAttribute('aria-label', 'Back to all tools');
        this._renderSession();
    }

    _unmountTool(surface) {
        if (this.surface !== surface) return;
        this.surface = null;
        this.backBtn.disabled = false;
        if (this.item) this._showTools();
    }

    _setToolTitle(text) {
        this.titleEl.textContent = text;
    }

    _note(text) {
        clearTimeout(this._noteTimer);
        this.noteEl.textContent = text;
        this.noteEl.classList.toggle('hidden', !text);
        if (text) this._noteTimer = setTimeout(() => this._note(''), 4000);
    }

    /**
     * A tool's Apply queued its job. An edit to stack waits here, the panel
     * locked, and its result then opens in the player and the panel, in the
     * same tool, to go on from.
     * @param {PanelSurface} surface
     * @param {string} name
     * @param {Object} job
     * @param {Promise<{ok: boolean, cancelled?: boolean}>} finished
     */
    _applied(surface, name, job, finished) {
        const session = this.session;
        if (!session || !STACKING_TOOLS.has(surface.action)) {
            this._note(`${name} added to Jobs`);
            return;
        }
        const source = this.item;
        session.pending = { job, name, action: surface.action };
        this.waiting.set(source.id, session);
        this._renderSession();
        const unsubscribe = JobQueue.subscribe(() => {
            if (this.session === session) this._renderBusy();
        });

        finished.then((outcome) => {
            unsubscribe();
            session.pending = null;
            if (this.waiting.get(source.id) === session) this.waiting.delete(source.id);
            // Left the panel, or went to another video: an ordinary job then.
            if (this.session !== session) return;
            this._renderSession();
            if (!outcome.ok) {
                this._note(outcome.cancelled ? `${name} cancelled` : (job.error || `${name} failed`));
                return;
            }
            // The file as the job made it: by now the playlist may have
            // stored it and let go of the item's own.
            const collected = job.results.length === 1 ? job.results[0] : null;
            const result = collected?.item ?? null;
            const file = collected?.file ?? result?.file ?? null;
            if (!result || !file || this.item !== source) {
                this._note(`${name} added to Jobs`);
                return;
            }
            // Back on the tool list meanwhile, it stays there.
            const tool = this.surface?.action;
            if (!this._leaveTool()) {
                this._note(`${name} added to Jobs`);
                return;
            }
            const replaced = session.steps.at(-1)?.item;
            session.steps.push({ item: result, file, name });
            this._remember(session);
            this._step(result, tool);
            if (replaced) this._discard(replaced);
            this._note(`${name} applied. Keep editing, or Undo.`);
        });
    }

    /** Take back the last edit. */
    async undo() {
        const session = this.session;
        if (!session?.steps.length || session.pending || this._undoing) return;
        const before = session.steps.at(-2);
        if (!before && !this._inPlaylist(session.original)) return;
        // After a reload the earlier copy's file is in storage, not in memory.
        if (before && !before.file) {
            this._undoing = true;
            this.undoBtn.disabled = true;
            try {
                before.file = await this.storage.loadFile(before.item.id).catch(() => null);
            } finally {
                this._undoing = false;
                this._renderBusy();
            }
            if (this.session !== session || session.pending || session.steps.at(-2) !== before) return;
            if (!before.file) {
                Toast.show('The copy before this edit is no longer stored, so it cannot be undone. Reset still goes back to the original.', 5000, true);
                return;
            }
        }
        const tool = this.surface?.action;
        if (!this._leaveTool()) return;
        const last = session.steps.pop();
        const target = before ? this._restore(before, last.item) : session.original;
        this._remember(session, last.item);
        this._step(target, tool);
        this._discard(last.item);
        this._forget([last.item]);
        this._note(`${last.name} undone`);
    }

    /** All edits gone: the original, to start again from. */
    reset() {
        const session = this.session;
        if (!session?.steps.length || session.pending) return;
        if (!this._inPlaylist(session.original)) return;
        const tool = this.surface?.action;
        if (!this._leaveTool()) return;
        const steps = session.steps;
        const last = steps.at(-1).item;
        session.steps = [];
        this._remember(session, last);
        this._step(session.original, tool);
        this._discard(last);
        this._forget(steps.map((s) => s.item));
        this._note('Back to the original');
    }

    /** Move along the edits: the player and the panel go to this item, in the same tool. */
    _step(item, action) {
        this.openItem(item, { focus: false, step: true });
        if (action && this.item === item) this._openTool(action);
    }

    _inPlaylist(item) {
        if (this.playlist.items.includes(item)) return true;
        Toast.show('That video is no longer in the playlist.', 3000, true);
        return false;
    }

    /** An edited copy no longer wanted, out of the playlist. */
    _discard(item) {
        const index = this.playlist.items.indexOf(item);
        if (index !== -1) this.playlist.removeItem(index);
    }

    /**
     * The name of an edit's result, when it is a step of the open session:
     * the original's, as an edited copy, whatever the tool would call it.
     * @param {Object} source - the item the tool worked on
     * @param {string} filename - the tool's name for the result
     * @returns {{title: string, path: string}|null} null to keep the tool's
     */
    _nameCopy(source, filename) {
        const session = this.session;
        const pending = session?.pending;
        // Only the pending edit's own result: a job queued before it (a GIF of
        // the same video, say) finishes first and keeps its name.
        if (!pending || pending.named || pending.job.status !== 'running'
            || source !== this.item || !STACKING_TOOLS.has(pending.action)) return null;
        pending.named = true;
        const { original } = session;
        const ext = /\.[^/.]+$/.exec(filename)?.[0] ?? /\.[^/.]+$/.exec(original.title)?.[0] ?? '.mp4';
        // The copy keeps its name from step to step...
        const current = session.steps.at(-1)?.item;
        const currentBase = current?.title.replace(/\.[^/.]+$/, '');
        const base = original.title.replace(/\.[^/.]+$/, '').replace(/-edited(-\d+)?$/, '');
        // ...and another session's copy of the same video gets a number.
        const taken = new Set(this.playlist.items.filter((i) => i !== current).map((i) => i.title));
        let stem = currentBase ?? `${base}-edited`;
        for (let n = 2; taken.has(`${stem}${ext}`); n++) stem = `${base}-edited-${n}`;
        const title = `${stem}${ext}`;
        return { title, path: `${original.path || original.title}/${title}` };
    }

    /**
     * Remember the session under the copy it made last, for the panel to
     * pick up there again, here or after a reload.
     * @param {Object} session
     * @param {Object} [previous] - the copy it was remembered under before
     */
    _remember(session, previous) {
        this._loadHistories();
        if (previous) this.histories.delete(previous.id);
        for (const [id, s] of this.histories) if (s === session) this.histories.delete(id);
        const last = session.steps.at(-1)?.item;
        if (last) this.histories.set(last.id, session);
        this._saveHistories();
    }

    /**
     * The session that made this copy, if it is one the panel remembers.
     * @param {Object} item
     * @returns {Object|null}
     */
    _resume(item) {
        // Left mid-edit: the panel goes back to waiting for it.
        const waiting = this.waiting.get(item.id);
        if (waiting?.pending) return waiting;
        this._loadHistories();
        this._prune();
        const session = this.histories.get(item.id);
        if (!session) return null;
        // The stored copy stands in for its last step from now on.
        session.steps.at(-1).item = item;
        return session;
    }

    /**
     * A session left for later: its copies' files go from memory, since Undo
     * reads them back from storage. Not where storage cannot hold them.
     * @param {Object} session
     */
    _shelve(session) {
        if (!STORES_COPIES || session.pending) return;
        for (const step of session.steps) {
            if (step.file && step.file.size < MAX_STORED_FILE) step.file = null;
        }
    }

    /**
     * Drop what is remembered for copies no longer in the playlist (removed
     * from it outside the panel), and the files kept for their Undo.
     */
    _prune() {
        const ids = new Set(this.playlist.items.map((i) => i.id));
        let changed = false;
        for (const [id, session] of this.histories) {
            if (session === this.session) continue;
            // Reset goes back to the original, so without it there is nothing to go on with.
            if (ids.has(id) && ids.has(session.original.id)) continue;
            this.histories.delete(id);
            this._forget(session.steps.map((s) => s.item));
            changed = true;
        }
        if (changed) this._saveHistories();
    }

    /**
     * The files of copies gone from the playlist for good, out of storage.
     * @param {Object[]} items
     */
    _forget(items) {
        for (const item of items) {
            if (this.playlist.items.includes(item)) continue;
            if (this.playlist.items.some((i) => i.id === item.id)) continue;
            this.storage.deleteFile?.(item.id)?.catch?.(() => {});
        }
    }

    _loadHistories() {
        if (this._historiesLoaded) return;
        this._historiesLoaded = true;
        let stored = {};
        try { stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}') || {}; } catch { /* blocked, or not ours */ }
        let dropped = false;
        for (const [id, entry] of Object.entries(stored)) {
            const original = this.playlist.items.find((i) => i.id === entry?.originalId);
            if (!original || !Array.isArray(entry?.steps) || !entry.steps.length) {
                // Its original is gone: nothing to go on with, and the
                // earlier copies kept for its Undo are not wanted any more.
                if (Array.isArray(entry?.steps)) this._forget(entry.steps.filter((s) => s?.id).map((s) => ({ id: s.id })));
                dropped = true;
                continue;
            }
            this.histories.set(id, {
                original,
                pending: null,
                steps: entry.steps.map((s) => ({
                    name: s.name,
                    file: null,
                    item: {
                        id: s.id, title: s.title, duration: s.duration, path: s.path, type: s.type || 'video',
                        mimeType: s.mimeType, fileType: s.fileType, fileSize: s.fileSize, isLocal: true,
                    },
                })),
            });
        }
        if (dropped) this._saveHistories();
    }

    _saveHistories() {
        const stored = {};
        for (const [id, session] of this.histories) {
            stored[id] = {
                originalId: session.original.id,
                steps: session.steps.map(({ item, name }) => ({
                    id: item.id, title: item.title, duration: item.duration, path: item.path, type: item.type,
                    mimeType: item.mimeType, fileType: item.fileType, fileSize: item.fileSize, name,
                })),
            };
        }
        try {
            if (STORES_COPIES && Object.keys(stored).length) localStorage.setItem(HISTORY_KEY, JSON.stringify(stored));
            else localStorage.removeItem(HISTORY_KEY);
        } catch { /* blocked: remembered until the page closes */ }
    }

    /**
     * Export FX saves the player's own effects, which the panel otherwise
     * puts away while editing: they are back, with the Filters button, for
     * as long as it is open, and whatever they are then is what comes back
     * when the panel closes.
     * @param {PanelSurface} surface
     */
    _lendEffects(surface) {
        const player = this.playlist.player;
        const saved = this._playerSaved;
        if (!player || !saved) return;
        player.container?.classList.add('jj-export-fx');
        if (saved.filters) {
            player.videoFilters?.setState(saved.filters);
            player._updateFiltersButtonState?.();
        }
        surface.onCleanup(() => {
            player.container?.classList.remove('jj-export-fx');
            if (player.ui?.filterPanel) player.ui.filterPanel.style.display = 'none';
            // Closed with the panel: _restorePlayer puts back what is saved.
            const current = this._playerSaved;
            if (!current) return;
            current.filters = player.videoFilters?.isActive() ? player.videoFilters.getState() : null;
            player.videoFilters?.reset();
            player._updateFiltersButtonState?.();
        });
    }

    /**
     * An earlier step, back in the playlist, after the copy it replaces.
     * After, not before: the playlist's active index does not move for an
     * insert, so one before the playing copy would take its place unseen.
     * @param {{item: Object, file: File}} step
     * @param {Object} current - the copy in the playlist now
     */
    _restore(step, current) {
        const { item, file } = step;
        item.file = file;
        item.url = URL.createObjectURL(file);
        item.blob_url = item.url;
        let index = this.playlist.items.indexOf(current) + 1;
        if (index === 0) index = this.playlist.items.indexOf(this.session.original) + 1;
        if (index === 0) index = this.playlist.items.length;
        this.playlist.state.insertItem(index, item);
        this.playlist.render();
        this.playlist._saveState();
        return item;
    }

    /** @param {boolean} asking - show the question, or put it away */
    _confirmReset(asking) {
        const steps = this.session?.steps.length ?? 0;
        asking = asking && steps > 0;
        this.confirmEl.querySelector('.edit-panel-confirm-text').textContent =
            steps > 1 ? `Discard all ${steps} edits?` : 'Discard the edit?';
        this.confirmEl.classList.toggle('hidden', !asking);
        for (const el of [this.stepsEl, this.undoBtn, this.resetBtn]) el.classList.toggle('hidden', asking);
        if (asking) this.confirmEl.querySelector('.edit-panel-confirm-no').focus({ preventScroll: true });
    }

    /**
     * Editing shows the video as it will be saved, and leaves only the
     * controls for that. Filters, a playback speed and playing backwards are
     * the viewer's, never in the saved file, so they wait until the panel
     * closes; their buttons are put away meanwhile (see player.css).
     */
    _quietPlayer() {
        const player = this.playlist.player;
        if (!player || this._playerSaved) return;
        const saved = { filters: null, rate: null, pinned: false };
        player.container?.classList.add('jj-editing');
        // The controls pinned below the picture, not laid over it: the
        // tools draw on the whole picture, and the timeline is always there
        // to find a frame on. Not saved: laid over is the user's setting.
        if (player.controlBarMode === 'overlay' && player.controlBar) {
            player.controlBarMode = 'fixed';
            player.controlBar.applyMode();
            saved.pinned = true;
        }
        for (const panel of [player.ui?.filterPanel, player.ui?.speedPanel, player.ui?.ccPanel, player.ui?.loopPanel]) {
            if (panel) panel.style.display = 'none';
        }
        if (player.videoFilters?.isActive()) {
            saved.filters = player.videoFilters.getState();
            player.videoFilters.reset();
        }
        if (player.engine !== 'youtube' && player.playbackRate && player.playbackRate !== 1) {
            saved.rate = player.playbackRate;
            player.setPlaybackRate(1).finally(() => {
                // The speed is saved as the user's choice; this one is not.
                try { localStorage.setItem('jellyjump-speed', String(saved.rate)); } catch { /* blocked */ }
            });
        }
        if (player.reverse?.active) player.reverse.stop({ reposition: false });
        this._playerSaved = saved;
    }

    _restorePlayer() {
        const player = this.playlist.player;
        const saved = this._playerSaved;
        this._playerSaved = null;
        player?.container?.classList.remove('jj-editing');
        if (!player || !saved) return;
        if (saved.filters) {
            player.videoFilters?.setState(saved.filters);
            player._updateFiltersButtonState?.();
        }
        if (saved.rate) player.setPlaybackRate(saved.rate);
        if (saved.pinned && player.controlBarMode === 'fixed') {
            player.controlBarMode = 'overlay';
            player.controlBar.applyMode();
        }
    }

    _renderSession() {
        this._confirmReset(false);
        const steps = this.session?.steps ?? [];
        this.historyEl.classList.toggle('hidden', steps.length === 0);
        this.stepsEl.textContent = steps.map((s) => s.name).join(' → ');
        this.stepsEl.title = this.session ? `Edits to ${this.session.original.title}` : '';
        this._renderBusy();
    }

    /** While an edit is applied the panel waits for it: nothing to change meanwhile. */
    _renderBusy() {
        const pending = this.session?.pending;
        this.busyEl.classList.toggle('hidden', !pending);
        this.el.classList.toggle('busy', !!pending);
        this.toolsEl.inert = !!pending;
        if (this.surface) this.surface.modal.inert = !!pending;
        this.undoBtn.disabled = this.resetBtn.disabled = !!pending;
        if (this._undoing) this.undoBtn.disabled = true;
        if (!pending) return;
        const { job, name } = pending;
        const pct = Math.round((job.progress || 0) * 100);
        this.busyText.textContent = job.status === 'queued'
            ? `${name}: waiting for the job before it`
            : `${name}: ${job.label || 'working'} ${pct}%`;
        this.busyBar.style.width = `${pct}%`;
    }

    /**
     * The player moved to another item -- the next video, or a job's result.
     * The panel goes with it, and an open tool reopens for the new item, so
     * what the tool shows is always what the player shows.
     */
    _follow(item) {
        if (!this.isOpen || !item || item === this.item) return;
        if (this.backBtn.disabled) return; // busy: it keeps its item
        const action = this.surface?.action;
        this.openItem(item, { focus: false });
        if (action && !item.isYouTube) this._openTool(action);
    }

    _keydown(e) {
        if (e.key !== 'Escape' || e.defaultPrevented || e.isComposing || !this.isOpen) return;
        // A dialog over the page, or fullscreen, owns the key.
        if (document.querySelector('.mb-modal-overlay') || document.fullscreenElement) return;
        if (this.backBtn.disabled) return;
        e.preventDefault();
        this.back();
    }

    destroy() {
        this.session = null;
        this._restorePlayer();
        window.removeEventListener(ITEM_SELECTED_EVENT, this._onSelected);
        document.removeEventListener('keydown', this._onKeydown);
        this.surface?.close();
        this.el.remove();
    }
}
