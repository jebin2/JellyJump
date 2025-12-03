# Phase 77: Timeline Scrubbing

## Goal
Enable user to drag the playhead or click ruler to seek (scrubbing)

---

## What to Build

Timeline scrubbing:
- Click ruler to seek
- Drag playhead to scrub
- Update preview in real-time
- Show time tooltip
- Snap to clip edges
- Smooth interaction

---

## Feature to Implement

### ONE Feature: Timeline Scrubbing
**Purpose**: Allow users to manually navigate the timeline by dragging the playhead or clicking the ruler

**Requirements**:

#### 1. What to Build
Implement interaction logic:
- **Click to Seek**: Clicking anywhere on the ruler jumps playhead to that time
- **Drag to Scrub**: Dragging the playhead handle updates time continuously
- **Live Preview**: Video updates frame-by-frame while scrubbing

#### 2. Click Interaction (Ruler)
Event listener on Ruler container:
- `mousedown` or `click`:
  - Calculate time from click X position
  - `time = (clickX + scrollLeft - trackHeaderWidth) / pixelsPerSecond`
  - Clamp time to valid range [0, duration]
  - Call `playbackManager.seek(time)`

#### 3. Drag Interaction (Playhead)
Event listeners on Playhead Handle (and Ruler):
- `mousedown`: Start drag state
  - Pause playback if playing (resume optional on release)
  - Add global `mousemove` and `mouseup` listeners
- `mousemove`:
  - Calculate new time from mouse X
  - Update playhead position visually (immediate)
  - Seek player (throttled/debounced if needed for performance)
- `mouseup`: End drag state
  - Remove global listeners
  - Final seek to ensure precision

#### 4. Scrubbing Performance
- **Visual Playhead**: Update immediately (60fps)
- **Video Seek**: Update as fast as possible, but prevent freezing
  - MediaBunny `seek` might be async
  - Strategy: "Best effort" seeking during drag, precise seek on drop

#### 5. Auto-Scroll (Edge Scrubbing)
If dragging near the edge of the timeline viewport:
- Automatically scroll the timeline horizontally
- Allow scrubbing to continue beyond current view
- Speed proportional to distance from edge (optional)

#### 6. Snapping (Optional for v1)
- Snap to clip start/end points when dragging
- Snap to grid lines
- Hold `Shift` to toggle snapping

#### 7. Styling Updates
- **Cursor**: `cursor: text` or `cursor: pointer` on Ruler
- **Cursor**: `cursor: ew-resize` on Playhead Handle
- **Active State**: Highlight playhead handle while dragging

#### 8. Accessibility
- **Keyboard Navigation**:
  - Focus on Playhead/Timeline
  - `Left/Right Arrow`: Move by 1 frame (or small increment)
  - `Shift + Left/Right`: Move by 1 second (or large increment)
  - `Home`: Jump to start
  - `End`: Jump to end
- Update `aria-valuenow` on change

#### 9. Files to Create/Modify
- `assets/js/timeline.js` - Add mouse/keyboard event handlers
- `assets/js/playback-manager.js` - Ensure seek handles rapid updates

#### 10. JavaScript Organization
Timeline class extensions:
- `attachScrub handlers()`
- `onRulerClick(e)`
- `onPlayheadDragStart(e)`
- `onPlayheadDragMove(e)`
- `onPlayheadDragEnd(e)`
- `handleKeyboardNav(e)`

#### 11. What NOT to Do
- ❌ Do NOT implement clip dragging (moving clips) here
- ❌ Do NOT implement selection box (marquee)
- This phase: **Time navigation ONLY**

**MediaBunny Integration**:
- Heavy use of `Player.seek(time)`

## References
- **Phase 69**: Playhead Visual
- **Phase 70**: Playback Sync (infrastructure for seeking)
- **Phase 62**: Ruler Structure (interaction target)

---

## Testing Checklist Checklist
- [ ] Clicking ruler moves playhead to correct time
- [ ] Video updates to frame at clicked time
- [ ] Dragging playhead moves it smoothly
- [ ] Video scrubs (updates frames) while dragging
- [ ] Dragging works even if mouse leaves ruler area (global listener)
- [ ] Playback pauses when scrubbing starts
- [ ] Keyboard arrows move playhead
- [ ] Auto-scroll works when dragging to edge (optional)
- [ ] No console errors

---

## Done When
✅ Click-to-seek working  
✅ Drag-to-scrub working  
✅ Video updates in real-time (or near real-time)  
✅ Keyboard navigation implemented  
✅ Cursors and active states styled  
✅ All tests pass  
✅ Ready for Phase 72 (Timeline Zoom)

---
**Phase**: 77 | **Component**: Editor | **Group**: Timeline Interaction  
**Estimated Time**: 25 min

## Implementation Notes
- Scrubbing is a high-frequency interaction. Ensure `mousemove` handlers are lightweight.
- If video seeking is slow, update the playhead immediately but debounce the video seek.
