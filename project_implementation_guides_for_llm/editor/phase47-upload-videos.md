# Phase 47: Upload Video Files

## Goal
File picker for videos, add to Videos category, store in IndexedDB

## Group
**Media Library**

## Feature to Implement

### ONE Feature: Upload Video Files to Media Library
**Purpose**: Add video file upload functionality specifically for the Videos category

**Requirements**:

#### 1. What to Build
Add video upload capability to Videos category:
- Click or button in Videos category to trigger file picker
- Accept only video files (.mp4, .webm, .mov, .avi, .mkv)
- Allow multiple file selection
- Extract video metadata (duration, resolution, fps)
- Store videos in IndexedDB
- Update Videos count badge
- Display uploaded videos in Videos category

#### 2. Upload Trigger UI
Add upload button/area to Videos content section:
- **Option 1**: Upload button at top of Videos content area
- **Option 2**: Entire empty state is clickable to upload
- **Option 3**: Plus icon button in Videos tab header

Recommendation: **Upload button at top** + clickable empty state

Button styling:
- Text: "+ Add Videos" or "📥 Import Videos"
- Dark Neobrutalism button style
- Positioned at top of Videos content area
- Always visible (even when videos exist)

#### 3. File Picker Configuration
Configure video file input:
- Accept attribute: `video/*, .mp4, .webm, .mov, .avi, .mkv`
- Multiple: true (allow multiple selection)
- Hidden input, triggered by button click

#### 4. Video Processing Flow
When video files selected:
1. Validate each file is a video type
2. For each valid video:
   - Generate unique UUID
   - Extract metadata: duration, width, height, fps, codec
   - Create video object with metadata
   - Store blob in IndexedDB (use existing media store from Phase 30)
   - Add to Videos category display
   - Update Videos count badge
3. Show success notification: "✅ 2 videos added"

#### 5. Metadata Extraction
Use MediaBunny OR HTML5 video to extract:
- **Duration**: Total length in seconds
- **Width**: Video width in pixels
- **Height**: Video height in pixels
- **FPS**: Frames per second
- **Size**: File size in bytes
- **Codec**: Video codec (if available)
- **Filename**: Original filename

**MediaBunny approach**:
```
- Initialize Player with video blob
- Wait for player ready
- Read player.width, player.height, player.duration, player.fps
- Dispose player
```

**HTML5 approach** (simpler):
```
- Create <video> element
- Set src to blob URL
- Listen for 'loadedmetadata' event
- Read videoWidth, videoHeight, duration
- Note: FPS not directly available in HTML5
```

Recommendation: **HTML5 for simplicity**, MediaBunny if FPS needed.

#### 6. IndexedDB Storage
Store video in same database as Phase 30:
```
Database: "MediaLibraryDB"
Store: "media"
Object: {
  id: UUID,
  name: filename,
  type: "video",
  blob: Blob,
  size: number (bytes),
  duration: number (seconds),
  width: number,
  height: number,
  fps: number (0 if not available),
  dateAdded: timestamp,
  category: "videos"
}
```

#### 7. Videos Category Update
After successful upload:
- Increment Videos count badge: "(0)" → "(1)"
- Add video item to Videos content area (actual display in Phase 45)
- Remove empty state message if it was showing
- Scroll to show newly added videos

#### 8. User Feedback
Provide clear feedback:
- **During upload**: Show loading spinner "Importing videos..."
- **On success**: Notification "✅ 2 videos added to library"
- **On error**: "❌ Failed to import filename.mp4: invalid file"
- **File type error**: "❌ Only video files are supported"
- Notifications auto-dismiss after 3 seconds

#### 9. Error Handling
Handle these errors:
- **No file selected**: Do nothing
- **Non-video file**: Skip with error notification
- **Metadata extraction failed**: Still import, use defaults (duration: 0, etc.)
- **IndexedDB error**: Show "Failed to save video"
- **File too large** (> 500MB): Warn but allow (optional)

#### 10. Integration with Phase 30
Phase 30 already built generic Import functionality:
- This phase is **specific to Videos category**
- Reuse Import logic from Phase 30
- Could use same file input or separate input
- Store in same IndexedDB structure

