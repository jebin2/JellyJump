# Phase 52: Resolution & FPS Display

## Goal
Show video metadata: 1920x1080 @ 30fps

## Group
**Preview Player**

## Feature to Implement

### ONE Feature: Resolution & FPS Display
**Purpose**: Display video resolution and frame rate information

**Requirements**:

#### 1. What to Build
Add metadata display showing:
- Video resolution: Width × Height (e.g., "1920x1080")
- Frame rate: FPS (e.g., "30fps" or "29.97fps")
- Format: "1920x1080 @ 30fps"
- Static display (doesn't change during playback)
- Positioned in controls area or info area

#### 2. Display Format
Format options:

**Option A - Full format**:
- "1920x1080 @ 30fps"
- "1280x720 @ 60fps"

**Option B - Compact format**:
- "1080p30" (derived from 1920x1080 @ 30fps)
- "720p60" (derived from 1280x720 @ 60fps)

**Option C - Abbreviated**:
- "1920×1080·30fps"
- Use × (multiplication sign) and · (middle dot)

Recommendation: **Option A - Full format** (most clear).

#### 3. Layout Position
Place in controls area or near video:

**Option A - Controls area**:
- Right side of controls, before fullscreen button
- Small text, unobtrusive

**Option B - Video overlay** (top-right corner):
- Overlay on video area
- Semi-transparent background
- Always visible or show on hover

**Option C - Below controls**:
- Info bar below controls area
- Additional metadata (codec, bitrate)

Recommendation: **Option B - Video overlay** (top-right corner, subtle).

#### 4. Getting Resolution from Player
Use MediaBunny Player properties:
- Width: `player.videoWidth` or `player.width`
- Height: `player.videoHeight` or `player.height`
- Available after video loaded (`loadedmetadata` event)

Alternative if not in Player API:
- Get from IndexedDB metadata (stored in Phase 41)
- Retrieve using current video ID

#### 5. Getting FPS from Player
Use MediaBunny Player API:
- FPS: `player.fps` (if available)
- OR: Calculate from `player.getVideoPlaybackQuality()` (if supported)

If FPS not available:
- Retrieve from IndexedDB metadata (Phase 41 stored fps)
- Show "-- fps" if unknown

#### 6. Common Resolutions
Display common resolution names (optional enhancement):
- 3840x2160 → "4K (3840x2160)"
- 1920x1080 → "1080p (1920x1080)" or "Full HD"
- 1280x720 → "720p (1280x720)" or "HD"
- 640x360 → "360p (640x360)"

For this phase: Show actual dimensions, skip friendly names.

#### 7. FPS Formatting
Handle different frame rates:
- **Integer FPS**: "30fps", "60fps", "24fps"
- **Decimal FPS**: "29.97fps", "23.976fps"
- Round to 2 decimal places max
- Common frame rates: 24, 25, 30, 29.97, 60, 59.94

#### 8. Display Timing
When to show metadata:
- After video loads (`loaded metadata` event)
- Immediately visible once available
- Remains static during playback

Initial state (no video):
- Show placeholder: "-- x -- @ --fps"
- OR: Hide completely until video loads

#### 9. Edge Cases
- **No resolution available**: Show "-- x --"
- **No FPS available**: Show "@ --fps" or omit FPS
- **Very unusual resolutions** (e.g., 1440x1080): Display as-is
- **Variable frame rate videos**: Show average or "Variable"
- **Portrait videos** (vertical): 1080x1920 (width x height)

#### 10. Styling Requirements
Apply Dark Neobrutalism theme:

**If video overlay**:
- Position: Top-right corner
- Background: Semi-transparent dark (rgba(0,0,0,0.6))
- Padding: 4-8px
- Border: 2px solid (optional)
- Font: Small (11-13px), monospace
- Color: White or light gray
- Z-index: Above video, below controls overlay

**If in controls area**:
- Font: Small (11-13px), monospace
- Color: Secondary text color
- No background (or subtle)

BEM naming: `.video-info`, `.video-info__resolution`, `.video-info__fps`

#### 11. Responsive Behavior
- **Desktop**: Full display "1920x1080 @ 30fps"
- **Tablet**: Compact "1080p @ 30fps"
- **Mobile**: Abbreviated "1080p30" or hide completely

#### 12. Accessibility
- Use `aria-label="Video resolution 1920 by 1080 pixels at 30 frames per second"`
- Metadata is informational, not interactive
- Screen readers should announce on video load
- Use `role="status"` for live updates (though metadata is static)

#### 13. Integration with Player (Phase 49)
Connect to existing player:
- Listen to `loadedmetadata` event
- Get videoWidth, videoHeight, fps from player
- Display in chosen location
- Clear when video unloaded

#### 14. Alternative Data Source
If MediaBunny doesn't provide fps:
- Retrieve from IndexedDB using current video ID
- Use metadata from Phase 41 (video upload)
- Display cached values

#### 15. Files to Create/Modify
- `editor.html` - Add metadata display element (overlay or controls)
- `assets/css/editor.css` - Add metadata display styles
- `assets/js/preview-player.js` - Add metadata extraction and display logic

#### 16. JavaScript Organization
Extend PreviewPlayer class:
- `getVideoMetadata()` - Extract resolution and fps from player
- `displayMetadata(width, height, fps)` - Update metadata display
- `formatResolution(width, height)` - Format as "WxH"
- `formatFPS(fps)` - Format frame rate
- `onMetadataLoaded()` - Handle loadedmetadata event

#### 17. Data Attributes
- `data-video-info="metadata"` on display element

#### 18. What NOT to Do
- ❌ Do NOT add codec information (MP4, H.264, etc.) - keep simple
- ❌ Do NOT add bitrate display (not in scope)
- ❌ Do NOT add file size display
- ❌ Do NOT make metadata interactive or editable
- ❌ Do NOT add aspect ratio separately (implied by resolution)
- This phase is **resolution and FPS display ONLY**

**MediaBunny Integration**: Use Player.videoWidth, Player.videoHeight, Player.fps properties

## References
- **Phase 41**: Video metadata stored in IndexedDB
- **Phase 49**: Player instance with video properties
- **MediaBunny Docs**: See mediabunny-llms-full.md for video properties

## Testing Checklist
- [ ] Metadata display visible when video loaded
- [ ] Shows correct resolution (e.g., "1920x1080")
- [ ] Shows correct FPS (e.g., "30fps")
- [ ] Format: "1920x1080 @ 30fps"
- [ ] Metadata appears after video loads
- [ ] Metadata cleared when video unloaded
- [ ] Decimal FPS formatted correctly ("29.97fps")
- [ ] Integer FPS formatted correctly ("60fps")
- [ ] Placeholder shown when no video ("-- x -- @ --fps")
- [ ] Different resolutions display correctly (1080p, 720p, 4K)
- [ ] Portrait videos show correct dimensions
- [ ] Monospace font if applicable
- [ ] Readable text (good contrast)
- [ ] Positioned correctly (overlay or controls)
- [ ] No overlap with other controls
- [ ] No console errors

## Done When
✅ Resolution and FPS display functional  
✅ Metadata extracted from player  
✅ Format: "1920x1080 @ 30fps"  
✅ Displays after video loads  
✅ Clears when video unloaded  
✅ Styled appropriately  
✅ All tests pass  
✅ Ready for Phase 53 (Full-Screen Toggle)

---
**Phase**: 52 | **Component**: Editor | **Group**: Preview Player  
**Estimated Time**: 10 min

## Implementation Notes
- videoWidth/videoHeight available after loadedmetadata event
- FPS may not be directly available in all players (use IndexedDB fallback)
- Keep display subtle and unobtrusive
- Metadata is static during playback (no real-time updates needed)
- Can fallback to metadata stored in Phase 41 if player doesn't expose fps
