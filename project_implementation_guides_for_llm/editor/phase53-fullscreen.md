# Phase 53: Full-Screen Toggle

## Goal
Toggle fullscreen mode for the Preview Panel.

## Group
**Preview Player**

## Feature to Implement

### ONE Feature: Fullscreen
**Purpose**: Expand the editor preview to fill the screen.

**Requirements**:

#### 1. What to Build
- **UI**: Fullscreen button (⛶).
- **Logic**:
    - Target: The `#preview-player-container` (or parent panel).
    - Action: `element.requestFullscreen()`.
    - Exit: `document.exitFullscreen()`.
    - **Sync**: Listen to `fullscreenchange` event to update button icon.

#### 2. MediaBunny Integration
- The `Player` component might have its own fullscreen method.
- **Decision**: Use the **Editor's** logic to fullscreen the *container*, so our custom controls remain visible (if they are inside the container).
- If controls are outside, fullscreen the wrapper that includes both video and controls.

#### 3. Files to Create/Modify
- `assets/js/preview-player.js`

#### 4. What NOT to Do
- ❌ Do NOT rely on the Player's built-in fullscreen button (we disabled controls in Phase 49).

## Testing Checklist
- [ ] Button toggles fullscreen
- [ ] Esc key exits fullscreen
- [ ] Controls remain visible in fullscreen
- [ ] Button icon updates

## Done When
✅ Fullscreen toggle works  
✅ Ready for Phase 54 (Properties Panel)
