# Phase 61: Timeline Header

## Goal
Header with controls, duration, settings, fixed position

## Group
**Timeline Foundation**

## Feature to Implement

### ONE Feature: Timeline Header Controls
**Purpose**: Add playback controls and settings to timeline header

**Requirements**:

#### 1. What to Build
Populate timeline header with:
- Play/Pause button (synced with Phase 50)
- Current time display (synced with Phase 51)
- Project duration display
- Zoom in/out buttons
- Timeline settings button
- Fixed position (sticky when scroll ing)

#### 2. Header Layout
Left to right structure:
```
[Play/Pause] [0:45 / 2:30] | [Zoom -] [100%] [Zoom +] | [Project: 2:30] | [Settings ⚙️]
```

Sections:
- **Left**: Playback controls + time
- **Center**: Zoom controls
- **Right**: Project info + settings

#### 3. Play/Pause Button
Timeline play/pause:
- Same function as preview player Play/Pause (Phase 50)
- Synced state: clicking either button affects both
- Icon: ▶️ / ⏸️
- When clicked: start/stop preview player playback
- Updates when preview player state changes

#### 4. Time Display
Show current playback time:
- Format: "0:45" (current time)
- Updates in real-time during playback
- Synced with preview player time (Phase 51)
- Editable: Click to enter specific time (optional for this phase)

#### 5. Project Duration Display
Show total project length:
- Label: "Project:" or "Duration:"
- Format: "2:30"
- Calculation: End time of last clip on timeline
- OR: Fixed project duration (user-defined)
- Updates when clips added/removed

#### 6. Zoom Controls
Control timeline zoom level:
- Zoom Out button: "-" or 🔍-
- Zoom level display: "100%", "200%", "50%"
- Zoom In button: "+" or 🔍+
- Range: 25% - 400%
- Updates ruler and clip widths (Phase 72)

#### 7. Settings Button
Timeline settings/options:
- Icon: ⚙️ or ☰
- Opens dropdown menu (similar to Phase 28)
- Options (placeholders for now):
  - Snap to grid (on/off)
  - Show waveforms (on/off)
  - Track height (small/medium/large)
- Functionality added in later phases

#### 8. Fixed/Sticky Position
Header behavior:
- Fixed to top of timeline panel
- Remains visible when scrolling tracks vertically
- Scrolls horizontally with timeline (optional design choice)
- Always accessible

#### 9. Styling Requirements
Apply Dark Neobrutalism theme:
- Background: Secondary background
- Thick bottom border (3px)
- Buttons: Brutalist style (thick borders, offset shadows)
- Time displays: Monospace font
- Spacing: 12-16px between sections
- Dividers: Vertical lines between sections (optional)

#### 10. Syncing with Preview Player
Timeline header controls sync with preview:
- Play/Pause: Both buttons control same player
- Time: Both displays show same time
- Update both when either changes
- Shared state management

#### 11. Zoom Functionality (Basic)
For this phase:
- Buttons present and styled
- Click logs zoom action
- Actual zoom implementation in Phase 72
- Display current zoom level

#### 12. Accessibility
- All buttons keyboard accessible
- Play/Pause: Space bar (already handled in Phase 50)
- Zoom: +/- keys on keyboard
- Time display: `aria-live="polite"` for updates
- Settings button: `aria-label="Timeline settings"`

#### 13. Responsive Behavior
On smaller screens:
- Hide labels, show icons only
- Reduce spacing
- Stack sections vertically (optional)

#### 14. Files to Create/Modify
- `editor.html` - Add controls to timeline header section
- `assets/css/editor.css` - Style header controls
- `assets/js/timeline.js` - Create timeline management module
- `assets/js/preview-player.js` - Sync with timeline controls

#### 15. JavaScript Organization
Create Timeline class/module:
- `syncPlayPause()` - Sync with preview player
- `updateTimeDisplay()` - Update time from player
- `calculateProjectDuration()` - Get total timeline length
- `attachHeaderHandlers()` - Event listeners

#### 16. Data Attributes
- `data-timeline-control="play-pause"` on play button
- `data-timeline-control="zoom-in"` on zoom in button
- `data-timeline-control="zoom-out"` on zoom out button

#### 17. What NOT to Do
- ❌ Do NOT implement actual zoom yet (that's Phase 72)
- ❌ Do NOT implement settings menu functionality
- ❌ Do NOT add complex playback controls (loop, markers)
- This phase is **header UI ONLY**, zoom logic comes later

**MediaBunny Integration**: Synced with Player from Phase 49-50

## References
- **Phase 50**: Play/Pause syncs with this
- **Phase 51**: Time display syncs with this
- **Phase 60**: Timeline container structure
- **Phase 72**: Will implement zoom functionality

## Testing Checklist
- [ ] Timeline header shows all controls
- [ ] Play/Pause button visible
- [ ] Click Play/Pause starts preview player
- [ ] Button syncs with preview player button
- [ ] Time display shows current time
- [ ] Time updates during playback
- [ ] Project duration displayed
- [ ] Zoom buttons visible (-/+)
- [ ] Zoom level display shows "100%"
- [ ] Settings button visible
- [ ] Header fixed to top of timeline
- [ ] Dark Neobrutalism styling applied
- [ ] Adequate spacing between controls
- [ ] All buttons keyboard accessible
- [ ] No console errors

## Done When
✅ Timeline header populated with controls  
✅ Play/Pause synced with preview player  
✅ Time display synced  
✅ Zoom controls present (UI only)  
✅ Project duration shown  
✅ Settings button added  
✅ Fixed positioning  
✅ All tests pass  
✅ Ready for Phase 62 (Time Ruler Structure)

---
**Phase**: 61 | **Component**: Editor | **Group**: Timeline Foundation  
**Estimated Time**: 15 min

## Implementation Notes
- Timeline header controls mirror some preview player controls
- Shared state between timeline and preview player
- Zoom functionality scaffolded here, implemented in Phase 72
- Keep header always visible (fixed/sticky)
- Provides timeline-level controls separate from clip editing
