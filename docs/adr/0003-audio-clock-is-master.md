# 0003. The audio clock drives playback time

Status: Accepted

## Context

With decoding done by the app (0002), video frames and audio buffers are
produced separately and must stay in step. The ear notices gaps and drift in
audio far sooner than the eye notices a late frame.

## Decision

Playback position is read from the Web Audio clock: when playback starts or
seeks, a `PlaybackAnchor` records the audio context time and the content
time; the position is the content time plus the audio time elapsed since,
times the rate (`getPlayerPlaybackTime`). Video frames are shown when their
timestamp comes due on that clock. When the audio context is not running,
a wall clock stands in. Live streams keep an anchor of their own. A
`PlaybackEpoch` invalidates work started for an earlier seek or load.

## Consequences

- Audio plays without gaps; video drops or repeats a frame when it must.
- Anything that suspends the audio context (iOS, autoplay rules, tab
  switches) affects the clock; those cases are handled explicitly.
- `scripts/playback-clock-test.mjs` pins the rules.
