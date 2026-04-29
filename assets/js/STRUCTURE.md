# JellyJump JS Structure

## Purpose

This document defines the intended ownership of the top-level JavaScript folders under `assets/js/` during the restructuring process.

## Current Transition Rule

Existing code may still live in legacy locations while the repo is being refactored. New code and extracted modules should follow the structure below unless a compatibility constraint requires otherwise.

## Folder Ownership

### `app/`

Page or entry-specific bootstrap code.

Intended examples:

- landing page entry
- player page entry
- embed page entry

### `core/`

Runtime logic that should not primarily exist to create or manipulate UI.

Intended examples:

- playback runtime
- streaming state
- audio engine
- subtitles
- shared config

### `processing/`

Media editing and export pipelines.

Intended examples:

- metadata inspection
- trim
- conversion
- extraction
- GIF generation
- slideshow generation

### `ui/`

Player and app UI composition code.

Intended examples:

- controls
- overlays
- panels
- menus
- bindings

### `services/`

Stateful browser-facing helpers and app services that are not pure utilities.

Intended examples:

- storage services
- Electron/browser bridge adapters
- file-drop or integration services

### `vendor/`

Local wrappers around third-party libraries or vendored modules.

Intended examples:

- MediaBunny wrapper
- local compatibility shims for browser/runtime imports

## Transition Notes

- Legacy locations such as `assets/js/player/`, `assets/js/core/`, `assets/js/utils/`, and `assets/js/lib/` may remain in use during migration.
- Prefer compatibility re-exports over large import churn in one change.
- Do not move large modules until their destination boundaries are already clear.
