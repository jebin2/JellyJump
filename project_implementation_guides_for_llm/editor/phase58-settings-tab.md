# Phase 58: Settings Tab Foundation

## Goal
Create the container and basic structure for the "Settings" tab, which will eventually host configurable controls like volume, position, and effects.

## Group
Properties Panel Group (Phases 54-59)

## What to Build
1.  **Scrollable Container**: Ensure the settings area can scroll independently.
2.  **Placeholder Sections**: Visual headers for future controls (e.g., "Transform", "Audio", "Color").
3.  **Placeholder Message**: "Select a clip to configure settings" (if needed).

## Requirements
- **Container**: Inside `tab-content-settings`.
- **Structure**:
    - **Header**: "Transform" (Visual only)
    - **Placeholder Control**: A disabled or dummy slider/input to show where controls will go.
    - **Header**: "Audio" (Visual only)
    - **Placeholder Control**: A dummy volume slider.
- **Styling**:
    - Consistent with the Info tab.
    - Section headers should be distinct (e.g., slightly larger font, bottom border).

## Interaction Behavior
- **Scrolling**: If many sections are added, the container should scroll.

## Styling Details
- Use standard form element styling from the theme (inputs, sliders).

## Edge Cases
- **Empty Settings**: If an item has no settings (e.g., a simple image might not have audio settings), those sections shouldn't appear. For now, just show all placeholders.

## Files to Modify
- `editor.html`
- `assets/css/editor.css`

## What NOT to Do
- Do not implement actual functional controls (Volume, Position, etc. come in later phases).

## Testing Checklist
- [ ] Settings tab shows placeholder sections.
- [ ] Layout allows for scrolling if content is tall.
- [ ] Visual hierarchy (Headers vs Controls) is clear.

## Done When
- [ ] HTML structure for settings container is added.
- [ ] Placeholder sections are visible.
- [ ] Basic styling is applied.
