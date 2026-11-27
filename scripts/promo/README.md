# The promo video

`public/promo.mp4` is JellyJump in 30 seconds. It is motion graphics in the
app's own look (Space Grotesk, the green, magenta, cyan and amber accents,
hard-shadowed boxes), with original music. Two places play it:

- the dashboard's hero, in JellyJump's own embed player
  (`embed.html?video_url=promo.mp4&controls=mute`);
- the player, as the sample video in an empty playlist on a first visit
  (`sampleVideoPath` in `assets/js/shared/config/index.js`).

To make it again:

```bash
npm run promo                                     # about a minute and a half
node scripts/promo/render.mjs --still 12.3        # one frame, to check a moment
```

- `promo.html` holds the seven scenes. Nothing in it moves on its own:
  `seek(t)` works out every style from `t`, so each frame is exact and the
  same every time. The scenes change on the music's beat (96 BPM, a bar
  every 2.5 s), each behind a quick green wipe:

  | Seconds | Scene |
  |---|---|
  | 0–5 | The logo drops in and lands like jelly; "Play, edit and create video. Right in your browser." |
  | 5–8.75 | "Plays almost anything.": format chips pop in. |
  | 8.75–12.5 | A little player runs forwards, then backwards at 2×: "Forwards. Backwards. Any speed." |
  | 12.5–17.5 | "Edit without uploading.": a clip is cut, two pieces fall out, the rest close up; the tools pop in. |
  | 17.5–21.25 | "Create and share.": record your screen, merge videos, watch together. |
  | 21.25–25 | "Private by design.": a lock snaps shut. |
  | 25–30 | The end card: logo, jellyjump.voidall.com, then a fade. |

- `render.mjs` draws each of the 900 frames in Chromium (the demo's
  `harness.mjs`), pipes them to ffmpeg, and adds `scripts/demo/music.mjs`'s
  track. H.264 with a key frame every second, so the player seeks, steps and
  plays it backwards quickly; about 4 MB.

Needs ffmpeg, Node 22 and a Chromium (`CHROMIUM_PATH`). Frames for
`--still` go to `scripts/promo/out/`, which is not committed.
