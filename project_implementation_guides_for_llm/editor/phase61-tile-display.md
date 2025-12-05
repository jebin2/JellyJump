# Phase 51: Tile/Grid Display

## Goal
Display media items as 2-3 tiles per row with filename and duration badge

---

## What to Build

Tile display for media:
- Grid layout for media items
- Thumbnail + title display
- Hover effects
- Responsive columns
- Icon badges for media type
- Duration/size overlay

---

## Feature to Implement

### ONE Feature: Media Tile/Grid Display
**Purpose**: Display media items in a grid layout with thumbnails, filenames, and metadata badges

**Requirements**:

#### 1. What to Build
Create grid/tile display for media items:
- Grid layout: 2-3 tiles per row (responsive)
- Each tile shows:
  - Thumbnail or icon placeholder
  - Filename (truncated if long)
  - Duration badge (for video/audio)
  - File size or resolution (optional)
- Clickable tiles to select
- Hover effects
- Selected state visual

#### 2. Grid Layout
CSS Grid or Flexbox layout:
- **Desktop**: 3 tiles per row
- **Tablet**: 2 tiles per row  
- **Mobile**: 1-2 tiles per row
- Gap between tiles: 12-16px
- Tiles are equal size squares or rectangles

Recommendation: **CSS Grid** with auto-fit.

```css
Example:
grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
```

#### 3. Tile Structure
Each tile contains:
1. **Thumbnail area** (top):
   - Video: Placeholder or first frame (Phase 46)
   - Audio: Music note icon 🎵 or waveform
   - Image: Small version of image
   - Background: dark color
2. **Filename** (middle):
   - Text, truncated with ellipsis (...)
   - Max 2 lines
3. **Duration badge** (bottom-right overlay):
   - Format: "0:45" or "2:30"
   - Only for videos and audio
   - Dark background, light text

#### 4. Tile Visual States
**Normal state**:
- Border: 2px solid
- No background or subtle background
- Thumbnail visible
- Filename readable

**Hover state**:
- Border: 3px solid (thicker)
- Background: slight highlight
- Cursor: pointer
- Optional: scale up slightly (1.05x)

**Selected state** (clicked):
- Border: 4px solid, accent color
- Background: highlighted
- Checkmark icon or indicator
- Stays selected until deselected

#### 5. Thumbnail Display
For each media type:

**Videos**:
- Placeholder: 🎬 icon or gray box
- Note: Actual thumbnails in Phase 46

**Audio**:
- Icon: 🎵 or 🎧
- OR: Colored box with audio icon

**Images**:
- Thumbnail: Scaled-down version of actual image
- Use `object-fit: cover` to fill tile
- Create blob URL from IndexedDB blob

#### 6. Duration Badge
Display duration for videos and audio:
- Position: Bottom-right corner of thumbnail
- Format: "M:SS" (e.g., "0:45", "2:30", "15:20")
- Background: Semi-transparent dark (rgba(0,0,0,0.7))
- Text: White, small font
- Padding: 2-4px
- Border-radius: 4px (slightly rounded)

#### 7. Filename Display
Show filename below thumbnail:
- Max 2 lines with ellipsis
- Tooltip on hover showing full filename
- Font size: Small (12-14px)
- Center-aligned or left-aligned

Example:
```
Beach_vacation_2023_su...
```

#### 8. Tile Click Behavior
When user clicks a tile:
- Mark as selected (add selected class)
- Deselect other tiles (single selection for now)
- Update internal state (store selected item ID)
- Log to console: "Selected: Beach_vacation.mp4"
- Note: Actual usage (drag to timeline) in Phase 47

#### 9. Loading State
While loading media from IndexedDB:
- Show skeleton tiles or loading spinner
- Placeholder tiles with shimmer effect
- "Loading media..." message

#### 10. Empty State (No Items)
Already handled in Phase 40:
- "No videos yet. Import media..." message
- This phase just handles displaying tiles when items exist

#### 11. Responsive Grid
Adjust columns based on viewport:
- **> 1200px**: 3 tiles per row
- **768px - 1200px**: 2 tiles per row
- **< 768px**: 1-2 tiles per row
- Use CSS Grid auto-fit for flexibility

#### 12. Performance Considerations
For large libraries (50+ items):
- Lazy loading: Load tiles as user scrolls (optional)
- Virtual scrolling: Render only visible tiles (advanced, optional)
- For this phase: Render all tiles (simple)
- Image thumbnails: Use smaller scaled versions if available

