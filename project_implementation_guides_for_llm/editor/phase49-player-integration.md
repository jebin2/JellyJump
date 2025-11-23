# Phase 49: MediaBunny Player Integration

## Goal
Initialize MediaBunny player, load video from selected clip

## Group
**Preview Player**

## Feature to Implement

### ONE Feature: MediaBunny Player Integration
**Purpose**: Integrate MediaBunny player to display and play video content

**Requirements**:

#### 1. What to Build
Integrate MediaBunny Player into preview panel:
- Initialize MediaBunny Player instance
- Create player container element
- Load video from selected media item or clip
- Display video in preview area
- Prepare for playback controls (Phase 50)
- Handle player lifecycle (create, dispose)

#### 2. MediaBunny Player Initialization
Initialize Player when video needs to be loaded:

```javascript
Process:
1. Import MediaBunny Player class
2. Create player instance targeting video container
3. Configure player options (size, controls, etc.)
4. Wait for player ready
5. Load video source (from IndexedDB blob)
6. Player ready to play
```

See `mediabunny-llms-full.md` for Player initialization details.

#### 3. Player Container
Create container for MediaBunny player:
- `<div id="preview-player-container"></div>`
- Position in video display area (from Phase 48)
- Full width/height of video area
- MediaBunny will inject its player elements here

#### 4. Video Source Loading
Load video from two sources:

**Option A - From Media Library** (Phase 45 selection):
- User selects video tile in media library
- Retrieve video blob from IndexedDB using media ID
- Load blob into player

**Option B - From Timeline Clip** (Phase 66+):
- User clicks clip on timeline
- Retrieve source video from clip data
- Load into player

For this phase: Focus on **Option A** (media library selection).

#### 5. Player Configuration
Configure MediaBunny Player:
- Width: Auto (fit container)
- Height: Auto (fit container)
- Controls: false (custom controls in Phases 50-53)
- Autoplay: false (manual play in Phase 50)
- Loop: false
- Muted: false (default)
- Background: black

Example configuration (see MediaBunny docs):
```javascript
const player = new Player(containerElement, {
  width: '100%',
  height: '100%',
  controls: false,
  autoplay: false
});
```

#### 6. Loading Video Blob
Load video from IndexedDB:
1. Get selected media ID from Phase 45 selection
2. Retrieve media item from IndexedDB
3. Get video blob from media object
4. Create blob URL: `URL.createObjectURL(blob)`
5. Load into player: `player.src = blobUrl`
6. OR: Use MediaBunny's blob loading method

#### 7. Player State Management
Track player state:
- `playerInstance` - Reference to current player
- `currentVideoId` - ID of currently loaded video
- `isPlayerReady` - Boolean, true when ready for commands
- `isVideoLoaded` - Boolean, true when video loaded

#### 8. Player Lifecycle
Manage player creation and disposal:

**Create player**:
- When video selected in media library
- When clip selected on timeline (later phase)

**Dispose previous player**:
- Before loading new video
- When switching to different video
- On page unload
- Call `player.dispose()` to free resources

**Update player**:
- When same video but different clip (trim/edit)
- May reuse player or recreate

#### 9. Player Ready Event
Wait for player to be ready:
- Listen for `ready` event or use promise
- Only send commands (play, seek) after ready
- Show loading indicator until ready

Example:
```javascript
player.on('ready', () => {
  console.log('Player ready');
  // Enable controls
});
```

#### 10. Error Handling
Handle player errors:
- **Player initialization fails**: Show error "Failed to initialize player"
- **Video load fails**: Show error "Failed to load video: [filename]"
- **Unsupported format**: Show error "Video format not supported"
- **MediaBunny not available**: Show error "Video player unavailable"
- Log all errors to console

#### 11. Loading State
Show loading indicator while video loads:
- Spinner or progress bar
- "Loading video..." text
- Position: Center of video area
- Remove when player ready

