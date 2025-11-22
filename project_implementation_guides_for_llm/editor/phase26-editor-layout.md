# Phase 26: Editor Layout

## Goal
Create three-section layout: preview/properties panel (top), timeline (middle), media library (bottom).

## Features to Implement

### Feature 1: Three-Section Layout
**Purpose**: Divide screen into editor work areas

**Requirements**:
- Top section (40% height): Preview and properties
- Middle section (50% height): Timeline
- Bottom section (10% height): Media library
- Resizable sections with drag handles (optional)
- Full viewport height and width

### Feature 2: Preview & Properties Panel
**Purpose**: Video preview using MediaBunny and editing controls

**Requirements**:
- Preview area (60% width): Core player in editor mode (from phases 09-14)
- **Note**: Editor mode uses MediaBunny for frame-accurate preview
- Properties panel (40% width): Tool controls and settings
- Vertical split between preview and properties
- Apply theme borders between panels
- **Reference**: Core player editor mode configuration from phase13

### Feature 3: Timeline Section
**Purpose**: Visual timeline for editing

**Requirements**:
- Full width of screen
- Contains tracks for video and audio
- Playhead synchronized with video
- Ruler showing timecodes
- Apply theme styling

### Feature 4: Media Library Section
**Purpose**: Browse and add media/effects

**Requirements**:
- Tabs for: Media files, Transitions, Effects, Text
- Horizontal scrolling if many items
- Drag items to timeline to add
- Apply theme styling

## Testing Checklist
- [ ] Three main sections visible
- [ ] Proportions are correct
- [ ] Core player loads in preview
- [ ] Layout is responsive/resizable

## Done When
✅ Editor layout implemented  
✅ All sections visible  
✅ Core player integrated  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 26 | **Component**: Editor
**Estimated Time**: 30-50 minutes
