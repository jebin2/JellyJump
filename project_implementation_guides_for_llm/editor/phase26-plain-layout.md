# Phase 26: Plain Layout Foundation

## Goal
Create the complete editor UI shell with HTML and CSS only (zero JavaScript functionality). This establishes the visual foundation for all subsequent phases.

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
- **Center Section**: Main menu buttons (placeholders)
  - [File] [Edit] [View] [Effects]
- **Right Section**: Action buttons
  - [📥 Import] button
  - [📤 Export ▾] dropdown button (visual only)

### Feature 2: Multi-Tab Bar Structure
**Purpose**: Visual container for project tabs

**Requirements**:
- Tab bar positioned directly below top navigation
- Full width container
- Height: 40-45px
- Horizontal flex layout
- **Placeholder tabs** (visual only, no switching):
  - [+] New tab button
  - "Untitled Project *" (active state)
  - "Project 2" (inactive state)
  - "Video Edit" (inactive state)
- Apply Dark Neobrutalism borders
- Show visual states (active vs inactive)

### Feature 3: Media Library Panel (Left Sidebar)
**Purpose**: Left sidebar with vertical tab navigation (20% width)

**Requirements**:
- Container: 20% width (min: 15%, max: 30%)
- Fixed position or flex layout
- Apply Dark Neobrutalism theme borders
- Vertical scroll if content overflows

**Vertical Tab Structure**:
```
┌────────┬──────────────────┐
│ 📹 12  │ Content Area     │
│ Videos │                  │
├────────┤                  │
│ 🎵 5   │ [Tile Grid]      │
│ Audio  │ Placeholder      │
├────────┤                  │
│ 🖼️ 8   │                  │
│ Images │                  │
├────────┤                  │
│ 📝 0   │                  │
│ Text   │                  │
├────────┤                  │
│ 🎨 15  │                  │
│ Effects│                  │
├────────┤                  │
│ 📁 3   │                  │
│Projects│                  │
├────────┤                  │
│[Upload]│                  │
└────────┴──────────────────┘
```

**Tab Button Requirements**:
- Left sidebar: 60-80px wide
- Each tab shows icon, label, and count
- Visual states: Active (highlighted), Inactive (dimmed)
- One tab active by default (Videos)
- **No click functionality** in this phase

**Content Area**:
- Right side of panel (remaining width)
- Show search bar placeholder
- Show tile grid placeholders (2-3 per row)
- Sample tiles with dummy thumbnails

### Feature 4: Preview Canvas Panel (Center)
**Purpose**: Center panel for video preview (50% width)

**Requirements**:
- Container: 50% width
- Flexbox layout positioning
- Apply Dark Neobrutalism theme styling

**Structure**:
- **Player Container**:
  - Empty `div` with ID `preview-player-container`
  - This will host the **existing MediaBunny Player** component (Phase 49)
  - Aspect ratio 16:9 (use CSS aspect-ratio or padding hack)
  - Centered in available space
  - Background: Black
- **Metadata display** (below video):
  - "1920x1080 @ 30fps" (placeholder text)
- **Time display**:
  - "00:00:05 / 00:00:30" (placeholder)
- **Playback controls** (visual only):
  - [▶] Play button
  - [⏸] Pause button
  - [⛶] Fullscreen button
- **No functionality** - just styled buttons and empty container

### Feature 5: Properties Panel (Right Sidebar)
**Purpose**: Right sidebar for editing controls (30% width)

**Requirements**:
- Container: 30% width (min: 25%, max: 40%)
- Apply Dark Neobrutalism theme borders
- Vertical scroll if content overflows

**Section Structure** (collapsible headers, visual only):
- 📋 **Selected Clip** (expanded)
  - Show placeholder clip info:
    - Name: clip1.mp4
    - Start: 00:00:00
    - Duration: 00:45
    - Resolution: 1920x1080
