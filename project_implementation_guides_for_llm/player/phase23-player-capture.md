# Phase 23: Player Frame Capture

## Goal
Implement video frame screenshot feature with preview, download, and frame navigation capabilities.

**MediaBunny Note**: Use MediaBunny's frame extraction APIs to capture video frames. Consult `mediabunny-llms-full.md` for CanvasSink, VideoSampleSink, and frame rendering techniques.

---

## What to Build

Screenshot system with:
- Capture button in control bar
- Frame extraction at current timestamp
- Preview modal with navigation arrows
- Download as PNG functionality
- Body scroll prevention while modal open

---

## Features to Implement

### Feature 1: Screenshot Button
**Purpose**: Add capture button to controller

**Requirements**:
- Camera/screenshot icon button (📷) in control bar
- Position near other media controls
- Clear visual indication (icon + tooltip: "Screenshot")
- Apply theme button styling
- Keyboard accessible

### Feature 2: Frame Capture
**Purpose**: Capture current video frame using MediaBunny

**Requirements**:
- Pause video when screenshot button clicked
- Capture current frame at exact timestamp
- Maintain original video resolution (or configurable max resolution)
- Handle different aspect ratios
- Extract as high-quality image

### Feature 3: Preview Modal
**Purpose**: Show captured frame before saving

**Requirements**:
- Modal/popup displays captured frame at full size
- Darken background overlay (rgba(0,0,0,0.8))
- Modal appears centered on screen
- Show timestamp and video title in modal header
- Apply theme styling (bold borders, shadows)
- Close button (X) in top corner

### Feature 4: Download Option
**Purpose**: Save screenshot as PNG file

**Requirements**:
- "Download" button in modal
- Save as PNG format (high quality, lossless)
- Auto-generate filename: `{video-title}-{HH-MM-SS}.png`
- Trigger browser download
- Keep modal open after download (allow multiple saves)

### Feature 5: Cancel/Close Option
**Purpose**: Dismiss modal without saving

**Requirements**:
- "Cancel" or "Close" button in modal
- Close button (X) in modal header
- ESC key also closes modal
- Click outside modal (overlay) closes it
- Resume video playback on close (if was auto-paused)

### Feature 6: Body Scroll Prevention
**Purpose**: Prevent background scrolling while modal is open

**Requirements**:
- Lock body scroll when modal opens (`overflow: hidden` on body)
- Restore scroll when modal closes (remove `overflow: hidden`)
- No background page scrolling while preview modal active
- Handle edge cases (modal closed without proper cleanup)
- Preserve scroll position

### Feature 7: Frame Navigation Arrows
**Purpose**: Navigate between video frames without closing modal

**Requirements**:
- Left arrow button (◀) for previous frame
- Right arrow button (▶) for next frame
- Calculate frame offsets based on video FPS
- Update preview image instantly when arrow clicked
- Update timestamp display automatically
- Navigate seamlessly (no modal close/reopen)
- Handle boundaries (first/last frame of video)
- Visual feedback on arrow hover/click
- Position arrows clearly on modal (left/right sides or bottom)

### Feature 8: Keyboard Shortcut
**Purpose**: Quick screenshot access

**Requirements**:
- Keyboard shortcut: **S** key for screenshot
- Document in keyboard shortcuts help
- Works when player is focused
- Arrow keys navigate frames when modal open

---

## Interaction Behavior

**User Flow 1: Basic Screenshot**:
1. User watching video at 1:30
2. User clicks screenshot button (or presses S)
3. Video pauses
4. Modal opens with frame at 1:30
5. Body scroll locked
6. User clicks Download
7. PNG file downloads
8. User clicks Close
9. Modal closes, video resumes, body scroll restored

**User Flow 2: Frame Navigation**:
1. Modal open with current frame
2. User clicks left arrow
3. Preview updates to previous frame (1 frame back based on FPS)
4. Timestamp updates to new position
5. User clicks right arrow multiple times
6. Each click advances one frame
7. User downloads desired frame
8. Modal closes

**Keyboard Controls in Modal**:
- **← →**: Navigate frames
- **Enter**: Download
- **Esc**: Close modal

---

## Edge Cases

- Video at start: Left arrow disabled
- Video at end: Right arrow disabled
- Unknown FPS: Default to 30fps for calculations
- Very high FPS (60+): Consider frame skip option
- Large resolution: Scale preview to fit screen, download at full res
- Screenshot during buffering: Wait for frame to load
- Rapid arrow clicks: Debounce or queue requests

---

## Accessibility

- Screenshot button: aria-label="Take screenshot"
- Modal: role="dialog", aria-labelledby="modal-title"
- Navigation arrows: aria-label="Previous frame" / "Next frame"
- Focus trap: Keep focus within modal
- ESC key closes modal
- Screen reader announces frame timestamp changes

---

## What NOT to Do

- ❌ Don't capture low-resolution frames (use original quality)
- ❌ Don't forget to unpause video if it was playing
- ❌ Don't allow background scroll with modal open
- ❌ Don't lose current frame when navigating
- ❌ Don't calculate FPS incorrectly (causes wrong frame jumps)

---

## MediaBunny Integration

This phase requires MediaBunny for frame extraction.

**Consult `mediabunny-llms-full.md`** for:
- CanvasSink or VideoSampleSink for frame capture
- Seeking to specific timestamps
- Canvas rendering techniques
- FPS detection from video metadata
- Resource cleanup after capture

**Suggested approach**: Use video element or MediaBunny sink to draw current frame to canvas, convert canvas to PNG blob, display in modal and offer download.

---

## Testing Checklist

- [ ] Screenshot button visible in controller
- [ ] Clicking button pauses video and captures frame
- [ ] Modal displays correct frame at exact timestamp
- [ ] Download saves PNG with proper filename
- [ ] Cancel closes modal and resumes playback
- [ ] Keyboard shortcut 'S' works
- [ ] Works with different video resolutions
- [ ] Body scroll locked when modal opens
- [ ] Body scroll restored when modal closes
- [ ] Left arrow navigates to previous frame
- [ ] Right arrow navigates to next frame
- [ ] Frame navigation calculates correctly based on FPS
- [ ] Preview updates instantly on arrow click
- [ ] Timestamp updates automatically with frame changes
- [ ] Arrows handle video start/end boundaries gracefully

---

## Done When

✅ Screenshot button functional  
✅ Frame captured using MediaBunny  
✅ Preview modal displays correctly  
✅ Download saves high-quality PNG  
✅ Body scroll prevention implemented  
✅ Frame navigation arrows working  
✅ Keyboard navigation functional  
✅ All tests pass  
✅ Ready for next phase

---

**Phase**: 23 | **Component**: Player  
**Estimated Time**: 60-80 minutes
