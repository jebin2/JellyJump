# JellyJump Repo Restructuring Plan

## Goal

Restructure the repository so that:

- runtime code is easier to navigate and reason about
- browser player logic is separated from DOM/UI wiring
- media processing features are split by responsibility
- build artifacts and generated media do not live alongside source code
- desktop, web, and Remotion workstreams have clear boundaries
- future features can be added without extending existing god files

This plan is intended to guide a staged refactor, not a one-shot rewrite.

## Current Repo Assessment

### What exists now

- Web app built with Vite from root `index.html`, `player.html`, and `embed.html`
- Desktop wrapper in `desktop/`
- Main browser code in `assets/js/`
- Shared CSS in `assets/css/`
- Static public assets in `public/`
- MediaBunny vendor files in `assets/js/lib/`
- A separate Remotion workspace in `remotion_test5/`

### Main structural problems

1. `assets/js/core/Player.js` is a god object.
   It combines playback state, DOM/template mounting, control bar setup, audio initialization, subtitle handling, stream handling, and UI event wiring.

2. `assets/js/core/MediaProcessor.js` is a second god object.
   It combines metadata inspection, trimming, conversion, extraction, GIF generation, slideshow generation, speed changes, reverse processing, audio processing, and frame processing.

3. The `core` folder is not actually isolated.
   `assets/js/core/Player.js` imports multiple modules from `assets/js/player`, so the boundary between runtime core and UI layer is blurred.

4. Config is spread across files.
   Base player config is in `assets/js/core/config.js`, but control defaults and presets are embedded in `assets/js/core/Player.js`.

5. Source, generated output, and experimental work are mixed together.
   `dist/`, `remotion_test5/out/`, generated media, screenshots, and many binary assets live near source code.

6. Naming is inconsistent.
   Some files are services, some are controllers, some are utilities, and some are feature menus, but the folders do not consistently reflect those roles.

## Restructuring Principles

1. Separate by responsibility, not by feature growth history.
2. Keep browser runtime, UI layer, processing pipelines, and vendor code in different module groups.
3. Move generated output out of source-oriented paths whenever possible.
4. Introduce boundaries first, then split implementations.
5. Preserve behavior while changing structure.
6. Prefer incremental compatibility shims over large import rewrites in one pass.

## Recommended Target Layout

```text
JellyJump/
  apps/
    web/
      index.html
      player.html
      embed.html
      vite.config.js
      src/
        entries/
        player/
        embed/
        landing/
        shared/
          config/
          constants/
          utils/
          services/
          vendor/
      public/
    desktop/
      main.js
      preload.js
      package.json
  packages/
    player-core/
      src/
        playback/
        streaming/
        subtitles/
        audio/
        state/
        config/
    media-processing/
      src/
        metadata/
        trim/
        convert/
        extract/
        gif/
        slideshow/
        audio/
        frame-processing/
    ui-components/
      src/
        controls/
        overlays/
        panels/
        menus/
  assets/
    fonts/
    icons/
    video/
  docs/
    architecture/
    plans/
  tools/
    scripts/
  remotion/
  public/
  dist/
```

## Practical Repo Target For This Codebase

The repo does not need to jump to a full monorepo immediately. A lower-risk intermediate structure is:

```text
assets/
  css/
  fonts/
  icons/
  media/
  js/
    app/
      index/
      player/
      embed/
    core/
      playback/
      streaming/
      subtitles/
      config/
    processing/
      metadata/
      transform/
      export/
      audio/
      slideshow/
    ui/
      controls/
      overlays/
      panels/
      menus/
    services/
    utils/
    vendor/
desktop/
docs/
remotion/
public/
```

This intermediate target keeps the current app architecture but introduces real boundaries.

## Proposed Execution Plan

## Phase 0: Stabilize Before Refactor

### Tasks

- Create a `docs/` area for architecture and refactor notes.
- Decide which directories are source, generated output, vendor, and experiments.
- Add or update `.gitignore` for generated media and build artifacts where appropriate.
- Mark large generated files that should not remain tracked long term.
- Document the current entry points:
  - `index.html`
  - `player.html`
  - `embed.html`
  - `desktop/main.js`
  - `desktop/preload.js`
  - `remotion_test5/remotion/index.ts`

### Deliverables

- repo map document
- artifact policy
- source-of-truth list for entry points

## Phase 1: Establish Folder Boundaries

### Tasks

- Introduce these top-level code groups under `assets/js/`:
  - `app/`
  - `core/`
  - `processing/`
  - `ui/`
  - `services/`
  - `vendor/`
- Move raw library wrappers from `assets/js/lib/` toward `assets/js/vendor/`.
- Keep temporary re-export files so existing imports continue to work during transition.
- Move player-specific UI helpers out of `core/` assumptions.

### Deliverables

