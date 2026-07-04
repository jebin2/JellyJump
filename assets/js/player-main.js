// Player page entry point
import './shared/utils/reload-on-stale-chunks.js';
import './pull-to-refresh.js';
import { DOMAIN } from './shared/config.js';
import { registerServiceWorkerWithCOI } from './shared/utils/coi.js';

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
    // Load templates first, then initialize player (v=2 forces refresh)
    const playlistResponse = await fetch('assets/templates/playlist-templates.html?v=2');
    const playlistHtml = await playlistResponse.text();

    // Load screenshot templates
    const screenshotResponse = await fetch('assets/templates/screenshot-templates.html?v=2');
    const screenshotHtml = await screenshotResponse.text();

    // Load player templates
    const playerResponse = await fetch('assets/templates/player-templates.html?v=2');
    const playerHtml = await playerResponse.text();

    const tempDiv = document.createElement('div');
    tempDiv.style.display = 'none'; // Hide template container
    tempDiv.innerHTML = playlistHtml + screenshotHtml + playerHtml;
    document.body.appendChild(tempDiv);

    // Now that templates are loaded, import and initialize
    const { CorePlayer } = await import('./core/Player.js');
    const { Playlist } = await import('./ui/player/Playlist.js');

    // Initialize Player (attach to window for cleanup on unload)
    const player = window.player = new CorePlayer('player-container', {
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
    if (!localStorage.getItem('JellyJumpDB-playlist') && (window.location.href.includes('//localhost:') || window.location.href.includes('//jebin2.github.io/JellyJump/') || window.location.href.includes('//www.voidall.com/JellyJump/') || window.location.href.includes(`//${DOMAIN}/`))) {
        playlist.addItems([
            {
                title: 'Sample Video',
                url: (window.location.href.includes('//localhost:') || window.location.href.includes(`//${DOMAIN}/`)) ? '/homepage.mp4' : '/JellyJump/homepage.mp4',
                isLocal: true
            }
        ], true); // true = autoplay on page load
    }
    // Hide loader only after app is fully initialized
    hideLoader();
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
    console.log('[Player] pagehide - destroying player and playlist');
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
