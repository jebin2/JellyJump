# Phase 22: Player Playlist

## Goal
Render playlist items with metadata extracted using MediaBunny.

**MediaBunny Note**: Playlist items display metadata from MediaBunny Input objects. Consult `mediabunny-llms-full.md` for metadata extraction, duration formatting, and thumbnail generation.

---

## What to Build

Interactive playlist UI showing:
- Video items with thumbnails, titles, and durations
- Active video highlighting
- Clickable items for video switching
- Scrollable list for many videos
- Empty state messaging

---

## Features to Implement

### Feature 1: Playlist Item Component
**Purpose**: Display individual video in playlist

**Requirements**:
- Show thumbnail image (if available, placeholder if not)
- Display video title/filename
- Show duration in MM:SS format
- Visual layout: thumbnail left, info center, duration right
- Flex layout for responsive sizing
- Border between items
- Consistent spacing and alignment

### Feature 2: Active Video Indicator
**Purpose**: Highlight currently playing video

**Requirements**:
- Different background color for active item
- Left border accent (theme primary color, 4px)
- Bold text or "Now Playing"icon
- Scroll to active item when changed
- Clear visual distinction from inactive items

### Feature 3: Scrollable List
**Purpose**: Handle many videos efficiently

**Requirements**:
- Vertical scrolling for overflow
- Smooth scroll behavior
- Show scrollbar when needed (style according to theme)
- Empty state message when no videos: "Add videos to get started"
- Maintain scroll position when adding videos
- Performance: Handle 100+ videos smoothly

### Feature 4: Item Interactions
**Purpose**: Click and hover behaviors

**Requirements**:
- Hover: Change background color (subtle highlight)
- Click: Load and play that video
- Visual feedback on click (ripple or flash)
- Cursor changes to pointer on hover
- Support keyboard navigation (arrow keys, Enter to select)
- Focus visible on keyboard navigation

---

## Interaction Behavior

**User Flow 1: Browse Playlist**:
1. User scrolls through playlist
2. Items highlight on hover
3. Current playing video has active styling
4. Scroll position maintained

**User Flow 2: Select Video**:
1. User clicks playlist item
2. Item highlights briefly (active state)
3. Video loads in player
4. Playback starts automatically
5. Previous active item un-highlights
6. New item becomes active

**Keyboard Navigation**:
- **↑/↓**: Navigate playlist items
- **Enter**: Play selected item
- **Tab**: Move focus to next control

---

## Edge Cases

- Empty playlist: Show friendly message with call-to-action
- Single item: Clicking doesn't reload, stays playing
- Very long titles: Truncate with ellipsis (...)
- Missing thumbnail: Show placeholder icon or gradient
- Missing duration: Show "Unknown" or "--:--"
- Rapid clicking: Debounce to prevent multiple loads
- Item removed while playing: Auto-advance to next or stop

---

## Styling Requirements

**Theme**: Dark Neobrutalism
- Bold borders between items
- High contrast for readability
- Accent color for active state
- Hover states clearly visible

**Layout**:
- Fixed height per item (60-80px)
- Thumbnail: Square or 16:9, fixed size
- Title: One or two lines with ellipsis
- Duration: Right-aligned, monospace font

---

## Accessibility

- Playlist has role="list", items have role="listitem"
- Active item has aria-current="true"
- Each item has aria-label with video title and duration
- Keyboard focus visible
- Screen reader announces "Playing [title]" on selection

---

## What NOT to Do

- ❌ Don't load entire video metadata into DOM (lazy load)
- ❌ Don't reload currently playing video on re-click
- ❌ Don't block UI during playlist updates
- ❌ Don't forget empty states
- ❌ Don't make thumbnails too large (impacts performance)

---

## MediaBunny Integration

This phase requires MediaBunny for extracting video metadata.

**Consult `mediabunny-llms-full.md`** for:
- Reading file metadata (duration, dimensions, format)
- Track information extraction
- Thumbnail generation using CanvasSink or VideoSampleSink

**Suggested approach**: Extract metadata when video is added, cache in playlist data structure, use for UI rendering.

---

## Testing Checklist

- [ ] Playlist items display correct info (title, duration)
- [ ] Thumbnails load correctly
- [ ] Active item is highlighted
- [ ] Scrolling works for long lists
- [ ] Hover/Click effects work
- [ ] Empty state displays correctly
- [ ] Clicking item loads and plays video
- [ ] Keyboard navigation works (arrows, Enter)
- [ ] Screen reader announces items correctly
- [ ] Handles 50+ videos without lag

---

## Done When

✅ Playlist UI implemented  
✅ Items display correctly with metadata  
✅ Interaction states work (hover, active, click)  
✅ Keyboard navigation functional  
✅ MediaBunny metadata extraction working  
✅ All tests pass  
✅ Ready for next phase

---

**Phase**: 22 | **Component**: Player  
**Estimated Time**: 30-50 minutes
