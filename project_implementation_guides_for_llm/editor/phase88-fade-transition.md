# Phase 88: Fade In/Out Transition

## Goal
Apply Fade In and Fade Out effects to individual clips

## Group
**Transitions**

## Feature to Implement

### ONE Feature: Fade In/Out
**Purpose**: Smoothly start or end a clip's visibility

**Requirements**:

#### 1. What to Build
- **Data Model**: Add `fadeInDuration` and `fadeOutDuration` to Clip object.
- **UI**:
    - **Properties Panel**: Sliders/Inputs for "Fade In" and "Fade Out" (0s to 5s).
    - **Timeline Visuals**: Small opacity ramp overlay on clip start/end (optional but good).
- **Rendering**:
    - Update `ClipRenderer` (or MediaBunny Player) to handle opacity over time.
    - `opacity = (currentTime - startTime) / fadeInDuration` (clamped 0-1)

#### 2. MediaBunny Integration
- **CRITICAL**: Use MediaBunny's `EffectNode` or `VideoNode` opacity properties.
- Likely need a `FadeEffect` or manually animate `opacity` param.
- API: `clipNode.addEffect(new FadeInEffect(duration))`

#### 3. Interaction
- Select clip -> Adjust Fade In slider in Properties -> Preview updates.

#### 4. Files to Create/Modify
- `assets/js/properties/transition-properties.js`
- `assets/js/timeline-renderer.js` (Visuals)

#### 5. What NOT to Do
- ❌ Do NOT implement drag handles for fades on the timeline yet (Phase 100+). Use Properties panel.

## Testing Checklist
- [ ] Fade In slider updates clip data
- [ ] Fade Out slider updates clip data
- [ ] Video actually fades in/out during playback
- [ ] Visual indicator on clip (optional)
- [ ] Zero duration disables fade

## Done When
✅ Can apply fade in/out to a clip  
✅ Playback reflects the fade  
✅ Properties panel controls work  
✅ Ready for Phase 83
