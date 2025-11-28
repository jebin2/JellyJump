# Phase 33: Top Navigation Bar Structure

## Goal
Create fixed top bar with branding, menu placeholders, styling and positioning

---

## What to Build

Top navigation bar:
- Fixed position header spanning full width
- Left: Branding (icon + title)
- Center: Menu buttons (File, Edit, View, Effects)
- Right: Action buttons (Import, Export)
- Dark Neobrutalism styling

---

## Feature to Implement

### ONE Feature: Top Navigation Bar Structure
**Purpose**: Establish the fixed navigation bar at the top of the editor with branding and menu structure

**Requirements**:

#### 1. What to Build
Create a fixed navigation bar at the top of the editor page containing:
- **Left section**: Branding (🎬 icon + "MediaBunny Editor" title)
- **Center section**: Four menu buttons (File, Edit, View, Effects)
- **Right section**: Two action buttons (Import 📥, Export �▾)

#### 2. Layout & Positioning
- Fixed to top of viewport (stays visible when scrolling)
- Full width spanning entire viewport
- Height: 60px
- Use flexbox with three sections: left, center, right
- Center section auto-centered, left and right sections pushed to edges
- Z-index high enough to stay above all other content (suggested: 1000)

#### 3. Branding Section (Left)
- Display 🎬 emoji icon
- Display "MediaBunny Editor" text as h1
- Align horizontally with small gap between icon and text
- Icon size slightly larger than text

#### 4. Menu Section (Center)
- Four buttons in a horizontal row: "File", "Edit", "View", "Effects"
- Equal spacing between buttons
- Each button is text-only (no icons)
- Buttons should be clickable but have NO functionality in this phase
- Add `data-menu` attributes for later use: `data-menu="file"`, `data-menu="edit"`, etc.

#### 5. Actions Section (Right)
- Two styled buttons:
  - **Import button**: Show 📥 icon + "Import" label
  - **Export button**: Show 📤 icon + "Export" label + ▾ dropdown arrow
- Buttons side-by-side with small gap
- Add `data-action` attributes: `data-action="import"`, `data-action="export"`

#### 6. Styling Requirements
Apply Dark Neobrutalism theme:
- Navigation bar background: primary background color
- Thick bottom border (3px solid)
- Brutalist shadow effect
- Menu buttons: transparent background, visible on hover with border
- Action buttons: colored backgrounds (Import: success color, Export: primary color)
- Action buttons: thick borders (3px), offset shadow on hover
- All buttons: translate down slightly on active/click state
- Use CSS variables from theme system

#### 7. Responsive Behavior
- Maintain fixed position on all screen sizes
- On screens < 768px: Can optionally hide menu button labels, show only icons
- Ensure no horizontal scroll

#### 8. Accessibility
- Use semantic `<nav>` element
- All buttons must be keyboard focusable (Tab key)
- Add `:focus-visible` styles for keyboard navigation
- Button text must meet WCAG AA contrast ratios

#### 9. Files to Modify
- `editor.html` - Add navigation HTML structure
- `assets/css/editor.css` - Add navigation styles
- Use BEM naming convention: `.editor-nav`, `.editor-nav__brand`, `.editor-nav__menu`, etc.

#### 10. What NOT to Do
- ❌ Do NOT add JavaScript in this phase
- ❌ Do NOT make buttons functional (dropdowns, actions)
- ❌ Do NOT add hover tooltips or complex interactions
- This is **visual structure only**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Theme System**: See `theme/` folder for CSS variables
- **Code of Conduct**: Follow BEM naming, no inline styles, use CSS variables
- **Dark Neobrutalism**: Thick borders, offset shadows, bold colors

---

## Testing Checklist Checklist
- [ ] Navigation bar appears at top of page
- [ ] Bar is fixed (test by adding scrollable content below)
- [ ] Branding visible on left: 🎬 + "MediaBunny Editor"
- [ ] Four menu buttons in center: File, Edit, View, Effects
- [ ] Two action buttons on right: Import, Export
- [ ] All buttons have proper Dark Neobrutalism styling
- [ ] Hover effects work (background/border change)
- [ ] Active/click effects work (translate down)
- [ ] No horizontal scroll on mobile screens
- [ ] Text is readable with good contrast
- [ ] Tab key navigates through all buttons
- [ ] Focus outlines visible when using keyboard

---

## Done When
✅ Navigation bar fully styled and positioned  
✅ All buttons present with correct labels  
✅ Dark Neobrutalism theme applied correctly  
✅ Hover and active states work  
✅ Fixed positioning maintained  
✅ Responsive on all screen sizes  
✅ All tests pass  
✅ Ready for Phase 28 (File Menu Dropdown)

---
**Phase**: 33 | **Component**: Editor | **Group**: Navigation  
**Estimated Time**: 15-20 min
