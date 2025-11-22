# Phase 17: Player Upload

## Goal
Implement file upload button and drag-and-drop zone for adding videos to playlist.

## Features to Implement

### Feature 1: File Upload Button
**Purpose**: Browse and select video files to add

**Requirements**:
- Button opens file picker dialog
- Accept video formats: MP4, WebM, MOV, AVI
- Allow multiple file selection
- Use **MediaBunny** `Input` with `BlobSource` to ingest files
- Extract metadata (title, duration) using MediaBunny
- Add selected videos to playlist

### Feature 2: Folder Upload
**Purpose**: Upload entire folder of videos at once

**Requirements**:
- Separate button for folder upload
- Recursively find all video files in folder
- Add all found videos to playlist
- Show progress indicator during processing
- Handle large folders efficiently

### Feature 3: Drag and Drop Zone
**Purpose**: Drag video files directly onto playlist

**Requirements**:
- Entire playlist area is drop zone
- Show visual indicator when dragging files over
- Accept single or multiple files
- Accept folders (extract videos)
- Validate files are video format
- Show error for unsupported formats

### Feature 4: File Validation
**Purpose**: Ensure only valid video files are added

**Requirements**:
- Check MIME type and file extension
- Reject non-video files
- Show error message for invalid files
- Handle partial selection (some valid, some invalid)
- Provide feedback on what was accepted/rejected

### Feature 5: Metadata Extraction
**Purpose**: Get video information for playlist display

**Requirements**:
- Use **MediaBunny** to read file metadata (duration, tracks)
- Get filename as default title
- Generate thumbnail if possible (optional)
- Store file reference for playback
- Handle videos that fail to load metadata

## Testing Checklist
- [ ] Upload button opens file picker
- [ ] Can select multiple files
- [ ] Drag and drop works
- [ ] Invalid files are rejected with error
- [ ] Metadata extracted correctly
- [ ] Videos added to playlist

## Done When
✅ Upload functionality works  
✅ Drag and drop works  
✅ Validation works  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 17 | **Component**: Player
**Estimated Time**: 40-60 minutes
