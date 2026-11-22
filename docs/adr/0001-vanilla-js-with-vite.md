# 0001. Plain JavaScript modules, bundled by Vite

Status: Accepted

## Context

The app is a media player and editor whose hard parts are decoding, timing
and canvas drawing, not UI state. It started as plain ES modules with no
build. It then needed things a bare module tree does not give: workers that
import modules, code split so the decoders (megabytes each) load only when
needed, hashed file names so a deploy is not served stale code, and a dev
server that sets the cross-origin isolation headers.

## Decision

No UI framework. The code is plain ES modules, HTML templates and CSS,
bundled by Vite. Type checking is opt-in per file (`// @ts-check`, checked by
TypeScript without compiling). Other npm dependencies need approval; the
approved ones are listed in the code of conduct.

## Consequences

- The UI is hand-written DOM; consistency comes from conventions (the tool
  surface, `runMenuJob`, the `html` template) rather than a framework.
- Vite's `import.meta.env` is the source of build configuration
  (`shared/config/`).
- The code of conduct said "no build step" until 2026-11; it now matches
  this record.
