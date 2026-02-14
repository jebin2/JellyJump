# JellyJump Project Memory

## Architecture
- Vanilla JS + Vite, video player/editor PWA
- Core: Player.js (5k lines), Playlist.js (3k lines), MediaProcessor.js (2k lines)
- Video decoding: MediaBunny (WebCodecs wrapper, minified at `lib/mediabunny.js` 476KB)
- HLS: hls.js (1.3MB), loaded via HLSPlayer.js
- 17+ menu files in `player/menu/`, routed via MenuRouter.js

## Detailed Reference Files
- **[.claude/patterns.md](.claude/patterns.md)** — Step-by-step recipes for adding menus/tools, Modal API, footer template, UI patterns, icon list, directory map

## Adding a New Tool (Quick Checklist)
1. `assets/js/player/menu/<Name>Menu.js` — menu class (see patterns.md for template)
2. `public/assets/templates/playlist-templates.html` — add `<template>` at end
3. `assets/js/utils/FooterHelper.js` — add to `FOOTER_CONFIGS`
4. `assets/js/player/menu/MenuRouter.js` — add `case` before `default`
5. `assets/js/player/Playlist.js:~2730` — add to `videoTools` array (before `info`)
6. `public/assets/icons/sprite.svg` — add `<symbol>` (Material Design 24x24)

## Key APIs
- `MediaMetadata.getSourceBlob(item, saveCb)` — get raw file blob (cached)
- `Modal`: `.setTitle()`, `.setBody()`, `.setFooter()`, `.open()`, `.close()`, `.onCleanup(cb)`
- `createProcessFooter(FOOTER_CONFIGS.x)` — shared footer with progress/error/success/download
- `generateId()` from `utils/mediaUtils.js` — unique ID for new playlist items
- `CustomDropdown.init({button, menu, initialValue})` — `.getValue()`, `.destroy()`

## Memory Management Patterns
- MediaBunny `Input` objects hold decoded video data — MUST call `input.dispose()` after use
- Iterator `.return()` is async — MUST be awaited before calling `dispose()` on parent resources
- `CanvasSink` iterators yield canvas objects from an internal pool
- `CorePlayer.destroy()` → `reset()` → `_disposeMediaBunnyResources()` handles cleanup
- Modal menus create ephemeral CorePlayer instances — destroy on modal close
- `Modal.onCleanup(cb)` registers callbacks run before DOM removal

## Key Files for Memory Issues
- `Player.js:_disposeMediaBunnyResources()` — disposes videoSink, audioSink, input
- `Player.js:reset()` — must await iterator .return() before dispose (was a bug, fixed)
- `HardCutDetector.js` / `MotionDetector.js` / `ThumbnailGenerator.js` — create Input, must dispose
- `Playlist.js:destroy()` — clears interval, removes listeners, revokes blob URLs
- `CustomDropdown.js` — has destroy() for document-level click listeners
- `MenuRouter.js` — all menus lazy-loaded via dynamic import()

## Code Splitting
- MenuRouter uses dynamic import() for all 17+ menus (lazy)
- HLSPlayer loaded dynamically (only on HLS stream play)
- AudioVisualizer loaded dynamically (only on audio init)
- gif.js removed from player-main.js (loaded via MediaProcessor when needed)
