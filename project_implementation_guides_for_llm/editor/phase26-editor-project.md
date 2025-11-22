# Phase 26: Editor Project

## Goal
Implement save/load project (.mbproj format), auto-save every 2 minutes, crash recovery.

## Features to Implement

### Feature 1: Project Data Structure
**Purpose**: Define format for saving projects

**Requirements**:
- JSON structure containing all edits
- Clip list with timestamps
- Effect/filter data
- Timeline settings
- Project metadata (name, created date)

### Feature 2: Save Project
**Purpose**: Export project to file

**Requirements**:
- Save to .mbproj file (JSON format)
- Include all timeline data
- Trigger file download
- Confirm save success
- Store project name

### Feature 3: Load Project
**Purpose**: Import saved project file

**Requirements**:
- File upload .mbproj file
- Parse JSON data
- Restore timeline state
- Restore all clips and effects
- Maintain original video references

### Feature 4: Auto-Save
**Purpose**: Prevent data loss

**Requirements**:
- Save to IndexedDB every 2 minutes
- Silent background save
- Don't interrupt user
- Last auto-save timestamp displayed
- Debounce during rapid changes

### Feature 5: Crash Recovery
**Purpose**: Restore after browser/page crash

**Requirements**:
- On page load, check for auto-saved project
- Prompt to restore if found
- Load last auto-saved state
- Clear recovery data after successful restore

### Feature 6: Project Management
**Purpose**: Name and organize projects

**Requirements**:
- Name project field
- Rename project option
- New project (clear timeline)
- Recent projects list (optional)

## Testing Checklist
- [ ] Project saves to JSON
- [ ] Project loads correctly
- [ ] Auto-save works
- [ ] Crash recovery works
- [ ] Project management works

## Done When
✅ Save/Load works  
✅ Auto-save implemented  
✅ Crash recovery works  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 26 | **Component**: Editor
**Estimated Time**: 40-60 minutes
