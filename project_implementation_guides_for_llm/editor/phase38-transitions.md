# Phase 38: Transitions

## Goal
Implement transition effects between clips

**MediaBunny Integration**: Transitions are applied during video rendering using MediaBunny's frame processing. **Consult** mediabunny-llms-full.md for:
- `video.process` callback in Conversion API
- Canvas API for blending frames
- Alpha compositing for fade effects

## Features to Implement

### Feature 1: Transition Data Structure
**Purpose**: Store transition information

**Requirements**:
- Transition object properties:
  - `id`: Unique identifier
  - `type`: Transition type ("fade", "crossfade", "wipe")
  - `duration`: Length in seconds (0.5s to 3s)
  - `position`: "start" or "end" of clip or "between" clips
  - `clipId`: Associated clip ID
  - ` settings`: Type-specific parameters
- Add transitions array to clip objects

### Feature 2: Transitions Panel in Properties
**Purpose**: Browse and configure transitions

**Requirements**:
- **⚡ Effects** section in Properties Panel (Phase 29)
- **Transitions** subsection
- Available transition types:
  - 📉 **Fade In**: Fade from black
  - 📈 **Fade Out**: Fade to black
  - 🔄 **Crossfade**: Dissolve between two clips
  - ↔️ **Wipe**: Left-to-right or top-to-bottom
- Thumbnail previews of transition types
- Apply button for each transition
- Only show applicable transitions (e.g., crossfade requires adjacent clips)

### Feature 3: Fade In Transition
**Purpose**: Gradually increase opacity from 0 to 1

**Requirements**:
- Applied to clip start
- Duration slider (0.5s to 3s)
- **Implementation**:
  - During export (Phase 42), process frames at start
  - For each frame in fade duration:
    ```javascript
    opacity = currentTime / fadeDuration; // 0 → 1
    frameAlpha = opacity;
    ```
  - Blend frame with black background
- Real-time preview in Preview Panel (optional)
- Visual indicator on timeline (gradient at clip start)

### Feature 4: Fade Out Transition
**Purpose**: Gradually decrease opacity from 1 to 0

**Requirements**:
- Applied to clip end
- Duration slider (0.5s to 3s)
- **Implementation**:
  - Process frames at clip end
  - For each frame in fade duration:
    ```javascript
    opacity = 1 - ((currentTime - fadeStartTime) / fadeDuration); // 1 → 0
    frameAlpha = opacity;
    ```
  - Blend frame toward black
- Real-time preview in Preview Panel (optional)
- Visual indicator on timeline (gradient at clip end)

### Feature 5: Crossfade Transition
**Purpose**: Dissolve between two adjacent clips

**Requirements**:
- Applied between two clips on same track
- Duration slider (0.5s to 3s)
- **Implementation**:
  - Requires frames from both clips
  - Overlap clips by transition duration
  - For each frame in crossfade:
    ```javascript
    progress = currentTime / crossfadeDuration; // 0 → 1
    blended = clipA * (1 - progress) + clipB * progress;
    ```
  - Render blended frame
- Visual indicator on timeline (overlapping clips with special color)

### Feature 6: Wipe Transition
**Purpose**: Reveal next clip with directional wipe

**Requirements**:
- Applied between two clips
- Direction options: Left-to-Right, Right-to-Left, Top-to-Bottom, Bottom-to-Top
- Duration slider (0.5s to 3s)
- **Implementation**:
  - For each frame, calculate wipe position:
    ```javascript
    progress = currentTime / wipeDuration; // 0 → 1
    wipePosition = progress * frameWidth; // for left-to-right
    // Show clipA left of wipePosition, clipB right of wipePosition
    ```
  - Use canvas clipping/masking
- Visual indicator on timeline

### Feature 7: Transition Duration Control
**Purpose**: Adjust transition length

**Requirements**:
- Duration slider in Properties Panel
- Range: 0.1s to 5s
- Real-time preview update (optional)
- Visual feedback: Transition indicator on timeline resizes
- Validate duration doesn't exceed clip length

### Feature 8: Remove Transition
**Purpose**: Delete applied transition

**Requirements**:
- Remove button next to each applied transition
- Confirmation (optional): "Remove transition?"
- Delete transition from clip's transitions array
- Remove visual indicator from timeline
- Update Properties Panel
- Add to undo stack (Phase 37)

### Feature 9: Timeline Visual Indicators
**Purpose**: Show transitions on timeline

**Requirements**:
- **Fade In**: Gradient overlay at clip start (dark → light)
- **Fade Out**: Gradient overlay at clip end (light → dark)
- **Crossfade/Wipe**: Overlapping clip region with special color
- Hover to show transition details (type, duration)
- Click to select transition for editing

## Testing Checklist
- [ ] Transitions panel displays in Properties
- [ ] Available transition types listed
- [ ] Fade In applies to clip start
- [ ] Fade Out applies to clip end
- [ ] Crossfade requires two adjacent clips
- [ ] Wipe transition offers direction options
- [ ] Duration slider adjusts transition length
- [ ] Remove button deletes transition
- [ ] Timeline shows visual indicators for transitions
- [ ] Transitions export correctly (verified in Phase 42)
- [ ] Undo/redo works with transitions
- [ ] Preview updates (if realtime preview implemented)

## Done When
✅ Transitions panel implemented in Properties  
✅ Fade In/Out functional  
✅ Crossfade works between clips  
✅ Wipe transition with directions  
✅ Duration control works  
✅ Timeline visual indicators display  
✅ Remove transition functional  
✅ Undo integration complete  
✅ All tests pass  
✅ Ready for Phase 39 (Filters)

---
**Phase**: 38 | **Component**: Editor  
**Estimated Time**: 30-40 minutes
