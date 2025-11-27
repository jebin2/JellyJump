### Feature 1: Download Button in Playlist
**Purpose**: Allow users to download videos from playlist

**Requirements**:
- Download icon/button next to "Remove" button in each playlist item
- Download icon: ⬇ or similar
- Position consistently across all items
- Apply theme button styling
- Tooltip: "Download video"

### Feature 2: Download Original File
**Purpose**: Save the original uploaded video file

**Requirements**:
- Download the original file blob/source
- Preserve original filename and format
- Use File System Access API or blob download
- No re-encoding or conversion needed

### Feature 3: Download Progress (Optional)
**Purpose**: Show download status for large files

**Requirements**:
- Show progress indicator if file is large (\>100MB)
- Progress can be simple spinner or percentage
- Replace download button temporarily with progress
- Revert to download button after completion

### Feature 4: Filename Handling
**Purpose**: Use meaningful filenames for downloads

**Requirements**:
- Use original filename if available
- Fallback to video title + extension
- Sanitize filename (remove invalid characters)
- Preserve file extension properly

### Feature 5: Multiple Downloads
**Purpose**: Allow downloading multiple videos

**Requirements**:
- Support clicking download on multiple items
- Queue downloads appropriately
- Don't block other playlist actions
- Download happens in background

### Feature 6: Error Handling
**Purpose**: Handle download failures gracefully

**Requirements**:
- Show error message if download fails
- Common failures: file access, browser blocks
- Provide retry option
- Don't crash or break playlist UI

## Testing Checklist
- [ ] Download button visible in each playlist item
- [ ] Clicking downloads the original video file
- [ ] Filename is correct and sanitized
- [ ] Works for different video formats (MP4, WebM, etc.)
- [ ] Multiple downloads don't conflict
- [ ] Error messages shown for failures

## Done When
✅ Download button added to playlist items  
✅ Downloads work  
✅ Filenames handled correctly  
✅ Error handling implemented  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 25 | **Component**: Player  
**Estimated Time**: 30-40 minutes
