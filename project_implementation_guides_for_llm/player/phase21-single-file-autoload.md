# Phase 21: Single File Auto-Load

## Goal
Automatically load and play single uploaded files or URLs in the player for immediate viewing.

## Features to Implement

### Feature 1: Single File Detection
**Purpose**: Determine when to auto-load vs. just add to playlist

**Requirements**:
- Detect when only one file is uploaded
- Detect when one URL is added
- Check if playlist is empty or not
- Auto-load only for single item additions
- Don't auto-load for batch uploads (multiple files, folders)

**Detection Logic**:
```javascript
function shouldAutoLoad(uploadedItems) {
  return uploadedItems.length === 1;
}

// In upload handler
if (shouldAutoLoad(files)) {
  await addToPlaylist(files[0]);
  await loadInPlayer(files[0]);
} else {
  await addToPlaylist(files);
  // Don't auto-load multiple files
}
```

### Feature 2: Auto-Load Single File Upload
**Purpose**: Load immediately when user uploads one file

**Requirements**:
- Trigger on single file upload (via file input or drag-and-drop)
- Add file to playlist first
- Then load file into player
- Start at beginning (timestamp 0)
- Don't autoplay (browser restriction), just load
- Show poster frame (Phase 19)

**Implementation**:
```javascript
async function handleFileUpload(files) {
  if (files.length === 1) {
    const file = files[0];
    
    // Add to playlist
    const playlistItem = await addToPlaylist(file);
    
    // Load in player
    await loadVideoInPlayer(playlistItem);
    
    // Extract and show poster frame (Phase 19)
    await showPosterFrame(playlistItem);
    
  } else {
    // Just add all to playlist
    await addToPlaylist(files);
  }
}
```

### Feature 3: Auto-Load Single URL
**Purpose**: Load immediately when user adds one URL (Phase 20)

**Requirements**:
- Trigger after successful URL fetch
- Add URL video to playlist first
- Then load into player
- Same behavior as single file upload
- Integrate with Phase 20 (URL Upload)

**Implementation**:
```javascript
async function addVideoFromUrl(url) {
  try {
    // Fetch video (Phase 20 logic)
    const blob = await fetchVideoFromUrl(url);
    
    // Add to playlist
    const playlistItem = await addToPlaylist({
      source: 'url',
      url: url,
      blob: blob,
      ...
    });
    
    // Auto-load since it's a single URL
    await loadVideoInPlayer(playlistItem);
    await showPosterFrame(playlistItem);
    
  } catch (error) {
    // Handle error
  }
}
```

### Feature 4: Skip Auto-Load for Multiple Files
**Purpose**: Avoid unexpected behavior when uploading batches

**Requirements**:
- If `files.length > 1`: Only add to playlist
- If uploading folder: Only add to playlist
- If drag-dropping multiple files: Only add to playlist
- Show notification: "X videos added to playlist"
- Don't change current player state

**Rationale**:
- User may be building a playlist, not wanting to change current video
- Unexpected video switches can be jarring
- Batch uploads are usually for playlist building

### Feature 5: Load Video in Player
**Purpose**: Switch player to new video and prepare for playback

**Requirements**:
- Clear current video (if any)
- Load new video into MediaBunny Player
- Set player to ready state (not playing)
- Update UI: Video title, duration, thumbnail
- Reset playback controls (time to 0:00)
- Extract poster frame and display
- Don't start playback (wait for user click)

**MediaBunny Integration**:
```javascript
async function loadVideoInPlayer(playlistItem) {
  // Create MediaBunny Input
  const input = new Input(new BlobSource(playlistItem.blob));
  
  // Switch player to new video
  await player.switchVideo(input);
  
  // Update UI
  updateVideoInfo({
    title: playlistItem.name,
    duration: playlistItem.duration
  });
  
  // Extract poster frame (Phase 19)
  const posterFrame = await extractFrameAt(player.duration * 0.5);
  displayPoster(posterFrame);
  
  // Player is ready, waiting for user to click play
}
```

### Feature 6: Visual Feedback
**Purpose**: Confirm auto-load to user

