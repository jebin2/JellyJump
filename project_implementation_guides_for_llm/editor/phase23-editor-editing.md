# Phase 23: Editor Editing

## Goal
Implement trim (drag clip edges), cut/split at playhead, delete clips, drag to rearrange, undo/redo system.

## Features to Implement

### Feature 1: Trim Clips
**Purpose**: Adjust clip start and end points

**Requirements**:
- Drag left edge to adjust start time
- Drag right edge to adjust end time
- Visual feedback during drag
- Snap to other clips (optional)
- Update clip duration display

### Feature 2: Split/Cut Clips
**Purpose**: Divide clip into two at playhead

**Requirements**:
- Split button or keyboard shortcut (S)
- Split at current playhead position
- Create two separate clips from one
- Maintain original source references
- Update timeline display

### Feature 3: Delete Clips
**Purpose**: Remove clips from timeline

**Requirements**:
- Select clip (click to select)
- Delete key or X button removes clip
- Gap appears where clip was
- Or automatically close gap (ripple delete)
- Confirm before deleting (optional)

### Feature 4: Drag to Rearrange
**Purpose**: Move clips to different positions

**Requirements**:
- Drag clip left or right on timeline
- Visual preview of new position
- Snap to other clips
- Update all affected clip positions
- Smooth animation

### Feature 5: Undo/Redo System
**Purpose**: Revert or reapply editing actions

**Requirements**:
- Track all timeline modifications
- Undo last action (Ctrl+Z)
- Redo undone action (Ctrl+Y)
- Maintain undo stack (limit to 50 actions)
- Update UI after undo/redo

### Feature 6: Selection System
**Purpose**: Select clips for operations

**Requirements**:
- Click to select single clip
- Highlight selected clip
- Ctrl+Click for multi-select (optional)
- Keyboard navigation (arrow keys to select)
- Deselect when clicking timeline background

## Testing Checklist
- [ ] Can trim clips
- [ ] Can split clips
- [ ] Can delete clips
- [ ] Can move clips
- [ ] Undo/Redo works
- [ ] Selection works

## Done When
✅ Editing operations functional  
✅ Undo/Redo implemented  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 23 | **Component**: Editor
**Estimated Time**: 50-70 minutes
