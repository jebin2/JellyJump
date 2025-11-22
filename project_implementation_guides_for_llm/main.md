# MediaBunny Player - Project Goal

## Project Overview
A comprehensive web-based video platform that enables users to play, edit, and manage video content with a unified, dark neobrutalism design aesthetic.

## Core Vision
Build a powerful, browser-based video platform with three distinct capabilities:
1. **Landing/Dashboard** - Feature showcase and navigation hub
2. **Video Playback** - Advanced player with playlist management
3. **Video Editing** - Timeline-based editing with effects and transitions

All powered by the **MediaBunny** library and unified by a bold **Dark Neobrutalism** theme.

## Phase-Based Implementation Strategy

This project is organized into **27 sequential phases**, grouped by component. Each component has its own folder containing:
- `goal.md` - Component objectives and requirements
- `overview.md` - Phase roadmap for that component
- `phaseNN-[name].md` - Detailed implementation guide for each step

### Implementation Phases

#### **Phases 01-04: Theme Foundation** 🎨
Build the Dark Neobrutalism design system.
- **Components**: [`theme/`](theme/) - CSS variables, typography, UI components

#### **Phases 05-08: Dashboard** 🏠
Create the landing page and entry point.
- **Components**: [`dashboard/`](dashboard/) - Hero section, feature showcase

#### **Phases 09-14: Core Player** 🎬
Build the reusable video player component.
- **Components**: [`core/`](core/) - MediaBunny integration, controls, keyboard support

#### **Phases 15-20: Player Page** ▶️
Build the dedicated video viewing interface.
- **Components**: [`player/`](player/) - Playlist management, upload, persistence

#### **Phases 21-27: Editor Page** ✂️
Implement the timeline-based video editing interface.
- **Components**: [`editor/`](editor/) - Timeline, trimming, effects, export

## Technology Stack

### Frontend
- **HTML5** - Semantic markup
- **CSS3** - Custom neobrutalism theme with Grid/Flexbox
- **JavaScript (ES6+)** - Vanilla JS (No NPM/Bundlers)
- **MediaBunny** - Core video library (via CDN)

### File Handling
- **File System Access API** - Local file management
- **IndexedDB** - Storing video metadata and playlists
- **Web Workers** - Video processing tasks

### Video Processing
- **FFmpeg.wasm** - Client-side video editing
- **Canvas API** - Video frame manipulation
- **Web Audio API** - Audio editing
- **MediaBunny** - Video playback, controls, metadata

## Success Metrics
- Page load time < 2 seconds
- Video playback smooth at 60fps
- Editor operations responsive < 100ms
- Support for common formats (MP4, WebM, MOV)
- Cross-browser compatibility > 95%

## Getting Started

To implement this project, follow the phases in order:

1. **Theme**: Phases 01-04
2. **Dashboard**: Phases 05-08
3. **Core**: Phases 09-14
4. **Player**: Phases 15-20
5. **Editor**: Phases 21-27

See [README.md](README.md) for the complete sequential list.

## References
- [MediaBunny Documentation](mediabunny-llms-full.md) - Core video library
- [HTML5 Video API](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement)
- [FFmpeg.wasm Documentation](https://ffmpegwasm.netlify.app/)
- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

---

**Last Updated**: 2025-11-22  
**Version**: 3.0.0