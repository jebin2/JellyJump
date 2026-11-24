# 0012. Offline through the service worker

Status: Accepted

## Context

The site is installable but needed a connection to open (BUG-12). Decision
7 of the plan: make the player work offline after a first visit (step Q4).
The build is about 42 MB without source maps, 26 MB of it the subtitle
model's runtime and 3 MB the landing page's videos; most of the rest is
tools that a given visitor may never open. The player already gets its
isolation headers from the same worker (ADR 0004), so the worker must keep
working even when storing fails.

## Decision

- **Precache, small and fixed.** Once active, in the background (holding
  up activation would hold up the isolation reload, ADR 0004), the worker
  stores the player
  and landing pages, the code each loads at start, the chunks it imports
  directly (the player, the playlist, MediaBunny), the on-demand DTS and
  TrueHD decoders, and the public files the player reads (templates,
  icons, manifest): about 6.7 MB before compression. The build writes the
  list into `dist/sw.js` (`vite.config.js`, `jellyjump-sw`), so each deploy
  changes the worker and the browser installs the new one.
- **Hashed files from the cache.** A file whose name carries its content
  hash never changes, so it is answered from the cache, and stored the
  first time it is fetched: a tool opened once works offline after.
- **Everything else from the network first.** Pages and unhashed files come
  from the network when there is one, so a deploy shows at once, and from
  the cache when not. `version.json` (the update check), media, source maps
  and range requests are never stored.
- **One build at a time.** The new worker drops the old precache and any
  stored hashed file the new build no longer has.
- **Failure is not fatal.** A file that fails to store is fetched again
  next time; the install never fails over it. Offline, a lazy import that
  fails does not trigger the stale-build reload (`reload-on-stale-chunks`).

## Consequences

- The first visit downloads the precache in the background (about 2.5 MB
  compressed) on top of the page.
- Offline, the player opens and plays local files and stored ones; a tool
  never opened before cannot load, and subtitle generation needs its
  runtime, which is only stored once it has been used.
- `offline-test` checks it end to end in a browser with the network off.
- A pull request's preview has its own worker and caches (they are named by
  scope); the site's worker leaves `previews/` uncached.