**Requirements**:
- Highlight loaded video in playlist (active state)
- Show notification toast: "Video loaded and ready to play"
- Update player UI immediately
- Smooth transition (fade in new video info)
- Optional: Brief animation on playlist item

## Testing Checklist
- [ ] Uploading single file loads it in player
- [ ] Uploading multiple files does NOT auto-load
- [ ] Uploading folder does NOT auto-load
- [ ] Adding single URL loads it in player
- [ ] Drag-dropping single file loads it in player
- [ ] Drag-dropping multiple files does NOT auto-load
- [ ] Auto-loaded video shows poster frame
- [ ] Player UI updates with new video info
- [ ] Playlist highlights active video
- [ ] Auto-load doesn't start playback (waits for user)
- [ ] No errors in console
- [ ] Works with different file types (MP4, WebM, etc.)

## Interaction Behavior

**User Flow 1: Single File Upload**:
1. User clicks "Upload Files"
2. User selects ONE video file
3. File added to playlist
4. Video loads in player automatically
5. Poster frame displays
6. Player shows video title and duration
7. Playlist highlights the video
8. User clicks play → Video starts

**User Flow 2: Multiple Files Upload**:
1. User selects 5 video files
2. All 5 added to playlist
3. Player does NOT change
4. Notification: "5 videos added to playlist"
5. User can click any playlist item to load

**User Flow 3: Single URL**:
1. User clicks "Upload URL"
2. User enters URL
3. Video fetched successfully
4. Video added to playlist
5. Video loads in player automatically
6. Same as single file flow

**User Flow 4: Drag-and-Drop Single File**:
1. User drags one video file to window
2. File added to playlist
3. Video loads in player automatically
4. Same as single file flow

## Edge Cases
- Uploading single file when playlist already has videos: Still auto-load new file
- Uploading single file while video is playing: Pause current, load new
- Auto-load fails (corrupted file): Show error, don't crash
- Very large file: Show loading indicator during load
- Rapid uploads: Queue load requests, don't overlap
- Empty playlist + single file: Auto-load and set as first item

## Accessibility
- Screen reader announces: "Video loaded: [filename]"
- Focus moves to play button after auto-load (optional)
- Playlist item marked as `aria-current="true"`
- Keyboard shortcut to reload current video (optional)

## Files to Modify
- `player.js` - Add auto-load detection and logic
- `playlist.js` - Call auto-load handler on single add
- `upload.js` - Integrate with upload handlers
- `url-upload.js` - Integrate with URL upload (Phase 20)

## What NOT to Do
- ❌ Don't auto-load multiple files (confusing UX)
- ❌ Don't autoplay after load (browser restriction + UX)
- ❌ Don't auto-load if user is actively watching something
- ❌ Don't forget to highlight loaded video in playlist
- ❌ Don't skip error handling (file may be corrupted)

## MediaBunny Integration

**Required APIs**:
- `Player.switchVideo(input)` - Load new video
- `Input` / `BlobSource` - Create input from file/blob
- Poster frame extraction (Phase 19 logic)

**Reference**: Consult `mediabunny-llms-full.md` for:
- Switching videos
- Resource cleanup (dispose old video)
- Error handling

## Integration Notes

**Integrates with**:
- Phase 20 (URL Upload): Auto-load single URLs
- Phase 19 (Default Frame): Show poster after auto-load
- Phase 22 (Playlist): Highlight active item
- Phase 28 (Upload): Detect single vs. batch

**Timing**:
- This phase builds on upload infrastructure
- Should be implemented after URL upload (Phase 20)
- Before general upload/management phases

## Done When
✅ Single file upload auto-loads  
✅ Multiple file upload does NOT auto-load  
✅ Single URL upload auto-loads  
✅ Folder upload does NOT auto-load  
✅ Auto-loaded video shows poster frame  
✅ Player UI updates correctly  
✅ Playlist highlights active video  
✅ No autoplay (waits for user)  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 21 | **Component**: Player  
**Estimated Time**: 30-45 minutes
