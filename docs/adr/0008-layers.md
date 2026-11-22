# 0008. Layers, checked by a ratchet

Status: Accepted

## Context

The player core imported its UI, processing imported the core, and shared
code imported both: 59 imports went the wrong way, and 24 files called the
player's private methods. Rules in a document had not held.

## Decision

`assets/js/` is layered: pages → `ui/` → `core/`, `processing/` →
`shared/` → `lib/`; `core/` and `processing/` do not import each other.
`scripts/architecture-check.mjs` enforces it as a ratchet against
`scripts/architecture-baseline.json`: the imports that break the rule today
are listed, a new one fails, and a fixed one must come off the list. The
same check counts, and lets only go down: calls into the player's and
playlist's private members, files using `localStorage`, files using the
desktop bridge outside `shared/platform/`, and outside URLs outside
`shared/config/services.js`.

## Consequences

- Moving code to its layer is visible progress in every pull request
  (59 → 14 wrong-way imports by #55).
- A new exception needs the baseline edited in the same pull request, in
  plain sight of review.
