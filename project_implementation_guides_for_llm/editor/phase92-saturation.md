# Phase 92: Saturation Filter

## Goal
Adjust color intensity of video clips

## Group
**Video Filters**

## Feature to Implement

### ONE Feature: Saturation Control
**Purpose**: Make colors pop or mute them

**Requirements**:

#### 1. What to Build
- **Data Model**: `saturation` (default 1.0).
- **UI**:
    - Slider: 0.0 (B&W) to 3.0 (Oversaturated).
- **Rendering**:
    - `filter: saturate(X)`

#### 2. Interaction
- Real-time update.

#### 3. Files to Create/Modify
- `assets/js/properties/color-properties.js`

#### 4. What NOT to Do
- ❌ Do NOT implement Hue Rotate yet.

## Testing Checklist
- [ ] Saturation slider works
- [ ] 0.0 makes it grayscale
- [ ] >1.0 makes it vivid

## Done When
✅ Saturation control functional  
✅ Ready for Phase 87
