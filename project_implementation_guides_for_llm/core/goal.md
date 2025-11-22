# Core Player Component - Goal

## Component Overview
The core player is a reusable video playback component that provides consistent functionality across both the player and editor pages. Built with the **MediaBunny** library.

## Primary Objectives

### 1. Create Reusable Component
Build a modular, embeddable player that:
- Works in both player.html and editor.html
- Provides consistent UI and controls
- Supports mode-specific features
- Easy to integrate and configure

### 2. Implement Advanced Playback
Deliver professional-grade video controls:
- Standard controls (play, pause, seek, volume)
- Advanced features (speed, fullscreen, PiP)
- Subtitle and audio track management
- Keyboard shortcut system

### 3. Support Two Modes

**Player Mode:**
- Previous/Next video navigation
- Playlist integration hooks
- Auto-advance functionality
- Simplified control layout

**Editor Mode:**
- Frame-by-frame navigation
- Timeline markers
- Region selection for trimming
- Precise timestamp display
- Export controls

## Key Deliverables

### Component Files
- `core-player/core-player.html` - Component markup
- `core-player/core-player.js` - Initialization & MediaBunny integration
- `core-player/core-player.css` - Neobrutalism themed styles

### Utility Modules
- `core-player/utils/mediabunny-config.js` - MediaBunny configuration
- `core-player/utils/player-events.js` - Event handling layer
- `core-player/utils/keyboard-shortcuts.js` - Keyboard control mapping

## Core Features

### Standard Controls
- ✅ Play/Pause toggle
- ✅ Progress bar with seek
- ✅ Volume control (0-100%)
- ✅ Playback speed (0.25x - 2x)
- ✅ Fullscreen mode
- ✅ Picture-in-Picture

### Media Management
- ✅ Subtitle support (VTT, SRT)
- ✅ Audio track switching
- ✅ Quality switching
- ✅ Format support (MP4, WebM, MOV)

### User Experience
- ✅ Comprehensive keyboard shortcuts
- ✅ Thumbnail preview on timeline hover
- ✅ Buffering indicators
- ✅ Error handling with user-friendly messages

## MediaBunny Integration

The core player wraps MediaBunny with:
- Custom UI matching neobrutalism theme
- Simplified API for parent pages
- Mode-specific feature toggling
- Event bridging system

**See**: `mediabunny-llms-full.md` for complete API documentation

## Keyboard Shortcuts

### Universal
- Space/K - Play/Pause
- J/L - Skip backward/forward 10s
- Arrows - Skip 5s, Volume adjust
- M - Mute, F - Fullscreen, C - Subtitles
- Numbers - Jump to percentages

### Editor Mode Only
- Comma/Period - Previous/next frame
- I/O - Set in/out points

## Success Criteria
- ✅ Works seamlessly in both player and editor contexts
- ✅ All MediaBunny features accessible
- ✅ Keyboard navigation complete
- ✅ Consistent with neobrutalism theme
- ✅ Responsive across device sizes
- ✅ Accessible (WCAG AA)

## Integration Points
- **Used by**: [`player/`](../player/goal.md), [`editor/`](../editor/goal.md)
- **Depends on**: [`theme/`](../theme/goal.md), MediaBunny library
- **Phase**: Phase 0.5 (After theme, before player)
- **Implementation**: See [`phase0.md`](phase0.md)

## References
- [MediaBunny Documentation](../mediabunny-llms-full.md)
- [HTML5 Video API](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement)
- [Keyboard Event Handling](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent)

---

**Phase**: 0.5 (Core Component)  
**Dependencies**: theme, MediaBunny  
**Last Updated**: 2025-11-22
