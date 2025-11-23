# Phase 58: Volume Slider Control

## Goal
Volume slider (0-100%), apply to selected clip

## Group
**Properties Panel**

## Feature to Implement

### ONE Feature: Volume Slider Control
**Purpose**: Allow users to adjust volume level of selected audio/video clip

**Requirements**:

#### 1. What to Build
Add volume slider to "Audio" section:
- Horizontal slider (range input)
- Range: 0% - 200% (allow boost above 100%)
- Default: 100% (normal volume)
- Numeric display showing current value
- Real-time preview (optional)
- Apply to selected clip

#### 2. Slider Layout
Structure within "Audio" section:
- Label: "Volume"
- Slider: HTML5 range input
- Value display: "100%" (updates as slider moves)
- Optional: Percentage indicator or dB

Layout:
```
Volume       [----●----]  100%
```

#### 3. Slider Configuration
HTML5 range input:
- Type: `<input type="range">`
- Min: 0
- Max: 200 (allow boosting volume)
- Step: 1 (or 5 for coarser control)
- Default value: 100
- ID/name: "volume-slider"

#### 4. Value Display
Show current volume value:
- Format: "100%" or "150%"
- Position: Right of slider
- Updates in real-time as slider moves
- Font: Monospace for aligned digits

Optional: Show dB (decibels):
- 100% = 0 dB
- 200% = +6 dB
- 50% = -6 dB
- Calculation: `20 * log10(value / 100)`

Recommendation: **Percentage only** (simpler for users).

#### 5. Slider Interaction
When user moves slider:
1. Read slider value (0-200)
2. Update value display: "150%"
3. Update clip data: `clip.volume = value / 100` (0.0 - 2.0)
4. Apply to MediaBunny player (if clip playing in preview)
5. Optional: Real-time preview while dragging

#### 6. Applying Volume to Clip
Store volume in clip data:
```javascript
clip.volume = sliderValue / 100; // 0.0 to 2.0
```

Apply to player (Phase 49):
- If clip currently playing: `player.volume = clip.volume`
- MediaBunny Player API: `player.volume` property (0.0 to 1.0)
- Note: Values > 1.0 may cause distortion (warn user)

#### 7. Default Volume
When clip first added:
- Default volume: 100% (1.0)
- Slider shows 100%
- Store in clip object

When clip selected:
- Read clip.volume
- Set slider to clip.volume * 100
- Update value display

#### 8. Volume Boost Warning
If volume > 100%:
- Optional: Show warning icon ⚠️
- Tooltip: "High volume may cause distortion"
- Still allow user to set high values

#### 9. Muted Clips
If clip is muted (Phase 59):
- Slider still functional
- Volume value preserved
- Visual indication that clip is muted
- Unmuting restores volume to slider value

#### 10. Styling Requirements
Apply Dark Neobrutalism theme:

**Slider track**:
- Thick track (6-8px height)
- Background: Secondary color
- Filled portion: Accent/primary color
- Border: 2px solid

**Slider thumb** (handle):
- Square or circular (20x20px)
- Thick border (3px)
- Offset shadow on hover
- Grabbing cursor

**Value display**:
- Monospace font
- Bold or highlighted when > 100%
- Warning color if > 150%

BEM naming: `.volume-control`, `.volume-control__slider`, `.volume-control__value`

#### 11. Keyboard Control
Slider keyboard accessible:
- Arrow keys: Adjust by step (1% or 5%)
- Page Up/Down: Large jumps (10%)
- Home: Min value (0%)
- End: Max value (200%)

#### 12. Real-Time Preview (Optional)
While dragging slider:
- Apply volume to player immediately
- User hears volume change in real-time
- Smooth updates (throttle to avoid performance issues)

For this phase: Can skip real-time preview, just update on release.

#### 13. Edge Cases
- **No clip selected**: Slider disabled, grayed out
- **Audio clip vs video clip**: Both support volume
- **Image clip**: Slider disabled (no audio)
- **Volume at 0%**: Equivalent to mute
- **Volume > 100%**: Allow but warn

#### 14. Accessibility
- Slider has `aria-label="Volume level"`
- Value display has `aria-live="polite"` (announces changes)
- Slider shows current value: `aria-valuenow="100"`, `aria-valuemin="0"`, `aria-valuemax="200"`
- Keyboard accessible (arrow keys)

#### 15. Integration with Player (Phase 49)
If clip playing in preview:
- Update player volume when slider changes
- `player.volume = clipVolume`
- Note: MediaBunny player volume range is 0.0-1.0, so normalize

#### 16. Files to Create/Modify
- `editor.html` - Add volume slider to "Audio" section
- `assets/css/editor.css` - Add slider styles
- `assets/js/properties-panel.js` - Add slider logic and value update

#### 17. JavaScript Organization
Extend PropertiesPanel class:
- `updateVolumeSlider(clipData)` - Set slider to clip's volume
- `onVolumeChange()` - Handle slider input event
- `applyVolumeToClip(clipId, volume)` - Update clip data
- `applyVolumeToPlayer(volume)` - Update preview player (optional)
- `attachVolumeHandlers()` - Event listeners

#### 18. Data Attributes
- `data-control="volume"` on slider input
- `data-volume-value` on value display element

#### 19. What NOT to Do
- ❌ Do NOT add audio waveform visualization (out of scope)
- ❌ Do NOT add per-channel volume (L/R balance) - single volume only
- ❌ Do NOT add fade-in/fade-out controls (those are separate effects)
- ❌ Do NOT add audio normalization (auto-adjust volume)
- This phase is **volume slider ONLY**

**MediaBunny Integration**: Apply volume to Player.volume property

## References
- **Phase 49**: Player instance to apply volume
- **Phase 56**: "Audio" section (slider goes here)
- **Phase 57**: Clip data structure (volume stored per clip)
- **Phase 59**: Mute toggle (interacts with volume)

## Testing Checklist
- [ ] Volume slider visible in "Audio" section
- [ ] Slider range: 0-200
- [ ] Default value: 100%
- [ ] Value display shows "100%"
- [ ] Drag slider updates value display in real-time
- [ ] Value display format: "150%", "50%"
- [ ] Slider styled with Dark Neobrutalism theme
- [ ] Thick track, brutalist thumb
- [ ] Arrow keys adjust volume
- [ ] Page Up/Down for large jumps
- [ ] Home key sets to 0%, End to 200%
- [ ] Slider disabled when no clip selected
- [ ] Slider enabled when clip selected
- [ ] Volume > 100% allowed
- [ ] Clip data updates with volume value
- [ ] Preview player volume updates (if clip playing)
- [ ] No performance issues during drag
- [ ] Keyboard accessible
- [ ] `aria-valuenow` updates
- [ ] No console errors

## Done When
✅ Volume slider functional in "Audio" section  
✅ Range 0-200%, default 100%  
✅ Value display updates in real-time  
✅ Clip data stores volume  
✅ Player volume updates (if playing)  
✅ Keyboard accessible  
✅ Dark Neobrutalism styling  
✅ All tests pass  
✅ Ready for Phase 59 (Mute Toggle Button)

---
**Phase**: 58 | **Component**: Editor | **Group**: Properties Panel  
**Estimated Time**: 20 min

## Implementation Notes
- HTML5 range input well-supported
- Allow volume boost (> 100%) for flexibility
- Store volume as 0.0-2.0 in clip data (multiply slider value / 100)
- MediaBunny Player.volume typically 0.0-1.0 (may need clamping or gain node)
- Real-time preview optional but nice UX enhancement
- Volume persists per clip (each clip has its own volume)
