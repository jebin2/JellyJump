# JellyJump Repo Map

## Current Major Areas

### Root

- `index.html`
- `player.html`
- `embed.html`
- `vite.config.js`
- `package.json`

These define the main Vite-based browser app.

### `assets/`

- `assets/js/`
  Primary browser-side JavaScript code.
- `assets/css/`
  Stylesheets for pages, player UI, and shared themes.
- `assets/fonts/`
  App fonts.
- `assets/icons/`
  Brand and UI image assets.
- `assets/video/`
  Source video assets.

### `public/`

Static runtime assets copied by the web build.

### `desktop/`

Electron desktop wrapper and packaging configuration.

### `remotion_test5/`

Separate video/composition workspace with source, assets, and rendered output mixed together.

### `dist/`

Generated web build output.

## Current High-Risk Structural Areas

### `assets/js/core/Player.js`

- oversized runtime/controller file
- mixes playback logic and UI creation

### `assets/js/core/MediaProcessor.js`

- oversized media processing file
- mixes many processing capabilities into one module

### `assets/js/player/`

- player-specific modules with both reusable UI pieces and tightly coupled feature wiring

### `assets/js/player/menu/`

- large concentration of feature-menu modules with mixed responsibilities

### `assets/js/utils/`

- needs later classification into pure utilities versus stateful services/helpers

## Immediate Refactor Focus

1. stabilize repo boundaries and docs
2. introduce directory skeleton
3. centralize config
4. split `Player.js`
5. split `MediaProcessor.js`
