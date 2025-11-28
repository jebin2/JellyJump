# Phase 19: Default Frame Display

## Goal
Display a video frame on page load to overcome browser autoplay restrictions and provide visual feedback before playback.

**MediaBunny Note**: Use MediaBunny's frame extraction APIs to capture and display poster frames. Consult `mediabunny-llms-full.md` for `Player.getCurrentFrame()`, `VideoSampleSink`, and canvas rendering patterns.

---

## What to Build

Frame display system that:
- Shows 50th percentile frame from first video (if no history)
- Shows last paused frame from previous session (if history exists)
- Displays frame as poster before user clicks play
- Stores frame in localStorage for fast reload
- Updates frame on pause for next session

---

## Features to Implement

### Feature 1: Browser Autoplay Restriction Handling
**Purpose**: Work around browser policies that prevent autoplay without user interaction

**Requirements**:
- Don't attempt autoplay (will fail and cause errors)
- Display static frame as placeholder instead
- Remove frame and start playback on user interaction
- Show play button overlay on frame
- Maintain 16:9 aspect ratio

### Feature 2: Extract 50th Percentile Frame
**Purpose**: Show representative frame from first video in playlist

**Requirements**:
- Calculate middle timestamp: duration × 0.5
- Use MediaBunny to extract frame at that timestamp
- Convert frame to data URL or blob
- Display as video poster or canvas overlay
- Fallback to 25% or 75% if 50% extraction fails
- Use reasonable resolution (max 1280x720 for storage efficiency)

### Feature 3: Last Paused Frame (Priority)
**Purpose**: Show the exact frame where user last paused

**Requirements**:
- Store last paused state in localStorage
- Include: video identifier, timestamp, frame data URL
- On page load: Check for last paused data first
- If found: Display that frame and pre-seek to timestamp
- If not found: Fall back to 50th percentile of first video
- Store timestamp: ISO format for consistency

### Feature 4: Display Frame as Poster
**Purpose**: Show frame before playback starts

**Requirements**:
- Set as video poster attribute, OR display in canvas overlay, OR use background image
- Remove/hide when playback starts
- Maintain aspect ratio
- Show play button overlay on top of frame
- Center frame in container
- Black letterboxing if needed

### Feature 5: Update on Pause/Close
**Purpose**: Keep localStorage in sync with user's viewing state

**Requirements**:
- Listen for pause event
- Extract current frame using MediaBunny
- Update localStorage with new timestamp and frame
- Debounce updates (max once per second to avoid excessive writes)
- Handle page unload/close (save final state)
- Update on video end (optional: clear or save end frame)

---

## Interaction Behavior

**User Flow 1: First Visit**:
1. User loads page with playlist
2. Extract 50th percentile frame from first video
3. Display frame as poster
4. Show play button overlay
5. User clicks play → Frame removed, video plays from start

**User Flow 2: Returning Visit**:
1. User loads page
2. Check localStorage for last playback
3. Found: Display saved frame
4. Pre-seek video to saved timestamp (without playing)
5. User clicks play → Video continues from last position

**User Flow 3: Pause Behavior**:
1. User watching video
2. User pauses at 1:30
3. Extract frame at 1:30 using MediaBunny
4. Save to localStorage (timestamp + frame data URL)
5. User closes page
6. User returns → Shows frame at 1:30

---

## Edge Cases

- Video too short: If < 10s, use 5s mark instead of 50%
- Video not loaded: Show loading state, then frame when ready
- Frame extraction fails: Show black poster with play button
- localStorage quota exceeded: Compress image (JPEG 80%) or store smaller resolution
- Multiple videos in playlist: Only store frame for actively playing video
- Video URL/file changed: Clear stale localStorage data
- Corrupted frame data: Fall back to default extraction

---

## Styling Requirements

**Poster Display**:
- Full width/height of video container
- object-fit: contain (maintain aspect ratio)
- Centered vertically and horizontally
- Black background for letterboxing

**Play Button Overlay**:
- Large, centered play icon (▶)
- Semi-transparent background circle
- Hover effect (scale/glow)
- Cursor: pointer

---

## Accessibility

- Poster frame has alt text: "Video preview at [timestamp]"
- Play button overlay has aria-label: "Play video"
- Screen reader announces: "Resume from [time]" if applicable
- Keyboard: Space or Enter to start playback

---

## What NOT to Do

- ❌ Don't attempt autoplay (will fail and cause console errors)
- ❌ Don't store full-resolution frames (localStorage limit ~5-10MB)
- ❌ Don't update localStorage on every timeupdate (use debounce on pause)
- ❌ Don't forget to clear old localStorage entries
- ❌ Don't ignore localStorage quota errors
- ❌ Don't extract frames while video is playing (performance impact)

---

## MediaBunny Integration

This phase requires MediaBunny for frame extraction and display.

**Consult `mediabunny-llms-full.md`** for:
- Frame capture and screenshot techniques
- Seeking and timestamp control
- Canvas rendering for frame conversion
- Resource cleanup after extraction

**Suggested approach**: Extract frame at specific timestamp, convert to data URL, store in localStorage.

---

## Performance Considerations

**Optimization Tips**:
- Compress frame data URL: Use JPEG at 80% quality (not PNG)
- Limit frame resolution: Max 640x360 for poster (smaller storage)
- Clear old localStorage entries: Keep only latest playback data
- Lazy-load frame extraction: Don't block page load
- Cache extracted frames: Don't re-extract on every pause
- Debounce pause events: Wait 500ms before extracting

**LocalStorage Structure**:
```
{
  lastPlayback: {
    videoIdentifier: "video123" or "blob:http://...",
    videoName: "example.mp4",
    timestamp: 25.5,  // seconds
    frameDataUrl: "data:image/jpeg;base64,...",
    savedAt: "2024-11-27T10:30:00Z"
  }
}
```

---

## Testing Checklist

- [ ] First load with no localStorage: Shows 50th percentile frame
- [ ] Load with localStorage: Shows last paused frame
- [ ] Frame displays before user clicks play
- [ ] Frame removes when playback starts
- [ ] Pausing video updates localStorage
- [ ] Frame data URL stored correctly (compressed)
- [ ] Timestamp restored correctly on reload
- [ ] Video seeks to saved timestamp before showing poster
- [ ] Fallback works if frame extraction fails
- [ ] No autoplay attempts (no console errors)
- [ ] Works with different video aspect ratios
- [ ] Play button overlay visible and functional
- [ ] localStorage quota errors handled gracefully

---

## Done When

✅ 50th percentile frame extraction works  
✅ Last paused frame stored in localStorage  
✅ Frame displays on page load (before play)  
✅ Frame removes when playback starts  
✅ Pause updates localStorage with new frame  
✅ Timestamp restored correctly  
✅ All tests pass  
✅ No autoplay attempts  
✅ Performance optimized (compressed frames)  
✅ Ready for next phase

---

**Phase**: 19 | **Component**: Player  
**Estimated Time**: 60-80 minutes
