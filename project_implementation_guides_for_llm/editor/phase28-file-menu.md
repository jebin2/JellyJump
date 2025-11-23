# Phase 28: File Menu Dropdown

## Goal
Implement File menu dropdown with New, Open, Save, Save As options and toggle logic

## Group
**Navigation**

## Feature to Implement

### ONE Feature: File Menu Dropdown
**Purpose**: Add a clickable File menu that opens a dropdown with project file operations

**Requirements**:

#### 1. What to Build
Create a dropdown menu that appears when clicking the "File" button:
- Contains 4 menu items: New Project, Open Project, Save, Save As
- Visual divider line between "Open Project" and "Save"
- Each menu item shows: icon (emoji) + label + keyboard shortcut
- Dropdown positioned directly below the File button
- Click outside or press Escape to close

#### 2. Menu Structure
Create dropdown containing these items in order:
1. **New Project** - Icon: 📄, Shortcut: Ctrl+N
2. **Open Project** - Icon: 📂, Shortcut: Ctrl+O
3. *Divider line*
4. **Save** - Icon: 💾, Shortcut: Ctrl+S
5. **Save As...** - Icon: 💾, Shortcut: Ctrl+Shift+S

#### 3. Positioning & Layout
- Position dropdown absolutely below the "File" menu button
- Top edge aligned with bottom of navigation bar (60px from top)
- Left edge aligned approximately with File button
- Minimum width: 280px
- Dropdown should be on top of all other content (z-index: 900)

#### 4. Visual States
**Closed state** (default):
- Dropdown hidden (use `hidden` attribute)
- File button normal appearance

**Open state**:
- Dropdown visible with smooth fade-in and slide-down animation
- File button highlighted/active state
- Dropdown has focus

**Hover state** (menu items):
- Background color change
- Border or accent color highlight

#### 5. Interaction Behavior
Implement these behaviors:

**Opening**:
- Click "File" button → show dropdown
- Add active state to File button
- Close any other open menus first

**Closing**:
- Click File button again → hide dropdown (toggle)
- Click any menu item → hide dropdown
- Click anywhere outside dropdown → hide dropdown
- Press Escape key → hide dropdown

**Menu Item Click**:
- Log action to console (e.g., "Menu action: new-project")
- Close dropdown
- **Note**: Actual functionality (creating project, opening file picker, etc.) will be implemented in later phases

#### 6. State Management
Track which menu is currently open:
- Store reference to active menu (e.g., 'file', 'edit', null)
- Only one menu can be open at a time
- Update File button's `aria-expanded` attribute (true/false)

#### 7. JavaScript Organization
Create a DropdownMenu class or module with methods:
- `toggleMenu(menuType)` - Open/close specific menu
- `closeAllMenus()` - Close all open dropdowns
- `attachMenuItemHandlers()` - Handle menu item clicks
- Initialize on page load

#### 8. Styling Requirements
Apply Dark Neobrutalism theme to dropdown:
- Thick border (3px) around dropdown container
- Offset shadow (brutalist style)
- Background color: secondary background
- Menu items: transparent background, with hover state
- Use CSS transitions for smooth open/close animation
- Apply BEM naming: `.dropdown-menu`, `.dropdown-menu__item`, etc.

#### 9. Edge Cases to Handle
- **Double-click File button**: Should toggle (open → close → open)
- **Click different menu button while File open**: Close File, open other menu
- **Menu item click**: Always close menu immediately after
- **Rapid clicking**: Ensure smooth transitions, no flickering
- **Escape when button focused**: Menu should close

#### 10. Accessibility
- Use `aria-expanded="true/false"` on File button
- Add `role="menu"` to dropdown container
- Add `role="menuitem"` to each menu item
- Ensure all menu items are keyboard focusable with Tab
- Enter or Space key should select menu item
- Escape key closes menu and returns focus to trigger button

#### 11. Files to Create/Modify
- `editor.html` - Add dropdown menu HTML structure
- `assets/css/editor.css` - Add dropdown menu styles  
- `assets/js/dropdown-menu.js` - Create new file for dropdown logic
- Import dropdown-menu.js in editor.html

#### 12. Data Attributes
Use for JavaScript hooks:
- `data-menu="file"` on File button (already added in Phase 27)
- `data-dropdown="file"` on dropdown container
- `data-action="new-project"`, `data-action="open-project"`, etc. on menu items

#### 13. What NOT to Do
- ❌ Do NOT implement actual file operations (New Project, Save, etc.)
- ❌ Do NOT add keyboard shortcuts functionality (just display them)
- ❌ Do NOT create the Edit, View, Effects menus yet (those are separate phases)
- This phase is **UI and toggle behavior only**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Phase 27**: File button already exists with `data-menu="file"` attribute
- **Code of Conduct**: Use event delegation, cache selectors, follow naming conventions
- **Theme System**: Use CSS variables for colors, spacing, transitions

## Testing Checklist
- [ ] Click "File" button opens dropdown below it
- [ ] Dropdown contains all 4 menu items with correct labels
- [ ] Menu items show icons and keyboard shortcuts
- [ ] Divider line appears between "Open" and "Save"
- [ ] Hover effect works on menu items
- [ ] Click menu item logs action to console
- [ ] Click menu item closes dropdown
- [ ] Click File button again closes dropdown (toggle)
- [ ] Click outside dropdown closes it
- [ ] Press Escape closes dropdown
- [ ] File button shows active/highlighted state when menu open
- [ ] Smooth fade-in/slide-down animation when opening
- [ ] Dark Neobrutalism styling applied (border, shadow)
- [ ] No console errors

## Done When
✅ File menu dropdown fully functional  
✅ Toggle behavior works correctly  
✅ Click outside closes menu  
✅ Escape key closes menu  
✅ Menu items clickable (logs to console)  
✅ Dark Neobrutalism styling applied  
✅ Smooth animations  
✅ All tests pass  
✅ Ready for Phase 29 (Edit Menu - same pattern)

---
**Phase**: 28 | **Component**: Editor | **Group**: Navigation  
**Estimated Time**: 20 min

## Implementation Notes
- This same pattern will be reused for Edit, View, and Effects menus
- Keep the code modular so it's easy to add more menus
- Actual menu item functionality comes in later phases (e.g., Phase 33 for "New Project")
