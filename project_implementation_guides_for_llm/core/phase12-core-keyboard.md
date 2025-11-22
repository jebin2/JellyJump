# Phase 12: Core Keyboard Shortcuts

## Goal
Implement comprehensive keyboard control system integrated with MediaBunny playback controls

**MediaBunny Integration**: All keyboard shortcuts should use MediaBunny's playback API methods for play/pause, seek, volume control, etc. **Consult** mediabunny-llms-full.md for appropriate control methods..

## Features to Implement

### Feature 1: Universal Playback Shortcuts
**Purpose**: Standard video player keyboard controls

**Requirements**:
- Space or K: Toggle play/pause
- J: Rewind 10 seconds
- L: Fast-forward 10 seconds
- Left arrow: Rewind 5 seconds
- Right arrow: Fast-forward 5 seconds
- 0-9 number keys: Jump to percentage (0=start, 5=50%, 9=90%)
- Home: Jump to video start
- End: Jump to video end

### Feature 2: Audio Control Shortcuts
**Purpose**: Volume and muting keyboard controls

**Requirements**:
- Up arrow: Increase volume by 10%
- Down arrow: Decrease volume by 10%
- M: Toggle mute/unmute
- Clamp volume between 0-100%

### Feature 3: Display Control Shortcuts
**Purpose**: UI and display keyboard controls

**Requirements**:
- F: Toggle fullscreen mode
- C: Toggle subtitles/captions on/off
- Escape: Exit fullscreen mode

### Feature 4: Editor Mode Shortcuts
**Purpose**: Frame-by-frame navigation (editor mode only)

**Requirements**:
- Comma (,): Step back one frame
- Period (.): Step forward one frame
- I: Set in-point marker
- O: Set out-point marker
- Only active when component is in editor mode

### Feature 5: Keyboard Event Handler
**Purpose**: Central keyboard input management system

**Requirements**:
- Listen for keydown events globally or on player container
- Ignore shortcuts when user is typing in input/textarea fields
- Prevent default browser behavior for handled keys
- Mode-aware: enable/disable editor shortcuts based on mode
- Allow shortcuts to be disabled globally if needed

### Feature 6: Keyboard Help Overlay (Optional)
**Purpose**: Reference guide for available shortcuts

**Requirements**:
- '?' key shows help overlay
- List all available shortcuts organized by category
- Show current mode shortcuts (player vs editor)
- Dismiss with Escape key or click outside
- Apply theme styling (card/modal style)

## Testing Checklist
- [ ] Playback shortcuts work (Space, K, J, L, Arrows)
- [ ] Volume shortcuts work (Up, Down, M)
- [ ] Fullscreen toggle works (F, Esc)
- [ ] Editor shortcuts work only in editor mode
- [ ] Inputs are not blocked by shortcuts
- [ ] Help overlay displays correct keys

## Done When
✅ All keyboard shortcuts functional  
✅ Context-aware handling works  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 12 | **Component**: Core
**Estimated Time**: 30-50 minutes
