# Phase 36: Import Media Button

## Goal
Implement Import button to open file picker for videos/audio/images and add them to media library

## Group
**Navigation**

## Feature to Implement

### ONE Feature: Import Media Button Functionality
**Purpose**: Allow users to import media files (video, audio, images) into the editor's media library

**Requirements**:

#### 1. What to Build
Make the Import button functional to:
- Open native file picker dialog when clicked
- Accept multiple file types: videos (.mp4, .webm, .mov), audio (.mp3, .wav, .ogg, .m4a), images (.jpg, .png, .gif, .webp)
- Allow multiple file selection at once
- Store imported files in IndexedDB media library
- Show success notification after import
- Update media library UI to display newly imported items

#### 2. File Picker Configuration
Configure the file input to:
- Accept multiple files (multiple attribute)
- Accept specific file types: `video/*, audio/*, image/*`
- Also accept by extension: `.mp4, .webm, .mov, .mp3, .wav, .ogg, .m4a, .jpg, .jpeg, .png, .gif, .webp`
- Trigger file picker when Import button is clicked

#### 3. File Processing Flow
When files are selected:
1. Read each selected file
2. Determine file type (video/audio/image) from MIME type
3. Generate unique ID for each file (UUID)
4. Extract file metadata:
   - **Videos**: duration, resolution, fps (using MediaBunny or HTML5 video)
   - **Audio**: duration
   - **Images**: width, height
5. Store file blob in IndexedDB along with metadata
6. Add item to appropriate category in media library (Videos/Audio/Images)

#### 4. IndexedDB Structure
Store imported media with this structure:
```
MediaLibrary Database:
  - Store: "media"
  - Keys: UUID
  - Values: {
      id: string (UUID),
      name: string (filename),
      type: 'video' | 'audio' | 'image',
      blob: Blob (file data),
      size: number (bytes),
      duration: number (seconds, video/audio only),
      width: number (images/videos),
      height: number (images/videos),
      fps: number (videos only),
      dateAdded: timestamp
    }
```

#### 5. User Feedback
Provide clear feedback during import:
- **During selection**: File picker dialog from browser
- **During processing**: Show loading indicator or "Importing..." message
- **On success**: Show notification: "✅ 3 files imported successfully"
- **On error**: Show error notification: "❌ Failed to import filename.mp4: [reason]"
- Notification should auto-dismiss after 3-4 seconds

#### 6. Media Library Update
After successful import:
- If Media Library panel shows "Videos" tab and a video was imported → update Videos list
- If Media Library panel shows "Audio" tab and audio was imported → update Audio list
- If Media Library panel shows "Images" tab and an image was imported → update Images list
- Update the count badge on the vertical tab (e.g., "Videos (3)" → "Videos (4)")
- Scroll to show newly added items

#### 7. Error Handling
Handle these error scenarios:
- **No file selected**: Do nothing, no error
- **Unsupported file type**: Show error "File type not supported"
- **File too large**: Warn if file > 500MB, but still allow import
- **IndexedDB error**: Show error "Failed to save to library"
- **Metadata extraction failed**: Still import file, use defaults (duration: 0, etc.)

#### 8. Edge Cases
- **Import during project editing**: Imported files should be available immediately
- **Import when library category closed**: Files should import successfully, update happens when category opened
- **Import same file twice**: Allow it, create new UUID each time (duplicates are OK)
- **No IndexedDB support**: Show error "Browser storage not supported"

#### 9. Accessibility
- Import button already has proper label from Phase 27
- File input should have `aria-label="Import media files"`
- Use `role="status"` on notification/toast messages
- Ensure keyboard users can trigger file picker (Enter/Space on button)

#### 10. Files to Create/Modify
- `editor.html` - Add hidden `<input type="file">` element for file picker
- `assets/js/media-library.js` - Create new file for media library logic
- `assets/js/indexeddb-helper.js` - Create new file for IndexedDB operations
- `assets/js/import-handler.js` - Create new file for import logic
- Extend dropdown-menu.js to handle Import button click

#### 11. Data Attributes
- `data-action="import"` on Import button (already added in Phase 27)
- `data-file-input="media-import"` on hidden file input element

#### 12. MediaBunny Integration
Use MediaBunny to extract video metadata:
- Initialize temporary Player instance to load video
- Read `player.width`, `player.height`, `player.duration`, `player.fps`
- Clean up Player instance after metadata extracted
- See `mediabunny-llms-full.md` for Player initialization

Alternative: Use HTML5 `<video>` element's `loadedmetadata` event for simpler approach

#### 13. What NOT to Do
- ❌ Do NOT build drag-and-drop import yet (comes later if needed)
- ❌ Do NOT build thumbnail generation (that's Phase 46)
- ❌ Do NOT build tile/grid display (that's Phase 45)
- ❌ Do NOT implement Export dropdown yet (that's Phase 31)
- This phase is **Import functionality ONLY**

## References
- **Phase 27**: Import button already exists with `data-action="import"` attribute
- **Phase 45**: Will use this imported data for tile display
- **Phase 46**: Will generate thumbnails for imported videos
- **IndexedDB**: Use standard IndexedDB API, no external libraries
- **MediaBunny**: See mediabunny-llms-full.md for metadata extraction

## Testing Checklist
- [ ] Click Import button opens file picker dialog
- [ ] File picker accepts video files (.mp4, .webm, .mov)
- [ ] File picker accepts audio files (.mp3, .wav, .ogg)
- [ ] File picker accepts image files (.jpg, .png, .gif)
- [ ] Can select multiple files at once
- [ ] Selected files are stored in IndexedDB
- [ ] Video metadata extracted (duration, resolution, fps)
- [ ] Audio metadata extracted (duration)
- [ ] Image metadata extracted (width, height)
- [ ] Success notification shows after import
- [ ] Notification auto-dismisses after 3-4 seconds
- [ ] Error notification shows for unsupported file types
- [ ] Can import same file multiple times (creates duplicates)
- [ ] Console shows no errors during import
- [ ] IndexedDB database can be viewed in DevTools
- [ ] Imported files persist after page reload

## Done When
✅ Import button opens file picker  
✅ Multiple file types accepted  
✅ Files stored in IndexedDB with metadata  
✅ Success notification displays  
✅ Video metadata extracted correctly  
✅ Audio metadata extracted correctly  
✅ Image metadata extracted correctly  
✅ Error handling works  
✅ All tests pass  
✅ Ready for Phase 31 (Export Dropdown Menu)

---
**Phase**: 36 | **Component**: Editor | **Group**: Navigation  
**Estimated Time**: 25 min

## Implementation Notes
- IndexedDB is async - use promises or async/await
- File reading is async - handle with FileReader API
- MediaBunny Player initialization is async
- Keep Import logic separate from display logic (separation of concerns)
- Media Library display comes in Phase 45
