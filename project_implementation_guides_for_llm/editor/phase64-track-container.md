# Phase 64: Track Container

## Goal
Create scrollable track area below ruler for video/audio clips

## Group
**Timeline Foundation**

## Feature to Implement

### ONE Feature: Track Container Structure
**Purpose**: Build the container where timeline tracks (video, audio) will be placed

**Requirements**:

#### 1. What to Build
Create track container structure:
- Scrollable area below time ruler
- Contains multiple horizontal tracks (rows)
- Each track represents a layer (video track, audio track)
- Synchronized horizontal scroll with ruler
- Vertical scroll if many tracks
- Foundation for clip placement (Phase 67)

#### 2. Container Dimensions
Track container specs:
- **Width**: Same as ruler width (dynamic based on duration and zoom)
- **Height**: Flexible, based on number of tracks
  - Minimum: 400px (show at least 3-4 tracks)
  - Maximum: Viewport height - (header + ruler + toolbar)
- **Overflow**: Horizontal scroll (sync with ruler), vertical scroll (independent)

#### 3. Track Types
Create three default tracks:

**Track 1: Video Track 1**
- Type: Video
- Height: 80px
- Contains video clips

**Track 2: Video Track 2**
- Type: Video
- Height: 80px
- Secondary video layer (for PiP, overlays)

**Track 3: Audio Track 1**
- Type: Audio
- Height: 60px (shorter than video tracks)
- Contains audio clips

#### 4. Track Structure
Each track element contains:
- **Track header** (left side, fixed width: 150px):
  - Track type icon (🎬 for video, 🎵 for audio)
  - Track name (editable text)
  - Track controls (mute, solo, lock - placeholders for now)
- **Track content area** (right side, scrollable):
  - Where clips will be placed
  - Extends full timeline width
  - Background with subtle grid

#### 5. Track Header (Fixed Left Side)
Track header specs:
- Width: 150px (fixed, does not scroll horizontally)
- Contains track controls:
  - Icon (emoji or SVG)
  - Name (e.g., "Video Track 1")
  - Mute button (🔇/🔊) - placeholder, non-functional
  - Solo button (S) - placeholder
  - Lock button (🔒) - placeholder
- Sticky positioning (stays visible when scrolling horizontally)

#### 6. Track Content Area
Clip placement area:
- Starts after track header (150px offset)
- Width: Same as ruler width
- Height: Track height (80px for video, 60px for audio)
- Background: Dark color with subtle horizontal lines
- Grid lines from ruler extend into this area (optional)
- Will contain clip elements (Phase 67)

#### 7. Horizontal Scroll Synchronization
Critical sync behavior:
- Ruler and track container share same horizontal scroll position
- When user scrolls ruler → track content scrolls
- When user scrolls track → ruler scrolls
- Track headers remain fixed (do not scroll)

Implementation:
- Listen to `scroll` event on timeline container
- Update both ruler and track container `scrollLeft` property
- Prevent infinite loop (check if already synchronized)

#### 8. Vertical Scroll (Independent)
Track container vertical scroll:
- Scrolls independently if more tracks than fit in view
- Track headers scroll vertically with tracks
- Ruler does NOT scroll vertically (fixed at top)

#### 9. Empty State Visual
Initial state (no clips):
- Show empty tracks with guidelines
- Center text: "Drag media from library to add to timeline"
- Use `data-empty="true"` attribute
- Remove empty state when first clip added (Phase 66)

#### 10. Styling Requirements
Apply Dark Neobrutalism theme:
- Track background: Darkest background color
- Track borders: 2px solid between tracks
- Track headers: Darker shade, thick right border (3px)
- Subtle horizontal grid lines within tracks
- Hover effect on tracks (subtle highlight)
- Use CSS variables

Visual hierarchy:
- Ruler lighter than tracks
- Tracks darker than headers
- Clear separation with thick borders

#### 11. Track Height Guidelines
Standard heights:
- Video tracks: 80px (enough for thumbnails in Phase 68)
- Audio tracks: 60px (waveforms smaller)
- Text/subtitle tracks: 40px (future)

