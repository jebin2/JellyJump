# Phase 50: Play/Pause Controls

## Goal
Play and Pause buttons, toggle state, Spacebar shortcut

## Group
**Preview Player**

## Feature to Implement

### ONE Feature: Play/Pause Controls
**Purpose**: Add play and pause buttons to control video playback

**Requirements**:

#### 1. What to Build
Add play/pause functionality:
- Play button (▶️ icon)
- Pause button (⏸️ icon)
- Toggle between play and pause states
- Spacebar keyboard shortcut
- Update button icon based on playback state
- Visual feedback on button click

#### 2. Button Layout
Position in controls area (Phase 48):
- Location: Left side of controls area
- Layout: Single button that toggles (Play ↔ Pause)
- Size: 40x40px or similar
- Icon: ▶️ when paused, ⏸️ when playing
- Dark Neobrutalism styling (thick border, offset shadow)

#### 3. Play/Pause Toggle Logic
When button clicked:

**If video is paused**:
1. Call `player.play()`
2. Change button icon to pause (⏸️)
3. Update internal state: `isPlaying = true`
4. Log: "Video playing"

**If video is playing**:
1. Call `player.pause()`
2. Change button icon to play (▶️)
3. Update internal state: `isPlaying = false`
4. Log: "Video paused"

#### 4. Initial State
When video first loaded (Phase 49):
- Video paused by default
- Show play button (▶️)
- `isPlaying = false`

#### 5. MediaBunny Player Control
Use MediaBunny Player API:
- Play: `player.play()` - Returns promise
- Pause: `player.pause()`
- Get state: `player.paused` (boolean)
- OR listen to events: `player.on('play')`, `player.on('pause')`

Handle promise from play():
```javascript
player.play()
  .then(() => console.log('Playing'))
  .catch(error => console.error('Play failed:', error));
```

#### 6. Playback State Tracking
Track state internally:
- `isPlaying` - Boolean flag
- OR: Query player: `!player.paused`
- Update UI based on state

Listen to player events for accurate state:
- `player.on('play', () => { /* Update to pause button */ })`
- `player.on('pause', () => { /* Update to play button */ })`

