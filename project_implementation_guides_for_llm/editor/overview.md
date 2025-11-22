# Editor Page - Implementation Overview

## Global Phase Numbers: 26-32

### [Phase 26: Editor Layout](phase26-editor-layout.md)
- Multi-tab project management with browser-style tabs
- Three-panel layout: media library (20%), preview/canvas (50%), properties (30%)
- Enhanced preview controls with time/duration display
- **Done when**: Layout renders with multi-tab UI, core player integrated

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
- Multiple export options: video download, save to library, JSON export
- MediaBunny Conversion API for video rendering
- **Done when**: All three export options work, JSON includes project name

### [Phase 31: Editor Project](phase31-editor-project.md)
- JSON import/export for reusable templates
- Multi-tab persistence with localStorage
- Save/load editing projects with auto-save
- **Done when**: Import/export works, multi-tab persistence functional

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
**Global Phases**: 26-32 | **Time**: 6.5-8.5 hours
