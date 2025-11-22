# Editor Page - Goal

## Component Overview
The editor page provides a timeline-based video editing interface for trimming, cutting, adding effects, and exporting videos in the browser.

## Primary Objectives

### 1. Enable Video Editing
Provide essential editing capabilities:
- Trim and cut video clips
- Merge multiple videos
- Add transitions between clips
- Apply effects and filters
- Add text overlays

### 2. Build Timeline Interface
Create an intuitive editing workflow:
- Visual timeline representation
- Drag-and-drop clip arrangement
- Precise frame-by-frame control
- Region selection and markers
- Multi-track support (video/audio)

### 3. Support Export Workflow
Deliver professional output:
- Multiple format support (MP4, WebM)
- Quality/resolution options
- Progress indicators
- Client-side rendering (FFmpeg.wasm)

## Key Deliverables

### HTML Page
- `editor.html` - Video editing interface

### JavaScript Modules
- `assets/js/timeline.js` - Timeline component
- `assets/js/export-handler.js` - Export and rendering
- Effects and transitions library

### Layout Structure
**Three-Section Design:**
1. **Top**: Preview player (core player in editor mode)
2. **Middle**: Editing controls and effects panel
3. **Bottom**: Timeline with tracks and playhead

## Core Features

### Editing Operations
- ✅ Trim video (set in/out points)
- ✅ Cut and split clips
- ✅ Merge multiple videos
- ✅ Rearrange clip order
- ✅ Delete segments

### Effects & Enhancements
- ✅ Transitions (fade, wipe, dissolve)
- ✅ Filters (brightness, contrast, saturation)
- ✅ Text overlays
- ✅ Speed adjustment (slow-mo, timelapse)
- ✅ Audio editing (volume, fade)

### Timeline Features
- ✅ Visual waveform display
- ✅ Frame-by-frame navigation
- ✅ Zoom in/out timeline
- ✅ Snap to grid
- ✅ Markers and labels
- ✅ Multi-track layout

### Export Options
- ✅ Format selection (MP4, WebM)
- ✅ Resolution options (720p, 1080p, 4K)
- ✅ Quality presets (low, medium, high)
- ✅ Codec selection
- ✅ Progress tracking
- ✅ Download rendered file

## Technology Stack

### Video Processing
- **MediaBunny** - ALL video operations (reading, processing, conversion, export)
- **Canvas API** - Frame manipulation for effects
- **Web Audio API** - Audio editing (if needed)

**Important**: This project uses MediaBunny for video processing, NOT FFmpeg.wasm. **Consult mediabunny-llms-full.md** for all video operations.

### Performance
- Web Workers for processing (optional optimization)
- Efficient canvas rendering for effects
- Progress feedback via MediaBunny conversion.onProgress
- Memory management for large files

## Editor Mode Integration
Uses core player component in "editor mode":
- Frame-by-frame navigation (comma/period keys)
- Marker support (I/O for in/out points)
- Precise timestamp display
- Timeline synchronization

## Responsive Behavior
- **Desktop (1024px+)**: Full three-section layout
- **Tablet (768-1023px)**: Collapsible panels, simplified timeline
- **Mobile (<768px)**: Vertical stack, drawer-based controls

## Success Criteria
- ✅ Smooth preview playback
- ✅ Responsive timeline interactions
- ✅ Successful video export
- ✅ No browser crashes with large files
- ✅ Intuitive editing workflow
- ✅ Professional output quality

## Integration Points
- **Uses**: [`core/`](../core/goal.md) - Core player component (editor mode)
- **Depends on**: [`theme/`](../theme/goal.md) - Design system
- **Linked from**: [`dashboard/`](../dashboard/goal.md) - Landing page
- **Phase**: Phase 2 (After player)
- **Implementation**: See [`phase2.md`](phase2.md)

## Keyboard Shortcuts
Inherits all from core player (editor mode), plus:
- Ctrl/Cmd + Z - Undo
- Ctrl/Cmd + Y - Redo
- Ctrl/Cmd + S - Save project
- Ctrl/Cmd + E - Export video
- Delete - Delete selected clip
- Space - Play/Pause preview

## Performance Targets
- Timeline scrubbing: 60fps
- Effect preview: Real-time or near real-time
- Export progress: Visible feedback
- Memory usage: < 2GB for 1080p video

## References
- **[MediaBunny Documentation](../mediabunny-llms-full.md)** - Core video library (primary reference)
- [Canvas API](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)

---

**Phase**: 2 (Editor Page)  \n**Dependencies**: theme, core player, **MediaBunny**  
**Last Updated**: 2025-11-22
