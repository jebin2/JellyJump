# Phase 56: Play/Pause Controls

## Goal
Connect custom Play and Pause buttons to the existing MediaBunny Player instance.

---

## What to Build

Play/pause controls:
- Play/pause button
- Toggle playback state
- Keyboard shortcut (Space)
- Visual state feedback
- Sync with timeline playhead
- Handle loading states

---

## Feature to Implement

### ONE Feature: Play/Pause Controls
**Purpose**: Provide external control over the `Player` component initialized in Phase 49.

**Requirements**:

#### 1. What to Build
- **UI**: Add Play/Pause button to the controls area (Phase 48).
- **Logic**:
    - Get the `player` instance (from `window.editorPlayer` or module export).
    - Click Play -> Call `player.play()`.
    - Click Pause -> Call `player.pause()`.
    - **Sync State**: Listen to `player.on('play')` and `player.on('pause')` to update the button icon.

#### 2. Interaction
- **Button**: Toggle icon between ▶ (Play) and ⏸ (Pause).
- **Shortcut**: Spacebar toggles playback.

#### 3. MediaBunny Integration
- **CRITICAL**: Do NOT maintain separate state. The `Player` instance is the source of truth.
- `player.paused` property.
- `player.play()` / `player.pause()` methods.

#### 4. Files to Create/Modify
- `assets/js/preview-player.js` (Update to add controls logic)
- `assets/js/keyboard-shortcuts.js` (Spacebar handler)

#### 5. What NOT to Do
- ❌ Do NOT implement a new playback engine. Just call the existing player methods.

---

## Testing Checklist Checklist
- [ ] Play button starts video
- [ ] Pause button stops video
- [ ] Button icon updates when video ends
- [ ] Spacebar works
- [ ] State stays in sync if video pauses itself (e.g., end of file)

---

## Done When
✅ Play/Pause works via custom button  
✅ Spacebar works  
✅ UI stays in sync with Player state  
✅ Ready for Phase 51
