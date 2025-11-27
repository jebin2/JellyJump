# Phase 79: Click to Select Clip

## Goal
Enable clicking on a clip to select it and update the UI

## Group
**Clip Selection**

## Feature to Implement

### ONE Feature: Clip Selection Logic
**Purpose**: The fundamental interaction for editing specific clips

**Requirements**:

#### 1. What to Build
- **Click Handler**: Add `click` event listener to `.timeline-clip` elements.
- **State Update**:
    - Set `state.selectedClipIds = [clickedClipId]`.
    - If clicking empty space (Timeline Container), clear selection: `state.selectedClipIds = []`.
- **Visuals**:
    - Add `.selected` class to the clicked clip.
    - Remove `.selected` class from all other clips.
    - Style: Add a distinct border (e.g., 2px solid var(--color-accent)) or glow.

#### 2. Properties Panel Integration
- **Event**: Emit `clipSelected` event with clip data.
- **Listener**: Properties Panel (Phase 57) listens and updates its fields (Name, Duration, etc.).
- **Empty State**: If selection cleared, show "No Clip Selected" (Phase 55).

#### 3. Files to Create/Modify
- `assets/js/timeline-interaction.js` (New file for click/hover logic)
- `assets/js/timeline.js` (State management)
- `assets/css/timeline.css` (.selected styles)

#### 4. Interaction Details
- **Hover**: Cursor should be `pointer`.
- **Z-Index**: Selected clip should ideally be on top (z-index +1) if overlaps exist.

#### 5. What NOT to Do
- ❌ Do NOT implement multi-select (Ctrl+Click) yet (Phase 74).
- ❌ Do NOT implement drag yet (Phase 79).

**MediaBunny Integration**: Not applicable directly, but selected clip determines what `clip` object we manipulate later.

## Testing Checklist
- [ ] Clicking a clip adds .selected class
- [ ] Clicking another clip moves the selection
- [ ] Clicking background clears selection
- [ ] Properties panel updates with clip info
- [ ] Selected clip has visible border/highlight

## Done When
✅ Can select single clips  
✅ Visual feedback is clear  
✅ Properties panel syncs  
✅ Ready for Phase 74 (Multi-Select)
