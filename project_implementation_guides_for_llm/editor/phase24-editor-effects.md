# Phase 24: Editor Effects

## Goal
Apply transitions and filters using MediaBunny's video processing capabilities

**MediaBunny Integration**: Effects are applied through MediaBunny's conversion process callback. **Consult** mediabunny-llms-full.md for:
- `video.process` callback in Conversion API for frame-by-frame processing
- Canvas API integration for applying filters (grayscale, brightness, etc.)
- VideoSample manipulation and drawing
- Processing video samples with custom transformationsers (brightness, contrast), text overlay system.

## Features to Implement

### Feature 1: Transition System
**Purpose**: Add effects between clips

**Requirements**:
- Fade (opacity transition)
- Crossfade (dissolve between clips)
- Wipe (left to right, etc.)
- Adjustable duration for each transition
- Drag from library to clip boundary

### Feature 2: Video Filters
**Purpose**: Apply color/visual effects

**Requirements**:
- Brightness adjustment
- Contrast adjustment
- Saturation control
- Grayscale filter
- Other filters: Blur, Sepia, etc.

### Feature 3: Filter Controls
**Purpose**: Adjust filter intensity

**Requirements**:
- Sliders for each filter parameter
- Real-time preview in player
- Reset to defaults button
- Save filter presets (optional)

### Feature 4: Text Overlay System
**Purpose**: Add text on top of video

**Requirements**:
- Add text at specific timecode
- Customize font family and size
- Choose text color
- Set display duration
- Position text on video

### Feature 5: Effects Panel UI
**Purpose**: Browse and apply effects

**Requirements**:
- Transitions tab
- Filters tab
- Text tab
- Preview thumbnails
- Drag to apply

### Feature 6: Effect Preview
**Purpose**: See effects in real-time

**Requirements**:
- Update preview player immediately
- Show before/after toggle (optional)
- Scrub through effect to preview
- Render effects accurately

## Testing Checklist
- [ ] Transitions work between clips
- [ ] Filters apply correctly
- [ ] Text overlays appear at correct time
- [ ] Effect controls update preview
- [ ] Can remove effects

## Done When
✅ Effects system implemented  
✅ Filters/Transitions work  
✅ Text overlays work  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 24 | **Component**: Editor
**Estimated Time**: 50-70 minutes
