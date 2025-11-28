# Phase 14: Core Polish

## Goal
Apply theme, responsive design, accessibility, and MediaBunny resource management

**MediaBunny Integration**: Proper cleanup and optimization of MediaBunny resources. **Consult** mediabunny-llms-full.md for:
- Closing media sources and sinks
- Proper decoder cleanup
- Memory management best practices
- Performance optimization techniques, and optimizations.

---

## What to Build

Polish and optimization:\n- Dark Neobrutalism theme integration\n- Responsive design for all screen sizes\n- WCAG AA accessibility compliance\n- Performance optimizations\n- MediaBunny resource management\n- Cross-browser compatibility

---

## Features to Implement

### Feature 1: Theme Integration
**Purpose**: Apply Dark Neobrutalism theme styling

**Requirements**:
- Use theme button classes for all control buttons
- Apply theme card/container styles to player container
- Use theme color variables (backgrounds, accents, borders)
- Apply theme spacing variables for padding/margins
- Ensure ZERO border-radius (sharp corners)
- Add brutalist shadows to control bar
- Use theme typography (Space Grotesk font)

### Feature 2: Responsive Design
**Purpose**: Adapt player to different screen sizes

**Requirements**:
- Desktop (>1024px): Full control bar with all features
- Tablet (641-1023px): Slightly condensed controls
- Mobile (<640px): Essential controls only, larger touch targets
- Stack controls vertically on very small screens if needed
- Ensure minimum 44x44px touch targets on mobile
- Test at multiple breakpoints (375px, 768px, 1024px, 1440px)

### Feature 3: Accessibility Implementation
**Purpose**: Make player usable for all users

**Requirements**:
- Add ARIA labels to all buttons ("Play", "Pause", "Mute", etc.)
- Use aria-pressed for toggle buttons
- Add aria-valuemin/max/now for sliders (volume, progress)
- Ensure complete keyboard navigation
- Visible focus indicators on all interactive elements
- Test with screen reader (NVDA, VoiceOver, JAWS)
- Verify color contrast meets WCAG AA standards

### Feature 4: Performance Optimization
**Purpose**: Ensure smooth, efficient operation

**Requirements**:
- Throttle timeupdate event handling (max 10 updates/second)
- Use requestAnimationFrame for smooth UI animations
- Clean up event listeners when component is destroyed
- Minimize DOM manipulations per update
- Lazy load non-essential features
- Debounce window resize handlers

### Feature 5: Cross-Browser Testing
**Purpose**: Ensure compatibility across browsers

**Requirements**:
- Test in Chrome/Edge (Chromium-based)
- Test in Firefox
- Test in Safari (macOS and iOS)
- Handle browser-specific quirks (especially Safari video behavior)
- Add polyfills if needed for older browser support
- Verify MediaBunny compatibility in all target browsers

---

## Testing Checklist
- [ ] Theme styling matches design system
- [ ] Responsive layout works on mobile/tablet
- [ ] Screen reader announces controls correctly
- [ ] Keyboard navigation is smooth and visible
- [ ] Performance is smooth (no jank)
- [ ] Works in major browsers

---

## Done When
✅ Polished, accessible, responsive player  
✅ All tests pass  
✅ Core component complete

---
**Phase**: 14 | **Component**: Core
**Estimated Time**: 30-50 minutes
