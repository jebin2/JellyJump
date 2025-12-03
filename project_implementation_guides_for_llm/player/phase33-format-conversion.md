# Phase 33: Format Conversion

## Goal
Enable users to convert videos to different formats (MP4, WebM, AVI, MOV) using MediaBunny's powerful conversion capabilities.

**MediaBunny Note**: This phase extensively uses MediaBunny's Conversion class with different output codecs and container formats. Consult `mediabunny-llms-full.md` for Conversion, codec configuration, and format export.

---

## What to Build

Video format conversion system with:
- Modal dialog for format selection
- Support for common video formats
- Progress tracking during conversion
- Option to add converted video to playlist
- Error handling for unsupported codecs

---

## Features to Implement

### Feature 1: Conversion Modal
**Purpose**: Provide UI for selecting target format

**Requirements**:
- Modal opens when "Convert Format..." clicked in settings menu
- Modal title: "Convert Video Format"
- Display source video filename and current format
- Radio button group for format selection
- Checkbox: "Add to playlist after conversion"
- Cancel and Convert buttons
- Apply theme modal styling (dark neobrutalism)

### Feature 2: Format Options
**Purpose**: Support common video container formats

**Requirements**:
- Format options presented as radio buttons:
  - ○ MP4 (H.264/AAC) - Most compatible
  - ○ WebM (VP8/VP9/Opus) - Web optimized
  - ○ AVI (MPEG-4) - Legacy support
  - ○ MOV (QuickTime) - Apple ecosystem
- Each option shows codec information
- Indicate recommended format (MP4 marked as default)
- One format selected by default (MP4)

### Feature 3: MediaBunny Conversion
**Purpose**: Execute video format conversion

**Requirements**:
- Create MediaBunny Conversion instance
- Add Input from source video
- Configure output format based on selection:
  - MP4: Container format mp4, video codec h264, audio codec aac
  - WebM: Container format webm, video codec vp9, audio codec opus
  - AVI: Container format avi
  - MOV: Container format mov, video codec h264
- Set appropriate quality settings (maintain source quality if possible)
- Execute conversion and collect output blob
- Handle conversion errors gracefully

### Feature 4: Progress Indicator
**Purpose**: Show conversion progress to user

**Requirements**:
- Disable form inputs during conversion
- Show progress bar or spinner
- Display percentage if available from MediaBunny
- Show estimated time remaining (optional)
- "Converting..." text with animated dots
- Cancel conversion button (if MediaBunny supports)
- Prevent modal close during conversion

### Feature 5: Add to Playlist
**Purpose**: Optionally add converted video to playlist

**Requirements**:
- Checkbox: "Add to playlist after conversion" (checked by default)
- If checked: Insert converted video below source video in playlist
- Generate new playlist item with:
  - Filename: `{original-name}-converted.{ext}`
  - Extract metadata using MediaBunny Input
  - Generate thumbnail
  - Mark as new (visual indicator or animation)
- If unchecked: Never add to playlist, download button shown
- Show "Download" button after conversion completes
- User clicks button to download converted file

### Feature 6: Download Button
**Purpose**: Allow user to download converted video

**Requirements**:
- Show download button after conversion completes
- Button label: "Download {format}" (e.g., "Download MP4")
- Filename: `{original-name}-converted.{ext}`
- Trigger browser download with proper MIME type
- Sanitize filename (remove invalid characters)
- Button available until modal is closed
- Success message: "Video converted successfully! Click Download to save."

### Feature 7: Error Handling
**Purpose**: Handle conversion failures gracefully

**Requirements**:
- Catch MediaBunny conversion errors
- Common errors:
  - Codec not supported in browser
  - Insufficient memory
  - Source video corrupted
  - Unknown format
- Display user-friendly error messages
- Suggest alternatives (e.g., "WebM not supported, try MP4")
- Re-enable form for retry
- Log technical error to console

---

## Interaction Behavior

**User Flow 1: Basic Conversion**:
1. User clicks settings menu → "Convert Format..."
2. Modal opens showing format options
3. User selects "WebM"
4. User checks "Add to playlist"
5. User clicks "Convert"
6. Progress bar appears
7. Conversion completes (e.g., 30 seconds)
8. Success message: "Video converted! Click Download to save."
9. Download button appears
10. New playlist item appears below source
11. User clicks "Download" button
12. File downloads

