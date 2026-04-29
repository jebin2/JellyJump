# JellyJump Artifact Policy

## Purpose

This document distinguishes source files from generated artifacts so repo cleanup can happen without losing intentional assets.

## Source Of Truth Categories

### Source Code

These are authored files and should remain the primary editing targets:

- `assets/js/`
- `assets/css/`
- `assets/fonts/`
- `assets/icons/`
- `desktop/`
- root HTML files
- `remotion_test5/remotion/`

### Public Runtime Assets

These are source assets intentionally served by the web app:

- `public/manifest.json`
- `public/robots.txt`
- `public/sitemap.xml`
- `public/favicon.ico`
- `public/icon-192.png`
- `public/icon-512.png`
- `public/assets/templates/`
- any media intentionally shipped with the app

### Generated Build Output

These are generated artifacts and should not be treated as source:

- `dist/`
- `desktop/dist/`
- `desktop/linux-unpacked/`

## Current Repo Reality

The repository currently tracks some generated or output-like files, including:

- many files under `public/`
- rendered videos under `remotion_test5/out/`

There is also direct duplication between source-served assets and generated build output:

- `public/` top-level files are reproduced in `dist/`, including:
  - `.nojekyll`
  - `JellyJumpActionAd.mp4`
  - `JellyJumpActionAd_noaudio.mp4`
  - `favicon.ico`
  - `homepage.mp4`
  - `icon-192.png`
  - `icon-512.png`
  - `manifest.json`
  - `poster.webp`
  - `robots.txt`
  - `serene.mp4`
  - `sitemap.xml`
  - `sw.js`
- `public/assets/` files are also reproduced in `dist/assets/`, including:
  - `assets/icons/sprite.svg`
  - `assets/js/lib/gif.worker.js`
  - `assets/templates/player-templates.html`
  - `assets/templates/playlist-templates.html`
  - `assets/templates/screenshot-templates.html`

This means artifact cleanup should be done deliberately rather than by broad deletion.

## Recommended Policy

### `dist/`

- Treat as generated build output.
- Do not use as a source of truth.
- Prefer leaving it ignored and eventually untracked if all deploy/publishing flows permit.

### `remotion_test5/out/`

- Treat as render output, not source.
- Keep only if the repo intentionally stores published demo renders.
- Otherwise, move to release assets or external storage and stop tracking new renders.

### `public/`

- Treat as source only for assets intentionally shipped with the web app.
- Do not dump generated output here unless it is truly part of the shipped product.

## Cleanup Rules

1. Do not delete tracked generated artifacts blindly.
2. Before untracking artifacts, verify no packaging or demo workflow depends on them.
3. Prefer documenting ownership first, then removing duplication in a later cleanup phase.
4. Keep build output directories excluded in `.gitignore`.

## Immediate Recommendations

1. Keep `dist/` ignored.
2. Review whether tracked files in `dist/` should be removed from version control in a dedicated cleanup change.
3. Review whether `remotion_test5/out/` is archival output or accidental repo growth.
4. Avoid adding new generated media to source-oriented directories unless explicitly intended.
