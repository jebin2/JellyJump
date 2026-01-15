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
# Copy source player.html to build
cp player.html build/player.html

# 1. Add Base URL Script (for subdirectory deployment)
# Insert after <title>
sed -i 's|<title>JellyJump - Player</title>|<title>JellyJump - Player</title><script>(function(){var p=window.location.pathname;var b=p.substring(0,p.lastIndexOf("/")+1);var t=document.createElement("base");t.href=b;document.head.appendChild(t);})();</script>|' build/player.html

# 2. Replace CSS with Bundle
# Replace the block of CSS files with the single bundle
sed -i '/assets\/css\/theme.css/c\    <link rel="stylesheet" href="assets/css/player.bundle.css">' build/player.html
# Remove the other CSS lines that follow (common, player, etc are now in bundle)
sed -i '/assets\/css\/common.css/d' build/player.html
sed -i '/assets\/css\/player.css/d' build/player.html
sed -i '/assets\/css\/screenshot.css/d' build/player.html
sed -i '/assets\/css\/modal.css/d' build/player.html
sed -i '/assets\/css\/player_page.css/d' build/player.html

# 3. Update Import Map for Production (fix path resolution)
# We will replace the entire simple import map with the comprehensive one
cat > build/temp_importmap.html << 'EOF'
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
EOF

# Use perl to replace the multi-line import map block
perl -0777 -i -pe 'BEGIN{local $/; open(F, "<", "build/temp_importmap.html"); $c = <F>; close(F)} s/<script type="importmap">.*?<\/script>/$c/gs' build/player.html
rm build/temp_importmap.html

# 4. Replace JS Imports with Bundle
# Replace the individual imports with the bundle import
sed -i "s|const { CorePlayer } = await import('\./assets/js/core/Player.js');|const { CorePlayer, Playlist } = await import('./assets/js/bundles/player.bundle.js');|g" build/player.html
sed -i "/const { Playlist } = await import('\.\/assets\/js\/player\/Playlist\.js');/d" build/player.html

log_success "Created optimized player.html with bundles"

# ============================================
# 6. OPTIMIZE embed.html TO USE BUNDLES
# ============================================
log_info "Optimizing embed.html for production..."

# 1. Add Base URL Script (for subdirectory deployment)
sed -i 's|<title>JellyJump - Embed</title>|<title>JellyJump - Embed</title><script>(function(){var p=window.location.pathname;var b=p.substring(0,p.lastIndexOf("/")+1);var t=document.createElement("base");t.href=b;document.head.appendChild(t);})();</script>|' build/embed.html

# 2. Replace CSS with Bundle (same as player - uses player.bundle.css)
sed -i '/assets\/css\/theme.css/c\    <link rel="stylesheet" href="assets/css/player.bundle.css">' build/embed.html
sed -i '/assets\/css\/common.css/d' build/embed.html
sed -i '/assets\/css\/player.css/d' build/embed.html
sed -i '/assets\/css\/screenshot.css/d' build/embed.html

# 3. Update Import Map for Production (fix path resolution)
cat > build/temp_embed_importmap.html << 'EOF'
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
EOF

perl -0777 -i -pe 'BEGIN{local $/; open(F, "<", "build/temp_embed_importmap.html"); $c = <F>; close(F)} s/<script type="importmap">.*?<\/script>/$c/gs' build/embed.html
rm build/temp_embed_importmap.html

# 4. Replace JS Import with Bundle
sed -i "s|const { CorePlayer } = await import('./assets/js/core/Player.js');|const { CorePlayer } = await import('./assets/js/bundles/player.bundle.js');|g" build/embed.html

log_success "Created optimized embed.html with bundles"

# ============================================
# 7. OPTIMIZE index.html TO USE LANDING BUNDLE
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
# 8. COPY STATIC ASSETS
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
# 8. COPY TEMPLATES
# ============================================
log_info "Copying templates..."
mkdir -p build/assets/templates
cp assets/templates/*.html build/assets/templates/ 2>/dev/null || true
log_success "Copied templates"

# ============================================
# 9. COPY SERVICE WORKER
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
