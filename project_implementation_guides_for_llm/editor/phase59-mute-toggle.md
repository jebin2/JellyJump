# Phase 59: Mute Toggle Button

## Goal
Mute/unmute button, visual feedback

## Group
**Properties Panel**

## Feature to Implement

### ONE Feature: Mute Toggle Button
**Purpose**: Allow users to mute/unmute audio for selected clip

**Requirements**:

#### 1. What to Build
Add mute toggle button to "Audio" section:
- Button to mute/unmute clip
- Icon: 🔊 (unmuted) / 🔇 (muted)
- Toggle state visual (active/inactive)
- Preserve volume level when muted
- Position near volume slider (Phase 58)

#### 2. Button Layout
Position within "Audio" section:
- Location: To the left of volume slider OR below it
- Layout: `[Mute🔊] Volume [----●----] 100%`
- Button size: 36x36px or similar
- Icon: 🔊 when unmuted, 🔇 when muted

#### 3. Mute Toggle Logic
When button clicked:

**If unmuted**:
1. Mute the clip: `clip.isMuted = true`
2. Change button icon to muted (🔇)
3. Apply mute to player: `player.volume = 0` (or `player.muted = true`)
4. Preserve current volume level in clip data
5. Visual feedback: Button highlighted/active state
6. Log: "Clip muted"

**If muted**:
1. Unmute the clip: `clip.isMuted = false`
2. Change button icon to unmuted (🔊)
3. Restore volume to player: `player.volume = clip.volume`
4. Visual feedback: Button normal state
5. Log: "Clip unmuted"

#### 4. Volume Preservation
Muting should preserve volume:
- clip.volume stays the same (e.g., 1.5 for 150%)
- clip.isMuted added as separate boolean flag
- When unmuting: Restore volume to clip.volume value
- Volume slider (Phase 58) still shows volume level even when muted

#### 5. Button Icon States
**Unmuted (default)**:
- Icon: 🔊 or 🔈 (speaker with sound waves)
- Aria-label: "Mute"
- Normal button styling

**Muted (active)**:
- Icon: 🔇 or 🔈 with X (muted speaker)
- Aria-label: "Unmute"
- Highlighted button styling (different background/border)

#### 6. Visual Feedback
**Muted state indicators**:
- Button: Background color change (accent or warning color)
- Button: Thicker border or offset
- Icon: Red or warning color
- Optional: Strikethrough on volume label or slider grayed out

#### 7. Applying Mute to Player
If clip playing in preview (Phase 49):
- Muted: Set `player.volume = 0` OR `player.muted = true`
- Unmuted: Set `player.volume = clip.volume`

MediaBunny Player API options:
- `player.muted = true/false` (boolean property)
- OR: `player.volume = 0` (set volume to zero)

Recommendation: **Use player.muted property** if available (cleaner).

#### 8. Default Mute State
When clip first added:
- Default: unmuted (`clip.isMuted = false`)
- Button shows unmuted icon (🔊)

When clip selected:
- Read clip.isMuted
- Update button icon and state
- Apply mute to player if needed

#### 9. Interaction with Volume Slider
When clip is muted:
- Volume slider (Phase 58) still shows volume value
- Volume slider still adjustable
- Changing slider while muted updates clip.volume but doesn't unmute
- Unmuting restores to slider value

Workflow:
1. Clip at 100% volume, unmuted
2. User mutes → volume goes to 0, slider still shows 100%
3. User adjusts slider to 150%→ slider shows 150%, but clip still muted
4. User unmutes → volume restores to 150%

#### 10. Styling Requirements
Apply Dark Neobrutalism theme:

**Unmuted button**:
- Background: Secondary or transparent
- Border: 3px solid
- Icon: Normal color
- Hover: Background highlight

**Muted button** (active state):
- Background: Warning/accent color (red or orange)
- Border: 3px solid, accent color
- Icon: White or contrasting color
- Offset shadow or highlight

BEM naming: `.mute-button`, `.mute-button--muted`

#### 11. Keyboard Shortcut (Optional)
Add keyboard shortcut:
- Key: M
- Action: Toggle mute for selected clip
- Same logic as button click

For this phase: Optional enhancement.

