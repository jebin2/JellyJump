# JellyJump architecture

How the app is put together today: the layers, the main modules, their
public APIs, and the path a file takes when it is opened, edited and
exported. What each folder owns is in
[`assets/js/STRUCTURE.md`](../assets/js/STRUCTURE.md); why things are the way
they are is in the decision records, [`docs/adr/`](adr/); the steps that got
here, and the ones still to come, are in
[`ARCHITECTURE_PLAN.md`](ARCHITECTURE_PLAN.md).

Update this file in the pull request that changes what it describes.

## Layers

```
pages        player-main.js, embed-main.js, watch-main.js, index-main.js
  ↓          (build the player and the playlist and wire them together)
ui/          the player's controls, the playlist, the edit panel, the tool
  ↓          menus, the job tray -- DOM and user input
core/        the player engine            processing/   editing and export
  ↓          (no DOM but its canvas)        ↓           (no DOM; a worker)
shared/      media reading, storage, settings, errors, utilities
  ↓
lib/         vendored MediaBunny, its codecs, gif.js
```

The rules, checked on every pull request by `npm run quality`
(`scripts/architecture-check.mjs`):

1. A layer imports only from the layers below it. `core/` and `processing/`
   do not import each other; what both need is in `shared/media/`.
2. Nothing outside the player calls its `_private` members, and nothing
   outside the playlist's own files calls the playlist's. Both counts are 0
   and may not go up.
3. Only `shared/settings/` and the storage services touch `localStorage` and
   IndexedDB; only `shared/platform/` checks for Electron; outside addresses
   are written only in `shared/config/services.js`.
4. `core/Player.js` stays under 600 lines: new behaviour goes in a module
   beside it.
5. Every file in `shared/` starts with `// @ts-check` (`npm run typecheck`
   checks those files), under `strict` (`jsconfig.strict.json`).

## The player

`createPlayer(containerId, options)` (`ui/player/createPlayer.js`) builds a
`CorePlayer` (`core/Player.js`) and hands it the view: the shell and
controls it mounts, and the parts that own a piece of the screen (keyboard,
captions, loop, thumbnails, control bar). The core imports nothing from
`ui/`; without a view it plays with no controls.

```
CorePlayer                  public API (below), events, overrides
  core/playback/            loading and decoding (MediaLifecycle), the video
                            iterator, render loop, clock (PlaybackState,
                            PlaybackAnchor, PlaybackEpoch), transport, reverse,
                            the frame queue, putting frames on the canvas
                            (FramePresenter)
  core/audio/               the Web Audio graph, scheduling, equalizer; the
                            audio clock drives playback (ADR 0003)
  core/streaming/           camera, live and HLS, recording, broadcast,
                            Watch Party (PlayerStream)
  core/youtube/             the YouTube embed behind the same transport
  PlayerStateEvents         announces state as events, once per change
  PlayerOverrides           temporary values a tool sets and releases
ui/player/                  listens to the events (PlayerUIListeners) and
                            calls the public API
```

Decoding goes through MediaBunny rather than a `<video>` element (ADR 0002),
so every frame reaches a canvas through `presentFrame`, which also draws the
layers above it (stickers, decorations, subtitles; ADR 0008).

### Public API

The full list is §4.1 of the plan; `scripts/player-api-test.mjs` fails when
the class and that list disagree. In short:

| Area | Members |
|---|---|
| Lifecycle | `load(url, …)`, `reset()`, `destroy()`, `setLoading(on)`, `resetUI()` |
| Transport | `play()`, `pause()`, `togglePlay()`, `seek(t)`, `requestSeek(t)`, `stepFrame(dir)`, `setPlaybackRate(r)`, `toggleDirection()` |
| State | `currentTime`, `duration`, `playbackRate`, `isPlaying`, `isLoading`, `isLive`, `engine`, `capabilities`, the loaded source (`videoTrack`, `audioSink`, …) |
| Audio | `volume`, `setVolume(v)`, `isMuted`, `toggleMute()`, `restoreAutoplayAudio()` |
| Loop | `setLoop(mode, start, end)` and the A-B marker calls |
| Overrides | `override(values) → release` |
| Frames | `presentFrame`, `addRenderCallback`, `redraw({ overlaysChanged })` |
| Streams, tracks | camera and recording, subtitles and audio tracks |
| Wiring | `on(event, fn)`, `off`, `trigger`, navigation and play callbacks |

Events: `play`, `pause`, `directionchange`, `timeupdate`, `durationchange`,
`loadingchange`, `volumechange`, `ratechange`, `loopmodechange`, `ended`,
`trackschange`, `streamstatechange`, `controlbarmodechange`,
`filterschange`, `reversefailed`. Each fires when the state it names
changes (`player-events-test`).

### Settings and overrides

The user's preferences live in `shared/settings/Settings.js` (keys prefixed
`jj:`), written only when the user changes something. A tool that needs
another value for a while calls `player.override({ playbackRate, filters,
controlBarMode, loop, previewTransform })` and later `release()`; overrides
stack and each release restores exactly what was under it, saving nothing
(ADR 0009).

## The playlist

`Playlist` (`ui/player/Playlist.js`) is the list and its order. Its parts
are sets of `Playlist` methods in files of their own:

| Part | Does |
|---|---|
| `PlaylistIngest` | files, desktop files, URLs, M3U, YouTube, link lists, and tool results (`insertProcessedItem`) |
| `PlaylistDiscovery` | the desktop folder scan |
| `PlaylistPlayback` | `selectItem`: getting an item's source and loading it into the player |
| `PlaylistMetadata` | durations, thumbnails, broken streams |
| `PlaylistStore` | saving and restoring the list, the load guard, playback progress |

An item is a plain object whose shape, `PlaylistItem`, is in
`shared/types.js` with the job's and the settings' shapes.
`PlaylistState` holds the items and the active index; `PlaylistRenderer`
draws the tree in batches of 50 rows. Files are kept in IndexedDB in the
browser (ADR 0005) and on disk in the desktop app (`DesktopStorageService`).

## Tools and jobs

A tool is a menu in `ui/menus/features/` opened by the router
(`ui/menus/core/MenuRouter.js`), in the edit panel or as a dialog. The work
goes through `runMenuJob` (`ui/menus/core/MenuJob.js`): with `background:
true` it joins the `JobQueue` (`shared/services/JobQueue.js`), which runs one
job at a time (ADR 0006) and shows it in the job tray. The work itself calls
`MediaProcessor` (`processing/MediaProcessor.js`), which runs the operation
in the media worker when it can. Every result enters the playlist through
`playlist.insertProcessedItem`.

## Flows

### Opening a file

```
user picks or drops files
  → PlaylistIngest.handleFiles         an item per file, File kept on it
  → Playlist.addItems                  state, save() (IndexedDB / disk), render()
  → PlaylistPlayback.selectItem(i)     load guard, setLoading(true), resetUI()
       source URL: blob URL of the File, or MediaMetadata.getProcessedSourceURL
       for a stored one (read back from IndexedDB or disk)
  → player.load(url, autoplay)         PlayerTiming starts "first frame"
  → MediaLifecycle.loadPlayerMedia     YouTube / stream / file? For a file:
       MediaBunny Input → tracks → video and audio sinks, duration, HLS state
  → startPlayerVideoIterator           first frame decoded
  → presentFrame                       on the canvas, layers drawn over it
  → announce: durationchange, loadingchange, play …
  → PlayerUIListeners                  controls redrawn
playing: the render loop presents each frame when the audio clock reaches it
```

### Applying an edit (the edit panel)

```
user opens a tool on an item           EditPanel lends the main player:
                                       override({ controlBarMode: 'fixed',
                                       playbackRate: 1 }) and, apart,
                                       override({ filters: null }) (Export FX
                                       gives that one back while it is open)
tool draws on the player (boxes, ranges) and calls player.seek / setLoop
user applies
  → runMenuJob({ background: true, work, done })
  → JobQueue                           one job at a time; job tray shows it
  → work: MediaMetadata.getSourceBlob(item)  the source bytes
          MediaProcessor.process / losslessTrim / …  in the worker
  → done: playlist.insertProcessedItem(item, blob, name)
       the edit panel names it as the working copy (nameProcessedItem),
       inserted after the original, saved, rendered; PROCESSED_ITEM_EVENT
  → EditPanel opens the copy in the    edits stack on it; Undo and Reset
    same player and tool               step back (ADR 0007)
closing the panel releases the overrides: speed, filters and the control
bar come back exactly as they were
```

### Exporting

```
ExportMenu (Export FX)                 copies the live colour effects
  → runMenuJob({ background: true })
  → work: MediaMetadata.getSourceBlob(item)
          MediaProcessor.process({ format: 'mp4', trim?, overlays: { filters,
            stickers, decorations }, subtitles? })
            with overlays it runs on the main thread: the layers are live
            objects and the effects resolve against the page's SVG filters
            → processing/transcode: decode, draw each frame with the
              overlay compositor (shared/media), encode, mux
  → done: playlist.insertProcessedItem → in the list and the job tray, where
          it can be downloaded
```

The other tools (Cut, Speed, Merge, Convert, GIF, …) take the same path
with their own `MediaProcessor` call.

## Errors, diagnostics, security

- Errors are `AppError`s with a code from a closed list
  (`shared/errors/`); uncaught ones are caught by `ErrorReporter` and shown
  as a message, never sent anywhere (ADR 0010).
- Diagnostics (`shared/diagnostics/`) keep the last timings (first frame,
  seek, dropped frames) and the log on the device, for a bug report.
- The page is cross-origin isolated through a service worker (ADR 0004),
  which also keeps the player working offline (ADR 0012, `public/sw.js`);
  the content security policy and the list of outside services are in
  `shared/config/`.

## Tests that hold this in place

| Test | Holds |
|---|---|
| `architecture-check` | the layer rules, the private-call counts, the `Player.js` size, `shared/` type-checked |
| `player-api-test`, `playlist-api-test` | the player's and the playlist's public members match §4.1 and §4.2, each documented, in type-checked files |
| `player-events-test`, `smoke-test` | the events, and the real player end to end |
| `override-test` | overrides stack and restore exactly |
| `edit-panel-test`, `processing-test` | the edit and export flows |
| `offline-test` | after one visit, the player opens and plays a local file with the network off |
| `bench-test` | first frame, seek, dropped frames, memory, playlist render, against budgets |
