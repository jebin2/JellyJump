# MediaBunnyPlayer - Implementation Guide (v4.0)

## Overview
**32 sequential phases** for implementing MediaBunnyPlayer from start to finish.

## Global Phase Order

### Phase 01-04: Theme Foundation 🎨
**Goal**: Create Dark Neobrutalism design system

- **[Phase 01](theme/phase01-theme-setup.md)** - CSS file setup & fonts (20 min)
- **[Phase 02](theme/phase02-theme-tokens.md)** - Design variables (30 min)
- **[Phase 03](theme/phase03-theme-components.md)** - UI components (40 min)
- **[Phase 04](theme/phase04-theme-polish.md)** - Responsive & accessibility (30 min)

**Time**: ~2 hours | **Done**: Theme system complete

---

### Phase 05-08: Dashboard (Landing Page) 🏠
**Goal**: Create entry point and feature showcase

- **[Phase 05](dashboard/phase05-dashboard-structure.md)** - HTML layout (20 min)
- **[Phase 06](dashboard/phase06-dashboard-hero.md)** - Hero section & CTAs (20 min)
- **[Phase 07](dashboard/phase07-dashboard-features.md)** - Feature cards (30 min)
- **[Phase 08](dashboard/phase08-dashboard-polish.md)** - SEO & responsive (20 min)

**Time**: ~1.5 hours | **Done**: index.html complete

---

### Phase 09-14: Core Player Component 🎬
**Goal**: Build reusable video player

- **[Phase 09](core/phase09-core-setup.md)** - MediaBunny integration (30 min)
- **[Phase 10](core/phase10-core-structure.md)** - Basic controls (50 min)
- **[Phase 11](core/phase11-core-media.md)** - Subtitles & audio tracks (30 min)
- **[Phase 12](core/phase12-core-keyboard.md)** - Keyboard shortcuts (30 min)
- **[Phase 13](core/phase13-core-modes.md)** - Player vs Editor modes (20 min)
- **[Phase 14](core/phase14-core-polish.md)** - Theme & accessibility (30 min)

**Time**: ~3 hours | **Done**: Core player complete, usable in player & editor

---

### Phase 15-25: Player Page ▶️
**Goal**: Video player with advanced features and playlist management

- **[Phase 15](player/phase15-player-layout.md)** - 70/30 layout (20 min)
- **[Phase 16](player/phase16-player-playlist.md)** - Playlist UI (30 min)
- **[Phase 17](player/phase17-player-capture.md)** - Frame screenshot (40 min)
- **[Phase 18](player/phase18-player-navigation.md)** - Next/Previous controls (30 min)
- **[Phase 19](player/phase19-player-download.md)** - Video download (30 min)
- **[Phase 20](player/phase20-player-speed.md)** - Playback speed (35 min)
- **[Phase 21](player/phase21-player-loop.md)** - A-B loop (45 min)
- **[Phase 22](player/phase22-player-upload.md)** - File upload & drag-drop (40 min)
- **[Phase 23](player/phase23-player-management.md)** - Playlist operations (40 min)
- **[Phase 24](player/phase24-player-persistence.md)** - IndexedDB save/load (30 min)
- **[Phase 25](player/phase25-player-polish.md)** - Responsive & performance (30 min)

**Time**: ~6 hours | **Done**: player.html complete

---

### Phase 26-32: Editor Page ✂️
**Goal**: Timeline-based video editor

- **[Phase 26](editor/phase26-editor-layout.md)** - Three-section layout (30 min)
- **[Phase 27](editor/phase27-editor-timeline.md)** - Timeline UI (60 min)
- **[Phase 28](editor/phase28-editor-editing.md)** - Trim, cut, arrange (60 min)
- **[Phase 29](editor/phase29-editor-effects.md)** - Transitions & effects (50 min)
- **[Phase 30](editor/phase30-editor-export.md)** - MediaBunny export (60 min)
- **[Phase 31](editor/phase31-editor-project.md)** - Save/load projects (40 min)
- **[Phase 32](editor/phase32-editor-polish.md)** - Performance & UX (40 min)

**Time**: ~6 hours | **Done**: editor.html complete

---

## Quick Start

**To implement the entire project, follow phases 01-32 in order:**

