# Phase 26: Editor Layout

## Goal
Create professional video editor layout with multi-tab project management, three-panel workspace (media library, preview/canvas, properties), and timeline section.

## Features to Implement

### Feature 1: Top Navigation Bar
**Purpose**: Global navigation with import/export controls

**Requirements**:
- Fixed position top bar (5% height)
- Left: App branding "🎬 MediaBunny Editor"
- Center: Main menu buttons [File] [Edit] [View] [Effects]
- Right: [📥 Import] button and [📤 Export ▾] dropdown
- Apply Dark Neobrutalism theme styling
- Ensure high contrast and accessibility

### Feature 2: Multi-Tab Project Bar
**Purpose**: Browser-style tabs for managing multiple projects simultaneously

**Requirements**:
- Tab bar positioned directly above preview canvas
- **[+] New Tab Button**: Creates new empty project
- **Project Tabs**: Each shows project name with close button `ⓧ`
- **Unsaved Indicator**: Asterisk `*` prefix when project has unsaved changes
- **Active Tab**: Highlighted with theme accent color
- **Tab Switching**: Click to switch between projects
- **Close Tab**: Click `ⓧ` to close (prompt if unsaved changes exist)
- **Max Tabs**: Limit to 10 tabs, show warning when limit reached
- **localStorage Keys**: `mediabunny_tabs`, `mediabunny_active_tab`
- Tab state persists across browser sessions

### Feature 3: Three-Panel Main Workspace
**Purpose**: Professional editor layout with organized work areas

**Requirements**:
- **Left Panel: Media Library (20% width)**
  - Category folders: 📹 Videos, 🎵 Audio, 🖼️ Images, 📝 Text, 🎨 Effects, 📁 Projects
  - Item counts (e.g., "Videos (12)")
  - [+ Upload] and [+ Record] buttons
  - [🔍 Search...] input field
  - Drag-and-drop to timeline
  - Resizable panel (min 15%, max 30%)

- **Center Panel: Preview/Canvas (50% width)**
  - Video preview window using MediaBunny core player
  - Resolution & FPS display (e.g., "1920x1080 @ 30fps")
  - **Time Display**: Current time / Total duration (e.g., "00:00:05 / 00:00:30")
  - **Playback Controls**: [▶ Play] [⏸ Pause] only (NO Previous/Next buttons)
  - Full-screen toggle option
  - Frame-accurate preview synchronized with timeline playhead
  
- **Right Panel: Properties (30% width)**
  - Context-sensitive based on timeline selection
  - **📋 Selected Clip** info section
  - **⚡ Effects** checklist (□ Fade In, □ Fade Out, □ Blur)
  - **🎨 Filters** checklist (□ B&W, □ Sepia, □ Contrast)
  - **📝 Text Overlay** controls (Font dropdown, Size input, Color picker)
  - **🔊 Audio Mix** controls (Volume slider)
  - Resizable panel (min 25%, max 40%)

**Panel Layout**: Use CSS Grid with `grid-template-columns: 20% 50% 30%`

### Feature 4: Timeline Section
**Purpose**: Multi-track timeline editor at bottom

**Requirements**:
- Fixed to bottom 30% of viewport height
- **Timeline Header**: 
  - 🕐 Timeline label
  - Zoom controls: [−] [Zoom:100%] [+]
  - Duration display: "Duration: 00:00:30"
  - [⚙ Settings] button
- **Timeline Tracks**:
  - 📹 Video Track 1
  - 📹 Video Track 2
  - 🎵 Audio Track
  - 📝 Text/Overlay Track
- **Playhead**: Vertical line with time indicator
- **Time Ruler**: Shows seconds (0s, 5s, 10s, etc.)
- **Edit Toolbar**: [✂️ Cut] [📏 Trim] [➕ Split] [📋 Copy] [📄 Paste] [🗑️ Delete] [🔄 Undo] [↩️ Redo]
- Apply theme styling with track borders

### Feature 5: Complete ASCII Layout Reference
**Purpose**: Visual guide for implementation

