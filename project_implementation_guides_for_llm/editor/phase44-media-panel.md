# Phase 44: Media Panel Structure

## Goal
Create 20% width left panel container with styling

---

## What to Build

Left media panel structure:
- Fixed left sidebar container
- Panel header with title
- Content area for media items
- Resizable width
- Collapsible behavior

---

## Feature to Implement

### ONE Feature: Media Library Panel Structure
**Purpose**: Establish the left sidebar panel that will contain the media library

**Requirements**:

#### 1. What to Build
Create the left sidebar panel for media library:
- Fixed left panel taking 20% of viewport width
- Full height from below tab bar to bottom of viewport
- Contains vertical tab buttons (added in Phase 39)
- Contains content area for media items
- Positioned as left column in main editor layout

#### 2. Layout & Positioning
- Position: Left side of editor workspace
- Width: 20% of viewport (or fixed ~300px, design choice)
- Height: Full viewport height minus top navigation (60px) and tab bar (45px)
- Top edge: Starts below tab bar (105px from top)
- Left edge: Flush with left edge of viewport
- Use CSS Grid or Flexbox for panel layout

#### 3. Internal Structure
Panel should have two sections:
1. **Vertical Tab Bar** (left side, narrow ~60px):
   - Will hold 6 vertical tab buttons (Phase 39)
   - Fixed width
   - Background: darker shade
2. **Content Area** (right side, remaining width):
   - Will display media items based on selected tab
   - Scrollable vertically
   - Background: secondary background

Layout: `[Vertical Tabs | Content Area]`

#### 4. Vertical Tab Section
Structure for vertical tabs:
- Width: 60px (fixed)
- Height: Full panel height
- Vertical layout (stack buttons vertically)
- Background: Slightly darker than content area
- Border on right side (2px solid)
- Will contain 6 buttons (Videos, Audio, Images, Text, Effects, Projects)

#### 5. Content Area Section
Structure for media content:
- Width: Remaining space (20% - 60px)
- Height: Full panel height
- Overflow-y: auto (vertical scroll)
- Overflow-x: hidden
- Background: secondary background
- Padding: 16px
- Empty initially (content added in later phases)

#### 6. Styling Requirements
Apply Dark Neobrutalism theme:
- Panel background: secondary background color
- Thick right border (3px solid) separating from preview panel
- Vertical tab section: darker shade (tertiary background)
- Content area: lighter shade (secondary background)
- Use CSS variables from theme system
- Subtle depth/shadow on right edge (optional)

#### 7. Responsive Behavior
- **Desktop (> 1024px)**: 20% width, always visible
- **Tablet (768px - 1024px)**: Fixed 280px width
- **Mobile (< 768px)**: 
  - Option 1: Collapsible/toggle to overlay mode
  - Option 2: Reduce to icon-only vertical tabs (very narrow)
  - Recommendation: Keep simple for now, can enhance later

#### 8. Empty State
Initially (before Phase 39):
- Vertical tab section: Empty (no buttons yet)
- Content area: Empty or show placeholder text "Media Library"
- Just styled containers with no functional content

#### 9. Scrolling Behavior
- Vertical tab section: No scroll (buttons fit vertically)
- Content area: Vertical scroll when content overflows
- Smooth scroll behavior
- Minimal or hidden scrollbar styling

#### 10. Z-Index & Layering
- Panel behind navigation bar and tab bar
- Panel above main content (preview, timeline, properties)
- Z-index: ~10 (low, since it's a static panel)

#### 11. Accessibility
- Use semantic HTML: `<aside>` for the panel
- Add `aria-label="Media Library Panel"`
- Ensure content area is keyboard scrollable
- Focus should be manageable within panel

#### 12. Files to Modify
- `editor.html` - Add media panel HTML structure (should already exist from Phase 26)
- `assets/css/editor.css` - Refine media panel styles
- Use BEM naming: `.media-panel`, `.media-panel__tabs`, `.media-panel__content`

#### 13. Integration with Phase 26
Phase 26 already created basic panel structure. This phase refines:
- Internal layout (vertical tabs + content area)
- Proper sizing and spacing
- Scrolling behavior
- Styling polish

#### 14. What NOT to Do
- ❌ Do NOT add vertical tab buttons (that's Phase 39)
- ❌ Do NOT add media items or tiles (that's Phase 45)
- ❌ Do NOT add search functionality (that's Phase 44)
- ❌ Do NOT add upload buttons or functionality
- This is **visual structure only**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Phase 26**: Basic panel structure already exists
- **Phase 39**: Will add vertical tab buttons
- **Phase 45**: Will add media tile display
- **Code of Conduct**: Follow BEM naming, no inline styles, use CSS variables
- **Dark Neobrutalism**: Thick borders, layered backgrounds

---

## Testing Checklist Checklist
- [ ] Media panel appears on left side of editor
- [ ] Panel is 20% width (or ~300px)
- [ ] Panel height fills from below tab bar to bottom
- [ ] Vertical tab section visible (60px wide, empty)
- [ ] Content area visible (remaining width, empty)
- [ ] Thick right border (3px) separates from preview panel
- [ ] Vertical tab section darker than content area
- [ ] Content area has scrolling enabled (test by adding tall content)
- [ ] Panel positioned correctly below navigation and tab bar
- [ ] Dark Neobrutalism styling applied
- [ ] Responsive on tablet/mobile (simplified layout)
- [ ] No horizontal scroll in panel
- [ ] No console errors

---

## Done When
✅ Media panel structured with vertical tabs section + content area  
✅ 20% width, full height below tab bar  
✅ Vertical tab section styled (60px wide)  
✅ Content area styled (scrollable)  
✅ Thick border separating from preview  
✅ Dark Neobrutalism theme applied  
✅ Responsive layout  
✅ All tests pass  
✅ Ready for Phase 39 (Vertical Tab Buttons)

---
**Phase**: 44 | **Component**: Editor | **Group**: Media Library  
**Estimated Time**: 10 min

## Implementation Notes
- This refines the basic structure from Phase 26
- Focus on internal layout: vertical tabs + content area split
- Keep it simple and clean
- Content will be populated in subsequent phases
