# JellyJump Repo Restructuring Checklist

## Purpose

This document turns the high-level restructuring plan into executable phases.

Each phase is designed to be:

- small enough to complete and verify independently
- low-risk enough to avoid breaking the whole repo at once
- concrete enough that file ownership and expected outcomes are clear

Use this document as the working checklist during implementation.

## Working Rules

Before starting any phase:

- confirm the current build still works
- avoid mixing unrelated cleanup into the same phase
- preserve existing behavior unless the phase explicitly changes behavior
- keep temporary compatibility re-exports if imports would otherwise break

After finishing any phase:

- run the relevant build or smoke test
- update imports
- remove dead code only when the replacement is already in use
- mark the phase complete in this file

## Suggested Tracking Format

- `[ ]` not started
- `[~]` in progress
- `[x]` completed

---

## Phase 0: Baseline And Guardrails

### Objective

Establish a stable starting point and document what is source code versus generated output.

### Scope

- repo documentation
- repo hygiene
- artifact boundaries

### Tasks

- [x] Review `.gitignore` and add missing generated-output rules where appropriate.
- [x] Decide whether `dist/` should remain tracked.
- [x] Decide whether `remotion_test5/out/` should remain tracked.
- [x] Identify duplicated generated media in `public/`, `dist/`, and Remotion output.
- [x] Create `docs/architecture/` for future architecture notes.
- [ ] Move planning documents into `docs/architecture/` later if preferred.
- [x] Clean obvious accidental text artifacts such as stray notes in source-adjacent files.
- [x] Document active entry points:
  - root `index.html`
  - root `player.html`
  - root `embed.html`
  - `desktop/main.js`
  - `desktop/preload.js`
  - `remotion_test5/remotion/index.ts`

### File Targets

- `.gitignore`
- `README.md`
- `docs/architecture/`
- `REPO_RESTRUCTURING_PLAN.md`
- `REPO_RESTRUCTURING_CHECKLIST.md`

### Exit Criteria

- source vs generated content is documented
- basic repo hygiene rules are clear
- no uncertainty about entry points

### Verification

- `npm run build`
- confirm no important source files are misclassified as generated

---

## Phase 1: Introduce Folder Skeleton Without Breaking Imports

### Objective

Create the target directory shape inside `assets/js/` while keeping the current app working.

### Scope

- folder creation
- compatibility boundaries
- no behavioral refactor yet

### Tasks

- [ ] Create new folders:
- [x] Create new folders:
  - `assets/js/app/`
  - `assets/js/core/playback/`
  - `assets/js/core/streaming/`
  - `assets/js/core/audio/`
  - `assets/js/core/subtitles/`
  - `assets/js/core/config/`
  - `assets/js/processing/`
  - `assets/js/ui/`
  - `assets/js/services/`
  - `assets/js/vendor/`
- [ ] Move or mirror vendor-facing wrappers from `assets/js/lib/` into `assets/js/vendor/` using compatibility re-exports if needed.
- [x] Create placeholder README or index modules in new folders if that helps onboarding.
- [ ] Do not move the large runtime files yet unless a facade is in place.
- [ ] Prepare compatibility exports for old import paths that will change later.

### File Targets

- `assets/js/`
- `assets/js/vendor/`
- re-export shim files as needed

### Exit Criteria

- new directory structure exists
- app still builds with existing import paths
- no functional behavior changes introduced

### Verification

- `npm run build`

---

## Phase 2: Centralize Config And Presets

### Objective

Move hidden defaults out of constructors and into dedicated config modules.

### Scope

- player defaults
- control defaults
- presets
- processing defaults

### Tasks

- [x] Extract control defaults from `assets/js/core/Player.js`.
- [x] Extract player mode presets from `assets/js/core/Player.js`.
- [x] Keep `PLAYER_CONFIG` as either:
  - a simple facade, or
  - a composed export from smaller config files
- [x] Add dedicated config modules:
  - `assets/js/core/config/playerDefaults.js`
  - `assets/js/core/config/controlDefaults.js`
  - `assets/js/core/config/playerPresets.js`
- [ ] Decide where processing defaults belong and create a dedicated file.
- [x] Update runtime code to import config instead of hardcoding defaults.

### File Targets