**Layout**:
```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🎬 MediaBunny Editor    [File] [Edit] [View] [Effects]   [📥 Import] [📤 Export ▾] ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                                                                                  ┃
┃  ┌─────────────────┐  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  ┌────────────────────┐   ┃
┃  │ MEDIA LIBRARY   │  ┃ PROJECT TABS                ┃  │ PROPERTIES PANEL   │   ┃
┃  │                 │  ┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫  │                    │   ┃
┃  │ 📂 Categories   │  ┃ [+] │Project 1 ⓧ│*Project 2ⓧ┃  │ 📋 Selected Clip   │   ┃
┃  │                 │  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │                    │   ┃
┃  │ 📹 Videos (12)  │  ┌────────────────────────────┐  │ ⚡ Effects          │   ┃
┃  │ 🎵 Audio (8)    │  │                            │  │  □ Fade In         │   ┃
┃  │ 🖼️ Images (5)   │  │   VIDEO PREVIEW/CANVAS     │  │  □ Fade Out        │   ┃
┃  │ 📝 Text (3)     │  │                            │  │  □ Blur            │   ┃
┃  │ 🎨 Effects      │  │                            │  │                    │   ┃
┃  │ 📁 Projects     │  │    [PREVIEW WINDOW]        │  │ 🎨 Filters         │   ┃
┃  │                 │  │                            │  │  □ B&W             │   ┃
┃  │ ┌─────────────┐ │  │                            │  │  □ Sepia           │   ┃
┃  │ │ [+ Upload]  │ │  │   1920x1080 @ 30fps        │  │  □ Contrast        │   ┃
┃  │ │ [+ Record]  │ │  │                            │  │                    │   ┃
┃  │ └─────────────┘ │  │  ┏━━━━━━━━━━━━━━━━━━━━━┓  │  │ 📝 Text Overlay    │   ┃
┃  │                 │  │  ┃ 00:00:05 / 00:00:30  ┃  │  │  Font: [Arial ▾]   │   ┃
┃  │ [🔍 Search...]  │  │  ┃ [▶ Play] [⏸ Pause]  ┃  │  │  Size: [24px]      │   ┃
┃  │                 │  │  ┗━━━━━━━━━━━━━━━━━━━━━┛  │  │  Color: [⬛]        │   ┃
┃  └─────────────────┘  └────────────────────────────┘  │                    │   ┃
┃  20%                   50%                            │ 🔊 Audio Mix       │   ┃
┃                                                        │  Volume: [█████░] │   ┃
┃                                                        └────────────────────┘   ┃
┃                                                        30%                      ┃
┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫
┃  TIMELINE EDITOR (Bottom 30% of screen height)                                  ┃
┃  ┌──────────────────────────────────────────────────────────────────────────┐   ┃
┃  │ 🕐 Timeline    [−] [Zoom:100%] [+]    Duration: 00:00:30    [⚙ Settings]│   ┃
┃  ├──────────────────────────────────────────────────────────────────────────┤   ┃
┃  │ 📹 Track 1  ║████████████▌                                              ║ │   ┃
┃  │ 📹 Track 2  ║         ████████▌                                         ║ │   ┃
┃  │ 🎵 Audio    ║███████████████████████▌                                   ║ │   ┃
┃  │ 📝 Text     ║      ▌Title          ▌                                    ║ │   ┃
┃  │             ║  │                                                         ║ │   ┃
┃  │             ║  ▼ Playhead @ 00:00:05                                    ║ │   ┃
┃  │ ┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊┊   │   ┃
┃  │ 0s    5s    10s   15s   20s   25s   30s                                 │   ┃
┃  └──────────────────────────────────────────────────────────────────────────┘   ┃
┃  [✂️ Cut] [📏 Trim] [➕ Split] [📋 Copy] [📄 Paste] [🗑️ Delete] [🔄 Undo] [↩️ Redo]  ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
```

## Testing Checklist
- [ ] Top navigation bar renders correctly
- [ ] Multi-tab bar displays above preview canvas
- [ ] Can create new tabs with [+] button (max 10 tabs)
- [ ] Can switch between tabs
- [ ] Can close tabs with ⓧ (prompts if unsaved)
- [ ] Unsaved indicator (*) shows when project modified
- [ ] Three-panel layout renders with correct proportions (20/50/30)
- [ ] Media library categories display with counts
- [ ] Preview canvas shows time/duration (no prev/next buttons)
- [ ] Properties panel shows context-sensitive controls
- [ ] Timeline section displays at bottom (30% height)
- [ ] Timeline tracks, playhead, and ruler visible
- [ ] Edit toolbar buttons render correctly
- [ ] Layout is responsive to window resize
- [ ] Panel resizing works (if implemented)
- [ ] Dark Neobrutalism theme applied consistently

## Done When
✅ Multi-tab UI implemented and functional  
✅ Three-panel layout renders correctly (20/50/30)  
✅ Preview shows time/duration (no prev/next)  
✅ Timeline section complete with tracks and controls  
✅ Core player integrated in preview canvas  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 26 | **Component**: Editor  
**Estimated Time**: 50-70 minutes

