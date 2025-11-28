# Phase 20: URL Upload Feature

## Goal
Allow users to add videos to playlist from remote URLs (e.g., direct video links, CDN URLs).

---

## What to Build

URL upload system with:
- Upload button and modal interface
- URL validation and fetch logic
- CORS error handling
- Loading indicators
- Integration with playlist and MediaBunny

---

## Features to Implement

### Feature 1: Upload URL Button
**Purpose**: Provide UI entry point for URL-based uploads

**Requirements**:
- New button: "Upload from URL" or "📎 URL"
- Positioned near existing upload buttons (Files, Folder, Clear)
- Consistent styling with other buttons
- Icon: Link/chain icon (🔗) or paperclip (📎)
- Keyboard accessible
- Tooltip: "Add video from URL"

### Feature 2: URL Input Modal
**Purpose**: Capture URL input from user

**Requirements**:
- Modal popup with:
  - Title: "Add Video from URL"
  - Text input field for URL
  - Placeholder: "https://example.com/video.mp4"
  - "Add" button (primary action)
  - "Cancel" button (secondary action)
  - Close button (X) in top corner
- Input validation: Check URL format before submission
- Loading indicator during fetch
- Error message display area

**Modal Behavior**:
- Opens on button click
- Closes on Cancel, Close (X), or Escape key
- Closes on successful add
- Stays open on error (show error message)
- Focus trap: Tab cycles through input and buttons
- Focus input field on open

### Feature 3: URL Validation
**Purpose**: Ensure valid URLs before fetching

**Requirements**:
- Check URL format using regex or URL constructor
- Support HTTP and HTTPS protocols
- Validate common video file extensions (optional)
- Show error for invalid URLs
- Disable "Add" button until valid URL entered

**Error Messages**:
- "Please enter a valid URL"
- "URL must start with http:// or https://"
- "Could not access this URL (CORS error)"
- "This URL does not appear to be a video file"

### Feature 4: Fetch and Add Video
**Purpose**: Download video from URL and add to playlist

**Requirements**:
- Fetch video from URL using `fetch()` API
- Convert response to Blob
- Create MediaBunny Input from Blob
- Extract metadata (duration, format, dimensions)
- Add to playlist with URL as identifier
- Handle loading state (show spinner/progress)
- Handle errors gracefully

### Feature 5: CORS Error Handling
**Purpose**: Handle cross-origin restrictions gracefully

**Requirements**:
- Detect CORS errors
- Show user-friendly error message
- Suggest alternatives (e.g., "Try downloading the file first")
- Don't crash or show cryptic errors

**User Guidance**:
- "CORS Error: This server doesn't allow direct video access. Download the file and use 'Upload Files' instead."
- Link to help/FAQ explaining CORS

### Feature 6: Loading Indicator
**Purpose**: Show progress while fetching large videos

**Requirements**:
- Show spinner or progress bar in modal
- Display status: "Fetching video..."
- Optional: Show download progress (if response supports)
- Disable buttons during fetch
- Allow cancellation (abort fetch)

**Advanced: Progress Tracking**

---

## Testing Checklist
- [ ] "Upload URL" button visible and clickable
- [ ] Modal opens on button click
- [ ] Input field accepts URL
- [ ] Invalid URL shows error
- [ ] Valid URL enables "Add" button
- [ ] Fetching shows loading indicator
- [ ] Successful fetch adds video to playlist
- [ ] Video metadata extracted correctly
- [ ] CORS error shows friendly message
- [ ] Network error handled gracefully
- [ ] Modal closes on success
- [ ] Modal closes on Cancel/Escape
- [ ] Loading state prevents double-submission
- [ ] Keyboard accessible (Tab, Enter, Escape)

---

## Interaction Behavior

**User Flow 1: Successful Add**:
1. User clicks "Upload URL" button
2. Modal opens, input focused
3. User pastes URL: `https://example.com/video.mp4`
4. URL validates ✓
5. User clicks "Add Video"
6. Loading spinner shows
7. Video fetched successfully
8. Video added to playlist
9. Modal closes
10. Success notification (optional)

**User Flow 2: CORS Error**:
1. User enters URL from restrictive server
2. Clicks "Add Video"
3. Fetch fails with CORS error
4. Error message: "Cannot access this URL due to CORS..."
5. User dismisses error
6. Modal stays open for retry or cancel

**User Flow 3: Invalid URL**:
1. User enters "not-a-url"
2. Validation fails
3. Error message: "Please enter a valid URL"
4. "Add" button disabled
5. User corrects URL
6. "Add" button enabled

---

## Edge Cases
- URL with query parameters: Extract clean filename
- URL without file extension: Use generic name "Remote Video"
- Very large files: Show progress, allow cancellation
- Slow network: Don't timeout too quickly (30s timeout)
- Non-video files: Detect MIME type, reject non-video
- Duplicate URLs: Check if already in playlist, skip or warn
- Special characters in URL: Properly encode/decode

---

## Accessibility
- Modal has aria-labelledby pointing to title
- Modal has role="dialog"
- Input has label: "Video URL"
- Error messages have role="alert"
- Focus trapped in modal
- Escape key closes modal
- Screen reader announces loading state

## Files to Modify
- `player.html` - Add URL button and modal structure
- `player.css` - Style modal and button
- `player.js` - Add URL fetch logic
- `playlist.js` - Integrate URL-sourced videos

---

## What NOT to Do
- ❌ Don't fetch without validating URL first
- ❌ Don't store entire video in localStorage (too large)
- ❌ Don't allow non-HTTPS URLs (security risk)
- ❌ Don't timeout too quickly (large videos need time)
- ❌ Don't show technical error messages (be user-friendly)
- ❌ Don't forget to abort fetch on cancel

---

## MediaBunny Integration

**Required APIs**:
- `Input` - Create input from Blob
- `BlobSource` - Wrap fetched blob
- `getFormat()` - Extract video metadata
- Resource cleanup when removing from playlist

**Reference**: Consult `mediabunny-llms-full.md` for:
- Input creation from Blob
- Format detection
- Error handling

## Integration with Phase 21
- Single URL upload should auto-load (Phase 21)
- Check: `if (playlistLength === 0) { autoLoad(video); }`

---

## Done When
✅ "Upload URL" button added  
✅ Modal opens and closes correctly  
✅ URL validation works  
✅ Fetch and add video from valid URL  
✅ CORS errors handled gracefully  
✅ Loading indicator shows during fetch  
✅ Video added to playlist with metadata  
✅ All tests pass  
✅ Keyboard accessible  
✅ Ready for next phase

---
**Phase**: 20 | **Component**: Player  
**Estimated Time**: 60-80 minutes