Heights are fixed for now, user-adjustable in future phase.

#### 12. Accessibility
- Track container has `role="region"` and `aria-label="Timeline tracks"`
- Each track marked with `role="list"` (clips will be list items)
- Track names editable with keyboard (future phase)
- Horizontal scroll accessible via keyboard (Shift + Arrow keys)

#### 13. Files to Create/Modify
- `editor.html` - Add track container HTML structure
- `assets/css/editor.css` - Add track and header styles
- `assets/js/timeline.js` - Extend with track container logic

#### 14. JavaScript Organization
Extend Timeline class:
- `createTrackContainer()` - Build track structure
- `addTrack(trackType)` - Add new track dynamically
- `syncHorizontalScroll()` - Sync ruler and track scrolling
- `updateTrackContainerWidth()` - Match ruler width
- Initialize with 3 default tracks

#### 15. HTML Structure Pattern
Track container hierarchy:
```
timeline-tracks (scrollable)
  ├─ track (Video Track 1)
  │   ├─ track-header (fixed 150px)
  │   │   ├─ icon + name
  │   │   └─ controls (mute, solo, lock)
  │   └─ track-content (clips go here)
  ├─ track (Video Track 2)
  │   └─ ...
  └─ track (Audio Track 1)
      └─ ...
```

#### 16. BEM Naming Convention
CSS classes:
- `.timeline-tracks` - Container
- `.timeline-track` - Individual track
- `.timeline-track__header` - Fixed left header
- `.timeline-track__content` - Scrollable content area
- `.timeline-track__name` - Track name text
- `.timeline-track__controls` - Button group
- `.timeline-track--video` - Modifier for video tracks
- `.timeline-track--audio` - Modifier for audio tracks

#### 17. Data Attributes
- `data-track-id="track-1"` - Unique track identifier
- `data-track-type="video|audio"` - Track type
- `data-track-index="0"` - Track order (z-index layering)
- `data-empty="true"` - Initial empty state

#### 18. What NOT to Do
- ❌ Do NOT implement drag-to-reorder tracks
- ❌ Do NOT make track controls functional (mute, solo, lock)
- ❌ Do NOT implement add/delete track buttons yet
- ❌ Do NOT implement track height resizing (dragging track borders)
- ❌ Do NOT add clips (that's Phase 67)
- This is **track structure ONLY**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Phase 62-63**: Ruler above track container
- **Phase 66**: Will drop clips into tracks
- **Phase 67**: Will render clip elements in tracks
- **Code of Conduct**: Use event delegation, cache selectors

## Testing Checklist
- [ ] Track container visible below ruler
- [ ] Three tracks present: Video 1, Video 2, Audio 1
- [ ] Track headers visible on left (150px wide)
- [ ] Track headers show icon + name + controls
- [ ] Track content area extends to ruler width
- [ ] Horizontal scroll works
- [ ] Ruler scrolls when track content scrolls (synchronized)
- [ ] Track scrolls when ruler scrolls (synchronized)
- [ ] Track headers stay fixed during horizontal scroll
- [ ] Vertical scroll works if needed
- [ ] Empty state message visible in track content
- [ ] Dark Neobrutalism styling (borders, backgrounds)
- [ ] Clear visual separation between tracks
- [ ] No console errors

## Done When
✅ Track container structured with 3 default tracks  
✅ Track headers fixed with icon, name, controls  
✅ Track content areas ready for clips  
✅ Horizontal scroll synchronized with ruler  
✅ Vertical scroll works independently  
✅ Empty state visible  
✅ Dark Neobrutalism styling applied  
✅ All tests pass  
✅ Ready for Phase 65 (Edit Toolbar)

---
**Phase**: 64 | **Component**: Editor | **Group**: Timeline Foundation  
**Estimated Time**: 20 min

## Implementation Notes
- Horizontal scroll sync critical for usability
- Fixed track headers improve navigation on long timelines
- 3 tracks sufficient for basic editing, more can be added later
- Track content area is foundation for clip rendering
- BEM naming keeps CSS maintainable as timeline grows
- Empty state guides users to drag-and-drop workflow
