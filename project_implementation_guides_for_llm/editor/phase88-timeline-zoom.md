# Phase 78: Timeline Zoom

## Goal
Implement zoom in/out functionality for the timeline

---

## What to Build

Timeline zoom:
- Zoom in/out controls
- Slider or buttons
- Keyboard shortcuts (+/-)
- Update ruler divisions
- Maintain playhead position
- Min/max zoom limits

---

## Feature to Implement

### ONE Feature: Timeline Zooming
**Purpose**: Allow users to change the time scale (pixels per second) to see more detail or the whole project

**Requirements**:

#### 1. What to Build
Implement zoom logic:
- **Zoom Controls**: Slider or Buttons (+/-) in toolbar
- **Wheel Zoom**: Ctrl + Scroll Wheel to zoom
- **Scale Update**: Dynamically change `pixelsPerSecond`
- **Re-render**: Update ruler, clips, and playhead positions

#### 2. Zoom Levels
Define zoom range:
- **Min Zoom**: Fit full project or 10px/s (Overview)
- **Max Zoom**: 100-200px/s (Frame level detail)
- **Default**: 50px/s

#### 3. State Management
- Store `zoomLevel` (float) or `pixelsPerSecond` in Timeline state
- Default: 1.0 (or 50px/s)

#### 4. Interaction - Toolbar
- Add Zoom Slider or +/- buttons to Timeline Toolbar (Phase 65) or Header (Phase 61)
- Slider range: 0.1 to 4.0 (multipliers)
- Update timeline in real-time as slider moves

#### 5. Interaction - Mouse Wheel
- Listener on Timeline Container:
- `wheel` event with `Ctrl` key pressed
- `deltaY < 0`: Zoom In
- `deltaY > 0`: Zoom Out
- **Zoom Focus**: Ideally zoom towards the mouse pointer position (math heavy) OR just center/playhead

#### 6. Re-rendering Logic
When zoom changes:
1. Update `pixelsPerSecond`
2. **Ruler**: Recalculate width, grid spacing, and time markers (Phase 62/63)
3. **Tracks**: Update width (Phase 64)
4. **Clips**: Recalculate `left` and `width` for ALL clips (Phase 67)
5. **Playhead**: Recalculate position (Phase 69)
6. **Scroll**: Adjust scroll position to maintain focus (e.g., keep playhead centered)

#### 7. Grid/Marker Density
Adaptive grid (from Phase 63):
- Zoom In: Show more tick marks (every 1s -> every frame)
- Zoom Out: Show fewer tick marks (every 5s -> 10s -> 30s)
- Update labels accordingly

#### 8. Performance
- This is an expensive operation (DOM reflows)
- **Debounce**: If using slider, maybe throttle updates
- **Batch DOM**: Use `requestAnimationFrame` to batch visual updates
- **CSS Variables**: Could use a CSS variable `--pixels-per-second` and `calc()` for positions? (Advanced, maybe too complex for v1) -> **Stick to JS recalculation for v1**

#### 9. Files to Create/Modify
- `assets/js/timeline.js` - Add zoom handling methods
- `assets/js/timeline-zoom.js` - Optional: separate zoom logic
- `editor.html` - Add zoom controls

#### 10. JavaScript Organization
Timeline class methods:
- `setZoom(level)`
- `zoomIn()`
- `zoomOut()`
- `handleWheelZoom(e)`
- `updateZoomVisuals()` - Orchestrates the re-renders

#### 11. What NOT to Do
- ❌ Do NOT implement vertical zoom (track height resizing) yet
- ❌ Do NOT implement "Zoom to Fit" (unless easy)
- This phase: **Horizontal time scale zoom ONLY**

**MediaBunny Integration**: Not applicable

## References
- **Phase 62**: Ruler Grid (needs update)
- **Phase 63**: Ruler Markers (needs update)
- **Phase 67**: Clip Rendering (needs update)

---

## Testing Checklist Checklist
- [ ] Zoom slider changes timeline scale
- [ ] Ctrl+Wheel zooms in/out
- [ ] Ruler width updates correctly
- [ ] Grid lines/markers adjust density
- [ ] Clips resize and reposition correctly
- [ ] Playhead stays at correct time (visually moves)
- [ ] Zoom limits (min/max) respected
- [ ] No visual glitches (overlapping clips, broken ruler)
- [ ] Performance is acceptable (not freezing)

---

## Done When
✅ Zoom controls visible and functional  
✅ Mouse wheel zoom functional  
✅ Timeline elements scale correctly  
✅ Grid density adapts to zoom level  
✅ Scroll position maintained (reasonable UX)  
✅ All tests pass  
✅ Ready for Phase 73 (Timeline Edit Actions - Split/Trim)

---
**Phase**: 78 | **Component**: Editor | **Group**: Timeline Interaction  
**Estimated Time**: 30 min

## Implementation Notes
- Zooming towards the mouse cursor is the "gold standard" UX.
  - Math: `newScrollLeft = (mouseTime * newPPS) - mouseOffsetFromLeft`
  - If too hard, just keeping the Playhead centered is a good fallback.
- This completes the core "Navigation & Interaction" block!