#### 13. Styling Requirements
Apply Dark Neobrutalism theme:
- Tiles: Thick borders, no rounded corners (or minimal)
- Selected tile: Bold accent color border
- Hover: Offset shadow (optional)
- Duration badge: Dark brutalist style
- Use CSS transitions for smooth hover/select effects
- BEM naming: `.media-tile`, `.media-tile__thumbnail`, `.media-tile__filename`, etc.

#### 14. Accessibility
- Each tile keyboard focusable (Tab key)
- Add `role="button"` or `role="checkbox"` to tiles
- Use `aria-selected="true/false"` for selected state
- Add `aria-label="Video: Beach vacation, duration 2:30"`
- Enter or Space key selects tile
- Clearly indicate selected state visually

#### 15. Integration with Search (Phase 44)
When search is active:
- Only display tiles matching search query
- Highlighted filename from Phase 44
- Update grid dynamically when search changes

#### 16. Files to Create/Modify
- `editor.html` - Add tile container structure (may already exist)
- `assets/css/editor.css` - Add tile/grid styles
- `assets/js/media-library.js` - Add tile rendering logic
- `assets/js/media-tile-renderer.js` - Optional: separate module for tile rendering

#### 17. JavaScript Organization
Extend MediaLibrary class:
- `renderMediaTiles(category)` - Render all tiles for category
- `createTile(mediaItem)` - Create single tile element
- `selectTile(tileId)` - Mark tile as selected
- `deselectAllTiles()` - Clear all selections
- `formatDuration(seconds)` - Convert seconds to "M:SS"
- `getThumbnailUrl(mediaItem)` - Get thumbnail or placeholder
- `attachTileClickHandlers()` - Event delegation for tile clicks

#### 18. Data Attributes
- `data-media-id="[UUID]"` on each tile
- `data-media-type="video|audio|image"` on each tile
- `data-selected="true|false"` for selected state

#### 19. What NOT to Do
- ❌ Do NOT implement video thumbnails yet (that's Phase 46)
- ❌ Do NOT implement drag-and-drop yet (that's Phase 47)
- ❌ Do NOT implement multi-select (Ctrl+Click) - single select only
- ❌ Do NOT implement right-click context menus
- ❌ Do NOT implement delete/rename (not in current scope)
- This phase is **tile display and selection ONLY**

**MediaBunny Integration**: Not applicable for basic display (Phase 46 uses it for thumbnails)

## References
- **Phase 41-43**: Media items stored in IndexedDB
- **Phase 44**: Search filters which tiles to display
- **Phase 46**: Will add video thumbnail generation
- **Phase 47**: Will make tiles draggable to timeline

---

## Testing Checklist Checklist
- [ ] Media items displayed as tiles in grid layout
- [ ] 2-3 tiles per row on desktop
- [ ] Each tile shows filename
- [ ] Videos/audio show duration badge (bottom-right)
- [ ] Images show thumbnail (scaled image)
- [ ] Videos/audio show placeholder icon (for now)
- [ ] Tiles have hover effect (border, background)
- [ ] Click tile selects it (visual change)
- [ ] Only one tile selected at a time
- [ ] Selected tile has distinct visual (thick border, accent color)
- [ ] Filename truncates with ellipsis if too long
- [ ] Tooltip shows full filename on hover
- [ ] Duration formatted correctly: "2:30", "15:45"
- [ ] Grid responsive on different screen sizes
- [ ] Tiles keyboard accessible (Tab, Enter)
- [ ] `aria-selected` updates correctly
- [ ] Integration with search (filtered tiles displayed)
- [ ] No console errors

---

## Done When
✅ Media items displayed as tiles  
✅ Grid layout responsive (2-3 per row)  
✅ Filenames and duration badges shown  
✅ Thumbnail placeholders for videos/audio  
✅ Image thumbnails displayed  
✅ Tile selection works (click)  
✅ Hover and selected states styled  
✅ Dark Neobrutalism theme applied  
✅ All tests pass  
✅ Ready for Phase 46 (Video Thumbnail Generation)

---
**Phase**: 51 | **Component**: Editor | **Group**: Media Library  
**Estimated Time**: 25 min

## Implementation Notes
- CSS Grid simplest for responsive layout
- Use blob URLs to display images directly
- Video/audio get placeholders for now (thumbnails in Phase 46)
- Single selection sufficient for basic use
- Keep rendering logic clean and modular
- Format duration helper function useful across project
