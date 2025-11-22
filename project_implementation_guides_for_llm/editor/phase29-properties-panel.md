# Phase 29: Properties Panel

## Goal
Create right sidebar panel (30% width) for context-sensitive editing controls

## Features to Implement

### Feature 1: Panel Structure
**Purpose**: Right sidebar container with responsive layout

**Requirements**:
- Container div with 30% width
- Minimum width: 25%, Maximum width: 40%
- Resizable panel with drag handle (optional)
- Apply Dark Neobrutalism theme borders
- Scroll if content overflows
- Fixed position relative to viewport

### Feature 2: Panel Sections
**Purpose**: Organized sections for different control types

**Requirements**:
- Collapsible section headers with icons:
  - 📋 **Selected Clip** (clip info)
  - ⚡ **Effects** (completed in Phase 38)
  - 🎨 **Filters** (completed in Phase 39)
  - 📝 **Text Overlay** (completed in Phase 40)
  - 🔧 **Transform** (completed in Phase 41)
  - 🔊 **Audio Mix**
- Expand/collapse functionality for each section
- Section state persistence (remember which are open)
- Smooth expand/collapse animation
- Theme styling for section headers

### Feature 3: Selected Clip Info Section
**Purpose**: Display information about currently selected timeline clip

**Requirements**:
- **Show when clip selected**:
  - Clip name/source file
  - Start time on timeline
  - End time on timeline
  - Duration
  - Original file duration
  - Resolution
  - FPS
- **Empty state** when no clip selected:
  - Message: "Select a clip to edit"
  - Icon or illustration
- Readonly text displays (not editable in this phase)
- Clean, organized layout

### Feature 4: Audio Mix Section
**Purpose**: Basic audio controls

**Requirements**:
- Volume slider (0% to 100%)
- Volume percentage display
- Mute toggle button
- Visual feedback (slider color changes)
- Apply volume to selected clip or global
- **Note**: Advanced audio editing in future phases

### Feature 5: Empty State Display
**Purpose**: Show helpful message when nothing selected

**Requirements**:
- Centered message: "Select a clip to see properties"
- Icon or illustration (video clip icon)
- Subtle styling (not distracting)
- Dismiss when clip selected
- Show tips or keyboard shortcuts (optional)

### Feature 6: Context-Sensitive Display
**Purpose**: Show/hide sections based on selection

**Requirements**:
- **When video clip selected**: Show all video-related sections
- **When audio clip selected**: Show audio-specific controls
- **When text clip selected**: Show text controls (Phase 40)
- **When nothing selected**: Show empty state
- Smooth transitions between states
- Maintain scroll position when switching

## Testing Checklist
- [ ] Properties panel renders at 30% width (right side)
- [ ] All section headers display correctly
- [ ] Sections can expand/collapse
- [ ] Selected clip info displays when clip selected
- [ ] Empty state shows when nothing selected
- [ ] Audio mix controls functional (volume slider, mute)
- [ ] Panel is resizable (if implemented)
- [ ] Context switches correctly based on selection
- [ ] Section state persists across sessions
- [ ] Theme styling applied consistently

## Done When
✅ Properties panel structure complete  
✅ Section headers and expand/collapse functional  
✅ Selected clip info section displays correctly  
✅ Empty state shows when appropriate  
✅ Audio mix controls work  
✅ Context-sensitive display implemented  
✅ All tests pass  
✅ Ready for effects/filters/text phases (38-41)

---
**Phase**: 29 | **Component**: Editor  
**Estimated Time**: 20-30 minutes
