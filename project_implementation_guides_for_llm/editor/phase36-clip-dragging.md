# Phase 36: Clip Drag & Rearrange

## Goal
Implement drag-and-drop to move and rearrange clips on timeline

## Features to Implement

### Feature 1: Drag Initialization
**Purpose**: Make selected clips draggable

**Requirements**:
- Selected clip is draggable (from Phase 34)
- Cursor changes to move (✋) when hovering over clip body (not edges)
- Mouse down + move initiates drag
- Create semi-transparent drag ghost/clone
- Original clip remains visible but dimmed
- Z-index drag ghost above other clips

### Feature 2: Drag Visual Feedback
**Purpose**: Show clip position during drag

**Requirements**:
- Drag ghost follows mouse cursor
- Show new position preview:
  - Outline or placeholder where clip will drop
  - Display target time at drop position
- Highlight target track if dragging to different track
- Show "invalid drop" cursor if hovering over invalid area
- Smooth drag animation (60fps)

### Feature 3: Horizontal Dragging (Same Track)
**Purpose**: Move clip left or right on same track

**Requirements**:
- Drag clip horizontally
- Calculate new `startTime` from mouse X position
- Use `pixelsToTime()` from Phase 32
- **Constraints**:
  - Cannot drag before timeline start (time 0)
  - Cannot overlap with other clips (optional: push other clips)
  - Snap to grid if enabled (from Phase 30 settings)
- Update clip position in real-time during drag

### Feature 4: Vertical Dragging (Change Track)
**Purpose**: Move clip to different track

**Requirements**:
- Drag clip vertically to another track
- Detect which track mouse is over
- Only allow compatible track types:
  - Video clip → Video tracks only
  - Audio clip → Audio track only
  - Text clip → Text track only
- Highlight target track during drag
- Update clip's `trackId` on drop
- Reject drop if track type incompatible

### Feature 5: Snapping Behavior
**Purpose**: Align clips to grid and other clips

**Requirements**:
- **Snap to Grid** (if enabled):
  - Round drop position to nearest snap interval (e.g., 0.5s)
  - Visual feedback when snapping (slight magnetic pull)
- **Magnetic Snapping** (if enabled):
  - Snap to other clip boundaries (start/end)
  - Snap to playhead position
  - Snap threshold: 10-20 pixels
  - Show visual indicator when snapped (dotted line or flash)
- Settings toggles in Phase 30

### Feature 6: Drop & Position Update
**Purpose**: Commit new clip position on drop

**Requirements**:
- Mouse up completes drag
- Calculate final position from mouse X and Y
- Update clip data:
  - `startTime`: New position on timeline
  - `endTime`: startTime + duration
  - `trackId`: New track (if changed)
- Remove drag ghost
- Re-render timeline with updated clip
- Animate clip to final position (smooth transition)

### Feature 7: Collision Detection
**Purpose**: Handle overlapping clips

**Requirements**:
- **Default**: Prevent overlap
  - Check if new position overlaps existing clip
  - If overlap detected, reject drop
  - Show error cursor or message
- **Ripple Mode** (optional):
  - Push clips to the right to make space
  - Update positions of affected clips
- **Overwrite Mode** (optional):
  - Delete overlapped clips
  - Confirmation dialog before overwrite

### Feature 8: Undo Integration
**Purpose**: Prepare data for undo (Phase 37)

**Requirements**:
- Store undo data before drop:
  - Action type: "move"
  - Original clip position (startTime, trackId)
  - New clip position
  - Affected clips (if ripple/overwrite)
- Push to undo stack (implemented in Phase 37)
- Mark project as modified (*)

### Feature 9: Multi-Clip Drag (Optional)
**Purpose**: Move multiple selected clips together

**Requirements**:
- Select multiple clips with Ctrl+Click (Phase 34)
- Drag any selected clip → all selected clips move
- Maintain relative positions between clips
- Apply same offset to all clips
- Collision detection for all clips
- Single undo entry for entire operation

## Testing Checklist
- [ ] Selected clip is draggable (cursor changes)
- [ ] Drag ghost appears when dragging
- [ ] Clip moves horizontally on same track
- [ ] Drop position calculated correctly from mouse X
- [ ] Clip can be dragged to compatible track vertically
- [ ] Incompatible track drops rejected
- [ ] Snapping to grid works (if enabled)
- [ ] Snapping to other clips works (magnetic snapping)
- [ ] Collision detection prevents overlap
- [ ] Clip position updates on drop
- [ ] Timeline re-renders after drop
- [ ] Undo data prepared for Phase 37
- [ ] Multi-clip drag works (if implemented)
- [ ] Ripple/overwrite modes work (if implemented)

## Done When
✅ Clip dragging functional  
✅ Horizontal and vertical dragging works  
✅ Snapping behaviors implemented  
✅ Collision detection prevents overlap  
✅ Drop updates clip position  
✅ Visual feedback during drag  
✅ Undo integration ready (completed in Phase 37)  
✅ All tests pass  
✅ Ready for Phase 37 (Undo/Redo)

---
**Phase**: 36 | **Component**: Editor  
**Estimated Time**: 30-40 minutes
