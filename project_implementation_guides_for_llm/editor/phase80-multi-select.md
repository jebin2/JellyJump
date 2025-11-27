# Phase 80: Multi-Clip Selection

## Goal
Enable selection of multiple clips on the timeline using keyboard modifiers

## Group
**Clip Selection & Editing**

## Feature to Implement

### ONE Feature: Multi-Clip Selection
**Purpose**: Allow users to apply actions (move, delete) to multiple clips simultaneously

**Requirements**:

#### 1. What to Build
- **Selection State**: Update `selectedClipIds` to be a Set or Array, not just a single ID
- **Modifier Keys**:
    - **Ctrl/Cmd + Click**: Toggle selection of clicked clip (add/remove)
    - **Shift + Click**: Select range (optional for v1, maybe just add to selection)
- **Visuals**: Highlight all selected clips (border/background change)
- **Click Outside**: Clicking empty space clears ALL selection

#### 2. Interaction Behavior
- **Single Click**: Clears previous selection, selects new clip
- **Ctrl + Click**: Keeps previous selection, toggles clicked clip
- **Drag Selection (Marquee)**: (Optional for this phase, maybe future) -> **Stick to Click for now**

#### 3. Properties Panel Update
- If multiple clips selected:
    - Show "Multiple items selected"
    - OR hide properties
    - OR show common properties (too complex for v1)
- **Decision**: Show "Multiple Selection" message in Properties Panel

#### 4. Files to Create/Modify
- `assets/js/timeline.js` (or `timeline-selection.js`)
- `assets/js/properties-panel.js`

#### 5. JavaScript Logic
- `handleClipClick(clipId, event)`
- Check `event.ctrlKey` or `event.metaKey`
- Update `state.selectedClips`
- `renderClips()` -> apply `.selected` class to multiple elements

#### 6. What NOT to Do
- ❌ Do NOT implement marquee selection (drag box) yet
- ❌ Do NOT implement multi-edit in properties panel

**MediaBunny Integration**: Not applicable

## Testing Checklist
- [ ] Clicking a clip selects it
- [ ] Ctrl+Click adds another clip to selection
- [ ] Ctrl+Click on selected clip removes it
- [ ] Clicking empty space clears selection
- [ ] Properties panel handles multi-selection state gracefully
- [ ] Visual highlighting works for multiple items

## Done When
✅ Can select multiple clips via Ctrl+Click  
✅ Visuals reflect multi-selection  
✅ Properties panel doesn't crash  
✅ Ready for Phase 75
