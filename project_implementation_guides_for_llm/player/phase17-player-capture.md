# Phase 17: Player Frame Capture

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

## Testing Checklist
- [ ] Screenshot button visible in controller
- [ ] Clicking button pauses video and captures frame
- [ ] Modal displays correct frame at exact timestamp
- [ ] Download saves PNG with proper filename
- [ ] Cancel closes modal and resumes playback
- [ ] Keyboard shortcut 'S' works
- [ ] Works with different video resolutions

## Done When
✅ Screenshot button functional  
✅ Frame captured using MediaBunny  
✅ Preview modal displays correctly  
✅ Download saves PNG file  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 17 | **Component**: Player  
**Estimated Time**: 40-50 minutes