#### 12. Integration with Media Library (Phase 45)
Connect to tile selection:
- When user selects video tile in media library
- Get media ID from tile (`data-media-id`)
- Load that video into preview player
- Update preview panel to show video

#### 13. First Frame Display
After video loads:
- Display first frame as poster
- OR: Seek to 0.1 seconds to avoid black frame
- Video paused, ready for play (Phase 50)

#### 14. Accessibility
- Player container should have `aria-label="Video player"`
- Announce video title when loaded: "Loaded: Beach_vacation.mp4"
- Player should be keyboard accessible (arrow keys for seek, space for play - Phase 50)

#### 15. Files to Create/Modify
- `editor.html` - Add player container div if needed
- `assets/js/preview-player.js` - Create new file for player management
- `assets/js/media-library.js` - Connect tile selection to player loading
- Import MediaBunny library (CDN or local)

#### 16. JavaScript Organization
Create PreviewPlayer class/module:
- `initPlayer()` - Create MediaBunny Player instance
- `loadVideo(mediaId)` - Load video from media library
- `disposePlayer()` - Clean up current player
- `onPlayerReady()` - Handle ready event
- `onPlayerError(error)` - Handle errors
- `getPlayerInstance()` - Return current player reference

#### 17. MediaBunny Integration
Key MediaBunny APIs to use:
- `new Player(container, options)` - Initialize player
- `player.src = url` - Set video source
- `player.on('ready', callback)` - Ready event
- `player.on('error', callback)` - Error event
- `player.dispose()` - Clean up
- See `mediabunny-llms-full.md` for complete API

#### 18. Data Attributes
- `id="preview-player-container"` on player container div
- `data-player-loaded="true|false"` to track state (optional)

#### 19. What NOT to Do
- ❌ Do NOT implement Play/Pause yet (that's Phase 50)
- ❌ Do NOT add progress bar or seeking (comes later)
- ❌ Do NOT add volume controls (Phase 58)
- ❌ Do NOT add fullscreen (Phase 53)
- ❌ Do NOT load video automatically on page load (wait for user selection)
- This phase is **player initialization and video loading ONLY**

## References
- **Phase 45**: Media tile selection triggers video load
- **Phase 48**: Preview panel structure (player goes here)
- **Phase 50**: Will add Play/Pause controls
- **MediaBunny Docs**: See mediabunny-llms-full.md for Player API
- **Core Player**: May reference existing implementation in core/Player.js

## Testing Checklist
- [ ] MediaBunny library imported successfully
- [ ] Player container div exists in preview panel
- [ ] Select video tile in media library triggers player initialization
- [ ] Player instance created successfully
- [ ] Player ready event fires
- [ ] Video blob loaded from IndexedDB
- [ ] Video displays in preview area (first frame or paused)
- [ ] Video maintains 16:9 aspect ratio
- [ ] No autoplay (video paused initially)
- [ ] Loading indicator shows during video load
- [ ] Error handling works for invalid videos
- [ ] Previous player disposed before loading new video
- [ ] Multiple video selections work (player recreated each time)
- [ ] Console logs player ready message
- [ ] No memory leaks (resources cleaned up)
- [ ] No console errors

## Done When
✅ MediaBunny Player initialized  
✅ Player displayed in preview panel  
✅ Video loads from selected media tile  
✅ Player ready event handled  
✅ Error handling implemented  
✅ Player disposal works correctly  
✅ Loading state shown  
✅ All tests pass  
✅ Ready for Phase 50 (Play/Pause Controls)

---
**Phase**: 49 | **Component**: Editor | **Group**: Preview Player  
**Estimated Time**: 30 min

## Implementation Notes
- Consult mediabunny-llms-full.md for detailed Player API
- Always dispose player before creating new instance
- Use blob URLs for loading videos from IndexedDB
- Player initialization is async (wait for ready event)
- This connects Media Library (Phase 45) to Preview Player
- Video paused initially, play functionality in Phase 50
