import { Logger } from '../../shared/utils/Logger.js';

export function mountPlayerShell(player) {
    player.container.classList.add('jellyjump-container');

    const canvasTemplate = document.getElementById('player-canvas-template');
    const canvasClone = canvasTemplate.content.cloneNode(true);
    player.canvas = canvasClone.querySelector('canvas');
    player.ctx = player.canvas.getContext('2d', { willReadFrequently: true });
    player.container.appendChild(canvasClone);
}

export function initPlayerResizeObserver(player) {
    if (!player.ui.controls) return;

    player.resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
            handlePlayerResize(player, entry);
        }
    });

    player.resizeObserver.observe(player.ui.controls);
}

export function handlePlayerResize(player, entry) {
    const width = entry.contentRect.width;
    const COMPACT_WIDTH = 600;
    const MINIMAL_WIDTH = 400;

    player.ui.controls.classList.remove('size-compact', 'size-minimal');

    if (width < MINIMAL_WIDTH) {
        player.ui.controls.classList.add('size-minimal');
    } else if (width < COMPACT_WIDTH) {
        player.ui.controls.classList.add('size-compact');
    }
}

export function togglePlayerFullscreen(player) {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIOS && player.isStreamMode && player.streamVideo && player.streamVideo.webkitEnterFullscreen) {
        player.streamVideo.webkitEnterFullscreen();
        return;
    }

    // CSS-fallback fullscreen active? This toggle is an exit request.
    if (player.container.classList.contains('fullscreen-fallback')) {
        exitFallbackFullscreen(player);
        player._updateFullscreenUI();
        return;
    }

    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
        if (player.container.requestFullscreen) {
            // iPhone Safari/standalone PWAs expose requestFullscreen but can
            // reject it - fall back to CSS fullscreen instead of giving up.
            player.container.requestFullscreen().catch(err => {
                Logger.warn(`Native fullscreen rejected (${err.message}), using CSS fallback`);
                enterFallbackFullscreen(player);
                player._updateFullscreenUI();
            });
        } else if (player.container.webkitRequestFullscreen) {
            try {
                player.container.webkitRequestFullscreen();
            } catch (err) {
                Logger.warn(`webkit fullscreen failed (${err.message}), using CSS fallback`);
                enterFallbackFullscreen(player);
            }
        } else if (player.container.mozRequestFullScreen) {
            player.container.mozRequestFullScreen();
        } else if (player.container.msRequestFullscreen) {
            player.container.msRequestFullscreen();
        } else {
            enterFallbackFullscreen(player);
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
        exitFallbackFullscreen(player);
    }

    player._updateFullscreenUI();
}

function enterFallbackFullscreen(player) {
    player.container.classList.add('fullscreen-fallback');
    document.body.classList.add('fullscreen-active');
}

function exitFallbackFullscreen(player) {
    player.container.classList.remove('fullscreen-fallback');
    document.body.classList.remove('fullscreen-active');
}
