# Phase 78: Delete Selected Clip

## Goal
Remove selected clips from the timeline

## Group
**Clip Selection & Editing**

## Feature to Implement

### ONE Feature: Delete Clip
**Purpose**: Remove unwanted clips

**Requirements**:

#### 1. What to Build
- **Trigger**: `Delete` or `Backspace` key, or Trash icon in toolbar
- **Target**: All clips in `selectedClipIds`
- **Logic**:
    - Remove clip objects from the Track/Timeline model
    - Clear selection state
    - Re-render timeline

#### 2. Interaction Behavior
- User selects one or more clips.
- User presses Delete.
- Clips disappear.
- **Gap**: A gap remains (Lift delete).
- **Ripple Delete**: (Shift+Delete) - Optional for v1. **Stick to Lift (Gap) Delete**.

#### 3. Files to Create/Modify
- `assets/js/timeline-actions.js`
- `assets/js/timeline.js`

#### 4. MediaBunny Integration
- `track.removeClip(clipId)`
- Ensure resources are cleaned up if necessary (though usually just a reference removal).

#### 5. What NOT to Do
- ❌ Do NOT implement Ripple Delete (closing the gap) yet.

## Testing Checklist
- [ ] Delete key removes selected clip(s)
- [ ] Toolbar trash button removes selected clip(s)
- [ ] Multi-selection delete works
- [ ] Undo restores the deleted clips
- [ ] No errors if nothing selected

## Done When
✅ Selected clips can be deleted  
✅ Timeline updates correctly  
✅ Undo/Redo works  
✅ Ready for Phase 79
