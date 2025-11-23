# Phase 100: Import JSON Project

## Goal
Load a saved project from a JSON file

## Group
**Project Management**

## Feature to Implement

### ONE Feature: Project Deserialization
**Purpose**: Restore a previous session

**Requirements**:

#### 1. What to Build
- **Trigger**: File > Open Project.
- **UI**: File Picker (`.json`, `.mbp`).
- **Logic**:
    - Read file -> Parse JSON.
    - Clear current timeline.
    - Reconstruct Tracks and Clips.
    - **Link Media**:
        - Check if `mediaId` exists in IndexedDB.
        - If yes, link it.
        - If no, show "Missing Media" placeholder (Red clip?).

#### 2. Interaction
- Open file -> Timeline populates.

#### 3. Files to Create/Modify
- `assets/js/project/project-loader.js`
- `assets/js/models/Project.js` (`fromJSON()` method)

#### 4. What NOT to Do
- ❌ Do NOT try to auto-find moved media files.

## Testing Checklist
- [ ] Loading JSON restores clips
- [ ] Correctly links existing media
- [ ] Handles missing media gracefully (no crash)
- [ ] Timeline renders correctly after load

## Done When
✅ Can load project from JSON  
✅ Ready for Phase 101
