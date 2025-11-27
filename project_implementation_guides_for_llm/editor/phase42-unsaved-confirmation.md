# Phase 42: Unsaved Changes Confirmation

## Goal
Dialog on close if unsaved (*), Save/Don't Save/Cancel buttons

## Group
**Tab Management**

## Feature to Implement

### ONE Feature: Unsaved Changes Confirmation Dialog
**Purpose**: Warn users before closing a tab with unsaved changes and offer save options

**Requirements**:

#### 1. What to Build
Add confirmation dialog before closing tab with unsaved changes:
- Detect if tab has unsaved changes (marked with *)
- Show confirmation dialog when close button clicked on unsaved tab
- Dialog with 3 buttons: "Save", "Don't Save", "Cancel"
- "Save" button saves the project then closes tab
- "Don't Save" button closes tab without saving
- "Cancel" button dismisses dialog, keeps tab open

#### 2. Unsaved Changes Tracking
Track unsaved changes state for each tab:
- Add `hasUnsavedChanges: boolean` to tab data structure (already suggested in Phase 33)
- Default: `false` (no unsaved changes)
- Set to `true` when user makes any edits (timeline changes, property changes, etc.)
- Set to `false` when project is saved
- Display asterisk (*) next to tab name if unsaved: "Untitled Project *"

#### 3. When to Show Confirmation
Show dialog when:
- User clicks close button [×] on a tab with `hasUnsavedChanges: true`
- Intercept close action before actually closing tab
- If `hasUnsavedChanges: false`, close tab immediately (no dialog)

#### 4. Confirmation Dialog Structure
Create a modal dialog with:
- **Title**: "Unsaved Changes"
- **Message**: "Do you want to save changes to '[Tab Name]' before closing?"
- **Icon**: ⚠️ (warning icon)
- **3 Buttons**:
  1. "Save" (primary button, highlighted)
  2. "Don't Save" (secondary button)
  3. "Cancel" (tertiary button)

#### 5. Dialog Interaction Flow

**User clicks "Save"**:
1. Save the project (call save function)
2. Set `hasUnsavedChanges: false`
3. Remove asterisk (*) from tab name
4. Close the tab
5. Close the dialog
6. Log: "Tab saved and closed: [UUID]"

**User clicks "Don't Save"**:
1. Do NOT save the project
2. Close the tab (discard changes)
3. Close the dialog
4. Log: "Tab closed without saving: [UUID]"

**User clicks "Cancel"**:
1. Do NOT save or close
2. Close the dialog only
3. Keep tab open
4. Log: "Close canceled for tab: [UUID]"

**User clicks outside dialog or presses Escape**:
- Same behavior as "Cancel" button
- Close dialog, keep tab open

#### 6. Asterisk (*) Visual Indicator
When tab has unsaved changes:
- Append " *" to tab name display
- Example: "Untitled Project *" or "My Video *"
- Asterisk should be subtle but visible
- Remove asterisk when saved

#### 7. Save Functionality (Placeholder)
For this phase, "Save" button:
- Logs to console: "Saving project: [UUID]"
- Sets `hasUnsavedChanges: false`
- Removes asterisk from tab name
- Then closes tab

**Note**: Actual save-to-localStorage functionality comes in Phase 37 and Phase 101 (Auto-Save). For now, just simulate a save.

#### 8. Modal Dialog Styling
Apply Dark Neobrutalism theme:
- Centered overlay (modal backdrop)
- Backdrop: semi-transparent dark (rgba(0,0,0,0.7))
- Dialog box: thick border (4px), offset shadow
- Background: primary background color
- Title: bold, large text
- Message: readable size
- Buttons: Dark Neobrutalism style (thick borders, offset shadows)
  - "Save" button: primary/success color
  - "Don't Save" button: warning/danger color
  - "Cancel" button: neutral/secondary color
- All buttons have hover and active states

#### 9. Edge Cases
- **Close tab with no unsaved changes**: Skip dialog, close immediately
- **Last tab with unsaved changes**: Still show dialog (but won't close if it's truly the last, from Phase 35)
- **Close during save operation**: Prevent closing until save completes
- **Rapid clicking close button**: Show dialog once, prevent duplicate dialogs
- **Multiple tabs with unsaved changes**: Each shows its own dialog when closed

