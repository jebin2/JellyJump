# Phase 38: Tab Bar Structure

## Goal
Create tab container below top nav with [+] button visual and styling

## Group
**Tab Management**

## Feature to Implement

### ONE Feature: Tab Bar Structure
**Purpose**: Establish the tab bar container that will hold project tabs

**Requirements**:

#### 1. What to Build
Create a tab bar container positioned below the navigation bar:
- Fixed horizontal container spanning full width
- Height: 45px
- Contains:
  - Tab container area (left side) for project tabs
  - [+] Create new tab button (left side, after tabs)
  - Empty space filler (right side)
- Positioned directly below 60px navigation bar
- Sticky/fixed to top (stays visible when scrolling)

#### 2. Layout & Positioning
- Position horizontally below navigation bar (top: 60px)
- Full viewport width
- Fixed or sticky positioning (stays visible during vertical scroll)
- Height: 45px
- Z-index: 900 (below nav bar's 1000, above other content)
- Use flexbox layout with:
  - Tabs container (flex-grow to take available space)
  - [+] button (fixed width)

#### 3. Tab Container Area
Create a container for tabs:
- Display as horizontal scrollable area (if tabs overflow)
- Overflow-x: auto (horizontal scroll if many tabs)
- Overflow-y: hidden (no vertical scroll)
- Hide scrollbar or use minimal thin scrollbar styling
- Smooth scroll behavior
- No tabs visible initially (empty state until Phase 33)

#### 4. [+] Create Tab Button
Create a fixed [+] button:
- Display "+" text or ➕ icon
- Position at left side of tab bar, after tab container
- Fixed width: 45px
- Height: 45px (full height of tab bar)
- Square or slightly rounded button
- Add `data-action="create-tab"` attribute
- Clickable but non-functional in this phase

#### 5. Styling Requirements
Apply Dark Neobrutalism theme:
- Tab bar background: secondary background color
- Thick bottom border (3px solid)
- Subtle shadow or depth effect
- [+] button:
  - Background: primary color or accent color
  - Thick border (3px)
  - Offset shadow on hover
  - Translate down slightly on active/click state
- Use CSS variables from theme system

#### 6. Visual Empty State
When no tabs exist (initial state):
- Empty tab container area
- [+] button visible and styled
- Optional: Show ghost/placeholder text like "Click + to create your first project"

#### 7. Responsive Behavior
- Maintain fixed position on all screen sizes
- On screens < 768px:
  - Tab bar remains full width
  - Could reduce height to 40px if needed
  - [+] button remains visible
- Ensure no horizontal viewport scroll

#### 8. Edge Cases
- **No tabs**: [+] button should be visible and styled
- **Many tabs** (later phases): Tab container should scroll horizontally
- **Resizing window**: Tab bar should maintain full width
- **Tab bar height**: Should not overlap with navigation bar above or content below

#### 9. Accessibility
- Use semantic HTML (e.g., `<div class="tab-bar">` or `<header class="tab-bar">`)
- [+] button must be keyboard focusable (Tab key)
- Add `aria-label="Create new tab"` to [+] button
- Add `:focus-visible` styles for keyboard navigation
- Ensure contrast meets WCAG AA standards

#### 10. Files to Modify
- `editor.html` - Add tab bar HTML structure below navigation
- `assets/css/editor.css` - Add tab bar styles
- Use BEM naming: `.tab-bar`, `.tab-bar__tabs`, `.tab-bar__create-btn`, etc.

#### 11. What NOT to Do
- ❌ Do NOT add JavaScript in this phase (except if needed for scroll behavior)
- ❌ Do NOT make [+] button functional (that's Phase 33)
- ❌ Do NOT create actual tab elements (that's Phase 33)
- ❌ Do NOT implement tab switching logic (that's Phase 34)
- This is **visual structure only**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Phase 27**: Similar fixed navigation bar pattern
- **Code of Conduct**: Follow BEM naming, no inline styles, use CSS variables
- **Dark Neobrutalism**: Thick borders, offset shadows, bold colors
- **Theme System**: See `theme/` folder for CSS variables

## Testing Checklist
- [ ] Tab bar appears below navigation bar
- [ ] Tab bar height is 45px
- [ ] Tab bar spans full viewport width
- [ ] Tab bar is fixed/sticky (test by adding scrollable content below)
- [ ] [+] button visible on left side
- [ ] [+] button is 45px square
- [ ] [+] button displays "+" or ➕ icon
- [ ] [+] button has hover effect (background, shadow)
- [ ] [+] button has active/click effect (translate down)
- [ ] Tab container area is empty (no tabs yet)
- [ ] Dark Neobrutalism styling applied (border, shadow)
- [ ] No horizontal viewport scroll
- [ ] Tab key can focus [+] button
- [ ] Focus outline visible when using keyboard
- [ ] Responsive on mobile screens (< 768px)
- [ ] No console errors

## Done When
✅ Tab bar fully styled and positioned  
✅ [+] button present with correct styling  
✅ Fixed positioning maintained  
✅ Dark Neobrutalism theme applied correctly  
✅ Hover and active states work  
✅ Responsive on all screen sizes  
✅ All tests pass  
✅ Ready for Phase 33 (Create New Tab)

---
**Phase**: 38 | **Component**: Editor | **Group**: Tab Management  
**Estimated Time**: 15 min

## Implementation Notes
- This provides the container structure for tabs
- Actual tabs will be dynamically created in Phase 33
- Keep styling consistent with navigation bar above
- Tab bar separates navigation from main editor workspace
