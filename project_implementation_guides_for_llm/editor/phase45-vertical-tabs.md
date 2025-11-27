# Phase 45: Vertical Tab Buttons

## Goal
Create 6 vertical tab buttons (Videos, Audio, Images, Text, Effects, Projects) with icons, labels, and counts

## Group
**Media Library**

## Feature to Implement

### ONE Feature: Vertical Media Category Tabs
**Purpose**: Create vertical tab buttons to switch between different media categories

**Requirements**:

#### 1. What to Build
Create 6 vertical tab buttons in the media panel:
1. **Videos** - Icon: 🎬, Count badge
2. **Audio** - Icon: 🎵, Count badge
3. **Images** - Icon: 🖼️, Count badge
4. **Text** - Icon: 📝, Count badge
5. **Effects** - Icon: ✨, Count badge
6. **Projects** - Icon: 📁, Count badge

Each button displays: Icon, Label, Count (e.g., "Videos (3)")

#### 2. Button Layout
Each vertical tab button should have:
- Icon (emoji) at top or left
- Label text (Videos, Audio, etc.)
- Count badge in parentheses: "(0)" initially
- Layout options:
  - **Vertical**: Icon above label above count
  - **Horizontal**: Icon | Label (count) - side by side

Recommendation: **Horizontal layout** for better use of 60px width

#### 3. Button Structure
```
[Icon] Label (Count)
```

Example:
```
🎬 Videos (0)
🎵 Audio (0)
🖼️ Images (0)
📝 Text (0)
✨ Effects (0)
📁 Projects (0)
```

#### 4. Visual States
**Inactive button**:
- Transparent or subtle background
- Normal text color (secondary)
- No border or thin border
- Icon and text same color

**Active button**:
- Highlighted background (primary or accent color)
- Bold text
- Thick left border (4px) for emphasis
- Higher contrast icon and text

**Hover button** (inactive only):
- Background color change
- Slight border or highlight
- Cursor: pointer

#### 5. Button Sizing
Each button:
- Width: Full width of vertical tab section (60px? No, earlier specs said 60px)
- **Correction**: Vertical tab section should be wider to fit text. Suggest **120-150px** width
- Height: Auto-fit content or fixed (e.g., 60px each)
- Padding: 12-16px
- Spacing: Small gap between buttons (4-8px) or no gap

**Note**: Adjust vertical tab section width from Phase 38 if needed (120px instead of 60px).

#### 6. Count Badge Logic
Display count of items in each category:
- Initially all "(0)"
- Count updates when media imported (Phase 30, 41-43)
- Format: "(N)" where N is number of items
- Count color: slightly dimmed or same as label

#### 7. Button Order (Top to Bottom)
1. Videos (most common)
2. Audio
3. Images
4. Text
5. Effects
6. Projects (least common, at bottom)

#### 8. Accessibility
- Each button is keyboard focusable (Tab key)
- Use `role="tab"` on each button
- Use `aria-selected="true"` on active tab, `aria-selected="false"` on others
- Add `aria-label="Videos tab, 0 items"` for screen readers
- Arrow keys (Up/Down) navigate between tabs
- Enter or Space activates tab

#### 9. Styling Requirements
Apply Dark Neobrutalism theme:
- Active tab: bold background, thick left border (4px)
- Inactive tabs: subtle background
- Hover: background color change, slight scale (1.02x)
- Icons: Slightly larger than text (1.2-1.5em)
- Use CSS transitions for smooth state changes
- Use CSS variables from theme
- BEM naming: `.media-tabs__button`, `.media-tabs__button--active`, etc.

#### 10. Responsive Behavior
- **Desktop**: Full button with icon, label, count
- **Tablet**: Same as desktop (120-150px width manageable)
- **Mobile** (< 768px):
  - Option 1: Icon only, hide label and count
  - Option 2: Keep label but make buttons smaller
  - Recommendation: Icon only on very small screens

#### 11. Edge Cases
- **All counts zero**: Normal, show "(0)"
- **Large counts**: Format as "(99+)" if > 99 items
- **Very long category names**: "Effects" fits fine, no issue
- **Button width too narrow**: Revise vertical tab section width from Phase 38

#### 12. Integration with Phase 38
- Phase 38 created vertical tab section (60px wide)
- **Update**: Increase vertical tab section to 120-150px to fit button content
- This phase adds the 6 buttons to that section

#### 13. Files to Modify
- `editor.html` - Add 6 vertical tab button elements
- `assets/css/editor.css` - Add vertical tab button styles
- Potentially update media panel styles from Phase 38 (increase vertical tab width)

#### 14. Data Attributes
- `data-media-tab="videos"` on Videos button
- `data-media-tab="audio"` on Audio button
- `data-media-tab="images"` on Images button
- `data-media-tab="text"` on Text button
- `data-media-tab="effects"` on Effects button
- `data-media-tab="projects"` on Projects button

#### 15. What NOT to Do
- ❌ Do NOT implement tab switching logic (that's Phase 40)
- ❌ Do NOT load media items (that's Phase 41-43, 45)
- ❌ Do NOT update counts yet (will happen automatically when media imported)
- ❌ Do NOT add search or filters (Phase 44)
- This is **visual buttons only**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Phase 38**: Vertical tab section structure
- **Phase 40**: Will implement tab switching logic
- **Phase 41-43**: Will populate categories with media
- **Phase 45**: Will display media items
- **Code of Conduct**: Follow BEM naming, use CSS variables

## Testing Checklist
- [ ] 6 vertical tab buttons visible
- [ ] Buttons in correct order (Videos, Audio, Images, Text, Effects, Projects)
- [ ] Each button shows icon + label + count "(0)"
- [ ] First button (Videos) is active by default
- [ ] Active button has distinct visual style (bold, border, background)
- [ ] Inactive buttons have subtle style
- [ ] Hover effect works on inactive buttons
- [ ] No hover effect on active button
- [ ] Icons visible and properly sized
- [ ] Count badges visible "(0)"
- [ ] All text readable (good contrast)
- [ ] Buttons fit within vertical tab section
- [ ] No text overflow or truncation
- [ ] Tab key navigates through buttons
- [ ] Arrow keys (Up/Down) navigate between buttons
- [ ] `aria-selected` attribute present
- [ ] Dark Neobrutalism styling applied
- [ ] No console errors

## Done When
✅ 6 vertical tab buttons created  
✅ Icons, labels, and counts displayed  
✅ Active/inactive visual states work  
✅ Hover effects applied  
✅ All buttons fit properly  
✅ Keyboard navigation works  
✅ Dark Neobrutalism styling applied  
✅ All tests pass  
✅ Ready for Phase 40 (Vertical Tab Switching)

---
**Phase**: 45 | **Component**: Editor | **Group**: Media Library  
**Estimated Time**: 20 min

## Implementation Notes
- Recommend increasing vertical tab section width to 120-150px (update Phase 38)
- Videos tab should be active by default
- Counts will auto-update when media imported in later phases
- Keep buttons clean and simple
