# Phase 87: Grayscale Filter

## Goal
Apply a preset Grayscale look

## Group
**Video Filters**

## Feature to Implement

### ONE Feature: Grayscale Toggle
**Purpose**: Quick B&W effect

**Requirements**:

#### 1. What to Build
- **UI**: Checkbox "Grayscale" OR Preset Button.
- **Logic**:
    - Sets `saturation` to 0.0 OR applies specific `grayscale(1)` filter.
    - **Decision**: Use `grayscale(1)` filter for semantic clarity.

#### 2. Interaction
- Toggle on/off.

#### 3. Files to Create/Modify
- `assets/js/properties/filter-presets.js`

#### 4. What NOT to Do
- ❌ Do NOT mix with Saturation slider (if they conflict). Usually Grayscale overrides saturation.

## Testing Checklist
- [ ] Grayscale toggle works
- [ ] Can be disabled

## Done When
✅ Grayscale filter works  
✅ Ready for Phase 88
