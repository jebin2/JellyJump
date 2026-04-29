# HLS Live Playback Stabilization Report

This document summarizes the technical challenges faced and the solutions implemented to achieve production-grade HLS Live playback stability in the MediaBunny Player.

## 1. Core Architecture: The "Pull-Model"
The player uses a custom rendering pipeline where video frames and audio buffers are "pulled" from an async iterator and synchronized to the browser's `AudioContext` wall-clock.

### Challenges with Live Streams:
- **Relative vs. Absolute Time**: VOD uses timestamps starting at `0`, while HLS Live uses Unix Epoch timestamps (billions of seconds).
- **Network Jitter**: Live segments arrive in bursts, causing inconsistent iterator timing.
- **Clock Drift**: The browser's audio hardware clock and the stream's encoded timestamps naturally drift apart over time.

---

## 2. Key Issues & Solutions

### A. The "Video Ahead of Audio" Spam (VOD/Live Conflict)
- **Issue**: The `RenderLoop.js` (used for VOD) saw Unix timestamps (e.g., 1.7B) and compared them to a 0-based audio clock. It detected a "50-year drift" and tried to re-seek the video every frame, causing a total freeze.
- **Solution**: Updated `RenderLoop.js` to explicitly bypass VOD-style drift checks when `player.isLive` is active. Live sync is now handled exclusively by the specialized `PlayerStream` loop.

### B. "Stuck Frame" on HLS Initialization
- **Issue**: Autoplay or early `play()` calls would start a VOD iterator before the HLS metadata had fully loaded. This resulted in two competing rendering loops.
- **Solution**: Implemented **Early `isLive` Detection** in `Player.js`. The player now flags a stream as Live immediately upon URL detection (via `StreamDetector`), preventing the VOD pipeline from ever starting.

### C. Audio/Video Sync Drift
- **Issue**: Audio and Video would gradually drift apart, or sound "echoey" as the player tried to catch up.
- **Solution 1 (Dynamic Anchors)**: Instead of a static "start" anchor, the audio scheduler now reads dynamic anchors (`_liveAnchorWall` and `_liveAnchorContent`) that are refined every frame by the video loop.
- **Solution 2 (Latency Compensation)**: Integrated `AudioContext.outputLatency` into the sync math. This ensures a video frame is drawn at the exact millisecond the corresponding sound hits the speakers.

### D. Freeze After Long Pause (> 60s)
- **Issue**: Pausing a live stream for a long time "stales" the internal demuxer buffers. Upon resume, the first frame fetched was often 1,000+ seconds old, causing the sync logic to stall.
- **Solution 1 (Stale Frame Discarding)**: Added a validation check in the loop to discard any frame more than 2 minutes away from the requested live edge.
- **Solution 2 (Force Restart)**: Implemented a `forceRestart` flag in `PlaybackTransport.js`. If drift exceeds 60s, the player fully disposes and recreates all iterators.

### E. "Leaping Loading" on Media Switch
- **Issue**: Switching between live streams (e.g., BBC to 30A TV) would sometimes fail to load because the "active loop" guard wasn't cleared.
- **Solution**: Hardened the `cleanupHLS()` function in `PlayerStream.js` to reset the `_isLiveLoopActive` flag and clear all synchronization anchors.

---

## 3. Implementation Checklist for Future Maintenance

- [x] **Epoch Anchoring**: Always use `(currentTime - anchorWall) + anchorContent` for sync.
- [x] **Async Guards**: All rendering loops must check `player.asyncId !== asyncId` to prevent orphaned loops from clobbering new media.
- [x] **Watchdogs**: Maintain the 6-second watchdog in `PlayerStream.js` to catch network-related iterator stalls.
- [x] **Proportional Throttling**: Keep audio buffering between 100ms and 200ms for Live streams.

---

## 4. Verification Methodology
- **VOD -> Live Transition**: Verified by switching between "Sample Video" and "BBC Live".
- **Live -> Live Transition**: Verified by switching between BBC and 30A TV.
- **Stress Test**: Paused live stream for 10 minutes and verified instant "Jump to Live Edge" on resume.
- **Sync Check**: Monitored `Sync status` logs to ensure drift stays under +/- 10ms.
