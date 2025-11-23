# Phase 55: Empty State Display

## Goal
Implement an "Empty State" view in the Properties Panel to inform the user when no item is selected.

## Group
Properties Panel Group (Phases 54-59)

## What to Build
1.  **Empty State Container**: A centered div within the properties panel.
2.  **Visual Elements**: An icon and a helper message.
3.  **Visibility Logic**: Show by default (since nothing is selected initially).

## Requirements
- **Container ID**: `properties-empty-state`
- **Content**:
    - **Icon**: A large, muted icon (e.g., `🖱️` or `📋`).
    - **Title**: "No Selection"
    - **Message**: "Select a clip in the timeline or an item in the library to view details."
- **Styling**:
    - Centered vertically and horizontally.
    - Text color: Muted/Secondary text color.
    - Font size: Title (1.2rem), Message (0.9rem).

## Interaction Behavior
- **Initial State**: Visible on page load.
- **Persistence**: Remains visible until hidden by JavaScript (Phase 59).

## Styling Details
- Use flexbox to center content: `display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%;`
- Add some padding to prevent text touching edges.

## Edge Cases
- **Panel too short**: Ensure text doesn't overflow if panel height is very small.

## Files to Modify
- `editor.html`
- `assets/css/editor.css`

## What NOT to Do
- Do not implement the logic to hide it yet (Phase 59).

## Testing Checklist
- [ ] "No Selection" message is visible in the right panel.
- [ ] Content is centered vertically and horizontally.
- [ ] Text is readable but visually distinct as a "placeholder" state.

## Done When
- [ ] Empty state HTML structure is added.
- [ ] CSS styling centers the content.
- [ ] It looks good on different panel sizes.
