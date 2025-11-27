# Phase 54: Preview Panel Structure

## Goal
Create 50% width center panel with video container placeholder

## Group
**Preview Player**

## Feature to Implement

### ONE Feature: Preview Panel Structure
**Purpose**: Establish the center panel that will contain the video preview player

**Requirements**:

#### 1. What to Build
Create the center preview panel:
- Center panel taking 50% of viewport width
- Full height from below tab bar to above timeline
- Contains video player container area
- Contains player controls area below video
- Positioned as center column in main editor layout

#### 2. Layout & Positioning
- Position: Center of editor workspace (between media library and properties)
- Width: 50% of viewport (or remaining space after fixed-width panels)
- Height: Full viewport height minus:
  - Top navigation (60px)
  - Tab bar (45px)
  - Timeline panel (30% of viewport)
- Top edge: Starts below tab bar (105px from top)
- Contains two sections: video display area + controls area

#### 3. Internal Structure
Panel should have two main sections:

1. **Video Display Area** (top, main area):
   - Contains video player element
   - Background: black (#000000)
   - Aspect ratio: 16:9 (default)
   - Centered within available space
   - Letterboxing if needed (black bars)

2. **Controls Area** (bottom, ~60px height):
   - Contains player controls (Play/Pause, timeline, etc.)
   - Background: secondary background
   - Fixed height or auto-fit content

Layout: 
```
[Video Display Area - 16:9]
[Controls Area - 60px]
```

#### 4. Video Container
Structure for video element:
- Container with 16:9 aspect ratio constraint
- Black background (#000000)
- Centered horizontally and vertically
- Max width/height to prevent overflow
- Video element (empty for now, added in Phase 49)
- Placeholder state: Black screen or logo

#### 5. Controls Container
Structure for player controls:
- Width: Full panel width
- Height: 60px
- Horizontal layout (flexbox)
- Contains (placeholders for now):
  - Play/Pause button area (left)
  - Progress bar / timeline scrubber (center)
  - Time display (right)
  - Volume control (right)
  - Fullscreen button (far right)

#### 6. Aspect Ratio Handling
Maintain 16:9 aspect ratio:
- Use CSS aspect-ratio property: `aspect-ratio: 16 / 9`
- OR: Padding-bottom trick: `padding-bottom: 56.25%` (9/16)
- Video should scale to fit without distortion
- Add letterboxing (black bars) if needed

#### 7. Responsive Behavior
- **Desktop (> 1024px)**: 50% width, full controls
- **Tablet (768px - 1024px)**: 50% width, may reduce control size
- **Mobile (< 768px)**: 
  - Full width (collapse library/properties to overlay or tabs)
  - OR: Stack vertically
  - Recommendation: Keep desktop layout for now, mobile optimization later

#### 8. Empty/Placeholder State
Initially (before video loaded):
- Black screen in video area
- Optional: "No video loaded" text centered
- Optional: MediaBunny logo or play icon
- Controls visible but disabled

#### 9. Styling Requirements
Apply Dark Neobrutalism theme:
- Video area: Pure black background (#000)
- Controls area: Secondary background with thick top border (3px)
- Panel has thick left and right borders (3px) separating from adjacent panels
- Use CSS variables from theme system

#### 10. Z-Index & Layering
- Panel at same level as media library and properties
- Video area: z-index normal
- Controls: z-index slightly higher to overlay video (if needed)
- Fullscreen mode: highest z-index (handled in Phase 53)

#### 11. Accessibility
- Use semantic HTML: `<main>` for panel, `<section>` for video area
- Add `aria-label="Video preview panel"`
- Controls should be keyboard accessible (Tab navigation)
- Focus should be manageable within panel

#### 12. Files to Modify
- `editor.html` - Add preview panel HTML structure (should already exist from Phase 26)
- `assets/css/editor.css` - Refine preview panel styles
- Use BEM naming: `.preview-panel`, `.preview-panel__video`, `.preview-panel__controls`

#### 13. Integration with Phase 26
Phase 26 already created basic panel structure. This phase refines:
- Internal layout (video area + controls area)
- Aspect ratio handling
- Proper sizing and spacing
- Placeholder state
- Styling polish

#### 14. What NOT to Do
- ❌ Do NOT add actual video player element (that's Phase 49)
- ❌ Do NOT add functional controls (Play/Pause in Phase 50, etc.)
- ❌ Do NOT integrate MediaBunny yet (Phase 49)
- ❌ Do NOT add progress bar functionality (comes later)
- This is **visual structure only**

**MediaBunny Integration**: Not applicable for this phase (structure only)

## References
- **Phase 26**: Basic panel structure already exists
- **Phase 49**: Will add MediaBunny Player
- **Phase 50-53**: Will add controls (Play/Pause, time, fullscreen)
- **Code of Conduct**: Follow BEM naming, no inline styles, use CSS variables
- **Dark Neobrutalism**: Thick borders, black video area

## Testing Checklist
- [ ] Preview panel appears in center of editor
- [ ] Panel is 50% width (or remaining space)
- [ ] Panel height fills from below tab bar to above timeline
- [ ] Video display area visible (black background)
- [ ] Video area maintains 16:9 aspect ratio
- [ ] Controls area visible below video (60px height)
- [ ] Thick borders separate from library and properties panels
- [ ] Black background in video area (#000000)
- [ ] Controls area has secondary background
- [ ] Panel positioned correctly in layout
- [ ] Dark Neobrutalism styling applied
- [ ] No overflow or scrollbars in panel
- [ ] Responsive on tablet (maintains layout)
- [ ] No console errors

## Done When
✅ Preview panel structured with video area + controls area  
✅ 50% width, centered in layout  
✅ Video area maintains 16:9 aspect ratio  
✅ Controls area positioned below video (60px)  
✅ Black video background  
✅ Thick borders separating panels  
✅ Dark Neobrutalism theme applied  
✅ All tests pass  
✅ Ready for Phase 49 (MediaBunny Player Integration)

---
**Phase**: 54 | **Component**: Editor | **Group**: Preview Player  
**Estimated Time**: 10 min

## Implementation Notes
- This refines the basic structure from Phase 26
- Focus on internal layout: video + controls split
- 16:9 aspect ratio standard for most videos
- Black background standard for video players
- Controls placeholders for now, detailed in Phases 50-53
