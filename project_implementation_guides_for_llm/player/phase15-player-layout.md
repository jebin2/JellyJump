# Phase 15: Player Layout

## Goal
Create 80/20 split layout integrating core player on left and playlist panel on right.

## Features to Implement

### Feature 1: Page Layout Structure
**Purpose**: Create two-column layout for video and playlist

**Requirements**:
- 80% width for video section (left)
- 20% width for playlist section (right)
- Use CSS Grid or Flexbox for layout
- Full viewport height
- Apply theme background colors

### Feature 2: Video Section
**Purpose**: Container for core player component with MediaBunny

**Requirements**:
- Embed core player component from phases 09-14
- **Note**: Core player already includes MediaBunny integration
- Center video vertically in available space
- Black background for letterboxing
- Apply theme borders between sections
- **Reference**: Core player MediaBunny setup from phase09-14

### Feature 3: Playlist Section
**Purpose**: Scrollable panel for video list

**Requirements**:
- Fixed 20% width on desktop
- Header showing "PLAYLIST" or similar
- Scrollable content area for video items
- Apply theme styling (background, borders)
- Shadow/border separating from video section

### Feature 4: Responsive Behavior
**Purpose**: Adapt layout for mobile devices

**Requirements**:
- Mobile (<768px): Stack vertically or use drawer
- Video takes full width on mobile
- Playlist becomes bottom drawer or modal
- Toggle button to show/hide playlist
- Maintain usability on all screen sizes

## Testing Checklist
- [ ] Layout splits correctly (80/20)
- [ ] Core player embedded and visible
- [ ] Playlist section visible and scrollable
- [ ] Responsive layout works on mobile

## Done When
✅ Split layout implemented  
✅ Core player integrated  
✅ Playlist container ready  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 15 | **Component**: Player
**Estimated Time**: 30-50 minutes
