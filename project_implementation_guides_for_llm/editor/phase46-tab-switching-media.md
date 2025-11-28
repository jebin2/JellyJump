# Phase 46: Vertical Tab Switching

## Goal
Click vertical tab to show category content, active/inactive states, persist active tab

---

## What to Build

Media tab switching:
- Click to switch media type
- Show/hide corresponding content
- Update active state visually
- Smooth transitions
- Filter media library by type

---

## Feature to Implement

### ONE Feature: Media Category Tab Switching
**Purpose**: Allow users to switch between different media categories (Videos, Audio, Images, etc.)

**Requirements**:

#### 1. What to Build
Make vertical tab buttons functional to switch categories:
- Click any tab button to activate it
- Deactivate previously active tab
- Show corresponding category content in content area
- Update visual states (active/inactive)
- Persist active category to localStorage
- Restore active category on page load

#### 2. Tab Click Behavior
When a vertical tab is clicked:
1. Check if tab is already active
2. If already active, do nothing (early return)
3. If different tab:
   - Deactivate currently active tab (remove active state)
   - Activate clicked tab (add active state)
   - Hide current category content
   - Show clicked category content
   - Update internal state (active category)
   - Save to localStorage
   - Log to console: "Switched to category: videos"

#### 3. Visual State Updates
**Activate clicked tab**:
- Add active state class (`.media-tabs__button--active`)
- Apply highlighted background (primary color)
- Apply thick left border (4px)
- Make text and icon bold
- Update `aria-selected="true"`

**Deactivate previous tab**:
- Remove active state class
- Apply subtle background
- Remove thick border
- Make text and icon normal weight
- Update `aria-selected="false"`

#### 4. Content Area Display
When switching to a category:
- Hide all category content sections
- Show only the selected category's content section
- Content sections identified by `data-category="videos"`, `data-category="audio"`, etc.
- If category is empty, show empty state message:
  - "No videos yet. Import media to get started." (for Videos)
  - "No audio files yet." (for Audio)
  - Similar for other categories

#### 5. Category Content Structure
For each category, create a content section:
```
<div data-category="videos" class="media-content">
  <!-- Video items will be added in Phase 41-45 -->
  <p class="empty-state">No videos yet. Import media to get started.</p>
</div>
<div data-category="audio" class="media-content" hidden>
  <!-- Audio items -->
</div>
<!-- etc. -->
```

#### 6. Empty State Messages
For each category, show appropriate message:
- **Videos**: "No videos yet. Import media to get started. 📥"
- **Audio**: "No audio files yet. Import to add music or sounds. 🎵"
- **Images**: "No images yet. Import photos or graphics. 🖼️"
- **Text**: "No text overlays yet. Create text in timeline. 📝"
- **Effects**: "No effects yet. Coming soon. ✨"
- **Projects**: "No saved projects yet. 📁"

Empty states only visible when category has 0 items.

#### 7. Event Handling
Use event delegation for tab clicks:
- Attach single click event listener to vertical tabs container
- Check if click target is a tab button (`data-media-tab` attribute)
- Call tab switching logic with category name

#### 8. Keyboard Navigation
Support keyboard tab switching:
- Arrow keys (Up/Down) to navigate between tabs
- Enter or Space to activate focused tab
- Focus should stay on active tab button after switching

#### 9. Persistence
Save active category to localStorage:
- Key: `mediabunny_editor_active_media_category`
- Value: Category name (e.g., "videos", "audio")
- Save immediately when switching
- Restore on page load

#### 10. Page Load Restoration
On page load:
- Read `mediabunny_editor_active_media_category` from localStorage
- If found, activate that category
- If not found or invalid, default to "videos"
- Show corresponding content area

#### 11. Edge Cases
- **Click same tab**: Do nothing (already active)
- **No items in category**: Show empty state message
- **localStorage not available**: Default to "videos", continue without persistence
- **Invalid category from localStorage**: Fall back to "videos"

