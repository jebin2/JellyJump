# Phase 13: Core Modes

## Goal
Configure component for player mode vs editor mode with mode-specific features.

## Features to Implement

### Feature 1: Mode Configuration System
**Purpose**: Define two distinct operational modes for the player

**Requirements**:
- Player mode: Optimized for video consumption
- Editor mode: Optimized for editing workflow
- Pass mode as initialization parameter (default: 'player')
- Store current mode in component state

### Feature 2: Player Mode Features
**Purpose**: Features enabled when in player mode

**Requirements**:
- Show previous/next video navigation for playlists
- Use simplified timeline without frame markers
- Enable standard keyboard shortcuts only
- Hide editor-specific UI elements
- Focus on smooth playback experience
- Optimize for video watching use case

### Feature 3: Editor Mode Features
**Purpose**: Features enabled when in editor mode

**Requirements**:
- Enable frame-by-frame navigation (comma/period keys)
- Show in/out point markers on timeline
- Display precise timestamps including frame numbers
- Enable editor keyboard shortcuts (I/O for markers)
- Hide playlist navigation (focus on single video)
- Show additional editing controls

### Feature 4: Mode Detection & Application
**Purpose**: Determine and apply the correct mode

**Requirements**:
- Check for mode parameter during initialization
- Default to 'player' mode if not specified
- Apply mode-specific configuration immediately
- Update UI based on mode
- Disable features not relevant to current mode

### Feature 5: Feature Toggling
**Purpose**: Show/hide UI elements based on mode

**Requirements**:
- Hide prev/next buttons in editor mode
- Show marker controls only in editor mode
- Adjust keyboard event handler for current mode
- Update help overlay to show mode-appropriate shortcuts
- Apply different styles if needed per mode

## Testing Checklist
- [ ] Player mode loads correctly by default
- [ ] Editor mode loads when configured
- [ ] Editor-specific controls visible only in editor mode
- [ ] Player-specific controls visible only in player mode
- [ ] Keyboard shortcuts adapt to mode

## Done When
✅ Both modes function correctly  
✅ UI adapts to selected mode  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 13 | **Component**: Core
**Estimated Time**: 20-40 minutes
