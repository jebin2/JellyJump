# Phase 83: Split Clip at Playhead

## Goal
Split the selected clip into two separate clips at the current playhead position

## Group
**Clip Selection & Editing**

## Feature to Implement

### ONE Feature: Split Clip
**Purpose**: Allow users to cut a clip into two pieces for independent editing

**Requirements**:

#### 1. What to Build
- **Trigger**: "Split" button in toolbar (scissor icon) OR `S` / `Ctrl+K` shortcut
- **Logic**:
    1. Identify **selected clip** under the **playhead**.
    2. If no clip selected, split ALL clips under playhead? (Standard NLE behavior).
    3. **Decision**: Split **Selected Clip** only for v1. If nothing selected, do nothing (or warn).
- **Operation**:
    - Original Clip: `duration` becomes `playheadTime - startTime`
    - New Clip:
        - `startTime` = `playheadTime`
        - `sourceStartTime` = `originalSourceStart + (playheadTime - originalStart)`
        - `duration` = `originalEndTime - playheadTime`
        - Copy other properties (track, mediaId, etc.)

#### 2. Interaction Behavior
- User positions playhead.
- User selects clip (optional, if we enforce selection).
- User presses Split.
- **Result**: Two clips appear. The second one is usually selected automatically.

#### 3. Edge Cases
- **Playhead at start/end**: Do nothing (cannot split 0 duration).
- **Playhead outside clip**: Do nothing.

#### 4. Files to Create/Modify
- `assets/js/timeline-actions.js` (New file for actions like split/delete?)
- `assets/js/timeline.js`

#### 5. MediaBunny Integration
- Create a new `Clip` instance for the second part.
- Update the first `Clip` instance.
- `project.addClip(newClip)`

#### 6. What NOT to Do
- ❌ Do NOT implement "Razor Tool" (mouse click to split) yet. Just Playhead split.

## Testing Checklist
- [ ] Split button works on selected clip
- [ ] Original clip duration is correct
- [ ] New clip starts exactly where split happened
- [ ] New clip source time is correct (video continuity)
- [ ] Undo/Redo works
- [ ] Splitting at edges is prevented

## Done When
✅ Can split a clip into two correct parts  
✅ Visuals update immediately  
✅ No gaps or overlaps created  
✅ Ready for Phase 78
