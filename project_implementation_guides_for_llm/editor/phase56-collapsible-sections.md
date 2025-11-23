# Phase 56: Collapsible Section Headers

## Goal
Create 6 section headers with expand/collapse, smooth animation, persist state

## Group
**Properties Panel**

## Feature to Implement

### ONE Feature: Collapsible Property Sections
**Purpose**: Organize clip properties into expandable/collapsible sections

**Requirements**:

#### 1. What to Build
Create 6 collapsible sections for properties:
1. **Clip Info** - Basic clip information (Phase 57)
2. **Audio** - Volume, mute controls (Phase 58-59)
3. **Transform** - Position, scale, rotation (Phases 93-96)
4. **Effects** - Filters, color grading (Phases 85-88)
5. **Text** - Text overlays (Phases 89-92)
6. **Transitions** - Fade, crossfade, wipe (Phases 82-84)

Each section has:
- Header (clickable to expand/collapse)
- Content area (shows/hides)
- Arrow icon (▶/▼ or >/<)
- Persist expanded/collapsed state

#### 2. Section Header Structure
Each header contains:
- Section icon (emoji) - e.g., 🎬 for Clip Info, 🔊 for Audio
- Section title - e.g., "Clip Info", "Audio"
- Expand/collapse arrow - ▼ (expanded) or ▶ (collapsed)
- Click anywhere on header to toggle

Layout:
```
[Icon] Title         [▼]
```

#### 3. Section Content Area
Below header:
- Contains property controls (inputs, sliders, etc.)
- Initially hidden (collapsed) or visible (expanded)
- Smooth height animation when expanding/collapsing
- Padding: 12-16px

#### 4. Expand/Collapse Logic
When section header clicked:

**If collapsed**:
1. Rotate arrow: ▶ → ▼
2. Expand content area (height 0 → auto)
3. Smooth animation (300ms)
4. Update state: `isExpanded = true`
5. Save to localStorage

**If expanded**:
1. Rotate arrow:  ▼ → ▶
2. Collapse content area (height auto → 0)
3. Smooth animation (300ms)
4. Update state: `isExpanded = false`
5. Save to localStorage

#### 5. Default Expanded/Collapsed State
On first load:
- **Expanded by default**: Clip Info, Audio (most common)
- **Collapsed by default**: Transform, Effects, Text, Transitions
- User can customize, state persists

#### 6. State Persistence
Save expanded/collapsed state to localStorage:
- Key: `mediabunny_editor_properties_sections`
- Value: Object mapping section ID to boolean
```javascript
{
  "clipInfo": true,
  "audio": true,
  "transform": false,
  "effects": false,
  "text": false,
  "transitions": false
}
```

Restore state on page load.

#### 7. Smooth Animation
CSS for smooth expand/collapse:

**Option A - CSS Transition**:
```css
.section__content {
  max-height: 0;
  overflow: hidden;
  transition: max-height 300ms ease;
}
.section__content--expanded {
  max-height: 500px; /* Large enough */
}
```

**Option B - CSS Grid/Height Auto**:
- Use grid-template-rows: 0fr → 1fr
- Smoother with auto height

**Option C - JavaScript**:
- Calculate height, animate manually

Recommendation: **Option A - CSS Transition** (simplest).

#### 8. Arrow Icon Rotation
Rotate arrow when toggling:
- Collapsed: ▶ (pointing right) or rotate 0deg
- Expanded: ▼ (pointing down) or rotate 90deg
- CSS transition: `transform: rotate(90deg)`
- Smooth rotation (200ms)

#### 9. Section Header Styling
Apply Dark Neobrutalism theme:
- Header background: Slightly different shade than content
- Thick border: Top and bottom (2-3px)
- Click effect: Darken background or translate down slightly
- Icon: Medium size (18-20px)
- Title: Bold text (16px)
- Arrow: Right-aligned
- Hover: Cursor pointer, highlight background

#### 10. Section Content Styling
Content area:
- Background: Secondary background (lighter than header)
- Padding: 12-16px
- Border: Optional thin border
- Controls added in Phases 57-59

