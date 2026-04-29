import { formatTime } from '../../../shared/utils/mediaUtils.js';
import { Logger } from '../../../shared/utils/Logger.js';

export function updatePlayerPlayPauseUI(player) {
    if (!player.ui.playBtn) return;

    const use = player.ui.playBtn.querySelector('use');
    if (player.isPlaying) {
        player.ui.playBtn.setAttribute('aria-label', 'Pause');
        player.ui.playBtn.setAttribute('aria-pressed', 'true');
        if (use) use.setAttribute('href', 'assets/icons/sprite.svg#icon-pause');
        if (player.ui.playOverlay) player.ui.playOverlay.style.display = 'none';
    } else {
        player.ui.playBtn.setAttribute('aria-label', 'Play');
        player.ui.playBtn.setAttribute('aria-pressed', 'false');
        if (use) use.setAttribute('href', 'assets/icons/sprite.svg#icon-play');
        if (player.ui.playOverlay) {
            const isVisible = !player.isLoading && player.config.controls.playOverlay;
            player.ui.playOverlay.style.display = isVisible ? 'flex' : 'none';
        }
    }
}

export function updatePlayerProgress(player) {
    if (!player.ui.progressBar || !player.ui.progressContainer) return;

    let percent = (player.currentTime / player.duration) * 100;
    if (!isFinite(percent)) percent = 0;

    player.ui.progressBar.style.width = `${percent}%`;
    player.ui.progressContainer.setAttribute('aria-valuenow', Math.round(percent));
    updatePlayerTimeDisplay(player);
}

export function updatePlayerTimeDisplay(player) {
    if (!player.ui.timeDisplay) return;
    const current = formatTime(player.currentTime);
    const duration = formatTime(player.duration);
    player.ui.timeDisplay.textContent = `${current} / ${duration}`;
}

export function updatePlayerFullscreenUI(player) {
    if (!player.ui.fullscreenBtn) return;

    const use = player.ui.fullscreenBtn.querySelector('use');
    const isFullscreen = document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement ||
        player.container.classList.contains('fullscreen-fallback');

    if (isFullscreen) {
        player.ui.fullscreenBtn.setAttribute('aria-label', 'Exit Fullscreen');
        if (use) use.setAttribute('href', 'assets/icons/sprite.svg#icon-fullscreen-exit');
    } else {
        player.ui.fullscreenBtn.setAttribute('aria-label', 'Fullscreen');
        if (use) use.setAttribute('href', 'assets/icons/sprite.svg#icon-fullscreen');
    }
}

export function setPlayerLoading(player, isLoading) {
    player.isLoading = isLoading;
    if (!player.ui.loader) return;

    if (isLoading) {
        player.ui.loader.style.display = 'block';
        player.ui.loader.classList.add('visible');
        if (player.ui.playOverlay) player.ui.playOverlay.style.display = 'none';
    } else {
        player.ui.loader.style.display = 'none';
        player.ui.loader.classList.remove('visible');
    }
}

export function showPlayerBezel(player, icon, text) {
    if (!player.ui.bezelOverlay) return;

    const iconContainer = player.ui.bezelOverlay.querySelector('.bezel-icon');
    const textContainer = player.ui.bezelOverlay.querySelector('.bezel-text');

    if (iconContainer) {
        iconContainer.innerHTML = `<svg width="100%" height="100%" fill="currentColor"><use href="assets/icons/sprite.svg#${icon}"></use></svg>`;
    }
    if (textContainer) {
        textContainer.textContent = text;
    }

    player.ui.bezelOverlay.style.display = 'flex';
    player.ui.bezelOverlay.style.opacity = '1';

    if (player.bezelTimer) clearTimeout(player.bezelTimer);

    player.bezelTimer = setTimeout(() => {
        player.ui.bezelOverlay.style.opacity = '0';
        setTimeout(() => {
            if (player.ui.bezelOverlay.style.opacity === '0') {
                player.ui.bezelOverlay.style.display = 'none';
            }
        }, 200);
        player.bezelTimer = null;
    }, 800);
}

export function updatePlayerVolumeUI(player) {
    if (player.ui.panelVolumeSlider) {
        player.ui.panelVolumeSlider.value = player.volume;
    }
    if (player.ui.panelVolumeValue) {
        player.ui.panelVolumeValue.textContent = `${Math.round(player.volume * 100)}%`;
    }

    if (player.ui.panelMuteBtn) {
        const use = player.ui.panelMuteBtn.querySelector('use');
        if (use) {
            if (player.isMuted || player.volume === 0) {
                use.setAttribute('href', 'assets/icons/sprite.svg#icon-volume-mute');
                player.ui.panelMuteBtn.setAttribute('aria-label', 'Unmute');
            } else {
                use.setAttribute('href', 'assets/icons/sprite.svg#icon-volume-high');
                player.ui.panelMuteBtn.setAttribute('aria-label', 'Mute');
            }
        }
    }

    Logger.log(`[VolumeUI] isMuted=${player.isMuted}, volume=${player.volume}, config.muted=${player.config.muted}, gainValue=${player.gainNode?.gain?.value}, audioSettingsBtn=${!!player.ui.audioSettingsBtn}, muteBtn=${!!player.ui.muteBtn}`);
    player._updateAudioButtonState();
}
