# Phase 90: Wipe Transition

## Goal
Implement a linear wipe transition between clips

---

## What to Build

Wipe transition:
- Directional wipe effect
- Direction options (L/R/U/D)
- Edge softness control
- Duration slider
- Live preview
- Multiple wipe patterns

---

## Feature to Implement

### ONE Feature: Wipe Transition
**Purpose**: A specific transition style (Left to Right wipe)

**Requirements**:

#### 1. What to Build
- **Effect**: A mask that animates position over time.
- **MediaBunny Integration**:
    - `WipeEffect` or `MaskNode`.
    - If not available, use `WebGL` shader node (advanced).
    - **Fallback**: If too hard, skip or implement "Slide" (animate position).
    - **Assumption**: MediaBunny has basic effects. Use `Wipe`.

#### 2. UI Controls
- **Transition Panel**: Select "Wipe Left", "Wipe Right".
- **Duration**: Slider.

#### 3. Implementation Details
- Similar to Fade, but animates a `mask` property or `clip` rect.
- `clip-path: inset(0 0 0 ${progress}%)` (CSS) -> **But this is for Video Canvas**.
- Need to update the **WebGL/Canvas renderer**.

#### 4. Files to Create/Modify
- `assets/js/effects/WipeEffect.js`
- `assets/js/properties/transition-properties.js`

#### 5. What NOT to Do
- ❌ Do NOT implement 50 different wipe shapes. Just Linear (Left/Right).

---

## Testing Checklist Checklist
- [ ] Wipe effect renders correctly
- [ ] Direction can be changed
- [ ] Duration works
- [ ] Performance is acceptable

---

## Done When
✅ Wipe transition works  
✅ Configurable direction/duration  
✅ Ready for Phase 85 (Filters)
