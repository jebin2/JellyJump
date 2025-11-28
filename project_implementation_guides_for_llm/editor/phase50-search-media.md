# Phase 50: Search Media Items

## Goal
Search input field, filter all categories in real-time, highlight results

---

## What to Build

Search media library:
- Search input field
- Filter by filename
- Real-time results
- Clear search button
- Highlight matching text
- Search across all media types

---

## Feature to Implement

### ONE Feature: Media Library Search
**Purpose**: Allow users to search and filter media items across all categories by filename

**Requirements**:

#### 1. What to Build
Add search functionality to media library:
- Search input field at top of media panel
- Search across ALL categories (Videos, Audio, Images)
- Filter items in real-time as user types
- Highlight matching text in results
- Show "No results" message when no matches
- Clear search button (X icon)

#### 2. Search Input UI
Position and styling:
- Location: Top of media content area (above category tabs OR above content)
- Layout: Search icon 🔍 + Input field + Clear button X
- Width: Full width of content area minus padding
- Height: 40px
- Placeholder: "Search media..."
- Dark Neobrutalism styling (thick border, etc.)

Positioning options:
- **Option A**: Above vertical tabs (searches all categories)
- **Option B**: Above content area (searches current category only)

Recommendation: **Option A** - searches all categories, more powerful.

#### 3. Search Behavior
As user types in search input:
1. Get search query (lowercase for case-insensitive)
2. Search all media items in IndexedDB
3. Filter items where filename contains query
4. Display matching results in current category view
5. Update count badges to show filtered counts
6. If no results, show "No results for '[query]'"

#### 4. Real-Time Filtering
Implement live search:
- Listen to `input` event on search field
- Debounce: Wait 300ms after user stops typing
- Filter and display results
- No need for explicit "Search" button

#### 5. Search Algorithm
Simple substring matching:
- Convert query to lowercase
- Convert each item filename to lowercase
- Check if filename includes query
- Return matching items

```
Example:
Query: "beach"
Matches: "Beach_vacation.mp4", "sunset_beach.jpg", "BEACH_PARTY.mp3"
```

#### 6. Search Scope
By default, search across:
- Videos category
- Audio category  
- Images category
- (Text, Effects, Projects can be skipped for now)

Show results in the **currently active category tab**. 

Alternative: Show results across all categories (design choice).

Recommendation: **Search current category only** (simpler UI).

#### 7. Filtered Results Display
When search is active:
- Show only matching items in current category
- Hide non-matching items
- Update count badge: "Videos (2/10)" = 2 matches out of 10 total
- Empty state if no matches in current category

#### 8. Clear Search
Clear button functionality:
- X icon appears when search has text
- Click X → clear input, reset to show all items
- Esc key also clears search
- Restore original count badges

#### 9. Highlight Matching Text
Visually highlight the matched portion:
- Wrap matched text in `<mark>` or `<strong>` tag
- Apply highlight background color (yellow or accent color)
- Case-insensitive highlighting

Example: Query "sun" in "Sunset_beach.mp4" → "**Sun**set_beach.mp4"

#### 10. No Results State
When search returns zero matches:
- Show message: "No results for '[query]'"
- Suggest: "Try a different search term"
- Icon: 🔍 (magnifying glass)
- Clear search button visible

#### 11. Count Badge Updates
While search active:
- Show filtered count: "Videos (2/10)" 
- OR: Just show filtered count: "Videos (2)"
- Return to normal when search cleared: "Videos (10)"

#### 12. Edge Cases
- **Empty search**: Show all items (no filtering)
- **Search with no items in category**: "No media to search"
- **Special characters in query**: Escape or ignore
- **Very long query**: Truncate display, but search full query
- **Search while uploading**: New items should appear if they match query

#### 13. Performance Optimization
For large libraries (100+ items):
- Debounce input (300ms)
- Consider limiting results displayed (first 50 matches)
- Use efficient filtering (don't re-query IndexedDB, filter in memory)

#### 14. Accessibility
- Search input has `aria-label="Search media library"`
- Clear button has `aria-label="Clear search"`
- Announce results count to screen readers: "5 results found"
- Use `role="search"` on search container
- Keyboard shortcuts:
  - Ctrl+F or Cmd+F to focus search (optional)
  - Esc to clear search

#### 15. Styling Requirements
Apply Dark Neobrutalism theme:
- Search input: thick border (3px), brutalist style
- Focus state: highlighted border color
- Clear button: subtle, appears on hover or when input has text
- Highlight: bright background (yellow or accent)
- Use CSS variables

#### 16. Files to Create/Modify
- `editor.html` - Add search input to media panel
- `assets/css/editor.css` - Add search input styles
- `assets/js/media-library.js` - Add search/filter logic
- `assets/js/search-highlighter.js` - Optional: utility for text highlighting

#### 17. JavaScript Organization
Extend MediaLibrary class:
- `searchMedia(query)` - Main search function
- `filterCategoryItems(category, query)` - Filter items in category
- `highlightMatch(text, query)` - Highlight matching text
- `updateSearchResults(results)` - Update UI with results
- `clearSearch()` - Reset to show all items
- `attachSearchHandlers()` - Event listeners for input

#### 18. Data Attributes
- `data-search="media"` on search input
- `data-action="clear-search"` on clear button

#### 19. What NOT to Do
- ❌ Do NOT implement advanced search (filters by type, date, size) - keep simple
- ❌ Do NOT implement search history or suggestions
- ❌ Do NOT search inside video content or metadata (beyond filename)
- ❌ Do NOT implement fuzzy matching
- This is **simple filename search ONLY**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Phase 41-43**: Media items to search through
- **Phase 45**: Tile display that shows filtered results
- **Phase 40**: Category tab switching (search within active category)

---

## Testing Checklist Checklist
- [ ] Search input visible at top of media panel
- [ ] Typing in search filters items in real-time
- [ ] Case-insensitive search works
- [ ] Matching items displayed
- [ ] Non-matching items hidden
- [ ] Count badge updates: "Videos (2/10)"
- [ ] Matching text highlighted in results
- [ ] Clear button (X) visible when text entered
- [ ] Click clear button resets search
- [ ] Press Esc clears search
- [ ] "No results" message when no matches
- [ ] Debounce works (300ms delay after typing)
- [ ] Search works across all categories (Videos, Audio, Images)
- [ ] Empty search shows all items
- [ ] Search persists when switching categories (or resets - design choice)
- [ ] Keyboard accessible (Tab to focus)
- [ ] No console errors

---

## Done When
✅ Search input functional  
✅ Real-time filtering works  
✅ Matching text highlighted  
✅ Clear search button works  
✅ No results message displays  
✅ Count badges update correctly  
✅ Debouncing implemented  
✅ All tests pass  
✅ Ready for Phase 45 (Tile/Grid Display)

---
**Phase**: 50 | **Component**: Editor | **Group**: Media Library  
**Estimated Time**: 25 min

## Implementation Notes
- Keep search simple: filename substring matching
- Debounce to avoid excessive filtering
- Use `<mark>` tag for highlighting (accessible)
- Filter in-memory, don't re-query IndexedDB
- Consider UX: should search persist when switching categories?
