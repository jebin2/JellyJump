# Phase 66: Drop Media onto Timeline

## Goal
Handle drag-and-drop from library to timeline, create clip data structure

## Group
**Timeline Interaction**

## Feature to Implement

### ONE Feature: Drop Media to Timeline
**Purpose**: Accept dragged media from library and create clip instances on timeline tracks

**Requirements**:

#### 1. What to Build
Implement drop functionality:
- Accept drops from media library (Phase 47 drag setup)
- Detect which track media is dropped on
- Calculate drop position (time on timeline)
- Create clip data structure
- Store clip in project data
- Trigger clip visual rendering (Phase 67)
- Provide visual drop feedback

#### 2. Drop Zones
Define valid drop areas:
- **Track content areas**: Accept drops (video on video tracks, audio on audio tracks)
- **Track headers**: Reject drops (not valid)
- **Ruler area**: Reject drops (not valid)
- **Empty timeline**: Accept drops on any track
- Visual feedback when dragging over valid/invalid zones

#### 3. Drop Event Handling
Implement three drag events on track content areas:

**dragover**:
- Prevent default to allow drop: `event.preventDefault()`
- Set visual indicator (highlight track)
- Calculate and show drop position indicator (vertical line)
- Update continuously as mouse moves

**dragenter**:
- Add highlight class to track
- Show "valid drop" cursor

**drop**:
- Prevent default
- Get drag data from `event.dataTransfer`
- Calculate drop time position
- Get media details from IndexedDB
- Create clip data structure
- Save to project data
- Render clip visually (call Phase 67 logic)
- Remove highlight

**dragleave**:
- Remove highlight if leaving track area
- Check if actually leaving (not hovering child element)

#### 4. Media Type Validation
Enforce track type rules:
- **Video tracks**: Accept video and image media only
- **Audio tracks**: Accept audio media only
- **Reject invalid drops**: Show error indicator, prevent drop
- Visual feedback: Red highlight for invalid, green for valid

#### 5. Drop Position Calculation
Calculate timeline position from mouse X coordinate:

```
Get mouse X position relative to track content area
Subtract track header width (150px)
Account for current scroll position
Calculate time: mouseX / pixelsPerSecond
Round to nearest frame or 0.1 second
```

Example:
```
mouseX = 400px (relative to track content)
pixelsPerSecond = 50
dropTime = 400 / 50 = 8.0 seconds
```

Snap to grid (optional for v1):
- Snap to 1-second intervals
- Snap to 0.5-second intervals if zoomed in
- Disable snapping if Shift key held

#### 6. Visual Drop Indicator
Show drop position while dragging:
- Vertical line (2px wide) at calculated drop position
- Extends from top to bottom of track
- Color: Accent or success color
- Updates in real-time as mouse moves
- Remove on drop or drag leave

#### 7. Clip Data Structure
Create clip object when dropped:

```
{
  id: generateUUID(),
  mediaId: draggedMediaId,
  trackId: targetTrackId,
  startTime: calculatedDropTime,
  duration: mediaDuration,
  trimStart: 0,              // Trim from beginning (for future)
  trimEnd: mediaDuration,    // Trim from end (for future)
  volume: 1.0,               // Audio volume (1.0 = 100%)
  muted: false,
  locked: false,
  visible: true,
  effects: []                // Effects applied to clip (for future)
}
```

Important fields:
- `startTime`: Clip position on timeline (in seconds)
- `duration`: Visible clip duration (trimmed duration)
- `mediaId`: Reference to source media in IndexedDB
- `trackId`: Which track clip belongs to

#### 8. Collision Detection (Skip for Now)
For v1, allow overlapping clips:
- Clips can overlap on same track
- No collision prevention yet
- Later phases will add snap-to-clip and prevent overlap

#### 9. Store Clip Data
Save clip to project data structure:
- Add clip object to timeline clips array
- Store in IndexedDB or project JSON
- Reference: Project data structure from earlier phases

Project data includes:
```
{
  id: projectId,
  name: projectName,
  tracks: [track1, track2, track3],
  clips: [clip1, clip2, clip3],
  duration: calculatedDuration
}
```

#### 10. Trigger Clip Rendering
After creating clip data:
- Call rendering function from Phase 67
- Pass clip object to render function
- Render function creates visual clip element on timeline
- Apply styles, position, and dimensions

#### 11. Update Project Duration
Recalculate timeline duration:
- Find clip with latest end time: `clip.startTime + clip.duration`
- Set as new project duration
- Update ruler width (Phase 62-63 logic)
- Ensure timeline extends to end of last clip

#### 12. Empty State Handling
Remove empty state (Phase 64):
- Remove "drag media here" message
- Remove `data-empty="true"` attribute
- Show normal track appearance

