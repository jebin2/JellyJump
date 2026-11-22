# 0005. Local files are kept in IndexedDB, read on demand

Status: Accepted

## Context

A playlist of local files must survive a reload, but the browser gives no
lasting access to a file the user picked. Holding every file in memory does
not scale to a library of videos.

## Decision

In the browser, each local item's file is stored in IndexedDB under the
item's id when the playlist is saved, then released from memory; it is read
back when the item is played or processed (`MediaMetadata.getSourceBlob`).
Files over 500 MB are not stored and stay in memory. In the desktop app,
files are read from their path on disk instead, and nothing is stored as a
blob (`DesktopStorageService`).

## Consequences

- A file still in memory is one storage could not keep; it must not be
  dropped (BUG-6, fixed in #58).
- A file is deleted when its item leaves the playlist, unless the edit
  panel's Undo history still needs it, and a sweep after each load deletes
  files nothing refers to (`ui/player/PlaylistFiles.js`; BUG-4, wave 2).
- When storage is full, the list is saved without the files that did not
  fit; they play until the page closes, and the user is told once.
- Edited copies on desktop have no path on disk; plan step G4 gives them
  one.
