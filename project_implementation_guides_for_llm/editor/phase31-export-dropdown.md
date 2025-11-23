# Phase 31: Export Dropdown Menu

## Goal
Implement Export dropdown with Video, Library, JSON options and toggle logic

## Group
**Navigation**

## Feature to Implement

### ONE Feature: Export Dropdown Menu
**Purpose**: Add a clickable Export menu that opens a dropdown with export format options

**Requirements**:

#### 1. What to Build
Create a dropdown menu that appears when clicking the "Export" button:
- Contains 3 menu items: Export Video, Export to Library, Export as JSON
- Visual divider lines between each item
- Each menu item shows: icon (emoji) + label + brief description
- Dropdown positioned directly below the Export button (right side of nav bar)
- Click outside or press Escape to close
- Dropdown arrow (▾) on Export button should rotate when menu open

#### 2. Menu Structure
Create dropdown containing these items in order:
1. **Export Video** - Icon: 🎬, Description: "Download as MP4/WebM"
2. *Divider line*
3. **Export to Library** - Icon: 📚, Description: "Save to media library"
4. *Divider line*
5. **Export as JSON** - Icon: 📄, Description: "Save project file"

#### 3. Positioning & Layout
- Position dropdown absolutely below the "Export" menu button
- Top edge aligned with bottom of navigation bar (60px from top)
- **Right edge** aligned with Export button (different from File/Edit which align left)
- Minimum width: 320px (wider than File/Edit menus due to descriptions)
- Dropdown should be on top of all other content (z-index: 900)
- Positioned at right side of navigation bar

#### 4. Visual States
**Closed state** (default):
- Dropdown hidden (use `hidden` attribute)
- Export button normal appearance
- Dropdown arrow (▾) pointing down

**Open state**:
- Dropdown visible with smooth fade-in and slide-down animation
- Export button highlighted/active state
- Dropdown arrow (▾) rotated 180° pointing up
- Dropdown has focus

**Hover state** (menu items):
- Background color change
- Border or accent color highlight
- Show full description text with better visibility

#### 5. Interaction Behavior
Implement these behaviors:

**Opening**:
- Click "Export" button → show dropdown
- Add active state to Export button
- Rotate dropdown arrow 180°
- Close any other open menus first (File, Edit)

**Closing**:
- Click Export button again → hide dropdown (toggle)
- Click any menu item → hide dropdown
- Click anywhere outside dropdown → hide dropdown
- Press Escape key → hide dropdown
- Rotate dropdown arrow back to original position

**Menu Item Click**:
- Log action to console (e.g., "Export action: video")
- Close dropdown
- **Note**: Actual export functionality (rendering video, saving files) will be implemented in Phases 97-99

#### 6. State Management
Track which menu is currently open:
- Store reference to active menu (e.g., 'file', 'edit', 'export', null)
- Only one menu can be open at a time
- Update Export button's `aria-expanded` attribute (true/false)
- Close File/Edit menus if they're open when Export is clicked

#### 7. JavaScript Organization
Extend existing DropdownMenu class/module from Phase 28-29:
- Reuse `toggleMenu(menuType)` method for 'export'
- Use shared `closeAllMenus()` function
- Use shared `attachMenuItemHandlers()` for menu item clicks
- Add `data-dropdown="export"` support to match other menu patterns
- Add rotation animation logic for dropdown arrow icon

#### 8. Styling Requirements
Apply Dark Neobrutalism theme to dropdown (same as File/Edit menus, with adjustments):
- Thick border (3px) around dropdown container
- Offset shadow (brutalist style)
- Background color: secondary background
- Menu items with TWO lines: label (bold) + description (smaller, gray)
- Menu items: transparent background, with hover state
- Use CSS transitions for:
  - Smooth open/close animation
  - Dropdown arrow rotation (180° transform)
- Apply BEM naming: `.dropdown-menu`, `.dropdown-menu__item`, `.dropdown-menu__description`, etc.

#### 9. Edge Cases to Handle
- **File/Edit menu open, click Export**: Close other menus first, then open Export
- **Export menu open, click File/Edit**: Close Export first, then open other menu
- **Double-click Export button**: Should toggle (open → close → open)
- **Rapid clicking**: Ensure smooth transitions, no flickering, arrow rotates correctly
- **Escape when button focused**: Menu should close, arrow rotates back
- **Right edge of screen**: Ensure dropdown doesn't go off-screen (align to right edge of button)

