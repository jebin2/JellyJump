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
import { mountPlayerShell, initPlayerResizeObserver, handlePlayerResize, togglePlayerFullscreen } from './PlayerShell.js';
import { createHelpOverlay } from './PlayerOverlays.js';
import { createPlayerControls } from './PlayerControlsView.js';
import { attachPlayerBindings } from './PlayerBindings.js';
import {
    handlePlayerDocumentClick, togglePlayerFilterPanel, togglePlayerSpeedPanel, togglePlayerSubtitlePanel,
    syncPlayerFilterSliders, togglePlayerAudioPanel, syncPlayerEqSliders,
} from './PlayerPanels.js';
import { updatePlayerFullscreenUI, showPlayerBezel } from './PlayerUIUpdates.js';
import { PlayerKeyboard } from './PlayerKeyboard.js';
import { PlayerSubtitles } from './PlayerSubtitles.js';
import { PlayerLoopControl } from './PlayerLoopControl.js';
import { PlayerThumbnails } from './PlayerThumbnails.js';
import { PlayerControlBar } from './PlayerControlBar.js';
import { ScreenshotManager } from './ScreenshotManager.js';

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
        if (controls.controlBar) player.controlBar.applyMode();
        if (controls.fullscreen) initPlayerResizeObserver(player);
    },

    /** The bars drawn for audio-only files, loaded when first needed. @param {HTMLCanvasElement} canvas */
    async createAudioVisualizer(canvas) {
        const { AudioVisualizer } = await import('./AudioVisualizer.js');
        return new AudioVisualizer(canvas);
    },

    handleResize: handlePlayerResize,
    toggleFullscreen: togglePlayerFullscreen,
    updateFullscreenUI: updatePlayerFullscreenUI,
    showBezel: showPlayerBezel,
    handleDocumentClick: handlePlayerDocumentClick,
    toggleFilterPanel: togglePlayerFilterPanel,
    toggleSpeedPanel: togglePlayerSpeedPanel,
    toggleSubtitlePanel: togglePlayerSubtitlePanel,
    syncFilterSliders: syncPlayerFilterSliders,
    toggleAudioPanel: togglePlayerAudioPanel,
    syncEqSliders: syncPlayerEqSliders,
};

/**
 * The player, with its controls, in the element `containerId`.
 * @param {string} containerId @param {Object} [options] see core/config.js
 */
export function createPlayer(containerId, options = {}) {
    return new CorePlayer(containerId, options, playerView);
}
