# JellyJump Entry Points

## Purpose

This document lists the currently active application entry points in the repo so future refactors do not break routing between HTML, JS, desktop bootstrap, and video-production workspaces.

## Browser App Entry Points

### `index.html`

- Primary landing page entry.
- Built by Vite from the repository root.
- Expected JS entry ownership:
  - `assets/js/index-main.js`

### `player.html`

- Primary player/editor page entry.
- Built by Vite from the repository root.
- Expected JS entry ownership:
  - `assets/js/player-main.js`

### `embed.html`

- Embedded player entry.
- Built by Vite from the repository root.
- Expected JS entry ownership:
  - `assets/js/embed-main.js`

## Desktop Entry Points

### `desktop/main.js`

- Electron main process entry.
- Desktop application bootstrap for native packaging/runtime.

### `desktop/preload.js`

- Electron preload bridge entry.
- Defines browser-facing capabilities exposed from the desktop runtime.

## Remotion Workspace Entry Points

### `remotion_test5/remotion/index.ts`

- Remotion registration entry for video composition work.

### `remotion_test5/remotion/Root.tsx`

- Composition root for Remotion renders.

## Build Configuration Entry Points

### `vite.config.js`

- Defines root web build inputs:
  - `index.html`
  - `player.html`
  - `embed.html`

### `desktop/package.json`

- Defines Electron scripts and packaging behavior.

## Notes

- These paths reflect the current repo layout, not the final target structure.
- During restructuring, compatibility shims should preserve these entry points until each app surface is migrated intentionally.
