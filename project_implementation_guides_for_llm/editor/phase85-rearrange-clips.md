# Phase 85: Drag to Rearrange Clips

## Goal
Move clips around the timeline by dragging them

## Group
**Clip Selection & Editing**

## Feature to Implement

### ONE Feature: Drag and Drop Clips
**Purpose**: Reposition clips in time or move them between tracks

**Requirements**:

#### 1. What to Build
- **Drag Logic**:
    - Mouse Down on Clip Body (not handles) -> Start Drag
    - Mouse Move -> Update Ghost/Position
    - Mouse Up -> Commit new position
- **Snapping**:
    - Snap to other clip edges
    - Snap to Playhead
    - Snap to Grid (if enabled)
    - **Threshold**: ~10px

#### 2. Interaction Details
- **Free Drag**: User can drag clip anywhere.
- **Track Change**: User can drag vertically to move to another track.
- **Collision**:
    - If dropped on top of another clip:
        - Option A: Block drop (snap back)
        - Option B: Overwrite (destructive)
        - **Decision**: **Overwrite** is standard for NLEs, but **Block** is safer for v1. Let's go with **Block/Snap to nearest empty space** if possible, or just **Allow Overlap** (easiest, but messy).
        - **Revised Decision**: **Allow Overlap** visually, but warn or handle playback priority (top track wins). This is easiest to implement.

#### 3. Visual Feedback
- **Ghosting**: Show semi-transparent copy while dragging
- **Cursor**: `grabbing`
- **Highlight**: Highlight potential drop track

#### 4. Files to Create/Modify
- `assets/js/timeline-drag.js` (New file for drag logic?)
- `assets/js/timeline.js`

#### 5. MediaBunny Integration
- Update `clip.startTime` and `clip.trackId`
- `project.moveClip(clipId, newTrackId, newStartTime)`

#### 6. What NOT to Do
- ❌ Do NOT implement "Insert Mode" (pushing other clips away).
- ❌ Do NOT implement complex collision resolution (ripple).

## Testing Checklist
- [ ] Can drag clip along time axis
- [ ] Can drag clip to different track
- [ ] Snapping to playhead/clips works
- [ ] Position updates correctly on drop
- [ ] Undo/Redo works

## Done When
✅ Clips can be moved freely  
✅ Track changing works  
✅ Snapping works  
✅ Ready for Phase 80 (Undo/Redo)