- `assets/js/core/config.js`
- `assets/js/core/Player.js`
- `assets/js/core/config/playerDefaults.js`
- `assets/js/core/config/controlDefaults.js`
- `assets/js/core/config/playerPresets.js`
- optional `assets/js/processing/config/processingDefaults.js`

### Exit Criteria

- defaults are centralized
- constructor logic is reduced
- presets are no longer hidden in `Player.js`

### Verification

- `npm run build`
- smoke test player page controls

---

## Phase 3: Split Player Runtime From UI Shell

### Objective

Break `assets/js/core/Player.js` into a runtime-oriented core and a UI-oriented shell.

### Scope

- playback runtime
- DOM shell
- feature wiring

### Tasks

- [ ] Create a composition root that preserves the current public entry point.
- [ ] Extract canvas/container initialization into a UI shell module.
- [ ] Extract control/template mounting out of core runtime.
- [ ] Extract overlay creation out of core runtime.
- [ ] Extract event registration/teardown into a binding module.
- [ ] Keep runtime state, playback state, and transport logic in core.
- [ ] Reduce the size of `assets/js/core/Player.js` substantially.

### Suggested Sub-Modules

- `assets/js/core/playback/PlayerRuntime.js`
- `assets/js/ui/player/PlayerShell.js`
- `assets/js/ui/player/PlayerControlsView.js`
- `assets/js/ui/player/PlayerOverlays.js`
- `assets/js/ui/player/PlayerBindings.js`

### File Targets

- `assets/js/core/Player.js`
- new files under `assets/js/core/playback/`
- new files under `assets/js/ui/player/`

### Exit Criteria

- `Player.js` acts mainly as facade/composition root
- DOM/template code is no longer mixed with transport logic
- runtime code can be understood without reading UI construction code

### Verification

- `npm run build`
- manual smoke test:
  - load player
  - open controls
  - play/pause
  - fullscreen
  - keyboard shortcuts

---

## Phase 4: Extract Streaming And Audio Engines

### Objective

Move stream-specific state and audio engine logic into explicit modules.

### Scope

- stream handling
- webcam/live mode
- audio context lifecycle
- audio scheduling

### Tasks

- [ ] Audit what remains in `Player.js` that still belongs to streaming.
- [ ] Move stream state proxy ownership into a dedicated stream module.
- [ ] Extract live/webcam logic from the player facade/runtime.
- [ ] Extract `_initAudio` and related audio engine state into a dedicated audio module.
- [ ] Keep equalizer and visualizer integration behind explicit interfaces.
- [ ] Ensure player runtime consumes stream/audio services rather than directly owning all details.

### Suggested Sub-Modules

- `assets/js/core/streaming/StreamController.js`
- `assets/js/core/audio/AudioEngine.js`

### File Targets

- `assets/js/core/Player.js`
- `assets/js/player/PlayerStream.js`
- `assets/js/player/AudioEqualizer.js`
- lazy import references to `AudioVisualizer`

### Exit Criteria

- stream logic has a single home
- audio engine has a single home
- fewer proxy getters/setters in the player facade

### Verification

- `npm run build`
- manual smoke test:
  - local file playback
  - HLS playback
  - audio-only playback if supported
  - speed/equalizer behavior

---

## Phase 5: Normalize Subtitle Modules

### Objective

Make subtitle parsing, conversion, and cue lookup a coherent subsystem.

### Scope

- subtitle parser
- transcript conversion
- cue lookup
- subtitle-facing API cleanup

### Tasks

- [ ] Move subtitle files under `assets/js/core/subtitles/`.
- [ ] Decide whether `SubtitleManager` should be renamed to reflect actual responsibility.
- [ ] Separate parsing from state storage if useful.
- [ ] Keep transcript JSON to VTT conversion with the subtitle subsystem.
- [ ] Update all imports to the new subtitle paths.

### Suggested Sub-Modules

- `assets/js/core/subtitles/SubtitleParser.js`
- `assets/js/core/subtitles/SubtitleStore.js`
- `assets/js/core/subtitles/SubtitleConverter.js`

### File Targets

- `assets/js/core/SubtitleManager.js`
- `assets/js/core/SubtitleConverter.js`
- subtitle-related consumers in player modules

### Exit Criteria

