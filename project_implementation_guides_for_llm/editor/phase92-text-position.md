# Phase 92: Text Position

## Goal
Position text elements on the video canvas

## Group
**Text Overlays**

## Feature to Implement

### ONE Feature: Text Positioning
**Purpose**: Place titles where needed (lower third, center, top)

**Requirements**:

#### 1. What to Build
- **UI Controls**:
    - **Position X**: Slider/Input (0% to 100% or pixels).
    - **Position Y**: Slider/Input (0% to 100% or pixels).
    - **Alignment**: Buttons (Left, Center, Right).
- **Data Model**:
    - `clip.position.x`
    - `clip.position.y`
    - `clip.style.align`

#### 2. Interaction
- Adjust sliders to move text.
- **Advanced (Optional)**: Drag text in Preview panel.
    - **Decision**: Stick to **Sliders** for v1 simplicity.

#### 3. Rendering
- Update Canvas drawing coordinates.
- Handle alignment (measure text width).

#### 4. Files to Create/Modify
- `assets/js/properties/text-properties.js`

#### 5. What NOT to Do
- ❌ Do NOT implement complex constraints or snapping in the preview window.

## Testing Checklist
- [ ] X/Y sliders move text
- [ ] Alignment buttons work (center text around point)
- [ ] Text stays within bounds (or not, up to user)

## Done When
✅ Text can be positioned  
✅ Ready for Phase 93 (Transform Controls)
