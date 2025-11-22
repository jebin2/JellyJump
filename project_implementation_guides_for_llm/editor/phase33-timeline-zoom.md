# Phase 33: Timeline Zoom & Navigation

## Goal
Implement timeline zoom controls and update time ruler with tick marks

## Features to Implement

### Feature 1: Zoom State Management
**Purpose**: Track current zoom level

**Requirements**:
- Zoom level stored as percentage (25%, 50%, 100%, 200%, 400%)
- Default zoom: 100%
- Minimum zoom: 25% (more time visible, less detail)
- Maximum zoom: 400% (less time visible, more detail)
- Store zoom in component state
- Persist zoom level to localStorage (optional)
- Emit zoom change events

### Feature 2: Zoom Controls UI
**Purpose**: Buttons to adjust zoom level

**Requirements**:
- **[−] Zoom Out** button
- **[Zoom: 100%]** display/dropdown
- **[+] Zoom In** button
- Position in timeline header (center)
- Button states:
  - Disable [-] at minimum zoom (25%)
  - Disable [+] at maximum zoom (400%)
- Theme button styling
- Keyboard shortcuts:
  - **Ctrl/Cmd + −**: Zoom out
  - **Ctrl/Cmd + =**: Zoom in
  - **Ctrl/Cmd + 0**: Reset to 100%

### Feature 3: Zoom Dropdown (Optional)
**Purpose**: Quick zoom level selection

**Requirements**:
- Click **[Zoom: 100%]** to open dropdown
- Preset options: 25%, 50%, 100%, 150%, 200%, 400%
- **Fit to Window** option (calculate zoom to fit all clips)
- Select option to apply zoom
- Theme styling for dropdown
- Show checkmark next to current zoom level

### Feature 4: Zoom Calculation & Application
**Purpose**: Update clip positions and widths when zoom changes

**Requirements**:
- Update `pixelsPerSecond` calculation:
  ```javascript
  const pixelsPerSecond = 100 * (zoomLevel / 100);
  ```
- Recalculate all clip positions and widths (from Phase 31)
- Recalculate playhead position (from Phase 32)
- Update time ruler tick marks (Feature 5)
- Smooth transition animation (optional)
- Maintain playhead at same timestamp (don't change current time)

### Feature 5: Time Ruler Tick Marks
**Purpose**: Display time markers based on zoom level

**Requirements**:
- **Major ticks** (with labels):
  - At 25% zoom: Every 30 seconds (0s, 30s, 60s, ...)
  - At 50% zoom: Every 15 seconds
  - At 100% zoom: Every 5 seconds
  - At 200% zoom: Every 2 seconds
  - At 400% zoom: Every 1 second
- **Minor ticks** (no labels):
  - Between major ticks (visual guide)
- Tick mark styling:
  - Major: Tall line (30px) + label below
  - Minor: Short line (15px)
- Update ticks when zoom changes
- Theme styling for ruler

### Feature 6: Ruler Labels
**Purpose**: Show time at each major tick

**Requirements**:
- Format labels based on zoom:
  - At low zoom (25-50%): Minutes:Seconds (e.g., "01:30")
  - At high zoom (200-400%): Seconds.Frames (e.g., "5.12" at 30fps)
- Position labels below tick marks
- Small, monospace font for readability
- Gray color (not too prominent)
- Prevent label overlap

### Feature 7: Fit to Window
**Purpose**: Auto-calculate zoom to show all clips

**Requirements**:
- Calculate total timeline duration
- Calculate required zoom to fit in viewport:
  ```javascript
  const viewportWidth = timelineContainer.offsetWidth;
  const totalDuration = getMaxClipEndTime();
  const requiredPixelsPerSecond = viewportWidth / totalDuration;
  const zoomLevel = (requiredPixelsPerSecond / 100) * 100;
  ```
- Constrain to min/max zoom levels
- Apply calculated zoom
- Center timeline or align left
- Accessible via zoom dropdown or keyboard shortcut (Ctrl+9)

### Feature 8: Maintain Playhead Position
**Purpose**: Keep playhead at same time during zoom

**Requirements**:
- Store current playhead time before zoom
- Apply zoom changes to all elements
- Calculate new playhead pixel position
- Restore playhead to correct position
- If playhead was centered, keep it centered
- Smooth position adjustment

## Testing Checklist
- [ ] Zoom controls render in timeline header
- [ ] [−] button decreases zoom level
- [ ] [+] button increases zoom level
- [ ] Zoom display shows current level (e.g., "100%")
- [ ] Keyboard shortcuts change zoom (Ctrl +/−)
- [ ] Clip positions update when zoom changes
- [ ] Clip widths update when zoom changes
- [ ] Playhead stays at same timestamp during zoom
- [ ] Time ruler tick marks update based on zoom
- [ ] Major ticks show time labels
- [ ] Minor ticks appear between major ticks
- [ ] Fit to Window calculates correct zoom
- [ ] Zoom persists across sessions (if implemented)
- [ ] Buttons disable at min/max zoom

## Done When
✅ Zoom controls functional  
✅ Clips resize and reposition on zoom  
✅ Playhead maintains time during zoom  
✅ Time ruler updates with appropriate tick marks  
✅ Ruler labels display correctly  
✅ Fit to Window works  
✅ Keyboard shortcuts functional  
✅ All tests pass  
✅ Ready for Phase 34 (Clip Trimming)

---
**Phase**: 33 | **Component**: Editor  
**Estimated Time**: 25-35 minutes
