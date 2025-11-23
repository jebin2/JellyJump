# Phase 93: Position Controls (X/Y)

## Goal
Move video clips on the canvas (Picture-in-Picture)

## Group
**Transform Controls**

## Feature to Implement

### ONE Feature: Video Positioning
**Purpose**: Create PiP effects or adjust framing

**Requirements**:

#### 1. What to Build
- **UI**:
    - "Transform" section in Properties Panel.
    - **Position X**: Slider (-50% to 150%).
    - **Position Y**: Slider (-50% to 150%).
- **Data Model**:
    - `clip.transform.x` (default 0 or 0.5 depending on origin).
    - `clip.transform.y`.

#### 2. MediaBunny Integration
- Use `TransformEffect` or `VideoNode` positioning.
- Coordinate system: Usually 0,0 is center or top-left. Check MediaBunny docs.
- **Assumption**: Normalized coordinates (0.0-1.0).

#### 3. Interaction
- Select video clip -> Adjust sliders -> Video moves.

#### 4. Files to Create/Modify
- `assets/js/properties/transform-properties.js`

#### 5. What NOT to Do
- ❌ Do NOT implement on-canvas drag handles for video yet.

## Testing Checklist
- [ ] X slider moves video horizontally
- [ ] Y slider moves video vertically
- [ ] Values persist
- [ ] Reset button works

## Done When
✅ Video positioning works  
✅ Ready for Phase 94
