# Phase 55: Empty State Display

## Goal
Show "Select a clip to edit" message when nothing selected

## Group
**Properties Panel**

## Feature to Implement

### ONE Feature: Empty State for Properties Panel
**Purpose**: Display helpful message when no clip is selected

**Requirements**:

#### 1. What to Build
Create empty state for properties panel:
- Message: "Select a clip to edit"
- Icon: 🎬 or 📝 (optional)
- Subtext: "Click a clip on the timeline to view its properties"
- Centered in content area
- Friendly, helpful tone
- Show when no clip selected

#### 2. Empty State Content
Structure:
1. **Icon** (top, optional): 🎬, 📝, or 🎛️
2. **Primary message**: "No Clip Selected"
3. **Secondary message**: "Select a clip on the timeline to edit its properties"
4. **Optional hint**: "Or drag media from library to timeline"

#### 3. Layout & Positioning
Center empty state:
- Vertically centered in content area
- Horizontally centered
- Use flexbox or grid for centering
- Adequate spacing between icon, text elements

#### 4. Visual Design
Styling:
- Icon: Large (48-64px), subtle color
- Primary message: Bold, medium size (18-20px)
- Secondary message: Regular, smaller size (14-16px), muted color
- Background: Transparent or subtle background box
- No thick borders (keep it light)

#### 5. When to Show Empty State
Display when:
- No clip selected on timeline
- Timeline is empty (no clips)
- Editor first loads (default state)
- Clip deselected (user clicks away)

#### 6. When to Hide Empty State
Hide when:
- User selects clip on timeline (Phase 73)
- Properties panel populated with clip data
- Replace with actual property controls (Phase 57-59)

#### 7. State Management
Track selection state:
- `selectedClipId` - null when nothing selected
- Check this value to show/hide empty state

Logic:
```javascript
if (selectedClipId === null) {
  showEmptyState();
} else {
  hideEmptyState();
  showClipProperties(selectedClipId);
}
```

#### 8. Multiple Empty States (Optional)
Could have different messages for different scenarios:

**No clips on timeline**:
- "Timeline is Empty"
- "Drag media from library to get started"

**Clips exist but none selected**:
- "No Clip Selected"
- "Click a clip to edit its properties"

For this phase: Single generic empty state is fine.

#### 9. Accessibility
- Use semantic HTML
- Add `aria-label="Empty state: No clip selected"`
- Icon should have `aria-hidden="true"` (decorative)
- Text should be announced by screen readers

#### 10. Styling Requirements
Apply theme:
- Icon: Subtle gray or secondary color
- Primary text: Normal text color (not too bold)
- Secondary text: Muted/gray text color
- Background: None or very subtle
- Use CSS variables from theme
- BEM naming: `.empty-state`, `.empty-state__icon`, `.empty-state__message`

#### 11. Animation (Optional)
Subtle fade-in animation:
- Opacity 0 → 1 over 200-300ms
- Optional: Slight upward movement
- Smooth transition when switching to properties

#### 12. Edge Cases
- **Loading state**: Show empty state or loading spinner
- **Error state**: Different message if error loading properties
- **Quick selections**: Don't flicker if user rapidly selects clips

#### 13. Integration with Future Phases
Empty state replaced by:
- **Phase 57**: Clip info display
- **Phase 58-59**: Volume/mute controls
- **Phase 73**: Clip selection triggers hiding empty state

#### 14. Files to Create/Modify
- `editor.html` - Add empty state HTML to properties content area
- `assets/css/editor.css` - Add empty state styles
- `assets/js/properties-panel.js` - Create new file for properties logic
- Logic to show/hide based on selection state

#### 15. JavaScript Organization
Create PropertiesPanel class/module:
- `showEmptyState()` - Display empty state
- `hideEmptyState()` - Hide empty state
- `clearProperties()` - Clear all property controls
- `hasSelectedClip()` - Check if clip selected
- Initialize with empty state visible

#### 16. Data Attributes
- `data-empty-state="properties"` on empty state element

#### 17. What NOT to Do
- ❌ Do NOT add interactive elements in empty state (buttons, links)
- ❌ Do NOT show empty state when clip selected (conflicts with properties)
- ❌ Do NOT add complex animations (keep it simple)
- ❌ Do NOT make empty state closeable (it's contextual)
- This is **empty state display ONLY**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Phase 54**: Properties panel structure (empty state goes in content area)
- **Phase 56-59**: Property controls that replace empty state
- **Phase 73**: Clip selection triggers hiding empty state

## Testing Checklist
- [ ] Empty state visible in properties panel on page load
- [ ] Shows message: "No Clip Selected" or similar
- [ ] Shows secondary message with instructions
- [ ] Icon displayed (if included)
- [ ] Empty state centered vertically and horizontally
- [ ] Text readable with good contrast
- [ ] Icon subtle and appropriate size
- [ ] Spacing between elements looks good
- [ ] Empty state hidden when clip selected (manual test or Phase 73)
- [ ] Empty state shown when clip deselected
- [ ] Smooth transition when showing/hiding
- [ ] Accessible (screen reader announces text)
- [ ] No console errors

## Done When
✅ Empty state displayed in properties panel  
✅ Message and icon shown  
✅ Centered in content area  
✅ Shows when no clip selected  
✅ Hides when clip selected (ready for Phase 73)  
✅ Styled appropriately  
✅ Accessible  
✅ All tests pass  
✅ Ready for Phase 56 (Collapsible Section Headers)

---
**Phase**: 55 | **Component**: Editor | **Group**: Properties Panel  
**Estimated Time**: 10 min

## Implementation Notes
- Keep message friendly and instructional
- Empty state is default until clip selected
- Simple show/hide logic based on selection state
- This provides good UX feedback for the properties panel
- Actual clip selection comes in Phase 73 (timeline)
