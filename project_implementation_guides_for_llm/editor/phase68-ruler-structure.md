# Phase 68: Time Ruler Structure

## Goal
Ruler container, background grid

## Group
**Timeline Foundation**

## Feature to Implement

### ONE Feature: Time Ruler Container and Grid
**Purpose**: Create the visual foundation for the timeline ruler with background grid

**Requirements**:

#### 1. What to Build
Create time ruler structure:
- Horizontal ruler bar (30px height)
- Background with grid pattern
- Spans full timeline width
- Scrolls horizontally with tracks
- Foundation for time markers (Phase 63)

#### 2. Ruler Dimensions
- Height: 30px (fixed)
- Width: Based on project duration and zoom level
  - Example: 30 seconds at 100% zoom = 1500px wide (50px per second)
  - Width increases with zoom level
- Extends beyond viewport (horizontal scroll)

#### 3. Background Grid Pattern
Create visual grid for time intervals:
- **Major grid lines**: Every 5 seconds (thicker, higher contrast)
- **Minor grid lines**: Every 1 second (thinner, subtle)
- Vertical lines from top to bottom of ruler
- Grid extends into track area (optional visual guide)

CSS approach:
- Use repeating-linear-gradient for grid pattern
- OR: Generate grid lines as elements
- Grid spacing adjusts with zoom level

#### 4. Grid Styling
Visual appearance:
- Major lines: 1-2px width, light gray or theme accent
- Minor lines: 1px width, very subtle gray
- Background: Darker than header, lighter than tracks
- High contrast for readability

#### 5. Zoom Integration (Preparation)
Grid responsive to zoom:
- At 100% zoom: 1 second = 50px
- At 200% zoom: 1 second = 100px
- At 50% zoom: 1 second = 25px
- Grid density updates with zoom (Phase 72)

Calculation:
```
pixelsPerSecond = 50 * (zoomLevel / 100)
```

#### 6. Horizontal Scrolling
Ruler scrolling:
- Scrolls horizontally with track container
- Synchronized scrolling
- Ruler width matches total timeline width
- Shows current visible time range

#### 7. Ruler Width Calculation
Based on project duration:
```
rulerWidth = projectDurationSeconds * pixelsPerSecond
Example: 30 seconds * 50px/s = 1500px
```

Updates when:
- Project duration changes (clips added/removed)
- Zoom level changes

#### 8. Positioning
Ruler position:
- Below timeline header (Phase 61)
- Above track container (Phase 64)
- Fixed height (30px)
- Spans full scrollable width

#### 9. Styling Requirements
Apply Dark Neobrutalism theme:
- Background: Tertiary background (darker than header)
- Grid lines: Contrasting colors
- Thick bottom border (2px) separating from tracks
- Use CSS variables

#### 10. Empty State
Initial ruler:
- Default 30-second timeline (0:00 - 0:30)
- Width: 1500px (30s * 50px/s)
- Grid visible even without clips

#### 11. Accessibility
- Ruler is visual reference (not interactive)
- No special accessibility needs for grid
- Time markers (Phase 63) will have text

#### 12. Files to Create/Modify
- `editor.html` - Ruler structure already from Phase 60
- `assets/css/editor.css` - Add grid pattern styles
- `assets/js/timeline.js` - Calculate ruler width

#### 13. JavaScript Organization
Extend Timeline class:
- `calculateRulerWidth()` - Based on duration and zoom
- `updateRulerGrid()` - Update grid density
- `getPixelsPerSecond()` - Helper function
- Initialize with default values

#### 14. What NOT to Do
- ❌ Do NOT add time marker labels yet (that's Phase 63)
- ❌ Do NOT add tick marks yet (Phase 63)
- ❌ Do NOT implement zoom functionality (Phase 72)
- ❌ Do NOT make ruler interactive (clicking to seek)
- This is **visual grid structure ONLY**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Phase 60**: Timeline container structure
- **Phase 61**: Timeline header (above ruler)
- **Phase 63**: Will add time markers
- **Phase 72**: Will implement zoom

## Testing Checklist
- [ ] Ruler visible below timeline header
- [ ] Ruler height is 30px
- [ ] Background grid pattern visible
- [ ] Major grid lines every 5 seconds (thicker)
- [ ] Minor grid lines every 1 second (subtle)
- [ ] Ruler width at least 1500px (30 seconds)
- [ ] Ruler extends beyond viewport
- [ ] Horizontal scrolling works
- [ ] Grid lines extend full ruler height
- [ ] Dark background color
- [ ] Grid lines contrasting and readable
- [ ] Bottom border separates from tracks
- [ ] No console errors

## Done When
✅ Ruler container structured  
✅ Background grid pattern visible  
✅ Major and minor grid lines  
✅ Ruler width calculated correctly  
✅ Horizontal scrolling ready  
✅ Dark Neobrutalism styling  
✅ All tests pass  
✅ Ready for Phase 63 (Time Ruler Markers)

---
**Phase**: 68 | **Component**: Editor | **Group**: Timeline Foundation  
**Estimated Time**: 10 min

## Implementation Notes
- CSS repeating-linear-gradient efficient for grid pattern
- 50px per second is standard timeline scale
- Grid provides visual reference for clip placement
- Ruler width dynamic based on project length
- Grid density will update with zoom in Phase 72
