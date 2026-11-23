# Changelog

What changed in each release, from the commit subjects. Newest first.

## 0.5.1 — 2026-11-05

- fix(playback): an undecodable video plays its sound instead of nothing
- fix(share): tell people to allow local network access, which is the cure

## 0.5.1-beta — 2026-11-04

- fix(share): let a trusted page reach a library on a private address
- fix(share): say when the browser refused to reach a local library

## 0.5.0 — 2026-11-04

- fix(live): a dead stream no longer locks the tab up
- fix(encrypt): opening the dialog no longer downloads the file first
- fix(metadata): Video Information was downloading the file too
- fix(metadata): read a remote file's header instead of downloading it
- fix(playback): stop reading our own share links as HLS
- fix(playback): recover the picture, and say when a codec is unplayable
- fix(playback): return the wedged iterator so its frames are released
- fix(share): put the tailnet mapping back when it disappears
- fix(thumbnails): fall back when the browser refuses software decoding
- fix(playback): a stalled decoder no longer wedges the player on a seek
- test(watch-panel): wait for the panel to advance instead of sleeping 1.2s
- test(jjc3-sim): refuse to pass a profile whose bitrate cap never bound
- feat(encrypt): show how long is left, not just a percentage
- feat(encrypt)!: carry the header in the video strip, not the audio
- perf(encrypt): two copies of the audio header, not three
- perf(encrypt): write carrier frames a row at a time where it is safe
- feat(playback): play an encrypted carrier by entering its password
- perf(encrypt): decode carrier frames from luma, not through a canvas
- fix(playback): a source that can never be read fails instead of hanging
- feat(playback): decode Dolby TrueHD audio
- chore(libs): MediaBunny 1.61.1 -> 1.64.0

## 0.4.3-beta — 2026-10-27

- fix(desktop): running out of watches is handled, not reported for a person to fix
- fix(desktop): the watcher takes one watch per folder, not per file
- feat(desktop): bring back --no-gui, --share-status and --stop
- chore(desktop): remove the headless CLI's leftovers and bring cli-test up to date
- fix(desktop): sharing no longer crashes on empty files, over-watches, or leaks the token
- fix(desktop): a plain launch no longer floods shared-memory errors and hangs
- feat(desktop): move share controls to app menu, remove --no-gui CLI, add live library watching and share env

## 0.4.2 — 2026-10-26

- fix: shared library subtitles travel with their video
- chore: 0.4.2
- perf: the no-gui scan count overwrites in place
- style: the Tools grid is three columns, like the per-item one
- rm unwanted style
- test: the party, proved on an HLS playlist and on a live one
- fix: a watch party is not offered for a YouTube video
