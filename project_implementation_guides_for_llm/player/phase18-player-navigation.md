# Phase 18: Player Navigation Controls

## Goal
Add next/previous video buttons to controller for playlist navigation

## Features to Implement

### Feature 1: Navigation Buttons
**Purpose**: Quick video switching controls

**Requirements**:
- "Previous" button (⏮ or ◀◀) in control bar
- "Next" button (⏭ or ▶▶) in control bar
- Position logically with playback controls
- Apply theme button styling
- Clear icons/labels

### Feature 2: Previous Video Functionality
**Purpose**: Jump to previous video in playlist

**Requirements**:
- Click loads and plays previous playlist item
- Disabled/grayed when at first video
- Visual disabled state (reduce opacity)
- No action when clicked while disabled
- Reset playback position to start of previous video

### Feature 3: Next Video Functionality
**Purpose**: Jump to next video in playlist

**Requirements**:
- Click loads and plays next playlist item
- Disabled/grayed when at last video
- Visual disabled state (reduce opacity)
- No action when clicked while disabled
- Reset playback position to start of next video

### Feature 4: Playlist Integration
**Purpose**: Sync with playlist state

**Requirements**:
- Update button states when playlist changes
- Highlight currently playing item in playlist
- Navigate to clicked playlist item (from phase 16)
- Work seamlessly with auto-play next (from phase 18→23)

### Feature 5: Keyboard Shortcuts
**Purpose**: Quick navigation via keyboard

**Requirements**:
- **Shift + N**: Next video
- **Shift + P**: Previous video
- Document in keyboard shortcuts help
- Respect disabled states (no action at boundaries)

### Feature 6: Edge Case Handling
**Purpose**: Handle empty or single-item playlists

**Requirements**:
- Both buttons disabled if playlist empty
- Both buttons disabled if only 1 video
- Show tooltip explaining why disabled (optional)
- Handle playlist item removal gracefully

## Testing Checklist
- [ ] Previous button navigates to previous video
- [ ] Next button navigates to next video
- [ ] Buttons disabled appropriately at boundaries
- [ ] Keyboard shortcuts work (Shift+N, Shift+P)
- [ ] Button states update when playlist changes
- [ ] Works with empty/single-item playlists

## Done When
✅ Navigation buttons functional  
✅ Previous/Next logic correct  
✅ Keyboard shortcuts work  
✅ Edge cases handled  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 18 | **Component**: Player  
**Estimated Time**: 30-40 minutes
