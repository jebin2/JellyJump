# Phase 53: Full-Screen Toggle

## Goal
Full-screen button + F key, Fullscreen API integration

## Group
**Preview Player**

## Feature to Implement

### ONE Feature: Full-Screen Toggle
**Purpose**: Allow users to view video in fullscreen mode

**Requirements**:

#### 1. What to Build
Add fullscreen functionality:
- Fullscreen button (icon: ⛶ or ⤢)
- Click to enter fullscreen
- Click again to exit fullscreen (or Esc key)
- F key keyboard shortcut
- Update button icon based on fullscreen state
- Use browser Fullscreen API

#### 2. Button Layout
Position in controls area:
- Location: Far right of controls area
- After time display and volume (if present)
- Size: 40x40px or similar
- Icon: ⛶ (enter fullscreen) or ⤢ (exit fullscreen)
- Toggle icon based on fullscreen state

#### 3. Fullscreen API
Use browser Fullscreen API:

**Enter fullscreen**:
```javascript
element.requestFullscreen()
  .then(() => console.log('Entered fullscreen'))
  .catch(err => console.error('Fullscreen failed:', err));
```

**Exit fullscreen**:
```javascript
document.exitFullscreen()
  .then(() => console.log('Exited fullscreen'))
  .catch(err => console.error('Exit fullscreen failed:', err));
```

**Check fullscreen state**:
```javascript
const isFullscreen = document.fullscreenElement !== null;
```

#### 4. What Element to Fullscreen
Options for fullscreen target:

**Option A - Player container only**:
- Fullscreen just the video player area
- No controls, UI, or timeline
- Simpler, focused

**Option B - Player + controls**:
- Fullscreen the entire preview panel (video + controls)
- Controls remain visible in fullscreen
- Better UX

**Option C - Entire editor**:
- Fullscreen the whole editor interface
- More complex, less common

Recommendation: **Option B** - Player + controls (preview panel).

#### 5. Fullscreen Toggle Logic
When button clicked:

**If not fullscreen**:
1. Call `previewPanel.requestFullscreen()`
2. Update button icon to exit fullscreen (⤢)
3. Update internal state: `isFullscreen = true`
4. Log: "Entered fullscreen"

**If fullscreen**:
1. Call `document.exitFullscreen()`
2. Update button icon to enter fullscreen (⛶)
3. Update internal state: `isFullscreen = false`
4. Log: "Exited fullscreen"

#### 6. F Key Keyboard Shortcut
Add keyboard shortcut:
- Key: F
- Action: Toggle fullscreen
- Same logic as button click
- Prevent default if needed

Event listener:
```javascript
document.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') {
    e.preventDefault();
    toggleFullscreen();
  }
});
```

#### 7. Fullscreen State Tracking
Track state and listen to events:

Listen to fullscreenchange event:
```javascript
document.addEventListener('fullscreenchange', () => {
  const isFullscreen = document.fullscreenElement !== null;
  updateFullscreenButton(isFullscreen);
});
```

This handles:
- Button clicks
- F key presses
- Esc key (browser exits fullscreen)
- Browser UI fullscreen toggle

#### 8. Escape Key Handling
Browser automatically exits fullscreen on Esc:
- No custom Esc handling needed
- Just update button via fullscreenchange event
- User expectation: Esc exits fullscreen

#### 9. Fullscreen Styling
Update styles when in fullscreen:
- Video expands to fill screen
- Controls remain at bottom
- Background: black
- Hide editor chrome (navigation, timeline, panels)
- Optional: Auto-hide controls after 3 seconds (mouse idle)

CSS for fullscreen state:
```css
:fullscreen .preview-panel {
  width: 100vw;
  height: 100vh;
  /* Expand to full viewport */
}
```

#### 10. Button Icon States
**Normal (not fullscreen)**:
- Icon: ⛶ or "Fullscreen" text
- Aria-label: "Enter fullscreen"

**Fullscreen active**:
- Icon: ⤢ or "Exit Fullscreen"
- Aria-label: "Exit fullscreen"

Use SVG or icon font for better control.

#### 11. Browser Compatibility
Fullscreen API has vendor prefixes (older browsers):
- Standard: `requestFullscreen()`, `exitFullscreen()`
- Webkit: `webkitRequestFullscreen()`
- Mozilla: `mozRequestFullScreen()`
- MS: `msRequestFullscreen()`

Use polyfill or helper function to handle prefixes:
```javascript
function requestFullscreen(element) {
  if (element.requestFullscreen) {
    return element.requestFullscreen();
  } else if (element.webkitRequestFullscreen) {
    return element.webkitRequestFullscreen();
  } // ... etc
}
```

Modern browsers (2020+) support standard API.

