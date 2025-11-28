# Phase 94: Sepia Filter

## Goal
Apply a preset Sepia look

---

## What to Build

Sepia filter:
- Vintage sepia tone effect
- Intensity slider (0-100%)
- Warm brown tones
- Real-time preview
- Apply to selected clip
- Classic film look

---

## Feature to Implement

### ONE Feature: Sepia Toggle
**Purpose**: Old-timey film look

**Requirements**:

#### 1. What to Build
- **UI**: Checkbox "Sepia" OR Preset Button.
- **Rendering**:
    - `filter: sepia(1)` (or adjustable 0-1).
    - **Decision**: Slider 0-1 for intensity.

#### 2. Interaction
- Adjust Sepia intensity.

#### 3. Files to Create/Modify
- `assets/js/properties/filter-presets.js`

#### 4. What NOT to Do
- ❌ Do NOT implement Film Grain yet.

---

## Testing Checklist Checklist
- [ ] Sepia slider works
- [ ] Visuals look correct

---

## Done When
✅ Sepia filter works  
✅ Ready for Phase 89 (Text Overlay)
