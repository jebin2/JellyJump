# Phase 69: Time Ruler Markers

## Goal
Add time labels and tick marks to ruler for time reference

## Group
**Timeline Foundation**

## Feature to Implement

### ONE Feature: Time Ruler Markers
**Purpose**: Display time labels (0:00, 0:05, 0:10...) and tick marks on the ruler for temporal navigation

**Requirements**:

#### 1. What to Build
Add time markers to the ruler:
- **Time labels**: Display at 5-second intervals (0:00, 0:05, 0:10, 0:15...)
- **Major tick marks**: Vertical lines at 5-second intervals (align with labels)
- **Minor tick marks**: Vertical lines at 1-second intervals (between major ticks)
- Markers scale and position based on zoom level
- Time format: M:SS (e.g., 0:05, 1:23)

#### 2. Time Label Display
Label specifications:
- Position: Above tick marks, centered
- Format: M:SS (minutes:seconds)
- Intervals: Every 5 seconds (0:00, 0:05, 0:10...)
- Font: Small, monospace or system font
- First label always at 0:00 (start)
- Last label at end of project duration

#### 3. Tick Mark Types
Two types of vertical tick marks:

**Major ticks** (5-second intervals):
- Height: 100% of ruler (30px)
- Width: 2px
- Color: Higher contrast (theme accent or border color)
- Aligned with time labels

**Minor ticks** (1-second intervals):
- Height: 50% of ruler (15px, from top)
- Width: 1px
- Color: Subtle gray (lower contrast than major)
- Between major tick marks

#### 4. Tick Mark Positioning
Positioning logic:
```
Position for tick at time T:
x = T * pixelsPerSecond
Example: At 10 seconds with 50px/s zoom
x = 10 * 50 = 500px
```

Major ticks: Every 5 seconds (0, 5, 10, 15...)
Minor ticks: Every 1 second (1, 2, 3, 4, 6, 7, 8, 9...)

#### 5. Label Positioning
Time labels:
- Horizontal: Centered above corresponding major tick
- Vertical: Top of ruler with small padding (2-4px from top)
- Use absolute positioning within ruler container
- Prevent overlap even when zoomed out

#### 6. Zoom Level Integration
Markers adjust with zoom:
- At 100% zoom (50px/s): Labels every 5 seconds
- At 200% zoom (100px/s): Labels every 5 seconds (more space)
- At 50% zoom (25px/s): Labels every 10 seconds (avoid crowding)
- At 25% zoom (12.5px/s): Labels every 30 seconds

Dynamic label interval calculation:
```
if pixelsPerSecond >= 40: interval = 5 seconds
else if pixelsPerSecond >= 20: interval = 10 seconds
else if pixelsPerSecond >= 10: interval = 20 seconds
else: interval = 30 seconds
```

Minor ticks may be hidden at low zoom levels to avoid clutter.

#### 7. Dynamic Generation
Generate markers dynamically:
- Calculate number of labels based on project duration
- Loop through time intervals to create labels and ticks
- Clear and regenerate on zoom change or duration change
- Use DocumentFragment for efficient DOM insertion

Example logic:
```
For each 5-second interval from 0 to duration:
  - Create label element with time text
  - Position at (interval * pixelsPerSecond)
  - Create major tick at same position
  
For each 1-second interval (not on 5s mark):
  - Create minor tick
  - Position at (interval * pixelsPerSecond)
```

#### 8. Time Formatting
Format seconds to M:SS:
- 0 seconds → "0:00"
- 5 seconds → "0:05"
- 65 seconds → "1:05"
- 125 seconds → "2:05"

Helper function:
```
formatTime(seconds):
  minutes = floor(seconds / 60)
  secs = seconds % 60
  return minutes + ":" + pad(secs, 2)
```

#### 9. Styling Requirements
Apply Dark Neobrutalism theme:
- Labels: Light text color, high contrast against dark ruler
- Major ticks: 2px solid, accent or border color
- Minor ticks: 1px solid, subtle gray
- Font: 11-12px, monospace (e.g., 'Courier New', monospace)
- Anti-aliasing for crisp text
- Use CSS variables for colors

