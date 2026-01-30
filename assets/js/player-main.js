// Player page entry point
// Imports that were previously separate <script> tags
import './lib/gif.js';
import './pull-to-refresh.js';

// Load templates first, then initialize player
async function initializeApp() {
    // Load playlist templates
    const playlistResponse = await fetch('assets/templates/playlist-templates.html');
    const playlistHtml = await playlistResponse.text();

    // Load screenshot templates
    const screenshotResponse = await fetch('assets/templates/screenshot-templates.html');
    const screenshotHtml = await screenshotResponse.text();

    // Load player templates
    const playerResponse = await fetch('assets/templates/player-templates.html');
    const playerHtml = await playerResponse.text();

    const tempDiv = document.createElement('div');
    tempDiv.style.display = 'none'; // Hide template container
    tempDiv.innerHTML = playlistHtml + screenshotHtml + playerHtml;
    document.body.appendChild(tempDiv);

    // Now that templates are loaded, import and initialize
    const { CorePlayer } = await import('./core/Player.js');
    const { Playlist } = await import('./player/Playlist.js');

    // Initialize Player (attach to window for cleanup on unload)
    const player = window.player = new CorePlayer('player-container', {
        autoplay: false,
        muted: false,
        mode: 'player'
    });

    // Initialize Playlist (which will initialize SidebarToggle internally)
    const playlist = new Playlist(
        document.querySelector('.playlist-content'),
        player
    );

    // Demo Videos (optional)
    if (!localStorage.getItem('JellyJumpDB-playlist') && (window.location.href.includes('//localhost:') || window.location.href.includes('//jebin2.github.io/JellyJump/') || window.location.href.includes('//www.voidall.com/JellyJump/'))) {
        playlist.addItems([
            {
                title: 'ForBiggerBlazes',
                url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
                isLocal: false
            }, {
                url: "https://30a-tv.com/feeds/720p/63.m3u8",
                title: "30A Ridiculous IP TV",
                isStream: true
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
    console.log('[Player] pagehide - destroying player');
    // Destroy player if it exists (closes MediaBunny resources, audio context, etc.)
    if (window.player && typeof window.player.destroy === 'function') {
        window.player.destroy();
        window.player = null;
    }
});