#### 7. Spacebar Keyboard Shortcut
Add keyboard shortcut:
- Key: Spacebar
- Action: Toggle play/pause
- Same logic as button click
- Prevent default (don't scroll page)

Event listener:
```javascript
document.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.code === 'Space') {
    e.preventDefault();
    togglePlayPause();
  }
});
```

#### 8. Visual Button States
**Normal state**:
- Play/Pause icon visible
- Thick border (3px)
- Background: secondary color

**Hover state**:
- Border color change or highlight
- Subtle background color change
- Offset shadow (brutalist style)
- Cursor: pointer

**Active/Click state**:
- Translate down slightly (2-3px)
- Scale down (0.95x)
- Immediate visual feedback

**Disabled state** (no video loaded):
- Grayed out, reduced opacity (0.5)
- Cursor: not-allowed
- No hover effect

#### 9. Button Icon
Use icon approach:

**Option A - Emoji**:
- Play: "▶️" or "⯈"
- Pause: "⏸️" or "❚❚"

**Option B - SVG Icons**:
- Inline SVG for play/pause icons
- More styling control

**Option C - Icon Font** (e.g., Font Awesome):
- `<i class="fa-solid fa-play"></i>`

Recommendation: **Emoji or SVG** for simplicity.

#### 10. Edge Cases
- **Play when no video loaded**: Button disabled, show error toast
- **Play when video ended**: Restart from beginning (seek to 0)
- **Rapid clicking**: Debounce or disable button during transition
- **Play fails** (autoplay policy): Show error, stay on pause button
- **Player not ready**: Disable button until ready

#### 11. Video End Behavior
When video reaches end:
- Player pauses automatically
- Update button to play (▶️)
- `isPlaying = false`
- Listen to `ended` event: `player.on('ended', () => { /* Update UI */ })`

#### 12. Error Handling
Handle playback errors:
- **Play fails** (browser policy, corrupt video): Show error notification
- **Player disposed**: Disable button
- **Network error during play**: Show buffering indicator (not in this phase)

#### 13. Integration with Player (Phase 49)
Connect to MediaBunny player instance:
- Get player reference from PreviewPlayer module
- Check if player ready before allowing play
- Disable button if no video loaded

#### 14. Accessibility
- Button has `aria-label="Play"` or `aria-label="Pause"` (changes with state)
- Keyboard accessible (Tab to focus, Enter/Space to activate)
- Spacebar shortcut documented
- Announce state changes: "Video playing" / "Video paused"

#### 15. Styling Requirements
Apply Dark Neobrutalism theme:
- Button: Thick border (3px), square or minimal rounding
- Hover: Offset shadow (4px)
- Active: Translate down (2px)
- Icon: Bold, high contrast
- Use CSS transitions for smooth state changes
- BEM naming: `.player-controls__play-pause`, `.player-controls__play-pause--playing`

#### 16. Files to Create/Modify
- `editor.html` - Add Play/Pause button to controls area
- `assets/css/editor.css` - Add button styles
- `assets/js/preview-player.js` - Add play/pause logic
- `assets/js/keyboard-shortcuts.js` - Optional: centralized keyboard handler

#### 17. JavaScript Organization
Extend PreviewPlayer class:
- `togglePlayPause()` - Main toggle method
- `play()` - Play video
- `pause()` - Pause video
- `updatePlayPauseButton(isPlaying)` - Update button icon
- `onPlaybackStateChange()` - Handle player events
- `attachPlayPauseHandlers()` - Event listeners

#### 18. Data Attributes
- `data-control="play-pause"` on button
- `data-state="playing|paused"` to track visual state (optional)

#### 19. What NOT to Do
- ❌ Do NOT add progress bar or scrubbing yet (comes in later phases)
- ❌ Do NOT add volume controls (Phase 58)
- ❌ Do NOT add fullscreen (Phase 53)
- ❌ Do NOT add playback speed controls (not in scope)
- This phase is **play/pause ONLY**

**MediaBunny Integration**: Use Player.play() and Player.pause() methods

## References
- **Phase 49**: Player instance to control
- **Phase 48**: Controls area where button placed
- **Phase 51**: Will add time display
- **MediaBunny Docs**: See mediabunny-llms-full.md for play/pause API

## Testing Checklist
- [ ] Play/Pause button visible in controls area
- [ ] Button shows play icon (▶️) when video paused
- [ ] Click button starts video playback
- [ ] Button icon changes to pause (⏸️) when playing
- [ ] Click pause button stops playback
- [ ] Button icon changes back to play (▶️) when paused
- [ ] Spacebar toggles play/pause
- [ ] Spacebar doesn't scroll page
- [ ] Button disabled when no video loaded
- [ ] Button grayed out when disabled
- [ ] Hover effect on button
- [ ] Click effect (translate down)
- [ ] Video ended event updates button to play
- [ ] Rapid clicking doesn't cause issues
- [ ] Play promise rejection handled gracefully
- [ ] `aria-label` updates with state
- [ ] Keyboard accessible (Tab, Enter)
- [ ] No console errors

## Done When
✅ Play/Pause button functional  
✅ Click toggles playback  
✅ Button icon updates with state  
✅ Spacebar shortcut works  
✅ Player events handled correctly  
✅ Disabled state when no video  
✅ Dark Neobrutalism styling  
✅ All tests pass  
✅ Ready for Phase 51 (Time Display)

---
**Phase**: 50 | **Component**: Editor | **Group**: Preview Player  
**Estimated Time**: 20 min

## Implementation Notes
- player.play() returns a promise (handle rejection)
- Listen to player events for accurate state tracking
- Spacebar is universal play/pause shortcut
- Keep logic simple - just play/pause, no advanced controls
- Button should be disabled until video loaded (Phase 49)
