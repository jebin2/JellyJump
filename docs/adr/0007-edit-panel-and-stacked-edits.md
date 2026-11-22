# 0007. Editing in a side panel, edits stacked on one working copy

Status: Accepted

## Context

Each tool used to open a dialog with a small player of its own and closed
once its job was queued; editing one video several times meant opening the
result, then the next dialog, and losing sight of the video each time.

## Decision

Tools open in a panel in the sidebar; the main player is the preview, with
tools drawing on it (boxes, blur areas, colour picking) and setting ranges on
its timeline. Applying an edit waits for its job, then opens the result in
the same player and tool to edit further. One working copy sits beside the
original in the playlist, named after it (`clip-edited.mp4`); Undo steps
back, Reset returns to the original. The history is remembered with the
copy, across closing the panel and reloading. While editing, viewer-only
settings (filters, speed) are paused, the controls pinned, and moving to
another video blocked. Info and Record stay dialogs.

## Consequences

- Tools must not create their own players; the edit panel lends the main one.
- The player needs a way to change settings temporarily without saving them
  (0009); until then the panel saves and restores them itself.
