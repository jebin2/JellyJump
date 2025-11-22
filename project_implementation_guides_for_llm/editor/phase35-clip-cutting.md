# Phase 35: Clip Cutting & Deletion

## Goal
Implement clip splitting at playhead and clip deletion

## Features to Implement

### Feature 1: Cut/Split at Playhead
**Purpose**: Divide one clip into two at current playhead position

**Requirements**:
- **Trigger**: 
  - Toolbar **[✂️ Cut]** button (from Phase 30)
  - Keyboard shortcut: **S** key
- **Precondition**: Playhead must be over a clip
- **Operation**:
  1. Find clip under playhead
  2. Calculate split time relative to clip
  3. Create two new clips from original:
     - **Clip A**: Original start → playhead
     - **Clip B**: Playhead → original end
  4. Preserve original trim values
  5. Remove original clip
  6. Add two new clips to track
- Visual feedback: Clips separate with small gap or aligned

### Feature 2: Split Time Calculation
**Purpose**: Determine correct trim values for split clips

**Requirements**:
- Get playhead time: `playheadTime`
- Get original clip:
  - `startTime`, `endTime`
  - `trimStart`, `trimEnd`
  - `sourceFile`, `duration`
- **Clip A** (left part):
  - `startTime`: Original startTime
  - `endTime`: playheadTime
  - `trimStart`: Original trimStart
  - `trimEnd`: Original trimStart + (playheadTime - startTime)
- **Clip B** (right part):
  - `startTime`: playheadTime
  - `endTime`: Original endTime
  - `trimStart`: Original trimStart + (playheadTime - original startTime)
  - `trimEnd`: Original trimEnd
- Copy effects, filters, and properties to both clips

### Feature 3: Cut Visual Feedback
**Purpose**: Show split happening

**Requirements**:
- Highlight clip under playhead before cut
- Show cut line at playhead (dashed vertical line)
- Animate split: Clips slide apart slightly
- Flash or highlight new clips briefly
- Update timeline rendering
- Move playhead to gap between clips or to Clip B start

### Feature 4: Clip Deletion
**Purpose**: Remove selected clip from timeline

**Requirements**:
- **Trigger**:
  - Toolbar **[🗑️ Delete]** button (from Phase 30)
  - Keyboard shortcut: **Delete** or **Backspace** key
- **Precondition**: At least one clip selected
- **Operation**:
  1. Get selected clip(s)
  2. Remove from track's clip array
  3. Re-render timeline
  4. Leave gap or close gap (based on settings)
- Confirmation dialog (optional): "Delete clip?"

### Feature 5: Gap Handling
**Purpose**: Manage space left after deletion

**Requirements**:
- **Leave Gap** (default):
  - Delete clip, leave empty space
  - Timeline duration unchanged
  - Other clips stay at same positions
- **Ripple Delete** (optional, from settings):
  - Delete clip
  - Move all clips after deletion point left
  - Close gap
  - Timeline duration shortened
- Setting toggle in timeline settings (Phase 30)

### Feature 6: Multi-Clip Delete (Optional)
**Purpose**: Delete multiple selected clips at once

**Requirements**:
- Select multiple clips with Ctrl+Click (from Phase 34)
- Delete all selected clips
- Handle gaps for each deletion
- Confirmation: "Delete X clips?"
- Efficient batch operation
- Single undo entry for entire operation

### Feature 7: Undo Integration
**Purpose**: Prepare data for undo system (Phase 37)

**Requirements**:
- **For Cut**: Store undo data
  - Action type: "cut"
  - Original clip data
  - Two new clip data
  - Position and track info
- **For Delete**: Store undo data
  - Action type: "delete"
  - Deleted clip(s) data
  - Position and track info
- Push to undo stack (implemented in Phase 37)
- Mark project as modified (*)

### Feature 8: Edge Cases
**Purpose**: Handle unusual scenarios gracefully

**Requirements**:
- **Cut at clip edge**: Do nothing or show warning
- **Cut with no clip under playhead**: Show message "No clip to cut"
- **Delete with no selection**: Disable delete button/show message
- **Cut very small clips**: Enforce minimum clip duration (0.1s)
- **Delete last clip on track**: Leave track empty

## Testing Checklist
- [ ] Cut button in toolbar triggers split
- [ ] S key triggers split
- [ ] Playhead must be over clip to cut
- [ ] Clip splits into two at playhead
- [ ] Split clips have correct start/end times
- [ ] Split clips preserve effects and properties
- [ ] Delete button removes selected clip
- [ ] Delete/Backspace key removes clip
- [ ] Gap appears after delete (leave gap mode)
- [ ] Ripple delete closes gap (if implemented)
- [ ] Multi-clip delete works (if implemented)
- [ ] Can't cut/delete with invalid selection
- [ ] Undo data prepared for Phase 37
- [ ] Project marked as modified after operation

## Done When
✅ Clip cutting at playhead functional  
✅ Split clips have correct trim values  
✅ Clip deletion works  
✅ Gap handling implemented  
✅ Undo data prepared (completed in Phase 37)  
✅ Edge cases handled gracefully  
✅ All tests pass  
✅ Ready for Phase 36 (Dragging)

---
**Phase**: 35 | **Component**: Editor  
**Estimated Time**: 25-35 minutes
