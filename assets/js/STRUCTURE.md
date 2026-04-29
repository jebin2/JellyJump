# JellyJump JS Structure

## Purpose

This document defines the intended ownership of the top-level JavaScript folders under `assets/js/`.

## Folder Ownership

### `core/`

Media playback engine and low-level runtime logic.

- **`playback/`**: Render loop, media lifecycle, and transport.
- **`audio/`**: Web Audio engine and processing.
- **`streaming/`**: Stream controller and segment management.
- **`subtitles/`**: Format conversion and display management.

### `shared/`

Reusable code shared across entry points.

- **`utils/`**: Stateless helper functions (Logger, mediaUtils, M3UParser, etc.).
- **`services/`**: Stateful application services (IndexedDB, PlaylistProcessor, CutDetection).

### `ui/`

UI components and interaction logic.

- **`player/`**: Feature controllers for the main player interface (Playlist, Keyboard, Overlays).
- **`menus/`**: Hierarchical menu system (Core router, Feature modals).
- **`Modal.js`**: Base component for all application dialogs.

### `processing/`

Media editing and export pipelines (Trim, Convert, GIF, etc.).

### `lib/`

WASM binaries and worker threads (AAC, MP3, HLS).

### `vendor/`

Third-party libraries used directly in the browser.

## Entry Points

- `index-main.js`: Landing page bootstrap.
- `player-main.js`: Main player application bootstrap.
- `embed-main.js`: Minimal player embed bootstrap.