#### 11. Event Handling
Use event delegation:
- Attach click handler to properties panel
- Check if click target is section header
- Toggle corresponding section
- Update arrow, animate content

#### 12. Order of Sections
Top to bottom:
1. Clip Info (most important, always first)
2. Audio
3. Transform
4. Effects
5. Text
6. Transitions

#### 13. Empty Sections
Sections initially empty (content added later):
- Show placeholder: "No controls yet" or keep empty
- OR: Hide section entirely until content added

For this phase: Create all 6 sections, even if content empty.

#### 14. Accessibility
- Section headers:
  - Use `<button>` element (keyboard accessible)
  - `aria-expanded="true|false"` attribute
  - `aria-controls="section-content-id"` linking to content
- Content areas:
  - `id="section-content-id"`
  - Role: region (optional)
- Arrow icon: `aria-hidden="true"` (decorative)
- Enter/Space toggles section

#### 15. Mobile Behavior
On mobile:
- All sections collapsed by default (save space)
- Expand one at a time
- Sticky headers (optional)

#### 16. Files to Create/Modify
- `editor.html` - Add 6 section headers and content areas to properties panel
- `assets/css/editor.css` - Add section styles, animations
- `assets/js/properties-panel.js` - Add toggle logic, state persistence

#### 17. JavaScript Organization
Extend PropertiesPanel class:
- `toggleSection(sectionId)` - Toggle expand/collapse
- `expandSection(sectionId)` - Expand specific section
- `collapseSection(sectionId)` - Collapse specific section
- `saveSectionStates()` - Save to localStorage
- `restoreSectionStates()` - Load from localStorage
- `attachSectionHandlers()` - Event listeners for headers

#### 18. Data Attributes
- `data-section="clipInfo"` on each section container
- `data-section-header="clipInfo"` on header button
- `data-section-content="clipInfo"` on content area

#### 19. What NOT to Do
- ❌ Do NOT add actual property controls yet (Phases 57-59 handle that)
- ❌ Do NOT add "Expand All" / "Collapse All" buttons (not needed)
- ❌ Do NOT allow dragging to reorder sections (keep fixed order)
- ❌ Do NOT make sections removable
- This phase is **section headers and toggle logic ONLY**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Phase 54**: Properties panel structure (sections go in content area)
- **Phase 55**: Empty state (replaced by sections when clip selected)
- **Phase 57-59**: Will populate section content areas

## Testing Checklist
- [ ] 6 section headers visible in properties panel
- [ ] Sections in correct order (Clip Info, Audio, Transform, Effects, Text, Transitions)
- [ ] Each header shows icon, title, arrow
- [ ] Click header toggles expand/collapse
- [ ] Arrow rotates when toggling (▶ ↔ ▼)
- [ ] Content area expands smoothly (300ms animation)
- [ ] Content area collapses smoothly
- [ ] Default state: Clip Info and Audio expanded, others collapsed
- [ ] Section states save to localStorage
- [ ] Page refresh restores section states
- [ ] Keyboard accessible (Tab to header, Enter toggles)
- [ ] `aria-expanded` attribute updates
- [ ] Hover effect on headers
- [ ] Click effect (darken or translate)
- [ ] Multiple sections can be expanded simultaneously
- [ ] No console errors

## Done When
✅ 6 collapsible sections created  
✅ Headers clickable to toggle  
✅ Smooth expand/collapse animation  
✅ Arrow icons rotate  
✅ State persists to localStorage  
✅ Default expanded/collapsed state set  
✅ Keyboard accessible  
✅ All tests pass  
✅ Ready for Phase 57 (Selected Clip Info)

---
**Phase**: 56 | **Component**: Editor | **Group**: Properties Panel  
**Estimated Time**: 25 min

## Implementation Notes
- Collapsible sections improve organization
- Use CSS transitions for smooth animations
- localStorage persistence improves UX
- Section content populated in subsequent phases
- Keep animations smooth and responsive
- All 6 sections created now, even if empty (future-proofing)
