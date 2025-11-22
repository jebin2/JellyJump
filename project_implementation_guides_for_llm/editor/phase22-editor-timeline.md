# Phase 22: Editor Timeline

## Goal
Build timeline UI with video/audio tracks, playhead scrubber, timecode ruler, zoom controls.

## Features to Implement

### Feature 1: Timeline Canvas
**Purpose**: Visual representation of edit timeline

**Requirements**:
- Horizontal canvas showing time from left to right
- SVG or Canvas element for rendering
- Ruler with time markers
- Scroll horizontally for long timelines
- Zoom in/out controls

### Feature 2: Video and Audio Tracks
**Purpose**: Separate lanes for video and audio clips

**Requirements**:
- Video track: Top lane for video clips
- Audio track: Bottom lane for audio
- Additional tracks for overlays (optional)
- Fixed height per track
- Clips represented as rectangles

### Feature 3: Playhead
**Purpose**: Indicator of current playback position

**Requirements**:
- Vertical line across all tracks
- Synchronized with video playback
- Draggable to scrub through timeline
- Snap to clip boundaries (optional)
- Always visible (scrolls with timeline if needed)

### Feature 4: Timecode Ruler
**Purpose**: Show time/frame markers

**Requirements**:
- Top of timeline shows time markers
- Format: seconds or frames based on zoom
- Major and minor tick marks
- Updates based on zoom level

### Feature 5: Zoom Controls
**Purpose**: Zoom timeline in and out

**Requirements**:
- +/- buttons or slider
- Show more/less time in viewport
- Keyboard shortcuts: Cmd/Ctrl + / Cmd/Ctrl -
- Fit timeline to viewport option
- Maintain playhead position during zoom

### Feature 6: Clip Thumbnails (Optional)
**Purpose**: Visual preview of video clips

**Requirements**:
- Show frame thumbnails on clips
- Update based on zoom level
- Generate thumbnails from video
- Cache thumbnails for performance

## Testing Checklist
- [ ] Timeline renders correctly
- [ ] Tracks are visible
- [ ] Playhead moves with video
- [ ] Can scrub with playhead
- [ ] Zoom works correctly
- [ ] Ruler updates with zoom

## Done When
✅ Timeline UI functional  
✅ Playhead synchronized  
✅ Zoom/Scroll works  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 22 | **Component**: Editor
**Estimated Time**: 40-60 minutes
