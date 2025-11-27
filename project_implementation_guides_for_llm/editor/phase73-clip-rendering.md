# Phase 73: Clip Visual Rendering

## Goal
Render clip rectangles on timeline with position, duration, and basic styling

## Group
**Timeline Interaction**

## Feature to Implement

### ONE Feature: Clip Visual Representation
**Purpose**: Display timeline clips as visual rectangles positioned accurately on tracks

**Requirements**:

#### 1. What to Build
Create visual clip elements:
- Render clips as rectangular divs on timeline tracks
- Position based on startTime
- Width based on duration
- Color-coded by media type (video, audio)
- Display clip name (filename)
- Foundation for thumbnails (Phase 68) and interactions

#### 2. Clip Element Structure
Each clip element contains:
- **Container div**: Main clip rectangle
- **Label**: Media filename (truncated if needed)
- **Visual indicator**: Color stripe or background
- **Data attributes**: Clip ID, media ID, track ID
- Positioned absolutely within track content area

#### 3. Clip Positioning
Calculate position and dimensions:

**Left position** (startTime):
```
left = clip.startTime * pixelsPerSecond
Example: 8 seconds * 50px/s = 400px from track start
```

**Width** (duration):
```
width = clip.duration * pixelsPerSecond
Example: 5 seconds * 50px/s = 250px wide
```

**Top position**: 0px (top of track content area)

**Height**: Fill track height minus padding
- Video track: ~74px (6px padding from 80px track)
- Audio track: ~54px (6px padding from 60px track)

#### 4. Color Coding by Media Type
Visual distinction:

**Video clips**:
- Background: Purple or blue gradient
- Border: 3px solid (dark neobrutalism style)

**Audio clips**:
- Background: Green or teal gradient
- Border: 3px solid

**Image clips**:
- Background: Orange or yellow gradient
- Border: 3px solid

Use CSS custom properties for theme consistency.

#### 5. Clip Label Display
Show filename on clip:
- Text: Media filename without extension
- Position: Centered or left-aligned with padding
- Font: 12-14px, semi-bold
- Color: High contrast (white or light text on dark background)
- Truncate with ellipsis if text too long for clip width
- Minimum width for label visibility: 60px (hide label if clip < 60px)

#### 6. Visual Styling
Apply Dark Neobrutalism theme:
- Thick borders (3px solid)
- Offset box-shadow for depth
- Solid color backgrounds (gradients optional)
- Sharp corners or slight border-radius (2-4px)
- High contrast text
- Use CSS variables

States to style:
- **Default**: Normal appearance
- **Hover**: Lighter border, subtle scale (future)
- **Selected**: Bright border, accent color (future)
- **Locked**: Diagonal stripe pattern (future)

#### 7. Z-Index and Layering
Clip stacking when overlapping:
- Higher track index = higher z-index
- Clips later on same track appear on top
- Selected clip always on top (future)
- Use `z-index` calculated from track and clip order

Example:
```
Track 1 clips: z-index 10-19
Track 2 clips: z-index 20-29
Track 3 clips: z-index 30-39
```

#### 8. Minimum Clip Width
Handle very short clips:
- Minimum visual width: 20px (even if duration is tiny)
- Prevents invisible clips
- Display warning icon if < 1 second

#### 9. Clip Rendering Function
JavaScript rendering:

**renderClip(clipData)**:
1. Create clip element (div)
2. Set position: `left = startTime * pixelsPerSecond`
3. Set width: `width = duration * pixelsPerSecond`
4. Set height: Track height minus padding
5. Apply color based on media type
6. Add filename label
7. Set data attributes (clip-id, media-id, track-id)
8. Apply BEM CSS classes
9. Append to track content area

**Re-render on**:
- Zoom level change (recalculate positions/widths)
- Track height change
- Clip data update (trim, move)

#### 10. BEM Naming Convention
CSS classes:
- `.timeline-clip` - Base clip class
- `.timeline-clip--video` - Video clip modifier
- `.timeline-clip--audio` - Audio clip modifier
- `.timeline-clip--image` - Image clip modifier
- `.timeline-clip__label` - Filename label
- `.timeline-clip--selected` - Selected state (future)
- `.timeline-clip--locked` - Locked state (future)

#### 11. Data Attributes
Essential attributes:
- `data-clip-id="[UUID]"` - Unique clip identifier
- `data-media-id="[UUID]"` - Source media reference
- `data-track-id="track-1"` - Parent track
- `data-start-time="8.0"` - Position in seconds
- `data-duration="5.2"` - Length in seconds

Used for:
- Selecting clips (Phase 71+)
- Editing operations
- Playback coordination

#### 12. Multi-Clip Rendering
Render all project clips:
- Loop through project clips array
- Render each clip on corresponding track
- Order by startTime (left to right)
- Efficient DOM insertion (DocumentFragment)

