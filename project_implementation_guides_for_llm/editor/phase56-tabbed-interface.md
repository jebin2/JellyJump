# Phase 56: Tabbed Interface UI

## Goal
Implement the tab navigation structure (Info | Settings) within the Properties Panel to allow switching between metadata and configuration views.

## Group
Properties Panel Group (Phases 54-59)

## What to Build
1.  **Tab Bar Container**: A flex container at the top of the properties panel.
2.  **Tab Buttons**: Two buttons: "Info" and "Settings".
3.  **Content Containers**: Two separate `div`s for the tab content.
4.  **Switching Logic**: JavaScript to toggle visibility and active states.

## Requirements
- **Tab Bar**:
    - ID: `properties-tab-bar`
    - Full width, height ~40px.
    - Border-bottom: 2px solid theme border color.
- **Buttons**:
    - IDs: `tab-btn-info`, `tab-btn-settings`
    - Flex-grow: 1 (equal width).
    - Active State: High contrast background, bold text.
    - Inactive State: Muted background, normal text.
- **Content Areas**:
    - IDs: `tab-content-info`, `tab-content-settings`
    - Default: Info tab visible, Settings tab hidden (`display: none`).

## Interaction Behavior
- **Click Info Tab**:
    - Add `active` class to Info button.
    - Remove `active` class from Settings button.
    - Show `tab-content-info`.
    - Hide `tab-content-settings`.
- **Click Settings Tab**:
    - Add `active` class to Settings button.
    - Remove `active` class from Info button.
    - Show `tab-content-settings`.
    - Hide `tab-content-info`.

## Styling Details
- Use standard button reset (no default border/bg).
- Hover effects for inactive tabs.
- Smooth transition not required (instant switch is fine).

## Edge Cases
- **Rapid Clicking**: Ensure state doesn't get desynchronized.

## Files to Modify
- `editor.html`
- `assets/css/editor.css`
- `assets/js/editor.js` (or new `properties-panel.js`)

## What NOT to Do
- Do not add the actual content inside the tabs yet (Phases 57, 58).

## Testing Checklist
- [ ] Tab bar appears at the top of the properties panel.
- [ ] "Info" and "Settings" buttons are visible.
- [ ] Clicking "Settings" switches the active style and hides Info content.
- [ ] Clicking "Info" switches back.
- [ ] Default state is Info tab active.

## Done When
- [ ] Tab HTML structure is in place.
- [ ] CSS styling for active/inactive states works.
- [ ] JavaScript click handlers successfully toggle visibility.
