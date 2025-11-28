# Phase 66: Timeline Container

## Goal
Create bottom 30% panel with container styling

---

## What to Build

Timeline container:
- Bottom panel structure
- Resizable height
- Scrollable horizontally
- Zoom controls
- Ruler at top
- Track area below

---

## Feature to Implement

### ONE Feature: Timeline Container Structure
**Purpose**: Establish the bottom timeline panel that will contain tracks, clips, and playhead

**Requirements**:

#### 1. What to Build
Create the bottom timeline panel:
- Bottom panel taking 30% of viewport height
- Full width spanning entire viewport
- Contains timeline header, ruler, tracks, and controls
- Fixed to bottom of workspace (above any footer)
- Positioned as bottom row in main editor layout

#### 2. Layout & Positioning
- Position: Bottom of editor workspace
- Width: 100% of viewport
- Height: 30% of viewport (or fixed ~300-400px)
- Top edge: Starts where preview/properties panels end
- Above any potential footer or status bar
- Fixed or sticky positioning at bottom

#### 3. Internal Structure
Timeline panel contains 4 main sections:

1. **Timeline Header** (top, ~50px):
   - Contains playback controls, zoom, settings
   - Fixed to top of timeline panel

2. **Time Ruler** (below header, ~30px):
   - Horizontal timeline with time markers
   - Shows total project duration

3. **Track Container** (main area):
   - Contains multiple track lanes
   - Video tracks, audio tracks, text track
   - Scrollable vertically and horizontally

4. **Toolbar/Edit Controls** (optional, top-right):
   - Cut, trim, split tools
   - Can be in header or separate

Layout:
```
[Timeline Header - Controls, Zoom, Duration]
[Time Ruler - 0:00, 0:05, 0:10, ...]
[Track Container]
  [Video 1 Track]
  [Video 2 Track]
  [Audio Track]
  [Text Track]
```

#### 4. Timeline Header Section
Header contains (placeholders for now):
- Play/Pause button (links to preview player Phase 50)
- Current time display
- Total project duration
- Zoom in/out buttons
- Settings/options button
- Height: 50px
- Background: Secondary background
- Thick bottom border (3px)

#### 5. Time Ruler Section
Structure for time ruler:
- Height: 30px
- Background: Tertiary background (darker)
- Time markers at intervals (0:00, 0:05, 0:10, etc.)
- Tick marks for seconds
- Updates with zoom level
- Horizontal scrollable with tracks

#### 6. Track Container Section
Structure for track lanes:
- Contains 4 default tracks (more in Phase 64)
- Vertical scrollable if many tracks
- Horizontal scrollable for long timelines
- Background: Dark (black or very dark gray)
- Grid lines or subtle guides

#### 7. Scrolling Behavior
Timeline scrolling:
- **Horizontal scroll**: Navigate through time (left/right)
- **Vertical scroll**: Navigate through tracks (if many)
- Synchronized: Ruler scrolls horizontally with tracks
- Smooth scroll behavior
- Can use scrollbar or drag to scroll

#### 8. Styling Requirements
Apply Dark Neobrutalism theme:
- Panel background: Dark (timeline standard)
- Header: Secondary background with thick border
- Ruler: Darker background
- Tracks: Very dark or black background
- Thick top border (3px) separating from panels above
- Use CSS variables from theme

#### 9. Responsive Behavior
- **Desktop (> 1024px)**: 30% height, full features
- **Tablet (768px - 1024px)**: 30-35% height
- **Mobile (< 768px)**:
  - Option 1: Reduce to 25% height, simplified view
  - Option 2: Full-screen timeline mode (tap to expand)
  - Recommendation: Keep desktop layout for now

#### 10. Empty/Initial State
Before clips added:
- Empty track lanes (just background)
- Ruler shows 0:00 - 0:30 (default 30 second range)
- Optional: "Drag media here to start editing" message

#### 11. Z-Index & Layering
- Panel above page background
- Header above ruler and tracks (sticky)
- Playhead (Phase 69) above all tracks
- Z-index: ~50 (higher than static panels)

#### 12. Accessibility
- Use semantic HTML: `<section>` for timeline
- Add `aria-label="Timeline panel"`
- Scrollable areas keyboard accessible
- Focus management for timeline editing

#### 13. Files to Modify
- `editor.html` - Add timeline panel HTML structure (should already exist from Phase 26)
- `assets/css/editor.css` - Refine timeline panel styles
- Use BEM naming: `.timeline`, `.timeline__header`, `.timeline__ruler`, `.timeline__tracks`

#### 14. Integration with Phase 26
Phase 26 already created basic panel structure. This phase refines:
- Internal layout (header + ruler + tracks)
- Proper sizing and spacing
- Scrolling behavior
- Section divisions
- Styling polish

#### 15. What NOT to Do
- ❌ Do NOT add timeline header controls yet (that's Phase 61)
- ❌ Do NOT add time ruler markers yet (that's Phases 62-63)
- ❌ Do NOT add track lanes yet (that's Phase 64)
- ❌ Do NOT add any clips or playhead (later phases)
- This is **visual structure only**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Phase 26**: Basic panel structure already exists
- **Phase 61**: Will add timeline header controls
- **Phases 62-63**: Will add time ruler
- **Phase 64**: Will add track lanes
- **Code of Conduct**: Follow BEM naming, no inline styles, use CSS variables

---

## Testing Checklist Checklist
- [ ] Timeline panel appears at bottom of editor
- [ ] Panel is 30% of viewport height
- [ ] Panel spans full viewport width
- [ ] Header section visible (50px height, placeholder)
- [ ] Ruler section visible (30px height, placeholder)
- [ ] Track container section visible (remaining height)
- [ ] Thick top border (3px) separates from panels above
- [ ] Header has secondary background
- [ ] Ruler has darker background
- [ ] Track container has very dark/black background
- [ ] Panel positioned correctly in layout
- [ ] Dark Neobrutalism styling applied
- [ ] Scrollable areas work (test with overflow content)
- [ ] No overlap with other panels
- [ ] No console errors

---

## Done When
✅ Timeline panel structured with header + ruler + tracks  
✅ 30% height, bottom of layout  
✅ Header section styled (50px)  
✅ Ruler section styled (30px)  
✅ Track container styled (remaining)  
✅ Thick border separating from above  
✅ Dark Neobrutalism theme applied  
✅ Scrolling areas ready  
✅ All tests pass  
✅ Ready for Phase 61 (Timeline Header)

---
**Phase**: 66 | **Component**: Editor | **Group**: Timeline Foundation  
**Estimated Time**: 10 min

## Implementation Notes
- This refines the basic structure from Phase 26
- Timeline is bottom 30% of viewport (or fixed height)
- Three main sections: header, ruler, tracks
- Very dark background standard for timelines (like DAWs)
- Sections will be populated in Phases 61-64
- Horizontal/vertical scrolling crucial for navigation