#### 10. Accessibility
- Dialog should trap focus (Tab cycles through buttons only)
- First button ("Save") should receive focus when dialog opens
- Escape key closes dialog (same as "Cancel")
- Use `role="alertdialog"` on dialog
- Use `aria-labelledby` and `aria-describedby` for title and message
- Announce dialog to screen readers

#### 11. Keyboard Shortcuts
- **Escape**: Close dialog (same as "Cancel")
- **Enter**: Activate focused button
- **Tab**: Cycle through buttons
- Optional: S for "Save", N for "Don't Save", C for "Cancel"

#### 12. Files to Create/Modify
- `assets/js/tab-manager.js` - Extend close logic to check unsaved changes
- `assets/js/modal-dialog.js` - Create new file for reusable modal dialog component
- `assets/css/modal.css` - Create new file for modal dialog styles
- `editor.html` - Add modal dialog template (can be hidden by default)

#### 13. JavaScript Organization
Create a ModalDialog class/module:
- `showDialog(title, message, buttons)` - Display modal with custom content
- `closeDialog()` - Hide modal
- `attachButtonHandlers(callbacks)` - Handle button clicks

Extend TabManager class from Phase 35:
- `closeTab(tabId)` - Check for unsaved changes before closing
- `showUnsavedDialog(tabId)` - Display the confirmation dialog
- `saveAndCloseTab(tabId)` - Save then close
- `closeTabWithoutSaving(tabId)` - Close without saving
- `markTabUnsaved(tabId)` - Set hasUnsavedChanges = true (for later phases to call)
- `markTabSaved(tabId)` - Set hasUnsavedChanges = false

#### 14. Data Attributes
- `data-modal-action="save"` on Save button
- `data-modal-action="dont-save"` on Don't Save button
- `data-modal-action="cancel"` on Cancel button

#### 15. What NOT to Do
- ❌ Do NOT implement actual save-to-localStorage (that's Phase 37)
- ❌ Do NOT implement auto-save (that's Phase 101)
- ❌ Do NOT track specific edit types (timeline, properties, etc.) - just use a boolean flag
- ❌ Do NOT show dialog on browser close (window.onbeforeunload) - that's a separate enhancement
- This phase is **unsaved confirmation dialog ONLY**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Phase 33**: Tab data structure includes `hasUnsavedChanges`
- **Phase 35**: Close button functionality (extends with dialog check)
- **Phase 37**: Will implement actual save to localStorage
- **Phase 101**: Will implement auto-save functionality
- **Code of Conduct**: Follow BEM naming, use CSS variables

## Testing Checklist
- [ ] Tab with unsaved changes shows asterisk (*) after name
- [ ] Click close [×] on unsaved tab shows dialog
- [ ] Dialog displays: title, message, 3 buttons
- [ ] "Save" button saves (logs to console) and closes tab
- [ ] "Don't Save" button closes tab without saving
- [ ] "Cancel" button closes dialog, keeps tab open
- [ ] Click outside dialog acts as "Cancel"
- [ ] Press Escape acts as "Cancel"
- [ ] Asterisk removed after saving
- [ ] Tab with NO unsaved changes closes immediately (no dialog)
- [ ] Dialog has Dark Neobrutalism styling
- [ ] Dialog buttons have hover effects
- [ ] Focus trapped in dialog (Tab cycles through buttons)
- [ ] First button ("Save") receives focus when dialog opens
- [ ] Dialog backdrop semi-transparent
- [ ] No duplicate dialogs from rapid clicking
- [ ] No console errors

## Done When
✅ Unsaved changes tracked per tab  
✅ Asterisk (*) displayed for unsaved tabs  
✅ Confirmation dialog shows when closing unsaved tab  
✅ "Save" button works (placeholder)  
✅ "Don't Save" button works  
✅ "Cancel" button works  
✅ Dialog has Dark Neobrutalism styling  
✅ Keyboard navigation works  
✅ All tests pass  
✅ Ready for Phase 37 (Tab Persistence)

---
**Phase**: 42 | **Component**: Editor | **Group**: Tab Management  
**Estimated Time**: 25 min

## Implementation Notes
- This dialog component can be reused for other confirmations later
- Keep modal dialog generic and reusable
- For now, save is simulated (console log)
- Phase 37 will implement actual localStorage save
- Later phases will call `markTabUnsaved()` when timeline/properties change
