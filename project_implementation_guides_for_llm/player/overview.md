## Global Phase Numbers: 15-41

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

### [Phase 32: Settings Menu](phase32-settings-menu.md)
- Settings icon and dropdown menu on playlist items
- **Done when**: Menu opens, closes, and positions correctly

### [Phase 33: Format Conversion](phase33-format-conversion.md)
- Convert videos to different formats (MP4, WebM, AVI, MOV)
- **Done when**: Conversion works with progress tracking

### [Phase 34: Download/Manage Video & Audio Tracks](phase34-download-video-audio.md)
- Modal with all video and audio tracks
- Download and add to playlist options per track
- **Done when**: Track management modal works, extraction and playlist options functional

### [Phase 35: Trim Video](phase35-trim-video.md)
- Trim videos by start/end time with timeline UI
- **Done when**: Trimming works, adds to playlist

### [Phase 36: Resize Video](phase36-resize-video.md)
- Resize videos with presets or custom dimensions
- **Done when**: Resizing works with aspect ratio handling

### [Phase 37: Video Information](phase37-video-info.md)
- Display detailed video metadata and properties
- **Done when**: Info modal shows all metadata correctly

### [Phase 38: Merge Videos](phase38-merge-videos.md)
- Concatenate consecutive playlist videos
- **Done when**: Merge works with resolution handling

### [Phase 39: Create GIF](phase39-create-gif.md)
- Create animated GIFs from video segments
- Time selection, settings, download, and playlist options
- **Done when**: GIF creation works with download and playlist options

### [Phase 40: Reverse Video](phase40-reverse-video.md)
- Reverse video playback with frame processing
- Progress tracking during reversal
- **Done when**: Video reversal works with automatic playlist addition

### [Phase 41: Remove Background](phase41-remove-background.md)
- Remove background colors using color picker
- Live preview with multiple color selection
- Transparent or custom background output
- **Done when**: Background removal works with live preview and playlist addition

## Implementation Order
```
Phase 15 → 16 → 17 → 18 → 19 → 20 → 21 → 22 → 23 → 24 → 25 → 26 → 27 → 28 → 29 → 30 → 31 → 32 → 33 → 34 → 35 → 36 → 37 → 38 → 39 → 40 → 41
(Layout) (Collapse) (ControlMode) (OptionalControls) (DefaultFrame) (URLUpload) (AutoLoad) (Playlist) (Capture) (Nav) (Download) (Speed) (Loop) (Upload) (Manage) (Save) (Polish) (Settings) (Convert) (Tracks) (Trim) (Resize) (Info) (Merge) (GIF) (Reverse) (RemoveBG)
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
**Global Phases**: 15-41 | **Time**: ~17-20 hours
