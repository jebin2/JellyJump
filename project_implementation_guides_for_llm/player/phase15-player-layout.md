# Phase 15: Player Layout

## Goal
Create 80/20 split layout integrating core player on left and playlist panel on right.

---

## What to Build

Two-column responsive layout:
- Left section (80%): Video player container
- Right section (20%): Playlist panel
- Responsive behavior for mobile/tablet
- Integration with existing core player component

---

## Features to Implement

### Feature 1: Page Layout Structure
**Purpose**: Create two-column layout for video and playlist

**Requirements**:
- 80% width for video section (left)
- 20% width for playlist section (right)
- Use CSS Grid or Flexbox for layout
- Full viewport height
- Apply theme background colors
- Smooth resizing behavior

### Feature 2: Video Section
**Purpose**: Container for core player component

**Requirements**:
- Embed core player component from phases 09-14
- Core player already includes MediaBunny integration
- Center video vertically in available space
- Black background for letterboxing
- Apply theme borders between sections
- Maintain aspect ratio (16:9)

### Feature 3: Playlist Section
**Purpose**: Scrollable panel for video list

**Requirements**:
- Fixed 20% width on desktop
- Header showing "PLAYLIST" or similar title
- Scrollable content area for video items
- Apply theme styling (background, borders)
- Shadow/border separating from video section
- Vertical scroll for overflow

### Feature 4: Responsive Behavior
**Purpose**: Adapt layout for mobile devices

**Requirements**:
- Mobile (<768px): Stack vertically or use drawer
- Video takes full width on mobile
- Playlist becomes bottom drawer or modal
- Toggle button to show/hide playlist on mobile
- Maintain usability on all screen sizes
- Touch-friendly controls

---

## Interaction Behavior

**Desktop/Tablet Flow**:
1. Page loads with 80/20 split visible
2. Both panels visible simultaneously
3. User can interact with both panels
4. Smooth resizing if window changes

**Mobile Flow**:
1. Page loads with full-width video
2. Playlist hidden by default (drawer mode)
3. User taps playlist button
4. Playlist drawer slides up from bottom
5. User can close drawer or select video

---

## Edge Cases

- Very narrow screens (<400px): Ensure minimum viable layout
- Ultra-wide screens (>2560px): Consider max-width constraints
- Vertical/portrait orientation: Adjust split ratios
- No videos in playlist: Show empty state message
- Playlist with 100+ items: Ensure smooth scrolling

---

## Styling Requirements

**Theme**: Dark Neobrutalism
- Bold borders (3-4px)
- High contrast colors
- Accent colors for active states
- Consistent spacing

**Layout**:
- Grid/Flexbox for main structure
- CSS variables for widths (adjustable)
- Smooth transitions on resize
- Mobile-first responsive design

---

## Accessibility

- Semantic HTML: `<main>` for video, `<aside>` for playlist
- Keyboard navigation between sections
- Focus visible on interactive elements
- Screen reader labels for sections
- Skip links for keyboard users

---

## What NOT to Do

- ❌ Don't hard-code pixel widths (use percentages/flexbox)
- ❌ Don't forget mobile responsiveness
- ❌ Don't block playlist scroll when video is playing
- ❌ Don't make layout jump when playlist updates
- ❌ Don't ignore aspect ratio preservation

---

## Testing Checklist

- [ ] Layout splits correctly (80/20) on desktop
- [ ] Core player embedded and visible
- [ ] Playlist section visible and scrollable
- [ ] Responsive layout works on mobile
- [ ] Both sections usable on all screen sizes
- [ ] Theme styling applied correctly
- [ ] No layout jumps when resizing
- [ ] Keyboard navigation works
- [ ] Touch gestures work on mobile

---

## Done When

✅ Split layout implemented  
✅ Core player integrated  
✅ Playlist container ready  
✅ Responsive behavior works  
✅ Theme styling applied  
✅ All tests pass  
✅ Ready for next phase

---

**Phase**: 15 | **Component**: Player  
**Estimated Time**: 30-50 minutes
