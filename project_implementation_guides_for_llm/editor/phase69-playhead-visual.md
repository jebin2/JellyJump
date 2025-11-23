# Phase 69: Playhead Visual

## Goal
Create the visual playhead (vertical line) indicating current playback time

## Group
**Timeline Interaction**

## Feature to Implement

### ONE Feature: Timeline Playhead
**Purpose**: Visual indicator of the current time position on the timeline

**Requirements**:

#### 1. What to Build
Create the playhead element:
- Vertical line spanning the entire timeline height (ruler + tracks)
- Handle (triangle/shape) at the top in the ruler area
- Positioned absolutely based on current time
- High z-index (above clips and grid)
- Visual styling (red or accent color)

#### 2. Playhead Structure
The playhead consists of two parts:
- **Head/Handle**: In the ruler area (top 30px)
  - Shape: Inverted triangle or rectangle with pointer
  - Draggable target (interaction in Phase 71)
- **Line**: Vertical line extending down through all tracks
  - Height: Full height of timeline container
  - Width: 1-2px

#### 3. Positioning Logic
Calculate horizontal position:
```
left = currentTime * pixelsPerSecond
Example: At 10.5 seconds with 50px/s zoom
left = 10.5 * 50 = 525px
```
- Position is relative to the scrollable timeline content
- Moves with the content when scrolling horizontally
- Updates continuously during playback (Phase 70)

#### 4. Styling Requirements
Apply Dark Neobrutalism theme:
- **Color**: Bright Red (`#FF0000`) or Theme Accent (high visibility)
- **Line**: 2px solid, full height
- **Head**: 
  - Width: 12-16px
  - Height: 12-16px
  - Shape: Polygon (triangle pointing down) or custom SVG
  - Shadow: Small drop shadow for separation
- **Z-Index**: Highest in timeline (above clips, grid, markers)

#### 5. Initial State
- Start position: 0:00 (0px)
- Visible immediately when timeline loads
- Stays at 0 until playback or seeking occurs

#### 6. DOM Placement
- Place inside the scrollable timeline content container
- Must be a sibling to the ruler and track container content
- NOT inside the fixed track headers area

#### 7. Responsiveness
- Height must dynamically adjust if tracks are added/removed
- Use CSS `height: 100%` or JavaScript to update height
- Must remain visible during horizontal scroll (if within viewport)

#### 8. Accessibility
- `role="slider"` (or similar)
- `aria-label="Playhead"`
- `aria-valuenow="[current time]"`
- `aria-valuemin="0"`
- `aria-valuemax="[project duration]"`
- Focusable for keyboard navigation (Left/Right arrows to seek - Phase 71)

#### 9. Files to Create/Modify
- `editor.html` - Add playhead HTML structure
- `assets/css/editor.css` - Add playhead styles
- `assets/js/timeline.js` - Add playhead management logic

#### 10. JavaScript Organization
Extend Timeline class:
- `createPlayhead()` - Create DOM elements
- `updatePlayheadPosition(time)` - Move playhead to specific time
- `getPlayheadPosition()` - Get current pixel position
- `setPlayheadHeight(height)` - Update vertical line length

#### 11. Performance Considerations
- Use `transform: translateX(...)` for movement (GPU accelerated) instead of `left` property
- Avoid layout thrashing when updating position frequently

#### 12. Edge Cases
- **End of Timeline**: Playhead should stop at project duration (or loop)
- **Zoom Change**: Position must be recalculated immediately
- **Window Resize**: Height might need update

#### 13. What NOT to Do
- ❌ Do NOT implement dragging/scrubbing (Phase 71)
- ❌ Do NOT implement playback sync (Phase 70)
- ❌ Do NOT implement auto-scroll (page follows playhead)
- This phase: **Visual element and positioning logic ONLY**

**MediaBunny Integration**: Not applicable for visual element

## References
- **Phase 62**: Ruler structure (playhead handle lives here)
- **Phase 64**: Track container (playhead line extends here)
- **Phase 70**: Will drive playhead movement during playback
- **Phase 71**: Will enable dragging the playhead

## Testing Checklist
- [ ] Playhead visible at 0:00 on load
- [ ] Handle appears in ruler area
- [ ] Line extends full height of tracks
- [ ] Color is high contrast (Red/Accent)
- [ ] Z-index is correct (above clips)
- [ ] `updatePlayheadPosition(time)` moves element correctly
- [ ] Position accurate at different zoom levels (manual test)
- [ ] Playhead scrolls with timeline content
- [ ] No console errors

## Done When
✅ Playhead DOM element created  
✅ Visual styling applied (Handle + Line)  
✅ Positioning logic implemented (time -> pixels)  
✅ Updates position via JS method  
✅ Resizes height with timeline  
✅ All tests pass  
✅ Ready for Phase 70 (Playhead-Preview Sync)

---
**Phase**: 69 | **Component**: Editor | **Group**: Timeline Interaction  
**Estimated Time**: 15 min

## Implementation Notes
- Use `pointer-events: none` on the vertical line to allow clicking clips underneath (unless dragging)
- The handle should have `pointer-events: auto` for future dragging
- CSS `will-change: transform` can help performance
