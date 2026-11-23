// @ts-check
/**
 * The player's controls, kept up to date by listening to the player
 * (ARCHITECTURE_PLAN.md H2) instead of being called by it.
 *
 * The core announces its state (core/PlayerStateEvents.js); this is the one
 * place the controls subscribe. Each control is drawn once when attached,
 * then on every event that could change it.
 */
import {
    updatePlayerPlayPauseUI, updatePlayerProgress, updatePlayerVolumeUI, showPlayerLoading,
} from './PlayerUIUpdates.js';
import { updatePlayerSpeedMenu, updatePlayerFiltersButtonState } from './PlayerPanels.js';
import { Logger } from '../../shared/utils/Logger.js';

/** @param {any} player */
export function listenToPlayer(player) {
    const playButton = () => updatePlayerPlayPauseUI(player);
    const progress = () => updatePlayerProgress(player);
    const volume = () => updatePlayerVolumeUI(player);
    const speed = () => updatePlayerSpeedMenu(player);
    const loading = () => { showPlayerLoading(player, !!player.isLoading); playButton(); };

    // The play button also shows the direction and hides its overlay while loading.
    for (const event of ['play', 'pause', 'directionchange']) player.on(event, playButton);
    for (const event of ['timeupdate', 'durationchange']) player.on(event, progress);
    player.on('volumechange', volume);
    player.on('ratechange', speed);
    player.on('loadingchange', loading);

    const filters = () => updatePlayerFiltersButtonState(player);
    // The A-B markers sit at a share of the duration, so a range set while
    // the video loads is placed once the duration arrives.
    const loop = () => player.loop?.renderLoopUI();
    const tracks = () => {
        player.subtitles?.renderSubtitleMenu();
        player.subtitles?.renderAudioTrackMenu()
            .catch((/** @type {Error} */ e) => Logger.warn('[Tracks] Audio track menu:', e));
    };
    const stream = () => player.stream?.renderStreamUI();

    player.on('filterschange', filters);
    for (const event of ['loopmodechange', 'durationchange']) player.on(event, loop);
    player.on('trackschange', tracks);
    player.on('streamstatechange', stream);

    playButton(); progress(); volume(); speed(); loading(); filters(); loop();
}
