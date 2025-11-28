# Phase 26: Player Speed Control

## Goal
Add playback speed control with dropdown menu and keyboard shortcuts.

**MediaBunny Note**: Consult `mediabunny-llms-full.md` for playback rate control APIs.

---

## What to Build

Speed control system with:
- Speed button showing current rate
- Dropdown menu with preset speeds
- Keyboard shortcuts for adjustment
- localStorage persistence
- MediaBunny playback rate integration

---

## Features to Implement

### Feature 1: Speed Control Button
**Purpose**: Add speed selector to controller

**Requirements**:
- Speed button in control bar
- Shows current speed (e.g., "1x", "1.5x", "0.5x")
- Click opens speed selector dropdown/menu
- Position near other playback controls
- Apply theme styling
- Tooltip: "Playback speed"

### Feature 2: Speed Options Menu
**Purpose**: Provide speed selection dropdown

**Requirements**:
- Dropdown menu with speed options
- Options: **0.25x**, **0.5x**, **0.75x**, **1x (Normal)**, **1.25x**, **1.5x**, **1.75x**, **2x**
- Highlight current speed selection (checkmark or bold)
- Close menu after selection
- Close on click outside or ESC key
- Apply theme styling (borders, shadows)

### Feature 3: Apply Speed Using MediaBunny
**Purpose**: Change playback rate

**Requirements**:
- Set MediaBunny playback rate when speed selected
- Immediate effect (no delay/buffering)
- Audio pitch should adjust with speed (if supported by browser)
- Maintain current playback position
- Smooth transition (no stuttering)

### Feature 4: Speed Indicator
**Purpose**: Show active speed visually

**Requirements**:
- Button displays current speed value ("1x", "2x", etc.)
- Visual indicator when speed ≠ 1x (e.g., accent color, different icon)
- Update button text immediately when speed changes
- Clear indication of "Normal" (1x) vs modified speed

### Feature 5: Keyboard Shortcuts
**Purpose**: Quick speed adjustments

**Requirements**:
- **< (Shift + ,)**: Decrease speed (step down to previous preset)
- **> (Shift + .)**: Increase speed (step up to next preset)
- Cycle through predefined speeds (0.25x → 0.5x → ... → 2x)
- Don't go below 0.25x or above 2x
- Update UI when keyboard shortcut used
- Document shortcuts

### Feature 6: Persist Speed Setting
**Purpose**: Remember user's preferred speed

**Requirements**:
- Save speed preference to localStorage: `playbackSpeed`
- Apply saved speed when loading new videos
- Global preference (applies to all videos)
- Optional: Reset to 1x button in menu

---

## Interaction Behavior

**User Flow 1: Change Speed via Menu**:
1. User clicks speed button (shows "1x")
2. Dropdown menu opens
3. User selects "1.5x"
4. Menu closes
5. Playback speeds up immediately
6. Button updates to "1.5x"
7. Speed saved to localStorage

**User Flow 2: Keyboard Shortcuts**:
1. User playing at 1x
2. User presses > (Shift + .)
3. Speed increases to 1.25x
4. Button updates
5. User presses > again
6. Speed increases to 1.5x

**User Flow 3: New Video**:
1. User loads new video
2. Previously saved speed (1.5x) applied automatically
3. Button shows "1.5x"
4. Video plays at 1.5x

---

## Edge Cases

- Speed applied during pause: Works when playback resumes
- Speed at boundaries (0.25x or 2x): Shortcuts don't go further
- Very slow speeds (<0.5x): Ensure audio still works
- Very fast speeds (>2x): May cause frame drops on weak devices
- No stored speed: Default to 1x
- Invalid stored speed: Reset to 1x

---

## Accessibility

- Speed button: aria-label="Playback speed: [current]x"
- Menu items: aria-checked for selected speed
- Dropdown: role="menu", items role="menuitem"
- Keyboard navigation in menu (arrow keys)
- Screen reader announces speed changes

---

## What NOT to Do

- ❌ Don't reset speed when switching videos (use persistent setting)
- ❌ Don't allow speeds outside 0.25x-2x range
- ❌ Don't forget to update UI on keyboard shortcuts
- ❌ Don't apply speed that causes audio/video desync
- ❌ Don't block playback while changing speed

---

## MediaBunny Integration

This phase requires MediaBunny for playback rate control.

**Consult `mediabunny-llms-full.md`** for:
- Playback rate/speed control APIs
- Audio pitch preservation (if available)
- Handling speed changes during playback

**Suggested approach**: Use MediaBunny's playback rate property or method to adjust speed, verify audio behavior at different speeds.

---

## Testing Checklist

- [ ] Speed button visible in controller
- [ ] Dropdown shows all speed options
- [ ] Selecting speed changes playback rate immediately
- [ ] Current speed highlighted in menu
- [ ] Keyboard shortcuts work (< and >)
- [ ] Speed persists across videos
- [ ] Button updates to show current speed
- [ ] Works correctly with MediaBunny
- [ ] Audio pitch adjusts (or remains consistent)
- [ ] No playback interruption when changing speed

---

## Done When

✅ Speed control functional  
✅ All speeds work correctly (0.25x - 2x)  
✅ Keyboard shortcuts implemented  
✅ Speed indicator updates  
✅ localStorage persistence working  
✅ MediaBunny integration confirmed  
✅ All tests pass  
✅ Ready for next phase

---

**Phase**: 26 | **Component**: Player  
**Estimated Time**: 35-45 minutes
