# JellyJump JS Structure

What each folder under `assets/js/` owns, and which folders it may import
from. How the parts work together is in
[`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md); the target structure,
and the steps to get there, are in
[`docs/ARCHITECTURE_PLAN.md`](../../docs/ARCHITECTURE_PLAN.md).

## Layers

```
pages        index-main.js, player-main.js, embed-main.js, watch-main.js
  ↓
ui/          DOM and user input: the player's controls, the playlist, the
             edit panel, the job tray, the tool menus
  ↓
core/        the player engine        processing/   media editing and export
  ↓                                     ↓
shared/      utilities and services used everywhere
  ↓
lib/         vendored MediaBunny, its codecs, gif.js
```

A folder imports only from the layers below it, and `core/` and
`processing/` do not import each other. `npm run quality` runs
`scripts/architecture-check.mjs`, which fails on a new import that breaks
this; the ones that break it today are listed in
`scripts/architecture-baseline.json` and are being removed.

## Folders

### `core/` — the player engine

- `Player.js`: `CorePlayer`, the player's public face.
- `playback/`: loading and decoding (`MediaLifecycle`), the render loop, the
  playback clock (`PlaybackState`, `PlaybackAnchor`, `PlaybackEpoch`),
  transport, reverse playback, the frame queue.
- `audio/`: the Web Audio graph, scheduling, the equalizer.
- `streaming/`: webcam, live streams, HLS, recording, broadcasting, Watch
  Party.
- `youtube/`: the YouTube engine behind the same player API.
- `subtitles/`: subtitle parsing and conversion.
- `config/`: player defaults and control presets.

### `processing/` — editing and export

One folder per operation (`trim/`, `speed/`, `merge/`, `transcode/`,
`slideshow/`, `combine/`, `tracks/`, `export/`, `hls/`, `frame/`,
`subtitles/`), and the worker that runs them off the main thread in
`worker/`. Tools reach them through `MediaProcessor.js`.

### `shared/` — used everywhere

- `media/`: reading media, needed by the player and by processing alike —
  the MediaBunny loader, inputs, metadata, the overlay compositor, subtitle
  conversion, the helpers that read audio and frames backwards.
- `config/`: the app's configuration and the list of outside services.
- `errors/`: the error type, its codes, and the handler for uncaught errors.
- `settings/`: the user's saved preferences (`Settings`); the only place
  that writes them. A tool that needs a value for a while uses the
  player's `override()` (`core/PlayerOverrides.js`) instead.
- `types.js`: types only — the playlist item, the job, the edit panel's
  saved history and each setting's value, used by the playlist, the jobs,
  the edit panel and `Settings`. A new field on items is added here.
- `utils/`: stateless helpers — `Logger`, `html` (escaping), `mediaUtils`,
  `MediaMetadata`, parsers, `Toast`, `ConfirmDialog`.
- `services/`: stateful services — storage (`IndexedDBService`,
  `DesktopStorageService`, `StorageService`), `JobQueue`, scanners, remote
  libraries, cut and motion detection.

### `ui/` — what the user sees and touches

- `player/`: the player's controls, panels, keyboard, overlays; the
  playlist; the edit panel; the job tray. The playlist is `Playlist.js`
  (the list, removing, clearing) and its parts, each a set of `Playlist`
  methods in a file of its own: `PlaylistStore` (saving and restoring),
  `PlaylistMetadata` (durations, thumbnails, broken items),
  `PlaylistIngest` (files, URLs, M3U and link lists, tool results),
  `PlaylistDiscovery` (the desktop media scan) and `PlaylistPlayback`
  (selecting and playing an item). Helpers with state of their own are
  classes: `PlaylistState`, `PlaylistRenderer`, `PlaylistUI`,
  `PlaylistNavigation`, `PlaylistRemoteLibraries`.
- `menus/`: `core/` (the router, the tool surface, the job runner) and
  `features/` (one file per tool).
- `Modal.js`: dialogs.

### `lib/`

Vendored libraries, checked by `npm run verify:libs`.

## Entry points

- `index-main.js`: the landing page.
- `player-main.js`: the player page.
- `embed-main.js`: the player embedded in another site.
- `watch-main.js`: watching a shared stream or Watch Party.
