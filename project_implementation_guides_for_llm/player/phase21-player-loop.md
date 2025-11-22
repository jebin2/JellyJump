# Phase 21: Player A-B Loop

## Goal
Implement A-B section loop functionality for repeating video segments

**MediaBunny Integration**: Use MediaBunny's seek and playback control for precise loop timing. **Consult** mediabunny-llms-full.md for timestamp management.

## Features to Implement

### Feature 1: Loop Button
**Purpose**: Toggle loop mode on/off

**Requirements**:
- Loop button (🔁) in control bar
- Toggle states: Off, A-B Loop, Full Loop
- Visual state indicator (color change when active)
- Apply theme styling
- Tooltip explaining current mode

### Feature 2: Set A Marker (Loop Start)
**Purpose**: Define loop start point

**Requirements**:
- Button or keyboard shortcut to set A marker
- **Keyboard: I** (In-point) sets A marker
- Set A marker at current playback time
- Visual indicator on progress/seek bar (green marker)
- Show A marker timestamp (optional)

### Feature 3: Set B Marker (Loop End)
**Purpose**: Define loop end point

**Requirements**:
- Button or keyboard shortcut to set B marker
- **Keyboard: O** (Out-point) sets B marker
- Set B marker at current playback time
- Visual indicator on progress/seek bar (red marker)
- Show B marker timestamp (optional)
- B marker must be after A marker (validation)

### Feature 4: A-B Loop Playback
**Purpose**: Loop between A and B points

**Requirements**:
- **Consult**: mediabunny-llms-full.md for precise seeking
- When A and B both set, loop automatically activates
- Play from A to B, then seek back to A and repeat
- Seamless loop (minimize gap/delay)
- Continue looping until loop mode disabled
- Use MediaBunny's seek for accurate positioning

### Feature 5: Full Video Loop
**Purpose**: Loop entire current video

**Requirements**:
- Option to loop entire video (start to end)
- Separate from A-B loop mode
- When video ends, seek to 0 and replay
- Visual indicator showing fullloop active
- Disable when moving to next video

### Feature 6: Clear/Reset Loop
**Purpose**: Remove loop markers

**Requirements**:
- Clear button to remove A and B markers
- Reset to normal playback (no loop)
- Remove visual markers from seek bar
- Can also be done by disabling loop button

### Feature 7: Visual Indicators on Seek Bar
**Purpose**: Show loop region visually

**Requirements**:
- Highlight A-B region on progress/seek bar
- Different background color for loop section
- A marker: green vertical line
- B marker: red vertical line
- Shaded region between A and B
- Apply theme colors

## Testing Checklist
- [ ] Loop button toggles loop mode
- [ ] I key sets A marker correctly
- [ ] O key sets B marker correctly
- [ ] Visual markers appear on seek bar
- [ ] A-B loop plays repeatedly between markers
- [ ] Full video loop works
- [ ] Clear loop removes markers
- [ ] Works correctly with MediaBunny seeking

## Done When
✅ Loop button functional  
✅ A and B markers can be set  
✅ A-B loop playback works seamlessly  
✅ Visual indicators on seek bar  
✅ Keyboard shortcuts work (I, O)  
✅ MediaBunny integration confirmed  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 21 | **Component**: Player  
**Estimated Time**: 45-60 minutes
