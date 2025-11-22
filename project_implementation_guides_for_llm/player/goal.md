# Player Page - Goal

## Component Overview
The player page provides a dedicated video viewing experience with advanced playback controls and comprehensive playlist management.

## Primary Objectives

### 1. Deliver Premium Viewing Experience
Create a professional video player that:
- Provides smooth, responsive playback
- Supports multiple video formats
- Handles playlists seamlessly
- Offers advanced playback controls

### 2. Enable Playlist Management
Build a full-featured playlist system with:
- File upload (single, multiple, folder)
- Drag-and-drop file addition
- Reorder, remove, sort videos
- Auto-play and loop modes
- Persistent playlist storage

### 3. Optimize for Video Consumption
Focus on viewing experience:
- Minimal distractions
- Easy navigation between videos
- Keyboard shortcuts for efficiency
- Resume playback functionality

## Key Deliverables

### HTML Page
- `player.html` - Video player interface

### JavaScript Modules
- Playlist management logic
- File handling and upload
- Video navigation (next/prev)
- IndexedDB persistence

### Layout Structure
**70/30 Split Design:**
- **Left (70%)**: Video player + controls (core player component)
- **Right (30%)**: Scrollable playlist with management tools

## Core Features

### Video Playback
- All features from core player component
- Auto-advance to next video
- Resume from last position
- Previous/Next navigation

### Playlist Operations
- ✅ Upload single/multiple files
- ✅ Upload entire folders
- ✅ Drag-and-drop support
- ✅ Click to play
- ✅ Drag to reorder
- ✅ Remove videos
- ✅ Clear playlist
- ✅ Sort by name/duration/date
- ✅ Save/load playlists (IndexedDB)

### Playback Modes
- Sequential playback
- Auto-play next video
- Loop entire playlist
- Shuffle (optional)

## File Handling

### Supported Formats
- Video: MP4, WebM, MOV, AVI, MKV
- Subtitles: VTT, SRT
- Audio: MP3, M4A, AAC

### Technology
- File System Access API for file reading
- IndexedDB for playlist persistence
- MediaBunny for metadata extraction

## Responsive Behavior
- **Desktop (1024px+)**: 70/30 split, both visible
- **Tablet (768-1023px)**: 65/35 split or collapsible playlist
- **Mobile (<768px)**: Full video, playlist as drawer/modal

## Success Criteria
- ✅ Smooth video playback
- ✅ Seamless playlist navigation
- ✅ File upload works reliably
- ✅ Drag-and-drop functional
- ✅ Playlists persist across sessions
- ✅ Responsive on all devices
- ✅ Keyboard accessible

## Integration Points
- **Uses**: [`core/`](../core/goal.md) - Core player component
- **Depends on**: [`theme/`](../theme/goal.md) - Design system
- **Linked from**: [`dashboard/`](../dashboard/goal.md) - Landing page
- **Phase**: Phase 1 (After core player)
- **Implementation**: See [`phase1.md`](phase1.md)

## Keyboard Shortcuts
Inherits all from core player, plus:
- Shift + N - Next video
- Shift + P - Previous video
- Shift + A - Toggle auto-play
- Shift + L - Toggle loop
- Delete - Remove current video

## Performance Targets
- Playlist with 100+ videos: no lag
- Video switch time: < 500ms
- Thumbnail generation: lazy loaded
- Memory management for long sessions

## References
- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Drag and Drop API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)

---

**Phase**: 1 (Player Page)  
**Dependencies**: theme, core player  
**Last Updated**: 2025-11-22
