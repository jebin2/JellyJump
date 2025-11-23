# Phase 52: Resolution & FPS Display

## Goal
Display video metadata from the existing MediaBunny Player.

## Group
**Preview Player**

## Feature to Implement

### ONE Feature: Metadata Display
**Purpose**: Show tech specs: "1920x1080 @ 30fps".

**Requirements**:

#### 1. What to Build
- **UI**: Small text label below or overlaying the video.
- **Logic**:
    - Listen to `player.on('loadedmetadata', callback)`.
    - Read `player.videoWidth`, `player.videoHeight`.
    - Read `player.fps` (if available) or fallback to IndexedDB metadata.
    - Update display.

#### 2. Files to Create/Modify
- `assets/js/preview-player.js`

#### 3. MediaBunny Integration
- Access properties on the `player` instance.
- If `player` doesn't expose FPS directly, check the `mediaItem` data from Phase 41.

#### 4. What NOT to Do
- ❌ Do NOT try to calculate FPS manually by counting frames. Use stored metadata.

## Testing Checklist
- [ ] Resolution shows correctly
- [ ] FPS shows correctly (if available)
- [ ] Updates when new video loads
- [ ] Clears when video unloads

## Done When
✅ Metadata display works  
✅ Ready for Phase 53
