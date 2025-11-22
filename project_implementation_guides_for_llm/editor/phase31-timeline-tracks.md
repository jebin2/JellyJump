# Phase 31: Timeline Tracks & Clips

## Goal
Implement multi-track system with clip rendering and positioning

**MediaBunny Integration**: Use MediaBunny for clip data and thumbnails. **Consult** mediabunny-llms-full.md for:
- `VideoSampleSink` for generating clip thumbnails
- `samplesAtTimestamps` for efficient thumbnail extraction
- Video duration and metadata for clip positioning
- EncodedPacketSink for precise timeline markers

## Features to Implement

### Feature 1: Track Lane System
**Purpose**: Create separate lanes for different media types

**Requirements**:
- **Video Track 1**: Top lane for primary video clips
- **Video Track 2**: Second lane for overlay videos/images
- **Audio Track**: Third lane for audio clips
- **Text Track**: Fourth lane for text overlays
- Fixed height per track (80-100px for video, 60px for audio/text)
- Track labels on left side (📹 Video 1, 📹 Video 2, 🎵 Audio, 📝 Text)
- Horizontal lines separating tracks
- Theme styling with alternating track colors

### Feature 2: Clip Data Structure
**Purpose**: Internal representation of timeline clips

**Requirements**:
- Clip object properties:
  - `id`: Unique identifier (UUID)
  - `trackId`: Which track clip belongs to
  - `sourceFile`: Reference to media file
  - `startTime`: Position on timeline (seconds)
  - `endTime`: End position on timeline (seconds)
  - `trimStart`: Trim start in source file (seconds)
  - `trimEnd`: Trim end in source file (seconds)
  - `effects`: Array of applied effects
  - `filters`: Array of applied filters
- Array of clips for each track
- Sorting clips by startTime for rendering

### Feature 3: Clip Rendering
**Purpose**: Display clips as rectangles on tracks

**Requirements**:
- Render each clip as a div/rect element
- Width based on clip duration and timeline zoom
- Position based on clip startTime
- Height matches track height (with padding)
- Clip background color (different per media type)
- Border and shadow styling (Dark Neobrutalism)
- Clip label showing filename
- Duration display on clip

### Feature 4: Clip Positioning Calculation
**Purpose**: Convert time to pixel position

**Requirements**:
- **Time-to-Pixel Function**:
  ```javascript
  function timeToPixels(seconds, zoomLevel) {
    // Base: 100px per second at 100% zoom
    const pixelsPerSecond = 100 * (zoomLevel / 100);
    return seconds * pixelsPerSecond;
  }
  ```
- Calculate clip left position: `timeToPixels(clip.startTime, zoom)`
- Calculate clip width: `timeToPixels(clip.duration, zoom)`
- Update positions when zoom changes (Phase 33)
- Snap to grid (optional, based on settings)

### Feature 5: Clip Selection Visual
**Purpose**: Highlight selected clips

**Requirements**:
- Click on clip to select
- Selected clip border highlight (accent color)
- Selected clip background slightly brighter
- Deselect when clicking timeline background
- Emit selection event to update Properties Panel (Phase 29)
- Multi-select with Ctrl+Click (optional)

### Feature 6: Clip Thumbnails
**Purpose**: Visual preview of video content

**Requirements**:
- **MediaBunny Integration**: Use `VideoSampleSink` + `samplesAtTimestamps`
- Generate thumbnail at clip start time
- Display thumbnail as clip background
- Update thumbnails based on zoom level
- Show multiple thumbnails for long clips
- Cache thumbnails for performance
- Loading placeholder while generating
- **Optional**: Can be skipped if performance is a concern

### Feature 7: Drop Target for Drag-and-Drop
**Purpose**: Accept clips dragged from Media Library (Phase 27)

**Requirements**:
- Track lanes are drop targets
- Visual feedback on dragover (highlight track)
- Calculate drop position based on mouse X position
- Create new clip object on drop
- Add clip to track's clip array
- Render newly added clip
- Emit event to update timeline state

## Testing Checklist
- [ ] All track lanes render correctly (Video 1, Video 2, Audio, Text)
- [ ] Track labels display on left side
- [ ] Clips render as rectangles on tracks
- [ ] Clip width matches duration
- [ ] Clip position matches startTime
- [ ] Clicking clip selects it (highlights)
- [ ] Selected clip updates Properties Panel
- [ ] Clips can be dropped from Media Library
- [ ] Drop position calculated correctly
- [ ] Thumbnails generate (if implemented)
- [ ] Theme styling applied to tracks and clips

## Done When
✅ Multi-track system implemented  
✅ Clips render with correct position and size  
✅ Clip selection works  
✅ Drop target accepts clips from Media Library  
✅ Time-to-pixel calculation accurate  
✅ Thumbnails display (optional)  
✅ All tests pass  
✅ Ready for Phase 32 (Playhead)

---
**Phase**: 31 | **Component**: Editor  
**Estimated Time**: 35-45 minutes
