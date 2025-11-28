# Phase 55: MediaBunny Player Integration

## Goal
Initialize the **existing MediaBunny Player component**, load video from selected clip, and configure it for the editor context.

---

## What to Build

Integrate CorePlayer:
- Import core player component
- Initialize in preview area
- Configure for editor mode
- Connect to timeline
- Sync playback with timeline
- Resource management

---

## Feature to Implement

### ONE Feature: MediaBunny Player Integration
**Purpose**: Reuse the robust Player component built in Phases 09-14 to display and play video content within the editor.

**Requirements**:

#### 1. What to Build
- **Reuse Existing Player**: Import the `Player` class from `core/Player.js` (or equivalent location).
- **Mount Player**: Instantiate `new Player()` into the `#preview-player-container` created in Phase 26.
- **Configure Options**: Pass options to hide/show specific controls suitable for the editor (e.g., hide built-in timeline, show basic controls).
- **Load Video**: Use the player's public API to load video blobs.

#### 2. Player Configuration
The existing Player likely has options. We need to configure it to fit the editor:
- **Container**: `#preview-player-container`
- **Options**:
    - `controls`: `false` (We will build custom editor controls in Phase 50-53, or use Player's if suitable).
    - **Decision**: If the Player has a "minimal" mode, use that. Otherwise, disable built-in controls and use our custom buttons.
    - `autoplay`: `false`
    - `loop`: `false`
    - `width`: `100%`
    - `height`: `100%`

#### 3. Player Initialization Logic
```javascript
import { Player } from '../../core/Player.js'; // Adjust path

const container = document.getElementById('preview-player-container');
const player = new Player(container, {
    controls: false, // We use our own editor controls
    autoplay: false
});

// Store player instance for later use
window.editorPlayer = player;
```

#### 4. Loading Video Source
Load video from two sources:
- **Option A - From Media Library**:
    - User selects video tile.
    - Get blob from IndexedDB.
    - `player.load(blobUrl)` (or whatever API the Player exposes).

#### 5. Player State Management
- Track `playerInstance`.
- Listen for `ready`, `play`, `pause`, `timeupdate` events from the Player to sync our custom UI.

#### 6. Files to Create/Modify
- `assets/js/preview-player.js` - Manage the Player instance.
- `assets/js/media-library.js` - Trigger load on selection.

#### 7. MediaBunny Integration
- **CRITICAL**: Do NOT write a new player. Use the one from `core/`.
- Check `core/Player.js` to see available methods (`play()`, `pause()`, `load()`, `currentTime`).

#### 8. What NOT to Do
- ❌ Do NOT create a `<video>` tag manually. Let the Player class handle it.
- ❌ Do NOT duplicate player logic (buffering, error handling) if the Player class already does it.

---

## Testing Checklist Checklist
- [ ] Player class imported successfully
- [ ] Player instance created in preview container
- [ ] Video loads from Media Library
- [ ] Player fits container (16:9)
- [ ] No double controls (built-in vs custom)
- [ ] Console errors handled

---

## Done When
✅ Existing Player component is mounted  
✅ Video loads and displays  
✅ Player instance is accessible for future phases  
✅ Ready for Phase 50 (Play/Pause Controls)
