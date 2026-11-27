# The demo video

`public/demo.mp4` (shown on `dashboard.html`) is made by these scripts, from
the real app, with clips and music made here, so nothing in it belongs to
anyone else. To make it again after the app changes:

```bash
npm run demo
```

which runs, in order:

1. `npm run build`: the app as it ships.
2. `make-clips.sh`: three clips drawn by ffmpeg (a colour drift, a fractal
   dive, Conway's Life).
3. `record.mjs`: plays and edits them in a 1920×1080 Chromium. A cursor
   moves and clicks, and a caption names each scene. The frames come from the
   browser's own screencast. Waits are left out: a clip loading, a crop job
   running.
4. `compose.mjs`: adds a title card and a closing card, crossfaded, and
   `music.mjs`'s track, cut to the length. Writes `public/demo.mp4`, which
   the dashboard plays in JellyJump's own embed player (`embed.html`).

Needs ffmpeg, Node 22 and a Chromium (`CHROMIUM_PATH`). A GPU helps: in
software, a busy video records at 15 frames a second. Everything in between
goes to `scripts/demo/out/`, which is not committed.

`music.mjs` writes the music on its own too: `node scripts/demo/music.mjs 60`
gives 60 s, 96 BPM in C major.

`reverse-timing.mjs` is not part of the demo: it measures how long playing
backwards takes to start and stop on clips in `out/clips/`. Its default,
`longgop.mp4`, has ffmpeg's default key frame spacing (one every 250 frames),
which is where both cost the most:

```bash
ffmpeg -f lavfi -i mandelbrot=s=1280x720:r=30 -f lavfi -i sine=f=440 -t 24 \
  -c:v libx264 -pix_fmt yuv420p -c:a aac scripts/demo/out/clips/longgop.mp4
node scripts/demo/reverse-timing.mjs              # or: clip.mp4 seconds ...
```
