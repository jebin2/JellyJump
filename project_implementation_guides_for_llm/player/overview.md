## Global Phase Numbers: 15-31

### [Phase 15: Player Layout](phase15-player-layout.md)
- 80/20 split layout, core player integration
- **Done when**: Layout works, core player embedded

### [Phase 16: Collapsible Sidebar](phase16-collapsible-sidebar.md)
- Collapse/expand playlist sidebar with smooth transitions
- **Done when**: Sidebar can be collapsed and expanded, state persists

### [Phase 17: Control Bar Mode Toggle](phase17-control-bar-mode.md)
- Toggle between overlay and fixed control bar modes
- **Done when**: Both modes work, mode persists across sessions

### [Phase 18: Optional Control Components](phase18-optional-controls.md)
- Configurable control bar with optional components
- **Done when**: Controls can be shown/hidden via configuration

### [Phase 19: Default Frame Display](phase19-default-frame.md)
- Display 50th percentile frame or last paused frame on load
- **Done when**: Frame displays before playback, state persists

### [Phase 20: URL Upload Feature](phase20-url-upload.md)
- Upload videos from remote URLs
- **Done when**: URL upload works with modal, errors handled

### [Phase 21: Single File Auto-Load](phase21-single-file-autoload.md)
- Auto-load single uploaded files/URLs into player
- **Done when**: Single files auto-load, multiple files don't

### [Phase 22: Player Playlist](phase22-player-playlist.md)
- Playlist UI with video items
- **Done when**: Playlist displays videos, click plays

### [Phase 23: Player Frame Capture](phase23-player-capture.md)
- Screenshot feature with preview and download
- **Done when**: Can capture and download frames

### [Phase 24: Player Navigation](phase24-player-navigation.md)
- Next/Previous video controls in controller
- **Done when**: Navigation buttons work with playlist

### [Phase 25: Player Download](phase25-player-download.md)
- Download videos from playlist
- **Done when**: Download button works in playlist

### [Phase 26: Player Speed](phase26-player-speed.md)
- Playback speed control (0.25x-2x)
- **Done when**: Speed selector works

### [Phase 27: Player A-B Loop](phase27-player-loop.md)
- Loop section with A-B markers
- **Done when**: A-B loop and full loop work

### [Phase 28: Player Upload](phase28-player-upload.md)
- File upload and drag-and-drop
- **Done when**: Can upload files via both methods

### [Phase 29: Player Management](phase29-player-management.md)
- Playlist operations (play, reorder, remove, navigate)
- **Done when**: Full playlist management works

### [Phase 30: Player Persistence](phase30-player-persistence.md)
- localStorage/IndexedDB save/load
- **Done when**: Playlist persists across sessions

### [Phase 31: Player Polish](phase31-player-polish.md)
- Responsive, accessible, performant
- **Done when**: Works on all devices, handles 100+ videos

## Implementation Order
```
Phase 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25 → 26 → 27 → 28 → 29 → 30 → 31
(Layout) (Collapse) (ControlMode) (OptionalControls) (DefaultFrame) (URLUpload) (AutoLoad) (Playlist) (Capture) (Nav) (Download) (Speed) (Loop) (Upload) (Manage) (Save) (Polish)
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
**Global Phases**: 15-31 | **Time**: ~8-9 hours
