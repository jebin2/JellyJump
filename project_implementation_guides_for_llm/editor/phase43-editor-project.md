# Phase 43: Editor Project

## Goal
Manage editor projects with JSON import/export, multi-tab persistence, auto-save, and crash recovery for seamless project workflow.

**MediaBunny Integration**: Project files should store conversion configurations and settings. **Consult** mediabunny-llms-full.md for:
- Serializable conversion options (trim times, format, bitrate, etc.)
- Input file references that can be restored
- Non-serializable state to exclude (active Conversion, decoders)

## Features to Implement

### Feature 1: JSON Import Button
**Purpose**: Import previously exported project configurations

**Requirements**:
- **📥 Import Button**: Located in top navigation bar (next to Export)
- **File Picker**: Accept `.json` files only
- **JSON Validation**: Verify structure matches expected schema
- **Error Handling**: Show clear error if JSON is invalid or corrupted
- **Import Options Modal**:
  - "Open in new tab" (creates new project tab)
  - "Replace current project" (overwrites active tab, confirm if unsaved)
- **Load Project Data**: Parse JSON and restore:
  - Project name and metadata
  - Canvas settings (resolution, fps, duration)
  - Timeline tracks and clips
  - Effects and filters
  - Export settings
- **Success Message**: "Project '{projectName}' imported successfully!"

### Feature 2: Multi-Tab Persistence
**Purpose**: Save and restore multiple project tabs across browser sessions

**Requirements**:
- **localStorage Keys**:
  - `mediabunny_tabs`: Array of project UUIDs `["uuid-1", "uuid-2", ...]`
  - `mediabunny_project_{uuid}`: Individual project data (full JSON structure)
  - `mediabunny_active_tab`: Currently active tab UUID
- **Tab Creation**: Generate UUID for new tabs, add to `mediabunny_tabs` array
- **Tab Switching**: Save current tab state, load target tab state
- **Tab Closing**: 
  - Remove from `mediabunny_tabs` array
  - Delete `mediabunny_project_{uuid}` from localStorage
  - Prompt if unsaved changes exist (check for `*` indicator)
- **Session Restore**: On page load, restore all tabs from localStorage
- **Max Tabs**: Limit to 10 tabs, show warning: "Maximum 10 projects open. Close a tab to create new."

### Feature 3: Project Data Structure
**Purpose**: Define format for saving projects

**Requirements**:
- JSON structure containing all edits
- Clip list with timestamps
- Effect/filter data
- Timeline settings
- Project metadata (name, created date)

### Feature 4: Save Project (Enhanced)
**Purpose**: Export project to file

**Requirements**:
- Save to .mbproj file (JSON format)
- Include all timeline data
- Trigger file download
- Confirm save success
- Store project name

### Feature 5: Load Project (Enhanced)
**Purpose**: Import saved project file

**Requirements**:
- File upload .mbproj file
- Parse JSON data
- Restore timeline state
- Restore all clips and effects
- Maintain original video references

### Feature 6: Auto-Save (Multi-Tab)
**Purpose**: Prevent data loss

**Requirements**:
- Auto-save ALL open tabs to localStorage every 2 minutes
- Save to `mediabunny_project_{uuid}` for each tab
- Silent background save, don't interrupt user
- Update "Last saved" timestamp displayed in UI
- Debounce during rapid changes (wait 2 seconds after last edit)
- Clear unsaved indicator `*` after successful auto-save

### Feature 7: Crash Recovery (Multi-Tab)
**Purpose**: Restore after browser/page crash

**Requirements**:
- On page load, check localStorage for `mediabunny_tabs`
- If tabs found, restore all project tabs
- Restore active tab from `mediabunny_active_tab`
- Show notification: "Restored {count} project(s) from last session"
- Clear recovery data only when all tabs explicitly closed

### Feature 8: Project Management (Enhanced)
**Purpose**: Name and organize projects

**Requirements**:
- **Project Name Field**: Editable project name in tab (double-click to edit)
- **Rename Project**: Right-click tab → "Rename"
- **New Project**: Click `[+]` button creates new tab with "Untitled Project"
- **Duplicate Project**: Right-click tab → "Duplicate" (creates new tab with same settings)
- **Recent Projects List** (optional): Dropdown showing last 5 closed projects
- **Project Name in JSON**: Used when exporting JSON


### Feature 9: JSON Import Use Cases
**Purpose**: Document typical workflows for JSON import

**Use Cases**:
1. **Template Reuse**: Import "Wedding Video Template.json" with preset effects/transitions, swap footage
2. **Project Sharing**: Export JSON from desktop, import on laptop to continue editing
3. **Configuration Libraries**: Build collection of effect presets ("Cinematic.json", "Vintage.json")
4. **Batch Processing**: Apply same editing pipeline to multiple videos
5. **Backup/Version Control**: Export JSON snapshots at key milestones

## Testing Checklist
- [ ] Import button appears in top navigation
- [ ] Can import valid JSON files
- [ ] JSON validation catches invalid files
- [ ] Import options modal shows (new tab vs replace)
- [ ] Project data restores correctly from JSON
- [ ] Multi-tab persistence works across browser refresh
- [ ] Can create up to 10 tabs (warning on limit)
- [ ] Tab switching saves/loads state correctly
- [ ] Closing tabs prompts if unsaved changes exist
- [ ] Auto-save works for all open tabs
- [ ] Crash recovery restores all tabs on page load
- [ ] Can rename projects (double-click or right-click)
- [ ] Can duplicate projects (right-click)
- [ ] Project name appears in exported JSON

## Done When
✅ JSON Import button functional with validation  
✅ Multi-tab persistence works with localStorage  
✅ Save/Load enhanced with tab support  
✅ Auto-save works for all tabs independently  
✅ Crash recovery restores all tabs  
✅ Project management features complete (rename, duplicate)  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 43 | **Component**: Editor  
**Estimated Time**: 50-70 minutes