```bash
# Phase 01-04: Theme (Foundation)
Implement phase01-theme-setup.md
Implement phase02-theme-tokens.md
Implement phase03-theme-components.md
Implement phase04-theme-polish.md

# Phase 05-08: Dashboard
Implement phase05-dashboard-structure.md
Implement phase06-dashboard-hero.md
Implement phase07-dashboard-features.md
Implement phase08-dashboard-polish.md

# Phase 09-14: Core Player
Implement phase09-core-setup.md
Implement phase10-core-structure.md
Implement phase11-core-media.md
Implement phase12-core-keyboard.md
Implement phase13-core-modes.md
Implement phase14-core-polish.md

# Phase 15-25: Player Page (with new features)
Implement phase15-player-layout.md
... continue through phase25

# Phase 26-32: Editor Page
Implement phase26-editor-layout.md
... continue through phase32
```

## Dependencies

```
Phases 01-04 (Theme)
   ↓
├─ Phases 05-08 (Dashboard) ─┐
├─ Phases 09-14 (Core) ──────┼─→ Phases 15-25 (Player w/ Advanced Features)
│                             └─→ Phases 26-32 (Editor)
```

## File Structure

```
project_guides_for_llm/
├── README.md                    # This file
├── main.md                      # Project overview
│
├── theme/
│   ├── goal.md                  # Component objectives
│   ├── overview.md              # Phase roadmap
│   ├── phase01-theme-setup.md
│   ├── phase02-theme-tokens.md
│   ├── phase03-theme-components.md
│   └── phase04-theme-polish.md
│
├── dashboard/
│   ├── goal.md
│   ├── overview.md
│   ├── phase05-dashboard-structure.md
│   ├── phase06-dashboard-hero.md
│   ├── phase07-dashboard-features.md
│   └── phase08-dashboard-polish.md
│
├── core/
│   ├── goal.md
│   ├── overview.md
│   ├── phase09-core-setup.md
│   ├── phase10-core-structure.md
│   ├── phase11-core-media.md
│   ├── phase12-core-keyboard.md
│   ├── phase13-core-modes.md
│   └── phase14-core-polish.md
│
├── player/
│   ├── goal.md
│   ├── overview.md
│   ├── phase15-player-layout.md
│   ├── phase16-player-playlist.md
│   ├── phase17-player-capture.md
│   ├── phase18-player-navigation.md
│   ├── phase19-player-download.md
│   ├── phase20-player-speed.md
│   ├── phase21-player-loop.md
│   ├── phase22-player-upload.md
│   ├── phase23-player-management.md
│   ├── phase24-player-persistence.md
│   └── phase25-player-polish.md
│
└── editor/
    ├── goal.md
    ├── overview.md
    ├── phase26-editor-layout.md
    ├── phase27-editor-timeline.md
    ├── phase28-editor-editing.md
    ├── phase29-editor-effects.md
    ├── phase30-editor-export.md
    ├── phase31-editor-project.md
    └── phase32-editor-polish.md
```

## How to Use

### For LLM Implementation

**Simple command: "Implement phaseXX"** where XX is 01-32.

Example:
- "Implement phase01" → Create CSS file and set up fonts
- "Implement phase17" → Frame screenshot feature
- "Implement phase32" → Final editor polish

Each phase file contains:
- Goal statement
- Prerequisites
- Step-by-step approach
- Testing criteria
- "Done when" checklist

### Component Details

For more context on each component:
- Read `goal.md` for high-level objectives
- Read `overview.md` for phase breakdown within that component

## Total Implementation Time

- **Theme**: 2 hours (phases 01-04)
- **Dashboard**: 1.5 hours (phases 05-08)
- **Core**: 3 hours (phases 09-14)
- **Player**: 6 hours (phases 15-25, with new features)
- **Editor**: 6 hours (phases 26-32)

**Total**: ~18.5 hours for complete implementation

## External References

- **MediaBunny Library**: See `mediabunny-llms-full.md` in this directory
- [MDN Web Docs](https://developer.mozilla.org/)
- [FFmpeg.wasm](https://ffmpegwasm.netlify.app/)
- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)

---

**Version**: 4.0.0 (32 Sequential Phases with Advanced Features)  
**Last Updated**: 2025-11-22  
**Total Phases**: 32 (sequentially numbered)  
**Status**: ✅ Ready for Implementation
