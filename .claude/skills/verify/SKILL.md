---
name: verify
description: Build and drive JellyJump in headless Chromium to verify player/UI changes
---

# Verify JellyJump

- Build: `npm install && npm run build` (vite, outputs `dist/`). Note: `npm run quality` fails on a missing `docs/` directory — pre-existing, not a regression signal.
- Serve the built app statically: `python3 -m http.server 8080 --directory dist` and open `http://127.0.0.1:8080/player.html`. For mixed-content scenarios, wrap the same server in TLS with a self-signed cert (`ssl.SSLContext.wrap_socket`).
- Drive with `playwright-core` (install in a scratch dir), `executablePath` = the `chrome` binary under `/opt/pw-browsers/chromium-*/chrome-linux/`, launch args `['--no-sandbox', '--no-proxy-server']` (the second stops the container's agent proxy from swallowing localhost requests).
- Add-link flow: click `#mb-add-url`, fill `#url-input`, click `.mb-modal-add`. Errors surface in `.mb-modal-error`, revealed by removing the `hidden` class (`.hidden` is `display:none !important`; inline `style.display` cannot override it).
- Remote media needs CORS: the player is MediaBunny/fetch-based, so test servers must send `Access-Control-Allow-Origin` (python's bare `http.server` does not). Range support is a plus but a 200 full-body response also works.
- Headless Chromium here lacks H.264/AAC decoders: adding a remote `.mp4` succeeds and duration/metadata load, but frames won't render and decode warnings appear — that's environmental, not an app bug. Use VP8/VP9/AV1 media to see actual frames.
