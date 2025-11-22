# Player Page - Implementation Overview

## Global Phase Numbers: 15-25

### [Phase 15: Player Layout](phase15-player-layout.md)
- 70/30 split layout, core player integration
- **Done when**: Layout works, core player embedded

### [Phase 16: Player Playlist](phase16-player-playlist.md)
- Playlist UI with video items
- **Done when**: Playlist displays videos, click plays

### [Phase 17: Player Frame Capture](phase17-player-capture.md)
- Screenshot feature with preview and download
- **Done when**: Can capture and download frames

### [Phase 18: Player Navigation](phase18-player-navigation.md)
- Next/Previous video controls in controller
- **Done when**: Navigation buttons work with playlist

### [Phase 19: Player Download](phase19-player-download.md)
- Download videos from playlist
- **Done when**: Download button works in playlist

### [Phase 20: Player Speed](phase20-player-speed.md)
- Playback speed control (0.25x-2x)
- **Done when**: Speed selector works

### [Phase 21: Player A-B Loop](phase21-player-loop.md)
- Loop section with A-B markers
- **Done when**: A-B loop and full loop work

### [Phase 22: Player Upload](phase22-player-upload.md)
- File upload and drag-and-drop
- **Done when**: Can upload files via both methods

### [Phase 23: Player Management](phase23-player-management.md)
- Playlist operations (play, reorder, remove, navigate)
- **Done when**: Full playlist management works

### [Phase 24: Player Persistence](phase24-player-persistence.md)
- localStorage/IndexedDB save/load
- **Done when**: Playlist persists across sessions

### [Phase 25: Player Polish](phase25-player-polish.md)
- Responsive, accessible, performant
- **Done when**: Works on all devices, handles 100+ videos

## Implementation Order
```
Phase 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25
(Layout) (Playlist) (Capture) (Nav) (Download) (Speed) (Loop) (Upload) (Manage) (Save) (Polish)
```

## MediaBunny Integration
The player page uses MediaBunny for file handling and metadata. **Consult mediabunny-llms-full.md** for:

- **File upload**: Input with BlobSource for local files
- **Metadata extraction**: Duration, format, tracks, dimensions
- **Thumbnail generation**: CanvasSink for playlist thumbnails
- **Format validation**: getFormat() for file type checking
- **Resource management**: Proper cleanup when removing playlist items
- **Frame capture**: CanvasSink or VideoSampleSink for screenshots
- **Playback speed**: MediaBunny playback rate control

**Dependencies**: Phases 01-04 (Theme), 09-14 (Core)  
**Global Phases**: 15-25 | **Time**: ~6 hours
