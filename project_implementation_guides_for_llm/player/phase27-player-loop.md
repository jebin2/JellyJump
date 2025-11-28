- Loop button (🔁) in control bar with mode indicator
- Three toggle states:
  1. **Loop Current Video**: Loops the entire current video
  2. **Loop Entire Playlist**: Loops through all videos in playlist
  3. **Loop A-B Section**: Loops between set start and end points
- Click to cycle through modes (Off → Current Video → Playlist → A-B → Off)
- Visual state indicator (different colors/icons for each mode)
- Apply theme styling
- Tooltip explaining current mode

### Feature 2: Loop Current Video
**Purpose**: Repeat the currently playing video

**Requirements**:
- When video ends, seek to 0 and replay automatically
- Visual indicator showing "Loop: Current Video" active
- Continue looping until mode changed or disabled
- Works independently of playlist

### Feature 3: Loop Entire Playlist
**Purpose**: Continuously play through all playlist videos

**Requirements**:
- Play all videos in playlist sequentially
- When last video ends, return to first video
- Visual indicator showing "Loop: Playlist" active
- Continue looping through playlist until disabled
- Respect video order in playlist

### Feature 4: Set A Marker (Loop Start)
**Purpose**: Define loop start point for A-B mode

**Requirements**:
- Button or keyboard shortcut to set A marker
- **Keyboard: I** (In-point) sets A marker
- Set A marker at current playback time
- Visual indicator on progress/seek bar (green marker)
- Show A marker timestamp
- Only active in A-B loop mode

### Feature 5: Set B Marker (Loop End)
**Purpose**: Define loop end point for A-B mode

**Requirements**:
- Button or keyboard shortcut to set B marker
- **Keyboard: O** (Out-point) sets B marker
- Set B marker at current playback time
- Visual indicator on progress/seek bar (red marker)
- Show B marker timestamp
- B marker must be after A marker (validation)
- Only active in A-B loop mode

### Feature 6: A-B Loop Playback
**Purpose**: Loop between specified start and end times

**Requirements**:
- **Consult**: mediabunny-llms-full.md for precise seeking
- Requires both A and B markers to be set
- Play from A to B, then seek back to A and repeat
- Seamless loop (minimize gap/delay)
- **Prompt for start/end times if not set**: Show modal/dialog asking user to:
  - Input start time (or click "Set A at current time")
  - Input end time (or click "Set B at current time")
  - Time format: MM:SS or HH:MM:SS
- Continue looping until loop mode changed or disabled
- Use MediaBunny's seek for accurate positioning

### Feature 7: Clear/Reset Loop Markers
**Purpose**: Remove A-B loop markers

**Requirements**:
- Clear button to remove A and B markers
- Keeps A-B loop mode active but prompts for new markers
- Remove visual markers from seek bar
- Shortcut: **Shift+L** to clear markers

### Feature 8: Visual Indicators on Seek Bar
**Purpose**: Show loop region visually (A-B mode only)

**Requirements**:
- Highlight A-B region on progress/seek bar
- Different background color for loop section (e.g., semi-transparent blue)
- A marker: green vertical line with "A" label
- B marker: red vertical line with "B" label
- Shaded region between A and B
- Apply theme colors
- Only show when in A-B loop mode

### Feature 9: Loop Mode UI Panel
**Purpose**: Provide clear controls for all loop modes

**Requirements**:
- Dedicated loop control section (expandable panel or always visible)
- Shows current loop mode prominently
- For A-B mode:
  - Display current A and B timestamps
  - "Set A" and "Set B" buttons
  - "Clear Markers" button
  - Input fields for manual time entry
- For Current Video mode: Show "Looping current video" status
- For Playlist mode: Show "Looping playlist (X videos)" status

---

## Testing Checklist
- [ ] Loop button cycles through all three modes correctly
- [ ] Loop Current Video repeats single video seamlessly
- [ ] Loop Entire Playlist plays through all videos and restarts
- [ ] A-B mode prompts for start/end time when not set
- [ ] I key sets A marker correctly
- [ ] O key sets B marker correctly
- [ ] Manual time entry works for A and B markers
- [ ] Visual markers appear on seek bar (A-B mode only)
- [ ] A-B loop plays repeatedly between markers
- [ ] Clear markers works (Shift+L)
- [ ] Works correctly with MediaBunny seeking
- [ ] Mode indicator shows correct state
- [ ] Switching between modes works smoothly

---

## Done When
✅ All three loop modes implemented  
✅ Loop mode selector cycles correctly  
✅ Current video loop works seamlessly  
✅ Playlist loop works across all videos  
✅ A-B loop prompts for times and loops correctly  
✅ A and B markers can be set via keyboard/button/input  
✅ Visual indicators on seek bar (A-B mode)  
✅ Keyboard shortcuts work (I, O, Shift+L)  
✅ MediaBunny integration confirmed  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 27 | **Component**: Player  
**Estimated Time**: 60-90 minutes