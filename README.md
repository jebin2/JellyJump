# JellyJump

**JellyJump** is a video player and editor that runs in the browser, built on
[MediaBunny](https://mediabunny.dev) and WebCodecs. Files are played and edited
on the device; nothing is uploaded. It also runs as a desktop app (Electron)
that can share a library with other machines.

Live: <https://jellyjump.voidall.com>

## What it does

- **Plays** local video and audio, HLS streams (`.m3u8`), IPTV playlists,
  YouTube links and live streams — including formats browsers do not play
  natively (AC-3, DTS, TrueHD, ProRes) through decoder plugins.
- **Edits** in a side panel, with the main player as the preview: cut,
  multi-cut, crop, rotate, resize, speed and reverse, blur, watermark, remove
  background, convert, GIF, export with on-screen effects. Edits stack on one
  working copy with Undo and Reset, and are remembered after a reload.
- **Analyses**: scene changes, motion, tracks; generates subtitles on the
  device (Whisper).
- **Shares**: Watch Party (watch together, peer to peer) and, from the desktop
  app, a library other machines can browse.
- **Encrypts** a video into an ordinary-looking carrier video that survives
  re-encoding by video platforms (see `docs/adr/0011-encryption-format.md`).
- **Installs** as an app from the browser. It needs a connection to open;
  working offline is planned.

Long jobs (conversions, exports) run in the background, one at a time, in the
job tray.

## Running it

Requirements: Node 22 and npm.

```bash
npm ci
npm run dev        # http://localhost:8080/player.html
npm run build      # production build in dist/
npm run preview    # serve dist/
```

Configuration is read from Vite's environment; `.env.example` lists every
value and its default.

## Testing

```bash
npm test
```

runs, in order: the quality and architecture checks and ESLint
(`npm run quality`), the type check, the vendored-library hashes, a build, and
every test suite (`scripts/run-tests.mjs`): Node suites, then browser suites
in headless Chromium. The browser suites need Chromium: they use
`CHROMIUM_PATH` if set, else a system Chromium or Chrome. To get Playwright's:

```bash
npx playwright-core install chromium
```

Single suites run as `node scripts/<name>.mjs`, or a few through the runner
as `node scripts/run-tests.mjs smoke-test edit-panel-test`. A browser suite
that fails is run once more and, if it then passes, reported as flaky
(`CONTRIBUTING.md`). The desktop app has its own check, `npm run test:desktop`.

CI runs `npm test` on every pull request; `main` is protected, and the site
deploys only after the tests pass on `main`.

## Desktop app

```bash
cd desktop && npm ci && cd ..
npm run build:desktop
```

## Layout

```
assets/js/        the app (see assets/js/STRUCTURE.md for the layers)
  core/           the player engine
  processing/     editing and export
  shared/         media reading, config, errors, storage, utilities
  ui/             the player's controls, playlist, edit panel, tool menus
  lib/            vendored MediaBunny and codecs
public/           static files and the HTML templates
desktop/          the Electron app, library server and CLI
scripts/          tests and checks
docs/             the architecture plan and decision records
```

## Documentation

- [`docs/ARCHITECTURE_PLAN.md`](docs/ARCHITECTURE_PLAN.md): where the
  code is going, the plan to get there, and its progress.
- [`docs/adr/`](docs/adr/): why the big decisions were made.
- [`assets/js/STRUCTURE.md`](assets/js/STRUCTURE.md): what each folder owns.
- [`SECURITY.md`](SECURITY.md): reporting a vulnerability, the threat
  model, what data is kept and where.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): setup, the checks a pull request
  must pass, commits, flaky tests.
- [`.agent/rules/code-of-conduct.md`](.agent/rules/code-of-conduct.md): coding
  standards.

## Privacy

Media is read and processed on the device and is not uploaded, unless the
user shares it (Watch Party, a shared library, the Hugging Face uploader).
The landing and player pages count visits: `public/js/analytics-embed.js`
sends one event naming the project (no page, user or device details) to a
Supabase project. The app sends nothing about errors on its
own: a bug report is whatever the user copies from "Copy details" and chooses
to send. The outside services it talks to (YouTube, Hugging Face for the
subtitle model, public IPTV lists) are listed in
`assets/js/shared/config/services.js`.
