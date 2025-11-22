# Phase 41: Transform Controls

## Goal
Implement position, scale, rotation, and opacity controls for clips

**MediaBunny Integration**: Transform operations applied during frame processing. **Consult** mediabunny-llms-full.md for:
- `video.process` callback for transforms
- Canvas transform methods (translate, scale, rotate)
- Alpha compositing for opacity

## Features to Implement

### Feature 1: Transform Panel in Properties
**Purpose**: Transform controls in right sidebar

**Requirements**:
- **🔧 Transform** section in Properties Panel (Phase 29)
- Show when video/image clip selected
- Grouped controls for Position, Scale, Rotation, Opacity
- Reset button for each group
- Global reset for all transforms

### Feature 2: Position Controls (X & Y Axis)
**Purpose**: Move clip within video frame

**Requirements**:
- **X Position** slider (-100% to +100%)
  - 0% = centered horizontally
  - -100% = left edge
  - +100% = right edge
- **Y Position** slider (-100% to +100%)
  - 0% = centered vertically
  - -100% = top edge
  - +100% = bottom edge
- Number inputs for precise values
- Default: (0%, 0%) - centered
- Real-time preview update

### Feature 3: Scale/Size Controls
**Purpose**: Resize clip

**Requirements**:
- **Width** slider (0% to 200%)
  - 100% = original width
  - 0% = invisible
  - 200% = double width
- **Height** slider (0% to 200%)
- **Lock Aspect Ratio** toggle checkbox
  - When locked, width/height scale together
  - When unlocked, scale independently
- **Fit to Frame** button (reset to 100% × 100%)
- Default: 100% × 100%
- Real-time preview update

### Feature 4: Rotation Control
**Purpose**: Rotate clip around center

**Requirements**:
- **Rotation** slider (0° to 360°)
- Circular slider UI (optional, visual wheel)
- Number input for precise degrees
- Negative values for counter-clockwise (e.g., -45°)
- Default: 0° (no rotation)
- Real-time preview showing rotation

### Feature 5: Opacity Control
**Purpose**: Adjust clip transparency

**Requirements**:
- **Opacity** slider (0% to 100%)
  - 0% = fully transparent (invisible)
  - 100% = fully opaque
  - 50% = semi-transparent
- Percentage display
- Default: 100%
- Real-time preview with alpha blending

### Feature 6: Visual Handles on Preview (Optional)
**Purpose**: Direct manipulation on canvas

**Requirements**:
- Bounding box around selected clip on preview
- **Corner handles** for scaling
- **Edge handles** for asymmetric scaling
- **Rotation handle** at top center
- **Move handle** in center (drag to reposition)
- Visual feedback while dragging
- Snap to center/edges (optional)
- Update sliders as handles dragged

### Feature 7: Transform Application
**Purpose**: Apply transforms to video frames

**Requirements**:
- **During Preview**:
  - Apply transforms using canvas 2D context
  - `ctx.translate(x, y)` for position
  - `ctx.scale(scaleX, scaleY)` for size
  - `ctx.rotate(angle)` for rotation
  - `ctx.globalAlpha = opacity` for transparency
- **During Export** (Phase 42):
  - Same transforms applied to each frame
  - MediaBunny `video.process` callback
- Maintain aspect ratio calculations
- Handle transforms in correct order (translate → rotate → scale)

### Feature 8: Transform Data Storage
**Purpose**: Save transform values to clip

**Requirements**:
- Add transform object to clip data:
  ```javascript
  clip.transform = {
    position: {x: 0, y: 0},  // percentage
    scale: {width: 100, height: 100, lockAspectRatio: true},
    rotation: 0,  // degrees
    opacity: 100  // percentage
  };
  ```
- Update on slider change
- Serialize to JSON (Phase 43)

### Feature 9: Reset Functions
**Purpose**: Clear transforms

**Requirements**:
- **Reset Position** button → (0%, 0%)
- **Reset Scale** button → (100%, 100%)
- **Reset Rotation** button → 0°
- **Reset Opacity** button → 100%
- **Reset All** button → All defaults
- Add to undo stack (Phase 37)

### Feature 10: Transform Timeline Indicator
**Purpose**: Show which clips have transforms

**Requirements**:
- Icon overlay on timeline clip
- Tooltip showing active transforms
- Different icon for position/scale/rotation

### Feature 11: Animation Support (Future Enhancement Placeholder)
**Purpose**: Note for keyframe animation (not implemented in this phase)

**Requirements**:
- Comment in code: "// TODO: Keyframe animation in future phase"
- Data structure ready for keyframes:
  ```javascript
  clip.keyframes = [
    {time: 0, transform: {...}},
    {time: 5, transform: {...}}
  ];
  ```
- This phase only implements static transforms

## Testing Checklist
- [ ] Transform panel displays in Properties
- [ ] X position slider moves clip horizontally
- [ ] Y position slider moves clip vertically
- [ ] Width slider scales clip width
- [ ] Height slider scales clip height
- [ ] Lock aspect ratio maintains proportions
- [ ] Rotation slider rotates clip
- [ ] Opacity slider changes transparency
- [ ] Visual handles on preview (if implemented)
- [ ] Transforms preview in real-time
- [ ] Transform data saved to clip object
- [ ] Reset buttons restore defaults
- [ ] Undo/redo works with transforms
- [ ] Timeline shows transform indicators
- [ ] Transforms export correctly (verified in Phase 42)

## Done When
✅ Transform panel functional  
✅ Position controls (X/Y) work  
✅ Scale controls with aspect ratio lock  
✅ Rotation control functional  
✅ Opacity control works  
✅ Real-time preview applies transforms  
✅ Transform data persists  
✅ Reset functions work  
✅ All tests pass  
✅ Ready for Phase 42 (Export)

---
**Phase**: 41 | **Component**: Editor  
**Estimated Time**: 35-45 minutes