#### 12. Edge Cases
- **No clip selected**: Button disabled, grayed out
- **Audio clip vs video clip**: Both support mute
- **Image clip**: Button disabled (no audio)
- **Volume at 0% vs muted**: Different states
  - 0% volume: User set volume to zero
  - Muted: User explicitly muted, volume preserved
- **Mute and unmute rapidly**: Should handle cleanly

#### 13. Accessibility
- Button has `aria-label="Mute"` or `aria-label="Unmute"` (toggles)
- Use `aria-pressed="true"` when muted, `aria-pressed="false"` when unmuted
- Keyboard accessible (Tab to focus, Enter/Space to toggle)
- Announce state changes: "Clip muted" / "Clip unmuted"

#### 14. Integration with Player (Phase 49)
If clip playing in preview:
- Update player muted state when button toggled
- `player.muted = clip.isMuted`
- OR: `player.volume = clip.isMuted ? 0 : clip.volume`

#### 15. Files to Create/Modify
- `editor.html` - Add mute button to "Audio" section
- `assets/css/editor.css` - Add mute button styles (normal and muted states)
- `assets/js/properties-panel.js` - Add mute toggle logic

#### 16. JavaScript Organization
Extend PropertiesPanel class:
- `updateMuteButton(clipData)` - Set button state from clip.isMuted
- `toggleMute()` - Toggle mute state
- `applyMuteToClip(clipId, isMuted)` - Update clip data
- `applyMuteToPlayer(isMuted)` - Update preview player
- `attachMuteHandlers()` - Event listeners

#### 17. Data Attributes
- `data-control="mute"` on mute button

#### 18. What NOT to Do
- ❌ Do NOT add solo functionality (mute all other clips)
- ❌ Do NOT add fade-in/fade-out when muting (instant mute)
- ❌ Do NOT add per-channel mute (L/R channels) - single mute
- ❌ Do NOT add mute timeline (keyframes for mute) - simple toggle
- This phase is **mute toggle ONLY**

**MediaBunny Integration**: Use Player.muted property or set Player.volume to 0

## References
- **Phase 49**: Player instance to apply mute
- **Phase 56**: "Audio" section (button goes here)
- **Phase 57**: Clip data structure (isMuted flag added)
- **Phase 58**: Volume slider (preserves value when muted)

## Testing Checklist
- [ ] Mute button visible in "Audio" section
- [ ] Button shows unmuted icon (🔊) by default
- [ ] Click button mutes clip
- [ ] Button icon changes to muted (🔇)
- [ ] Button background/styling changes (highlighted)
- [ ] Click button again unmutes clip
- [ ] Button icon returns to unmuted (🔊)
- [ ] Button styling returns to normal
- [ ] Clip data stores isMuted flag
- [ ] Volume preserved when muting/unmuting
- [ ] Volume slider shows volume even when muted
- [ ] Changing slider while muted updates volume (but stays muted)
- [ ] Unmuting restores to slider volume
- [ ] Player volume updates when mute toggled
- [ ] Button disabled when no clip selected
- [ ] Keyboard accessible (Tab, Enter)
- [ ] `aria-label` and `aria-pressed` update
- [ ] No console errors

## Done When
✅ Mute button functional in "Audio" section  
✅ Click toggles mute/unmute  
✅ Icon updates with state (🔊/🔇)  
✅ Visual feedback (highlighted when muted)  
✅ Volume preserved when muted  
✅ Clip data stores isMuted flag  
✅ Player mute state updates  
✅ Interacts correctly with volume slider  
✅ Keyboard accessible  
✅ All tests pass  
✅ Properties Panel Group COMPLETE ✅  
✅ Ready for Phase 60 (Timeline Container)

---
**Phase**: 59 | **Component**: Editor | **Group**: Properties Panel  
**Estimated Time**: 15 min

## Implementation Notes
- Mute is independent of volume (preserve volume value)
- Use player.muted property if available (cleaner than volume = 0)
- Button should have clear visual distinction between muted/unmuted
- This completes the Properties Panel group (Phases 54-59)
- Mute state stored per clip (each clip can be muted independently)
- Volume slider interaction: slider still works when muted, unmuting restores slider value
