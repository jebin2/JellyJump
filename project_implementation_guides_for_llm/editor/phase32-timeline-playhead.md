# Phase 32: Timeline Playhead & Scrubbing

## Goal
Implement playhead indicator synchronized with video preview and enable timeline scrubbing

## Features to Implement

### Feature 1: Playhead Visual Element
**Purpose**: Vertical line showing current playback position

**Requirements**:
- Vertical line spanning all tracks (full height)
- Red color for high visibility
- Width: 2-3px
- Position: Absolute within timeline container
- Z-index above clips
- Top handle/knob for grabbing (small circle or triangle)
- Drop shadow for depth (Dark Neobrutalism)

### Feature 2: Playhead Position Calculation
**Purpose**: Convert current time to pixel position

**Requirements**:
- Use same `timeToPixels()` function from Phase 31
- Calculate playhead left position based on `currentTime`
- Update position when:
  - Video plays (timeupdate event)
  - User scrubs timeline
  - Zoom level changes (Phase 33)
- Smooth position updates (60fps)
- Constrain playhead within timeline bounds (0 to totalDuration)

### Feature 3: Current Time Display
**Purpose**: Show time at playhead position

**Requirements**:
- Display format: "00:00:05"
- Position: Above playhead or in timeline header
- Tooltip-style display
- Update in real-time during playback
- Synchronized with preview panel time display (Phase 28)
- Draggable along with playhead

### Feature 4: Video-to-Playhead Synchronization
**Purpose**: Move playhead when video plays

**Requirements**:
- Listen to video `timeupdate` event from Preview Panel (Phase 28)
- Update playhead position to match video.currentTime
- Request animation frame for smooth updates
- Handle playback speed changes
- Pause updates when user is scrubbing

### Feature 5: Playhead-to-Video Synchronization
**Purpose**: Update video time when playhead moves

**Requirements**:
- Emit event when playhead position changes
- Calculate new time from playhead pixel position:
  ```javascript
  function pixelsToTime(pixels, zoomLevel) {
    const pixelsPerSecond = 100 * (zoomLevel / 100);
    return pixels / pixelsPerSecond;
  }
  ```
- Update video.currentTime in Preview Panel (Phase 28)
- Seek video to new time
- Handle seeking while video is playing

### Feature 6: Scrubbing Functionality
**Purpose**: Drag playhead to scrub through video

**Requirements**:
- Make playhead draggable horizontally
- Show cursor: grab/grabbing
- Visual feedback during drag (playhead follows mouse)
- Update video preview in real-time during scrub
- Snap to clip boundaries (optional, from settings)
- Magnetic snapping to other clips (optional)
- Release to stop scrubbing
- Smooth drag experience (no lag)

### Feature 7: Keyboard Navigation
**Purpose**: Move playhead with keyboard shortcuts

**Requirements**:
- **Space**: Play/Pause (from Phase 28)
- **Left Arrow**: Step backward 1 frame
- **Right Arrow**: Step forward 1 frame
- **Shift + Left**: Jump backward 5 seconds
- **Shift + Right**: Jump forward 5 seconds
- **Home**: Jump to start (00:00:00)
- **End**: Jump to end of timeline
- Update playhead position and video time
- Show keyboard shortcuts in tooltip

### Feature 8: Auto-Scroll Timeline
**Purpose**: Keep playhead visible during playback

**Requirements**:
- When playhead reaches right edge of viewport, scroll timeline
- Smooth auto-scroll animation
- Keep playhead centered or slightly right of center
- Stop auto-scroll when user manually scrolls
- Resume auto-scroll on next play

## Testing Checklist
- [ ] Playhead renders as vertical line across all tracks
- [ ] Playhead position updates when video plays
- [ ] Current time displays at playhead
- [ ] Video seeks when playhead dragged
- [ ] Scrubbing updates video preview in real-time
- [ ] Keyboard shortcuts move playhead correctly
- [ ] Left/Right arrows step by frame
- [ ] Shift shortcuts jump by seconds
- [ ] Home/End jump to start/end
- [ ] Auto-scroll keeps playhead visible during playback
- [ ] Snapping works (if implemented)
- [ ] Theme styling applied to playhead

## Done When
✅ Playhead visual element renders  
✅ Playhead synchronized with video playback  
✅ Current time displays at playhead  
✅ Scrubbing functionality works  
✅ Keyboard navigation implemented  
✅ Auto-scroll during playback  
✅ All tests pass  
✅ Ready for Phase 33 (Zoom)

---
**Phase**: 32 | **Component**: Editor  
**Estimated Time**: 30-40 minutes