- subtitle-related code is grouped together
- names reflect actual responsibilities
- subtitle logic is easy to discover

### Verification

- `npm run build`
- manual smoke test:
  - load subtitle file
  - toggle captions
  - verify cue timing still works

---

## Phase 6: Split `MediaProcessor` By Capability

### Objective

Break `assets/js/core/MediaProcessor.js` into focused service modules.

### Scope

- metadata
- trim
- conversion
- extraction
- GIF
- slideshow
- audio transform
- frame processing

### Tasks

- [ ] Introduce a shared input factory for MediaBunny input creation.
- [ ] Extract metadata methods first.
- [ ] Extract trimming methods second.
- [ ] Extract conversion and export methods next.
- [ ] Move GIF generation into a dedicated service.
- [ ] Move slideshow generation into a dedicated service.
- [ ] Move audio reverse/speed helpers into an audio processing service.
- [ ] Move frame callback creation into a frame processor factory.
- [ ] Leave `MediaProcessor.js` as a temporary facade if needed.

### Suggested Sub-Modules

- `assets/js/processing/shared/InputFactory.js`
- `assets/js/processing/metadata/MediaMetadataService.js`
- `assets/js/processing/trim/TrimService.js`
- `assets/js/processing/convert/ConvertService.js`
- `assets/js/processing/extract/TrackExtractService.js`
- `assets/js/processing/gif/GifService.js`
- `assets/js/processing/slideshow/SlideshowService.js`
- `assets/js/processing/audio/AudioTransformService.js`
- `assets/js/processing/frame/FrameProcessorFactory.js`

### File Targets

- `assets/js/core/MediaProcessor.js`
- all direct consumers of `MediaProcessor`

### Exit Criteria

- no single processing file owns every media-editing operation
- new services are grouped by capability
- cleanup/resource handling remains correct

### Verification

- `npm run build`
- smoke test representative operations:
  - metadata read
  - trim
  - convert
  - GIF
  - slideshow

---

## Phase 7: Reorganize Player UI Modules And Menus

### Objective

Separate menu infrastructure from feature menus and move UI code out of ambiguous locations.

### Scope

- control UI
- panels
- menu infrastructure
- feature menus

### Tasks

- [ ] Create UI directories:
  - `assets/js/ui/controls/`
  - `assets/js/ui/panels/`
  - `assets/js/ui/overlays/`
  - `assets/js/ui/menus/core/`
  - `assets/js/ui/menus/features/`
- [ ] Move generic menu infrastructure first:
  - `MenuFactory`
  - `MenuRouter`
  - shared editor helpers
- [ ] Move feature menu modules second.
- [ ] Ensure menus delegate processing to service modules instead of owning processing logic.
- [ ] Keep generic controls separate from feature-edit menus.

### File Targets

- `assets/js/player/`
- `assets/js/player/menu/`

### Exit Criteria

- menu core and menu features are distinct
- reusable player UI is easier to find
- menu files are thinner and more predictable

### Verification

- `npm run build`
- manual smoke test:
  - open menus
  - execute a few feature flows
  - confirm no missing imports or broken event handlers

---

## Phase 8: Audit Utilities And Promote Stateful Helpers To Services

### Objective

Reduce `utils/` sprawl and clarify ownership of generic helpers versus stateful browser services.

### Scope

- utility classification
- service extraction
- import cleanup

### Tasks

- [ ] Audit every file in `assets/js/utils/`.
- [ ] Classify each as:
  - pure utility
  - stateful service
  - domain helper
  - UI helper
  - integration adapter
- [ ] Keep pure functions in `utils/`.
- [ ] Move stateful modules to `services/`.
- [ ] Move player-only helpers closer to player/core/ui ownership.
- [ ] Remove duplicated helper responsibilities where found.

### Likely Audit Targets

- `ElectronHelper.js`
- `FileDropHandler.js`
- `FooterHelper.js`
- `StreamDetector.js`
- `MediaMetadata.js`
- `CustomDropdown.js`
- `ConfirmDialog.js`

### File Targets

- `assets/js/utils/`
- `assets/js/services/`

### Exit Criteria

- `utils/` contains mostly generic stateless helpers
- stateful browser logic has a clearer home
- file names better reflect behavior

