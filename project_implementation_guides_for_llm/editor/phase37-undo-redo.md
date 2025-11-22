# Phase 37: Undo/Redo System

## Goal
Implement comprehensive undo/redo system for all timeline editing operations

## Features to Implement

### Feature 1: Undo Stack Data Structure
**Purpose**: Store history of editing actions

**Requirements**:
- Array of action objects (undo stack)
- Each action object contains:
  - `id`: Unique identifier
  - `type`: Action type ("trim", "cut", "delete", "move", etc.)
  - `timestamp`: When action performed
  - `data`: Action-specific data needed to reverse it
- Maximum stack size: 50 actions (configurable)
- When stack full, remove oldest action
- Current position pointer in stack

### Feature 2: Redo Stack
**Purpose**: Store undone actions for redo

**Requirements**:
- Separate array for redo stack
- Populated when user undoes action
- Cleared when new action performed (can't redo after new edit)
- Same data structure as undo stack

### Feature 3: Action Recording
**Purpose**: Capture editing operations from previous phases

**Requirements**:
- **Trim** (Phase 34):
  - Original clip start/end/trim values
  - New clip start/end/trim values
  - Clip ID and track ID
- **Cut** (Phase 35):
  - Original clip data (before split)
  - Two new clip IDs and data
  - Split time
- **Delete** (Phase 35):
  - Deleted clip(s) full data
  - Position and track
  - Surrounding clips (for gap info)
- **Move** (Phase 36):
  - Original position (startTime, trackId)
  - New position
  - Clip ID
- **Add Clip** (Phase 31 drop):
  - New clip data
  - Position and track

### Feature 4: Undo Function
**Purpose**: Reverse last action

**Requirements**:
- **Trigger**: 
  - Toolbar **[🔄 Undo]** button (from Phase 30)
  - Keyboard: **Ctrl/Cmd + Z**
- **Operation**:
  1. Get last action from undo stack
  2. Based on action type, reverse it:
     - **Trim**: Restore original trim values
     - **Cut**: Merge clips back or restore original
     - **Delete**: Re-add deleted clip(s)
     - **Move**: Move clip back to original position
  3. Update timeline state
  4. Re-render timeline
  5. Push action to redo stack
  6. Update undo button state (disable if stack empty)

### Feature 5: Redo Function
**Purpose**: Reapply undone action

**Requirements**:
- **Trigger**:
  - Toolbar **[↩️ Redo]** button (from Phase 30)
  - Keyboard: **Ctrl/Cmd + Y** or **Ctrl/Cmd + Shift + Z**
- **Operation**:
  1. Get last action from redo stack
  2. Reapply the action (same as original operation)
  3. Update timeline state
  4. Re-render timeline
  5. Push action back to undo stack
  6. Update redo button state (disable if stack empty)

### Feature 6: Button State Management
**Purpose**: Enable/disable undo/redo buttons appropriately

**Requirements**:
- **Undo button**:
  - Enabled when undo stack has items
  - Disabled when stack empty
  - Show tooltip with last action description
- **Redo button**:
  - Enabled when redo stack has items
  - Disabled when stack empty
  - Show tooltip with redoable action
- Update states after every operation
- Visual styling for disabled state (grayed out)

### Feature 7: Undo/Redo Notifications (Optional)
**Purpose**: Inform user what was undone/redone

**Requirements**:
- Show brief toast notification:
  - "Undone: Trim clip"
  - "Redone: Move clip"
- Auto-dismiss after 2-3 seconds
- Position: Bottom-right of timeline
- Theme styling (Dark Neobrutalism)

### Feature 8: Undo History Panel (Optional)
**Purpose**: Visual history of all actions

**Requirements**:
- Panel showing list of recent actions
- Click action to jump to that state
- Highlight current position in history
- Accessible from timeline settings
- Useful for debugging and power users

### Feature 9: State Integrity
**Purpose**: Ensure timeline state stays consistent

**Requirements**:
- Validate timeline state after undo/redo
- Check for orphaned clips
- Verify clip positions don't overlap (unless allowed)
- Recalculate timeline duration
- Update Properties Panel if clip selection changes
- Sync playhead if needed

### Feature 10: Persistence (Optional)
**Purpose**: Save undo history across sessions

**Requirements**:
- Serialize undo/redo stacks to localStorage
- Restore on project load
- Limit stored history to recent 20 actions (reduce storage)
- Clear on project close or new project

## Testing Checklist
- [ ] Undo stack stores actions correctly
- [ ] Redo stack cleared when new action performed
- [ ] Ctrl+Z triggers undo
- [ ] Undo button triggers undo
- [ ] Undo reverses trim operations
- [ ] Undo reverses cut operations
- [ ] Undo reverses delete operations
- [ ] Undo reverses move operations
- [ ] Ctrl+Y triggers redo (or Ctrl+Shift+Z)
- [ ] Redo button triggers redo
- [ ] Redo reapplies undone action
- [ ] Undo button disabled when stack empty
- [ ] Redo button disabled when stack empty
- [ ] Timeline state consistent after undo/redo
- [ ] Maximum stack size enforced (50 actions)
- [ ] Toast notifications show (if implemented)

## Done When
✅ Undo/redo stack implemented  
✅ All editing operations recordable  
✅ Undo reverses all operation types  
✅ Redo reapplies undone actions  
✅ Keyboard shortcuts functional  
✅ Button states update correctly  
✅ Timeline state stays consistent  
✅ All tests pass  
✅ Ready for Phase 38 (Effects)

---
**Phase**: 37 | **Component**: Editor  
**Estimated Time**: 30-40 minutes
