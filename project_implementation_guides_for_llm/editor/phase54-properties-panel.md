# Phase 54: Properties Panel Structure

## Goal
Create 30% width right panel with container styling

## Group
**Properties Panel**

## Feature to Implement

### ONE Feature: Properties Panel Structure
**Purpose**: Establish the right sidebar panel that will contain clip property controls

**Requirements**:

#### 1. What to Build
Create the right properties panel:
- Right panel taking 30% of viewport width
- Full height from below tab bar to above timeline
- Contains clip properties and editing controls
- Scrollable content area
- Positioned as right column in main editor layout

#### 2. Layout & Positioning
- Position: Right side of editor workspace (after preview panel)
- Width: 30% of viewport (or fixed ~400px)
- Height: Full viewport height minus:
  - Top navigation (60px)
  - Tab bar (45px)
  - Timeline panel (30% of viewport)
- Top edge: Starts below tab bar (105px from top)
- Left edge: Flush with right edge of preview panel

#### 3. Internal Structure
Panel should have:

1. **Header** (optional, ~50px):
   - Title: "Properties" or "Clip Properties"
   - Optional: Close/minimize button
   - Thick bottom border

2. **Scrollable Content Area** (main):
   - Contains all property sections
   - Overflow-y: auto (vertical scroll)
   - Overflow-x: hidden
   - Padding: 16-20px

Layout:
```
[Panel Header - "Properties"]
[Scrollable Content Area]
  - Empty state OR
  - Property sections (Phases 56-59)
```

#### 4. Header Section
If including header:
- Height: 50px
- Title: "Properties" (h2 or h3)
- Icon: 🎛️ or ⚙️ (optional)
- Styling: Bold text, centered or left-aligned
- Thick bottom border (3px) for separation

#### 5. Content Area
Structure for properties:
- Width: Full panel width minus padding
- Padding: 16-20px all sides
- Background: Secondary background color
- Sections added in Phase 56 (collapsible headers)
- Initially empty or shows empty state (Phase 55)

#### 6. Scrolling Behavior
- Content area scrollable when content overflows
- Smooth scroll behavior
- Custom or minimal scrollbar styling
- Scrollbar always visible or auto (design choice)

#### 7. Styling Requirements
Apply Dark Neobrutalism theme:
- Panel background: Secondary background color
- Thick left border (3px solid) separating from preview panel
- Header border: Thick bottom (3px)
- Use CSS variables from theme system
- High contrast text

#### 8. Responsive Behavior
- **Desktop (> 1024px)**: 30% width, always visible
- **Tablet (768px - 1024px)**: Fixed 350px width or 30%
- **Mobile (< 768px)**:
  - Option 1: Collapsible/toggle to overlay mode
  - Option 2: Hide completely (focus on video/timeline)
  - Recommendation: Keep simple for now, mobile optimization later

#### 9. Empty/Initial State
Before any clip selected (Phase 55 handles this):
- Show "No clip selected" message
- OR: Show placeholder content
- Properties appear after clip selection (timeline phases)

#### 10. Z-Index & Layering
- Panel at same level as media library and preview
- Z-index: ~10 (standard panel level)
- Scroll container manages overflow

#### 11. Accessibility
- Use semantic HTML: `<aside>` for the panel
- Add `aria-label="Properties panel"`
- Scrollable area keyboard accessible
- Focus should be manageable within panel

#### 12. Files to Modify
- `editor.html` - Add properties panel HTML structure (should already exist from Phase 26)
- `assets/css/editor.css` - Refine properties panel styles
- Use BEM naming: `.properties-panel`, `.properties-panel__header`, `.properties-panel__content`

#### 13. Integration with Phase 26
Phase 26 already created basic panel structure. This phase refines:
- Internal layout (header + scrollable content)
- Proper sizing and spacing
- Scrolling behavior
- Header styling
- Styling polish

#### 14. What NOT to Do
- ❌ Do NOT add empty state message yet (that's Phase 55)
- ❌ Do NOT add collapsible sections (that's Phase 56)
- ❌ Do NOT add property controls (Phases 57-59)
- ❌ Do NOT add clip selection logic (timeline phases)
- This is **visual structure only**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Phase 26**: Basic panel structure already exists
- **Phase 55**: Will add empty state display
- **Phase 56**: Will add collapsible section headers
- **Phases 57-59**: Will add specific property controls
- **Code of Conduct**: Follow BEM naming, no inline styles, use CSS variables

## Testing Checklist
- [ ] Properties panel appears on right side of editor
- [ ] Panel is 30% width (or ~400px)
- [ ] Panel height fills from below tab bar to above timeline
- [ ] Header visible with "Properties" title
- [ ] Content area visible below header
- [ ] Thick left border (3px) separates from preview panel
- [ ] Content area has scrolling enabled (test with tall content)
- [ ] Panel positioned correctly in layout
- [ ] Dark Neobrutalism styling applied
- [ ] High contrast text readable
- [ ] No horizontal overflow
- [ ] Responsive on tablet (maintains layout)
- [ ] No console errors

## Done When
✅ Properties panel structured with header + content area  
✅ 30% width, right side of layout  
✅ Header styled with title  
✅ Content area scrollable  
✅ Thick border separating from preview  
✅ Dark Neobrutalism theme applied  
✅ All tests pass  
✅ Ready for Phase 55 (Empty State Display)

---
**Phase**: 54 | **Component**: Editor | **Group**: Properties Panel  
**Estimated Time**: 10 min

## Implementation Notes
- This refines the basic structure from Phase 26
- Focus on internal layout: header + scrollable content
- Content will be populated in Phases 56-59
- Empty state added in Phase 55
- Keep it clean and ready for property sections
