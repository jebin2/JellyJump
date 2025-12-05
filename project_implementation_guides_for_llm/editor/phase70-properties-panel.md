# Phase 60: Properties Panel Structure

## Goal
Create the main container for the Properties Panel (Right Sidebar) and ensure it is properly positioned and styled within the editor layout.

## Group
Properties Panel Group (Phases 54-59)

## What to Build
1.  **Panel Container**: A dedicated `div` for the right sidebar.
2.  **Basic Styling**: Apply Dark Neobrutalism theme (borders, background).
3.  **Responsive Width**: Ensure it maintains ~30% width.

## Requirements
- **Container ID**: `properties-panel`
- **Position**: Right side of the editor (flex item).
- **Width**: 30% (min-width: 300px).
- **Styling**:
    - Border-left: 3px solid black.
    - Background: Theme surface color.
    - Overflow-y: Auto (for scrolling content).
- **Header**: Optional "Properties" header (can be part of the tab bar later).

## Interaction Behavior
- **Resize**: Should resize proportionally with the window.
- **Scroll**: Should show a scrollbar if content exceeds height.

## Styling Details
- Use CSS variables for colors (`--bg-surface`, `--border-color`).
- Ensure it matches the height of the Media Library and Preview Panel.

## Edge Cases
- **Small Screen**: Panel might become too narrow. Set a `min-width`.

## Files to Modify
- `editor.html`
- `assets/css/editor.css`

## What NOT to Do
- Do not implement tabs yet (Phase 56).
- Do not add content yet (Phase 55, 57).

---

## Testing Checklist Checklist
- [ ] Right panel is visible and positioned correctly.
- [ ] Width is approximately 30% of the editor area.
- [ ] Panel has a left border separating it from the preview.
- [ ] Panel resizes when the window is resized.

---

## Done When
- [ ] `properties-panel` container exists in DOM.
- [ ] Panel is styled with correct borders and background.
- [ ] Layout is stable (20% - 50% - 30%).
