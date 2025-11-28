# Phase 30: Player Persistence

## Goal
Persist playlist and playback state using localStorage/IndexedDB with proper MediaBunny resource reconstruction.

**MediaBunny Note**: MediaBunny Input objects cannot be directly serialized. Store file references and recreate Input objects on reload. Consult `mediabunny-llms-full.md` for reconstruction patterns.

---

## What to Build

Persistence system that:
- Saves playlist to IndexedDB
- Restores playlist on page load
- Tracks playback position per video
- Auto-saves changes
- Properly handles MediaBunny resource lifecycle

---

## Features to Implement

### Feature 1: IndexedDB Setup
**Purpose**: Browser database for persistent storage

**Requirements**:
- Open IndexedDB database named "MediaBunnyPlaylists"
- Create object store: "playlists"
- Create object store: "playbackPositions"
- Handle database version upgrades
- Error handling for quota exceeded
- Graceful fallback if IndexedDB unavailable

### Feature 2: Save Playlist
**Purpose**: Store current playlist to database

**Requirements**:
- Save video list (file references as blob URLs or paths)
- Save playlist metadata (name, created date)
- Save current video index
- Store MediaBunny-compatible data (duration, format, dimensions)
- Update existing playlist if already saved
- Show confirmation on successful save
- Don't store actual Input objects (not serializable)

### Feature 3: Load on Page Load
**Purpose**: Restore playlist when user returns

**Requirements**:
- Load default playlist on page initialization
- Restore video list from database
- Recreate MediaBunny Input objects from stored references
- Render playlist items
- Restore playlist state (don't auto-play on load)
- Handle no saved playlist gracefully (show empty state)
- Handle corrupted data gracefully

### Feature 4: Auto-Save
**Purpose**: Save changes automatically

**Requirements**:
- Save after adding videos
- Save after removing videos
- Save after reordering
- Debounce saves (wait 1 second after last change)
- Silent auto-save (no user interruption)
- Show subtle "Saved" indicator
- Don't save more than once per second

### Feature 5: Resume Playback Position
**Purpose**: Remember where user left off

**Requirements**:
- Save playback position when video pauses
- Save on page unload/close
- Save current video index
- On load, show "Resume" option or auto-resume
- Clear position when video finishes
- Per-video position tracking (not just global)
- Store timestamp with video identifier

### Feature 6: Multiple Playlists (Optional)
**Purpose**: Save and load named playlists

**Requirements**:
- Name playlist feature
- Save multiple playlists to IndexedDB
- Playlist selector dropdown
- Load selected playlist
- Delete playlist option
- Set default playlist

---

## Interaction Behavior

**User Flow 1: First Visit**:
1. User opens player page
2. No saved playlist found
3. Empty player and playlist shown
4. User adds videos
5. Auto-save kicks in after 1 second
6. "Saved" indicator briefly shows

**User Flow 2: Returning Visit**:
1. User opens player page
2. Playlist loads from IndexedDB
3. Videos rendered in playlist
4. Last video and position restored
5. "Resume from 1:23" option shown
6. User clicks Resume → Playback continues

**User Flow 3: Auto-Save**:
1. User adds 3 videos rapidly
2. Debounce timer starts
3. After 1 second of no changes → Save to IndexedDB
4. "Saved" indicator shows briefly
5. Further changes reset timer

---

## Edge Cases

- IndexedDB not supported: Fall back to localStorage (with size limits)
- Quota exceeded: Show error, suggest clearing old playlists
- Corrupted database: Clear and start fresh
- File no longer accessible: Show placeholder, allow removal
- Multiple tabs: Sync changes using BroadcastChannel
- Browser private mode: IndexedDB may not persist
- Very large playlists (100+ videos): Paginate or limit

---

## MediaBunny Integration

This phase requires MediaBunny for playlist persistence and resource reconstruction.

**Consult `mediabunny-llms-full.md`** for:
- Input lifecycle management and reconstruction patterns
- What can/cannot be serialized (Inputs, decoders, streams)
- Blob URL management and storage
- Resource cleanup on removal

**Important considerations**:
- MediaBunny Input objects cannot be directly serialized
- Store file references (blob URLs, paths) and metadata instead
- Recreate Input objects on page load from stored references
- Clean up old Input instances when removing from playlist

---

## Accessibility

- Screen reader announces "Playlist saved"
- Loading state announced: "Restoring playlist"
- Errors announced: "Failed to save playlist"
- Resume option keyboard accessible

---

## What NOT to Do

- ❌ Don't serialize MediaBunny Input objects
- ❌ Don't save more frequently than once per second
- ❌ Don't auto-play on page load (bad UX, browser restriction)
- ❌ Don't ignore IndexedDB quota errors
- ❌ Don't store full video files (store references only)

---

## Testing Checklist

- [ ] Playlist saves to IndexedDB
- [ ] Playlist loads on refresh
- [ ] Auto-save works on changes
- [ ] Playback position restored correctly
- [ ] Resume option works
- [ ] Multiple playlists work (if implemented)
- [ ] Quota exceeded handled gracefully
- [ ] Corrupted data handled gracefully
- [ ] MediaBunny resources recreated correctly
- [ ] No memory leaks from unreleased Inputs

---

## Done When

✅ Persistence implemented  
✅ State restored correctly on page load  
✅ Auto-save works with debouncing  
✅ Playback position tracked per video  
✅ MediaBunny resources properly reconstructed  
✅ All tests pass  
✅ Ready for next phase

---

**Phase**: 30 | **Component**: Player  
**Estimated Time**: 40-60 minutes
