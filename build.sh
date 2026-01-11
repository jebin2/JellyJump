#!/bin/bash

# JellyJump Build Script with esbuild Bundling
# Usage: npm run build
# Creates optimized production build with bundled assets

set -e  # Exit immediately on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

START_TIME=$(date +%s)

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    log_info "Installing dependencies..."
    npm install
fi

# Clean and create build directory
log_info "Cleaning old build..."
rm -rf build
mkdir -p build/assets/js/bundles
mkdir -p build/assets/css
mkdir -p build/assets/js/lib

# ============================================
# 1. BUNDLE JAVASCRIPT WITH ESBUILD
# ============================================
log_info "Bundling JavaScript with esbuild..."

# Player bundle (combines Player.js + Playlist.js + dependencies)
npx esbuild assets/js/player-entry.js \
    --bundle \
    --minify \
    --format=esm \
    --target=es2020 \
    --outfile=build/assets/js/bundles/player.bundle.js \
    --external:./assets/js/lib/* \
    --external:/npm/* \
    2>/dev/null || {
        log_error "Failed to bundle player.bundle.js"
        exit 1
    }
log_success "Created player.bundle.js"

# ============================================
# 2. COPY EXTERNAL LIBRARIES
# ============================================
log_info "Copying external libraries..."
mkdir -p build/assets/js/lib
cp assets/js/lib/*.js build/assets/js/lib/ 2>/dev/null || true
log_success "Copied library files"

# ============================================
# 3. BUNDLE CSS
# ============================================
log_info "Bundling CSS..."
npx cleancss -o build/assets/css/player.bundle.css \
    assets/css/theme.css \
    assets/css/common.css \
    assets/css/player.css \
    assets/css/screenshot.css \
    assets/css/modal.css \
    assets/css/player_page.css \
    2>/dev/null || {
        log_error "CSS bundle failed"
        exit 1
    }
log_success "Created player.bundle.css"

# Landing page bundle
npx cleancss -o build/assets/css/landing.bundle.css \
    assets/css/theme.css \
    assets/css/common.css \
    assets/css/landing.css \
    2>/dev/null || {
        log_error "Landing CSS bundle failed"
        exit 1
    }
log_success "Created landing.bundle.css"

# ============================================
# 4. COPY & MINIFY HTML FILES
# ============================================
log_info "Processing HTML files..."
find . -name "*.html" \
    -not -path "./node_modules/*" \
    -not -path "./build/*" \
    -not -path "./desktop/*" \
    -not -path "./.git/*" | while read file; do
    output_file="build/${file#./}"
    mkdir -p "$(dirname "$output_file")"
    npx html-minifier-terser \
        --collapse-whitespace \
        --remove-comments \
        --minify-css true \
        --minify-js true \
        --output "$output_file" \
        "$file" 2>/dev/null || cp "$file" "$output_file"
done
HTML_COUNT=$(find ./build -name "*.html" 2>/dev/null | wc -l)
log_success "Processed ${HTML_COUNT} HTML files"

# ============================================
# 5. MODIFY player.html TO USE BUNDLES
# ============================================
log_info "Optimizing player.html for production..."

# Create optimized player.html that uses bundles
cat > build/player.html << 'PLAYER_HTML'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JellyJump - Player</title>
    <script>
        // Set base URL for subdirectory deployments (e.g., /JellyJump/)
        (function() {
            var path = window.location.pathname;
            var base = path.substring(0, path.lastIndexOf('/') + 1);
            var tag = document.createElement('base');
            tag.href = base;
            document.head.appendChild(tag);
        })();
    </script>
    <link rel="icon" href="assets/icons/jelly_jump_logo.png">
    <meta name="description" content="JellyJump - A modern, feature-rich video player and editor. Play local files, stream HLS, trim, convert, and create GIFs - all in your browser with complete privacy.">
    <link rel="preload" href="assets/icons/jelly_jump_logo.gif" as="image">
    <link rel="preload" href="assets/icons/jelly_play.webp" as="image">
    <meta name="theme-color" content="#00d9a5">
    <link rel="manifest" href="./manifest.json">
    <link rel="apple-touch-icon" href="assets/icons/jelly_jump_logo.png">
    <meta name="mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="JellyJump">
    <script>
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js')
                    .then(reg => console.log('[PWA] Service Worker registered'))
                    .catch(err => console.log('[PWA] Service Worker failed', err));
            });
        }
    </script>
    <!-- BUNDLED CSS - Single file instead of 6 -->
    <link rel="stylesheet" href="assets/css/player.bundle.css">
</head>
<body>
    <div class="page-loader" id="page-loader">
        <div class="page-loader-logo"></div>
    </div>
    <div style="display: none;">
        <svg xmlns="http://www.w3.org/2000/svg"><defs></defs></svg>
    </div>
    <div class="player-layout">
        <main class="video-section" id="player-container"></main>
        <aside class="playlist-section hidden">
            <header class="playlist-header" style="display: none;"></header>
            <div class="playlist-content">
                <div class="playlist-placeholder"></div>
            </div>
        </aside>
        <button id="mobile-expand-btn" class="mobile-expand-button" aria-label="Expand playlist" title="Expand playlist" style="display: none;">▲</button>
    </div>
    <input type="file" id="mb-file-input" multiple accept="video/*,audio/*" style="display: none;">
    <input type="file" id="mb-folder-input" webkitdirectory directory style="display: none;">
    <a id="mb-download-link" style="display: none;"></a>

    <!-- Import Map for external libraries (bundle uses relative paths) -->
    <script type="importmap">
    {
        "imports": {
            "/npm/mediabunny@1.27.4/+esm": "./assets/js/lib/mediabunny.js",
            "../../../../assets/js/lib/mediabunny.js": "./assets/js/lib/mediabunny.js",
            "../../../../assets/js/lib/mediabunny-mp3-encoder.js": "./assets/js/lib/mediabunny-mp3-encoder.js",
            "../../../../assets/js/lib/hls.js": "./assets/js/lib/hls.js",
            "../../../../assets/js/lib/gif.js": "./assets/js/lib/gif.js"
        }
    }
    </script>

    <!-- GIF Library -->
    <script type="module" src="assets/js/lib/gif.js"></script>

    <!-- BUNDLED JS - Single import instead of many -->
    <script type="module">
        async function initializeApp() {
            // Load templates
            const [playlistHtml, screenshotHtml, playerHtml] = await Promise.all([
                fetch('assets/templates/playlist-templates.html').then(r => r.text()),
                fetch('assets/templates/screenshot-templates.html').then(r => r.text()),
                fetch('assets/templates/player-templates.html').then(r => r.text())
            ]);
            
            const tempDiv = document.createElement('div');
            tempDiv.style.display = 'none';
            tempDiv.innerHTML = playlistHtml + screenshotHtml + playerHtml;
            document.body.appendChild(tempDiv);

            // Import from bundle
            const { CorePlayer, Playlist } = await import('./assets/js/bundles/player.bundle.js');

            const player = window.player = new CorePlayer('player-container', {
                autoplay: false,
                muted: false,
                mode: 'player'
            });

            const playlist = new Playlist(
                document.querySelector('.playlist-content'),
                player
            );

            if (!localStorage.getItem('JellyJumpDB-playlist') && 
                (window.location.href.includes('//localhost:') || 
                 window.location.href.includes('//jebin2.github.io/JellyJump/') || 
                 window.location.href.includes('//www.voidall.com/JellyJump/'))) {
                playlist.addItems([
                    { title: 'Big Buck Bunny', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', isLocal: false },
                    { title: 'Big Buck Bunny Audio', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/CastVideos/dash/BigBuckBunnyAudio.mp4', isLocal: false, isAudio: true },
                    { url: "https://30a-tv.com/feeds/720p/63.m3u8", title: "30A Ridiculous TV", isStream: true }
                ], false);
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeApp);
        } else {
            initializeApp();
        }

        window.addEventListener('load', () => {
            const loader = document.getElementById('page-loader');
            if (loader) loader.classList.add('hidden');
        });

        window.addEventListener('beforeunload', () => {
            if (window.player && typeof window.player.destroy === 'function') {
                window.player.destroy();
                window.player = null;
            }
        });
    </script>
</body>
</html>
PLAYER_HTML

log_success "Created optimized player.html with bundles"

# ============================================
# 6. OPTIMIZE index.html TO USE LANDING BUNDLE
# ============================================
log_info "Optimizing index.html for production..."

# Replace the 3 CSS links with single bundle in index.html
# Using a simple approach: sed replacement
sed -i 's|<link rel="stylesheet" href="assets/css/theme.css">.*<link rel="stylesheet" href="assets/css/common.css">.*<link rel="stylesheet" href="assets/css/landing.css">|<link rel="stylesheet" href="assets/css/landing.bundle.css">|g' build/index.html 2>/dev/null || true

# If minified (no newlines), try inline
sed -i 's|<link rel=stylesheet href=assets/css/theme.css><link rel=stylesheet href=assets/css/common.css><link rel=stylesheet href=assets/css/landing.css>|<link rel=stylesheet href=assets/css/landing.bundle.css>|g' build/index.html 2>/dev/null || true

# Also add base URL script for subdirectory deployment (after <title>)
sed -i 's|</title>|</title><script>(function(){var p=window.location.pathname;var b=p.substring(0,p.lastIndexOf("/")+1);var t=document.createElement("base");t.href=b;document.head.appendChild(t);})();</script>|' build/index.html 2>/dev/null || true

log_success "Created optimized index.html with bundle"

# ============================================
# 7. COPY STATIC ASSETS
# ============================================
log_info "Copying static assets..."
find . \
    \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \
       -o -name "*.gif" -o -name "*.svg" -o -name "*.ico" \
       -o -name "*.webp" \
       -o -name "*.woff" -o -name "*.woff2" -o -name "*.ttf" \
       -o -name "*.eot" -o -name "*.json" -o -name "*.webmanifest" \) \
    -not -path "./node_modules/*" \
    -not -path "./build/*" \
    -not -path "./desktop/*" \
    -not -path "./.git/*" | while read file; do
    output_file="build/${file#./}"
    mkdir -p "$(dirname "$output_file")"
    cp "$file" "$output_file"
done
log_success "Copied static assets"

# ============================================
# 7. COPY TEMPLATES
# ============================================
log_info "Copying templates..."
mkdir -p build/assets/templates
cp assets/templates/*.html build/assets/templates/ 2>/dev/null || true
log_success "Copied templates"

# ============================================
# 8. COPY SERVICE WORKER
# ============================================
log_info "Copying service worker..."
cp sw.js build/sw.js 2>/dev/null || true
log_success "Copied service worker"

# ============================================
# DONE
# ============================================
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

PLAYER_SIZE=$(du -h build/assets/js/bundles/player.bundle.js 2>/dev/null | cut -f1 || echo "N/A")
CSS_SIZE=$(du -h build/assets/css/player.bundle.css 2>/dev/null | cut -f1 || echo "N/A")

echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  🎉 Build complete in ${DURATION}s${NC}"
echo -e "${GREEN}  📁 Output: ./build${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Bundles (production):"
echo -e "    ${BLUE}player.bundle.js${NC}: ${PLAYER_SIZE}"
echo -e "    ${BLUE}player.bundle.css${NC}: ${CSS_SIZE}"
echo ""
echo -e "  ${GREEN}player.html now loads only 2 files (JS + CSS)!${NC}"
echo ""
echo -e "Run: ${YELLOW}npm run preview${NC} to test the production build"
