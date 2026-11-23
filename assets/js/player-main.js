// Player page entry point
import './shared/utils/reload-on-stale-chunks.js';
import './pull-to-refresh.js';
import { config, isEnabled } from './shared/config/index.js';
import { ElectronHelper } from './shared/platform/ElectronHelper.js';
import { registerServiceWorkerWithCOI } from './shared/utils/coi.js';
import { Logger } from './shared/utils/Logger.js';
import { installErrorReporter } from './shared/errors/ErrorReporter.js';
import { hasSavedPlaylist } from './shared/services/IndexedDBService.js';
import { startUpdateCheck } from './shared/utils/UpdateCheck.js';
import { Toast } from './shared/utils/Toast.js';

// Errors nothing else caught are recorded and shown once (shared/errors).
installErrorReporter();

// Moved out of an inline <script> in player.html so a strict CSP can apply.
function hideLoader() {
    const loader = document.getElementById('page-loader');
    if (loader) {
        loader.classList.add('hidden');
    }
}

// Register Service Worker for PWA + cross-origin isolation (multi-threaded WASM)
window.addEventListener('load', registerServiceWorkerWithCOI);

// Load templates first, then initialize player
async function initializeApp() {
    // Load templates first, then initialize player. The build id in the URL
    // makes a new build fetch them fresh rather than from the cache.
    const playlistResponse = await fetch(`assets/templates/playlist-templates.html?v=${config.buildId}`);
    const playlistHtml = await playlistResponse.text();

    // Load screenshot templates
    const screenshotResponse = await fetch(`assets/templates/screenshot-templates.html?v=${config.buildId}`);
    const screenshotHtml = await screenshotResponse.text();

    // Load player templates
    const playerResponse = await fetch(`assets/templates/player-templates.html?v=${config.buildId}`);
    const playerHtml = await playerResponse.text();

    const tempDiv = document.createElement('div');
    tempDiv.style.display = 'none'; // Hide template container
    tempDiv.innerHTML = playlistHtml + screenshotHtml + playerHtml;
    document.body.appendChild(tempDiv);

    // Now that templates are loaded, import and initialize
    const { createPlayer } = await import('./ui/player/createPlayer.js');
    const { Playlist } = await import('./ui/player/Playlist.js');

    // Initialize Player (attach to window for cleanup on unload)
    const player = window.player = createPlayer('player-container', {
        autoplay: false,
        muted: false,
        mode: 'player'
    });

    // Initialize Playlist (which will initialize SidebarToggle internally)
    const playlist = window.playlist = new Playlist(
        document.querySelector('.playlist-content'),
        player
    );

    // Demo Videos (optional)
    // A first visit gets a sample video, on the hosts that carry it (config).
    // Not in the desktop app, and not when a build turns it off.
    const isFirstVisit = !hasSavedPlaylist();
    const hostHasSample = config.sampleVideoHosts.includes(window.location.hostname);
    if (isFirstVisit && hostHasSample && isEnabled('sampleVideo') && config.sampleVideoPath && !ElectronHelper.isElectron()) {
        playlist.addItems([
            {
                title: 'Sample Video',
                url: new URL(config.sampleVideoPath, window.location.href).href,
                isLocal: true
            }
        ], true); // true = autoplay on page load
    }
    hideLoader();
    // The metrics module comes with the player's code anyway; not loaded
    // before first paint for this one number.
    const readyAt = performance.now();
    import('./shared/diagnostics/Metrics.js').then(({ Metrics }) => Metrics.record('pageReady', readyAt));
    // Diagnostics without a playlist item to open Info on (tests, a console).
    window.jellyjump = {
        openDiagnostics: async () => (await import('./ui/menus/features/DiagnosticsView.js')).DiagnosticsView.open(),
    };

    // A newer build went live while this tab was open: offer, never force.
    startUpdateCheck({
        onNewBuild: (info) => {
            Toast.show(`JellyJump ${info.version} is available`, 30000, false, {
                action: { label: 'Reload', onClick: () => window.location.reload() },
            });
        },
    });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Handle browser back/forward cache (bfcache)
window.addEventListener('pageshow', function (event) {
    // If page is loaded from cache, hide the loader
    if (event.persisted) {
        hideLoader();
    }
});

// CRITICAL: Cleanup on page hide to prevent memory accumulation
// pagehide replaces the deprecated unload event
window.addEventListener('pagehide', function () {
    Logger.log('[Player] pagehide - destroying player and playlist');
    // Destroy playlist first (clears intervals, event listeners, blob URLs)
    if (window.playlist && typeof window.playlist.destroy === 'function') {
        window.playlist.destroy();
        window.playlist = null;
    }
    // Destroy player (closes MediaBunny resources, audio context, etc.)
    if (window.player && typeof window.player.destroy === 'function') {
        window.player.destroy();
        window.player = null;
    }
});
