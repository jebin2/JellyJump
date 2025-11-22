# Phase 22: Player Upload

## Goal
Implement file upload button and drag-and-drop zone for adding videos to playlist.

## Features to Implement

### Feature 1: File Upload Button
**Purpose**: Browse and select video files using MediaBunny

**Requirements**:
- Button opens file picker dialog
- Accept video formats: MP4, WebM, MOV, AVI
- Allow multiple file selection
- **Consult**: mediabunny-llms-full.md for:
  - Creating `Input` objects from file blobs
  - Using `BlobSource` for local files
  - Format validation using `getFormat()`
- Extract metadata (title, duration) from MediaBunny Input
- Add selected videos to playlist
- **Reference**: "Reading media files" and "BlobSource" sections in mediabunny-llms-full.md

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
**Purpose**: Get video information using MediaBunny for playlist display

**Requirements**:
- **Consult**: mediabunny-llms-full.md for comprehensive metadata extraction:
  - `input.getDuration()` for video duration
  - `input.getTracks()` for track information
  - `input.getFormat()` for format details
  - Track metadata: dimensions, codec, language
- Get filename as default title
- **Optional**: Generate thumbnail using CanvasSink (see "Media sinks" section)
- Store MediaBunny Input reference for playback
- Handle videos that fail to load metadata gracefully
- **Reference**: "Reading track metadata" and "CanvasSink" in mediabunny-llms-full.md

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
**Phase**: 22 | **Component**: Player
**Estimated Time**: 40-60 minutes