**User Flow 2: Error Handling**:
1. User selects format (e.g., AVI)
2. Clicks "Convert"
3. Conversion fails (codec unsupported)
4. Error message: "AVI format not supported by your browser. Try MP4 instead."
5. User selects MP4
6. Retry succeeds

**User Flow 3: Download Only (No Playlist)**:
1. User unchecks "Add to playlist"
2. Selects format and converts
3. Conversion completes
4. Download button appears
5. User clicks "Download"
6. File downloads
7. No playlist item created
8. Modal closes

---

## Edge Cases

- Very large videos (>1GB): Warn about conversion time before starting
- Insufficient memory: Show error, suggest reducing quality
- Source video already in target format: Allow conversion anyway (re-encode) or show warning
- Conversion interrupted: Clean up resources, show error
- Cancel during conversion: Stop MediaBunny process, clean up
- Multiple conversions queued: Process sequentially, not parallel

---

## Styling Requirements

**Theme**: Dark Neobrutalism

**Modal**:
- Width: 500px (max-width: 90vw on mobile)
- Padding: 24px
- Bold border: 4px solid
- Heavy shadow for depth

**Radio Buttons**:
- Custom styled to match theme
- Large, clickable targets (40px height)
- Selected state: Primary color accent
- Label shows format + codec info clearly

**Progress Bar**:
- Height: 8px
- Background: Dark grey
- Fill: Primary color gradient
- Animated pulse during conversion
- Percentage text above bar

**Buttons**:
- Cancel: Secondary style
- Convert: Primary style (bold, large)
- Disabled state during conversion

---

## Accessibility

- Modal: `role="dialog"`, `aria-labelledby="modal-title"`
- Radio group: `role="radiogroup"`, `aria-label="Select output format"`
- Progress bar: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Screen reader announces conversion start/complete
- Focus trap in modal
- ESC key closes modal (only when not converting)

---

## What NOT to Do

- ❌ Don't start conversion without validating format selection
- ❌ Don't allow modal close during active conversion
- ❌ Don't forget to clean up MediaBunny resources after conversion
- ❌ Don't block UI thread during conversion (use async)
- ❌ Don't lose source video if conversion fails

---

## MediaBunny Integration

This phase requires MediaBunny Conversion API.

**Consult `mediabunny-llms-full.md`** for:
- Creating Conversion instances
- Configuring output formats and codecs
- Setting quality parameters
- Progress monitoring
- Error handling
- Resource cleanup

**Example workflow**:
```
1. Create Conversion with target format
2. Add Input from source video blob
3. Configure codec settings
4. Start conversion
5. Monitor progress
6. Collect output blob
7. Clean up resources
```

---

## Testing Checklist

- [ ] Modal opens from settings menu
- [ ] All format options displayed correctly
- [ ] MP4 conversion works
- [ ] WebM conversion works
- [ ] AVI conversion works (if supported)
- [ ] MOV conversion works (if supported)
- [ ] Progress indicator shows during conversion
- [ ] Converted video added to playlist (when checked)
- [ ] Download triggered automatically
- [ ] Filename generated correctly
- [ ] Error handling works for unsupported formats
- [ ] Cancel button works (if implemented)
- [ ] Modal closes after successful conversion
- [ ] Converted video plays correctly

---

## Done When

✅ Conversion modal implemented  
✅ Format selection working  
✅ MediaBunny conversion functional  
✅ Progress tracking implemented  
✅ Add to playlist option working  
✅ Download triggered correctly  
✅ Error handling complete  
✅ All tests pass  
✅ Ready for next phase (Phase 34: Download Video/Audio)

---

**Phase**: 33 | **Component**: Player  
**Estimated Time**: 50-70 minutes

---

## Code Reusability Note

**IMPORTANT**: This phase shares common patterns with other processing phases (33-39):
- MediaBunny conversion/processing
- Download button functionality
- Add to playlist checkbox

**Following COC**: Extract these into reusable utility modules (MediaProcessor, DownloadManager, PlaylistManager).
DO NOT duplicate code across phases. See Phase 39 for detailed reusability guidelines.

