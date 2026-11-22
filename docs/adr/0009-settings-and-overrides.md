# 0009. One settings module; tools override settings temporarily

Status: Accepted (phase D, wave 2)

## Context

User preferences (speed, control bar mode) are written to `localStorage`
from several places under different key styles. Tools that need a different
value for a while (the edit panel pausing filters, pinning the controls,
looping a range; Rotate turning the picture) change the player's state and
then try to put it back, and the edit panel rewrites the saved speed so its
own change is not kept as the user's.

## Decision

`shared/settings/Settings.js` owns the user's preferences under one key
prefix (`jj:`) and is written only when the user changes something. It is in
`shared/`, not a new `app/` layer, because the player engine reads its
starting speed from it and `core/` may only import from below. The player gets
`override(values) → release`: a tool asks for values for as long as it needs
them; overrides stack, and releasing one restores exactly what was under it,
without saving anything.

## Consequences

- The edit panel's save-and-restore code and the speed rewrite go away.
- Old keys are moved once, on first use, and removed.
- Rotate's turned picture stays the tool's own CSS on the canvas: nothing
  else changes it, so it does not need the stack.
