# Phase 23: Player Frame Capture

## Goal
Implement video frame screenshot feature with preview and download functionality

**MediaBunny Integration**: Use MediaBunny's CanvasSink or VideoSample drawing to capture frames. **Consult** mediabunny-llms-full.md for frame extraction methods.

## Features to Implement

### Feature 1: Screenshot Button
**Purpose**: Add capture button to controller

**Requirements**:
- Camera/screenshot icon button in control bar
- Position near other media controls
- Clear visual indication (icon + tooltip)
- Apply theme button styling

### Feature 2: Frame Capture
**Purpose**: Capture current video frame

**Requirements**:
- **Consult**: mediabunny-llms-full.md for CanvasSink usage
- Pause video when screenshot button clicked
- Capture current frame at exact timestamp
- Extract frame as canvas/image using MediaBunny VideoSampleSink
- Maintain original video resolution
- Handle different aspect ratios

### Feature 3: Preview Modal
**Purpose**: Show captured frame before saving

**Requirements**:
- Modal/popup displays captured frame
- Full-size preview of screenshot
- Darken background overlay
- Modal appears centered on screen
- Show timestamp/video title in modal header
- Apply theme styling (borders, shadows)

### Feature 4: Download Option
**Purpose**: Save screenshot as PNG file

**Requirements**:
- "Download" button in modal
- Save as PNG format (high quality)
- Auto-generate filename: `{video-title}-{timestamp}.png`
- Trigger browser download
- Close modalafter download starts

### Feature 5: Cancel Option
**Purpose**: Dismiss modal without saving

**Requirements**:
- "Cancel" or "Close" button in modal
- Close button (X) in modal header
- ESC key also closes modal
- Resume video playback on cancel (if auto-paused)

### Feature 6: Keyboard Shortcut
**Purpose**: Quick screenshot access

**Requirements**:
- Keyboard shortcut: S key for screenshot
- Document in keyboard shortcuts help
- Works when player is focused

### Feature 7: No Scroll Prevention
**Purpose**: Prevent background scrolling while modal is open

**Requirements**:
- Lock body scroll when modal opens (`overflow: hidden` on body)
- Restore scroll when modal closes (remove `overflow: hidden`)
- No background page scrolling while preview modal is active
- Smooth transition between states
- Handle edge cases (e.g., modal closed without proper cleanup)

### Feature 8: Frame Navigation Arrows
**Purpose**: Navigate between video frames without closing modal

**Requirements**:
- Add left arrow button for previous frame
- Add right arrow button for next frame
- Calculate frame offsets based on video FPS (frames per second)
- Update preview image instantly when arrow clicked
- Update timestamp display automatically
- Navigate seamlessly (no modal close/reopen)
- Handle boundaries (first/last frame of video)
- Visual feedback on arrow hover/click
- Position arrows clearly on modal (left/right sides or bottom)

**How It Works**:
1. User clicks screenshot button → modal opens → body scroll locked
2. User can click left/right arrows to view adjacent frames
3. Each arrow click calculates new timestamp (current ± 1/FPS seconds)
4. Preview updates instantly without closing modal
5. Timestamp header updates to reflect new frame position

## Testing Checklist
- [ ] Screenshot button visible in controller
- [ ] Clicking button pauses video and captures frame
- [ ] Modal displays correct frame at exact timestamp
- [ ] Download saves PNG with proper filename
- [ ] Cancel closes modal and resumes playback
- [ ] Keyboard shortcut 'S' works
- [ ] Works with different video resolutions
- [ ] Body scroll locked when modal opens (no background scrolling)
- [ ] Body scroll restored when modal closes
- [ ] Left arrow navigates to previous frame
- [ ] Right arrow navigates to next frame
- [ ] Frame navigation calculates correctly based on FPS
- [ ] Preview updates instantly on arrow click
- [ ] Timestamp updates automatically with frame changes
- [ ] Arrows handle video start/end boundaries gracefully

## Done When
✅ Screenshot button functional  
✅ Frame captured using MediaBunny  
✅ Preview modal displays correctly  
✅ Download saves PNG file  
✅ Body scroll prevention implemented  
✅ Frame navigation arrows working  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 23 | **Component**: Player  
**Estimated Time**: 40-50 minutes
