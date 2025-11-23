# Phase 23: Player Management

## Goal
Implement remove, clear, and auto-play features with proper MediaBunny resource management

**MediaBunny Integration**: When removing playlist items or clearing the playlist, properly cleanup MediaBunny resources. **Consult** mediabunny-llms-full.md for:
- Closing Input objects when no longer needed
- Proper decoder/sink cleanup
- Switching between MediaBunny inputs for playlist navigationo on click, remove videos, next/previous navigation, auto-play next.

## Features to Implement

### Feature 1: Click to Play
**Purpose**: Load and play video when playlist item clicked

**Requirements**:
- Click any playlist item to play that video
- Update active item highlight
- Load video source into core player
- Auto-play after loading
- Scroll to clicked item if not visible

### Feature 2: Remove Video
**Purpose**: Delete videos from playlist

**Requirements**:
- X or trash button on each item (visible on hover)
- Confirm deletion for safety (or allow undo)
- Remove item from playlist array
- Update visual list
- Handle removing currently playing video

### Feature 3: Next/Previous Navigation
**Purpose**: Navigate through playlist sequentially

**Requirements**:
- Next button in player controls
- Previous button in player controls
- Keyboard shortcuts: Shift+N (next), Shift+P (previous)
- Disable buttons at playlist boundaries
- Update active indicator

### Feature 4: Auto-Play Next
**Purpose**: Automatically play next video when current ends

**Requirements**:
- Listen for 'ended' event on video
- Load next video in playlist
- Start playback automatically
- Handle last video (stop or loop to first)
- Allow user to disable auto-play (optional)

### Feature 5: Playlist Controls
**Purpose**: Bulk playlist operations

**Requirements**:
- Clear all button (remove all videos with confirmation)
- Shuffle button (randomize order - optional)
- Sort options (by name, duration - optional)
- Select all checkbox (optional)

## Testing Checklist
- [ ] Clicking item plays video
- [ ] Can remove videos
- [ ] Next/Prev buttons work
- [ ] Auto-play next works
- [ ] Clear all works

## Done When
✅ Playlist management functional  
✅ Navigation works  
✅ Auto-play works  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 23 | **Component**: Player
**Estimated Time**: 40-60 minutes
