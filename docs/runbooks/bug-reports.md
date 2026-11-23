# Handling a bug report

## 1. Ask for the details

Most reports arrive as "it doesn't play" or "the cut is wrong". Ask for:

- **Info → Diagnostics → Copy** (open Info on any playlist item). It holds
  the version and build, the browser, which codecs it decodes and encodes,
  storage use, recent jobs, recent errors and the timings below. It names no
  files, folders or addresses, so it is safe to paste into a public issue.
- **"Copy details"**, if an error toast appeared: the error, its stack, and
  the last 100 log lines. Also redacted.
- What they did, what they expected, and the file's kind (container, codec,
  resolution; Info shows these for the item, and its "Copy all" copies them
  — that one does include the file name, so they may want to edit it).
- Phone or computer; for iPhone, Safari or the home-screen app.

## 2. Read it

**Version and build.** Is it the latest? The build id is the commit
(`git show <build>`). An old build in a tab left open is common; the app
offers a reload, but the user may not have taken it.

**Codecs.** `HEVC: no / no` with an HEVC file explains a failure to play;
`H.264: … / no` explains export failures. The browser, not the app.

**Storage.** Near the quota means saved videos stop being kept
(`NOT_KEPT`) and edits may fail with `STORAGE_FULL`.

**Metrics** (last / median / 95th percentile / worst):

| Metric | Normal | Suggests |
|---|---|---|
| `firstFrame` | under 1 s locally, a few s over the network | high: slow source or decoder; very high with no frame: a decode problem |
| `seek` | under 300 ms | high: long keyframe intervals, a remote source without range support |
| `droppedFrames` vs `framesShown` | under 1% | high: device too slow for the resolution; 4K on a phone |
| `job:<Tool>` | | compare with the clip length: a job slower than the video is plays is worth looking at |
| `pageReady` | under 2 s | high: slow network on first load |

**Errors.** Each has a code (`shared/errors/codes.js`): `DECODE_FAILED`,
`UNSUPPORTED_CODEC`, `FILE_MISSING`, `CORS`, `WORKER_CRASHED`, … The code
says what went wrong; the message is the user's wording.

**The log** (from "Copy details"). Lines carry `(load N)` or `(job N)`:
everything one playback load or one job did shares its number, so filter on
it to follow one attempt from start to the error.

## 3. Reproduce

1. The same build: `git checkout <build>`, `npm ci`, `npm run dev`.
2. A file like theirs. `scripts/fixtures/` has small ones; ffmpeg makes
   others (`ffmpeg -f lavfi -i testsrc=size=1920x1080:rate=30 -t 5 -c:v libx265 hevc.mp4`).
3. The same browser. For iPhone and Android, the device itself; a desktop
   browser's device mode is not the same decoder.
4. With `?debug=1` the log also goes to the console.

## 4. Fix

A fix comes with a test that fails without it (`CONTRIBUTING.md`): a quick
suite for logic, a browser suite (`smoke-test`, `edit-panel-test`,
`processing-test`, `source-failure-test`) for what needs a real decoder.
Playback, audio and storage fixes need the device check in the PR template.
Answer the report with the version the fix ships in.
