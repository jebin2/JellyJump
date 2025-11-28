# Phase 74: Clip Thumbnails (Optional)

## Goal
Display video frame thumbnails inside clip rectangles for visual reference

---

## What to Build

Clip thumbnails:
- Generate thumbnail strip
- Show frames across duration
- Update on zoom level
- Cache thumbnails
- Lazy load for performance
- Handle audio waveforms

---

## Feature to Implement

### ONE Feature: Clip Thumbnail Preview
**Purpose**: Show representative video frames inside timeline clips for easier visual editing

**Requirements**:

#### 1. What to Build
Add thumbnail images to video clips:
- Extract frames from video using MediaBunny
- Display multiple thumbnails across clip width
- Show first frame always (poster)
- Optional: Show thumbnails at intervals
- Overlay on clip rectangle (Phase 67)
- Only for video clips (audio/images skip)

#### 2. When to Generate Thumbnails
Thumbnail extraction timing:
- **Option 1**: Generate on drop (Phase 66) - single first frame
- **Option 2**: Generate in background after drop - multiple frames
- **Option 3**: Skip for v1, add in future phase

Recommendation: **Extract first frame only** for v1 (simplest)

#### 3. First Frame Extraction
Use MediaBunny to extract poster frame:

Process:
1. Get media file from IndexedDB
2. Create MediaBunny Input from file
3. Seek to 0 seconds (first frame)
4. Capture frame as image (canvas or blob)
5. Store as data URL or blob URL
6. Display in clip element

MediaBunny method:
- Use `Player` class to load video
- Seek to specific time
- Draw current frame to canvas with `drawImage()`
- Convert canvas to data URL: `canvas.toDataURL('image/jpeg')`

#### 4. Display Single Thumbnail
First frame thumbnail:
- Position: Background image of clip element
- Sizing: Cover entire clip area
- Opacity: 50-70% (blend with clip color)
- Overlay: Filename label on top

CSS approach:
```
.timeline-clip {
  background-image: url(data:image/jpeg;base64,...);
  background-size: cover;
  background-position: center;
  background-blend-mode: multiply; // Blend with clip color
}
```

#### 5. Multiple Thumbnail Filmstrip (Optional)
For longer clips, show multiple frames:
- Extract frames at intervals (every 2-5 seconds)
- Display as horizontal filmstrip inside clip
- Thumbnails side-by-side, cropped to fit
- Number of thumbnails based on clip width

Example:
- Clip 10 seconds long → 3-5 thumbnails
- Clip 2 seconds long → 1 thumbnail
- Clip < 1 second → First frame only

Calculation:
```
thumbnailCount = Math.floor(clipDuration / 3)
thumbnailInterval = clipDuration / thumbnailCount
For each interval: Extract frame at time T
```

Recommendation: **Skip multi-frame for v1**, add later

#### 6. Thumbnail Quality and Size
Balance quality vs performance:
- Thumbnail resolution: 160x90px (16:9 aspect, smaller than full clip)
- Compression: JPEG at 70-80% quality
- Format: Data URL for small thumbnails, Blob URL for larger
- Cache thumbnails (store in IndexedDB or memory)

#### 7. Caching Strategy
Avoid re-extracting frames:
- Store thumbnail data URL with media in IndexedDB
- Generate on first use
- Reuse for all clips from same media
- Cache key: `${mediaId}_frame_0`

Structure:
```
media object {
  id: mediaId,
  file: File,
  thumbnail: dataURL,  // First frame
  // OR
  thumbnails: [frame0URL, frame1URL, ...]
}
```

#### 8. Loading State
While extracting thumbnail:
- Show loading spinner or placeholder
- Display clip color background
- Update with thumbnail when ready
- Don't block rendering or interaction

#### 9. Error Handling
Handle extraction failures:
- Video codec not supported: Show no thumbnail, log warning
- Seek failed: Use default poster color
- Timeout (> 2 seconds): Skip thumbnail, render plain clip
- Corrupted video: Fallback to color background

#### 10. Performance Considerations
Optimize for many clips:
- Extract thumbnails asynchronously (Promise.all or queue)
- Limit concurrent extractions (max 3 at a time)
- Use Web Workers for extraction (advanced)
- Low priority: Don't block UI or playback
- Consider lazy loading (extract only visible clips)

#### 11. Styling Integration
Blend thumbnail with clip styling:
- Thumbnail as background layer
- Clip color as overlay (multiply blend mode)
- Filename label on top
- Maintain neobrutalism borders and shadows

