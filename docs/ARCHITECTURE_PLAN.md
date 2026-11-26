# JellyJump Production-Readiness Plan

A full, staged plan to take the web app (player page, embed, watch page)
and the parts of the desktop app it shares code with to a production-ready
foundation: clear architecture, clean boundaries, proper error handling,
security, testing, observability, performance, configuration, CI/CD and
documentation — not only a reorganisation of the code.

It covers:

- what the code looks like now, measured, in every one of those areas (§2);
- the structure and the standards to aim for (§3) and the public APIs that
  hold it together (§4);
- the work, as phases of PR-sized steps, each with tasks, a "done when"
  check, tests and risk (§5), in five waves (§6);
- testing (§7), risks (§8), decisions only the owner can make (§9);
- the criteria that say the plan is done, each one checkable (§10).

Measurements are from `main` at `78c1c90` (after PR #34).

---

## 0. Progress

Updated with each PR. Findings in §2 describe the code as measured at the
start (`78c1c90`); this table is where things stand now.

| Wave | Step | Status | PR |
|---|---|---|---|
| 0 | S1 protect `main` | done (PR + `test` check required, admin bypass on) | repo settings |
| 0 | S2 deploy only after tests (BUG-10) | done, verified on `e6910ad` / `bcc7b5a` | #35 |
| 0 | S3 `npm ci`, actions pinned to SHAs | done | #35 |
| 0 | A1–A4 (BUG-1, BUG-2, BUG-7, BUG-8) | done | #36 |
| 0 | O1 escape HTML (BUG-9) | done | #37 |
| 0 | K5 flaky `encrypt-test` | done | #38 |
| 0 | O4 audit clean, audit in CI, Dependabot | done | #39 |
| 0 | B1–B4 architecture check, clock and storage tests | done | #40 |
| 1 | A5 docs: `docs/` un-ignored, this plan moved here, code of conduct and `STRUCTURE.md` updated, README no longer implies offline (BUG-12 wording) | done | #51 |
| 1 | A6 remove `remotion_test5/`, `use_case/`, `tests/*.html`, `scripts/jjc3-sim.sh` | done | #51 |
| 1 | C1, C3 MediaBunny, compositor, subtitle conversion, cancellation → `shared/` (wrong-way imports 59 → 30) | done | #52 |
| 1 | R1–R5 config module, services list, build id, sample-video hosts in config | done | #53 |
| 1 | N1–N3, P1, P2 `AppError`, codes, `ErrorReporter`, log ring with trace ids, `alert()` gone | done | #54 |
| 1 | C2 `MediaProcessor` → `processing/`, media readers → `shared/media/` (30 → 14) | done | #55 |
| 1 | C4 `shared/platform/` (direct Electron checks 8 → 0); desktop smoke test on its own profile | done | #56 |
| 1 | C5 delete stubs | not needed: imports were rewritten, no stubs made | |
| 1 | L4 ESLint; its 91 findings fixed | done | #57 |
| 1 | A7 BUG-6 confirmed on desktop and fixed; BUG-14 found and fixed | done | #58 |
| 1 | T1 README, T2 ADRs 0001–0011 | done | this PR |
| 2 | D1–D3 `Settings` (`jj:` keys, old ones moved; `localStorage` files 14 → 5), `player.override()`; edit panel and the timeline tools use it, its speed rewrite gone | done | #61 |
| 2 | G1 delete a removed item's file, G2 sweep after load (BUG-4); G3 progress in one capped map (BUG-5); G5/N6 full disk keeps the list and says so once. `localStorage` only in settings and storage (now a rule: count 0) | done | #62 |
| 2 | E1 public playlist names (`save`, `ensureMetadata`, `processMetadata`, `handleUrlUpload`); outside `playlist._*` calls 50 → 0. BUG-15 found and fixed: Record called a `playlist._showToast` that never existed, so its messages threw | done | #63 |
| 2 | E2–E5 `Playlist.js` 1,807 → 436 lines: `PlaylistStore`, `PlaylistMetadata`, `PlaylistIngest`, `PlaylistDiscovery`, `PlaylistPlayback`; `ITEM_SELECTED_EVENT` moved to the playlist; `ingest-test` (17) | done | #64 |
| 2 | F1 Scenes/Motion Add clip as jobs (BUG-3); F3 Merge and Combine A/V results through `insertProcessedItem` (they spliced into `playlist.items`, so the tray never saw them); F2 left out (see F2) | done | #65 |
| 2 | N4 the app's own errors are matched by code (`FILE_MISSING`, `CORS`), not message text. The `.message` checks left read messages from WebCodecs, MediaBunny and the Hugging Face client, which have no codes. N5 `shared/net/fetchWithPolicy.js` (time limit, GET retries with backoff, `TIMEOUT`/`OFFLINE`/`NETWORK`) for shared libraries, M3U, YouTube titles, subtitles; `net-test` (14). N7 partly: `codes.js` is the guide (what happened, what to do); messages written elsewhere move to it as their code is touched | done | #66 |
| 2 | O2 done by ESLint (#57). O3 one CSP module (`shared/config/csp.js`), written into the four pages at build (they carry a placeholder); `csp-test` (21). O5 desktop `read-file`: only files the user picked (remembered in `read-grants.json`, not the renderer-written config), the scan found or covers, and their subtitles; was any media file on the disk. `read-grants-test` (14), desktop smoke test refuses an unpicked file | done | #67 |
| 2 | O6 the web client sends the share token as `Authorization: Bearer`, never in an API URL; stream URLs carry a per-file key (`sig`, an HMAC of the file id with the token: opens that file only, dies with the token; no expiry, since a playlist plays an item hours later) instead of the token; the log ring hides `token=` and `sig=` values. Old clients' `?token=` still works | done | #68 |
| 2 | Q1 `scripts/size-report.mjs` in `npm test`: first-paint JS and CSS per page, lazy chunks, duplicated vendored files (from source maps), media nothing names; fails on a budget breach or >5% growth past `scripts/size-baseline.json`. Player first paint today: 10.1 KB JS, 18.4 KB CSS (budgets 60 and 25). Q3 dropped 5.2 MB of unused videos (`homepage_old.mp4`, `JellyJumpActionAd_noaudio.mp4`, `serene.mp4`); Whisper's 26 MB runtime is referenced only by its worker. Q2 measured, not fixed: 7 vendored files ship twice (MediaBunny core, AC-3, ProRes, gif.js, three encoders). The page needs its own copies (recording, HLS, encryption and track extraction encode on the page), so the cost is MediaBunny downloaded a second time by the worker on the first edit job (~540 KB gzip). Sharing one copy needs the worker and the page to load the same file, a build change of its own; the report holds the count at 7 meanwhile | done | #69 |
| 2 | K1 `processing-test`: every `MediaProcessor` operation on the fixture in a real browser (cut, lossless cut, convert, resize, speed with and without audio, reverse, merge, track extraction to M4A/WAV/MP4, combine A/V, GIF, slideshow, HLS), each read back for duration, tracks and size; cancelling. K2 the same conversion in the worker and on the page gives the same result | done | #70 |
| 2 | F4 each tool's templates in `ui/menus/templates/<tool>.html`, imported with the tool's lazily loaded code and installed then (`ui/menus/core/Templates.js`); `playlist-templates.html`, fetched before the player starts, 125 KB → 8 KB; 4 unused templates deleted; `template-test` (39) checks every template asked for exists and is loaded with its tool. F5 tool styles (convert, cut, crop, resize, GIF, Remove BG, tracks, M3U validation, their form controls) from `player.css` to `tools.css`, loaded right after it; no selector sets the same property in both | done | #71 |
| 2 | K3 coverage in every `npm test`, no new dependencies: Node's V8 coverage for the Node suites, Chromium's for the browser suites (checkpointed before each navigation), built chunks carried back to their sources through the source maps; printed per folder after the suites (`scripts/coverage-report.mjs`); fails when the total drops more than a point below `scripts/coverage-baseline.json`. Today 55.7% of the code in `assets/js` (outside `lib/`). Not counted: code run inside workers (the media worker, Whisper), and suites on other pages (watch party, YouTube embed) | done | #72 (CI also 55.7%) |
| 2 | G4 desktop: a tool's result is written in chunks to `userData/copies/<id>__<name>` (`desktop/copies.js`) and read back by path; it survives a restart, the edit panel's Undo history is kept on desktop too (its desktop special case is gone), removing an item deletes its copy and the sweep covers the folder. Dropped files are the user's and are not copied; deleting reaches only the copies folder. `desktop-copies-test` (15); desktop smoke test: copy on disk, original not copied, plays after a restart, reads back by id, deleted with its item (17) | done | #73 |
| 2 | Q2 moved to wave 4 (see Q2) | moved | this PR |
| 3 | K4 PR template (`.github/pull_request_template.md`) with the device checklist, required for playback, audio, `PlaylistPlayback` and storage changes. K5 `run-tests.mjs` runs a failed browser suite once more; one that then passes is reported as flaky (summary line, CI warning, job summary); `JJ_NO_RETRY=1` turns it off; suites can be named on the command line. T4 `CONTRIBUTING.md`: setup, the checks a PR must pass, commits, the flake policy | done | this PR |
| 3 | O7 encryption design written into ADR 0011 (algorithms, keys, counter block, header layout, review checklist, findings F1–F7); the header in its own module (`JJC4Header.js`); `crypto-vectors-test` (26) pins key derivation, ciphertext, HMAC, counter block and header bytes against `node:crypto`. Fixed: payloads over 4 GiB refused instead of a wrapped size (F4), a decrypted file keeps only a media type (F5), file name and hint out of the log (F6), stale comments (F7). Open: header not under the HMAC (F1), 100k PBKDF2 rounds (F2) — both need format version 6; no minimum password (F3). O8 `SECURITY.md` (reporting, threat model, data kept and where); secret scanning, push protection and private vulnerability reporting turned on | done | this PR |
| 3 | P5 desktop library server `GET /health` → `{status, version}`, no token, nothing about the library; library-server-test (+3). P6 the build writes `version.json` (`{version, build}`); the player page reads it when the tab comes back to the front (at most every 5 minutes, not in the first 5 after loading, not on desktop or a dev build) and offers "Reload" once per new build, never reloading by itself (`shared/utils/UpdateCheck.js`); `update-check-test` (13) | done | this PR |
| 3 | P3 metrics on the device (`shared/diagnostics/Metrics.js`, last 50 values per name, also `performance.measure` as `jj:*`): page ready, load to first frame and seek to frame (`core/PlayerTiming.js`, fed from `load`, `_seekTo` and `presentFrame`), frames shown and late frames skipped in steady playback (not the catch-up after a seek), each tool's job time, storage used. Job fps left out: jobs do not report frames. P4 Info → **Diagnostics**: version and build, browser, codec decode/encode support, storage, metrics, recent jobs by tool, recent errors; **Copy**. File names, paths and URLs are replaced (`redact.js`, also used by "Copy details"). `diagnostics-test` (21); smoke-test opens it, reads real numbers and copies it (+10). Player first paint +0.8 KB since the last baseline (Toast, redaction); baseline updated | done | this PR |
| 3 | S4 a tag runs every suite (`test.yml`, now callable) before the desktop builds; the release carries `SHA256SUMS.txt`; Node 22 there too. S5 BUG-11: the tag's version is stamped into both `package.json` files and the web build before anything is built (it used to reach only the desktop one, after the web build); the site reports the newest release tag it is built on, not `package.json` (it said 0.4.2 while 0.5.1 was out); `scripts/release.mjs prepare` sets the versions and writes the `CHANGELOG.md` section from commit subjects, `notes` gives the release page its text; `CHANGELOG.md` back-filled from v0.4.2; `release-test` (10). S8 `docs/runbooks/release.md` (release, rollback, hotfix). T5 `docs/runbooks/bug-reports.md` | done; S8 not yet tried on a real release | this PR |
| 3 | S6 previews: each pull request from a branch here (not forks, not Dependabot) is built into `previews/<pr>/` on the Pages branch and linked in a comment; rebuilt on push, removed on close (`preview.yml`). A preview keeps its own storage (`VITE_STORAGE_NAMESPACE`: database `JellyJumpDB-pr-N`, settings `jj-pr-N:`, no move of the old keys, reset clears only its own) because it shares the live site's origin; settings-test (+5). The deploy and previews write the branch through `scripts/ci/publish-pages.sh`: a commit on top of the tip, no force push, retried if the branch moved; the deploy keeps `previews/`. The service worker and isolation are checked at the sub-path by the same live check. S7 after Pages publishes, `live-smoke-test.mjs` waits for the live `version.json` to name the build, then boots the player, checks isolation, loads the sample, seeks, reads Diagnostics, and fails on any page error; the visit counter is blocked | done | this PR |
| 3 | H1 the §4.1 events, from `core/PlayerStateEvents.js` (`player.announce`): each `_update*` wrapper (and the loop and control-bar refreshes, which every change goes through) announces its state, and an event fires only when that state changed: play, pause, timeupdate (not again after the render loop's own), durationchange, loadingchange, volumechange, ratechange, loopmodechange (fired before only from one UI binding), controlbarmodechange, filterschange, streamstatechange, trackschange, ended. The event list is created by the player, not by the UI bindings that used to reset it; a listener that throws is reported and the rest still run. `isLoading` is set by the core, not the loader UI. `player-events-test` (15); smoke-test checks the real player's events (+7). `player._*` from outside 356 → 354 | done | this PR |
| 3 | H2 (first part) the play button, progress bar, time display, volume, speed button and spinner are drawn by `ui/player/PlayerUIListeners.js` from the player's events; the core's `_updatePlayPauseUI`, `_updateProgress`, `_updateTimeDisplay`, `_updateVolumeUI`, `_updateSpeedMenu` and `_setLoading` only announce, and `Player.js` no longer imports those UI functions. New `directionchange` (direction, reversing, reverse unavailable), which the play button also shows. UI that redraws a control without a state change (opening the audio panel, first paint) calls the UI directly. Filters button, loop UI, stream UI and tracks still called by the core (next part). smoke-test checks the controls follow the events (+3); player-events-test (17). `player._*` 354 → 352 | done | #82 |
| 3 | H2 (rest) the filters button, loop button, panel and A-B markers, captions and audio-track menus and the live badge are drawn from `filterschange`, `loopmodechange` (and `durationchange`, for the markers), `trackschange` and `streamstatechange`. The changes announce themselves: `VideoFilters` on every change, the subtitle state on load, switch, toggle and off, and the new public `setLoop(mode, start, end)` (§4.1), which the loop panel, the overrides and the edit panel's preview range use (the preview's retry timer for a duration still loading is gone). Public `switchSubtitleTrack` and `switchAudioTrack` (§4.1). `streamstatechange` fires every time a stream loads, as the stream controls were redrawn. The `_updateFiltersButtonState`, `_updateAudioButtonState`, `_updateLoopUI`, `_updateSubtitleMenu`, `_updateAudioTracks` and `_updateStreamUI` wrappers are gone; the `_update*` wrappers left only announce, except `_updateFullscreenUI` (H3). The audio menu draws only its newest request; the audio button now also follows equalizer changes. smoke-test (+4). `player._*` 352 → 318 | done | #83 |
| 3 | H3 `ui/player/createPlayer.js`: `createPlayer(id, options)` builds the core with a view (`playerView`): the parts that own a piece of the screen (keyboard, captions, loop, thumbnails, control bar), `mount` (shell, screenshot button, controls, help overlay, bindings, control bar mode, resize observer), the audio-only visualizer, and the bezel, fullscreen and panel calls the core makes. Both pages use it. `core/Player.js` takes the view as its third argument and imports nothing from `ui/`; `AudioEngine` asks the view for the visualizer. The `_init`, `_createControls`, `_attachEvents`, `_createHelpOverlay` and `_initResizeObserver` wrappers are gone. Wrong-way imports 14 → 0 (the core → ui allow-list is empty) | done | #84 |
| 3 | H4 `core/Player.js` 868 → 588 lines; the architecture check fails it above 600. 60 one-line pass-throughs are gone: their callers call the part (`player.thumbnails`, `.subtitles`, `.stream`, `.keyboard`, `.controlBar`, `.loop`) or the module function (`AudioEngine`, `MediaLifecycle`, `PlaybackState`, `RenderLoop`) directly. UI left the core: the document listeners (click, keydown, fullscreen, visibility) are added and removed by the view (`mount`, new `unmount`), the panel and fullscreen toggles are called by the controls themselves, showing the configured controls is in `PlayerControlsView`, the previous/next buttons in `PlayerUIUpdates`. Frame presentation and the overlay clock and baking moved to `core/playback/FramePresenter.js` (the player keeps one-line methods; tests fake them). Removed unused `setControlsConfig`, `toggleControl`, `setControlsPreset`, `getControlsConfig` and their presets. `player._*` 318 → 248 | done | this PR |
| 3 | I1 (`ui/`) no `player._*` left in `ui/`. New public `setLoading(on)`, `restoreAutoplayAudio(label)` (renamed from the private ones, everywhere) and `redraw({ overlaysChanged })` (§4.1), which the sticker and decoration layers call instead of reaching for the frame decode and the baking switch; `setVolume(v, { bezel: false })` and `toggleMute()` back the volume slider and mute button, which had copied their bodies; the keyboard seeks with `seek` and `requestPlayerSeek`; the auto-hide timers are the control bar's. A dead `player._isLoading` test (never set, so always passed) before restoring autoplay audio on a click is gone. The check no longer counts the vendored `lib/` or the playlist's `p._` (p is the playlist there). `player._*` 248 → 179 | done | #86 |
| 3 | I1 (`core/streaming`, and the wrappers everywhere in `core/`) no `player._*` left in `core/streaming`. The core announces with `player.announce.*` directly (`_updatePlayPauseUI`, `_updateProgress`, `_updateTimeDisplay`, `_updateVolumeUI`, `_updateSpeedMenu` gone), reads the clock with `getPlayerPlaybackTime`, and calls the control bar's auto-hide timers (if there is a control bar). The live start time, the owed autoplay sound and the media-ready flag are the stream's (`stream.liveStartTimestamp`, `wasMutedForAutoplay`, `isMediaReady`), no longer forwarded by private player accessors. A `player.streamController` that nothing ever set is gone. `player._*` 179 → 83 | done | #87 |
| 3 | I1 (`core/youtube`, `PlayerEvents`, the volume) none left in either. The YouTube mode's ticker, autoplay retry and owed sound, and the listener lists, are kept by their modules per player (a `WeakMap`), not as player fields; `clearPlayerEvents` empties the list on destroy. The engine switch for volume moved from `Player._syncAudioGain` to `AudioEngine.syncPlayerVolume`; YouTube's own retry tells the embed directly. The end of a video calls `completePlayerMedia`, without `Player._completeMedia`. `player._*` 83 → 55 | done | #88 |
| 3 | I1 (`core/playback`, `core/audio`) done: B2's `player._*` count is 0. `seek(t)` is the seek itself (no `_seekTo`), and the new public `requestSeek(t)` (§4.1) is the coalesced one the keyboard and scrubbing use. The seek queue and the closed-queue reopen are small player parts (`seekQueue`, `frameReopen`) the suites read; the hidden-tab flag, the scrub listeners, the pause time and the frame-sync log count are kept by the module that uses them. The playback modules call `startPlayerVideoIterator`, `extractAndDrawPlayerFrame` and `cleanupPlayerForLoad` (which took in the reverse and YouTube steps of `_cleanupForLoad`) directly. A `_liveNextAudioTime` nothing read is gone. `player._*` 55 → 0 | done | #89 |
| 3 | I2 `player-api-test`: reads `CorePlayer`'s methods and accessors from the source and the member names from §4.1's table, and fails on a public one §4.1 does not list, or a §4.1 entry the player does not have (one marked "(planned" excepted, and constructor fields count). It found 15 members in use but never listed (the A-B marker calls, `trigger`, `resetUI`, `presentFrame`, `overlayTimeMs`, the source getters, the control bar toggle), now in §4.1; `capabilities` described with its real keys; `stepFrame(dir)` added (the keyboard uses it); `tapAudio()` marked planned | done | #90 |
| 3 | Q5 `bench-test` (browser suite, in `npm test`): time to first frame, seek latency (median and worst of 10), dropped frames over a 6 s A/V play-through, JS heap growth over 20 loads (after GC), and a 2,000-item playlist render and re-render. Printed every run and added to the GitHub job summary; each has a budget (in the script, with the local baseline beside it), and one over budget fails. Local baseline: first frame 14 ms, seek 12 ms (worst 15), 0 dropped of 89, heap −0.05 MB, playlist 28–65 ms first draw and 18–27 ms again (it draws the first 50 rows, ~900 elements). Nothing over budget, so Q6 has no finding yet from these; decoder and GPU memory are outside what a page can measure | done | #91 |
| 3 | T3 `docs/ARCHITECTURE.md`: the layers and their checked rules, the player (core, view, public API, events, overrides), the playlist's parts, tools and jobs, and the flows for opening a file, applying an edit and exporting, as the code does them today; the tests that hold each in place. Linked from the README, CONTRIBUTING (updated in the PR that changes the structure) and STRUCTURE.md | done | #92 |
| 3 | T6 (`CorePlayer`, jobs) `core/Player.js` is under `// @ts-check` (one undeclared field, `_overrides`, declared) and every public method and accessor has a JSDoc comment; `player-api-test` now fails on a public member without one, or on the file losing `@ts-check`. Section dividers above members became their docs, so Player.js stays at 589 lines. The jobs API (§4.3: `runMenuJob`, `insertProcessedItem`) was already documented, and `MenuJob.js` / `JobQueue.js` already checked | done | #93 |
| 3 | T6 (`Playlist`) §4.2 rewritten to the playlist as it is (the handlers, discovered media, view state, the real window events), with `ingest.*`, `getSource`, `activeItem`, `showToast` and the `itemadded`/`itemremoved` events marked planned. `Playlist.js` and its five parts are under `@ts-check`: a types-only `PlaylistParts.d.ts` tells the checker the parts' methods are the playlist's, and the hooks `nameProcessedItem` (playlist) and `onStreamError` (player) are declared. Every public member has a JSDoc comment; `playlist-api-test` holds §4.2 to the code the way `player-api-test` holds §4.1 (both now use `scripts/lib/api-listing.mjs`). Bug found by the checker: the Clear-playlist and Delete-folder confirmations passed `confirmType: 'danger'`, which the dialog does not read, so their buttons were never shown as dangerous; now `confirmStyle` | done | this PR |
| 3 | Q6 (nothing over budget yet) | to do | |
| 4 | L2 every file in `shared/` (62) is under `// @ts-check`, 0 errors; the 39 new ones needed only annotations (the vendored MediaBunny's sinks typed `any`, DOM casts, two scanner options and `AnimatedImage.opaque` declared, `ConfirmDialog`'s title and message optional as their defaults already made them), no behaviour change. The architecture check now fails on a file in `shared/` without it. There is no `app/` folder, so L2 is `shared/` alone | done | #95 |
| 4 | L3 `shared/types.js`: `PlaylistItem` (every field the code sets, by where it comes from), `VideoInfo`, `AudioInfo`, the job types (moved from `JobQueue`), the edit panel's saved history, and `SettingsValues`, so `Settings.get('speed')` is a number and an unknown name is a type error. Used by `PlaylistState` (now type-checked), `Playlist.items`, `insertProcessedItem`, `JobQueue`, `MetadataService`, `Settings` and `EditPanel` (now type-checked: its sessions, history and elements typed). No behaviour change | done | #96 |
| 4 | L5 (first part) `jsconfig.strict.json`: `strict: true` for the folders it lists, run by `npm run typecheck` after the normal check. Listed and clean: `shared/config`, `errors`, `settings`, `platform`, `net`, `diagnostics`, `types.js`, and what they import (`Logger`, `Toast`, `Cancellation`, `JobQueue`). `Settings.get` now says it can return nothing (`|null|undefined`). Left: `shared/media` (57 errors), `services` (146), `utils` (198), mostly untyped parameters | in progress | #97 |
| 4 | L5 (`shared/media`) strict and clean: parameters typed, MediaBunny's objects `any` where they pass through (the vendored library is not type-checked), the held-frame shape named in `BackwardFrames`, `VideoInfo.codec` may be null (as `codecOf` returns). Left: `services` (146), `utils` (198) | in progress | #98 |
| 4 | L5 (`shared/services`) strict and clean, with the utils it imports (`MediaMetadata`, `M3UParser`, `YouTubeUrl`, `LinkListFile`). Items typed as `PlaylistItem` throughout; new `NewPlaylistItem` for one made before the list gives it an id (remote libraries, YouTube, a URL), and the item fields the services set (`addedAt`, `m3uSource`, `m3uData`) added to it; M3U channels typed (`Channel`); `IndexedDBService`'s old item schema replaced by the shared type; `DesktopStorageService` reads its config through one typed getter. No behaviour change. Left: the rest of `utils` | in progress | #99 |
| 4 | L5 (`shared/utils`, done) all of `shared/` (63 files) is checked under `strict`; `jsconfig.strict.json` now names `shared/` whole. The encryption code (`PlatformCrypto`, `VisualStripCodec`, `ReedSolomon`, `AudioDataCodec`) got annotations only: the shard plan (`ShardPlan`) and carrier frame (`CarrierSlot`) named, `encrypt` declares the `null` it returns when it streams to disk; `crypto-vectors-test` and `encrypt-test` pass unchanged. No behaviour change | done | #100 |
| 4 | Q4 offline (BUG-12): the service worker precaches the player and landing pages, their start-up code and direct imports (player, playlist, MediaBunny), the DTS/TrueHD decoders and the public files the player reads (51 files, 6.7 MB raw), listed into `dist/sw.js` by the build (`jellyjump-sw`); hashed files are served from the cache and stored on first use, everything else network-first with the cache as fallback; `version.json`, media, maps and range requests never stored; each build's worker drops the last build's files. The stale-chunk reload no longer fires offline. ADR 0012; `offline-test` (23): after one visit the player opens and plays a local file with the network off. README no longer says offline is planned | done | #102 |
| 4 | Bug: a remote file on a slow link stuck after a seek -- picture and sound stopped while the timer ran on. The clock is the AudioContext's and nothing held it when data ran out; late audio and late frames are dropped, so it never caught up. `core/playback/BufferingGuard.js`: the render loop suspends the context when the scheduled audio runs out or no frame comes while the decoder waits, shows the spinner, and resumes with enough audio ahead and the next frame ready (1 s, doubled for each wait soon after the last, up to 4 s, so a slow link gives a few long waits rather than one every two seconds); frames decoded more than 0.3 s behind the clock count as starved too. Seek-bar thumbnails are no longer made for a file streamed from the network (they read 100 frames from all over it and starved its playback; device logs showed playback fall from ~2.8 to ~0.4 MB/s while they read); a cached remote file plays from a blob: copy and gets them, each frame waiting for spare audio. With ?debug=1 each remote range request is logged (`shared/net/mediaFetch.js`). Known, left for J3: after a seek, MediaBunny finishes its current read-ahead chunk (8–16 MB) of the old position; it cannot be cut short without rebuilding the reader. `stall-test`: without the fix the clock ran 3.95 s ahead and 60 of 180 frames were dropped; with it, 179 of 180 shown, and all 90 after a seek | done | #104 |
| 4 | U (plan) Phase U, the remote playback buffer: pieces on disk, a downloader that keeps going while paused, a window and budget, a wait sized to the link, the downloaded range on the seek bar; steps U1–U5 | planned | #105 |
| 4 | U1 `shared/media/buffer/`: `PieceStore` (4 MB pieces, each its own abortable range request; a reader gets bytes as they arrive; one fetch per piece however many readers; least recently played file let go over the budget; key and validator checked on open and on every piece, `SOURCE_CHANGED` / `NO_RANGES` codes; offline opens what was kept; a file without a validator is kept for the session only; a Web Lock per file, a second tab keeps its own fetches in memory; link rate measured), `OpfsBackend` with its writer worker, `MemoryBackend`, `RemoteBuffer` (disk when usable, budget min(2 GB, 10% free), else memory 256 MB, folder namespaced for previews). Library server sends `ETag` (size and mtime) and exposes it. ADR 0013. `piece-store-test` (39), `piece-store-opfs-test` (13), `library-server-test` (+4). Nothing uses it yet | done | #106 |
| 4 | U2 remote files play through the buffer (`RemotePlayback`, `Downloader`): exact reads through a `CustomSource`; a reader inside a missing piece starts its own request there (a seek never waits for a piece's start); one request at a time, the player's first (a reader's request pauses the read-ahead, which keeps its bytes and finishes later; found on a device, where two requests halved the rate of the piece needed after a seek); pieces sized to the file (4 MB, a 64th of a small one, ≥ 64 KB); fetched ahead (20 min, setting `buffer`) playing or paused; a seek aborts what it left behind; within 80% of the budget per file, the furthest pieces going first; a reader's piece retried on a blip (1, 2, 4 s); the file playing is read from the buffer by the metadata reader too. The whole-file `cacheInBackground` is gone; removing an item drops its pieces. Falls back to `UrlSource` for `NO_RANGES` or an unreachable file never kept. On the 6 KB/s `stall-test` link, load 36 s → 2 s. `stream-buffer-test` (16), `piece-store-test` (46) | done | #107 |
| 4 | U3 the buffer's budget: it asks the browser to keep the site's storage (`navigator.storage.persist()`), and then may use the smaller of 8 GB and half the free space (else the smaller of 2 GB and 10%, as storage not kept can be cleared with the playlist in it); a remote file kept whole gets seek-bar thumbnails made from its pieces; tools reading a remote file whole (`getSourceBlob`) take the kept pieces as they are on disk and fetch only the rest, not copied into IndexedDB; on a metered connection 2 min ahead and nothing while paused. Found on a device: after a seek, the piece the reader from before it still waited on kept downloading beside the new one (both at half the link's rate); now it stops, keeping its bytes, and finishes only once the window is full. No buffer controls in the UI (decided: automatic) | done | #108 |
| 4 | U5 (before U4: it matters more on a slow link) a wait sized to the link: when a buffered remote file's link (the store's measure, over the last 10 s of receiving, once it has a second of it) is under the video's bitrate (with 10% to spare, times the speed), a wait lasts until the bytes downloaded ahead cover 10 minutes of play (or the rest of the file) without another stop, `(bitrate − link) × 10 min`, but never longer than 20 s (on the device the uncapped countdown ran to minutes, and a 30 s one too was skipped with Play now after ~20 s each time); the bytes wanted and the deadline are fixed when the wait begins (recomputed on each frame, the target grew with the link and moved with the reads made while waiting: a 30 s wait ran past 33 s); on a faster link it is the 1–4 s wait it was. Under the spinner: "Buffering… m:ss" and **Play now** (`playNow()`, new in §4.1; event `bufferwaitchange`), which goes on with the short waits until the next seek or load. Found while testing: the link was not measured at all below 6.4 KB/s (it counted bytes, not time); and near the end of a file the bytes wanted could be more than the file had left after the read position (the reads run ahead of the picture), so the wait never ended; it is capped at what is left. On `stall-test`'s link (a quarter of the bitrate) the clip now plays after one wait instead of two or three. From later device logs: the link is measured over the last 3 s of receiving (a 10 s average stayed high for seconds after a drop from 10 to 0.5 MB/s); the bytes before a seek point inside a piece are fetched only once the window is full (a wait had spent 10 s of the link on them), and what is ahead counts from the byte read, not the piece's start (a 30 s wait had bought 10 s of play); each wait's log line says the link, the need and why. `buffering-guard-test` (29), `stream-buffer-test` (19) | done | #109 |
| 4 | U4 the seek bar shades what is downloaded of a remote file: the player fires `bufferchange` (`{ranges}`, seconds; new in §4.1) when a file opens, as pieces are kept or let go (at most every half second) and empty when the media is let go, so a local file, a stream or a failed load shows none; drawn under the played part by `PlayerUIListeners`. Whole pieces only (never more than is kept), placed in time by the file's average bitrate (a few seconds out where the bitrate swings). A run of only pinned pieces past the start is left out: that is the file's index (an MKV's cues, an MP4's index at the end), kept for seeking, not video. Found while testing: the first piece is pinned too (the header), and a file paused at the start showed no shading at all; the start counts. `piece-store-test` (+11), `stream-buffer-test` (+3) | done | this PR |

---

## 1. Summary

**Where the app stands.** The player, editing and processing work, and
there is a real test suite (30 suites, run on every PR). The weak points are
structural and operational:

- **Structure:** two very large objects (`Playlist` 1,783 lines,
  `CorePlayer` 902), imports going the wrong way between layers, 24 files
  reaching into the player's private methods, and workarounds in the edit
  panel because the player cannot change a setting temporarily.
- **Errors:** no global handler, errors shown four different ways, 17 empty
  `catch` blocks, no timeouts on network reads.
- **Security:** text from files and playlists put into the page as HTML
  without escaping (the CSP stops it running code); desktop file reads
  wider than needed; 4 high-severity dependency issues; no audit in CI.
- **Observability:** in production every log line is dropped; no error
  record, no metrics, no diagnostics a user could send.
- **Performance:** no budgets; about 2.3 MB of library code shipped twice;
  unused videos and source maps published.
- **Configuration:** one constant, hostnames hard-coded in the page boot,
  external URLs spread through the code.
- **Delivery:** `main` unprotected, and a merge deploys even when the tests
  fail on it; versions out of step.
- **Docs:** no decision records; project rules and structure docs out of
  date; docs folder gitignored.
- 13 bugs found while measuring (§2.13).

**What the plan delivers.** Each of the twelve goals in §10 gets
measurable criteria, a phase that meets them, and a check in CI or a test
that keeps them met afterwards.

**What it does not change.** Phone browser rules (autoplay, iOS audio) and
codecs a browser cannot decode stay handled case by case — with diagnostics
to see them. The app has no server and promises nothing is uploaded, so
observability is on the device, with an optional opt-in.

**Shape of the work.** Twenty phases (A–T), about 100 steps, mostly small
PRs, in five waves: a safety net first (protect `main`, fix the injection
and the deploy gate, guard rails), then foundations (layering, config,
errors, logging), then app structure (settings, playlist, tools, storage),
then the player's surface, then the risky player internals one at a time
with device testing.

---

## 2. Findings

### 2.1 Repository and docs

| Finding | Detail |
|---|---|
| Large generated media tracked in git | `remotion_test5/` — 54 tracked files, 37 MB, including rendered `out/*.mp4` ads. Nothing in the build, CI or `package.json` uses it. |
| Stray files at the root | `medibunny-llms-full.txt` (328 KB), `examples/`, `use_case/`, `tests/` (seven HTML probe pages, not run by anything), `clauderesumeid.txt`, `codexresumeid.txt`. Some are ignored, some tracked. |
| Plans that are not in the repo | `REPO_RESTRUCTURING_PLAN.md`, `REPO_RESTRUCTURING_CHECKLIST.md`, `reading-hls.md` and everything in `docs/` are in `.gitignore`. |
| Project rules out of date | `.agent/rules/code-of-conduct.md` says "no build steps (Webpack, Vite), no NPM dependencies" — the app is built with Vite and tested with Playwright. It also says "no inline styles"; there are 249 `.style.x =` writes. |
| Structure doc out of date | `assets/js/STRUCTURE.md` lists a `vendor/` folder that does not exist and does not describe `processing/`'s services, the edit panel or the job queue. |

### 2.2 Layering

Imports between the top-level folders of `assets/js/`:

| From → to | Imports | Should it? |
|---|---|---|
| ui → shared | 139 | yes |
| ui → core | 30 | yes |
| core → shared | 28 | yes |
| processing → core | 17 | **no** — 16 are `core/MediaBunny.js`, one `core/subtitles/SubtitleConverter.js` |
| core → ui | 15 | **no** — `Player.js` imports 13 UI modules; `AudioEngine` imports `AudioVisualizer` |
| core → processing | 15 | partly — `MediaProcessor.js` (the processing facade) lives in `core/`; `ReversePlayback` uses two processing helpers |
| shared → core | 10 | **no** — `MediaBunny.js` (5), `MediaProcessor.js` (from `MediaMetadata`) |
| ui → processing | 4 | yes |
| shared → processing | 1 | no — `JobQueue` → `processing/shared/Cancellation.js` |
| processing → ui | 1 | **no** — `TranscodeService` → `ui/player/OverlayCompositor.js` |

Almost all of the wrong-way imports come from three files in the wrong
folder: `core/MediaBunny.js` (a library loader every layer needs),
`core/MediaProcessor.js` (the processing facade) and
`ui/player/OverlayCompositor.js` (pure drawing code used by the player and by
export). Moving those three fixes most of the table without touching logic.

### 2.3 The player core

- `core/Player.js`: 902 lines, 153 methods — 83 one-line pass-throughs, 86
  private by name.
- Its state is a flat set of fields (`audioContext`, `gainNode`, `mixNode`,
  `nextAudioTime`, `activeSources`, `queuedAudioNodes`, `vodAnchor`, `epoch`,
  `frames`, `audioBuffers`, `playbackTimeAtStart`, `isScrubbing`,
  `isLoading`, …). The modules in `core/playback`, `core/audio` and
  `core/streaming` are functions such as `seekPlayerTo(player, t)` that read
  and write those fields. The files are split; the ownership is not.
- 24 files besides `Player.js` call its private methods. Most used:
  `_setLoading` 32, `_liveStartTimestamp` 19, `_updatePlayPauseUI` 17,
  `_getPlaybackTime` 15, `_updateVolumeUI` 13, `_updateFiltersButtonState` 11,
  `_updateProgress` 10, `_startVideoIterator` 9, `_seekTo` 8.
- Fields used outside `Player.js`: `audioContext` 11 files, `playbackRate` 11,
  `epoch` 6, `vodAnchor` 5, `playbackTimeAtStart` 4, `gainNode` 3.
- The player emits three events (`timeupdate`, `loopmodechange`,
  `reversefailed`). Everything else reaches the UI by direct calls.
- Two pages construct it: `player-main.js` and `embed-main.js`.

Its other parts, by size: `MediaLifecycle` 676 lines (load, decode, first
frame), `PlayerStream` 500 (webcam, live, HLS, recording), `WatchParty` 469,
`ReversePlayback` 399, YouTube 665 (`YouTubePlayback` + `YouTubeEngine`),
`AudioEngine` 294, `PlaybackState` 285, `PlaybackTransport` 247,
`RenderLoop` 180.

### 2.4 The playlist

`ui/player/Playlist.js` is 1,783 lines. It already delegates to
`PlaylistState`, `PlaylistRenderer` (911), `PlaylistUI` (345),
`PlaylistNavigation`, `PlaylistStorage` and `PlaylistRemoteLibraries`, but
still holds most behaviour:

| Lines | Concern | Methods |
|---|---|---|
| 43–200 | construction, navigation | `constructor`, `_initPlayerNavigation`, `playNext`, `playPrevious`, `_stopPlayback` |
| 201–420 | folder scan, discovered items, link lists | `_startMediaScan`, `cancelMediaScan`, `addDiscoveredItems`, `keepDiscoveredItem`, `addLinkListItems`, `_fillMissingYouTubeTitles` |
| 421–533 | saving and restoring | `_loadSavedPlaylist`, `_saveState`, load guard, `_savePlaybackProgress` |
| 534–661 | adding files | `handleFiles`, `handleElectronFiles` |
| 662–858 | metadata | `_processMetadata`, `_ensureMetadata`, `_prefetchMetadata`, `_updateItemUI`, `_updateStreamItemMetadata`, `_captureStreamThumbnail`, `_updateLocalItemMetadata` |
| 859–1150 | the list | `addItem`, `insertProcessedItem`, `addItems`, `removeItem`, `removeFolder`, `clear`, `destroy` |
| 1151–1468 | playing an item | `_playYouTubeItem`, `_playStreamItem`, `_ensureItemSource`, `selectItem`, `_releaseItem`, `_saveSubtitleChanges`, `_loadFoundSubtitles` |
| 1469–1586 | list UI | `render`, `_toggleFolder`, `_removeFolder`, `_updateUI`, `setRecordingState`, `_downloadItem` |
| 1587–1710 | adding by URL | `_handleUrlUpload`, `_addYouTubeVideo`, `_handleM3UPlaylist`, `_syncM3UPlaylist` |
| 1711–1783 | misc | `_toggleSettingsMenu`, `_setupToolsButton`, `markItemBroken`, `_validateStreams` |

Other modules call its private methods: `_saveState` 24 times,
`_ensureMetadata` 13, `_showToast` 9, `_processMetadata` 2,
`_handleUrlUpload` 2.

### 2.5 Edit panel, menus and jobs

- 28 menu files in `ui/menus/features/` (8,480 lines). Per-video tools open
  in the edit panel through `openProcessMenu` / `openToolSurface`; app-wide
  tools (Merge, Slideshow, Combine A/V, Record Screen, Camera, Watch
  Together, Share Library) and Info, Optimize, URL upload open a `Modal`.
- 17 menus run their work through `runMenuJob` and the `JobQueue`.
  **Scenes, Motion and Optimize do not**: Scenes and Motion trim the clips
  they add inline, with no Cancel, nothing in the job tray, and build the
  playlist item by hand with `playlist.addItem` instead of
  `insertProcessedItem` (so the job tray and the edit panel never hear of
  the result).
- The edit panel (`EditPanel.js`, 842 lines) works around the player:
  - it sets the speed to 1 and then rewrites `jellyjump-speed` in
    localStorage so its change is not saved as the user's;
  - it saves, resets and restores the filters itself;
  - it pins the controls by writing `controlBarMode` and calling
    `controlBar.applyMode()`;
  - `borrowMainPlayer` saves and restores `loopMode` / `loopStart` /
    `loopEnd` by assigning the fields;
  - Rotate turns the picture by setting a CSS transform on the player's
    canvas;
  - Export FX copies the `VideoFilters` object by prototype so a later reset
    does not change the export.

  All of these are the same missing feature: a way to change a player setting
  for a while without it becoming the user's setting (§3.4).
- Large UI files to keep an eye on: `ScreenRecorderMenu` 831, `InfoMenu` 643,
  `BoxEditorUtils` 627, `WatermarkMenu` 513.

### 2.6 Media processing

- `core/MediaProcessor.js` is the facade; the work is in
  `processing/*/` services (transcode, trim, speed, merge, slideshow, combine,
  tracks, GIF, HLS, metadata, frame) and a worker (`processing/worker/`)
  with a main-thread fallback.
- Exports with on-screen effects run on the main thread on purpose (live
  layer objects, SVG filters) — documented in `MediaProcessor.process`.
- The only processing test is `encrypt-test`. Trim, speed, reverse, merge,
  transcode and GIF are exercised indirectly by `edit-panel-test` (Cut, Crop,
  Speed, GIF) and not at all for merge, slideshow, combine, HLS export or
  track extraction.

### 2.7 Storage and persistence

- Browser: `IndexedDBService` (playlist, files, playback state). Desktop:
  `DesktopStorageService` (a JSON config through IPC; files read from disk by
  `localPath`; `saveFile` is a no-op). `StorageService` picks one.
- **File leak.** `IndexedDBService.savePlaylist` adds files but never removes
  them, and `Playlist.removeItem` does not delete one. Every file ever added,
  converted or edited stays in IndexedDB until "clear". (The edit panel now
  deletes its own discarded copies; nothing else does.)
- **Key leak.** `jellyjump-state-<item id>` is written to localStorage for
  every video played and never removed.
- **Inconsistent keys.** `jellyjump-speed`, `controlBarMode`,
  `JellyJumpDB-playlist`, `jellyjump-load-guard`, `jellyjump-edit-history`,
  `SAVED_LINKS_KEY`, `jellyjump-state-*` — three naming styles, written from
  16 files.
- **Blob URL lifetime.** `Playlist._releaseItem` revokes an item's blob URL
  whenever the player moves off it. Anything holding that URL breaks (the job
  tray's Download did, fixed in #33).

### 2.8 Desktop

- Electron is detected two ways: through `ElectronHelper` (`PlaylistUI`,
  `MediaMetadata`) and by checking `window.electronAPI` directly in six
  files (`StorageService`, `MediaScanner`, `DesktopMediaScanner`,
  `ShareMenu`, `Playlist`, `EditPanel`).
- **Suspected bug:** an edited or converted copy on desktop has no
  `localPath`, `DesktopStorageService.saveFile` does not store it, and
  `savePlaylist` drops its in-memory file. Once the player moves off it
  (`_releaseItem` revokes the blob URL), `getSourceBlob` has nothing left to
  read. Needs confirming in the desktop app.

### 2.9 Globals and events

- Globals: `window.player` (set in 2 roots, read 17 times, mostly by tests,
  `embed-main.js` and `ScreenRecorderMenu`), `window.playlist` (tests).
- Window events: `jellyjump:item-selected`, `jellyjump:processed-item`,
  `closeAllMenus`. `ITEM_SELECTED_EVENT` is defined in `EditPanel.js` but
  fired by `Playlist` (the event belongs to the playlist).

### 2.10 Tests and CI

- 30 suites run by `scripts/run-tests.mjs` (22 quick Node, 7 browser, 1
  Electron, skipped in CI), plus quality check, typecheck, library hashes
  and a build. CI runs all of it on every PR.
- Covered well: smoke (boot, open, seek, end, broadcast, overlays, camera,
  HLS, live), edit panel, Watch Party, remote libraries, CLI, encryption,
  sources that fail.
- Not covered: playlist ingest parsing beyond link lists and YouTube URLs,
  processing correctness (merge, slideshow, combine, tracks, HLS export),
  storage (save/restore round trip, file cleanup), the player clock in
  isolation, mobile behaviour (no suite can run iOS Safari).
- `tests/*.html` are manual probe pages and not run.

### 2.11 Types and quality tooling

- `@ts-check` in 17 of 174 files (`jsconfig.json` checks only files that opt
  in, `strict: false`).
- `scripts/quality-check.mjs` checks formatting rules; it does not check
  layering or private-member access.

### 2.12 CSS and templates

- CSS 7,691 lines: `player.css` 3,718 (player and every tool's styles),
  `player_page.css` 1,962, `modal.css` 693.
- Templates 3,006 lines, `playlist-templates.html` alone 2,424: every tool's
  markup in one file. After #33 some tool templates still carry markup the
  edit panel hides (`.modal-video-panel` and the GIF preview inside it).

### 2.13 Bugs found while measuring

| # | Bug | Cause | Fix |
|---|---|---|---|
| BUG-1 | Tracks shows the resolution under "Codec" and "—" under "Details" | the Codec `<span>` has both `meta-codec` and `meta-details` classes; `querySelector('.meta-details')` finds it first | drop `meta-details` from the Codec span |
| BUG-2 | Cancelling Scenes or Motion does not stop the result being rendered | `isCancelled` is passed by value into `runDetection`, so its checks always see `false` | pass a getter or an `AbortSignal` |
| BUG-3 | Scenes and Motion "add clip" has no Cancel and no tray entry; the edit panel and tray never see the clip | runs `MediaProcessor.process` inline and adds the item with `playlist.addItem` | fixed (F1): `ui/menus/core/SegmentClip.js` |
| BUG-4 | IndexedDB grows forever | files never deleted on remove (§2.7) | fixed (G1, G2) |
| BUG-5 | localStorage grows by one key per video | `jellyjump-state-<id>` never removed | fixed (G3) |
| BUG-6 | Desktop: an edited copy may stop playing after switching away | §2.8 | confirm, then phase G |
| BUG-7 | The GIF preview never shows in the edit panel | it is inside `.modal-video-panel`, which the panel hides | move it out of that panel in the template |
| BUG-8 | A-B loop region is faint over the played part of the timeline | the played bar is drawn over the loop range | z-order / colour in `player.css` |
| BUG-9 | Text from files, playlists and peers is put into the page as HTML: subtitle track names, the Optimize dialog's video title, the embed page's error message, Scenes/Motion/Tracks error messages, microphone names | `innerHTML` with `${…}` and no escaping. The page's Content-Security-Policy blocks inline scripts, so this cannot run code, but markup and styling can be injected (e.g. by a crafted M3U or a shared library's file names) | escape at every interpolation (phase O1) |
| BUG-10 | A merge to `main` deploys even if the tests fail on it | `build-deploy.yml` and `test.yml` are separate workflows and the deploy does not wait for the tests; `main` has no branch protection | phase S1–S2 |
| BUG-11 | The app's version says 0.4.2; the latest release tag is v0.5.1 | `package.json` is only stamped by the desktop release job | phase S5 |
| BUG-12 | The README calls the app a PWA; nothing works offline | `public/sw.js` only adds COOP/COEP headers; it caches nothing | phase Q4 or reword the README (decision §9) |
| BUG-13 | Library code ships twice: `mediabunny`, the AAC encoder and the MP3 encoder each appear as two chunks (about 2.3 MB minified) | the worker bundle and the main bundle each get their own copy | phase Q2; measured by `size-report` (7 files), held there |
| BUG-14 | Switching between local videos failed the reads of the one being left, with retries and console errors | `selectItem` revoked the left item's URL before the player had stopped reading it | fixed in #58 (found while confirming BUG-6) |
| BUG-15 | The Record tool threw instead of showing its messages ("Please play this video to record it", "Recording saved") | it called `playlist._showToast`, which no version of the playlist had | fixed in E1 (found by counting outside private calls) |


### 2.14 Error handling

- No global handler: nothing listens for `error` or `unhandledrejection`, so
  an exception outside a `try` disappears unless the console is open.
- 338 `catch` blocks; 17 are empty or comment-only. Errors reach the user
  four different ways: a toast (29 places), an inline message in a tool,
  `alert()` (5 places, including the Tracks and Merge tools and the screen
  recorder), or not at all.
- No error types or codes: callers tell errors apart by matching message
  text (`e.message.includes('No source available')`).
- Resilience that exists and works: the worker falls back to the main thread
  when it cannot start; a decoder stall no longer wedges a seek; live
  streams that stop sending give up; `runMenuJob` turns failures and cancels
  into messages. Missing: timeouts and retries on network reads (remote
  libraries, M3U, YouTube info), a message when the browser is offline, and
  a clear message when storage is full.

### 2.15 Security

The threat model for a local-first media app: a crafted media file, a
crafted playlist or link list from the internet, a shared library on another
machine, URL parameters on the embed page, and — on desktop — anything that
can run in the renderer and reach the IPC bridge.

- **Good:** every page has a Content-Security-Policy with
  `script-src 'self' 'wasm-unsafe-eval' https://www.youtube.com`,
  `object-src 'none'`, `base-uri 'self'`. Electron runs with
  `contextIsolation: true`, `nodeIntegration: false`, `webSecurity: true`,
  a window-open handler and a navigation guard; IPC calls check the sender.
  The library server requires a token and compares it in constant time.
- **HTML injection:** BUG-9. 16 uses of `escapeHtml` exist, so the helper is
  there; it is not used everywhere, and nothing enforces it.
- **CSP is broad where it has to be** (`connect-src *`, `img-src`/`media-src`
  with `http:` for user URLs and IPTV) and is copied by hand into four HTML
  files.
- **Desktop file reads:** `read-file` allows any path the user granted *or
  any path with a media extension*, so code in the renderer could read any
  video or audio file on the disk, not only the user's library.
- **Share token in the URL:** the library server accepts the token as a
  query parameter (needed for `<video src>`), where it can end up in logs and
  history.
- **Dependencies:** `npm audit --omit=dev` reports 4 high-severity issues,
  all through `@huggingface/transformers` (its Node-only dependencies
  `onnxruntime-node`, `adm-zip`, `sharp`). The desktop app's dependencies
  report none. No Dependabot, no audit in CI.
- **Encryption:** `PlatformCrypto.js` (936 lines) has a test
  (`encrypt-test`) but no written design or review.

### 2.16 Observability

- `Logger` prints only on localhost or with `?debug=1`; in production every
  log line is dropped, so a user's bug report has nothing behind it.
- No error reporting, no performance marks (0 uses of `performance.mark`), no
  record of how long jobs or loads take.
- The only telemetry is a self-hosted page-visit script
  (`/js/analytics-embed.js`) on the landing and player pages.
- The desktop share host checks its own tailnet mapping on a timer; the
  library server has no health endpoint.
- The "nothing is uploaded" promise rules out sending logs anywhere by
  default.

### 2.17 Performance and resources

- The player page's first JS is small (3 KB entry; the rest is loaded on
  demand). CSS: 51 KB + 35 KB minified.
- Heavy chunks are lazy and large: the DTS decoder 1.6 MB, the media worker
  1.4 MB, MediaBunny 1.35 MB, Whisper's ONNX runtime 23 MB (only for
  subtitle generation). BUG-13 duplicates about 2.3 MB.
- `dist/` is 69 MB; source maps are published (about 15 MB); `public/`
  ships 7 MB of videos, including `homepage_old.mp4` and two ad videos.
- No performance budget or size report in CI; no measurement of time to
  first frame, seek latency, memory or playlist rendering with many items.
- Memory: blob files are released after they are stored (good); the edit
  history now drops files it can read back (#33).

### 2.18 Configuration

- `shared/config.js` holds one constant (`DOMAIN`). `player-main.js` decides
  whether to add the sample video by matching four hard-coded hostnames.
- No build-time configuration: 0 uses of `import.meta.env`, no `.env` files.
- External services are spread through the code: YouTube (4 files),
  Hugging Face model URLs (6), iptv-org (7), webcammictest.com, i.ytimg.com.
- Player defaults are in `core/config/`, user preferences in seven
  localStorage keys (§2.7), and feature switches nowhere.
- Templates are fetched with a hand-maintained `?v=2` cache-buster.

### 2.19 CI/CD

- `test.yml`: quality, typecheck, library hashes, build, 30 suites — on PRs
  and pushes to `main`. Good.
- `build-deploy.yml`: on push to `main`, builds and force-pushes `release`,
  which GitHub Pages serves; then checks the Pages build. It does not wait
  for `test.yml` (BUG-10).
- `desktop-release.yml`: on a `v*` tag, builds Linux, Windows and macOS
  apps and launches the Linux one; it runs no test suite.
- `main` is not protected; workflows use `npm install` (not `npm ci`) and
  actions pinned to major versions (`@v4`), not commits.
- No preview deploy for a PR, so the only way to try a change on the real
  site is to merge it.
- Versions: tags drive the desktop build; the web build carries no version.

### 2.20 Documentation

- `README.md` (features, how to run) is short and partly out of date
  (BUG-12).
- No architecture decision records; the reasons behind the big choices
  (the MediaBunny/WebCodecs pipeline instead of `<video>`, the audio clock,
  COOP/COEP through a service worker, the job queue running one job at a
  time, IndexedDB for files) live only in code comments and commit messages.
- `docs/` and the older restructuring plans are gitignored (§2.1).
- No CONTRIBUTING, SECURITY or release runbook.

---

## 3. Target

### 3.1 Layers

```
pages        player-main.js, embed-main.js, watch, index      (composition roots)
  ↓
ui           ui/player/*, ui/menus/*, ui/Modal.js               (DOM, user input)
  ↓
app          playlist/*, jobs, settings, edit session            (app behaviour, no DOM)
  ↓
core         player engine: playback, audio, pipeline, streams   (no DOM except the canvas)
processing   transcode, trim, speed, … , worker                  (no DOM)
  ↓
shared       media/ (MediaBunny loader, compositor, metadata), storage/, utils/
```

Rules, enforced by the quality check from phase B on:

1. A layer imports only from layers below it.
2. `core/` and `processing/` do not import each other's internals; both
   use `shared/media/`.
3. Nothing outside a module calls its `_private` members.
4. Only `shared/storage/` and `shared/settings` touch `localStorage` and
   IndexedDB.
5. Only `shared/platform/` (today's `ElectronHelper`) checks for Electron.

### 3.2 Folder map (where things move)

| Today | Target |
|---|---|
| `core/MediaBunny.js` | `shared/media/MediaBunny.js` |
| `core/MediaProcessor.js` | `processing/MediaProcessor.js` |
| `ui/player/OverlayCompositor.js` | `shared/media/OverlayCompositor.js` |
| `processing/shared/Cancellation.js` | `shared/utils/Cancellation.js` |
| `core/subtitles/SubtitleConverter.js` | `shared/media/SubtitleConverter.js` |
| `shared/utils/MediaMetadata.js` | `shared/media/MediaMetadata.js` (no longer imports `MediaProcessor`; the one call goes through a passed-in function or moves to `processing/`) |
| `ui/player/Playlist.js` + `Playlist*.js` | `app/playlist/` (logic) and `ui/playlist/` (renderer, UI) |
| `shared/services/JobQueue.js` | `app/jobs/JobQueue.js` |
| `ui/player/EditPanel.js` | `ui/edit/EditPanel.js`, with its session logic in `app/edit/EditSession.js` |
| `shared/utils/ElectronHelper.js` | `shared/platform/Platform.js` |
| `shared/services/IndexedDBService.js`, `DesktopStorageService.js`, `StorageService.js` | `shared/storage/` |

Moves are done with re-export stubs at the old path for one release, so
nothing breaks mid-way; the stubs are deleted at the end of the phase.

### 3.3 Player and playlist structure

```
pages (player-main.js / embed-main.js)
  createPlayer()            builds CorePlayer and attaches the player UI
  Playlist                  the list and its order; delegates:
    PlaylistIngest          files, desktop files, URLs, M3U, YouTube, link lists
    PlaylistDiscovery       folder scan, discovered items
    PlaylistPlayback        selectItem, per-kind play, release, subtitles
    PlaylistMetadata        probe, prefetch, stream thumbnails
    PlaylistStore           save/restore, load guard, playback progress
  CorePlayer                public API (§4.1), events, setting overrides (§3.4)
    AudioSession            context, gain, mix, EQ, queues, scheduling, clock
    PlaybackSession         time, rate, epoch, seek, scrub, frame step
    MediaPipeline           load, tracks, decode, render loop, frame queue
    ReversePlayback         backwards, driven by PlaybackSession
    YouTubeBackend          the YouTube engine behind the same transport
    PlayerStream            webcam, live, HLS, recording (exists)
    WatchParty, BroadcastStream (exist; public API only)
  Player UI                 shell, controls, panels, keyboard, loop, thumbnails,
                            subtitles UI, overlays, screenshot — listen to
                            events, call the public API
```

### 3.4 Settings and temporary overrides

One module, `shared/settings/Settings.js` (in `shared/`, since the player engine reads it), owns the user's saved preferences
(speed, control bar mode, volume, filters if persisted, panel state) with one
key prefix, `jj:`. The player reads its starting values from it and writes
to it only when the **user** changes something.

Tools that need a different value for a while ask the player for an
override:

```js
const release = player.override({
    playbackRate: 1,
    filters: null,          // none while editing
    controlBarMode: 'fixed',
    loop: { mode: 'one', start, end },
    previewTransform: { rotate: 90, flipH: false },
});
// … later
release();                 // everything back exactly as it was, nothing saved
```

Overrides stack (the edit panel's, then a tool's on top); releasing one
restores the values under it. This replaces every workaround listed in §2.5.


### 3.5 Errors

- One error type, `AppError` (`shared/errors/AppError.js`): `code`,
  `userMessage`, `cause`, `recoverable`, `context`. Codes are a closed list in
  `shared/errors/codes.js`: `FILE_MISSING`, `UNSUPPORTED_CODEC`,
  `DECODE_FAILED`, `NETWORK`, `TIMEOUT`, `CORS`, `STORAGE_FULL`,
  `PERMISSION_DENIED`, `WORKER_CRASHED`, `CANCELLED`, `INVALID_INPUT`,
  `INTERNAL`.
- Errors are created where they happen, carried up unchanged, and shown in
  exactly one place: the tool's inline message for a tool, a toast for
  anything else. `alert()` is not used.
- A global `ErrorReporter` (`shared/errors/ErrorReporter.js`) listens for
  `error` and `unhandledrejection`, records every error in the diagnostics
  log (§3.7), and shows one rate-limited toast with "Copy details".
- An empty `catch` is allowed only with a comment saying why the error is
  safe to ignore; the quality check enforces it.
- Network reads go through one `fetchWithPolicy(url, {timeout, retries})`
  with a timeout, retries with backoff for idempotent reads, and `AppError`
  codes for offline, CORS and HTTP failures.

### 3.6 Security baseline

- All HTML built from strings goes through an `html` tagged template
  (`shared/utils/html.js`) that escapes every value; `innerHTML` with
  `${…}` outside it fails the quality check.
- One CSP, generated at build time from the list of external services
  (§3.8) and written into every page, with a comment per source explaining
  why it is allowed.
- Desktop: `read-file` reads only paths the user granted (dialogs, library
  folders, dropped files); media extension alone is not enough. Share tokens
  go in the `Authorization` header wherever the client can set one; links
  that must carry it in the URL get a short-lived, single-purpose token.
- Dependencies: `npm audit --omit=dev --audit-level=high` in CI for the web
  app and the desktop app; Dependabot for npm and GitHub Actions; actions
  pinned to commit SHAs.
- `SECURITY.md`: how to report a problem, the threat model in §2.15, what
  data the app keeps and where.
- The encryption format has a written design (algorithms, key derivation,
  nonce handling, header layout) and test vectors.

### 3.7 Observability (on the device)

Nothing leaves the device unless the user turns it on (decision §9).

- **Logs:** `Logger` writes structured entries (`time`, `level`, `scope`,
  `event`, `data`, `traceId`) to a ring buffer of the last 1,000 entries,
  always; the console only shows them in debug mode, as now.
- **Trace ids:** each playback load and each job gets an id; every log entry
  and error made during it carries the id, so one session or one job can be
  followed end to end.
- **Metrics:** `performance.mark` / `measure` for the journeys that matter —
  page ready, time to first frame, seek latency, frames dropped per minute,
  job duration and frames per second, storage used
  (`navigator.storage.estimate`). Kept in memory as recent values.
- **Diagnostics:** a "Diagnostics" view (in Info, or `?debug=1`) shows the
  app version and build, browser and codec support, storage use, recent
  errors, recent jobs and the metrics, with "Copy" for a bug report. No file
  names or URLs unless the user includes them.
- **Health:** the desktop library server answers `GET /health` (no token;
  status and version only). The web build writes `version.json`; the app
  compares it on focus and offers a reload when a new version is live. A
  post-deploy check (§3.10) opens the live site.
- **Optional, opt-in:** anonymous error counts by code and browser through
  the existing analytics endpoint.

### 3.8 Configuration

- `shared/config/index.js` is the only place app configuration is read. It
  combines build-time values from Vite (`import.meta.env`: base URL, domain,
  analytics on/off, sample video URL, feature flags) with fixed defaults.
  `.env.example` documents every value; `.env.production` holds the site's.
- `shared/config/services.js` lists every external service with its URL
  and purpose; the CSP (§3.6) and `fetchWithPolicy` read it.
- Three kinds of settings, never mixed: **app config** (per build), **player
  defaults** (`core/config/`, code), **user preferences** (`shared/settings`,
  stored, §3.4).
- Feature flags are config values, read through one `isEnabled(flag)`.
- No hand-written cache-busters; anything versioned gets the build version.

### 3.9 Performance budgets

Enforced by a size report in CI that fails on a breach and prints the
change against `main`:

| Budget | Limit |
|---|---|
| Player page: JS before first paint (gzip) | 60 KB |
| Player page: CSS (gzip) | 25 KB |
| Any lazy chunk except decoders, Whisper and the worker (gzip) | 150 KB |
| Duplicate library chunks | 0 |
| `public/` media shipped with the site | only files the pages use |

Measured in the browser suites, reported (not failing) at first, then
gated once stable: time to first frame for the 1080p fixture, seek latency,
frames dropped in 30 s of playback, memory after opening and closing 20
videos, rendering a 2,000-item playlist.

### 3.10 Delivery

```
PR ──► test.yml (quality, types, audit, size, suites) ──► required to merge
         └─► preview deploy of the PR (decision §9)
merge to main ──► test.yml again ──► build-deploy.yml (only if tests passed)
         └─► release branch ──► Pages ──► post-deploy smoke on the live URL
tag vX.Y.Z ──► version stamped into web + desktop ──► tests ──► desktop builds,
         checksums, GitHub release with changelog
```

- `main` protected: PR required, `test` required, no force-push.
- `npm ci` everywhere; actions pinned to SHAs; Dependabot weekly.
- One version, from the tag, in `package.json`, `desktop/package.json`,
  `version.json` and the diagnostics view. `CHANGELOG.md` generated from the
  `feat:` / `fix:` commit subjects already in use.
- Rollback: revert the merge on `main`; the deploy publishes the previous
  build. Written down in `docs/runbooks/release.md`.

### 3.11 Documentation

- `README.md`: what the app does (accurately), how to run, test and build,
  where the architecture is described.
- `ARCHITECTURE.md` (this plan's §3–§4 once done): layers, modules, public
  APIs, data flow for "open a file", "apply an edit", "export".
- `adr/NNNN-title.md`: one record per significant decision — context,
  decision, consequences. Written for the existing big decisions first
  (phase T2), then for every new one.
- `CONTRIBUTING.md` (setup, the PR checklist, the device checklist),
  `SECURITY.md`, `docs/runbooks/` (release and rollback, triaging a bug
  report with diagnostics).
- JSDoc on every public API in §4; `@ts-check` makes it checked.

---

## 4. Public APIs

### 4.1 `CorePlayer`

| Area | Members |
|---|---|
| Lifecycle | `load(url, options)`, `reset()`, `destroy()`, `setLoading(on)` (the playlist shows the spinner while it fetches a file), `resetUI()` (blank picture and bar before the next item), `playNow()` (go on while it waits for data on a slow link; short waits until the next seek or load) |
| Transport | `play()`, `pause()`, `togglePlay()`, `seek(t)` (resolves once shown), `requestSeek(t)` (a burst of seeks: the position moves at once, the decode goes to the latest), `stepFrame(dir)`, `setPlaybackRate(r)`, `toggleDirection()` |
| State (read-only) | `currentTime`, `duration`, `playbackRate`, `isPlaying`, `isLoading`, `isLive`, `isStreamMode`, `isWebcamMode`, `canvas`, `engine`, `capabilities` (`canvasFrames`, `audioGraph`: false while YouTube plays) |
| Source (read-only) | `input`, `videoTrack`, `videoSink`, `audioTrack`, `audioSink` (the loaded file, from `player.media`), `streamVideo` (the live or camera element) |
| Audio | `volume`, `setVolume(v, { bezel })`, `isMuted`, `toggleMute()`, `restoreAutoplayAudio()`, `tapAudio()` (planned: the recorder's audio tap, now in RecordMenu) |
| Loop | `loopMode`, `loopStart`, `loopEnd`, `setLoop(mode, start, end)`, `setLoopStart()`, `setLoopEnd()`, `clearLoopMarkers()`, `resetLoop()` (the A-B keys and buttons, at the current position) |
| Overrides | `override(values) → release` (§3.4) |
| Frames | `addRenderCallback(cb)`, `removeRenderCallback(cb)`, `presentFrame(source, options)` (the one way a frame reaches the canvas), `overlayTimeMs()` (the clock animated overlays run on), `redraw({ overlaysChanged })` (repaint when paused; `overlaysChanged` first re-decides baking the colour effects) |
| Streams | `loadWebcamStream()`, `startCanvasRecording()`, `stopCanvasRecording()`, `stopWebcamStreamMode()` |
| Tracks | `loadSubtitle()`, `generateSubtitles()`, `switchAudioTrack()`, `switchSubtitleTrack()` |
| Wiring | `on(event, fn)`, `off(event, fn)`, `trigger(event, data)` (fires one; the core's parts use it), `setNavigationCallbacks()`, `setPlayCallback()` |
| Control bar | `controlBarMode`, `toggleControlBarMode()` |
| Layers | `videoFilters`, `stickers`, `decorations`, `subtitles` |

Events: `play`, `pause`, `directionchange`, `timeupdate`, `durationchange`, `loadingchange`,
`volumechange`, `ratechange`, `loopmodechange`, `ended`, `trackschange`,
`streamstatechange`, `controlbarmodechange`, `filterschange`, `reversefailed`,
`bufferwaitchange` (`{waiting, secondsLeft}`: a wait sized to a slow link, `secondsLeft` null otherwise),
`bufferchange` (`{ranges}`: the parts of a remote file downloaded, as `[start, end)` seconds; empty for anything else).

### 4.2 `Playlist`

The class is `ui/player/Playlist.js` plus its parts (`PlaylistIngest`,
`PlaylistPlayback`, `PlaylistMetadata`, `PlaylistStore`,
`PlaylistDiscovery`), whose methods are the playlist's own.
`scripts/playlist-api-test.mjs` holds this table to the code.

| Area | Members |
|---|---|
| Items | `items`, `activeIndex`, `addItems(items, autoplay)`, `addItem(item)`, `insertProcessedItem(source, blob, name, options)`, `removeItem(i)`, `removeFolder(path)`, `clear(askConfirm)`, `activeItem` (planned) |
| View state | `searchQuery`, `isLoading`, `expandedFolders` |
| Playing | `selectItem(i, autoplay)`, `playNext()`, `playPrevious()` |
| Adding | `handleFiles(files)`, `handleElectronFiles(files)`, `handleUrlUpload(url, onFirstItems)`, `addLinkListItems(file)`, `ingest` (planned: `ingest.files`, `.url`, `.youtube`, `.m3u`, `.linkList` in place of the handlers) |
| Discovered media | `addDiscoveredItems(files)`, `keepDiscoveredItem(id)`, `discoveredFolderName`, `cancelMediaScan()` |
| Data | `ensureMetadata(item)`, `processMetadata(items)`, `markItemBroken(id, error)`, `save()`, `getSource(item)` (planned: wraps `MediaMetadata.getSourceBlob`) |
| UI | `render()`, `scrollToPlaying()`, `setRecordingState(on)`, `destroy()`, `showToast(text)` (planned) |
| Wiring | `player`, `container`, `nameProcessedItem` (a hook the edit panel sets) |

Events, on `window`: `jellyjump:item-selected` (`ITEM_SELECTED_EVENT`,
`{ index, item }`), `jellyjump:processed-item` (`PROCESSED_ITEM_EVENT`,
`{ item, url }`); `itemadded` and `itemremoved` are planned.

### 4.3 Jobs

Every tool that makes a file uses `runMenuJob({ background: true, … })` and
adds its result with `playlist.insertProcessedItem`. Nothing else adds
processed items.

---

## 5. Phases

Each step is one PR off `main`, with no behaviour change unless it says it
fixes a bug, and with `npm test` passing. Size: S (under a day of review),
M, L.

### Phase A — Bugs and hygiene (S each, any order)

| Step | Work | Files | Done when |
|---|---|---|---|
| A1 | BUG-1: Tracks columns | `playlist-templates.html` | Tracks shows codec and details in their columns; add a check to `edit-panel-test` |
| A2 | BUG-2: Scenes/Motion cancel | `CutDetectionMenu.js`, `MotionDetectionMenu.js` | leaving the tool mid-detection renders nothing; test |
| A3 | BUG-7: GIF preview in the panel | `playlist-templates.html`, `GifMenu.js` | the made GIF shows in the panel |
| A4 | BUG-8: A-B loop visibility | `player.css` | loop range visible over the played bar (screenshot check) |
| A5 | Docs: update `code-of-conduct.md` (Vite and Playwright allowed; inline styles allowed for coordinates and sizes), rewrite `assets/js/STRUCTURE.md` to §3, move this plan to the place the team keeps plans | docs | docs match the code |
| A6 | Repo: decide on `remotion_test5/` and root strays (§9) and remove or move them | — | only source, tests and docs at the root |
| A7 | Confirm BUG-6 on desktop; if real, keep edited copies in memory on desktop until G3 | `DesktopStorageService.js`, `Playlist.js` | an edited copy still plays after switching away and back, on desktop |

### Phase B — Guard rails (S)

| Step | Work | Done when |
|---|---|---|
| B1 | Quality check: fail on a wrong-way import (§3.1 rule 1), with today's offenders in an allow-list that may only shrink | `npm run quality` prints the allow-list size |
| B2 | Quality check: count outside calls to `player._*` / `playlist._*` and `localStorage` users; print them; fail if a count goes up | counts printed in CI |
| B3 | Unit test for the playback clock (`getPlayerPlaybackTime`) with a fake audio context; seek, pause, rate | `playback-clock-test` in `npm test` |
| B4 | Storage round-trip test: save a playlist with files, reload, read a file back, remove an item | `storage-test` in `npm test` |

### Phase C — Layering moves (S–M, mechanical)

| Step | Work | Done when |
|---|---|---|
| C1 | Move `MediaBunny.js`, `OverlayCompositor.js`, `SubtitleConverter.js` to `shared/media/`; stubs at old paths | `processing → core`, `processing → ui`, `shared → core` (MediaBunny) gone from the allow-list |
| C2 | Move `MediaProcessor.js` to `processing/`; cut `MediaMetadata`'s import of it | `core → processing` only `ReversePlayback`'s helpers, which move to `shared/media/` |
| C3 | Move `Cancellation.js` to `shared/utils/` | `shared → processing` gone |
| C4 | Move `ElectronHelper` to `shared/platform/Platform.js`; route the six files' direct `window.electronAPI` checks through it | rule 5 passes |
| C5 | Delete the stubs | no import of an old path |

### Phase D — Settings and overrides (M)

| Step | Work | Done when |
|---|---|---|
| D1 | `shared/settings/Settings.js`: get/set/subscribe, `jj:` prefix, migration from the old keys on first load | old keys read once and moved; one module writes preferences |
| D2 | `CorePlayer.override(values) → release`, stacked; speed, filters, control bar mode, loop, preview transform | unit test: override, stack, release in any order restores exactly |
| D3 | Edit panel, `borrowMainPlayer`, `lendPicture`, Rotate, Export FX use overrides; delete their workarounds | `EditPanel._quietPlayer` / `_restorePlayer` gone; `edit-panel-test` unchanged and passing |

### Phase E — Playlist split (M, five PRs)

| Step | Work | Done when |
|---|---|---|
| E1 | Public names for what others call (`save`, `ensureMetadata`, `processMetadata`, `showToast`, `handleUrlUpload`); old names as aliases; move the 50 outside calls | no outside `playlist._*` call |
| E2 | `PlaylistStore` out (save/restore, load guard, progress) | moved methods gone from `Playlist.js` |
| E3 | `PlaylistMetadata` out | ditto |
| E4 | `PlaylistIngest` and `PlaylistDiscovery` out; unit tests for URL / M3U / link-list → items | ditto; `ingest-test` |
| E5 | `PlaylistPlayback` out; `ITEM_SELECTED_EVENT` moves to the playlist | `Playlist.js` under 500 lines |

Watch the order of `render()` and `_saveState()` calls inside moved methods;
some flows depend on it.

How it was done: each part is a set of `Playlist` methods in its own file,
added to `Playlist.prototype`, so `this` and the order of calls are exactly
as before and the move is a pure cut and paste. The parts still share the
playlist's fields; giving each part its own state (and moving the logic to
an `app/` layer with no DOM) is a later step, when there is a reason to
change one of them.

### Phase F — Tools behave the same (M)

| Step | Work | Done when |
|---|---|---|
| F1 | BUG-3: Scenes, Motion "add clip" through `runMenuJob` and `insertProcessedItem` | clips appear in the tray, can be cancelled, and open in the edit panel |
| F2 | ~~Optimize through `runMenuJob`~~ Not done, on purpose: Optimize is a gate that runs before a file enters the playlist on a phone (a 4K file can get the page killed), so the file cannot be added first and converted after (an empty playlist plays what is added), and it cannot wait behind other jobs in the one-at-a-time queue (adding files would stall). It has its own Cancel. | — |
| F3 | App-wide tools (Merge, Slideshow, Combine A/V) stay dialogs (decision 4); their results go through `insertProcessedItem` | one way to add a processed item |
| F4 | Templates: split `playlist-templates.html` per tool (one `<template>` file per tool, loaded with the tool); delete markup the panel hides | no hidden player markup in tool templates |
| F5 | CSS: move tool styles out of `player.css` into `tools.css` | `player.css` holds only the player |

### Phase G — Storage lifecycle (M)

| Step | Work | Done when |
|---|---|---|
| G1 | Delete an item's stored file when it leaves the playlist for good (remove, clear, folder remove), except files still referenced by the edit history | BUG-4 fixed; `storage-test` checks it |
| G2 | One-time sweep on load: delete stored files whose id is in no playlist item and no edit history | IndexedDB size drops after a reload |
| G3 | `jellyjump-state-*` → one `jj:progress` map with a size cap (last 200 videos), via Settings | BUG-5 fixed |
| G4 | Desktop: store processed copies on disk (app data folder) with a `localPath`, so they survive release and restart | BUG-6 fixed for good; Undo history can persist on desktop too |
| G5 | Quota handling: when IndexedDB refuses a file, tell the user once and keep it in memory | no silent loss |

### Phase H — Player UI attached, events out (M–L)

| Step | Work | Done when |
|---|---|---|
| H1 | Add the events in §4.1; fire them where the UI calls are today (both, during the move) | events covered by a unit test |
| H2 | UI modules subscribe instead of being called: play/pause, progress, time, volume, loading, filters button, loop UI, auto-hide | the matching `_update*` calls gone from `core/` |
| H3 | `createPlayer()` in `ui/player/`; both roots use it; `Player.js` stops importing UI | `core → ui` allow-list empty |
| H4 | Delete the one-line pass-throughs whose callers have moved | `Player.js` under 600 lines |

### Phase I — Player public API (S per file, many)

| Step | Work | Done when |
|---|---|---|
| I1 | Move outside callers to §4.1, folder by folder (`ui/player`, `ui/menus`, `core/streaming`, layers) | B2's `player._*` count reaches 0 |
| I2 | Test that lists `CorePlayer`'s public members against §4.1 | adding a member needs a doc change |

### Phase J — Player internals (L each; one at a time, when next fixing a bug there)

| Step | Work | Done when | Device check |
|---|---|---|---|
| J1 | `AudioSession` class from `AudioEngine.js`; owns the audio fields; `tapAudio()` for recorders and the visualizer | no `audioContext` / `gainNode` / `mixNode` read outside `core/audio` | iPhone: play, seek playing and paused, switch video, unmute after autoplay |
| J2 | `PlaybackSession` from `PlaybackState` + `PlaybackTransport` + anchor + epoch; clock injected from `AudioSession` | `epoch`, `vodAnchor`, `playbackTimeAtStart` only in `core/playback` | iPhone + Android: scrub, seek during play, frame step, reverse, A-B loop, Cut loop, Multi-Cut skip, rate |
| J3 | `MediaPipeline` from `MediaLifecycle` + `RenderLoop` + frame queue + tracks | tracks and sinks not read outside `core/playback` | load, fast switching, HLS, HEVC / AC-3 file, 4K on a phone |
| J4 | `YouTubeBackend` behind the transport; `capabilities` replaces `engine === 'youtube'` checks | no `engine === 'youtube'` outside the backend | YouTube on a phone: autoplay, unmute, second video |

### Phase K — Testing (M)

| Step | Work | Done when |
|---|---|---|
| K1 | A `processing-test` suite in the browser runner: trim, speed, reverse, merge, slideshow, combine, track extraction, GIF, HLS export on the fixtures; checks duration, size, tracks | every `MediaProcessor` operation has a test |
| K2 | Worker vs main-thread: the same operation both ways gives the same output | fallback path covered |
| K3 | Coverage: V8 coverage for the Node suites and Playwright's JS coverage for the browser suites, merged into one report per CI run; record the baseline | coverage printed in CI; PRs may not lower it by more than 1 point |
| K4 | A device checklist in the PR template, required for PRs touching `core/playback`, `core/audio`, `PlaylistPlayback` or storage | template in `.github/` |
| K5 | Flake policy: a browser suite that fails is retried once and reported as flaky; a suite flaky twice in a week is fixed before new work | `run-tests.mjs` reports retries |

### Phase L — Types and code quality (S per folder)

| Step | Work | Done when |
|---|---|---|
| L1 | `@ts-check` on every file touched by phases C–J as it is touched | — |
| L2 | `@ts-check` on `shared/` and `app/` entirely | 0 errors |
| L3 | Typedefs for the playlist item, job and settings shapes in one `types.js` | items typed across playlist, jobs, edit panel |
| L4 | ESLint with a small rule set (`eqeqeq`, `no-empty` with comment allowed, `no-alert`, `no-unused-vars`, `no-restricted-syntax` for `innerHTML` with `${…}`, import boundaries from §3.1) run by `npm run quality`; the custom checks that overlap move into it | `npm run quality` runs ESLint; 0 errors |
| L5 | `strict: true` for `shared/` and `app/` once they are fully checked | 0 errors under strict |

### Phase M — Large UI files (opportunistic)

`ScreenRecorderMenu` (831), `InfoMenu` (643), `BoxEditorUtils` (627),
`WatermarkMenu` (513), `PlaylistRenderer` (911): split when next changed,
by the same rule — state with its owner, DOM in the UI.


### Phase N — Errors and resilience (M)

| Step | Work | Files | Done when |
|---|---|---|---|
| N1 | `AppError` and the codes (§3.5); `runMenuJob` and the job queue keep `code` and `userMessage` | `shared/errors/` | unit test: every code has a user message |
| N2 | `ErrorReporter`: global `error` / `unhandledrejection`, one rate-limited toast with "Copy details", entry in the diagnostics log | `shared/errors/`, both page roots | throwing in a click handler shows the toast and is in the log (test) |
| N3 | Replace the 5 `alert()` calls with the tool's inline message or `ConfirmDialog`; give each of the 17 empty `catch` blocks a reason or a report | Tracks, Merge, screen recorder, others | quality check bans `alert(` and bare empty catches |
| N4 | Replace message matching (`includes('No source available')`) with codes: `MediaMetadata.getSourceBlob`, storage, worker client, decoders throw `AppError` | `shared/media/`, `processing/worker/` | no `.message.includes(` checks left |
| N5 | `fetchWithPolicy`: timeout, retries with backoff for GETs, offline / CORS / HTTP codes; used by remote libraries, M3U, link lists, YouTube info, model downloads | `shared/net/` | `source-failure-test` extended: timeout, offline, CORS |
| N6 | Storage full: catch quota errors from IndexedDB, tell the user once, keep the file in memory (with G5) | `shared/storage/` | `storage-test`: simulated quota error keeps the item playable |
| N7 | Error copy guide: what a message says (what happened, what to do), one per code, in `shared/errors/codes.js` | — | every user-facing message comes from the guide |

### Phase O — Security (S–M)

| Step | Work | Done when |
|---|---|---|
| O1 | BUG-9: `html` tagged template that escapes; use it for every `innerHTML` with values (subtitle track names, Optimize title, embed error, Scenes/Motion/Tracks errors, microphone labels, the rest found by the rule) | a test inserts `<img src=x>` as a title, a track name and an M3U entry and finds it shown as text |
| O2 | Quality rule (ESLint, L4): `innerHTML` / `insertAdjacentHTML` with `${…}` only through `html` | rule on, 0 violations |
| O3 | One CSP from `services.js` (§3.8), written into all four pages at build time; document each allowed source | the four pages' CSPs are generated from one module (the watch page keeps a tighter one on purpose) |
| O4 | Dependencies: resolve the 4 high issues (check whether `@huggingface/transformers`' Node-only dependencies are used at all; drop or override them); `npm audit --omit=dev --audit-level=high` in CI for web and desktop; Dependabot for npm and actions | audit clean in CI |
| O5 | Desktop `read-file`: allow only granted roots (picked files, library folders, dropped files); media extension alone no longer enough | IPC test: a media file outside granted roots is refused |
| O6 | Share token: `Authorization` header from the web client; short-lived signed URLs for `<video src>`; tokens never logged | library-server-test covers both |
| O7 | Write the encryption design (`adr/` + `SECURITY.md` section) and add fixed test vectors to `encrypt-test` | review checklist done |
| O8 | `SECURITY.md`: reporting, threat model, data kept and where; GitHub secret scanning and push protection on | file exists; settings on |

### Phase P — Observability (M)

| Step | Work | Done when |
|---|---|---|
| P1 | `Logger`: structured entries and a ring buffer of 1,000, always on; console only in debug | unit test: buffer keeps the last 1,000, drops the oldest |
| P2 | Trace ids: one per playback load (from `PlaybackEpoch`) and per job; carried by every log entry and `AppError` made during it | a job's log entries and its error share one id (test) |
| P3 | Metrics with `performance.mark`/`measure`: page ready, time to first frame, seek latency, dropped frames, job duration and fps, storage use | values visible in diagnostics; browser suite reads them |
| P4 | Diagnostics view (Info → Diagnostics, or `?debug=1`) with "Copy": version, build, browser, codecs, storage, recent errors, jobs, metrics — no file names or URLs | `edit-panel-test` or a new suite opens it and copies |
| P5 | Desktop library server `GET /health` (status, version; no token) | library-server-test covers it |
| P6 | `version.json` at build; the app checks it on focus and offers a reload when a new version is live (alongside `reload-on-stale-chunks`) | test with two builds |
| P7 | Not now (decision 6). If revisited: opt-in anonymous error counts by code and browser, off by default | — |

### Phase Q — Performance (M)

| Step | Work | Done when |
|---|---|---|
| Q1 | `scripts/size-report.mjs`: sizes of every chunk (raw, gzip), duplicates, against the budgets in §3.9 and against `main`; run in CI | report on every PR; fails on a breach |
| Q2 | BUG-13: one copy of MediaBunny and the encoders shared by the worker and the page (Vite worker format / shared chunk), or load the encoders only in the worker. **Moved to wave 4** (measured in wave 2): the page needs its own copies (it records, exports HLS, encrypts and extracts tracks), each copy loads only when used and is cached after, so the cost is ~540 KB once per browser, on the first edit job. Vite builds the worker on its own, so sharing one file means the worker loading the page's MediaBunny at run time through a generated module re-exporting its names: a fragile build change on the path every edit takes, for a one-time saving. `size-report` holds the count at 7 meanwhile | duplicate count 0 |
| Q3 | Ship less: drop unused `public/` videos (`homepage_old.mp4`, the ad videos if no page uses them); keep publishing source maps (decision 8); confirm Whisper's 23 MB runtime loads only for subtitle generation | `dist/` size in the report goes down |
| Q4 | Offline (decision 7, wave 4): cache the app shell and decoders in the service worker so the player opens offline after a first visit, with the version check (P6) so nobody is stuck on an old copy | the player opens and plays a local file with the network off |
| Q5 | Runtime benchmarks in a browser suite: time to first frame, seek latency, dropped frames, memory after 20 loads, 2,000-item playlist render; reported per run | numbers in CI output; budgets set from the baseline |
| Q6 | Fix what Q5 finds first: likely candidates are the playlist rendering every row on change (`PlaylistRenderer`, 911 lines) and allocation in the render loop | budget met |

### Phase R — Configuration (S)

| Step | Work | Done when |
|---|---|---|
| R1 | `shared/config/index.js` over `import.meta.env`; `.env.example`, `.env.production`; `DOMAIN` and `BASE_URL` move in | nothing else reads hostnames |
| R2 | Sample-video logic in `player-main.js` uses `SAMPLE_VIDEO_URL` and a first-run flag instead of four hostname checks | hostnames gone from page roots |
| R3 | `shared/config/services.js`: YouTube, Hugging Face, iptv-org, webcammictest, i.ytimg; code reads URLs from it | grep finds external URLs only there |
| R4 | `isEnabled(flag)` and the flags in config; first flags: diagnostics view, opt-in telemetry, offline cache | flags documented in `.env.example` |
| R5 | Remove `?v=2` cache-busters; templates get the build version or are bundled | no hand-written versions |

### Phase S — CI/CD (S)

| Step | Work | Done when |
|---|---|---|
| S1 | Protect `main`: PR required, `test` check required, no force-push, linear history optional (owner action, §9) | a PR cannot merge with a red check |
| S2 | BUG-10: deploy only after tests pass on the same commit (`workflow_run` on `test`, or one workflow with `needs: test`) | a failing test on `main` stops the deploy |
| S3 | `npm ci` in every workflow; actions pinned to SHAs; Dependabot (O4) keeps them current | workflows reproducible |
| S4 | Desktop release runs the quick and browser suites before building; publishes SHA-256 checksums with the artifacts | release job has a test step |
| S5 | BUG-11: version from the tag stamped into `package.json`, `desktop/package.json` and `version.json`; `CHANGELOG.md` from commit subjects at release | diagnostics shows the same version as the release |
| S6 | Preview deploys for PRs (decision 9): build each PR into `previews/<pr>/` on the Pages branch, comment the link on the PR, delete it when the PR closes; check the service worker works under a sub-path | every PR has a link to try it on a phone |
| S7 | Post-deploy smoke: after Pages publishes, a short Playwright run against the live URL (boot, open the sample, seek) | deploy job fails loudly when the live site is broken |
| S8 | Runbook `docs/runbooks/release.md`: release, rollback (revert + redeploy), hotfix | written and tried once |

### Phase T — Documentation (S)

| Step | Work | Done when |
|---|---|---|
| T1 | `README.md` rewritten: accurate features, requirements (Node 22, Chromium for tests), scripts, layout, links | a new contributor can run and test the app from it |
| T2 | ADRs for the existing decisions: 0001 vanilla JS with Vite; 0002 MediaBunny/WebCodecs instead of `<video>`; 0003 the audio clock as master; 0004 COOP/COEP through a service worker; 0005 IndexedDB for files and their lifecycle; 0006 one job at a time; 0007 the edit panel and stacked edits; 0008 layering rules; 0009 settings and overrides; 0010 no telemetry by default; 0011 the encryption format | eleven records |
| T3 | `ARCHITECTURE.md` from §3–§4 as they land, with data-flow diagrams for open, edit, export | updated in the PR that changes the structure |
| T4 | `CONTRIBUTING.md` (setup, PR checklist, device checklist, commit style), PR template (K4) | in repo |
| T5 | Runbook for bug reports: ask for Diagnostics → Copy, read the trace, reproduce | in `docs/runbooks/` |
| T6 | Every public API in §4 has JSDoc; the API listing test (I2) points at it | `@ts-check` on the API files |

### Phase U — Remote playback buffer (M each; one PR per step, each with a device check)

**Why.** A file from a shared library or a URL is read by MediaBunny's
`UrlSource`: open-ended range requests with an 8–16 MB read-ahead kept in
memory. On a link slower than the video (measured: 0.3–0.55 MB/s against the
0.84 MB/s a 1080p film needs) nothing is kept: a pause downloads nothing, a
seek back fetches again, the read of the old position runs on after a seek
(it cannot be aborted without rebuilding the reader), and every wait is a
short one (BufferingGuard, 1–4 s). Separately, a plain URL item is also
downloaded whole by `MediaMetadata.cacheInBackground`, in memory, beside the
playback and over the same link, and kept only if it is under 500 MB.

**What it becomes.** One reader for every remote file, the same everywhere
(browser, desktop app, phone):

1. **Pieces.** The file is cut into fixed 4 MB pieces. Each piece is fetched
   with its own range request that we own, so it can be aborted cleanly, and
   kept on disk in the browser's private file storage (OPFS) per file:
   `jj-buffer/<file key>/<piece index>`. Writes go through one small worker
   (`createSyncAccessHandle`, which every current browser has, Safari
   included); a finished piece is never written again, so the page reads it
   directly (`getFile().slice()`).
2. **The player reads pieces** through MediaBunny's `CustomSource`
   (`getSize`, `read(start, end)`): from disk when the piece is there,
   otherwise it joins that piece's download and is streamed the bytes as
   they arrive (`read` may return a `ReadableStream`), so a large piece adds
   no delay.
3. **A downloader** keeps fetching, one piece at a time, in order, ahead of
   where the player reads: playing and paused. Where it reads is taken from
   the reads themselves (the last offset the demuxer asked for), not from a
   time→byte guess, so it works for any container and follows a seek on its
   own. A piece someone is waiting for goes first; a fetch for a piece that
   the jump left behind is aborted; the pieces with the file's index (read at
   load and on every seek) are kept for as long as the file is.
4. **A window, not the whole file.** Kept: up to `ahead` (default 20 min of
   the video, from its average bitrate) ahead of the read position and
   `behind` (5 min) behind it; the rest is deleted as playback moves. All
   files together stay under a budget (default 2 GB, or 10% of what
   `navigator.storage.estimate()` reports free, whichever is smaller);
   over it, the least recently played file's pieces go first.
5. **A file that got complete** (watched through, or paused long enough)
   plays from its pieces as a local file (`BlobSource` over the pieces
   joined into one `Blob`, which copies nothing), so it gets seek-bar
   thumbnails and plays without the network. This replaces
   `cacheInBackground` for URLs: no second download.
6. **Stale data is impossible.** A file's key is its identity on the server
   (library: server + id; URL: the URL without `sig`/`token`) plus its size
   and validator. The library server sends `ETag` (from size and mtime) and
   exposes it; every piece response is checked against the stored one, and
   a mismatch drops the file's pieces and starts over.
7. **Where it does not apply** (the player keeps today's path, unchanged):
   HLS, live, YouTube, local files and blobs, and a server that answers a
   range request with 200 (no ranges). Without usable storage (private
   window, OPFS refused, quota under 200 MB) the same store runs on a memory
   backend with a 256 MB budget: one code path, two backends, not two
   features.

**Smart wait (#1).** BufferingGuard keeps deciding *when* to wait (audio or
frames running out), but *how long* comes from the store: it measures the
link (bytes per second over the last 10 s of fetching) and the video's
bitrate around the read position (bytes per second of media), and resumes
when the bytes downloaded ahead cover the next 10 minutes (or the rest of
the file, if shorter) without another stop: on a link faster than the video
that is the 1 s it is today; on a slower one, `(bitrate − link) × horizon`.
The spinner shows the time left ("Buffering… 1:20"), recomputed as the link
changes, with **Play now** to go on anyway. Without the store (HLS, fallback)
it is today's 1–4 s.

**Seek bar.** The pieces on disk are drawn as a shaded range behind the
progress, mapped bytes → time by the average bitrate and drawn a little
short at each end, so a shaded part never promises what is not there.

**Cases it handles** (each one is a check in the step's test, or in its
device check where a browser cannot fake it):

*Switching and the playlist*
- **Switching files.** Loading another file stops the old file's downloader
  and aborts its fetch (the piece half-fetched is dropped); its finished
  pieces stay, so going back plays what was downloaded at once. Only the
  file playing downloads; the store is per file, the downloader per player.
- **Fast switching** (A → B → C in a second): each load cancels the one
  before, as `cleanupPlayerForLoad` does today; no fetch of A or B outlives
  the switch.
- **Removing an item, clearing the playlist, the app's reset** drop the
  pieces of those files.
- **Metadata of other items** (duration, size for the list) reads the same
  store at low priority, a few small reads; it never moves the downloader.
- **The next item.** Not fetched ahead in U1–U5; once the current file's
  window is full, starting the next item's first minute is a small later
  step on the same store.

*Seeking and moving around*
- **Seek forward or back past the window**: fetches outside the new window
  are aborted; the downloader starts at the new read position.
- **Scrubbing** (dragging the bar): the read position counts as moved only
  once reads settle (300 ms), so a drag does not start and abort a fetch per
  step; `requestSeek` already coalesces the seeks themselves.
- **Index at the end of the file** (MP4 not "faststart", MKV cues): those
  pieces are read on load and on every seek and are kept with the file.
- **Reverse play, frame stepping backwards, A-B loop, Cut loop**: reads go
  backwards or repeat; the downloader follows the reads' direction, and
  `behind` covers a loop smaller than it.
- **Near the end**: the window stops at the end of the file.

*Network*
- **The link drops mid-play**: what is downloaded plays; a missing piece is
  retried with the backoff remote files use today, the spinner shows, and
  after the last attempt the player reports the error as it does now. When
  the page comes back online (`online` event, or the tab coming to the front)
  the downloader starts again by itself.
- **Laptop asleep, phone locked, tab in the background**: fetches fail or
  pause; on wake they are retried, and a half-fetched piece is fetched again.
- **The share token changes** (the server restarted): stream URLs change but
  the key does not (it leaves out `sig` and `token`), so the pieces stay.
- **The file changed on the server**: a different `ETag` or size drops its
  pieces. A plain URL whose server sends neither `ETag` nor `Last-Modified`
  keeps its pieces for the session only, never across reloads.
- **A URL with other query parameters** (a signed CDN link): its key is the
  whole URL; an expired one is simply a new file, and the old pieces leave
  by the budget.
- **A server that ignores ranges, gives no size, or refuses CORS for
  ranges**: today's path, unchanged.

*Storage*
- **Storage full mid-download**: the least recently played files' pieces
  go, then it tries again; still full, the file goes on in the memory
  backend.
- **The browser clears storage** (pressure, the user clearing site data):
  a piece that is gone is fetched again; nothing trusts a list it kept.
- **A crash or a closed tab mid-write**: a piece counts only once written
  whole (its size is checked when read); a short one is fetched again.
- **Two tabs playing the same file**: one tab owns the file's pieces (Web
  Locks, `navigator.locks`); the other reads what is there and fetches the
  rest into memory, never writing the same piece.
- **Previews share the site's origin** (S6), so OPFS too: the folder is
  namespaced like the database (`jj-buffer-pr-N`).
- **Private window, OPFS refused, tiny quota**: the memory backend (256 MB).
- **A file larger than the budget** (a 50 GB 4K file): the window is the
  smaller of its minutes and its share of the budget, so it never asks for
  more than the budget.

*How it is used*
- **Paused for hours**: it fills the window and stops; it does not download
  the whole film unasked.
- **Phone data**: on a metered connection (`navigator.connection.saveData`,
  or a cellular `type` where the browser tells) the window ahead is 2
  minutes and nothing is fetched while paused; Settings can change both.
- **Playback speed**: at 2× the video needs twice the bytes per second; the
  smart wait counts it.
- **Tools on a remote item** (convert, trim, GIF, …): `getSourceBlob` reads
  the whole file through the store (the pieces already there are not fetched
  again); the job's file may go over the budget while it runs and is let go
  after.
- **Encrypted files, local files, the desktop app's own library**: not
  remote reads, so unaffected. The desktop app playing another machine's
  library is a remote file and uses the store like the browser.
- **Watch party**: each viewer loads the file as a remote one and buffers on
  their own side; the host's seeks reach them as seeks.

| Step | Work | Done when | Device check |
|---|---|---|---|
| U1 | `shared/media/buffer/PieceStore.js` (pieces, window, budget, least-recently-played eviction, file key and validator) with an OPFS backend in `PieceStoreWorker.js` and a memory backend; library server sends `ETag` and exposes it; ADR 0013 | `piece-store-test` (Node, memory backend + a fake fetch): window, budget, eviction order, validator mismatch, a piece fetched once for two readers, abort on jump; `library-server-test` checks `ETag`. Nothing uses it yet | — |
| U2 | `RemotePlayback` (`CustomSource` over the store, exact reads) and the `Downloader` (follows the reads, fetches ahead playing or paused, aborts on a jump, keeps the file within its share of the budget); `MediaLifecycle` uses it for remote files that answer ranges, `InputFactory` reads the file playing from it (bytes fetched once); the whole-file `cacheInBackground` is gone; removing an item drops its pieces; the window in `Settings` (`buffer`) | `stream-buffer-test` (browser, a server the test controls): plays a remote file through; downloads while paused; after a seek the old fetch is aborted (the server sees the connection close); a seek back into downloaded bytes makes no request; a reload plays with the server gone; a 200-only server and a memory-only store still play; `stall-test` and `bench-test` unchanged | play a library file over Tailscale from another network: play, pause, seek forward and back, switch files |
| U3 | A complete file played as local (thumbnails, offline); tools (`getSourceBlob`) read through the store instead of downloading again; phone data (metered: 2 min ahead, nothing while paused); Settings → Playback → **Buffer**: window, budget and "clear" | the test: budget over → the oldest file's pieces go; a complete file plays with the network off and gets thumbnails; a tool on a remote item reuses the kept pieces; metered → small window | pause 5 min, then play: no spinner for what downloaded; close and reopen the tab |
| U4 | Shaded downloaded range on the seek bar (`bufferchange` event from the player, drawn by `PlayerUIListeners`) | test: shaded ranges match the store, never past it; no shading for local files | looks right on a phone |
| U5 | Smart wait: rate and bitrate from the store, resume target, "Buffering… m:ss" with **Play now** | test: on a link at 60% of the bitrate the whole fixture plays after one wait; with the link at full speed, waits are as short as today; Play now resumes at once | on the slow link, one wait then smooth play; Play now works |

Later, on top of the same store: **Download** (keep every piece, ask
`navigator.storage.persist()`, show progress in the job tray), and
seek-bar thumbnails for the downloaded parts only. Stopping the old read
after a seek (noted under J3) is done by U2 for remote files.

---

## 6. Order

The phases are grouped into five waves. Inside a wave, steps can run in
parallel; a wave starts when the one before it is done, except where noted.

| Wave | Goal | Steps | Why first |
|---|---|---|---|
| **0. Safety net** | nothing broken can ship; known bugs gone | S1, S2, S3, O1, O4, A1–A4, B1–B4 | protects every later PR; BUG-9 and BUG-10 are the riskiest findings |
| **1. Foundations** | rules and tools the rest builds on | C1–C5, R1–R5, N1–N3, P1–P2, L4, T1, T2, A5–A7 | layering, config, errors and logging are used by every later step |
| **2. App structure** | settings, playlist, tools and storage done properly | D1–D3, E1–E5, F1–F5, G1–G5, N4–N7, O2, O3, O5, O6, Q1–Q3, K1–K3 | the biggest files and the edit-panel workarounds; storage needs B4's test |
| **3. Player surface** | the player is used only through its API | H1–H4, I1–I2, P3–P6, Q5–Q6, S4–S8, T3–T6, O7, O8, K4, K5 | needs D (overrides) and E (playlist) in place |
| **4. Ongoing** | the risky internals and long tails | J1–J4 (each with a device check, when a bug there is next fixed), M, L1–L3, L5, Q2, Q4, P7, U1–U5 | high risk or low urgency |

```
Wave 0 ──► Wave 1 ──► Wave 2 ──► Wave 3 ──► Wave 4 (ongoing)
                         │
                         └─ K, L1 run alongside from wave 1 on
```

About 100 steps; most are small PRs. Waves 0–3 bring the app to the
criteria in §10, except where §10 says a criterion depends on wave 4.

---

## 7. Testing

**Layers of tests**

| Layer | What | Where | Runs |
|---|---|---|---|
| Unit (Node) | pure logic: parsers, clock, settings and overrides, errors, storage with a fake IndexedDB, ingest, the html template | `scripts/*-test.mjs` (quick list) | every PR |
| Browser (headless Chromium) | the app as built: smoke, edit panel, Watch Party, sources that fail, processing outputs, diagnostics, injection, benchmarks | `scripts/*-test.mjs` (browser list) | every PR |
| Desktop (Electron) | share host, IPC rules, storage on disk | `share-host-test`, new IPC test | release job and locally |
| Live | the deployed site boots and plays | post-deploy smoke (S7) | after each deploy |
| Devices (manual) | iPhone Safari and home-screen app, Android Chrome, desktop app | PR template checklist (K4) | PRs touching playback, audio, storage |

**New suites from this plan:** `playback-clock-test` (B3), `storage-test`
(B4, G1, N6), `settings-test` and override tests (D1, D2), `ingest-test`
(E4), `processing-test` (K1, K2), public-API listing (I2), `errors-test`
(N1, N2), `injection-test` (O1), IPC rules (O5), `diagnostics-test` (P1–P4),
benchmarks (Q5).

**Rules**

- Coverage is measured (K3) and may not drop by more than 1 point in a PR.
- A bug fix comes with a test that fails without it.
- Flaky suites are retried once, reported, and fixed before new work (K5).

**Device checklist** (K4) — none of this runs headless:

- iPhone, Safari and the home-screen app: autoplay muted then unmute, seek
  while playing and paused, switch video, reverse, the edit panel's Cut loop
  and Multi-Cut skip, a 4K file, the screen going off during playback.
- Android Chrome: the same, plus the camera and screen recorder.
- Desktop app: open from disk, edit, switch away and back, restart, Undo,
  share a library to another machine.

---

## 8. Risks

| Risk | Where | Mitigation |
|---|---|---|
| iOS audio silent or out of sync after a seek | J1, J2 | device checklist; move scheduling code verbatim; one step per PR |
| Playlist order or save timing changes | E | whole-method moves; `smoke-test`, `source-failure-test`, `edit-panel-test` |
| Deleting a file still needed | G1, G2 | never delete an id referenced by the playlist or an edit history; `storage-test` |
| Settings migration loses a preference | D1 | read old keys, write new ones, keep old ones one release |
| Desktop paths missed | C4, G4, O5 | desktop checklist per PR touching storage, platform or IPC |
| Tightening `read-file` breaks a desktop flow (dropped files, scans) | O5 | list every way a path reaches the renderer first; IPC test per way |
| Branch protection blocks an urgent fix | S1 | admins can bypass; the runbook (S8) says when |
| CSP generation drops a source a feature needs | O3 | `services.js` lists every source with the feature that needs it; smoke tests YouTube, HLS, remote libraries |
| Budgets fail on unrelated PRs | Q1 | start as a report; turn into a gate only after a baseline week |
| Diagnostics leak private data | P4, P7 | no file names or URLs by default; opt-in only for anything sent |
| PRs too large to review | all | one concern per PR; re-export stubs and aliases between steps |
| Scope creep | all | bug fixes and features found on the way go in their own PRs |

---

## 9. Decisions

Answers recorded 2026-11-22.

| # | Question | Decision | Affects |
|---|---|---|---|
| 1 | `remotion_test5/` (37 MB of tracked video ads) | **delete** | A6 |
| 2 | Root strays (`medibunny-llms-full.txt`, `examples/`, `use_case/`, `tests/*.html`) | **delete** | A6 |
| 3 | Where docs live — `docs/` is gitignored | **un-ignore `docs/`**; plans, ADRs and runbooks live there | A5, S8, T* |
| 4 | Merge, Slideshow, Combine A/V | **keep as dialogs** | F3 |
| 5 | Player internals (J) | **when next fixing a bug in that area**, with a reminder each time such a bug is worked on | J |
| 6 | Telemetry | **none** — nothing is sent; bug reports come through "Copy diagnostics". Opt-in counts can be revisited later | P7 (dropped for now) |
| 7 | Offline | **say it does not now** (README, wave 0); **make it work offline later** (Q4, wave 4) | A5, Q4, BUG-12 |
| 8 | Source maps on the live site | **publish** | Q3 |
| 9 | Preview deploys for PRs | **a path on the Pages branch** (`/previews/<pr>/`), removed when the PR closes | S6 |
| 10 | ESLint as a dev dependency | **yes**, and update the code of conduct | L4, A5 |
| 11 | Branch protection on `main` | **turn on** | S1 |

---

## 10. Production-readiness criteria

The plan is done when each line below can be checked. "How checked" is
something a person or CI can run, not an opinion.

| Goal | Criteria | How checked | Phases |
|---|---|---|---|
| **Defined architecture and structure** | layers and folders as §3.1–§3.2; `STRUCTURE.md` and `ARCHITECTURE.md` match the code | quality check: 0 wrong-way imports (allow-list empty); docs reviewed in the PR that changes structure | C, H, T3, A5 |
| **Modular, reusable, little duplication** | `Playlist.js` < 500 lines, `Player.js` < 350; no file over 600 lines in `app/`, `core/`, `shared/`; one way to add a processed item; one settings module; one error type | size check in the quality script; ESLint rules; grep checks for `addItem` with processed blobs, `localStorage` outside settings/storage | D, E, F, H, I, M |
| **Separation of concerns, module boundaries** | no outside `_private` calls; core imports no UI; Electron checked only in `shared/platform` | quality check counts all 0 | B2, C, E1, H, I |
| **Scalable, maintainable, extensible** | a new tool needs only a menu file, a template and a test (no edits to the player, playlist or router beyond one entry); a new player feature uses public API and events | ADR 0007 describes adding a tool; I2 API test | D, F, H, I |
| **Error handling and resilience** | every error is an `AppError` with a code; global handler on; no `alert`, no unexplained empty `catch`; network reads have timeouts and retries; storage full handled | ESLint rules; `errors-test`; `source-failure-test` (timeout, offline, CORS); `storage-test` (quota) | N, G5 |
| **Security** | no unescaped HTML; one generated CSP; audit clean (high) for web and desktop; desktop reads only granted paths; tokens not in logs; `SECURITY.md`; encryption design written | `injection-test`; CI audit; IPC test; library-server-test | O |
| **Testing and code quality** | unit, browser, desktop and live layers as §7; coverage measured and not dropping; ESLint and typecheck clean; `@ts-check` on all of `shared/`, `app/`, `core/` | CI | B, K, L |
| **Observability** | structured logs in a ring buffer; trace ids per load and job; metrics for load, seek, frames, jobs, storage; diagnostics view with Copy; `/health` on the desktop server; version check | `diagnostics-test`; library-server-test | P |
| **Performance and resources** | budgets in §3.9 met; no duplicate chunks; benchmarks reported per run with budgets; files and blob URLs released; storage swept | size report gate; Q5 numbers; `storage-test` | G, Q |
| **Central configuration** | one config module over Vite env; services list; flags; no hostnames or external URLs elsewhere | grep checks in the quality script | R |
| **CI/CD and deployment** | protected `main`; deploy only after tests; `npm ci`, pinned actions, Dependabot; one version from the tag; post-deploy smoke; release runs tests; rollback runbook | repo settings; workflow files; S7 run on each deploy | S |
| **Documentation and decisions** | README accurate; ARCHITECTURE; ADRs 0001–0011 and one per new decision; CONTRIBUTING, SECURITY, runbooks; JSDoc on public APIs | files exist and are linked from the README; I2 test | T, A5 |

**What "production-ready" will not mean here**

- It will not remove the phone browsers' own rules (autoplay, iOS audio)
  or make every codec decode; those stay handled case by case, now with
  diagnostics to see them.
- It will not add server-side metrics or tracing: the app has no server
  of its own, and it promises that nothing is uploaded. Observability is on
  the device, with an optional opt-in (decision 6).
- Phase J (player internals) is done step by step after wave 3. Until each
  J step lands, that part of the player meets the boundary criteria through
  its public API but keeps its internal shape.
