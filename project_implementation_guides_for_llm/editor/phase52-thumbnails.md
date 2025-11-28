# Phase 52: Video Thumbnail Generation

## Goal
Use MediaBunny VideoSampleSink for first frame, cache in IndexedDB, lazy loading

---

## What to Build

Media thumbnails:
- Generate video thumbnails
- Extract frame at mid-point
- Audio waveform previews
- Image thumbnail scaling
- Cache generated thumbnails
- Placeholder for loading

---

## Feature to Implement

### ONE Feature: Video Thumbnail Generation
**Purpose**: Generate thumbnail images from video files to display in media library tiles

**Requirements**:

#### 1. What to Build
Generate and display video thumbnails:
- Capture first frame of each video as thumbnail
- Use MediaBunny VideoSampleSink to extract frame
- Convert frame to blob/data URL
- Cache thumbnails in IndexedDB
- Display thumbnails in video tiles (Phase 45)
- Lazy load thumbnails (generate on-demand)

#### 2. When to Generate Thumbnails
Generate thumbnails:
- **Option A**: Immediately when video uploaded (Phase 41)
- **Option B**: Lazy - when video first displayed (more efficient)
- **Option C**: Background task after upload completes

Recommendation: **Option B - Lazy loading** when video tile is first rendered.

#### 3. MediaBunny VideoSampleSink
Use MediaBunny to capture first frame:

```javascript
Process:
1. Initialize MediaBunny Player with video blob
2. Create VideoSampleSink
3. Seek to frame 0 or 0.1 seconds
4. Capture frame using VideoSampleSink
5. Convert video frame to canvas/image
6. Export as blobobor data URL
7. Store in IndexedDB
8. Dispose Player and Sink
```

See `mediabunny-llms-full.md` for VideoSampleSink API details.

#### 4. Thumbnail Specifications
Generate thumbnails with these specs:
- **Size**: 200x150px or 240x135px (16:9 aspect ratio preferred)
- **Format**: JPEG or WebP for smaller file size
- **Quality**: 70-80% (balance quality vs size)
- **Frame**: First frame (0.1 seconds) to avoid black frames

#### 5. Canvas Rendering
Steps to create thumbnail image:
1. Get video frame from VideoSampleSink
2. Create offscreen canvas (200x150px)
3. Draw frame to canvas using `drawImage()`
4. Scale/crop to fit (use `object-fit: cover` logic)
5. Export canvas to blob: `canvas.toBlob(callback, 'image/jpeg', 0.75)`

#### 6. IndexedDB Caching
Store thumbnails in IndexedDB:
- **Option A**: Add `thumbnail` field to existing media object
- **Option B**: Create separate thumbnails store

Recommendation: **Option A** - add to media object:
```javascript
{
  id: UUID,
  name: filename,
  type: "video",
  blob: Blob (original video),
  thumbnail: Blob (thumbnail image),
  thumbnailGenerated: boolean,
  // ... other fields
}
```

#### 7. Thumbnail Display Flow
When rendering video tile (Phase 45):
1. Check if thumbnail exists in IndexedDB
2. If exists: Display thumbnail immediately
3. If not exists:
   - Show placeholder 🎬
   - Generate thumbnail in background (async)
   - Update tile with thumbnail when ready
   - Save thumbnail to IndexedDB

#### 8. Lazy Loading Strategy
Improve performance with lazy loading:
- Only generate thumbnails for visible videos
- Use Intersection Observer to detect visible tiles
- Generate thumbnails as user scrolls
- Prioritize thumbnails for currently active category

#### 9. Error Handling
Handle thumbnail generation errors:
- **Video can't be loaded**: Use placeholder icon
- **MediaBunny initialization fails**: Use placeholder
- **Canvas export fails**: Use placeholder
- **IndexedDB save fails**: Show thumbnail anyway, but don't cache
- Log errors to console for debugging

#### 10. Existing Videos
For videos already in library (uploaded in Phase 41):
- Generate thumbnails on first view
- OR: Background task to generate all missing thumbnails
- Mark videos needing thumbnails: `thumbnailGenerated: false`

#### 11. Thumbnail Regeneration
Allow thumbnail regeneration:
- If thumbnail corrupted or missing
- If user wants different frame (not in this phase - future enhancement)
- Delete thumbnail, regenerate on next view

#### 12. Performance Considerations
Optimize for large libraries:
- Throttle: Generate max 3 thumbnails concurrently
- Queue: Process thumbnails one by one or in small batches
- Cancel: Stop generation if tile scrolled out of view
- Memory: Dispose MediaBunny resources promptly

#### 13. Progress Indication
Show thumbnail generation in progress:
- Spinner or shimmer effect on tile
- "Generating thumbnail..." text (optional)
- Smooth transition when thumbnail loads

