import { parseTime } from '../../shared/utils/mediaUtils.js';

export function attachPlayerBindings(player) {
    if (player.config.controls.playPause && player.ui.playBtn) {
        player.ui.playBtn.addEventListener('click', () => player.togglePlay());
    }
    player.canvas.addEventListener('click', () => {
        if (player.config.controls.playOverlay) player.togglePlay();
    });
    if (player.ui.playOverlay) {
        player.ui.playOverlay.addEventListener('click', () => player.togglePlay());
    }

    if (player.ui.prevBtn) {
        player.ui.prevBtn.addEventListener('click', () => {
            if (!player.ui.prevBtn.disabled && player.onPrevious) {
                player.onPrevious();
            }
        });
    }
    if (player.ui.nextBtn) {
        player.ui.nextBtn.addEventListener('click', () => {
            if (!player.ui.nextBtn.disabled && player.onNext) {
                player.onNext();
            }
        });
    }

    if (player.config.controls.progress && player.ui.progressContainer) {
        player.ui.progressContainer.addEventListener('mousedown', (e) => {
            player._onScrubStart(e);
        });

        if (player.config.controls.thumbnails) {
            // Pointer events instead of mouse events: on touch devices a tap
            // fires an emulated mousemove (showing the preview) but never a
            // mouseleave, so the popup used to stick on screen. Real mice
            // still get hover previews; touch never opens one, and any
            // lingering popup is closed when the finger lifts.
            player.ui.progressContainer.addEventListener('pointermove', (e) => {
                if (e.pointerType === 'mouse') player._handleThumbnailHover(e);
            });
            player.ui.progressContainer.addEventListener('pointerleave', () => player._handleThumbnailLeave());
            player.ui.progressContainer.addEventListener('pointerup', (e) => {
                if (e.pointerType !== 'mouse') player._handleThumbnailLeave();
            });
            player.ui.progressContainer.addEventListener('pointercancel', () => player._handleThumbnailLeave());
        }
    }

    if (player.config.controls.volume && player.ui.volumeSlider) {
        player.ui.volumeSlider.addEventListener('input', (e) => {
            player.config.volume = parseFloat(e.target.value);
            player.config.muted = false;

            player.stream.syncVolumeState();
            player._syncAudioGain();
            player._updateVolumeUI();
        });
    }

    if (player.config.controls.volume && player.ui.muteBtn) {
        player.ui.muteBtn.addEventListener('click', () => {
            player.config.muted = !player.config.muted;

            player.stream.syncVolumeState();
            player._syncAudioGain();
            player._updateVolumeUI();
        });
    }

    if (player.config.controls.fullscreen && player.ui.fullscreenBtn) {
        player.ui.fullscreenBtn.addEventListener('click', () => player.toggleFullscreen());
    }

    if (player.config.controls.fullscreen && player.ui.modeToggleBtn) {
        player.ui.modeToggleBtn.addEventListener('click', () => player.toggleControlBarMode());
    }

    if (player.config.controls.fullscreen) {
        player.container.addEventListener('mousemove', (e) => player._handleMouseMove(e));

        const toggleExpand = (add) => {
            const btn = document.querySelector('.sidebar-collapse-btn');
            if (btn) btn.classList.toggle('visible', add);
        };

        player.container.addEventListener('mouseenter', () => {
            if (player.controlBarMode === 'overlay') {
                player.ui.controls.classList.add('visible');
                toggleExpand(true);
                player._clearAutoHideTimer();
                if (player.isPlaying) player._startAutoHideTimer();
            }
        });

        player.container.addEventListener('mouseleave', () => {
            if (player.controlBarMode === 'overlay' && player.isPlaying) {
                player._clearAutoHideTimer();
                player.ui.controls.classList.remove('visible');
                toggleExpand(false);
                player.container.classList.add('hide-cursor');
            }
        });

        player.ui.controls.addEventListener('mouseenter', () => player._clearAutoHideTimer());
        player.ui.controls.addEventListener('mouseleave', () => {
            if (player.isPlaying && player.controlBarMode === 'overlay') {
                player._startAutoHideTimer();
            }
        });

        document.addEventListener('mouseover', (e) => {
            const btn = e.target.closest('.sidebar-collapse-btn');
            if (!btn || player.controlBarMode !== 'overlay') return;
            player.ui.controls.classList.add('visible');
            btn.classList.add('visible');
            player._clearAutoHideTimer();
        });

        document.addEventListener('mouseout', (e) => {
            const btn = e.target.closest('.sidebar-collapse-btn');
            if (!btn || player.controlBarMode !== 'overlay') return;
            if (player.isPlaying) player._startAutoHideTimer();
        });
    }

    if (player.config.controls.captions && player.ui.ccBtn && player.ui.ccPanel) {
        player.ui.ccBtn.addEventListener('click', () => player.toggleSubtitlePanel());
        player.ui.closeCcPanelBtn.addEventListener('click', () => player.toggleSubtitlePanel());

        player.ui.subtitleOptions.addEventListener('change', (e) => {
            if (e.target.type === 'radio') {
                const value = e.target.value;
                if (value === 'off') {
                    player.isSubtitlesEnabled = false;
                } else {
                    player._switchSubtitleTrack(value);
                }
                player._updateSubtitleMenu();
            }
        });

        player.ui.ccInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                player.loadSubtitle(url);
            }
        });

        if (player.ui.genSubtitleBtn) {
            player.ui.genSubtitleBtn.addEventListener('click', () => player.generateSubtitles());
        }

        player.ui.audioBtn.addEventListener('click', () => {
            player.ui.audioMenu.classList.toggle('visible');
            player.ui.audioBtn.setAttribute('aria-expanded', player.ui.audioMenu.classList.contains('visible'));
        });

        player.ui.audioMenu.addEventListener('click', (e) => {
            const item = e.target.closest('.jellyjump-menu-item');
            if (!item) return;

            const trackId = parseInt(item.dataset.value);
            player._switchAudioTrack(trackId);
            player.ui.audioMenu.classList.remove('visible');
        });
    }

    if (player.config.controls.speed && player.ui.speedBtn && player.ui.speedPanel) {
        player.ui.speedBtn.addEventListener('click', () => player.toggleSpeedPanel());
        player.ui.closeSpeedPanelBtn.addEventListener('click', () => player.toggleSpeedPanel());

        player.ui.speedSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            player.ui.speedValue.textContent = `${value.toFixed(2)}x`;
        });

        player.ui.speedSlider.addEventListener('change', (e) => {
            const value = parseFloat(e.target.value);
            player.setPlaybackRate(value);
        });

        player.ui.resetSpeedBtn.addEventListener('click', () => {
            player.setPlaybackRate(1);
            player.ui.speedSlider.value = 1;
            player.ui.speedValue.textContent = '1.00x';
        });

        player.ui.speedSlider.value = player.playbackRate;
        player.ui.speedValue.textContent = `${player.playbackRate.toFixed(2)}x`;
    }

    if (player.config.controls.fullscreen) {
        document.addEventListener('fullscreenchange', player._handlers.fullscreen);
        document.addEventListener('webkitfullscreenchange', player._handlers.fullscreen);
        document.addEventListener('mozfullscreenchange', player._handlers.fullscreen);
        document.addEventListener('MSFullscreenChange', player._handlers.fullscreen);
    }

    document.addEventListener('visibilitychange', player._handlers.visibilitychange);

    if (player.config.controls.loop) {
        player._updateLoopUI();

        player.ui.loopBtn.addEventListener('click', () => player.toggleLoopPanel());
        player.ui.closeLoopPanelBtn.addEventListener('click', () => player.toggleLoopPanel());

        player.ui.loopModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                player.loopMode = e.target.value;
                if (player.ui.loopAbSection) {
                    player.ui.loopAbSection.style.display = player.loopMode === 'one' ? 'block' : 'none';
                }
                player._updateLoopUI();
            });
        });

        player.ui.setABtn.addEventListener('click', () => player.setLoopStart());
        player.ui.setBBtn.addEventListener('click', () => player.setLoopEnd());
        player.ui.clearLoopBtn.addEventListener('click', () => player.clearLoopMarkers());

        player.ui.loopStartInput.addEventListener('change', (e) => {
            const time = parseTime(e.target.value);
            if (time !== null && player.loopMode === 'one') {
                player.loopStart = time;
                player._updateLoopUI();
            }
        });

        player.ui.loopEndInput.addEventListener('change', (e) => {
            const time = parseTime(e.target.value);
            if (time !== null && player.loopMode === 'one') {
                player.loopEnd = time;
                player._updateLoopUI();
            }
        });
    }

    if (player.config.controls.filters && player.ui.filtersBtn) {
        player.ui.filtersBtn.addEventListener('click', () => player.toggleFilterPanel());

        if (player.ui.closeFilterPanelBtn) {
            player.ui.closeFilterPanelBtn.addEventListener('click', () => player.toggleFilterPanel());
        }

        if (player.ui.brightnessSlider) {
            player.ui.brightnessSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                player.videoFilters.setBrightness(value);
                player.ui.brightnessValue.textContent = `${value}%`;
                player._updateFiltersButtonState();
            });
        }

        if (player.ui.contrastSlider) {
            player.ui.contrastSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                player.videoFilters.setContrast(value);
                player.ui.contrastValue.textContent = `${value}%`;
                player._updateFiltersButtonState();
            });
        }

        if (player.ui.saturationSlider) {
            player.ui.saturationSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                player.videoFilters.setSaturation(value);
                player.ui.saturationValue.textContent = `${value}%`;
                player._updateFiltersButtonState();
            });
        }

        if (player.ui.blurSlider) {
            player.ui.blurSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                player.videoFilters.setBlur(value);
                player.ui.blurValue.textContent = `${value}px`;
                player._updateFiltersButtonState();
            });
        }

        if (player.ui.invertSlider) {
            player.ui.invertSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                player.videoFilters.setInvert(value);
                player.ui.invertValue.textContent = `${value}%`;
                player._updateFiltersButtonState();
            });
        }

        // After a mouse drag/click, drop focus so global keyboard shortcuts
        // (space, arrows) keep working — the keydown handler bails on a focused
        // INPUT. Keyboard-only users who Tab in aren't affected (no pointerup).
        player.container.querySelectorAll('.jellyjump-filter-panel input[type="range"]').forEach(slider => {
            slider.addEventListener('pointerup', () => slider.blur());
        });

        // Colour presets (adjust the sliders)
        player.container.querySelectorAll('.filter-preset-btn[data-preset]').forEach(btn => {
            btn.addEventListener('click', () => {
                player.videoFilters.applyPreset(btn.dataset.preset);
                player._syncFilterSliders();
                player._updateFiltersButtonState();
                btn.blur();
            });
        });

        // Fun FX (toggle on/off, highlight the active one)
        const fxButtons = player.container.querySelectorAll('.filter-fx-btn');
        fxButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                player.videoFilters.applyEffect(btn.dataset.effect);
                const active = player.videoFilters.effect;
                fxButtons.forEach(b => b.classList.toggle('active', b.dataset.effect === active));
                player._updateFiltersButtonState();
                btn.blur();
            });
        });

        if (player.ui.resetFiltersBtn) {
            player.ui.resetFiltersBtn.addEventListener('click', () => {
                player.videoFilters.reset();
                player._syncFilterSliders();
                fxButtons.forEach(b => b.classList.remove('active'));
                player._updateFiltersButtonState();
            });
        }
    }

    if (player.config.controls.equalizer && player.ui.audioSettingsBtn) {
        player.ui.audioSettingsBtn.addEventListener('click', () => player.toggleAudioPanel());

        if (player.ui.closeAudioPanelBtn) {
            player.ui.closeAudioPanelBtn.addEventListener('click', () => player.toggleAudioPanel());
        }

        if (player.ui.panelMuteBtn) {
            player.ui.panelMuteBtn.addEventListener('click', () => player.toggleMute());
        }

        if (player.ui.panelVolumeSlider) {
            player.ui.panelVolumeSlider.addEventListener('input', (e) => {
                const volume = parseFloat(e.target.value);
                player.setVolume(volume);
            });
        }

        if (player.ui.eqBassSlider) {
            player.ui.eqBassSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (player.audioEqualizer) {
                    player.audioEqualizer.setBass(value);
                }
                player.ui.eqBassValue.textContent = value;
            });
        }

        if (player.ui.eqMidSlider) {
            player.ui.eqMidSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (player.audioEqualizer) {
                    player.audioEqualizer.setMid(value);
                }
                player.ui.eqMidValue.textContent = value;
            });
        }

        if (player.ui.eqTrebleSlider) {
            player.ui.eqTrebleSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (player.audioEqualizer) {
                    player.audioEqualizer.setTreble(value);
                }
                player.ui.eqTrebleValue.textContent = value;
            });
        }

        player.container.querySelectorAll('.eq-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!player.audioEqualizer) return;
                const preset = btn.dataset.preset;
                player.audioEqualizer.applyPreset(preset);
                player._syncEqSliders();
            });
        });

        if (player.ui.resetEqBtn) {
            player.ui.resetEqBtn.addEventListener('click', () => {
                if (!player.audioEqualizer) return;
                player.audioEqualizer.reset();
                player._syncEqSliders();
            });
        }
    }

    document.addEventListener('click', player._handlers.click);

    if (player.config.controls.keyboard) {
        document.addEventListener('keydown', player._handlers.keydown);
    }

    player._events = {};
}
