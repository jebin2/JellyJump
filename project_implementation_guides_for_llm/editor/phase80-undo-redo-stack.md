# Phase 80: Undo/Redo Stack (Command Pattern)

## Goal
Implement a robust Undo/Redo system using the Command Pattern

## Group
**Undo/Redo**

## Feature to Implement

### ONE Feature: Command History
**Purpose**: Track user actions to allow reverting changes

**Requirements**:

#### 1. What to Build
- **Command Class**: Base class for all undoable actions.
    - `execute()`
    - `undo()`
- **History Manager**:
    - `undoStack`: Array of executed commands
    - `redoStack`: Array of undone commands
    - `push(command)`: Executes and adds to stack, clears redo
    - `undo()`: Pops from undo, calls `undo()`, pushes to redo
    - `redo()`: Pops from redo, calls `execute()`, pushes to undo

#### 2. Commands to Implement (Examples)
- `MoveClipCommand(clipId, oldTime, newTime, oldTrack, newTrack)`
- `TrimClipCommand(clipId, oldStart, oldDuration, newStart, newDuration)`
- `AddClipCommand(clip)`
- `DeleteClipCommand(clip)`
- `SplitClipCommand(originalClip, newClip)`

#### 3. Files to Create/Modify
- `assets/js/history/Command.js`
- `assets/js/history/HistoryManager.js`
- `assets/js/commands/MoveClipCommand.js`
- `assets/js/commands/TrimClipCommand.js`
- ...etc

#### 4. Integration
- Refactor existing actions (Move, Trim, Delete) to use `HistoryManager.push(new Command(...))` instead of direct modification.

#### 5. What NOT to Do
- ❌ Do NOT implement state snapshotting (saving entire JSON every time). It's too heavy. Use Command Pattern.

## Testing Checklist
- [ ] Performing an action adds to undo stack
- [ ] Undo reverts the action correctly
- [ ] Redo re-applies the action correctly
- [ ] Performing a new action clears the redo stack
- [ ] Stack limit (e.g., 50 items) works (optional)

## Done When
✅ HistoryManager is implemented  
✅ At least one action (e.g., Move) is refactored to use Commands  
✅ Undo/Redo logic is solid  
✅ Ready for Phase 81