#### 12. Error Handling
Handle fullscreen errors:
- **Fullscreen not supported**: Hide button or disable
- **User disabled fullscreen**: Show error toast
- **Security restrictions**: Fullscreen requires user gesture
- **Exit fails**: Log error, update UI anyway

#### 13. Edge Cases
- **Fullscreen request without user gesture**: Will fail (browser security)
- **Multiple fullscreen requests**: Second request ignored
- **Browser in fullscreen**: Additional fullscreen may not work
- **Mobile browsers**: Limited fullscreen support (especially iOS)

#### 14. Mobile/iOS Considerations
iOS Safari has limitations:
- Fullscreen API support limited
- May need native video fullscreen (`playsinline` attribute)
- Test on actual devices

For this phase: Focus on desktop browsers.

#### 15. Accessibility
- Button has `aria-label="Enter fullscreen"` or `aria-label="Exit fullscreen"`
- Keyboard accessible (Tab to focus, Enter to activate)
- F key shortcut documented
- Announce fullscreen state changes to screen readers

#### 16. Visual Feedback
Button visual states:

**Normal state**:
- Fullscreen icon visible
- Thick border (3px), Dark Neobrutalism

**Hover state**:
- Background highlight
- Offset shadow
- Cursor: pointer

**Active/Click state**:
- Translate down slightly
- Scale down (0.95x)

**Fullscreen active** (state indicator):
- Different icon (exit fullscreen)
- Optional: Accent color to show active state

#### 17. Files to Create/Modify
- `editor.html` - Add fullscreen button to controls area
- `assets/css/editor.css` - Add fullscreen button styles and fullscreen state styles
- `assets/js/preview-player.js` - Add fullscreen logic
- `assets/js/fullscreen-polyfill.js` - Optional: browser compatibility helper

#### 18. JavaScript Organization
Extend PreviewPlayer class:
- `toggleFullscreen()` - Main toggle method
- `enterFullscreen()` - Request fullscreen
- `exitFullscreen()` - Exit fullscreen
- `onFullscreenChange()` - Handle fullscreenchange event
- `updateFullscreenButton(isFullscreen)` - Update button icon
- `isFullscreenSupported()` - Check API availability
- `attachFullscreenHandlers()` - Event listeners

#### 19. Data Attributes
- `data-control="fullscreen"` on button
- `data-fullscreen-active="true|false"` to track state (optional)

#### 20. What NOT to Do
- ❌ Do NOT implement picture-in-picture (different feature)
- ❌ Do NOT add theater mode (intermediate size) - just fullscreen
- ❌ Do NOT auto-hide controls in fullscreen (can add later as enhancement)
- ❌ Do NOT implement custom fullscreen (fake fullscreen) - use native API
- This phase is **fullscreen toggle ONLY**

**MediaBunny Integration**: Fullscreen applies to container, not player directly

## References
- **Phase 48**: Preview panel container (fullscreen target)
- **Phase 50**: Play/Pause controls (work in fullscreen too)
- **Fullscreen API**: MDN Web Docs for browser compatibility

## Testing Checklist
- [ ] Fullscreen button visible in controls (far right)
- [ ] Click button enters fullscreen
- [ ] Video/player expands to full screen
- [ ] Button icon changes to "exit fullscreen" (⤢)
- [ ] Click button again exits fullscreen
- [ ] Button icon changes back to "enter fullscreen" (⛶)
- [ ] F key toggles fullscreen
- [ ] Esc key exits fullscreen
- [ ] Button updates when Esc pressed
- [ ] fullscreenchange event fires correctly
- [ ] Controls remain visible in fullscreen
- [ ] Video maintains aspect ratio in fullscreen
- [ ] Black background in fullscreen
- [ ] Exit fullscreen returns to normal layout
- [ ] Button disabled if fullscreen not supported
- [ ] Hover effect on button
- [ ] Keyboard accessible (Tab, Enter)
- [ ] `aria-label` updates with state
- [ ] No console errors

## Done When
✅ Fullscreen button functional  
✅ Click toggles fullscreen  
✅ F key shortcut works  
✅ Fullscreen API integrated  
✅ Button icon updates with state  
✅ Esc key exits fullscreen  
✅ fullscreenchange event handled  
✅ All tests pass  
✅ Preview Player Group COMPLETE ✅  
✅ Ready for Phase 54 (Properties Panel Structure)

---
**Phase**: 53 | **Component**: Editor | **Group**: Preview Player  
**Estimated Time**: 20 min

## Implementation Notes
- Use Fullscreen API (well-supported in modern browsers)
- Target preview panel element (video + controls)
- F key is common fullscreen shortcut
- Browser handles Esc key automatically
- fullscreenchange event crucial for state tracking
- This completes the Preview Player group (Phases 48-53)
- Consider adding vendor prefix polyfill for older browsers
