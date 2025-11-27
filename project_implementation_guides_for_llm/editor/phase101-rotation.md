# Phase 101: Rotation Control

## Goal
Rotate video clips

## Group
**Transform Controls**

## Feature to Implement

### ONE Feature: Rotation
**Purpose**: Fix orientation or artistic effect

**Requirements**:

#### 1. What to Build
- **UI**:
    - **Rotation**: Slider (0 to 360 degrees) or Knob.
- **Data Model**:
    - `clip.transform.rotation` (degrees or radians).

#### 2. MediaBunny Integration
- `TransformEffect` rotation parameter.

#### 3. Interaction
- Adjust slider -> Video spins.

#### 4. Files to Create/Modify
- `assets/js/properties/transform-properties.js`

#### 5. What NOT to Do
- ❌ Do NOT implement 3D rotation. 2D only.

## Testing Checklist
- [ ] Rotation slider works
- [ ] 90, 180, 270 degrees look correct
- [ ] Center anchor point

## Done When
✅ Rotation works  
✅ Ready for Phase 96
