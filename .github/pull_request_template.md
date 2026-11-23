## What and why

<!-- What changes, and the reason. Link the issue or the plan step (e.g. "plan H1"). -->

## How it was tested

- [ ] `npm test` passes locally (or CI is green)
- [ ] A bug fix comes with a test that fails without it
- [ ] New or changed behaviour is covered by a suite in `scripts/run-tests.mjs`
- [ ] `npm run test:desktop`, if `desktop/` changed

## Device check

Required when the PR touches `assets/js/core/playback/`, `assets/js/core/audio/`,
`PlaylistPlayback`, or storage (`IndexedDBService`, `PlaylistStorage`,
`PlaylistFiles`, `desktop/copies.js`). None of this runs headless.
Delete this section otherwise.

**iPhone, Safari and the home-screen app**
- [ ] Autoplay starts muted; unmute works
- [ ] Seek while playing and while paused
- [ ] Switch to another video
- [ ] Reverse playback
- [ ] Edit panel: Cut loop, Multi-Cut skip
- [ ] A 4K file plays
- [ ] Screen off during playback, then back

**Android Chrome**
- [ ] The iPhone list above
- [ ] Camera and screen recorder

**Desktop app**
- [ ] Open from disk, edit, switch away and back
- [ ] Restart; the playlist and Undo come back
- [ ] Share a library to another machine
