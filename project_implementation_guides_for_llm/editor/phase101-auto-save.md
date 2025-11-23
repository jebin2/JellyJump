# Phase 101: Auto-Save Project

## Goal
Automatically save project state to LocalStorage

## Group
**Project Management**

## Feature to Implement

### ONE Feature: Auto-Save
**Purpose**: Prevent data loss on crash/refresh

**Requirements**:

#### 1. What to Build
- **Trigger**: Timer (every 30s) OR on every action (debounced 1s).
- **Logic**:
    - Serialize Project to JSON.
    - Save to `localStorage.getItem('currentProject')`.
    - Update "Last saved: 10:42 AM" in status bar.

#### 2. Restoration
- On page load (Phase 26/37), check for auto-save.
- If found, load it.

#### 3. Files to Create/Modify
- `assets/js/project/auto-save.js`

#### 4. What NOT to Do
- ❌ Do NOT save to server yet.

## Testing Checklist
- [ ] Changes persist after page refresh
- [ ] "Saved" indicator updates
- [ ] Performance is not impacted (don't save on every mousemove)

## Done When
✅ Auto-save functional  
✅ Ready for Phase 102