#### 13. Update on Zoom
Recalculate when zoom changes (Phase 72):
- Clear all clip elements
- Recalculate positions/widths with new pixelsPerSecond
- Re-render all clips
- Maintain clip selection state

#### 14. Edge Cases
- **Clip extends beyond viewport**: Render fully, rely on horizontal scroll
- **Zero duration**: Show minimum width (20px), log warning
- **Negative startTime**: Clamp to 0, log error
- **Very long filename**: Truncate with ellipsis
- **Overlapping clips**: Allow for v1, rely on z-index
- **Clip off-screen**: Still render (virtual scrolling future optimization)

#### 15. Performance Optimization
For many clips (100+):
- Use DocumentFragment for batch rendering
- Debounce zoom/resize re-renders
- Consider virtual scrolling (render only visible clips)
- Cache calculated values
- Use CSS transforms for positions (GPU-accelerated)

#### 16. Accessibility
- Each clip has `role="button"` (future: clickable)
- Add `aria-label`: "[filename] clip, [duration] seconds, [media type]"
- Tab navigation (future: requires selection logic)
- Focus styles for keyboard navigation

#### 17. Files to Create/Modify
- `assets/js/clip-renderer.js` - Create new file for rendering logic
- `assets/css/editor.css` - Add clip visual styles (BEM classes)
- `assets/js/clip-manager.js` - Call renderer after creating clip (Phase 66)
- `assets/js/timeline.js` - Integrate with zoom updates

#### 18. JavaScript Organization
Create ClipRenderer class:
- `renderClip(clipData)` - Render single clip element
- `renderAllClips(clipsArray)` - Render all project clips
- `updateClipPosition(clipId, newStartTime)` - Reposition clip
- `updateClipWidth(clipId, newDuration)` - Resize clip
- `clearAllClips()` - Remove all clip elements
- `getClipElement(clipId)` - Retrieve clip DOM element

Helper methods:
- `calculateClipPosition(startTime)` - Convert time to pixels
- `calculateClipWidth(duration)` - Convert duration to pixels
- `getMediaTypeColor(mediaType)` - Return color for clip type
- `truncateFilename(filename, maxWidth)` - Shorten text

#### 19. Integration Points
Called by:
- **Phase 66**: After drop, render new clip
- **Phase 72**: On zoom, re-render all clips
- **Future phases**: On clip move, trim, delete

Provides foundation for:
- **Phase 68**: Clip thumbnails (overlay on clip rectangle)
- **Phase 71+**: Clip selection, dragging, trimming

#### 20. What NOT to Do
- ❌ Do NOT implement clip selection (clicking to select)
- ❌ Do NOT implement clip dragging (moving on timeline)
- ❌ Do NOT implement clip trimming (resize handles)
- ❌ Do NOT implement thumbnails (that's Phase 68)
- ❌ Do NOT implement split/cut functionality
- This phase: **Visual rendering ONLY**

**MediaBunny Integration**: Not applicable for visual rendering

## References
- **Phase 66**: Drop creates clip data, triggers rendering
- **Phase 68**: Will add thumbnails on top of clip rectangles
- **Phase 72**: Zoom will trigger re-rendering
- **Code of Conduct**: Use BEM, cache selectors, DocumentFragment

## Testing Checklist
- [ ] Clip rectangle appears on track after drop (Phase 66)
- [ ] Clip positioned correctly based on startTime
- [ ] Clip width matches duration (visual verification)
- [ ] Clip height fills track (with padding)
- [ ] Filename label visible on clip
- [ ] Color-coding: video clips one color, audio clips another
- [ ] Thick borders and neobrutalism styling applied
- [ ] Multiple clips render without overlapping issues
- [ ] Clips layer correctly (z-index)
- [ ] Very short clips show minimum width (20px)
- [ ] Long filenames truncated with ellipsis
- [ ] Data attributes present (clip-id, media-id, etc.)
- [ ] No console errors
- [ ] Smooth rendering performance

## Done When
✅ Clips render as visual rectangles  
✅ Position and width calculated from data  
✅ Color-coded by media type  
✅ Filename labels displayed  
✅ Dark Neobrutalism styling applied  
✅ Multiple clips supported  
✅ Data attributes for future interactions  
✅ All tests pass  
✅ Ready for Phase 68 (Clip Thumbnails)

---
**Phase**: 73 | **Component**: Editor | **Group**: Timeline Interaction  
**Estimated Time**: 25 min

## Implementation Notes
- ClipRenderer class separates visual logic from data management
- Position/width calculations critical for accuracy
- Color coding provides instant visual feedback
- BEM naming scales well as clip features grow
- Foundation for rich interactions (select, drag, trim) in future
- DocumentFragment ensures efficient multi-clip rendering
- This phase makes the timeline feel "real" for the first time!
