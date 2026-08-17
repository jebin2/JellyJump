#!/bin/bash
# Install a desktop entry for the *development* run of the desktop app.
#
# Wayland has no protocol for a window to set its own icon: the compositor
# reads the window's app_id and looks up a matching .desktop file. `npm start`
# installs nothing, so the taskbar falls back to a generic Electron icon no
# matter what BrowserWindow({ icon }) says. This installs the missing entry so
# a dev run looks like the real app.
#
# Packaged builds do not need this — electron-builder generates and installs
# the same entry into the deb/AppImage.
#
# Usage:   bash scripts/install-dev-desktop-entry.sh
# Remove:  rm ~/.local/share/applications/jellyjump.desktop \
#             ~/.local/share/icons/hicolor/1024x1024/apps/jellyjump.png
set -e

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE_ICON="$REPO/assets/icons/jelly_jump_logo.png"

# Must match app.getName(), which comes from desktop/package.json "name" —
# that is the app_id the compositor matches against.
APP_ID="jellyjump"

APPS_DIR="$HOME/.local/share/applications"
ICON_DIR="$HOME/.local/share/icons/hicolor/1024x1024/apps"

if [ ! -f "$SOURCE_ICON" ]; then
    echo "Icon not found: $SOURCE_ICON" >&2
    exit 1
fi

mkdir -p "$APPS_DIR" "$ICON_DIR"
cp "$SOURCE_ICON" "$ICON_DIR/$APP_ID.png"

# Exec runs the local checkout, so launching from the menu uses this tree.
cat > "$APPS_DIR/$APP_ID.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=JellyJump (dev)
Comment=JellyJump Video Player - development build
Exec=sh -c 'cd "$REPO/desktop" && ./node_modules/.bin/electron .'
Icon=$APP_ID
Terminal=false
Categories=AudioVideo;Video;Player;
StartupWMClass=$APP_ID
EOF

# Refresh the caches, where the tools exist.
command -v update-desktop-database >/dev/null && update-desktop-database "$APPS_DIR" || true
command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -f -t "$HOME/.local/share/icons/hicolor" 2>/dev/null || true

echo "Installed $APPS_DIR/$APP_ID.desktop"
echo "Installed $ICON_DIR/$APP_ID.png"
echo
echo "Restart the app to pick it up. On KDE, if the taskbar still shows the old"
echo "icon, log out and back in — Plasma caches desktop entries aggressively."