Design choice:
- **Option A**: Top Import button (Phase 30) handles all media types, this phase just filters to Videos tab
- **Option B**: Each category has its own upload button with specific file type

Recommendation: **Option B** for clarity - each category has upload button.

#### 11. Duplicate Handling
When uploading a file with same name:
- Allow duplicate (create new UUID)
- OR: Warn "Video with this name exists, import anyway?"
- Recommendation: **Allow duplicates** (simpler)

#### 12. Edge Cases
- **Upload when Audio tab active**: Videos still go to Videos category (not current)
- **Upload same file twice**: Creates duplicate with new UUID (OK)
- **Very large files**: Warn if > 500MB, but allow
- **Corrupted video file**: Metadata extraction fails, use defaults

#### 13. Accessibility
- Upload button keyboard accessible (Tab, Enter/Space)
- Add `aria-label="Upload videos"`
- Announce upload success/error to screen readers
- File input has `aria-label="Select video files"`

#### 14. Files to Create/Modify
- `editor.html` - Add upload button to Videos content area
- `editor.html` - Add hidden file input for videos
- `assets/js/media-library.js` - Add video upload logic
- Reuse `assets/js/indexeddb-helper.js` from Phase 30
- `assets/css/editor.css` - Style upload button

#### 15. JavaScript Organization
Extend MediaLibrary class:
- `uploadVideos()` - Trigger file picker
- `processVideoFiles(files)` - Loop through files
- `extractVideoMetadata(file)` - Get duration, resolution, etc.
- `saveVideoToIndexedDB(videoData)` - Store in database
- `addVideoToUI(videoData)` - Add to category display (basic, detailed in Phase 45)
- `updateVideosCount()` - Increment badge count

#### 16. Data Attributes
- `data-upload="videos"` on upload button
- `data-file-input="video-upload"` on hidden file input

#### 17. What NOT to Do
- ❌ Do NOT generate thumbnails yet (that's Phase 46)
- ❌ Do NOT create full tile display yet (that's Phase 45 - basic display OK)
- ❌ Do NOT implement drag-and-drop to timeline (that's Phase 47)
- ❌ Do NOT implement search/filter (that's Phase 44)
- This phase is **video upload ONLY**

**MediaBunny Integration**: Optional for metadata extraction

## References
- **Phase 30**: Generic import functionality and IndexedDB setup
- **Phase 40**: Videos category tab switching
- **Phase 45**: Full tile/grid display for videos
- **Phase 46**: Thumbnail generation
- **MediaBunny Docs**: See mediabunny-llms-full.md for Player metadata extraction

## Testing Checklist
- [ ] Click "+ Add Videos" button opens file picker
- [ ] File picker accepts only video files (.mp4, .webm, .mov)
- [ ] Can select multiple video files at once
- [ ] Selected videos are stored in IndexedDB
- [ ] Video metadata extracted (duration, resolution)
- [ ] Videos count badge updates: "(0)" → "(2)"
- [ ] Success notification: "✅ 2 videos added"
- [ ] Notification auto-dismisses after 3 seconds
- [ ] Empty state disappears when videos added
- [ ] Non-video files rejected with error
- [ ] Large video files (> 100MB) import successfully
- [ ] Duplicate filenames allowed (creates new UUID)
- [ ] Videos persist after page reload (IndexedDB)
- [ ] Console has no errors
- [ ] Upload button keyboard accessible

## Done When
✅ Upload button functional in Videos category  
✅ File picker accepts video files only  
✅ Multiple videos can be uploaded  
✅ Metadata extracted correctly  
✅ Videos stored in IndexedDB  
✅ Count badge updates  
✅ Success/error notifications work  
✅ All tests pass  
✅ Ready for Phase 42 (Upload Audio Files)

---
**Phase**: 42 | **Component**: Editor | **Group**: Media Library  
**Estimated Time**: 30 min

## Implementation Notes
- Reuse IndexedDB structure from Phase 30
- Metadata extraction is async (use promises/async-await)
- HTML5 video element simpler than MediaBunny for basic metadata
- Phase 45 will improve the display with tiles
- Phase 46 will add thumbnail previews
