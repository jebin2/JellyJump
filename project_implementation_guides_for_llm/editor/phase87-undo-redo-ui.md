# Phase 87: Undo/Redo UI

## Goal
Add Undo/Redo buttons and keyboard shortcuts

---

## What to Build

Undo/redo UI:
- Undo/Redo buttons
- Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
- Enable/disable states
- Visual feedback
- Tooltips with action name
- Status indicators

---

## Feature to Implement

### ONE Feature: Undo/Redo Controls
**Purpose**: User interface for the history system

**Requirements**:

#### 1. What to Build
- **Toolbar Buttons**:
    - Undo Icon (Arrow Left/Back)
    - Redo Icon (Arrow Right/Forward)
- **State**:
    - Disable Undo button if stack empty
    - Disable Redo button if stack empty
- **Shortcuts**:
    - `Ctrl+Z` / `Cmd+Z` -> Undo
    - `Ctrl+Y` / `Cmd+Shift+Z` -> Redo

#### 2. Interaction Behavior
- Click Undo -> Call `HistoryManager.undo()` -> Update UI
- Click Redo -> Call `HistoryManager.redo()` -> Update UI
- Update button states after every history change event.

#### 3. Files to Create/Modify
- `assets/js/history-ui.js` (or inside `edit-toolbar.js`)
- `editor.html`

#### 4. Styling
- Use standard toolbar button styles (Phase 65)
- Disabled state: Opacity 0.5, `pointer-events: none`

#### 5. What NOT to Do
- ❌ Do NOT implement a visual history list (Photoshop style) yet.

---

## Testing Checklist Checklist
- [ ] Buttons appear in toolbar
- [ ] Buttons enable/disable correctly based on stack
- [ ] Keyboard shortcuts work
- [ ] Tooltips show "Undo (Ctrl+Z)"

---

## Done When
✅ Undo/Redo buttons visible  
✅ Shortcuts functional  
✅ Visual feedback (disabled states) correct  
✅ Ready for Phase 82 (Transitions)
