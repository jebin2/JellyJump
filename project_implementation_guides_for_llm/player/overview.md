# Player Page - Implementation Overview

## Global Phase Numbers: 15-20

### [Phase 15: Player Layout](phase15-player-layout.md)
- 70/30 split layout, core player integration
- **Done when**: Layout works, core player embedded

### [Phase 16: Player Playlist](phase16-player-playlist.md)
- Playlist UI with video items
- **Done when**: Playlist displays videos, click plays

### [Phase 17: Player Upload](phase17-player-upload.md)
- File upload and drag-and-drop
- **Done when**: Can upload files via both methods

### [Phase 18: Player Management](phase18-player-management.md)
- Playlist operations (play, reorder, remove, navigate)
- **Done when**: Full playlist management works

### [Phase 19: Player Persistence](phase19-player-persistence.md)
- IndexedDB save/load
- **Done when**: Playlist persists across sessions

### [Phase 20: Player Polish](phase20-player-polish.md)
- Responsive, accessible, performant
- **Done when**: Works on all devices, handles 100+ videos

## Implementation Order
```
Phase 15 → 16 → 17 → 18 → 19 → 20
(Layout) (Playlist) (Upload) (Manage) (Save) (Polish)
```

## MediaBunny Integration
The player page uses MediaBunny for file handling and metadata. **Consult mediabunny-llms-full.md** for:

- **File upload**: Input with BlobSource for local files
- **Metadata extraction**: Duration, format, tracks, dimensions
- **Thumbnail generation**: CanvasSink for playlist thumbnails
- **Format validation**: getFormat() for file type checking
- **Resource management**: Proper cleanup when removing playlist items

**Dependencies**: Phases 01-04 (Theme), 09-14 (Core)  
**Global Phases**: 15-20 | **Time**: 3-4 hours
