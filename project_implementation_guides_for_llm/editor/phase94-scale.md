# Phase 94: Scale Control

## Goal
Resize video clips

## Group
**Transform Controls**

## Feature to Implement

### ONE Feature: Scale/Zoom
**Purpose**: Zoom in/out or shrink for PiP

**Requirements**:

#### 1. What to Build
- **UI**:
    - **Scale**: Slider (0.1 to 3.0).
    - **Uniform Scale**: Lock aspect ratio (default true).
- **Data Model**:
    - `clip.transform.scale` (default 1.0).

#### 2. MediaBunny Integration
- `TransformEffect` scale parameter.
- Ensure anchor point is center (usually default).

#### 3. Interaction
- Adjust slider -> Video grows/shrinks.

#### 4. Files to Create/Modify
- `assets/js/properties/transform-properties.js`

#### 5. What NOT to Do
- ❌ Do NOT implement non-uniform scaling (stretching) unless requested. Keep it simple.

## Testing Checklist
- [ ] Scale slider resizes video
- [ ] Center anchor point is maintained
- [ ] 1.0 is original size

## Done When
✅ Scale control works  
✅ Ready for Phase 95
