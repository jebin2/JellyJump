# Phase 96: Opacity Control

## Goal
Adjust transparency of video clips

## Group
**Transform Controls**

## Feature to Implement

### ONE Feature: Global Opacity
**Purpose**: Semi-transparent overlays or ghosting

**Requirements**:

#### 1. What to Build
- **UI**:
    - **Opacity**: Slider (0% to 100%).
- **Data Model**:
    - `clip.opacity` (0.0 to 1.0).

#### 2. MediaBunny Integration
- Same as Phase 82 (Fade), but this is a static global value.
- If Fade is also active, multiply them: `finalOpacity = globalOpacity * fadeOpacity`.

#### 3. Interaction
- Adjust slider -> Video becomes transparent.

#### 4. Files to Create/Modify
- `assets/js/properties/transform-properties.js`

#### 5. What NOT to Do
- ❌ Do NOT confuse with Fade In/Out. This is the base opacity.

## Testing Checklist
- [ ] Opacity slider works
- [ ] 0% is invisible
- [ ] 50% shows background (if any)

## Done When
✅ Opacity control works  
✅ Ready for Phase 97 (Export)
