# Phase 85: Brightness/Contrast Filter

## Goal
Adjust brightness and contrast of video clips

## Group
**Video Filters**

## Feature to Implement

### ONE Feature: Color Correction (Basic)
**Purpose**: Fix lighting issues or create artistic looks

**Requirements**:

#### 1. What to Build
- **Data Model**: `brightness` (default 1.0), `contrast` (default 1.0).
- **UI**:
    - **Properties Panel**: "Color" section.
    - Sliders:
        - Brightness: 0.0 to 2.0
        - Contrast: 0.0 to 2.0
- **Rendering**:
    - Apply filter to video frame.
    - CSS Filter: `filter: brightness(X) contrast(Y)` (If using Video Element).
    - WebGL: Shader uniform update (If using Canvas).
    - **Decision**: Use **CSS Filters** for v1 if possible (fastest), or **Canvas Filter** if drawing to canvas.

#### 2. Interaction
- Real-time preview as slider moves.

#### 3. Files to Create/Modify
- `assets/js/properties/color-properties.js`
- `assets/js/timeline-renderer.js`

#### 4. MediaBunny Integration
- `clip.setFilter('brightness', value)`
- `clip.setFilter('contrast', value)`

#### 5. What NOT to Do
- ❌ Do NOT implement Curves or Levels yet.

## Testing Checklist
- [ ] Brightness slider affects video
- [ ] Contrast slider affects video
- [ ] Values persist in project data
- [ ] Reset button works (optional)

## Done When
✅ Brightness/Contrast adjustable  
✅ Visuals update in real-time  
✅ Ready for Phase 86