- new directory skeleton
- compatibility re-export modules
- updated import map for new structure

## Phase 2: Split `CorePlayer`

### Current problem

`assets/js/core/Player.js` currently owns:

- runtime playback state
- stream state proxies
- audio context setup
- DOM template mounting
- help overlay creation
- control panel construction
- player UI event wiring
- feature-specific helpers

### Target split

- `core/playback/PlayerRuntime.js`
  Runtime state, transport, timing, media loading, render loop.

- `core/playback/PlayerState.js`
  Serializable and derived player state.

- `core/streaming/StreamController.js`
  Stream mode, webcam mode, live behavior.

- `core/audio/AudioEngine.js`
  AudioContext, gain, equalizer integration, audio scheduling.

- `ui/player/PlayerShell.js`
  Template mounting, container initialization, canvas setup.

- `ui/player/PlayerControlsView.js`
  Control bar and panel rendering.

- `ui/player/PlayerOverlays.js`
  Loader, bezel, help, error, thumbnail overlays.

- `ui/player/PlayerBindings.js`
  DOM event registration and teardown.

### Rules

- `core/*` must not query templates or create DOM fragments directly.
- `ui/*` must not own transport logic or MediaBunny track lifecycle.
- feature modules interact through explicit methods/events, not direct state mutation across layers where avoidable.

### Deliverables

- reduced `Player.js` acting as facade or composition root
- extracted runtime, audio, stream, and UI modules
- smaller files with single responsibilities

## Phase 3: Split `MediaProcessor`

### Current problem

`assets/js/core/MediaProcessor.js` mixes almost every media-editing operation in one file.

### Target split

- `processing/metadata/MediaMetadataService.js`
  Metadata extraction, track inspection, stats.

- `processing/trim/TrimService.js`
  Lossless trim and trim-related helpers.

- `processing/convert/ConvertService.js`
  Format conversion, quality mapping, basic transforms.

- `processing/extract/TrackExtractService.js`
  Track extraction and remux helpers.

- `processing/gif/GifService.js`
  GIF generation only.

- `processing/slideshow/SlideshowService.js`
  Slideshow creation and transitions.

- `processing/audio/AudioTransformService.js`
  Speed, reverse, resampling, audio sample helpers.

- `processing/frame/FrameProcessorFactory.js`
  Remove-background, watermark, blur, rotate, flip frame callbacks.

- `processing/shared/InputFactory.js`
  Centralized `MediaBunny.Input` creation.

### Rules

- shared helpers go into `processing/shared/`, not back into another god file
- one public service per major processing capability
- keep MediaBunny resource cleanup centralized and testable

### Deliverables

- `MediaProcessor.js` removed or reduced to a backwards-compatible facade
- all processing operations grouped by capability

## Phase 4: Normalize Config and Constants

### Tasks

- Move player defaults, control defaults, presets, and feature flags into dedicated config modules.
- Split config types:
  - playback defaults
  - control defaults
  - UI presets
  - processing defaults
  - desktop-specific constants
- Remove hidden defaults from constructors when those defaults belong in config files.

### Deliverables

- `core/config/playerDefaults.js`
- `core/config/controlDefaults.js`
- `core/config/playerPresets.js`
- `processing/config/processingDefaults.js`

## Phase 5: Clean Up UI and Menu Organization

### Current problem

`assets/js/player/menu/` is large and feature-heavy, but the surrounding structure does not clearly separate reusable UI primitives from processing-feature entry points.

### Tasks

- Separate generic menu infrastructure from feature menus.
- Introduce:
  - `ui/menus/core/`
  - `ui/menus/features/`
  - `ui/panels/`
  - `ui/controls/`
- Move infrastructure files such as router/factory/base helpers into menu core.
- Keep processing-triggering menus thin; they should collect input and delegate to processing services.

### Deliverables

- clear separation between UI menu code and media processing code
- lower coupling between menu modules and runtime modules

## Phase 6: Rationalize Utilities and Services

### Current problem

`assets/js/utils/` likely contains a mix of pure helpers, browser services, UI helpers, and app-specific adapters.

### Tasks

- Audit each utility into one of:
  - pure utility
  - browser service
  - domain helper
  - UI helper
  - integration adapter
- Keep truly generic utilities in `utils/`.
- Move stateful or browser-bound modules into `services/`.
- Move player-only helpers closer to player modules.

### Deliverables

- smaller `utils/` with only stable generic helpers
- service modules with clearer ownership

## Phase 7: Separate App Entry Points

### Tasks

- Move entry-specific browser scripts into:
  - `assets/js/app/index/`
  - `assets/js/app/player/`
  - `assets/js/app/embed/`
- Keep each entry script thin.
- Shared bootstrapping should live in a reusable app bootstrap module.
- Align CSS similarly where practical:
  - page-level CSS
  - shared component CSS
  - theme tokens