### Verification

- `npm run build`

---

## Phase 9: Separate Browser App Entry Points

### Objective

Make each browser entry point easy to follow from HTML to JS to CSS.

### Scope

- landing page entry
- player entry
- embed entry

### Tasks

- [ ] Move `index-main.js` into `assets/js/app/index/`.
- [ ] Move `player-main.js` into `assets/js/app/player/`.
- [ ] Move `embed-main.js` into `assets/js/app/embed/`.
- [ ] Extract shared bootstrap logic into a common app module if duplication exists.
- [ ] Align page-level CSS ownership where practical.
- [ ] Update Vite inputs only if paths change materially.

### File Targets

- `assets/js/index-main.js`
- `assets/js/player-main.js`
- `assets/js/embed-main.js`
- `vite.config.js`

### Exit Criteria

- each page has a clearly scoped entry module
- shared app boot logic is not duplicated unnecessarily

### Verification

- `npm run build`
- smoke test:
  - `index.html`
  - `player.html`
  - `embed.html`

---

## Phase 10: Desktop Boundary Cleanup

### Objective

Keep Electron-specific logic clearly separated from browser-safe code.

### Scope

- Electron bridge boundaries
- desktop packaging cleanup
- browser-safe adapters

### Tasks

- [ ] Audit browser modules for direct Electron assumptions.
- [ ] Make preload-exposed APIs the only browser-facing Electron contract where possible.
- [ ] Move desktop-only helpers away from generic browser utility paths if needed.
- [ ] Check packaging paths in `desktop/package.json` for consistency with actual asset locations.

### File Targets

- `desktop/main.js`
- `desktop/preload.js`
- `desktop/package.json`
- browser modules using Electron helpers

### Exit Criteria

- browser runtime does not casually depend on Electron internals
- desktop bridge is explicit and isolated

### Verification

- `npm run build`
- desktop packaging smoke check if available

---

## Phase 11: Remotion Workspace Cleanup

### Objective

Treat Remotion as a distinct workspace instead of an overflow area inside the repo.

### Scope

- workspace naming
- output separation
- asset separation

### Tasks

- [ ] Decide whether `remotion_test5/` is active and should be renamed to `remotion/`.
- [ ] Separate source compositions from rendered output.
- [ ] Separate reference/scraped assets from production assets.
- [ ] Move generated videos out of source-heavy directories where practical.
- [ ] Update any scripts or references that assume the old folder name.

### File Targets

- `remotion_test5/`

### Exit Criteria

- Remotion source is clearly distinct from output and references
- folder naming matches actual purpose

### Verification

- run the relevant Remotion build/render flow if used

---

## Phase 12: Final Asset And Output Hygiene

### Objective

Clean remaining duplication and finalize the repo boundary between source and generated content.

### Scope

- public assets
- generated outputs
- duplicated binaries

### Tasks

- [ ] Audit `assets/icons/` for duplicates and generated leftovers.
- [ ] Audit `public/` versus `dist/` for duplicated files that should not both be tracked.
- [ ] Decide which built media belongs in source control.
- [ ] Move temporary or experimental binary assets out of permanent source locations.
- [ ] Update documentation to reflect the final repo structure.

### File Targets

- `assets/icons/`
- `public/`
- `dist/`
- Remotion output directories
- `README.md`

### Exit Criteria

- source assets and generated outputs are clearly separated
- final repo structure is documented
- no major leftover ambiguity about file ownership

### Verification

- `npm run build`
- quick manual scan of repo root and asset directories

---

## Recommended Phase Order

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6
8. Phase 7
9. Phase 8
10. Phase 9
11. Phase 10
12. Phase 11
13. Phase 12

## Best First Work Slice

If starting immediately, the best low-risk sequence is:

1. complete Phase 0
2. complete Phase 1
3. complete Phase 2
4. start Phase 3 on `assets/js/core/Player.js`

This sequence gives you boundaries before moving large code.

## Notes For Execution

- Do not combine Phase 3 and Phase 6 in one branch unless the repo is already stable after the first split.
- `Player.js` and `MediaProcessor.js` should be refactored in separate working slices.
- When moving files, prefer temporary re-export facades to reduce import churn.
- After each completed phase, update this checklist and the architecture plan.
