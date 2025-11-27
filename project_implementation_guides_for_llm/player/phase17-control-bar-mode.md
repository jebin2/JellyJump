# Phase 17: Control Bar Mode Toggle

## Goal
Implement toggle between overlay and fixed control bar modes to support both player and editor use cases.

## Features to Implement

### Feature 1: Overlay Mode (Default for Player)
**Purpose**: Standard video player experience with auto-hiding controls

**Requirements**:
- Control bar overlays the video content
- Auto-hide after 3 seconds of mouse inactivity
- Show on mouse movement or hover
- Video uses full container height
- Controls positioned absolutely over video
- Semi-transparent background (e.g., `rgba(0, 0, 0, 0.7)`)

**Behavior**:
- Mouse moves → Show controls, reset hide timer
- Mouse stops moving for 3s → Fade out controls
- Video paused → Keep controls visible
- Video playing + no mouse → Hide controls
- Touch on mobile → Toggle controls visibility

**CSS Approach**:
```css
.video-container {
  position: relative;
}

.controls.overlay {
  position: absolute;
  bottom: 0;
  width: 100%;
  opacity: 1;
  transition: opacity 300ms;
}

.controls.overlay.hidden {
  opacity: 0;
  pointer-events: none;
}
```

### Feature 2: Fixed Mode (For Editor)
**Purpose**: Always-visible controls for editing workflows

**Requirements**:
- Control bar is fixed below video (not overlaying)
- Always visible (no auto-hide)
- Video area height reduced to accommodate controls
- Solid background (no transparency)
- Controls positioned in normal document flow
- Suitable for scrubbing, precise editing

**Layout**:
```
┌────────────────────┐
│                    │
│   Video Content    │ ← Height: calc(100% - controls height)
│                    │
├────────────────────┤
│    Controls        │ ← Fixed, always visible
└────────────────────┘
```

**CSS Approach**:
```css
.video-container.fixed-mode {
  display: flex;
  flex-direction: column;
}

.video-wrapper {
  flex: 1;
  min-height: 0;
}

.controls.fixed {
  position: relative;
  background: var(--color-bg-secondary);
  opacity: 1;
}
```

### Feature 3: Mode Toggle Button
**Purpose**: Allow users to switch between modes

**Requirements**:
- Toggle button in controls or settings menu
- Icon: "Pin" 📌 or "Dock" icon
- State indicator: Different icon/color for each mode
- Tooltip: "Pin Controls" / "Unpin Controls"
- Button accessible via keyboard

**UI States**:
- Overlay mode: Unpin icon (controls floating)
- Fixed mode: Pin icon (controls docked)
- Visual feedback on click
- Animation on mode change

### Feature 4: Mode Persistence
**Purpose**: Remember user's preferred control mode

**Requirements**:
- Store mode in localStorage: `controlBarMode: 'overlay' | 'fixed'`
- Default: `'overlay'` for player page
- Apply correct mode on page load
- Update localStorage on mode change

**LocalStorage Structure**:
```javascript
{
  controlBarMode: 'overlay'  // or 'fixed'
}
```

### Feature 5: Smooth Transitions
**Purpose**: Professional transition between modes

**Requirements**:
- Fade controls when switching modes
- Adjust video container height smoothly
- Reposition controls without jumps
- Transition duration: 300ms
- Maintain playback during transition

**Transition Steps**:
1. Fade out controls (100ms)
2. Swap CSS classes and adjust layout (100ms)
3. Fade in controls (100ms)

## Testing Checklist
- [ ] Overlay mode: Controls auto-hide after 3 seconds
- [ ] Overlay mode: Controls show on mouse move
- [ ] Overlay mode: Controls stay visible when paused
- [ ] Fixed mode: Controls always visible
- [ ] Fixed mode: Video height adjusts correctly
- [ ] Toggle button switches modes
- [ ] Mode persists after page reload
- [ ] Smooth transitions between modes
- [ ] No layout jumps or flickers
- [ ] Keyboard accessible (toggle button focusable)

## Interaction Behavior

**Overlay Mode User Flow**:
1. Video playing → Controls visible
2. After 3s of no mouse movement → Controls fade out
3. User moves mouse → Controls fade in
4. User pauses video → Controls stay visible

**Fixed Mode User Flow**:
1. Video playing or paused → Controls always visible
2. Mouse movement doesn't affect visibility
3. Controls take up fixed space below video

**Mode Switching**:
1. User clicks pin/unpin button
2. Controls fade out briefly
3. Layout adjusts
4. Controls fade in with new positioning
5. Mode saved to localStorage

## Edge Cases
- Video at different aspect ratios: Ensure controls don't overlap in overlay mode
- Fullscreen: Overlay mode preferred (fixed mode may not work in fullscreen)
- Mobile: Touch events should toggle controls in overlay mode
- Rapid mode switching: Debounce or queue transitions
- Controls height changes: Recalculate video height in fixed mode

## Accessibility
- Toggle button has aria-label: "Pin controls" / "Unpin controls"
- Button has aria-pressed="true" / "false"
- Controls always accessible via keyboard (even when visually hidden in overlay)
- Focus management: Don't lose focus when controls hide in overlay mode

## Files to Modify
- `player.html` - Add mode toggle button
- `player.css` - Add overlay and fixed mode styles
- `player.js` - Add mode switching logic, auto-hide timer, localStorage

## What NOT to Do
- ❌ Don't hide controls completely in overlay mode (keep accessible)
- ❌ Don't forget to clear auto-hide timer on pause
- ❌ Don't make fixed mode controls overlap video
- ❌ Don't ignore fullscreen mode (overlay preferred)
- ❌ Don't use JavaScript for fade animations (use CSS)

## MediaBunny Integration
- No direct MediaBunny APIs needed
- Mode switching should not affect MediaBunny Player instance
- Ensure playback continues smoothly during mode transitions

## Done When
✅ Overlay mode works with auto-hide  
✅ Fixed mode keeps controls always visible  
✅ Toggle button switches modes smoothly  
✅ Mode persists across sessions  
✅ Video container adjusts height correctly  
✅ All tests pass  
✅ Keyboard accessible  
✅ Ready for next phase

---
**Phase**: 17 | **Component**: Player  
**Estimated Time**: 50-70 minutes
