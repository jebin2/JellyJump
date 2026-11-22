# 0009. One settings module; tools override settings temporarily

Status: Proposed (plan phase D)

## Context

User preferences (speed, control bar mode) are written to `localStorage`
from several places under different key styles. Tools that need a different
value for a while (the edit panel pausing filters, pinning the controls,
looping a range; Rotate turning the picture) change the player's state and
then try to put it back, and the edit panel rewrites the saved speed so its
own change is not kept as the user's.

## Decision

`app/settings/Settings.js` owns the user's preferences under one key prefix
and is written only when the user changes something. The player gets
`override(values) → release`: a tool asks for values for as long as it needs
them; overrides stack, and releasing one restores exactly what was under it,
without saving anything.

## Consequences

- The edit panel's save-and-restore code and the speed rewrite go away.
- Old keys are migrated once, and kept for one release.
