## Features to Implement

### Feature 1: Speed Control Button
**Purpose**: Add speed selector to controller

**Requirements**:
- Speed button in control bar
- Shows current speed (e.g., "1x", "1.5x")
- Click opens speed selector dropdown/menu
- Position near other playback controls
- Apply theme styling

### Feature 2: Speed Options Menu
**Purpose**: Provide speed selection dropdown

**Requirements**:
- Dropdown menu with speed options
- Options: 0.25x, 0.5x, 0.75x, **1x (Normal)**, 1.25x, 1.5x, 1.75x, 2x
- Highlight current speed selection
- Close menu after selection
- Apply theme styling (borders, shadows)

### Feature 3: Apply Speed Using MediaBunny
**Purpose**: Change playback rate

**Requirements**:
- **Consult**: mediabunny-llms-full.md for playback rate control
- Set MediaBunny playback rate when speed selected
- Immediate effect (no delay/buffering)
- Audio pitch should adjust with speed (if supported)
- Maintain current playback position

### Feature 4: Speed Indicator
**Purpose**: Show active speed visually

**Requirements**:
- Button displays current speed value
- Visual indicator when speed ≠ 1x (e.g., accent color)
- Update button text when speed changes
- Clear indication of "Normal" (1x) vs modified speed

### Feature 5: Keyboard Shortcuts
**Purpose**: Quick speed adjustments

**Requirements**:
- **< (Shift + ,)**: Decrease speed (step down)
- **> (Shift + .)**: Increase speed (step up)
- Cycle through predefined speeds
- Don't go below 0.25x or above 2x
- Update UI when keyboard shortcut used

### Feature 6: Persist Speed Setting
**Purpose**: Remember user's preferred speed

**Requirements**:
- Save speed preference to localStorage
- Apply saved speed when loading new videos
- Per-session or global (user choice)
- Reset option to 1x available

## Testing Checklist
- [ ] Speed button visible in controller
- [ ] Dropdown shows all speed options
- [ ] Selecting speed changes playback rate
- [ ] Current speed highlighted in menu
- [ ] Keyboard shortcuts work (\<, \>)
- [ ] Speed persists across videos
- [ ] Works correctly with MediaBunny

## Done When
✅ Speed control functional  
✅ All speeds work correctly  
✅ Keyboard shortcuts implemented  
✅ Speed indicator updates  
✅ MediaBunny integration confirmed  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 26 | **Component**: Player  
**Estimated Time**: 35-45 minutes
