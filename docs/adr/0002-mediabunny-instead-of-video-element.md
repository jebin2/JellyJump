# 0002. Decode with MediaBunny/WebCodecs and draw to a canvas, not `<video>`

Status: Accepted

## Context

A `<video>` element plays what the browser can decode, seeks to key frames,
and hides its frames from the page. The app needs to play formats browsers do
not (AC-3, DTS, TrueHD, ProRes, many MKVs), seek to an exact frame, play
backwards, draw effects, stickers and blur areas on the picture, and export
exactly what is shown.

## Decision

Files are demuxed and decoded with MediaBunny over WebCodecs, with decoder
plugins for the codecs WebCodecs lacks (`shared/media/MediaBunny.js`). Frames
are drawn to a canvas by the player's render loop; audio is scheduled through
Web Audio. The same compositor draws the picture for playback, screenshots
and export (`shared/media/OverlayCompositor.js`). Streams that must use a
media element (some live sources) and YouTube are separate paths behind the
same player API.

## Consequences

- The player owns timing and audio/video sync itself (see 0003), which is
  where most of its hard bugs have been, especially on iOS.
- Effects and edits preview exactly as they export.
- Decoders are large; they are loaded on demand.
