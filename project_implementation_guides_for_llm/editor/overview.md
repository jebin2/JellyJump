# Editor Page - Implementation Overview

## Global Phase Numbers: 21-27

### [Phase 21: Editor Layout](phase21-editor-layout.md)
- Three-section layout with preview, timeline, library
- **Done when**: Layout renders, core player in editor mode

### [Phase 22: Editor Timeline](phase22-editor-timeline.md)
- Timeline UI with tracks and playhead
- **Done when**: Timeline displays, playhead moves, zoom works

### [Phase 23: Editor Editing](phase23-editor-editing.md)
- Trim, cut, split, arrange operations
- **Done when**: Basic editing ops work with undo/redo

### [Phase 24: Editor Effects](phase24-editor-effects.md)
- Transitions, filters, text overlays
- **Done when**: Can add transitions and effects

### [Phase 25: Editor Export](phase25-editor-export.md)
- MediaBunny Conversion API for video export
- **Done when**: Can export to MP4/WebM using MediaBunny

### [Phase 26: Editor Project](phase26-editor-project.md)
- Save/load editing projects
- **Done when**: Projects persist, auto-save works

### [Phase 27: Editor Polish](phase27-editor-polish.md)
- Performance optimization, keyboard shortcuts, UX
- **Done when**: Editor production ready

## Implementation Order
```
Phase 21 → 22 → 23 → 24 → 25 → 26 → 27
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
**Global Phases**: 21-27 | **Time**: 6-8 hours
