# Architecture decision records

Why the big choices were made, so they are not re-argued or undone by
accident. One file per decision: the context, the decision, and what follows
from it. A decision that changes gets a new record that supersedes the old
one; the old one stays, marked.

| # | Decision | Status |
|---|---|---|
| [0001](0001-vanilla-js-with-vite.md) | Plain JavaScript modules, bundled by Vite | Accepted |
| [0002](0002-mediabunny-instead-of-video-element.md) | Decode with MediaBunny/WebCodecs and draw to a canvas, not `<video>` | Accepted |
| [0003](0003-audio-clock-is-master.md) | The audio clock drives playback time | Accepted |
| [0004](0004-cross-origin-isolation-through-service-worker.md) | Cross-origin isolation through a service worker | Accepted |
| [0005](0005-files-in-indexeddb.md) | Local files are kept in IndexedDB, read on demand | Accepted |
| [0006](0006-one-job-at-a-time.md) | Processing jobs run one at a time | Accepted |
| [0007](0007-edit-panel-and-stacked-edits.md) | Editing in a side panel, edits stacked on one working copy | Accepted |
| [0008](0008-layers.md) | Layers, checked by a ratchet | Accepted |
| [0009](0009-settings-and-overrides.md) | One settings module; tools override settings temporarily | Proposed |
| [0010](0010-no-telemetry-by-default.md) | No error telemetry; bug reports are copied by the user | Accepted |
| [0011](0011-encryption-format.md) | The JJC4 encrypted carrier format | Accepted; reviewed (F1–F3 open) |

New records: copy the shape of an existing one, take the next number, and
add it to this table in the same pull request as the change it explains.