#### 10. Edge Cases
- **Very short duration** (< 5 seconds): Show labels every 1 second
- **Very long duration** (> 5 minutes): Adjust label intervals to 30s or 1min
- **Zoomed out heavily**: Hide minor ticks, show only major ticks
- **Fractional pixel positions**: Round to avoid blurry rendering
- **Label overlap**: Reduce label count or rotate text at extreme zoom out

#### 11. Performance Considerations
Optimize for many markers:
- Use CSS transforms for positioning (GPU-accelerated)
- Batch DOM updates with DocumentFragment
- Reuse elements when possible (pooling pattern)
- Limit markers to visible area + small buffer (virtual scrolling)
- Debounce regeneration on zoom changes

#### 12. Accessibility
- Markers are visual reference (non-interactive)
- Time labels readable (sufficient contrast, size)
- Screen readers can ignore (decorative)
- Actual time navigation via playhead (Phases 69-71)

#### 13. Files to Create/Modify
- `editor.html` - Marker container already exists in ruler
- `assets/css/editor.css` - Add marker and tick styles
- `assets/js/timeline.js` - Extend with marker generation logic

#### 14. JavaScript Organization
Extend Timeline class:
- `generateTimeMarkers()` - Create all labels and ticks
- `clearTimeMarkers()` - Remove existing markers
- `updateTimeMarkers()` - Clear and regenerate (on zoom/duration change)
- `formatTimeLabel(seconds)` - Convert seconds to M:SS
- `calculateLabelInterval()` - Determine interval based on zoom
- Call `generateTimeMarkers()` after ruler creation (Phase 62)

#### 15. Data Structure
Each marker object:
```
{
  time: 5,           // seconds
  position: 250,     // pixels
  type: 'major',     // 'major' or 'minor'
  label: '0:05'      // formatted time (for major ticks only)
}
```

Store in array for reference: `this.timeMarkers = []`

#### 16. What NOT to Do
- ❌ Do NOT make labels interactive/clickable yet (clicking to seek in Phase 71)
- ❌ Do NOT add hover effects on labels
- ❌ Do NOT implement playhead (that's Phase 69)
- ❌ Do NOT add frame-level precision markers (stick to seconds)
- This is **visual time reference ONLY**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Phase 62**: Ruler structure and grid (foundation for markers)
- **Phase 72**: Zoom functionality will trigger marker updates
- **Code of Conduct**: Cache selectors, minimize DOM manipulation

## Testing Checklist
- [ ] Time labels appear at 5-second intervals (0:00, 0:05, 0:10...)
- [ ] Labels show correct M:SS format
- [ ] Major tick marks at 5-second intervals (2px, full height)
- [ ] Minor tick marks at 1-second intervals (1px, half height)
- [ ] First label is "0:00" at start
- [ ] Labels centered above major ticks
- [ ] Ticks extend from top of ruler
- [ ] Labels readable with good contrast
- [ ] Ticks align with grid from Phase 62
- [ ] No overlapping labels
- [ ] Markers positioned correctly based on pixelsPerSecond
- [ ] At least 6 labels visible for 30-second timeline
- [ ] No console errors
- [ ] Smooth rendering (no performance issues)

## Done When
✅ Time labels generated and displayed  
✅ Major and minor tick marks visible  
✅ Labels formatted correctly (M:SS)  
✅ Ticks aligned with time intervals  
✅ Markers scale with ruler width  
✅ Dark Neobrutalism styling applied  
✅ All tests pass  
✅ Ready for Phase 64 (Track Container)

---
**Phase**: 69 | **Component**: Editor | **Group**: Timeline Foundation  
**Estimated Time**: 15 min

## Implementation Notes
- Monospace fonts ensure consistent label width
- Major ticks provide primary reference, minor ticks for precision
- Markers regenerate when project duration or zoom changes
- Virtual scrolling can optimize for very long timelines (100+ markers)
- This completes the ruler (Phases 62-63), next: track area
