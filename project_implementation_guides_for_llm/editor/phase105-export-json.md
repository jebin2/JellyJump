# Phase 105: Export JSON Project

## Goal
Save the project state to a JSON file

## Group
**Export**

## Feature to Implement

### ONE Feature: Project Serialization
**Purpose**: Backup or share projects

**Requirements**:

#### 1. What to Build
- **Trigger**: File > Save Project (or Export > JSON).
- **Logic**:
    - Serialize `Timeline` object and all `Clips`.
    - Format:
        ```json
        {
          "version": "1.0",
          "id": "uuid",
          "name": "My Project",
          "tracks": [...],
          "clips": [...]
        }
        ```
    - Trigger download of `.mbp` (MediaBunny Project) or `.json` file.

#### 2. Data Handling
- **Media References**: Store `mediaId`.
    - **Warning**: If media is local (IndexedDB), sharing JSON won't work on another PC.
    - **Scope**: Local backup only for now. Or include warning.

#### 3. Files to Create/Modify
- `assets/js/export/json-export.js`
- `assets/js/models/Project.js` (`toJSON()` method)

#### 4. What NOT to Do
- ❌ Do NOT bundle media files into the JSON (too huge). Just references.

## Testing Checklist
- [ ] JSON file downloads
- [ ] Structure is valid
- [ ] All clip properties are preserved

## Done When
✅ Can save project to JSON  
✅ Ready for Phase 100 (Import)
