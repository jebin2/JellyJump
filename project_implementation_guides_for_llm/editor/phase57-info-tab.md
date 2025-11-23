# Phase 57: Info Tab Content

## Goal
Populate the "Info" tab with read-only metadata fields to display details about the selected item.

## Group
Properties Panel Group (Phases 54-59)

## What to Build
1.  **Metadata List**: A structured list of key-value pairs.
2.  **Placeholder Data**: Static HTML showing example data (will be dynamic later).

## Requirements
- **Container**: Inside `tab-content-info`.
- **Fields to Display**:
    - **Name**: (e.g., "video_01.mp4")
    - **Type**: (e.g., "Video")
    - **Duration**: (e.g., "00:00:45")
    - **Resolution**: (e.g., "1920x1080") - *Video/Image only*
    - **File Path**: (e.g., "/imported/video_01.mp4")
- **Styling**:
    - Label: Bold, muted color.
    - Value: Normal weight, primary text color.
    - Spacing: Comfortable padding between rows.

## Interaction Behavior
- **Read-only**: User cannot edit these fields directly.
- **Selection Update**: (Future) Will update when a different item is selected.

## Styling Details
- Use a definition list (`dl`, `dt`, `dd`) or a grid layout for alignment.
- Add a "Preview" thumbnail area at the top (optional, but good for context).

## Edge Cases
- **Long Text**: Truncate file paths or names with ellipsis (`...`) if they overflow.

## Files to Modify
- `editor.html`
- `assets/css/editor.css`

## What NOT to Do
- Do not implement dynamic data binding yet (Phase 59).

## Testing Checklist
- [ ] Info tab shows the list of metadata fields.
- [ ] Layout is clean and aligned.
- [ ] Long text handles gracefully (doesn't break layout).

## Done When
- [ ] HTML structure for metadata fields is added.
- [ ] CSS styling makes it readable.
- [ ] Placeholder data is visible when Info tab is active.
