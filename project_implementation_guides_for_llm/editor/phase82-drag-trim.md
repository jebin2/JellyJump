# Phase 82: Drag to Trim Clip

## Goal
Implement drag interaction to trim clip start/end points

---

## What to Build

Drag to trim clips:
- Drag trim handles
- Resize clip duration
- Visual feedback during drag
- Snap to frames/markers
- Ripple or gap mode
- Update timeline layout

---

## Feature to Implement

### ONE Feature: Drag to Trim
**Purpose**: Adjust the in-point and out-point of a clip directly on the timeline

**Requirements**:

#### 1. What to Build
- **Drag Logic**:
    - Mouse down on Handle -> Start Drag
    - Mouse move -> Update Clip Duration/Start
    - Mouse up -> Commit Change
- **Left Handle**: Adjusts `startTime` AND `sourceStartTime` (Slip edit? No, usually just trim in-point)
    - **Trim In**: Moves start time right, reduces duration.
    - **Extend In**: Moves start time left, increases duration (if media available).
- **Right Handle**: Adjusts `duration`.
    - **Trim Out**: Reduces duration.
    - **Extend Out**: Increases duration (if media available).

#### 2. Interaction Details
- **Dragging Left Handle**:
    - `newStartTime = mouseTime`
    - `newDuration = oldEndTime - newStartTime`
    - Constraint: `newStartTime < oldEndTime - minDuration`
- **Dragging Right Handle**:
    - `newDuration = mouseTime - startTime`
    - Constraint: `newDuration > minDuration`

#### 3. Constraints & Collision
- **Min Duration**: e.g., 1 frame or 0.5s
- **Media Bounds**: Cannot extend beyond source media duration (if known)
- **Collision**: Cannot drag into adjacent clips (for v1, stop at neighbor)
    - **Ripple**: Advanced (Phase 90+). For now, **Overwrite** or **Block**.
    - **Decision**: **Block** at adjacent clip boundaries for simplicity.

#### 4. Visual Feedback
- Update clip width/position in real-time (or ghost element)
- Update tooltip with new duration/times

#### 5. Files to Create/Modify
- `assets/js/timeline-interaction.js`
- `assets/js/timeline.js` (Update clip data)

#### 6. MediaBunny Integration
- When trim completes, update the underlying MediaBunny `Clip` object properties (`startTime`, `duration`, `sourceStartTime`)
- `clip.setTimes(start, duration)`

#### 7. What NOT to Do
- ❌ Do NOT implement Ripple Edit yet
- ❌ Do NOT implement Slip/Slide tools yet

---

## Testing Checklist Checklist
- [ ] Drag right handle changes duration
- [ ] Drag left handle changes start time and duration
- [ ] Cannot drag past minimum duration
- [ ] Cannot drag into adjacent clips (collision check)
- [ ] Visuals update smoothly
- [ ] Data model updates correctly after drag
- [ ] Undo/Redo works (if Phase 80 ready, otherwise note it)

---

## Done When
✅ Can trim start and end of clips  
✅ Constraints (min duration, collision) work  
✅ UI updates in real-time  
✅ Ready for Phase 77
