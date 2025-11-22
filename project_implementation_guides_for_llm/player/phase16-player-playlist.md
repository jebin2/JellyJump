# Phase 16: Player Playlist

## Goal
Render playlist items with metadata extracted using MediaBunny

**MediaBunny Integration**: Playlist items should display metadata from MediaBunny Input objects. **Consult** mediabunny-llms-full.md for:
- Reading file metadata (duration, dimensions, format)
- Track information extraction
- Thumbnail generation using CanvasSinkhumbnails, titles, and durations.

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

### Feature 2: Active Video Indicator
**Purpose**: Highlight currently playing video

**Requirements**:
- Different background color for active item
- Left border accent (theme primary color)
- Bold text or icon indicating "Now Playing"
- Scroll to active item when changed

### Feature 3: Scrollable List
**Purpose**: Handle many videos efficiently

**Requirements**:
- Vertical scrolling for overflow
- Smooth scroll behavior
- Show scrollbar when needed
- Empty state message when no videos
- Maintain scroll position when adding videos

### Feature 4: Item Interactions
**Purpose**: Click and hover behaviors

**Requirements**:
- Hover: Change background color
- Click: Load and play that video
- Visual feedback on click
- Cursor changes to pointer on hover
- Support keyboard navigation (arrow keys)

## Testing Checklist
- [ ] Playlist items display correct info
- [ ] Active item is highlighted
- [ ] Scrolling works for long lists
- [ ] Hover/Click effects work
- [ ] Empty state displays correctly

## Done When
✅ Playlist UI implemented  
✅ Items display correctly  
✅ Interaction states work  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 16 | **Component**: Player
**Estimated Time**: 30-50 minutes