#### 13. Multi-Drop Support (Future)
For now, single clip drop only:
- Drop one media item at a time
- Multi-select drag (multiple clips) in future phase
- Focus on single drop workflow

#### 14. Edge Cases
- **Drop on occupied space**: Allow overlap for v1
- **Drop partially off-screen**: Ensure clip starts on visible timeline
- **Drop time 0:00**: Valid, clip starts at beginning
- **Drop on wrong track type**: Reject with visual feedback
- **Drag cancelled** (Esc key): Remove indicators, no action
- **Mouse moves quickly**: Ensure drop position accurate

#### 15. Error Handling
Handle drop failures:
- Media not found in IndexedDB: Show error toast
- Invalid track type: Show error, reject drop
- Invalid drop position (negative time): Clamp to 0:00
- Log errors to console for debugging

#### 16. Accessibility
- Drop is mouse-only interaction
- Provide keyboard alternative:
  - Select media in library (Phase 45)
  - Press Ctrl+Enter or button to "Add to Timeline"
  - Adds clip to first available track at end of timeline
- Alternative method can be added in future phase

#### 17. Undo Support (Future)
Prepare for undo:
- Log action to history: "Added clip [filename]"
- Store previous state (empty timeline)
- Undo functionality implemented in separate phase

#### 18. Files to Create/Modify
- `assets/js/timeline.js` - Extend with drop handling
- `assets/js/clip-manager.js` - Create new file for clip data management
- `assets/css/editor.css` - Add drop indicator styles
- `editor.html` - No changes (drag/drop uses existing structure)

#### 19. JavaScript Organization
Create or extend classes:

**Timeline class**:
- `attachDropHandlers()` - Add dragover, drop, dragleave listeners to tracks
- `onDragOver(event)` - Show drop indicator
- `onDrop(event)` - Handle drop, create clip
- `calculateDropPosition(event)` - Convert mouse X to time
- `showDropIndicator(trackId, time)` - Show vertical line
- `hideDropIndicator()` - Remove line

**ClipManager class (new)**:
- `createClip(mediaId, trackId, startTime)` - Build clip object
- `saveClip(clip)` - Save to project data
- `getClipById(id)` - Retrieve clip
- `deleteClip(id)` - Remove clip
- `updateProjectDuration()` - Recalculate total duration

#### 20. Integration with Phase 47
Retrieve drag data:
```
const mediaId = event.dataTransfer.getData('text/plain');
// OR
const dragData = JSON.parse(event.dataTransfer.getData('application/x-mediabunny-media'));
const mediaId = dragData.id;
```

Fetch full media details from IndexedDB using mediaId.

#### 21. What NOT to Do
- ❌ Do NOT implement clip trimming (in/out points)
- ❌ Do NOT implement snap-to-clip or collision prevention
- ❌ Do NOT implement clip selection or editing yet
- ❌ Do NOT implement duplicate clip on Ctrl+Drag
- ❌ Do NOT implement visual clip rendering (that's Phase 67)
- This phase: **Drop handling and data creation ONLY**

**MediaBunny Integration**: Not applicable for drop handling (media already loaded in library)

## References
- **Phase 47**: Drag setup from media library
- **Phase 64**: Track container structure (drop targets)
- **Phase 67**: Clip rendering (called after drop)
- **IndexedDB**: Media storage from Phase 42

## Testing Checklist
- [ ] Can drag video from library over video track
- [ ] Track highlights when dragging over valid drop zone
- [ ] Track shows error state when dragging invalid media type
- [ ] Drop position indicator (vertical line) appears
- [ ] Indicator updates as mouse moves
- [ ] Drop creates clip data object in console
- [ ] Clip saved to project data structure
- [ ] Media ID correctly stored in clip
- [ ] Track ID correctly stored in clip
- [ ] Start time calculated from drop position
- [ ] Duration matches media duration
- [ ] Project duration updates after drop
- [ ] Empty state removed after first clip
- [ ] Drop on audio track accepts audio files only
- [ ] No console errors
- [ ] Clip rendering triggered (visual clip appears - Phase 67)

## Done When
✅ Drop zones accept valid media  
✅ Drop position calculated accurately  
✅ Clip data structure created  
✅ Clip saved to project data  
✅ Project duration updated  
✅ Visual drop indicator works  
✅ Media type validation functional  
✅ All tests pass  
✅ Ready for Phase 67 (Clip Visual Rendering)

---
**Phase**: 66 | **Component**: Editor | **Group**: Timeline Interaction  
**Estimated Time**: 25-30 min

## Implementation Notes
- This completes drag-and-drop workflow started in Phase 47
- Clip data structure is foundation for all editing operations
- Visual rendering (Phase 67) separated for clarity and modularity
- Allow overlaps for v1 simplicity, add constraints later
- Drop indicator provides crucial visual feedback
- ClipManager class will grow to handle complex editing operations
- This is the key phase where library and timeline finally connect!