#### 14. Alternative: Simpler Approach
If MediaBunny is complex, use HTML5 video:
```javascript
const video = document.createElement('video');
video.src = URL.createObjectURL(blob);
video.currentTime = 0.1; // Seek to 0.1s
video.onseeked = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 150;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, 200, 150);
  canvas.toBlob(blob => {
    // Save blob to IndexedDB
  }, 'image/jpeg', 0.75);
};
```

Recommendation: **HTML5 approach** for simplicity, unless MediaBunny already integrated.

#### 15. Accessibility
- Thumbnails are purely visual (decorative)
- Use `alt=""` on thumbnail images (filename in tile label)
- Ensure tiles still accessible without thumbnails

#### 16. Files to Create/Modify
- `assets/js/thumbnail-generator.js` - Create new file for thumbnail generation logic
- `assets/js/media-library.js` - Integrate thumbnail generation with tile rendering
- Reuse `assets/js/indexeddb-helper.js` for caching
- Update Phase 45's tile rendering to show thumbnails

#### 17. JavaScript Organization
Create ThumbnailGenerator class/module:
- `generateThumbnail(videoBlob)` - Main generation method
- `captureThumbnailFrame(videoBlob, time)` - Capture specific frame
- `saveThumbnailToIndexedDB(videoId, thumbnailBlob)` - Cache thumbnail
- `getThumbnailFromCache(videoId)` - Retrieve cached thumbnail
- `disposeThumbnailResources()` - Clean up MediaBunny/video elements

Extend MediaLibrary class:
- `loadThumbnailForTile(tileElement, mediaId)` - Load or generate thumbnail
- `displayThumbnail(tileElement, thumbnailBlob)` - Show thumbnail in tile
- `queueThumbnailGeneration(mediaId)` - Add to generation queue

#### 18. Data Attributes
- `data-thumbnail-status="loading|loaded|error"` on video tiles

#### 19. MediaBunny Integration
Use MediaBunny VideoSampleSink:
- Initialize Player with video blob
- Create VideoSampleSink: `new VideoSampleSink()`
- Set to first frame: `player.currentTime = 0.1`
- Capture frame: `await sink.getSample()`
- Convert to image (see MediaBunny docs)
- Dispose: `player.dispose()`, `sink.dispose()`

Consult `mediabunny-llms-full.md` for detailed VideoSampleSink usage.

#### 20. What NOT to Do
- ❌ Do NOT implement custom thumbnail frame selection (user chooses frame) - use first frame only
- ❌ Do NOT generate animated thumbnails or GIFs
- ❌ Do NOT implement thumbnail editing (filters, crop)
- ❌ Do NOT generate thumbnails for audio files (use icons)
- This phase is **video thumbnails ONLY**

## References
- **Phase 41**: Video upload functionality
- **Phase 45**: Tile display (will show thumbnails)
- **MediaBunny Docs**: See mediabunny-llms-full.md for VideoSampleSink
- **IndexedDB**: Use existing database from Phase 30

---

## Testing Checklist Checklist
- [ ] Video tiles show placeholder initially
- [ ] Thumbnails generate when video tiles first visible
- [ ] Thumbnail displays in tile after generation
- [ ] Thumbnail is first frame of video
- [ ] Thumbnail size appropriate (200x150px or similar)
- [ ] Thumbnails cached in IndexedDB
- [ ] Page reload shows cached thumbnails (no regeneration)
- [ ] Multiple videos generate thumbnails correctly
- [ ] Thumbnail generation doesn't block UI (async)
- [ ] Spinner or loading state during generation
- [ ] Failed thumbnail generation shows placeholder
- [ ] Thumbnails for existing videos generate on first view
- [ ] Lazy loading works (only visible tiles generate)
- [ ] No memory leaks (MediaBunny resources disposed)
- [ ] Console logs errors for failed generations
- [ ] No console errors for successful generations

---

## Done When
✅ Video thumbnails generate using MediaBunny or HTML5  
✅ Thumbnails cached in IndexedDB  
✅ Thumbnails display in video tiles  
✅ Lazy loading implemented  
✅ Error handling works  
✅ Loading state visible during generation  
✅ Performance acceptable (no UI blocking)  
✅ All tests pass  
✅ Ready for Phase 47 (Drag Media Setup)

---
**Phase**: 52 | **Component**: Editor | **Group**: Media Library  
**Estimated Time**: 35 min

## Implementation Notes
- Choose between MediaBunny VideoSampleSink or HTML5 video based on project setup
- HTML5 simpler, MediaBunny more powerful if already integrated
- Lazy loading with Intersection Observer improves performance
- JPEG format smaller than PNG for thumbnails
- Add thumbnail field to existing IndexedDB media objects
- Generate thumbnails asynchronously to avoid blocking UI
