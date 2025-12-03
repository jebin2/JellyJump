# Phase 71: Edit Toolbar

## Goal
Add toolbar below timeline with edit tools (cut, delete, undo, redo)

---

## What to Build

Edit toolbar:
- Tool buttons (Select, Trim, Split)
- Cut/Copy/Paste buttons
- Delete button
- Undo/Redo buttons
- Active tool highlighting
- Tooltips on hover

---

## Feature to Implement

### ONE Feature: Timeline Edit Toolbar
**Purpose**: Provide quick access to common editing tools positioned below the timeline

**Requirements**:

#### 1. What to Build
Create toolbar with edit buttons:
- Positioned directly below timeline tracks
- Contains 6 primary buttons: Cut, Copy, Paste, Delete, Undo, Redo
- Full width horizontal bar
- Buttons left-aligned with small gaps
- Icons + labels for each button
- Buttons non-functional in this phase (placeholders)

#### 2. Toolbar Position and Layout
Toolbar specs:
- Position: Fixed below timeline tracks container
- Width: Full viewport width
- Height: 50px
- Background: Secondary background color
- Top border: 2px solid (separation from tracks)
- Z-index: Above tracks, below dropdowns/modals

#### 3. Button List
Six buttons in this order:

**1. Cut (✂️ Ctrl+X)**
- Icon: ✂️ emoji or scissors SVG
- Label: "Cut"
- Shortcut display: Ctrl+X
- `data-action="cut"`

**2. Copy (📋 Ctrl+C)**
- Icon: 📋 emoji or clipboard SVG
- Label: "Copy"
- Shortcut: Ctrl+C
- `data-action="copy"`

**3. Paste (📄 Ctrl+V)**
- Icon: 📄 emoji or paste SVG
- Label: "Paste"
- Shortcut: Ctrl+V
- `data-action="paste"`

**4. Delete (🗑️ Del)**
- Icon: 🗑️ emoji or trash SVG
- Label: "Delete"
- Shortcut: Del
- `data-action="delete"`

**5. Undo (↩️ Ctrl+Z)**
- Icon: ↩️ emoji or undo arrow SVG
- Label: "Undo"
- Shortcut: Ctrl+Z
- `data-action="undo"`

**6. Redo (↪️ Ctrl+Y)**
- Icon: ↪️ emoji or redo arrow SVG
- Label: "Redo"
- Shortcut: Ctrl+Y (or Ctrl+Shift+Z)
- `data-action="redo"`

#### 4. Button Structure
Each button contains:
- Icon (emoji or SVG, 18-20px)
- Label text below or beside icon
- Hover state (background color change)
- Active/pressed state (translate down slightly)
- Disabled state (50% opacity, no interaction)

#### 5. Button States
Three visual states:

**Default**:
- Normal appearance
- Cursor: pointer

**Hover**:
- Background color change (lighter)
- Border highlight
- Subtle scale or translate effect

**Disabled** (initial state):
- Opacity: 0.5
- Cursor: not-allowed
- No hover effects
- All buttons disabled until clip selected

#### 6. Disabled State Logic
Button availability:
- **Cut, Copy, Delete**: Disabled if no clip selected
- **Paste**: Disabled if clipboard empty
- **Undo**: Disabled if no actions in history
- **Redo**: Disabled if no undone actions

Initial state: All buttons disabled (no clips yet)

#### 7. Button Layout
Horizontal arrangement:
- Buttons in single row, left-aligned
- Small gap between buttons (8-12px)
- Padding from left edge: 16px
- Icon above label OR icon + label side-by-side
- Responsive: On small screens, hide labels, show icons only

#### 8. Tooltip on Hover (Optional)
Enhance UX with tooltips:
- Show keyboard shortcut on hover
- Example: "Cut (Ctrl+X)"
- Position above button
- Small delay (500ms)
- Not required for v1, can add in future phase

#### 9. Styling Requirements
Apply Dark Neobrutalism theme:
- Toolbar background: Secondary background
- Thick top border (2px solid)
- Buttons: Transparent background, border on hover
- Button borders: 2px solid on hover
- Active state: Translate down 2px, darker shadow
- Disabled state: Faded with reduced opacity
- Use CSS variables for colors

