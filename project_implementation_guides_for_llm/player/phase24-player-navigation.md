# Phase 24: Player Navigation Controls

## Goal
Add next/previous video buttons to controller for playlist navigation.

---

## What to Build

Navigation controls in the player control bar:
- Previous button (◀◀ or ⏮)
- Next button (▶▶ or ⏭)
- Smart disabled states at playlist boundaries
- Keyboard shortcuts for quick navigation

---

## Features to Implement

### Feature 1: Navigation Buttons
**Purpose**: Quick video switching controls

**Requirements**:
- "Previous" button (⏮ or ◀◀) in control bar
- "Next" button (⏭ or ▶▶) in control bar
- Position logically with playback controls
- Apply theme button styling
- Clear icons/labels
- Tooltip on hover

### Feature 2: Previous Video Functionality
**Purpose**: Jump to previous video in playlist

**Requirements**:
- Click loads and plays previous playlist item
- Disabled/grayed when at first video
- Visual disabled state (reduce opacity to 0.5)
- No action when clicked while disabled
- Reset playback position to start of previous video
- Update playlist highlight to new active item

### Feature 3: Next Video Functionality
**Purpose**: Jump to next video in playlist

**Requirements**:
- Click loads and plays next playlist item
- Disabled/grayed when at last video
- Visual disabled state (reduce opacity to 0.5)
- No action when clicked while disabled
- Reset playback position to start of next video
- Update playlist highlight to new active item

### Feature 4: Playlist Integration
**Purpose**: Sync with playlist state

**Requirements**:
- Update button states when playlist changes
- Highlight currently playing item in playlist
- Navigate to clicked playlist item (from Phase 22)
- Work seamlessly with auto-play next (from Phase 29)
- Handle playlist item removal gracefully
- Refresh button states on playlist modification

### Feature 5: Keyboard Shortcuts
**Purpose**: Quick navigation via keyboard

**Requirements**:
- **Shift + N**: Next video
- **Shift + P**: Previous video
- Document in keyboard shortcuts help
- Respect disabled states (no action at boundaries)
- Work when video player has focus

---

## Interaction Behavior

**User Flow 1: Navigate Next**:
1. User watching video #2 of 5
2. User clicks Next button
3. Video #3 loads and starts playing
4. Playlist highlights video #3
5. Previous button becomes enabled
6. Next button remains enabled

**User Flow 2: At Playlist Boundary**:
1. User watching last video (#5 of 5)
2. Next button is disabled (grayed out)
3. User clicks Next button → No action
4. User presses Shift+N → No action
5. Tooltip shows "No next video"

**User Flow 3: Keyboard Navigation**:
1. User presses Shift+N
2. Next video loads and plays
3. User presses Shift+P
4. Previous video loads and plays

---

## Edge Cases

- Both buttons disabled if playlist empty
- Both buttons disabled if only 1 video
- Show tooltip explaining why disabled (optional)
- Handle playlist item removal while playing
- If current video removed: Move to next or previous
- Rapid clicking: Debounce to prevent multiple loads
- Auto-play integration: Respect auto-play settings

---

## Accessibility

- Buttons have aria-label: "Previous video" / "Next video"
- Disabled state: aria-disabled="true"
- Keyboard shortcuts documented and functional
- Focus visible on buttons
- Screen reader announces when boundaries reached
- Tooltips readable by screen readers

---

## What NOT to Do

- ❌ Don't allow navigation when playlist is empty
- ❌ Don't forget to update playlist highlight
- ❌ Don't reset other player state (volume, speed, etc.)
- ❌ Don't ignore disabled state on keyboard shortcuts
- ❌ Don't overlap with existing playback controls

---

## Testing Checklist

- [ ] Previous button navigates to previous video
- [ ] Next button navigates to next video
- [ ] Buttons disabled appropriately at boundaries
- [ ] Keyboard shortcuts work (Shift+N, Shift+P)
- [ ] Button states update when playlist changes
- [ ] Works with empty/single-item playlists
- [ ] Playlist highlight updates correctly
- [ ] Video resets to start position on navigation
- [ ] Tooltips show on hover
- [ ] Disabled buttons don't respond to clicks

---

## Done When

✅ Navigation buttons functional  
✅ Previous/Next logic correct  
✅ Keyboard shortcuts work  
✅ Edge cases handled  
✅ Button states sync with playlist  
✅ All tests pass  
✅ Keyboard accessible  
✅ Ready for next phase

---

**Phase**: 24 | **Component**: Player  
**Estimated Time**: 30-40 minutes