### Deliverables

- one directory per browser entry
- easier navigation from HTML file to JS and CSS dependencies

## Phase 8: Desktop Boundary Cleanup

### Tasks

- Keep Electron-only code inside `desktop/`.
- Eliminate assumptions that browser modules can directly depend on Electron specifics.
- Isolate bridges behind preload-exposed APIs and browser-safe adapters.
- Ensure desktop packaging assets are stored in one predictable location.

### Deliverables

- clearer web vs desktop separation
- fewer conditional runtime checks scattered through browser code

## Phase 9: Remotion Workspace Cleanup

### Current problem

`remotion_test5/` appears to be a separate workspace with generated output and brand assets mixed in.

### Tasks

- Rename `remotion_test5/` to `remotion/` if it is still active.
- Treat it as a separate app/workspace.
- Separate:
  - source compositions
  - generated output
  - brand/source assets
  - scraped/reference material
- Keep rendered output out of source-heavy paths if possible.

### Deliverables

- isolated Remotion workspace
- less confusion between app assets and ad/video production assets

## Phase 10: Asset and Output Hygiene

### Tasks

- Audit binaries in `assets/icons/`, `public/`, and `remotion_test5/out/`.
- Move long-lived source assets to dedicated asset directories.
- Remove accidental duplicates where the same file exists in both source and output locations.
- Define rules for:
  - source assets
  - generated assets
  - distributable artifacts
  - temporary outputs

### Deliverables

- predictable asset organization
- smaller cognitive load when browsing repo

## Proposed File Moves

These are not mandatory final names, but they are a strong starting point.

### Browser runtime

- `assets/js/core/Player.js` -> `assets/js/core/playback/PlayerFacade.js`
- extracted runtime logic -> `assets/js/core/playback/PlayerRuntime.js`
- extracted audio setup -> `assets/js/core/audio/AudioEngine.js`
- extracted stream logic -> `assets/js/core/streaming/StreamController.js`

### Processing

- `assets/js/core/MediaProcessor.js` -> `assets/js/processing/MediaProcessorFacade.js`
- metadata methods -> `assets/js/processing/metadata/MediaMetadataService.js`
- trim methods -> `assets/js/processing/trim/TrimService.js`
- conversion methods -> `assets/js/processing/convert/ConvertService.js`
- slideshow methods -> `assets/js/processing/slideshow/SlideshowService.js`
- GIF methods -> `assets/js/processing/gif/GifService.js`

### Subtitles

- `assets/js/core/SubtitleManager.js` -> `assets/js/core/subtitles/SubtitleStore.js`
- `assets/js/core/SubtitleConverter.js` -> `assets/js/core/subtitles/SubtitleConverter.js`
- optional parser extraction -> `assets/js/core/subtitles/SubtitleParser.js`

### UI

- `assets/js/player/PlayerControlBar.js` -> `assets/js/ui/controls/PlayerControlBar.js`
- `assets/js/player/menu/MenuRouter.js` -> `assets/js/ui/menus/core/MenuRouter.js`
- `assets/js/player/menu/MenuFactory.js` -> `assets/js/ui/menus/core/MenuFactory.js`
- `assets/js/player/menu/*Menu.js` -> `assets/js/ui/menus/features/*Menu.js`

## Refactor Strategy

### Strategy rules

1. Move files only after establishing import compatibility shims.
2. Split behavior before renaming aggressively.
3. Keep public APIs stable during each phase.
4. Refactor one vertical slice at a time:
   - player runtime
   - media processing
   - UI menus
   - utilities
5. Run builds after each slice.

### Recommended order

1. add docs and folder skeleton
2. centralize config
3. split `CorePlayer`
4. split `MediaProcessor`
5. reorganize UI/menu modules
6. clean utilities/services
7. separate app entry points
8. clean desktop and Remotion boundaries
9. finalize asset/output hygiene

## Definition of Done

The repo restructuring is complete when:

- no core runtime file acts as a god object
- UI modules do not own media-processing pipelines
- media-processing modules are grouped by capability
- config defaults are centralized
- entry points are easy to trace
- generated output is clearly separated from source
- desktop and Remotion work are isolated from the main browser app
- new contributors can identify where to place a new feature without guessing

## Immediate Next Actions

1. Create `docs/architecture/` and move this plan there later if desired.
2. Start with `assets/js/core/Player.js`.
3. Extract config defaults and presets before deeper code motion.
4. Create a compatibility facade for the existing player import path.
5. Refactor `MediaProcessor.js` only after player runtime boundaries are in place.

## Notes

- This plan intentionally avoids a full framework rewrite.
- The priority is structural clarity with minimal behavior regression.
- If desired, the next step can be a file-by-file execution checklist derived from this plan.
