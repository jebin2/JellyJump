# Phase 65: Context Switching Logic

## Goal
Implement the logic to update the Properties Panel based on what the user selects (Media Library item vs. Timeline Clip). This makes the panel "context-aware".

## Group
Properties Panel Group (Phases 54-59)

## What to Build
1.  **Selection State Manager**: A simple JS object or function to track the currently selected item.
2.  **Update Logic**:
    - **Case A: No Selection**: Show Empty State (Phase 55). Hide Tabs.
    - **Case B: Media Library Item**: Show Tabs. Select "Info" tab. Disable/Hide "Settings" tab (or show "No settings available").
    - **Case C: Timeline Clip**: Show Tabs. Enable both. Update Info fields.

## Requirements
- **Function**: `updatePropertiesPanel(selectionType, data)`
    - `selectionType`: 'none', 'library', 'timeline'
    - `data`: Object containing name, duration, etc.
- **DOM Manipulation**:
    - Toggle `display: none` on `#properties-empty-state` and `#properties-tab-bar` / content.
    - Update text content of Info fields based on `data`.

## Interaction Behavior
- **Test with Console**: Since we don't have full click selection yet (Phase 73), we will test this by calling the function manually in the console.
    - `updatePropertiesPanel('none')` -> Shows empty state.
    - `updatePropertiesPanel('library', {name: 'foo.mp4'})` -> Shows Info tab with 'foo.mp4'.
    - `updatePropertiesPanel('timeline', {name: 'bar.mp4'})` -> Shows Info tab, enables Settings.

## Styling Details
- Ensure smooth transition (no jumping layout).

## Edge Cases
- **Missing Data**: Handle cases where `data` might be incomplete (show "Unknown").

## Files to Modify
- `assets/js/editor.js` (or `properties-panel.js`)

## What NOT to Do
- Do not implement the actual click listeners on the timeline/library yet (those are in their respective groups). Just the *response* logic.

## Testing Checklist
- [ ] Calling `updatePropertiesPanel('none')` shows the empty state.
- [ ] Calling `updatePropertiesPanel('library', ...)` shows the Info tab and populates data.
- [ ] Calling `updatePropertiesPanel('timeline', ...)` shows the Info tab and enables Settings.
- [ ] Switching between types works correctly without refreshing.

## Done When
- [ ] JavaScript function for context switching is implemented.
- [ ] DOM updates correctly reflect the state.
- [ ] Metadata fields update dynamically based on input data.
