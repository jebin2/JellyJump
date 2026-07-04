import { VideoFilters } from './VideoFilters.js';

export function createPlayerControls(player) {
    const mount = (id) => {
        const template = document.getElementById(id);
        if (template) player.container.appendChild(template.content.cloneNode(true));
    };
    const q = (sel) => player.container.querySelector(sel);

    mount('player-loader-template');
    player.ui.loader = q('.jellyjump-loader');

    mount('player-controls-template');
    if (player.config.controls.loop) mount('player-loop-panel-template');

    if (player.screenshotManager) player.screenshotManager.init();

    player.ui.controls = q('.jellyjump-controls');
    player.ui.playOverlay = q('.jellyjump-play-overlay');
    player.ui.bezelOverlay = q('.jellyjump-bezel-overlay');

    if (!player.config.controls.playOverlay && player.ui.playOverlay) {
        player.ui.playOverlay.style.display = 'none';
    }

    if (player.config.controls.playPause) player.ui.playBtn = q('#mb-play-btn');
    if (player.config.controls.navigation) {
        player.ui.prevBtn = q('#mb-prev-btn');
        player.ui.nextBtn = q('#mb-next-btn');
    }
    if (player.config.controls.progress) {
        player.ui.progressContainer = q('.jellyjump-progress-container');
        player.ui.progressBar = q('.jellyjump-progress-bar');
    }
    if (player.config.controls.time) player.ui.timeDisplay = q('#mb-time-display');
    if (player.config.controls.fullscreen) player.ui.fullscreenBtn = q('#mb-fullscreen-btn');
    if (player.config.controls.modeToggle) player.ui.modeToggleBtn = q('#mb-mode-toggle-btn');

    if (player.config.controls.captions) initCaptionsPanel(player);
    if (player.config.controls.speed) initSpeedPanel(player);
    if (player.config.controls.loop) initLoopPanel(player);
    if (player.config.controls.filters) initFiltersPanel(player);
    if (player.config.controls.equalizer) initEqualizerPanel(player);

    player._createErrorOverlay();
    player._createThumbnailOverlay();
    player._applyControlVisibility();
    if (player.config.controls.speed) player._updateSpeedMenu();
}

function initCaptionsPanel(player) {
    const template = document.getElementById('player-subtitle-panel-template');
    if (template) player.container.appendChild(template.content.cloneNode(true));
    const q = (sel) => player.container.querySelector(sel);
    player.ui.ccBtn = q('#mb-cc-btn');
    player.ui.ccPanel = q('.jellyjump-subtitle-panel');
    player.ui.ccInput = q('#mb-cc-input');
    player.ui.closeCcPanelBtn = q('.jellyjump-subtitle-panel .jellyjump-close-btn');
    player.ui.subtitleOptions = q('.subtitle-options');
    player.ui.audioContainer = q('#mb-audio-container');
    player.ui.audioBtn = q('#mb-audio-btn');
    player.ui.audioMenu = q('#mb-audio-menu');
    player.ui.genSubtitleBtn = q('#mb-cc-generate-btn');
    player.ui.genSubtitleProgress = q('#mb-cc-generate-progress');
    player.ui.genSubtitleBar = q('#mb-cc-generate-bar');
    player.ui.genSubtitleLabel = q('#mb-cc-generate-label');
}

function initSpeedPanel(player) {
    const template = document.getElementById('player-speed-panel-template');
    if (template) player.container.appendChild(template.content.cloneNode(true));
    const q = (sel) => player.container.querySelector(sel);
    player.ui.speedBtn = q('#mb-speed-btn');
    player.ui.speedPanel = q('.jellyjump-speed-panel');
    player.ui.speedSlider = q('#mb-speed-slider');
    player.ui.speedValue = q('#mb-speed-value');
    player.ui.resetSpeedBtn = q('#mb-reset-speed-btn');
    player.ui.closeSpeedPanelBtn = q('.jellyjump-speed-panel .jellyjump-close-btn');
}

function initLoopPanel(player) {
    const q = (sel) => player.container.querySelector(sel);
    player.ui.loopBtn = q('#mb-loop-btn');
    player.ui.loopMarkerA = q('.jellyjump-marker.marker-a');
    player.ui.loopMarkerB = q('.jellyjump-marker.marker-b');
    player.ui.loopRegion = q('.jellyjump-loop-region');
    player.ui.loopPanel = q('.jellyjump-loop-panel');
    player.ui.loopStartInput = q('#mb-loop-start');
    player.ui.loopEndInput = q('#mb-loop-end');
    player.ui.loopModeRadios = player.container.querySelectorAll('input[name="loop-mode"]');
    player.ui.loopAbSection = q('.loop-ab-section');
    player.ui.setABtn = q('#mb-set-a-btn');
    player.ui.setBBtn = q('#mb-set-b-btn');
    player.ui.clearLoopBtn = q('#mb-clear-loop-btn');
    player.ui.closeLoopPanelBtn = q('.jellyjump-loop-panel .jellyjump-close-btn');
}

function initFiltersPanel(player) {
    const template = document.getElementById('player-filter-panel-template');
    if (template) player.container.appendChild(template.content.cloneNode(true));
    const q = (sel) => player.container.querySelector(sel);
    player.ui.filtersBtn = q('#mb-filters-btn');
    player.ui.filterPanel = q('.jellyjump-filter-panel');
    player.ui.brightnessSlider = q('#mb-filter-brightness');
    player.ui.contrastSlider = q('#mb-filter-contrast');
    player.ui.saturationSlider = q('#mb-filter-saturation');
    player.ui.brightnessValue = q('#mb-brightness-value');
    player.ui.contrastValue = q('#mb-contrast-value');
    player.ui.saturationValue = q('#mb-saturation-value');
    player.ui.resetFiltersBtn = q('#mb-reset-filters-btn');
    player.ui.closeFilterPanelBtn = q('.jellyjump-filter-panel .jellyjump-close-btn');
    player.videoFilters = new VideoFilters(player.canvas);
}

function initEqualizerPanel(player) {
    const template = document.getElementById('player-audio-panel-template');
    if (template) player.container.appendChild(template.content.cloneNode(true));
    const q = (sel) => player.container.querySelector(sel);
    player.ui.audioSettingsBtn = q('#mb-audio-settings-btn');
    player.ui.audioPanel = q('.jellyjump-eq-panel');
    player.ui.panelMuteBtn = q('#mb-panel-mute-btn');
    player.ui.panelVolumeSlider = q('#mb-panel-volume-slider');
    player.ui.panelVolumeValue = q('#mb-panel-volume-value');
    player.ui.eqBassSlider = q('#mb-eq-bass');
    player.ui.eqMidSlider = q('#mb-eq-mid');
    player.ui.eqTrebleSlider = q('#mb-eq-treble');
    player.ui.eqBassValue = q('#mb-bass-value');
    player.ui.eqMidValue = q('#mb-mid-value');
    player.ui.eqTrebleValue = q('#mb-treble-value');
    player.ui.resetEqBtn = q('#mb-reset-eq-btn');
    player.ui.closeAudioPanelBtn = q('.jellyjump-eq-panel .jellyjump-close-btn');

    if (player.config.controls.volumeOnly) {
        ['.eq-section-divider', '.eq-sliders', '.eq-presets', '.eq-actions'].forEach(sel => {
            const el = player.ui.audioPanel.querySelector(sel);
            if (el) el.style.display = 'none';
        });
    }
}
