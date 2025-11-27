# Phase 16: Collapsible Sidebar

## Goal
Implement collapsible/expandable playlist sidebar with smooth transitions and persistent state.

## Features to Implement

### Feature 1: Sidebar Collapse/Expand Toggle
**Purpose**: Allow users to maximize video space by collapsing the playlist sidebar

**Requirements**:
- Default state: Open (20% width)
- Collapsed state: Minimized to small button strip (~40px width)
- Smooth CSS transitions (300ms)
- Toggle button visible in both states
- Video section automatically expands when sidebar collapsed
- Persist state in localStorage

**UI Elements**:
- Collapse button (when open): Arrow icon pointing right `→`
- Expand button (when collapsed): Arrow icon pointing left `←`
- Button positioned at top of sidebar or in header
- Clear visual feedback on hover

### Feature 2: Animated Transitions
**Purpose**: Provide smooth, professional UI experience

**Requirements**:
- CSS transitions for width changes
- Fade out sidebar content when collapsing
- Fade in sidebar content when expanding
- No layout jumps or flickers
- Transition duration: 300ms
- Use `cubic-bezier` for smooth easing

**CSS Approach**:
```css
.playlist-sidebar {
  transition: width 300ms cubic-bezier(0.4, 0, 0.2, 1);
}

.playlist-sidebar.collapsed {
  width: 40px;
}

.playlist-sidebar.expanded {
  width: 20%;
}
```

### Feature 3: Content Visibility Management
**Purpose**: Hide playlist content gracefully when collapsed

**Requirements**:
- When collapsed: Hide all content except toggle button
- Use `overflow: hidden` to prevent content overflow
- Fade out content before width animation completes
- Show only vertical expand button when collapsed
- Optional: Show video count badge on collapsed button

**Implementation**:
- Add `.collapsed` class to sidebar container
- Use CSS to hide content: `.playlist-sidebar.collapsed .playlist-content { display: none; }`
- Keep toggle button visible with positioning

### Feature 4: State Persistence
**Purpose**: Remember user's sidebar preference across sessions

**Requirements**:
- Store state in localStorage: `sidebarCollapsed: true/false`
- Load state on page load
- Apply correct class immediately (before transition)
- Update localStorage on every toggle

**LocalStorage Structure**:
```javascript
{
  sidebarCollapsed: false  // default: expanded
}
```

**Implementation**:
- On load: Check `localStorage.getItem('sidebarCollapsed')`
- On toggle: `localStorage.setItem('sidebarCollapsed', state)`

### Feature 5: Responsive Behavior
**Purpose**: Ensure collapse feature works on all screen sizes

**Requirements**:
- Desktop (1024px+): Full collapse functionality
- Tablet (768-1023px): May default to collapsed
- Mobile (<768px): Sidebar already in drawer/modal (Phase 15), collapse may not apply
- Adjust collapsed width for smaller screens (e.g., 0px on tablet)

## Testing Checklist
- [ ] Clicking toggle button collapses sidebar
- [ ] Clicking again expands sidebar
- [ ] Transition is smooth (no jumps)
- [ ] Video section width adjusts correctly
- [ ] Sidebar content hidden when collapsed
- [ ] Only toggle button visible when collapsed
- [ ] State persists after page reload
- [ ] Works on desktop and tablet
- [ ] Keyboard accessible (button focusable, Enter/Space to toggle)

## Interaction Behavior

**User Flow**:
1. User loads page → Sidebar is expanded (or last saved state)
2. User clicks collapse button → Sidebar animates to 40px, content fades out
3. Video section expands to fill space
4. User clicks expand button → Sidebar animates back to 20%, content fades in
5. State saved to localStorage

**Keyboard Shortcuts** (optional):
- `Ctrl + B` or `Cmd + B`: Toggle sidebar

## Edge Cases
- Very narrow screens: Collapsed width may be 0px instead of 40px
- No localStorage support: Default to expanded state
- Rapid toggling: Debounce or disable button during transition
- Sidebar contains scroll position: Preserve scroll position when re-expanding

## Accessibility
- Button has aria-label: "Collapse sidebar" / "Expand sidebar"
- Button has aria-expanded="true" / "false"
- Focus management: Keep focus on button after toggle
- Reduced motion: Respect `prefers-reduced-motion` (instant transition)

## Files to Modify
- `player.html` - Add collapse/expand button
- `player.css` - Add transition styles and collapsed state
- `player.js` - Add toggle logic and localStorage persistence

## What NOT to Do
- ❌ Don't use JavaScript for animations (use CSS transitions)
- ❌ Don't forget to hide overflow content
- ❌ Don't make collapsed width too narrow (min 40px for button)
- ❌ Don't ignore localStorage errors (wrap in try-catch)

## Done When
✅ Sidebar can be collapsed and expanded  
✅ Smooth transitions implemented  
✅ Content visibility managed correctly  
✅ State persists across page reloads  
✅ All tests pass  
✅ Keyboard accessible  
✅ Ready for next phase

---
**Phase**: 16 | **Component**: Player  
**Estimated Time**: 40-60 minutes
