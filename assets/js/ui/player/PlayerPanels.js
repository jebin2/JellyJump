import { Logger } from '../../shared/utils/Logger.js';

export function handlePlayerDocumentClick(player, e) {
    if (player.ui.ccPanel && player.ui.ccBtn &&
        !player.ui.ccBtn.contains(e.target) && !player.ui.ccPanel.contains(e.target)) {
        player.ui.ccPanel.style.display = 'none';
    }
    if (player.ui.audioBtn && player.ui.audioMenu && !player.ui.audioBtn.contains(e.target) && !player.ui.audioMenu.contains(e.target)) {
        player.ui.audioMenu.classList.remove('visible');
    }
    if (player.ui.speedPanel && player.ui.speedBtn &&
        !player.ui.speedBtn.contains(e.target) && !player.ui.speedPanel.contains(e.target)) {
        player.ui.speedPanel.style.display = 'none';
    }
    if (player.ui.filterPanel && player.ui.filtersBtn &&
        !player.ui.filtersBtn.contains(e.target) && !player.ui.filterPanel.contains(e.target)) {
        player.ui.filterPanel.style.display = 'none';
    }
    if (player.ui.audioPanel && player.ui.audioSettingsBtn &&
        !player.ui.audioSettingsBtn.contains(e.target) && !player.ui.audioPanel.contains(e.target)) {
        player.ui.audioPanel.style.display = 'none';
    }
    if (player.ui.loopPanel && player.ui.loopBtn &&
        !player.ui.loopBtn.contains(e.target) && !player.ui.loopPanel.contains(e.target)) {
        player.ui.loopPanel.style.display = 'none';
    }
    if (player._wasMutedForAutoplay && player.gainNode && !player._isLoading) {
        Logger.log('[Autoplay] User interaction restoring audio...');
        player.config.muted = false;
        player.gainNode.gain.value = player.config.volume;
        player._wasMutedForAutoplay = false;
        player._updateVolumeUI();
    }
}

export function updatePlayerSpeedMenu(player) {
    if (!player.ui.speedBtn) return;

    player.ui.speedBtn.textContent = player.playbackRate === 1 ? '1x' : `${player.playbackRate}x`;
    if (player.playbackRate !== 1) {
        player.ui.speedBtn.style.color = 'var(--accent-primary)';
    } else {
        player.ui.speedBtn.style.color = '';
    }

    if (player.ui.speedSlider) {
        player.ui.speedSlider.value = player.playbackRate;
    }
    if (player.ui.speedValue) {
        player.ui.speedValue.textContent = `${player.playbackRate.toFixed(2)}x`;
    }
}

export function togglePlayerFilterPanel(player) {
    if (!player.ui.filterPanel) return;
    const isVisible = player.ui.filterPanel.style.display !== 'none';
    player.ui.filterPanel.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        syncPlayerFilterSliders(player);
    }
}

export function togglePlayerSpeedPanel(player) {
    if (!player.ui.speedPanel) return;
    const isVisible = player.ui.speedPanel.style.display !== 'none';
    player.ui.speedPanel.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        player.ui.speedSlider.value = player.playbackRate;
        player.ui.speedValue.textContent = `${player.playbackRate.toFixed(2)}x`;
    }
}

export function togglePlayerSubtitlePanel(player) {
    if (!player.ui.ccPanel) return;
    const isVisible = player.ui.ccPanel.style.display !== 'none';
    player.ui.ccPanel.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        player._updateSubtitleMenu();
    }
}

export function syncPlayerFilterSliders(player) {
    if (!player.videoFilters) return;
    const state = player.videoFilters.getState();

    if (player.ui.brightnessSlider) {
        player.ui.brightnessSlider.value = state.brightness;
        player.ui.brightnessValue.textContent = `${state.brightness}%`;
    }
    if (player.ui.contrastSlider) {
        player.ui.contrastSlider.value = state.contrast;
        player.ui.contrastValue.textContent = `${state.contrast}%`;
    }
    if (player.ui.saturationSlider) {
        player.ui.saturationSlider.value = state.saturation;
        player.ui.saturationValue.textContent = `${state.saturation}%`;
    }
}

export function updatePlayerFiltersButtonState(player) {
    if (!player.ui.filtersBtn || !player.videoFilters) return;

    if (player.videoFilters.isActive()) {
        player.ui.filtersBtn.style.color = 'var(--accent-primary)';
        player.ui.filtersBtn.setAttribute('aria-label', 'Video Filters (Active)');
    } else {
        player.ui.filtersBtn.style.color = '';
        player.ui.filtersBtn.setAttribute('aria-label', 'Video Filters');
    }
}

export function togglePlayerAudioPanel(player) {
    if (!player.ui.audioPanel) return;
    const isVisible = player.ui.audioPanel.style.display !== 'none';
    player.ui.audioPanel.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        syncPlayerEqSliders(player);
        player._updateVolumeUI();
    }
}

export function syncPlayerEqSliders(player) {
    if (!player.audioEqualizer) return;
    const state = player.audioEqualizer.getState();

    if (player.ui.eqBassSlider) {
        player.ui.eqBassSlider.value = state.bass;
        player.ui.eqBassValue.textContent = state.bass;
    }
    if (player.ui.eqMidSlider) {
        player.ui.eqMidSlider.value = state.mid;
        player.ui.eqMidValue.textContent = state.mid;
    }
    if (player.ui.eqTrebleSlider) {
        player.ui.eqTrebleSlider.value = state.treble;
        player.ui.eqTrebleValue.textContent = state.treble;
    }
}

export function updatePlayerAudioButtonState(player) {
    if (!player.ui.audioSettingsBtn) return;

    const iconUse = player.ui.audioSettingsBtn.querySelector('use');
    if (!iconUse) return;

    if (player.isMuted || player.volume === 0) {
        iconUse.setAttribute('href', 'assets/icons/sprite.svg#icon-volume-mute');
        player.ui.audioSettingsBtn.setAttribute('aria-label', 'Audio Settings (Muted)');
        player.ui.audioSettingsBtn.style.color = '';
    } else {
        iconUse.setAttribute('href', 'assets/icons/sprite.svg#icon-volume-high');
        player.ui.audioSettingsBtn.setAttribute('aria-label', 'Audio Settings');

        if (player.audioEqualizer && player.audioEqualizer.isActive()) {
            player.ui.audioSettingsBtn.style.color = 'var(--accent-primary)';
        } else {
            player.ui.audioSettingsBtn.style.color = '';
        }
    }
}