Layering (bottom to top):
1. Thumbnail image (background)
2. Color overlay (semi-transparent)
3. Filename label (text)
4. Border and shadow

#### 12. Audio Clips
Audio clips show waveform (future) or icon:
- No thumbnails for audio
- Display waveform visualization (separate phase)
- OR: Show music note icon

For v1: **Plain color background** (no special treatment)

#### 13. Image Clips
Image clips can show the image itself:
- Use image file as thumbnail (no extraction needed)
- Display as background image
- Full opacity (no blending needed)
- Simpler than video extraction

#### 14. Files to Create/Modify
- `assets/js/thumbnail-extractor.js` - Create new file for extraction logic
- `assets/js/clip-renderer.js` - Integrate thumbnails into rendering (Phase 67)
- `assets/css/editor.css` - Add thumbnail background styles
- MediaBunny integration in extraction logic

#### 15. JavaScript Organization
Create ThumbnailExtractor class:
- `extractFirstFrame(mediaFile)` - Extract frame at 0 seconds
- `extractFrameAtTime(mediaFile, time)` - Extract specific frame
- `extractMultipleFrames(mediaFile, times)` - Batch extraction
- `cacheThumnail(mediaId, dataURL)` - Store in IndexedDB
- `getThumbnail(mediaId)` - Retrieve cached thumbnail

Integrate with ClipRenderer:
- `renderClip()` checks if thumbnail exists
- If yes: Apply background-image
- If no: Trigger extraction, update when ready

#### 16. MediaBunny Integration
Extraction implementation:

1. Create Input from file:
```javascript
const input = await Input.fromBlob(mediaFile);
```

2. Create Player:
```javascript
const player = await Player.load(input);
```

3. Seek to time:
```javascript
await player.seek(0); // First frame
```

4. Draw to canvas:
```javascript
const canvas = document.createElement('canvas');
canvas.width = 160;
canvas.height = 90;
const ctx = canvas.getContext('2d');
ctx.drawImage(player.videoElement, 0, 0, 160, 90);
```

5. Convert to data URL:
```javascript
const dataURL = canvas.toDataURL('image/jpeg', 0.8);
```

6. Cleanup:
```javascript
await player.release();
await input.release();
```

#### 17. Accessibility
- Thumbnails are decorative (visual aid)
- No alt text needed (filename label sufficient)
- Ensure filename label readable with thumbnails

#### 18. What NOT to Do
- ❌ Do NOT implement scrubbing thumbnails (hover to preview)
- ❌ Do NOT implement full filmstrip (save for future)
- ❌ Do NOT block clip rendering waiting for thumbnails
- ❌ Do NOT extract high-resolution frames (small is fine)
- This phase: **First frame thumbnail ONLY** (optional feature)

**MediaBunny Integration**: YES - Use Player to extract video frames

## References
- **Phase 67**: Clip rendering (thumbnails overlay on clips)
- **Phase 66**: Drop triggers thumbnail extraction
- **MediaBunny Docs**: Player API, Input.fromBlob, seek, drawImage
- **Code of Conduct**: Async/await for MediaBunny, resource cleanup

---

## Testing Checklist Checklist
- [ ] Thumbnail extraction triggered on video clip drop
- [ ] First frame extracted successfully
- [ ] Thumbnail displayed as clip background
- [ ] Filename label still visible on top
- [ ] Multiple clips show different thumbnails
- [ ] Thumbnail cached (no re-extraction on zoom)
- [ ] Extraction doesn't block UI
- [ ] Loading state shows while extracting
- [ ] Error handling works (unsupported video shows plain clip)
- [ ] MediaBunny resources cleaned up (no memory leaks)
- [ ] No console errors
- [ ] Thumbnail blends well with clip color

---

## Done When
✅ First frame extraction functional  
✅ Thumbnails display on video clips  
✅ Caching prevents re-extraction  
✅ Async extraction doesn't block UI  
✅ Fallback for errors (plain clip)  
✅ MediaBunny resources released  
✅ All tests pass  
✅ Ready for Phase 69 (Playhead Visual)

---
**Phase**: 74 | **Component**: Editor | **Group**: Timeline Interaction  
**Estimated Time**: 25-30 min (Optional - can skip for v1)

## Implementation Notes
- **This phase is OPTIONAL** - can be skipped for MVP
- Thumbnails significantly improve editing UX
- First frame extraction is simple and effective
- Multi-frame filmstrip can be added later
- Caching crucial for performance with many clips
- MediaBunny's Player perfect for frame extraction
- Blend mode creates cohesive visual with clip colors
- If skipped, proceed directly to Phase 69 (Playhead)
