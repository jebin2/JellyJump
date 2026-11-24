# 0004. Cross-origin isolation through a service worker

Status: Accepted

## Context

Multi-threaded WebAssembly (`SharedArrayBuffer`), used by MediaBunny's
codecs and by the subtitle model's runtime, needs the page to be
cross-origin isolated: `Cross-Origin-Opener-Policy: same-origin` and a
`Cross-Origin-Embedder-Policy`. GitHub Pages, which serves the site, cannot
set response headers.

## Decision

`public/sw.js` adds the two headers to the site's own responses. COEP is
`credentialless` rather than `require-corp`, so cross-origin loads that do
not send CORP headers (models, thumbnails, user URLs) still work. The dev
and preview servers set the same headers (`vite.config.js`).

## Consequences

- The first visit is not isolated until the worker is active; the page
  reloads once to pick it up.
- The service worker is also where the offline cache is (ADR 0012).