#### 10. Accessibility
- Use `aria-expanded="true/false"` on Export button
- Add `role="menu"` to dropdown container
- Add `role="menuitem"` to each menu item
- Ensure all menu items are keyboard focusable with Tab
- Enter or Space key should select menu item
- Escape key closes menu and returns focus to trigger button
- Description text should be part of menu item for screen readers

#### 11. Files to Create/Modify
- `editor.html` - Add Export menu dropdown HTML structure
- `assets/css/editor.css` - Add Export menu dropdown styles (extend existing dropdown styles)
- `assets/js/dropdown-menu.js` - Extend existing module to support Export menu and arrow rotation
- No new files needed, extend Phase 28-29's code

#### 12. Data Attributes
Use for JavaScript hooks:
- `data-action="export"` on Export button (already added in Phase 27)
- `data-dropdown="export"` on dropdown container
- `data-action="export-video"`, `data-action="export-library"`, `data-action="export-json"` on menu items
- `data-dropdown-arrow` on the ▾ icon for rotation targeting

#### 13. What NOT to Do
- ❌ Do NOT implement actual export functionality (comes in Phases 97-99)
- ❌ Do NOT add export format selection UI (MP4 vs WebM) - that comes in Phase 97
- ❌ Do NOT add progress bars or export dialogs
- ❌ Do NOT create the View or Effects menus yet (those are different phases)
- This phase is **UI and toggle behavior only**

**MediaBunny Integration**: Not applicable for this phase (actual export in Phase 97)

## References
- **Phase 27**: Export button already exists with `data-action="export"` attribute
- **Phase 28-29**: Reuse dropdown toggle logic and JavaScript patterns
- **Phase 97-99**: Will implement actual export functionality
- **Code of Conduct**: Use event delegation, cache selectors, follow naming conventions
- **Theme System**: Use CSS variables for colors, spacing, transitions

## Testing Checklist
- [ ] Click "Export" button opens dropdown below it
- [ ] Dropdown aligned to right edge of Export button
- [ ] Dropdown contains all 3 menu items with correct labels
- [ ] Menu items show icons and descriptions (two-line layout)
- [ ] Divider lines appear between all items
- [ ] Dropdown arrow (▾) rotates 180° when menu opens
- [ ] Dropdown arrow rotates back when menu closes
- [ ] Hover effect works on menu items
- [ ] Click menu item logs action to console
- [ ] Click menu item closes dropdown
- [ ] Click Export button again closes dropdown (toggle)
- [ ] Click outside dropdown closes it
- [ ] Press Escape closes dropdown
- [ ] Export button shows active/highlighted state when menu open
- [ ] Opening Export menu closes File/Edit menus if they were open
- [ ] Opening File/Edit menus closes Export menu if Export was open
- [ ] Smooth fade-in/slide-down animation when opening
- [ ] Dark Neobrutalism styling applied (border, shadow)
- [ ] Dropdown doesn't overflow off right edge of screen
- [ ] No console errors

## Done When
✅ Export menu dropdown fully functional  
✅ Toggle behavior works correctly  
✅ Menu switches work (File/Edit/Export)  
✅ Click outside closes menu  
✅ Escape key closes menu  
✅ Menu items clickable (logs to console)  
✅ Dropdown arrow rotation animation works  
✅ Two-line menu items (label + description)  
✅ Right-aligned positioning  
✅ Dark Neobrutalism styling applied  
✅ Smooth animations  
✅ All tests pass  
✅ Ready for Phase 32 (Tab Bar Structure)

---
**Phase**: 31 | **Component**: Editor | **Group**: Navigation  
**Estimated Time**: 15 min

## Implementation Notes
- This follows the same pattern as Phase 28-29 (File/Edit menus)
- Main differences: right-aligned, dropdown arrow rotation, two-line menu items
- The dropdown logic should be shared/reusable across all menus
- Actual export operations come in Phases 97-99
- Keep Export button and Import button visually similar but distinct
