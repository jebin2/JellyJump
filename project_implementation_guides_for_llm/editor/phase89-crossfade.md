# Phase 89: Crossfade Transition

## Goal
Create a smooth transition between two overlapping clips

## Group
**Transitions**

## Feature to Implement

### ONE Feature: Crossfade (Dissolve)
**Purpose**: Blend one clip into another

**Requirements**:

#### 1. What to Build
- **Concept**: A "Transition" object that links two clips.
- **Simplification for v1**: Just overlapping clips on different tracks with Fades?
    - **Standard NLE**: Transitions sit *between* clips on the same track.
    - **MediaBunny**: Might be easier to just use overlapping tracks + Opacity automation.
    - **Decision**: Implement **Track Overlap Crossfade**.
        - Clip A on Track 1. Clip B on Track 2.
        - Overlap them.
        - Apply Fade Out to A, Fade In to B.
- **Automated Tool**: "Add Crossfade" button.
    - Requires selecting two adjacent clips.
    - Moves them to overlap (if on same track, maybe move one to new track?).
    - **Alternative**: **Single Track Transition**.
        - MediaBunny supports `CrossfadeNode`?
        - If yes, use that.
        - If no, stick to **Overlap + Opacity**.
    - **Decision**: **Overlap + Opacity** is the most robust "manual" way for v1.

#### 2. Interaction
- Select Clip A and Clip B.
- Click "Crossfade".
- System adjusts `fadeIn`/`fadeOut` to match overlap duration.

#### 3. Files to Create/Modify
- `assets/js/timeline-actions.js`

#### 4. What NOT to Do
- ❌ Do NOT build a complex "Transition Track" or specific Transition Object yet if the engine doesn't support it natively.

## Testing Checklist
- [ ] Overlapping clips blend correctly
- [ ] "Crossfade" helper sets fade durations correctly
- [ ] Playback is smooth

## Done When
✅ Can create a crossfade effect  
✅ Helper action works (optional)  
✅ Ready for Phase 84
