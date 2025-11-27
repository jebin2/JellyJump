# Phase 76: Playhead-Preview Sync

## Goal
Synchronize timeline playhead movement with the preview player playback

## Group
**Timeline Interaction**

## Feature to Implement

### ONE Feature: Bidirectional Playhead Sync
**Purpose**: Ensure the timeline playhead moves when video plays, and video seeks when playhead moves (programmatically)

**Requirements**:

#### 1. What to Build
Implement synchronization logic:
- **Player → Timeline**: Update playhead position every frame during playback
- **Timeline → Player**: Seek video when timeline position changes (e.g., stop/reset)
- **State Management**: Track current time in a central store

#### 2. Player to Timeline Sync (Playback)
When Preview Player is playing:
- Listen for time updates (e.g., `requestAnimationFrame` loop or `timeupdate` event)
- Get current time from Player
- Call `timeline.updatePlayheadPosition(time)`
- Ensure smooth movement (60fps preferred over `timeupdate`'s ~4Hz)

#### 3. Timeline to Player Sync (Seeking)
When timeline position is set programmatically (e.g., "Go to Start" button):
- Update timeline playhead position
- Call `player.seek(time)`
- Ensure player reflects the frame at the new time

#### 4. Animation Loop
Use `requestAnimationFrame` for smooth playhead movement:
- Start loop when player state is 'playing'
- Stop loop when player state is 'paused' or 'ended'
- In loop:
  1. Get player current time
  2. Update playhead position
  3. Check if end of project reached (stop playback)

#### 5. Project Duration Check
Auto-stop at end of project:
- If `currentTime >= projectDuration`:
  - Pause player
  - Snap playhead to end (or loop if enabled)
  - Update UI buttons (Play -> Pause)

#### 6. Time Display Update
Update the time counter in the Preview Player controls (Phase 54):
- Format current time (M:SS:FF)
- Update DOM element
- Sync with playhead movement

#### 7. JavaScript Organization
Centralize time management (e.g., `PlaybackManager` or `EditorState`):
- `play()`: Start player, start animation loop
- `pause()`: Pause player, stop loop
- `seek(time)`: Update player and timeline
- `onTimeUpdate(callback)`: Observers for time changes

#### 8. Performance Optimization
- **Throttling**: Time display text doesn't need 60fps updates (maybe 10fps)
- **Playhead**: Needs 60fps for smoothness
- **Avoid Layout Thrashing**: Batch DOM reads/writes

#### 9. Edge Cases
- **Loading State**: Don't sync if player is buffering
- **Empty Timeline**: Playhead can move, but player shows black/nothing
- **Rapid Seeking**: Debounce player seek calls if needed

#### 10. Files to Create/Modify
- `assets/js/playback-manager.js` - New file for sync logic
- `assets/js/timeline.js` - Expose update methods
- `assets/js/preview-player.js` - Expose player state/methods
- `editor.html` - Link new script

#### 11. What NOT to Do
- ❌ Do NOT implement scrubbing (dragging playhead) yet (Phase 71)
- ❌ Do NOT implement complex rendering logic (just simple sync)
- ❌ Do NOT implement audio mixing (handled by player)

**MediaBunny Integration**:
- Use `Player.currentTime`
- Use `Player.play()`, `Player.pause()`, `Player.seek()`

## References
- **Phase 54**: Preview Player Controls (Play/Pause buttons)
- **Phase 69**: Playhead Visual (target for movement)
- **Phase 48**: Preview Player Foundation

## Testing Checklist
- [ ] Pressing Play button starts video AND moves playhead
- [ ] Playhead moves smoothly (not jumpy)
- [ ] Pressing Pause stops video AND playhead
- [ ] Playhead position matches video frame visually
- [ ] Reaching end of timeline stops playback
- [ ] Time display updates correctly during playback
- [ ] "Go to Start" moves playhead to 0 and seeks video
- [ ] No console errors during loop

## Done When
✅ Playhead moves in sync with video playback  
✅ Video seeks when timeline position set programmatically  
✅ Animation loop handles smooth updates  
✅ Auto-stop at project end works  
✅ Time display stays synced  
✅ All tests pass  
✅ Ready for Phase 71 (Timeline Scrubbing)

---
**Phase**: 76 | **Component**: Editor | **Group**: Timeline Interaction  
**Estimated Time**: 20 min

## Implementation Notes
- The `PlaybackManager` acts as the bridge between the Timeline UI and the MediaBunny Player.
- `requestAnimationFrame` is crucial for the playhead to look smooth. Standard `timeupdate` events are too infrequent.
