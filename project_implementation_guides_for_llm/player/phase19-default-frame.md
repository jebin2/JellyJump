# Phase 19: Default Frame Display

## Goal
Display a video frame on page load to overcome browser autoplay restrictions and provide visual feedback.

## Features to Implement

### Feature 1: Browser Autoplay Restriction Handling
**Purpose**: Work around browser policies that prevent autoplay without user interaction

**Context**:
- Modern browsers block autoplay until user interacts with page
- Video remains black/blank until user clicks play
- Poor UX: Users don't see what video they're about to watch
- Solution: Display a poster frame/thumbnail

**Requirements**:
- Don't attempt autoplay (will fail)
- Display static frame as placeholder
- Remove frame and start playback on user interaction

### Feature 2: Extract 50th Percentile Frame
**Purpose**: Show representative frame from first video in playlist

**Requirements**:
- Calculate middle timestamp: `duration * 0.5`
- Use MediaBunny to extract frame at that timestamp
- Convert frame to image data (data URL or blob)
- Display as video poster or canvas overlay
- Fallback to 25% or 75% if 50% fails

**MediaBunny Integration**:
```javascript
// Option 1: Using Player.getCurrentFrame()
await player.seekTo(duration * 0.5);
const frameDataUrl = await player.getCurrentFrame();

// Option 2: Using VideoSampleSink
const sink = new VideoSampleSink({
  onSample: (sample) => {
    // Convert sample to canvas
    const canvas = document.createElement('canvas');
    canvas.width = sample.codedWidth;
    canvas.height = sample.codedHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(sample, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
  }
});
```

**Reference**: Consult `mediabunny-llms-full.md` for:
- Frame extraction APIs
- VideoSampleSink usage
- Canvas rendering
- Timestamp seeking

### Feature 3: Last Paused Frame (Priority)
**Purpose**: Show the exact frame where user last paused

**Requirements**:
- Store last paused state in localStorage
- Include: video file/URL, timestamp, frame data URL
- On page load: Check for last paused data
- If found: Display that frame and pre-seek to that timestamp
- If not found: Fall back to 50th percentile of first video

**LocalStorage Structure**:
```javascript
{
  lastPlayback: {
    videoUrl: 'blob:http://...',      // or file name
    videoName: 'example.mp4',
    timestamp: 25.5,                  // seconds
    frameDataUrl: 'data:image/png;base64,...',
    savedAt: '2024-11-27T10:30:00Z'   // ISO timestamp
  }
}
```

**Storage Triggers**:
- On pause: Extract current frame, save to localStorage
- On video end: Clear last playback (or save end frame)
- On page unload: Save current state

### Feature 4: Display Frame as Poster
**Purpose**: Show frame before playback starts

**Requirements**:
- Set as video `poster` attribute, OR
- Display in canvas overlay, OR
- Display as background image on container
- Remove/hide when playback starts
- Maintain aspect ratio
- Show play button overlay on top of frame

**Implementation Options**:

**Option A: Video Poster**
```javascript
video.poster = frameDataUrl;
// Removed automatically when video plays
```

**Option B: Canvas Overlay**
```javascript
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
const img = new Image();
img.src = frameDataUrl;
img.onload = () => {
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  overlay.appendChild(canvas);
};

// Remove on play
video.addEventListener('play', () => {
  overlay.remove();
}, { once: true });
```

**Option C: Background Image**
```javascript
videoContainer.style.backgroundImage = `url(${frameDataUrl})`;
videoContainer.style.backgroundSize = 'contain';

// Remove on play
video.addEventListener('play', () => {
  videoContainer.style.backgroundImage = '';
}, { once: true });
```

### Feature 5: Update on Pause/Close
**Purpose**: Keep localStorage in sync with user's viewing state

**Requirements**:
- Listen for `pause` event
- Extract current frame (using MediaBunny)
- Update localStorage with new timestamp and frame
- Debounce updates (max once per second)
- Handle page unload/close

**Implementation**:
```javascript
let updateTimeout;

video.addEventListener('pause', async () => {
  clearTimeout(updateTimeout);
  updateTimeout = setTimeout(async () => {
    const timestamp = video.currentTime;
    const frameDataUrl = await extractCurrentFrame();
    saveLastPlayback({
      videoName: currentVideo.name,
      timestamp,
      frameDataUrl
    });
  }, 500); // Debounce 500ms
});

window.addEventListener('beforeunload', () => {
  // Save current state
  saveLastPlayback({...});
});
```

## Testing Checklist
- [ ] On first load with no localStorage: Shows 50th percentile frame of first video
- [ ] On load with localStorage: Shows last paused frame
- [ ] Frame displays before user clicks play
- [ ] Frame removes when playback starts
- [ ] Pausing video updates localStorage
- [ ] Frame data URL stored correctly
- [ ] Timestamp restored correctly on reload
- [ ] Video seeks to saved timestamp before showing poster
- [ ] Fallback works if frame extraction fails
- [ ] No autoplay attempts (no console errors)
- [ ] Works with different video aspect ratios
- [ ] Play button overlay visible on frame

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
3. Extract frame at 1:30
4. Save to localStorage (timestamp + frame)
5. User closes page
6. User returns → Shows frame at 1:30

## Edge Cases
- Video too short: 50% might be very early, use fixed second (e.g., 5s)
- Video not loaded: Show loading state, then frame when ready
- Frame extraction fails: Show black poster with play button
- localStorage quota exceeded: Compress image or store smaller resolution
- Multiple videos in playlist: Only store frame for actively playing video
- Video URL changed: Clear stale localStorage data

## Accessibility
- Poster frame has alt text: "Video preview at [timestamp]"
- Play button overlay has aria-label: "Play video"
- Screen reader announces current timestamp on load
- Keyboard: Space or Enter to start playback

## Files to Modify
- `player.html` - Add poster container or canvas overlay
- `player.css` - Style poster display
- `player.js` - Add frame extraction, localStorage logic
- `playlist.js` - Trigger frame extraction when video selected

## What NOT to Do
- ❌ Don't attempt autoplay (will fail and cause console errors)
- ❌ Don't store full-resolution frames (localStorage limit ~5-10MB)
- ❌ Don't update localStorage on every timeupdate (use debounce)
- ❌ Don't forget to clear old localStorage entries
- ❌ Don't ignore localStorage quota errors

## MediaBunny Integration

**Required APIs**:
- `Player.getCurrentFrame()` - Extract current frame as data URL
- `Player.seekTo(timestamp)` - Seek to specific time
- `VideoSampleSink` - Alternative for frame extraction
- `CanvasSink` - Render frame to canvas

**Reference Sections** (mediabunny-llms-full.md):
- Frame capture/screenshot APIs
- Seeking and timestamp control
- Canvas rendering
- Resource cleanup

## Performance Considerations
- Compress frame data URL (use JPEG at 80% quality, not PNG)
- Limit frame resolution (e.g., 640x360 max for poster)
- Clear old localStorage entries (keep only latest playback)
- Lazy-load frame extraction (don't block page load)

## Done When
✅ 50th percentile frame extraction works  
✅ Last paused frame stored in localStorage  
✅ Frame displays on page load (before play)  
✅ Frame removes when playback starts  
✅ Pause updates localStorage with new frame  
✅ Timestamp restored correctly  
✅ All tests pass  
✅ No autoplay attempts  
✅ Ready for next phase

---
**Phase**: 19 | **Component**: Player  
**Estimated Time**: 60-80 minutes