- ⚡ **Effects** (collapsed)
- 🎨 **Filters** (collapsed)
- 📝 **Text Overlay** (collapsed)
- 🔧 **Transform** (collapsed)
  - Placeholder sliders/inputs
- 🔊 **Audio Mix** (expanded)
  - Volume slider placeholder (visual only)
  - Mute button (visual only)

**No functionality** - just visual headers and placeholders

### Feature 6: Timeline Section (Bottom)
**Purpose**: Bottom panel for timeline editor (30% viewport height)

**Requirements**:
- Container: 30% of viewport height
- Full width
- Apply Dark Neobrutalism theme borders
- Horizontal scroll container (visual only)

**Timeline Header**:
- Height: 40-50px
- Left: 🕐 Timeline label
- Center: Zoom controls [25%] [100%] [200%] (visual only)
- Right: Duration "00:00:30" and [⚙] settings

**Time Ruler**:
- Height: 30-40px
- Show time markers: 0:00, 0:05, 0:10, 0:15, 0:20, 0:25, 0:30
- Grid lines (visual only)

**Track Container**:
- **Video 1 Track**:
  - Show 2-3 placeholder clips (colored rectangles)
  - Clip thumbnails optional (placeholder images)
- **Video 2 Track**:
  - Show 1 placeholder clip
- **Audio Track**:
  - Show waveform placeholder ( ▃▅▇ pattern)
- **Text Track**:
  - Show text clip placeholder ("Hello World")
- **Playhead**: Vertical line at ~5 second mark (visual only)

**Edit Toolbar** (below tracks):
- Buttons (visual only):
  - [✂️ Cut] [📏 Trim] [➕ Split] [📋 Copy] [📄 Paste] [🗑️ Delete] [🔄 Undo] [↩️ Redo]

### Feature 7: Responsive Layout
**Purpose**: Adjust to window resize

**Requirements**:
- Use CSS flexbox or grid
- Panel widths remain proportional (20%-50%-30%)
- Timeline height remains 30% of viewport
- Top nav and tabs stay fixed
- Apply CSS media queries for smaller screens (optional)

### Feature 8: Theme Styling
**Purpose**: Apply Dark Neobrutalism throughout

**Requirements**:
- Use CSS variables from theme system
- Consistent colors, borders, shadows
- Bold borders (3-4px)
- High contrast text
- Accent colors for active states
- Reference existing theme CSS

## File Structure

**Create**:
- `editor.html` - Complete HTML structure
- `assets/css/editor.css` - Editor-specific styles
- `assets/css/editor-layout.css` - Layout grid/flex (optional)

**Reference**:
- Existing theme CSS files
- Dark Neobrutalism design tokens

## Testing Checklist
- [ ] Open `editor.html` in browser
- [ ] All 4 panels visible and sized correctly (20%-50%-30% + bottom)
- [ ] Top navigation bar displays with branding and buttons
- [ ] Tab bar shows placeholder tabs
- [ ] Media Library shows vertical tabs (6 categories)
- [ ] Media Library content area shows tile grid placeholders
- [ ] Preview canvas shows empty player container (black box)
- [ ] Properties panel shows section headers and placeholders
- [ ] Timeline shows header, ruler, 4 tracks, and toolbar
- [ ] Timeline tracks show placeholder clips
- [ ] Dark Neobrutalism theme applied throughout
- [ ] Layout responds to window resize
- [ ] No console errors
- [ ] **ZERO JavaScript functionality** - pure visual shell

## Done When
✅ Complete HTML structure created  
✅ All panels visible and properly sized  
✅ Dark Neobrutalism styling applied throughout  
✅ Media Library vertical tabs structure in place  
✅ Preview panel has correct container for Player  
✅ Properties, Timeline all have placeholder content  
✅ Responsive layout works  
✅ **NO JavaScript** - pure CSS and HTML  
✅ Ready for Phase 27 (add tab switching logic)

---
**Phase**: 26 | **Component**: Editor  
**Estimated Time**: 45-60 minutes
