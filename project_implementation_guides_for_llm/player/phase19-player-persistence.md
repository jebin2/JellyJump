# Phase 19: Player Persistence

## Goal
Persist playlist and playback state using localStorage with MediaBunny considerations

**MediaBunny Integration**: MediaBunny Input objects cannot be directly serialized. **Consult** mediabunny-llms-full.md to understand:
- What can be persisted: file paths, blob URLs, format info, metadata
- What cannot be persisted: Input objects, decoders, active streams
- How to reconstruct Input objects from persisted data on page reload, load on page load, resume playback position.

## Features to Implement

### Feature 1: IndexedDB Setup
**Purpose**: Browser database for persistent storage

**Requirements**:
- Open IndexedDB database ("MediaBunnyPlaylists")
- Create object store for playlists
- Create object store for playback positions
- Handle database upgrades
- Error handling for quota exceeded

### Feature 2: Save Playlist
**Purpose**: Store current playlist to database

**Requirements**:
- Save video list (file references or URLs)
- Save playlist metadata (name, created date)
- Save current video index
- Update existing playlist if already saved
- Confirmation on successful save

### Feature 3: Load on Page Load
**Purpose**: Restore playlist when user returns

**Requirements**:
- Load default playlist on page initialization
- Restore video list from database
- Render playlist items
- Restore playlist state (not auto-play on load)
- Handle no saved playlist gracefully

### Feature 4: Auto-Save
**Purpose**: Save changes automatically

**Requirements**:
- Save after adding videos
- Save after removing videos
- Save after reordering
- Debounce saves (don't save on every change)
- Silent auto-save (no user interruption)

### Feature 5: Resume Playback Position
**Purpose**: Remember where user left off

**Requirements**:
- Save playback position when video pauses or page unloads
- Save current video index
- On load, show resume option or auto-resume
- Clear position when video finishes
- Per-video position tracking

### Feature 6: Multiple Playlists (Optional)
**Purpose**: Save and load named playlists

**Requirements**:
- Name playlist feature
- Save multiple playlists
- Playlist selector dropdown
- Load selected playlist
- Delete playlist option

## Testing Checklist
- [ ] Playlist saves to IndexedDB
- [ ] Playlist loads on refresh
- [ ] Auto-save works on changes
- [ ] Playback resumes from correct position
- [ ] Multiple playlists work (if implemented)

## Done When
✅ Persistence implemented  
✅ State restored correctly  
✅ Auto-save works  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 19 | **Component**: Player
**Estimated Time**: 40-60 minutes
