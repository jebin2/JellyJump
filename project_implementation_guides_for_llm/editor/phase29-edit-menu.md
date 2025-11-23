# Phase 29: Edit Menu Dropdown

## Goal
Implement Edit menu dropdown with Undo, Redo, Cut, Copy, Paste options and toggle logic

## Group
**Navigation**

## Feature to Implement

### ONE Feature: Edit Menu Dropdown
**Purpose**: Add a clickable Edit menu that opens a dropdown with common editing operations

**Requirements**:

#### 1. What to Build
Create a dropdown menu that appears when clicking the "Edit" button:
- Contains 5 menu items: Undo, Redo, Cut, Copy, Paste
- Visual divider line between "Redo" and "Cut"
- Each menu item shows: icon (emoji) + label + keyboard shortcut
- Dropdown positioned directly below the Edit button
- Click outside or press Escape to close

#### 2. Menu Structure
Create dropdown containing these items in order:
1. **Undo** - Icon: ↩️, Shortcut: Ctrl+Z
2. **Redo** - Icon: ↪️, Shortcut: Ctrl+Y
3. *Divider line*
4. **Cut** - Icon: ✂️, Shortcut: Ctrl+X
5. **Copy** - Icon: 📋, Shortcut: Ctrl+C
6. **Paste** - Icon: 📄, Shortcut: Ctrl+V

#### 3. Positioning & Layout
- Position dropdown absolutely below the "Edit" menu button
- Top edge aligned with bottom of navigation bar (60px from top)
- Left edge aligned with Edit button (offset from left based on button position)
- Minimum width: 280px
- Dropdown should be on top of all other content (z-index: 900)
- Horizontally positioned where Edit button is located (after File button)

#### 4. Visual States
**Closed state** (default):
- Dropdown hidden (use `hidden` attribute)
- Edit button normal appearance

**Open state**:
- Dropdown visible with smooth fade-in and slide-down animation
- Edit button highlighted/active state
- Dropdown has focus

**Hover state** (menu items):
- Background color change
- Border or accent color highlight

**Disabled state** (Undo/Redo):
- Initially, Undo and Redo should appear grayed out/disabled
- Note: Actual functionality comes in Phase 80-81

#### 5. Interaction Behavior
Implement these behaviors:

**Opening**:
- Click "Edit" button → show dropdown
- Add active state to Edit button
- Close any other open menus first (e.g., File menu)

**Closing**:
- Click Edit button again → hide dropdown (toggle)
- Click any menu item → hide dropdown
- Click anywhere outside dropdown → hide dropdown
- Press Escape key → hide dropdown

**Menu Item Click**:
- Log action to console (e.g., "Menu action: undo")
- Close dropdown
- **Note**: Actual functionality (undo/redo operations, clipboard operations) will be implemented in later phases

#### 6. State Management
Track which menu is currently open:
- Store reference to active menu (e.g., 'file', 'edit', null)
- Only one menu can be open at a time
- Update Edit button's `aria-expanded` attribute (true/false)
- Close File menu if it's open when Edit is clicked

#### 7. JavaScript Organization
Extend existing DropdownMenu class/module from Phase 28:
- Reuse `toggleMenu(menuType)` method for 'edit'
- Use shared `closeAllMenus()` function
- Use shared `attachMenuItemHandlers()` for menu item clicks
- Add `data-menu="edit"` support to match File menu pattern

#### 8. Styling Requirements
Apply Dark Neobrutalism theme to dropdown (same as File menu):
- Thick border (3px) around dropdown container
- Offset shadow (brutalist style)
- Background color: secondary background
- Menu items: transparent background, with hover state
- Disabled items: reduced opacity (0.5), no hover effect, grayed text
- Use CSS transitions for smooth open/close animation
- Apply BEM naming: `.dropdown-menu`, `.dropdown-menu__item`, `.dropdown-menu__item--disabled`, etc.