#### 12. Initial State
On first load (no localStorage):
- "Videos" tab active by default
- Videos content area visible
- All other tabs inactive
- All other content areas hidden

#### 13. Count Badge Updates (Preparation)
When switching tabs:
- No need to update counts in this phase
- Counts will auto-update when media imported (Phase 41-43)
- Just display current count value from data

#### 14. Styling Requirements
Ensure smooth transitions:
- CSS transition for tab state changes (200-300ms)
- Fade in/out for content area switching (optional)
- No jarring layout shifts
- Active tab should "pop" visually

#### 15. Accessibility
- Use `role="tablist"` on vertical tabs container
- Use `role="tab"` on each tab button
- Use `role="tabpanel"` on each content area
- Link tabs to content with `aria-controls="videos-panel"` and `id="videos-panel"`
- Update `aria-selected="true/false"` when switching
- Announce category changes to screen readers with live region

#### 16. Files to Create/Modify
- `editor.html` - Add content area sections for each category
- `assets/js/media-library.js` - Create or extend for tab switching logic
- `assets/css/editor.css` - Add content area styles and transitions

#### 17. JavaScript Organization
Create or extend MediaLibrary class/module:
- `switchCategory(categoryName)` - Main switching method
- `setActiveCategory(categoryName)` - Update active states
- `showCategoryContent(categoryName)` - Display content
- `hideCategoryContent(categoryName)` - Hide content
- `saveActiveCategory()` - Save to localStorage
- `restoreActiveCategory()` - Load from localStorage on page load
- `attachTabClickHandlers()` - Event delegation for tab clicks

#### 18. Data Attributes
- `data-media-tab="videos"` on tab buttons (already added in Phase 39)
- `data-category="videos"` on content area sections

#### 19. What NOT to Do
- ❌ Do NOT implement media upload yet (Phases 30, 41-43 handle that)
- ❌ Do NOT display media items yet (that's Phase 45)
- ❌ Do NOT implement search/filter (that's Phase 44)
- ❌ Do NOT implement drag-and-drop (that's Phase 47)
- This phase is **tab switching logic ONLY**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Phase 39**: Vertical tab buttons already created
- **Phase 30**: Import functionality stores media in IndexedDB
- **Phase 41-43**: Will populate categories with specific media types
- **Phase 45**: Will display media items as tiles
- **Code of Conduct**: Use event delegation, cache selectors

---

## Testing Checklist Checklist
- [ ] Click "Videos" tab activates it (visual change)
- [ ] Click "Audio" tab switches to Audio
- [ ] Previously active tab becomes inactive
- [ ] Only one tab active at a time
- [ ] Click already-active tab does nothing
- [ ] Active tab has distinct visual style (bold, thick border, background)
- [ ] Inactive tabs are dimmed
- [ ] Hover effect on inactive tabs
- [ ] Content area shows corresponding category
- [ ] Empty state message displayed when category has no items
- [ ] Other content areas hidden when not active
- [ ] Active category saved to localStorage
- [ ] Page refresh restores last active category
- [ ] Default to "Videos" on first load
- [ ] Arrow keys (Up/Down) navigate between tabs
- [ ] Enter key activates focused tab
- [ ] `aria-selected` attribute updates correctly
- [ ] Smooth CSS transitions
- [ ] No console errors

---

## Done When
✅ Tab clicking switches categories  
✅ Visual active/inactive states work  
✅ Only one tab active at a time  
✅ Content area displays corresponding category  
✅ Empty state messages shown  
✅ Event delegation for clicks  
✅ Keyboard navigation works  
✅ Persistence to localStorage  
✅ Restoration on page load  
✅ All tests pass  
✅ Ready for Phase 41 (Upload Video Files)

---
**Phase**: 46 | **Component**: Editor | **Group**: Media Library  
**Estimated Time**: 20 min

## Implementation Notes
- Similar pattern to project tab switching (Phase 34)
- Use event delegation for performance
- Content areas mostly empty for now (Phase 45 adds tiles)
- Empty states provide good UX feedback
- Videos is the default/most common category
