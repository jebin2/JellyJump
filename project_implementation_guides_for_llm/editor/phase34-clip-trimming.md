# Phase 34: Clip Trimming

## Goal
Implement clip trimming by dragging edges to adjust start/end points

**MediaBunny Integration**: Trimming prepares parameters for MediaBunny Conversion API. **Consult** mediabunny-llms-full.md for:
- `trim: { start, end }` option in Conversion API (used in Phase 42 for export)
- Non-destructive editing pattern
- Maintaining original source references

## Features to Implement

### Feature 1: Clip Selection System
**Purpose**: Select clips for editing operations

**Requirements**:
- Click on clip to select (handled in Phase 31, enhance here)
- Visual selection highlight (bright border, accent color)
- Selected clip state stored
- Emit selection event to Properties Panel (Phase 29)
- Deselect when clicking timeline background
- Only one clip selected at a time (multi-select optional)

### Feature 2: Trim Handles
**Purpose**: Visual indicators for draggable edges

**Requirements**:
- **Left handle**: On left edge of selected clip
- **Right handle**: On right edge of selected clip
- Visual design:
  - Small rectangle or rounded edge
  - Different color from clip body
  - Visible on hover
  - Always visible when clip selected
- Cursor changes to resize (↔) on hover
- Z-index above clip body

### Feature 3: Left Edge Trimming
**Purpose**: Adjust clip start time by dragging left edge

**Requirements**:
- Drag left handle to move clip start
- **Constraints**:
  - Cannot trim before clip's original start (0 in source)
  - Cannot trim past clip's end time
  - Minimum clip duration: 0.1 seconds
- Update clip `trimStart` value (source file trim)
- Update clip `startTime` on timeline
- Recalculate clip width
- Update clip duration display
- Show new start time while dragging (tooltip)

### Feature 4: Right Edge Trimming
**Purpose**: Adjust clip end time by dragging right edge

**Requirements**:
- Drag right handle to move clip end
- **Constraints**:
  - Cannot trim beyond clip's original end (source duration)
  - Cannot trim before clip's start time
  - Minimum clip duration: 0.1 seconds
- Update clip `trimEnd` value
- Update clip `endTime` on timeline
- Recalculate clip width
- Update clip duration display
- Show new end time while dragging (tooltip)

### Feature 5: Visual Feedback During Trim
**Purpose**: Show user what they're doing

**Requirements**:
- Clip partially transparent during drag
- Show timecode tooltip above cursor
- Display new duration on clip
- Snap to grid (if enabled in settings from Phase 30)
- Snap to other clip boundaries (magnetic snapping)
- Smooth drag animation (60fps)
- Preview first frame of trimmed region (optional)

### Feature 6: Trim Persistence
**Purpose**: Save trim values to clip data

**Requirements**:
- Update clip object properties:
  - `trimStart`: Seconds from source file start
  - `trimEnd`: Seconds from source file end
  - `startTime`: Position on timeline
  - `endTime`: Position on timeline
  - `duration`: Calculated from endTime - startTime
-Emit event to update timeline state
- Mark project as modified (unsaved indicator *)
- Add to undo stack (for Phase 37)

### Feature 7: Trim Visual Update
**Purpose**: Update clip appearance after trim

**Requirements**:
- Recalculate clip position (`startTime` → pixels)
- Recalculate clip width (`duration` → pixels)
- Update clip label and duration display
- Update thumbnail if shown
- Refresh Properties Panel info
- Smooth transition animation

### Feature 8: Keyboard Trim Controls (Optional)
**Purpose**: Precise trimming with keyboard

**Requirements**:
- Select clip, then use keyboard:
  - **[**: Trim left edge -1 frame
  - **]**: Trim left edge +1 frame
  - **Shift + [**: Trim right edge -1 frame
  - **Shift + ]**: Trim right edge +1 frame
- Frame duration based on FPS (e.g., 1/30 second at 30fps)
- Visual feedback same as drag trimming

## Testing Checklist
- [ ] Clip selection highlights clip with trim handles
- [ ] Left handle appears on left edge of selected clip
- [ ] Right handle appears on right edge of selected clip
- [ ] Dragging left handle adjusts clip start time
- [ ] Dragging right handle adjusts clip end time
- [ ] Trim respects minimum duration (0.1s)
- [ ] Cannot trim beyond source file bounds
- [ ] Clip width updates during trim
- [ ] Duration display updates
- [ ] Timecode tooltip shows during drag
- [ ] Trim values persist in clip data
- [ ] Snapping works (if enabled)
- [ ] Undo stack updated (verified in Phase 37)
- [ ] Keyboard trim controls work (if implemented)

## Done When
✅ Clip selection with trim handles functional  
✅ Left edge trimming works  
✅ Right edge trimming works  
✅ Trim constraints enforced  
✅ Visual feedback during trim  
✅ Clip data updates persist  
✅ Undo integration ready (completed in Phase 37)  
✅ All tests pass  
✅ Ready for Phase 35 (Cutting)

---
**Phase**: 34 | **Component**: Editor  
**Estimated Time**: 30-40 minutes
