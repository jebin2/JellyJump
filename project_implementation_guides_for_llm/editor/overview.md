# Editor Page - Implementation Overview

## Global Phase Numbers: 26-32

### [Phase 26: Editor Layout](phase26-editor-layout.md)
- Three-section layout with preview,timeline, library
- **Done when**: Layout renders, core player in editor mode

### [Phase 27: Editor Timeline](phase27-editor-timeline.md)
- Timeline UI with tracks and playhead
- **Done when**: Timeline displays, playhead moves, zoom works

### [Phase 28: Editor Editing](phase28-editor-editing.md)
- Trim, cut, split, arrange operations
- **Done when**: Basic editing ops work with undo/redo

### [Phase 29: Editor Effects](phase29-editor-effects.md)
- Transitions, filters, text overlays
- **Done when**: Can add transitions and effects

### [Phase 30: Editor Export](phase30-editor-export.md)
- MediaBunny Conversion API for video export
- **Done when**: Can export to MP4/WebM using MediaBunny

### [Phase 31: Editor Project](phase31-editor-project.md)
- Save/load editing projects
- **Done when**: Projects persist, auto-save works

### [Phase 32: Editor Polish](phase32-editor-polish.md)
- Performance optimization, keyboard shortcuts, UX
- **Done when**: Editor production ready

## Implementation Order
```
Phase 26 → 27 → 28 → 29 → 30 → 31 → 32
(Layout) (Timeline) (Edit) (Effects) (Export) (Project) (Polish)
```

## MediaBunny Integration
The editor page uses MediaBunny for ALL video processing (NO FFmpeg.wasm). **Consult mediabunny-llms-full.md** for:

- **Timeline generation**: EncodedPacketSink for packet markers, VideoSampleSink for thumbnails
- **Trimming/Editing**: Conversion API with `trim: { start, end }` option
- **Effects processing**: `video.process` callback for frame-by-frame manipulation
- **Export/Rendering**: Output with Mp4OutputFormat, WebMOutputFormat
- **Progress tracking**: conversion.onProgress for export feedback
- **Quality control**: Video encoding config, bitrate, subjective qualities

**Dependencies**: Phases 01-04 (Theme), 09-14 (Core)  
**Global Phases**: 26-32 | **Time**: 6-8 hours