#### 10. Keyboard Shortcuts (Display Only)
Show shortcuts visually:
- Small text below button label
- Muted color (secondary text)
- Example: "Ctrl+X"
- Shortcuts not functional yet (implemented in later phases)

#### 11. Accessibility
- Each button has `aria-label` with full description
  - Example: `aria-label="Cut selected clip (Ctrl+X)"`
- Disabled buttons have `aria-disabled="true"`
- All buttons keyboard focusable with Tab
- `:focus-visible` styles for keyboard navigation
- Group buttons in `<div role="toolbar">`

#### 12. Responsive Behavior
Screen size adjustments:
- Desktop (> 1024px): Icon + label + shortcut
- Tablet (768-1024px): Icon + label
- Mobile (< 768px): Icon only (labels hidden)
- Ensure toolbar always visible (not scrollable)

#### 13. Files to Create/Modify
- `editor.html` - Add toolbar HTML structure
- `assets/css/editor.css` - Add toolbar and button styles
- `assets/js/timeline-toolbar.js` - Create new file for toolbar logic
- Import toolbar script in editor.html

#### 14. JavaScript Organization
Create TimelineToolbar class:
- `init()` - Initialize toolbar, attach event listeners
- `enableButton(action)` - Enable specific button
- `disableButton(action)` - Disable specific button
- `updateButtonStates()` - Update all buttons based on editor state
- `attachEventHandlers()` - Add click listeners (log only for now)
- Call `updateButtonStates()` when clip selection changes

#### 15. Button Click Behavior (Placeholder)
For now, on button click:
- Check if button enabled
- Log action to console: "Toolbar action: cut"
- Do nothing else
- Actual functionality added in future phases

#### 16. Integration Points
Toolbar will integrate with:
- **Phase 67**: Clip selection triggers button state updates
- **Future phases**: Implement actual cut/copy/paste/delete/undo/redo logic
- **Keyboard shortcuts**: Phase for global keyboard handling

#### 17. What NOT to Do
- ❌ Do NOT implement actual editing functions (cut, copy, paste, etc.)
- ❌ Do NOT implement undo/redo history system
- ❌ Do NOT implement keyboard shortcut handlers
- ❌ Do NOT add tooltip system yet (optional future enhancement)
- This is **toolbar UI and button states ONLY**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Phase 64**: Toolbar positioned below track container
- **Code of Conduct**: Use data attributes, BEM naming, event delegation
- **Theme System**: CSS variables for consistent styling

---

## Testing Checklist Checklist
- [ ] Toolbar visible below timeline tracks
- [ ] Toolbar spans full width
- [ ] Six buttons present: Cut, Copy, Paste, Delete, Undo, Redo
- [ ] Each button shows icon and label
- [ ] Keyboard shortcuts displayed
- [ ] All buttons initially disabled
- [ ] Disabled state styled (50% opacity)
- [ ] Hover effects work on enabled buttons (test by removing disabled attribute)
- [ ] Active/click state works (button moves down)
- [ ] Click logs action to console
- [ ] Dark Neobrutalism styling (borders, colors)
- [ ] Buttons keyboard focusable
- [ ] Responsive: Labels hidden on small screens
- [ ] No console errors

---

## Done When
✅ Toolbar structured and positioned  
✅ Six edit buttons present with icons and labels  
✅ All buttons initially disabled  
✅ Hover and active states functional  
✅ Click events log to console  
✅ Dark Neobrutalism styling applied  
✅ Keyboard accessible  
✅ All tests pass  
✅ Ready for Phase 66 (Drop Media onto Timeline)

---
**Phase**: 71 | **Component**: Editor | **Group**: Timeline Foundation  
**Estimated Time**: 15 min

## Implementation Notes
- Disabled state important for UX (prevents accidental clicks)
- Button states will update dynamically as clips are selected
- Undo/redo requires history system (future phase)
- Keyboard shortcuts displayed but not functional yet
- Toolbar completes timeline foundation UI structure
- Next phases focus on interaction (drag-drop, clip rendering)
