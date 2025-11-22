# Phase 28: Preview Canvas Panel

## Goal
Create center panel (50% width) with MediaBunny video preview and playback controls

**MediaBunny Integration**: This phase integrates the core player built in Phases 09-14. **Consult** mediabunny-llms-full.md for:
- Player initialization and configuration
- Video loading and playback
- Time/duration tracking
- Synchronization with timeline playhead

## Features to Implement

### Feature 1: Panel Structure
**Purpose**: Center panel container for video preview

**Requirements**:
- Container div with 50% width (center panel)
- Flexbox or grid layout positioning
- Responsive to window resize
- Apply Dark Neobrutalism theme styling
- Proper z-index for layering

### Feature 2: MediaBunny Player Integration
**Purpose**: Embed core video player from Phases 09-14

**Requirements**:
- Import/integrate core player component
- Video element for MediaBunny playback
- Initialize MediaBunny player instance
- Load video source from selected timeline clip
- Handle player events (play, pause, timeupdate, ended)
- **Reference**: Core player from Phases 09-14

### Feature 3: Video Canvas Display
**Purpose**: Display video preview at correct aspect ratio

**Requirements**:
- Video canvas that maintains aspect ratio
- Center video in available space
- Black letterboxing if needed
- Responsive to panel resize
- Display placeholder when no video loaded
- Loading state animation

### Feature 4: Resolution & FPS Display
**Purpose**: Show video metadata

**Requirements**:
- Display resolution (e.g., "1920x1080")
- Display FPS (e.g., "@ 30fps")
- Position below or above video canvas
- Update when new video loaded
- Small, unobtrusive text style
- Theme-consistent typography

### Feature 5: Time & Duration Display
**Purpose**: Show current playback position and total duration

**Requirements**:
- Display format: "00:00:05 / 00:00:30"
- Current time updates in real-time during playback
- Total duration from video metadata
- Positioned below video canvas in control bar
- Large, readable font
- Synchronized with timeline playhead

### Feature 6: Playback Controls
**Purpose**: Basic play/pause controls

**Requirements**:
- **[▶ Play]** button
- **[⏸ Pause]** button
- Toggle between play/pause states
- Keyboard shortcut: **Spacebar** for play/pause
- Button styling with Dark Neobrutalism theme
- **Note**: NO Previous/Next buttons (removed per requirements)
- Disabled state when no video loaded

### Feature 7: Full-Screen Toggle
**Purpose**: Expand video to full screen

**Requirements**:
- Full-screen button or keyboard shortcut (F key)
- Use browser Fullscreen API
- Exit full-screen with Esc key
- Restore UI state after exiting
- Show/hide controls in full-screen mode

### Feature 8: Timeline Synchronization
**Purpose**: Sync preview with timeline playhead

**Requirements**:
- **Bidirectional sync**:
  - When playhead moves → update preview current time
  - When preview plays → update playhead position
- Event emitters for time updates
- Handle seek operations from timeline
- Smooth synchronization without lag
- **Note**: Full synchronization completed in Phase 32 (Playhead)

## Testing Checklist
- [ ] Preview panel renders at 50% width (center)
- [ ] MediaBunny player initializes correctly
- [ ] Video loads and displays at correct aspect ratio
- [ ] Resolution and FPS display correctly
- [ ] Time/duration format shows "00:00:05 / 00:00:30"
- [ ] Play button starts video playback
- [ ] Pause button stops video playback
- [ ] Spacebar toggles play/pause
- [ ] Full-screen toggle works
- [ ] Time updates in real-time during playback
- [ ] Basic timeline sync works (completed in Phase 32)
- [ ] Theme styling applied consistently

## Done When
✅ Preview panel structure complete  
✅ MediaBunny player integrated  
✅ Video displays with correct aspect ratio  
✅ Resolution, FPS, time/duration display correctly  
✅ Play/pause controls functional  
✅ Full-screen toggle works  
✅ Basic timeline sync setup (completed in Phase 32)  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 28 | **Component**: Editor  
**Estimated Time**: 30-40 minutes
