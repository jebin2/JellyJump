# Phase 26: Editor Navigation & Tabs

## Goal
Create top navigation bar with multi-tab project management system

## Features to Implement

### Feature 1: Top Navigation Bar
**Purpose**: Global navigation and primary controls

**Requirements**:
- Fixed position top bar spanning full width
- Height: 50-60px
- Apply Dark Neobrutalism theme styling
- Z-index above all other content
- **Left Section**: App branding
  - Icon: 🎬
  - Text: "MediaBunny Editor"
- **Center Section**: Main menu buttons
  - [File] [Edit] [View] [Effects]
  - Dropdown menus (content can be placeholder for now)
- **Right Section**: Import/Export buttons
  - [📥 Import] button
  - [📤 Export ▾] dropdown button

### Feature 2: Import Button
**Purpose**: Import JSON project files

**Requirements**:
- **[📥 Import]** button in top-right
- Click opens file picker (`.json` files only)
- **Functionality completed in Phase 43**
- Button styling theme colors
- Disabled state if no projects can be loaded

### Feature 3: Export Button & Dropdown
**Purpose**: Access to multiple export options

**Requirements**:
- **[📤 Export ▾]** button with dropdown arrow
- Click toggles dropdown menu
- **Dropdown Menu** with three options:
  - 💾 Export Video (Download)
  - 📚 Export to Media Library
  - 📋 Export JSON
- **Functionality completed in Phase 42**
- Close dropdown when clicking outside
- Theme styling for dropdown

### Feature 4: Multi-Tab Bar Structure
**Purpose**: Container for project tabs

**Requirements**:
- Tab bar positioned directly below top navigation
- Full width container
- Height: 40-45px
- Horizontal flex layout
- Scrollable if tabs overflow (horizontal scroll)
- Apply Dark Neobrutalism borders

### Feature 5: Create New Tab Button
**Purpose**: Add new project tabs

**Requirements**:
- **[+]** button on left of tab bar
- Click creates new empty project tab
- Default project name: "Untitled Project"
- Generate unique UUID for new tab
- Add tab to `mediabunny_tabs` array in localStorage
- Initialize empty project data
- Switch to new tab automatically
- **Max tabs**: 10 tabs limit
  - Show warning: "Maximum 10 projects open. Close a tab to create new."
  - Disable [+] button when at limit

### Feature 6: Project Tab Component
**Purpose**: Individual tab for each project

**Requirements**:
- Tab button with project name
- **Close button** `ⓧ` on right side of tab
- **Unsaved indicator** `*` prefix when project modified
- **Active state**: Highlighted tab (accent color background)
- **Inactive state**: Dimmed/grayed out
- Click to switch to that project
- Max tab width: 200px (truncate long names with ellipsis)
- Hover effects

### Feature 7: Tab Switching
**Purpose**: Change active project

**Requirements**:
- Click inactive tab to activate it
- Save current project state to localStorage before switch
- Update `mediabunny_active_tab` in localStorage
- Load target project data from `mediabunny_project_{uuid}`
- Update all editor panels with new project:
  - Timeline clips
  - Preview player
  - Properties panel
  - Media library (if project-specific)
- Smooth transition (no flicker)

### Feature 8: Tab Close Functionality
**Purpose**: Close individual project tabs

**Requirements**:
- Click `ⓧ` button to close tab
- **If unsaved changes** (has `*` indicator):
  - Show confirmation dialog:
    - "Save changes to [Project Name]?"
    - Buttons: Save | Don't Save | Cancel
  - **Save**: Export JSON → then close
  - **Don't Save**: Close immediately
  - **Cancel**: Do nothing
- **If no unsaved changes**:
  - Close immediately
- Remove tab from UI
- Remove from `mediabunny_tabs` array
- Delete `mediabunny_project_{uuid}` from localStorage
- If closing active tab:
  - Switch to adjacent tab (or first tab if no adjacent)
  - If last tab, create new empty tab

### Feature 9: localStorage Persistence
**Purpose**: Save tab state across browser sessions

**Requirements**:
- **Keys**:
  - `mediabunny_tabs`: Array of project UUIDs `["uuid-1", "uuid-2"]`
  - `mediabunny_active_tab`: Currently active tab UUID
  - `mediabunny_project_{uuid}`: Individual project data (created in Phase 43)
- **On page load**:
  - Read `mediabunny_tabs` array
  - Restore all tabs
  - Set active tab from `mediabunny_active_tab`
  - If no tabs, create one default tab
- **On tab create**: Add UUID to array
- **On tab close**: Remove UUID from array
- **On tab switch**: Update `mediabunny_active_tab`

### Feature 10: Unsaved Changes Tracking
**Purpose**: Show `*` indicator when project modified

**Requirements**:
- Track modification state per tab
- Add `*` prefix to tab label when:
  - Clip added/removed/edited
  - Effect applied
  - Any timeline change
  - Property changed
- Remove `*` after save or export
- Global flag: `project.isModified = true/false`

## Testing Checklist
- [ ] Top navigation bar renders correctly
- [ ] Menu buttons display (File, Edit, View, Effects)
- [ ] Import button appears in top-right
- [ ] Export dropdown toggles on click
- [ ] Export dropdown has 3 options
- [ ] Multi-tab bar renders below navigation
- [ ] [+] button creates new tab (max 10)
- [ ] New tabs have UUID and default name
- [ ] Can switch between tabs by clicking
- [ ] Active tab highlighted
- [ ] Close button ⓧ appears on each tab
- [ ] Closing tab shows confirmation if unsaved
- [ ] Tab data persists in localStorage
- [ ] Page reload restores all tabs
- [ ] Unsaved indicator * shows when modified
- [ ] Can't create more than 10 tabs

## Done When
✅ Top navigation bar complete with Import/Export buttons  
✅ Multi-tab bar functional  
✅ Can create new tabs (max 10)  
✅ Can switch between tabs  
✅ Can close tabs with confirmation  
✅ Tab state persists in localStorage  
✅ Unsaved indicator works  
✅ All tests pass  
✅ Ready for Phase 27 (Media Library)

---
**Phase**: 26 | **Component**: Editor  
**Updated Estimated Time**: 35-45 minutes