#### 9. Edge Cases to Handle
- **File menu open, click Edit**: Close File first, then open Edit
- **Edit menu open, click File**: Close Edit first, then open File
- **Double-click Edit button**: Should toggle (open → close → open)
- **Click disabled item**: Should still log to console but show "(disabled)" indicator
- **Rapid clicking**: Ensure smooth transitions, no flickering
- **Escape when button focused**: Menu should close

#### 10. Accessibility
- Use `aria-expanded="true/false"` on Edit button
- Add `role="menu"` to dropdown container
- Add `role="menuitem"` to each menu item
- Add `aria-disabled="true"` to Undo and Redo items initially
- Ensure all menu items are keyboard focusable with Tab
- Enter or Space key should select menu item
- Escape key closes menu and returns focus to trigger button
- Disabled items should be skipped or announced as disabled by screen readers

#### 11. Files to Create/Modify
- `editor.html` - Add Edit menu dropdown HTML structure
- `assets/css/editor.css` - Add Edit menu dropdown styles (can share classes with File menu)
- `assets/js/dropdown-menu.js` - Extend existing module to support Edit menu
- No new files needed, extend Phase 28's code

#### 12. Data Attributes
Use for JavaScript hooks:
- `data-menu="edit"` on Edit button (already added in Phase 27)
- `data-dropdown="edit"` on dropdown container
- `data-action="undo"`, `data-action="redo"`, `data-action="cut"`, etc. on menu items
- `data-disabled="true"` on Undo and Redo items (to track disabled state)

#### 13. What NOT to Do
- ❌ Do NOT implement actual undo/redo functionality (comes in Phase 80-81)
- ❌ Do NOT implement cut/copy/paste clipboard operations (comes in later phases)
- ❌ Do NOT add keyboard shortcuts functionality (just display them)
- ❌ Do NOT create the View or Effects menus yet (those are separate phases)
- This phase is **UI and toggle behavior only**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Phase 27**: Edit button already exists with `data-menu="edit"` attribute
- **Phase 28**: Reuse dropdown toggle logic and JavaScript patterns
- **Code of Conduct**: Use event delegation, cache selectors, follow naming conventions
- **Theme System**: Use CSS variables for colors, spacing, transitions

## Testing Checklist
- [ ] Click "Edit" button opens dropdown below it
- [ ] Dropdown contains all 5 menu items with correct labels
- [ ] Menu items show icons and keyboard shortcuts
- [ ] Divider line appears between "Redo" and "Cut"
- [ ] Undo and Redo items appear disabled/grayed
- [ ] Hover effect works on enabled menu items
- [ ] Hover effect does NOT work on disabled items
- [ ] Click menu item logs action to console
- [ ] Click menu item closes dropdown
- [ ] Click Edit button again closes dropdown (toggle)
- [ ] Click outside dropdown closes it
- [ ] Press Escape closes dropdown
- [ ] Edit button shows active/highlighted state when menu open
- [ ] Opening Edit menu closes File menu if File was open
- [ ] Opening File menu closes Edit menu if Edit was open
- [ ] Smooth fade-in/slide-down animation when opening
- [ ] Dark Neobrutalism styling applied (border, shadow)
- [ ] No console errors

## Done When
✅ Edit menu dropdown fully functional  
✅ Toggle behavior works correctly  
✅ Menu switches work (File ↔ Edit)  
✅ Click outside closes menu  
✅ Escape key closes menu  
✅ Menu items clickable (logs to console)  
✅ Disabled state visible on Undo/Redo  
✅ Dark Neobrutalism styling applied  
✅ Smooth animations  
✅ All tests pass  
✅ Ready for Phase 30 (Import Media Button)

---
**Phase**: 29 | **Component**: Editor | **Group**: Navigation  
**Estimated Time**: 15 min

## Implementation Notes
- This follows the exact same pattern as Phase 28 (File Menu)
- The dropdown logic should be shared/reusable
- Actual edit operations come in later phases
- Disabled state is visual only for now
