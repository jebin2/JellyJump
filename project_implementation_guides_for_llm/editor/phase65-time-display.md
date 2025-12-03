# Phase 57: Time Display

## Goal
Display current time and duration from the existing MediaBunny Player.

---

## What to Build

Time display:
- Current time indicator
- Total duration display
- Format: MM:SS or HH:MM:SS
- Real-time updates
- Monospace font
- Timecode accuracy

---

## Feature to Implement

### ONE Feature: Time Display
**Purpose**: Show playback progress (e.g., "00:05 / 01:30").

**Requirements**:

#### 1. What to Build
- **UI**: Text element in controls area: `00:00 / 00:00`.
- **Logic**:
    - Listen to `player.on('timeupdate', callback)`.
    - Read `player.currentTime` and `player.duration`.
    - Format seconds to `MM:SS`.
    - Update text content.

#### 2. Formatting
- Helper function: `formatTime(seconds)`.
- If duration > 1 hour, use `HH:MM:SS`.

#### 3. Files to Create/Modify
- `assets/js/preview-player.js`
- `assets/js/utils/time-format.js` (Reusable helper)

#### 4. MediaBunny Integration
- Use `player.currentTime` and `player.duration`.
- Note: `duration` might be `NaN` until `loadedmetadata` event fires.

#### 5. What NOT to Do
- ❌ Do NOT use `setInterval` to poll time. Use the player's event.

---

## Testing Checklist Checklist
- [ ] Time updates during playback
- [ ] Duration appears after video loads
- [ ] Formatting is correct (00:00)
- [ ] Handles NaN duration gracefully

---

## Done When
✅ Time display updates in real-time  
✅ Duration is correct  
✅ Ready for Phase 52
