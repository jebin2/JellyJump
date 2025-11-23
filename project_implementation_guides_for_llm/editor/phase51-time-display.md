# Phase 51: Time Display

## Goal
Current time / Total duration, format: 00:00:05 / 00:00:30, real-time update

## Group
**Preview Player**

## Feature to Implement

### ONE Feature: Time Display
**Purpose**: Show current playback time and total video duration

**Requirements**:

#### 1. What to Build
Add time display to player controls:
- Current time (updates during playback)
- Total duration (static)
- Format: "00:00:05 / 00:00:30" or "0:05 / 0:30"
- Real-time updates (every frame or second)
- Positioned in controls area

#### 2. Display Format
Two format options:

**Option A - Full format** (HH:MM:SS):
- "00:00:05 / 00:00:30" for short videos
- "00:15:45 / 01:30:00" for long videos
- Always show hours

**Option B - Minimal format** (M:SS or H:MM:SS):
- "0:05 / 0:30" for videos < 1 hour
- "1:15:45 / 2:30:00" for videos >= 1 hour
- Show hours only when needed

Recommendation: **Option B - Minimal format** (more compact).

#### 3. Layout Position
Place in controls area:
- Location: Center-right or right side
- After play/pause button
- Before volume/fullscreen buttons
- Format: `[Current] / [Duration]`
- Font: Monospace for aligned digits

Example placement:
```
[Play/Pause] [Progress Bar] [0:45 / 2:30] [Volume] [Fullscreen]
```

#### 4. Time Formatting Function
Create helper function to format seconds:

```javascript
Example:
formatTime(65) → "1:05"
formatTime(3665) → "1:01:05"
formatTime(45) → "0:45"
```

Logic:
- Extract hours, minutes, seconds from total seconds
- Pad minutes/seconds with leading zero if < 10
- Omit hours if video < 1 hour
- Return formatted string

#### 5. Getting Current Time from Player
Use MediaBunny Player API:
- Current time: `player.currentTime` (in seconds)
- Duration: `player.duration` (in seconds)
- Update frequency: Every frame (`requestAnimationFrame`) OR every 100-500ms

Listen to time update event:
```javascript
player.on('timeupdate', () => {
  const current = player.currentTime;
  const duration = player.duration;
  updateTimeDisplay(current, duration);
});
```

#### 6. Real-Time Updates
Update current time as video plays:

**Option A - Event-driven** (recommended):
- Listen to `timeupdate` event from player
- Update display when event fires (~every 250ms)

**Option B - requestAnimationFrame**:
- Poll `player.currentTime` every frame
- Smoother but more CPU intensive

**Option C - setInterval**:
- Poll every 100-500ms
- Simple but less accurate

Recommendation: **Option A - timeupdate event** (most efficient).

#### 7. Duration Display
Show total duration:
- Get from `player.duration` after video loads
- Display immediately when video ready
- Duration is static (doesn't change during playback)

Handle duration not available:
- Show "0:00" or "--:--" until duration known
- Duration available after `loadedmetadata` event

#### 8. Initial State
Before video loaded:
- Show: "0:00 / 0:00" or "--:-- / --:--"
- Update once video loads

After video loaded:
- Show: "0:00 / [duration]"
- Current time starts at 0:00

#### 9. Edge Cases
- **Very short videos** (< 10 seconds): "0:05 / 0:08"
- **Very long videos** (> 1 hour): "1:23:45 / 2:15:30"
- **Live streams** (no duration): Show current time only, omit duration
- **Duration unknown**: Show "--:--" for duration
- **Seeking**: Time jumps immediately when user seeks (later phase)

#### 10. Styling Requirements
Apply Dark Neobrutalism theme:
- Font: Monospace (Courier, Monaco, or monospace fallback)
- Size: 14-16px
- Color: High contrast (white or theme text color)
- Background: Optional subtle background box
- Padding: 4-8px
- No thick border (keeps it subtle)
- BEM naming: `.player-controls__time`, `.player-controls__time--current`, `.player-controls__time--duration`

#### 11. Accessibility
- Use semantic HTML: `<time>` element
- Add `aria-label="Current time 0 minutes 45 seconds of 2 minutes 30 seconds"`
- Update aria-label as time changes (or use live region)
- OR: Use `role="timer"` for current time
- Screen readers should announce time periodically (every 10 seconds)

#### 12. Performance Optimization
For smooth updates:
- Throttle updates to max 10 updates/second (every 100ms)
- Don't update if time hasn't changed significantly (> 0.1 second)
- Use CSS to reduce repaints (GPU acceleration)

#### 13. Integration with Player (Phase 49-50)
Connect to existing player:
- Get player instance
- Listen to timeupdate event
- Get currentTime and duration properties
- Display in controls area created in Phase 48

#### 14. Files to Create/Modify
- `editor.html` - Add time display elements to controls area
- `assets/css/editor.css` - Add time display styles
- `assets/js/preview-player.js` - Add time tracking and display logic
- `assets/js/time-formatter.js` - Optional: utility for time formatting

#### 15. JavaScript Organization
Extend PreviewPlayer class:
- `formatTime(seconds)` - Helper function to format time
- `updateTimeDisplay()` - Update current time display
- `onTimeUpdate()` - Handle timeupdate event
- `getDuration()` - Get and format total duration
- `attachTimeUpdateHandler()` - Event listener setup

#### 16. Data Attributes
- `data-time="current"` on current time element
- `data-time="duration"` on duration element

#### 17. What NOT to Do
- ❌ Do NOT add seekable progress bar yet (comes in later phase)
- ❌ Do NOT add timestamp tooltips (comes with progress bar)
- ❌ Do NOT add remaining time display ("-0:45") - just current/duration
- ❌ Do NOT add frame-accurate timecode (HH:MM:SS:FF)
- This phase is **time display ONLY**

**MediaBunny Integration**: Use Player.currentTime and Player.duration properties

## References
- **Phase 49**: Player instance with time properties
- **Phase 50**: Play/Pause controls (time updates during playback)
- **Phase 71**: Will add timeline scrubbing (seeking)
- **MediaBunny Docs**: See mediabunny-llms-full.md for time properties

## Testing Checklist
- [ ] Time display visible in controls area
- [ ] Shows format: "0:00 / 2:30" (current / duration)
- [ ] Duration displays correctly when video loaded
- [ ] Current time starts at "0:00"
- [ ] Current time updates during playback
- [ ] Time updates smoothly (every ~250ms)
- [ ] Time formatted correctly: "1:05", "1:23:45"
- [ ] Hours shown only for videos >= 1 hour
- [ ] Monospace font for aligned digits
- [ ] Time stops updating when paused
- [ ] Time resumes updating when playing
- [ ] "--:--" shown before video loads (or "0:00")
- [ ] No performance issues during playback
- [ ] Time display readable (good contrast)
- [ ] No flickering or jumpiness
- [ ] No console errors

## Done When
✅ Time display functional in controls  
✅ Current time updates during playback  
✅ Duration shown correctly  
✅ Time formatted as M:SS or H:MM:SS  
✅ Monospace font applied  
✅ Real-time updates smooth  
✅ All tests pass  
✅ Ready for Phase 52 (Resolution & FPS Display)

---
**Phase**: 51 | **Component**: Editor | **Group**: Preview Player  
**Estimated Time**: 15 min

## Implementation Notes
- Use monospace font for consistent digit width
- timeupdate event fires ~4 times per second (every 250ms)
- Format function reusable across project (timeline, clips, etc.)
- Keep updates efficient - don't update DOM if time unchanged
- Duration available after loadedmetadata event
