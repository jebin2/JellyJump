# Phase 30: Timeline Structure

## Goal
Create bottom timeline section (30% viewport height) with foundational structure

**MediaBunny Integration**: Timeline foundation for displaying video clips with precise timing. **Consult** mediabunny-llms-full.md for:
- Video duration and timestamp retrieval
- Frame-accurate positioning
- Sample extraction for thumbnails (implemented in Phase 31)

## Features to Implement

### Feature 1: Timeline Container
**Purpose**: Bottom section container for timeline editor

**Requirements**:
- Container div fixed to bottom 30% of viewport height
- Full width of viewport
- Apply Dark Neobrutalism theme borders
- Horizontal scroll container for long timelines
- Z-index to stay above other content
- Responsive to window resize

### Feature 2: Timeline Header
**Purpose**: Top bar with timeline controls and info

**Requirements**:
- Header bar spanning full timeline width
- **Left side**: 🕐 Timeline label
- **Center**: Zoom controls (implemented in Phase 33)
- **Right side**: Duration display and settings
- Fixed height (40-50px)
- Theme styling with border-bottom
- Sticky header during vertical scroll

### Feature 3: Duration Display
**Purpose**: Show total timeline duration

**Requirements**:
- Display format: "Duration: 00:00:30"
- Updates when clips added/removed
- Positioned in timeline header (right side)
- Prominent, readable font
- Theme-consistent typography

### Feature 4: Settings Button
**Purpose**: Timeline configuration options

**Requirements**:
- **[⚙ Settings]** button in header
- Opens dropdown/modal with options:
  - Toggle snap to grid
  - Toggle magnetic snapping
  - Toggle clip thumbnails
  - Ruler format (seconds vs frames)
- Save preferences to localStorage
- Theme styling for dropdown

### Feature 5: Time Ruler Structure
**Purpose**: Horizontal ruler showing time markers

**Requirements**:
- Ruler div positioned at top of timeline tracks
- Fixed height (30-40px)
- Scroll horizontally with timeline
- Grid lines for time markers
- **Note**: Actual tick marks and labels implemented in Phase 33
- Background styling with theme colors

### Feature 6: Track Container Structure
**Purpose**: Container for timeline tracks

**Requirements**:
- Tracks container below time ruler
- Vertical stacking of tracks
- Horizontal scroll synchronized with ruler
- Fixed track heights
- **Note**: Individual tracks added in Phase 31
- Dark Neobrutalism grid background pattern

### Feature 7: Edit Toolbar
**Purpose**: Quick access editing buttons below timeline

**Requirements**:
- Toolbar bar spanning full width
- Buttons:
  - [✂️ Cut]
  - [📏 Trim]  
  - [➕ Split]
  - [📋 Copy]
  - [📄 Paste]
  - [🗑️ Delete]
  - [🔄 Undo]
  - [↩️ Redo]
- Button states (enabled/disabled based on selection)
- Keyboard shortcut tooltips on hover
- Theme button styling
- **Note**: Button functionality implemented in Phases 34-37

### Feature 8: Horizontal Scroll Behavior
**Purpose**: Pan timeline for long videos

**Requirements**:
- Horizontal scrollbar
- Smooth scrolling animation
- Mouse wheel horizontal scroll (Shift + wheel)
- Drag to pan (middle mouse or space + drag)
- Synchronized scroll for ruler and tracks
- Auto-scroll when playhead reaches edge

## Testing Checklist
- [ ] Timeline container renders at bottom 30% height
- [ ] Timeline header displays correctly
- [ ] Duration display shows total timeline length
- [ ] Settings button opens options modal
- [ ] Time ruler structure visible
- [ ] Track container structure renders
- [ ] Edit toolbar buttons display correctly
- [ ] Horizontal scroll works smoothly
- [ ] Ruler and tracks scroll in sync
- [ ] Theme styling applied consistently

## Done When
✅ Timeline container structure complete  
✅ Timeline header with duration and settings  
✅ Time ruler structure in place  
✅ Track container structure ready  
✅ Edit toolbar displays (functionality in Phases 34-37)  
✅ Horizontal scroll functional  
✅ All tests pass  
✅ Ready for Phase 31 (Tracks & Clips)

---
**Phase**: 30 | **Component**: Editor  
**Estimated Time**: 25-35 minutes
