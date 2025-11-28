# Phase 25: Player Download

## Goal
Allow users to download videos from the playlist.

---

## What to Build

Download functionality for playlist items:
- Download button for each video
- Original file download (no re-encoding)
- Proper filename handling
- Error handling and user feedback

---

## Features to Implement

### Feature 1: Download Button in Playlist
**Purpose**: Allow users to download videos from playlist

**Requirements**:
- Download icon/button (⬇) next to "Remove" button in each playlist item
- Position consistently across all items
- Apply theme button styling
- Tooltip: "Download video"
- Visible on hover or always visible

### Feature 2: Download Original File
**Purpose**: Save the original uploaded video file

**Requirements**:
- Download the original file blob/source (no conversion)
- Preserve original filename and format
- Use anchor download or File System Access API
- Trigger browser download dialog
- No re-encoding or quality loss

### Feature 3: Filename Handling
**Purpose**: Use meaningful filenames for downloads

**Requirements**:
- Use original filename if available
- Fallback to video title + extension
- Sanitize filename (remove invalid characters: `/ \ : * ? " < > |`)
- Preserve file extension properly (.mp4, .webm, etc.)
- Handle special characters and Unicode

### Feature 4: Download Progress (Optional)
**Purpose**: Show download status for large files

**Requirements**:
- Show progress indicator if file is large (>100MB)
- Progress can be spinner, percentage, or progress bar
- Replace download button temporarily with progress
- Revert to download button after completion
- Handle download cancellation

### Feature 5: Multiple Downloads
**Purpose**: Allow downloading multiple videos

**Requirements**:
- Support clicking download on multiple items
- Queue downloads appropriately (browser limit ~6 simultaneous)
- Don't block other playlist actions
- Download happens in background
- Show status for each download

### Feature 6: Error Handling
**Purpose**: Handle download failures gracefully

**Requirements**:
- Show error message if download fails
- Common failures: file access denied, browser blocks, network error
- Provide retry option
- Don't crash or break playlist UI
- Log errors for debugging

---

## Interaction Behavior

**User Flow 1: Single Download**:
1. User hovers over playlist item
2. Download button appears/highlights
3. User clicks download button
4. Browser download dialog opens
5. File downloads with correct name
6. Download button returns to normal state

**User Flow 2: Large File**:
1. User clicks download on large video (500MB)
2. Button changes to spinner/"Downloading..."
3. Download progresses in background
4. After completion, button returns to download icon
5. User can download again if needed

**User Flow 3: Error**:
1. User clicks download
2. Download fails (network error)
3. Error toast/message: "Download failed. Try again?"
4. User clicks retry
5. Download attempted again

---

## Edge Cases

- Blob URL expired: Re-create blob from stored file
- Download blocked by browser: Show instruction to allow
- Very large files (>1GB): Warn user of size, confirm download
- Special filename characters: Sanitize properly
- Missing file reference: Show error, disable button
- Simultaneous downloads: Queue or allow (browser handles)

---

## Accessibility

- Download button: aria-label="Download [filename]"
- Progress state: aria-live="polite" announces status
- Error messages: role="alert"
- Keyboard accessible (Enter/Space to download)

---

## What NOT to Do

- ❌ Don't re-encode or convert video (download original)
- ❌ Don't block UI during download
- ❌ Don't allow invalid filenames (sanitize first)
- ❌ Don't forget error handling
- ❌ Don't download video currently playing without warning

---

## Testing Checklist

- [ ] Download button visible in each playlist item
- [ ] Clicking downloads the original video file
- [ ] Filename is correct and sanitized
- [ ] Works for different video formats (MP4, WebM, MOV, etc.)
- [ ] Multiple downloads don't conflict
- [ ] Progress indicator shows for large files
- [ ] Error messages shown for failures
- [ ] Retry works after error
- [ ] File extension preserved
- [ ] Works with special characters in filenames

---

## Done When

✅ Download button added to playlist items  
✅ Downloads work for all video formats  
✅ Filenames handled correctly  
✅ Error handling implemented  
✅ Progress indication for large files  
✅ All tests pass  
✅ Ready for next phase

---

**Phase**: 25 | **Component**: Player  
**Estimated Time**: 30-40 minutes
