# Phase 81: Clip Trim Handles

## Goal
Render interactive handles on the edges of selected clips for trimming

---

## What to Build

Trim handles:
- Show handles on selected clip
- Left and right edges
- Hover to highlight
- Cursor change on hover
- Visual indicators
- Touch-friendly size

---

## Feature to Implement

### ONE Feature: Trim Handles Visuals
**Purpose**: Visual affordance to indicate that clips can be resized/trimmed

**Requirements**:

#### 1. What to Build
- **Handles**: Visual elements on Left and Right edges of a **selected** clip
- **Appearance**:
    - Width: ~5-10px
    - Color: Accent color or white
    - Cursor: `col-resize` or `ew-resize`
- **Visibility**: Only visible when clip is selected

#### 2. DOM Structure
- Inside `.timeline-clip`:
    - `<div class="clip-handle handle-left"></div>`
    - `<div class="clip-handle handle-right"></div>`
- OR render them as separate overlays (easier to keep inside clip for positioning)

#### 3. Styling (CSS)
- Absolute positioning within the clip
- `z-index`: Higher than clip content
- Hover state: Highlight handle

#### 4. Files to Create/Modify
- `assets/css/timeline.css`
- `assets/js/timeline-renderer.js` (Update clip rendering)

#### 5. Interaction Preparation
- Add `data-action="trim-left"` and `data-action="trim-right"` to handles
- This phase is **Visuals ONLY**. Interaction is Phase 76.

#### 6. What NOT to Do
- ❌ Do NOT implement the actual dragging logic yet
- ❌ Do NOT show handles on unselected clips

**MediaBunny Integration**: Not applicable

---

## Testing Checklist Checklist
- [ ] Selecting a clip shows handles
- [ ] Deselecting hides handles
- [ ] Handles are positioned correctly (left/right edges)
- [ ] Cursor changes to resize arrow on hover
- [ ] Handles do not obscure clip content too much
- [ ] Multi-selection: Show handles on ALL selected clips? (Yes, usually)

---

## Done When
✅ Handles appear on selected clips  
✅ CSS styling is correct  
✅ Cursor feedback is correct  
✅ Ready for Phase 76 (Drag to Trim)
