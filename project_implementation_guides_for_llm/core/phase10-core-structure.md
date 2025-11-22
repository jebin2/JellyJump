# Phase 10: Core Structure & Controls

## Goal
Build HTML structure and implement basic playback controls (play, pause, seek, volume).

## Features to Implement

### Feature 1: Video Element & Container
**Purpose**: Core HTML structure for video display with MediaBunny

**Requirements**:
- **Consult**: mediabunny-llms-full.md for video element setup and display
- Create container div wrapping video and controls
- Proper aspect ratio handling (16:9 typical)
- Black background for video letterboxing
- Apply theme container styling
- **Reference**: MediaBunny player setup patterns in documentation

### Feature 2: Control Bar Layout
**Purpose**: Bottom control bar containing all player controls

**Requirements**:
- Horizontal flex layout at bottom of player
- Progress bar spanning full width at top of controls
- Left section: Play/pause button
- Center section: Time display (current/total)
- Right section: Volume control, fullscreen button
- Apply theme styling: borders, shadows, background color
- Fixed height (48-60px typical)

### Feature 3: Play/Pause Control
**Purpose**: Main playback toggle button using MediaBunny API

**Requirements**:
- Single button that changes appearance based on playback state
- Play icon (▶) displayed when video is paused
- Pause icon (⏸) displayed when video is playing
- **Consult**: mediabunny-llms-full.md for playback control methods
- Implement play/pause toggle using MediaBunny API
- Visual feedback on state change
- Keyboard support: Space and K key also toggle
- Apply theme button styling
- **Reference**: Media playback controls in mediabunny-llms-full.md

### Feature 4: Progress/Seek Bar
**Purpose**: Timeline scrubber for video navigation with MediaBunny

**Requirements**:
- Visual bar showing current playback position
- Fill indicator that grows as video plays
- **Consult**: mediabunny-llms-full.md for seeking and timestamp management
- Implement clickable seek using MediaBunny API
- Draggable for scrubbing through video
- Show percentage of video completed
- Update in real-time during playback (throttled to ~10fps)
- Responsive to container width changes
- **Reference**: Media sinks and seeking in mediabunny-llms-full.md

### Feature 5: Volume Control
**Purpose**: Audio level adjustment

**Requirements**:
- Volume slider (range 0-100%)
- Mute/unmute toggle button
- Volume icon that changes based on level (muted, low, medium, high)
- Persist volume setting across page reloads
- Keyboard support: Up/Down arrows to adjust volume
- Apply theme styling to slider

### Feature 6: Time Display
**Purpose**: Show current and total duration from MediaBunny

**Requirements**:
- **Consult**: mediabunny-llms-full.md for duration and timestamp retrieval
- Format times as MM:SS or H:MM:SS for longer videos
- Current time updates during playback using MediaBunny events
- Total duration displays after MediaBunny metadata loads
- Use monospace font for consistent alignment
- Apply theme secondary text color
- Separator between current and total (e.g., "2:30 / 5:45")
- **Reference**: Reading track metadata in mediabunny-llms-full.md

## Testing Checklist
- [ ] Video loads and displays correctly
- [ ] Play/Pause button toggles video and icon
- [ ] Progress bar updates and allows seeking
- [ ] Volume control adjusts audio and mutes
- [ ] Time display shows correct duration and updates
- [ ] Controls layout is responsive

## Done When
✅ Basic playback controls work  
✅ UI matches theme requirements  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 10 | **Component**: Core
**Estimated Time**: 30-50 minutes
