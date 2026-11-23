// @ts-check
/**
 * Build the player with its controls (ARCHITECTURE_PLAN.md H3).
 *
 * The core (core/Player.js) plays media and announces its state; it imports
 * nothing from ui/. What it shows on screen comes from the view below,
 * handed to it here: the shell and controls it mounts, the parts that own
 * a piece of the screen (keyboard, captions, loop, thumbnails, control bar),
 * and the few things the core asks the screen to do (a bezel, fullscreen,
 * a panel). Both pages build the player through `createPlayer`.
 *
 *   const player = createPlayer('player-container', { mode: 'player' });
 */
import { CorePlayer } from '../../core/Player.js';
import { mountPlayerShell, initPlayerResizeObserver } from './PlayerShell.js';
import { createHelpOverlay } from './PlayerOverlays.js';
import { createPlayerControls } from './PlayerControlsView.js';
import { attachPlayerBindings } from './PlayerBindings.js';
import { handlePlayerDocumentClick } from './PlayerPanels.js';
import { updatePlayerFullscreenUI, showPlayerBezel } from './PlayerUIUpdates.js';
import { PlayerKeyboard } from './PlayerKeyboard.js';
import { PlayerSubtitles } from './PlayerSubtitles.js';
import { PlayerLoopControl } from './PlayerLoopControl.js';
import { PlayerThumbnails } from './PlayerThumbnails.js';
import { PlayerControlBar } from './PlayerControlBar.js';
import { ScreenshotManager } from './ScreenshotManager.js';
import { handlePlayerVisibilityChange } from '../../core/playback/PlaybackState.js';

const FULLSCREEN_EVENTS = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];
/** The document listeners each mounted player added, for `unmount`. @type {WeakMap<object, [string, EventListener][]>} */
const documentListeners = new WeakMap();

/** What the core is given to show itself with. */
export const playerView = {
    /** The parts that own a piece of the screen; built before `mount`. @param {any} player */
    parts(player) {
        return {
            keyboard: new PlayerKeyboard(player),
            subtitles: new PlayerSubtitles(player),
            loop: new PlayerLoopControl(player),
            thumbnails: new PlayerThumbnails(player),
            controlBar: new PlayerControlBar(player),
        };
    },

    /** Put the player on the page: shell, controls, bindings. @param {any} player */
    mount(player) {
        const controls = player.config.controls;
        mountPlayerShell(player);
        if (controls.settings) player.screenshotManager = new ScreenshotManager(player);
        createPlayerControls(player);
        if (controls.keyboard) createHelpOverlay(player);
        attachPlayerBindings(player);

        /** @type {[string, EventListener][]} */
        const listeners = [
            ['visibilitychange', () => handlePlayerVisibilityChange(player)],
            ['click', (e) => handlePlayerDocumentClick(player, e)],
        ];
        if (controls.fullscreen) {
            const fullscreen = () => updatePlayerFullscreenUI(player);
            for (const event of FULLSCREEN_EVENTS) listeners.push([event, fullscreen]);
        }
        if (controls.keyboard) listeners.push(['keydown', (e) => player.keyboard.handleKeyboard(e)]);
        for (const [event, fn] of listeners) document.addEventListener(event, fn);
        documentListeners.set(player, listeners);

        if (controls.controlBar) player.controlBar.applyMode();
        if (controls.fullscreen) initPlayerResizeObserver(player);
    },

    /**
     * Take the player off the page: what `mount` added to the document,
     * and the controls the player does not remove with its canvas.
     * @param {any} player
     */
    unmount(player) {
        const { ui } = player;
        for (const [event, fn] of documentListeners.get(player) ?? []) document.removeEventListener(event, fn);
        documentListeners.delete(player);
        player.resizeObserver?.disconnect();
        player.resizeObserver = null;
        ui.controls?.remove();
        ui.helpOverlay?.remove();
        ui.loader?.remove();
    },

    /** The bars drawn for audio-only files, loaded when first needed. @param {HTMLCanvasElement} canvas */
    async createAudioVisualizer(canvas) {
        const { AudioVisualizer } = await import('./AudioVisualizer.js');
        return new AudioVisualizer(canvas);
    },

    showBezel: showPlayerBezel,
};

/**
 * The player, with its controls, in the element `containerId`.
 * @param {string} containerId @param {Object} [options] see core/config.js
 */
export function createPlayer(containerId, options = {}) {
    return new CorePlayer(containerId, options, playerView);
}
