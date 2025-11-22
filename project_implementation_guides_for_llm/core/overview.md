# Core Player Component - Implementation Overview

## What This Component Delivers
A reusable video player component with MediaBunny integration, used by both player.html and editor.html.

## Global Phase Numbers: 09-14

### [Phase 09: Core Setup](phase09-core-setup.md)
**Goal**: Install and configure MediaBunny library

**Deliverables**:
- MediaBunny library imported
- Configuration file created
- Test video playback working

**Done when**: MediaBunny initialized, test video plays

---

### [Phase 10: Core Structure](phase10-core-structure.md)
**Goal**: Build HTML structure and implement basic controls

**Deliverables**:
- Component markup, JS, CSS files
- Play, pause, seek, volume controls working

**Done when**: Can play/pause, seek, adjust volume

---

### [Phase 11: Core Media](phase11-core-media.md)
**Goal**: Add subtitle support and audio/quality track switching

**Deliverables**:
- Subtitle loading and display
- Audio track switcher
- Quality selector

**Done when**: Subtitles work, can switch audio tracks

---

### [Phase 12: Core Keyboard](phase12-core-keyboard.md)
**Goal**: Implement comprehensive keyboard control system

**Deliverables**:
- Universal keyboard shortcuts
- Editor mode shortcuts
- Keyboard help overlay

**Done when**: All shortcuts work correctly

---

### [Phase 13: Core Modes](phase13-core-modes.md)
**Goal**: Configure component for player vs editor modes

**Deliverables**:
- Mode detection and configuration
- Player mode features
- Editor mode features

**Done when**: Component works in both modes

---

### [Phase 14: Core Polish](phase14-core-polish.md)
**Goal**: Apply theme, responsive design, accessibility

**Deliverables**:
- Neobrutalism theme applied
- Responsive design
- ARIA labels and keyboard nav
- Performance optimized

**Done when**: Component ready for integration

---

## Implementation Order

```
Phase 09 → 10 → 11 → 12 → 13 → 14
(Setup) (Controls) (Media) (Keyboard) (Modes) (Polish)
```

## Quick Start

Follow global phases 09-14 in order:
- Phase 09: [phase09-core-setup.md](phase09-core-setup.md)
- Phase 10: [phase10-core-structure.md](phase10-core-structure.md)
- Phase 11: [phase11-core-media.md](phase11-core-media.md)
- Phase 12: [phase12-core-keyboard.md](phase12-core-keyboard.md)
- Phase 13: [phase13-core-modes.md](phase13-core-modes.md)
- Phase 14: [phase14-core-polish.md](phase14-core-polish.md)

## Dependencies
- **Phases 01-04** (Theme must be complete)
- **MediaBunny library** - **Consult** `mediabunny-llms-full.md` for complete API documentation

## MediaBunny APIs Used
The core player component uses these MediaBunny features. **Refer to mediabunny-llms-full.md** for implementation details:

- **Reading media files**: Input, BlobSource, format detection
- **Playback control**: Play/pause, seek, volume, timestamps
- **Track management**: Audio tracks, subtitle tracks, quality selection
- **Media sinks**: VideoSampleSink (editor mode), CanvasSink (thumbnails)
- **Metadata**: Duration, dimensions, codec, language
- **Resource cleanup**: Closing inputs, sinks, decoders

## Used By
- Player page (phases 15-20)
- Editor page (phases 21-27)

---

**Global Phases**: 09-14  
**Estimated Time**: 3-4 hours  
**Complexity**: Medium-High
