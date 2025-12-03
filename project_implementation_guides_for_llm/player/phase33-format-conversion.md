# Phase 33: Format Conversion

## Goal
Enable users to convert videos to different formats (MP4, WebM, AVI, MOV) using MediaBunny's powerful conversion capabilities.

**MediaBunny Note**: This phase extensively uses MediaBunny's Conversion class with different output codecs and container formats. Consult `mediabunny-llms-full.md` for Conversion, codec configuration, and format export.

---

## What to Build

Video format conversion and optimization system with:
- Modal dialog for operation mode and format selection
- Three operation modes: convert format, reduce file size, or both
- Support for common video formats (all shown, unsupported disabled with "Coming Soon" tooltip)
- Quality slider for file size reduction
- Progress tracking during conversion
- Option to add processed video to playlist
- Download button for processed file
- Error handling for unsupported codecs

---

## Features to Implement

### Feature 1: Conversion Modal
**Purpose**: Provide UI for selecting target format

**Requirements**:
- Modal opens when "Convert Format..." clicked in settings menu
- Modal title: "Convert & Optimize Video"
- Display source video filename and current format
- Radio button group for operation mode selection
- Quality slider (conditionally shown based on mode)
- Radio button group for format selection (conditionally shown/enabled)
- Checkbox: "Add to playlist after conversion"
- Cancel and Convert buttons
- Apply theme modal styling (dark neobrutalism)

### Feature 2: Format Options
**Purpose**: Show all common video formats for conversion

**Requirements**:
- Format options presented as radio buttons:
  - ○ MP4 (H.264/AAC) - Most compatible ✅ **Supported**
  - ○ WebM (VP9/Opus) - Web optimized ✅ **Supported**
  - ○ AVI (MPEG-4) - Legacy support ⚠️ **Disabled** (Coming Soon)
  - ○ MOV (H.264/AAC) - Apple ecosystem ✅ **Supported**
  - ○ MKV (Matroska) - High quality ⚠️ **Disabled** (Coming Soon)
  - ○ FLV (Flash Video) - Legacy streaming ⚠️ **Disabled** (Coming Soon)
  - ○ WMV (Windows Media) - Microsoft ⚠️ **Disabled** (Coming Soon)
  - ○ MPEG (MPEG-1/2) - Classic format ⚠️ **Disabled** (Coming Soon)
- Each option shows codec information and compatibility status
- Disabled formats show tooltip on hover: "Coming Soon"
- Disabled formats are not clickable (greyed out)
- Indicate recommended format (MP4 marked as default)
- One supported format selected by default (MP4)

### Feature 2.5: Operation Mode Selection
**Purpose**: Allow users to choose between conversion, quality reduction, or both

**Requirements**:
- Radio button group for operation mode:
  - ○ **Convert format only** - Change container/codec to selected format
  - ○ **Reduce file size only** - Compress video by reducing quality/bitrate (keeps current format)
  - ○ **Convert + Reduce size** - Change format AND reduce quality in one operation
- Default mode: "Convert format only"
- When "Reduce file size only" or "Convert + Reduce size" selected:
  - Show quality slider or dropdown below mode selection
  - Quality options:
    - High Quality (80% - minimal size reduction)
    - Medium Quality (60% - balanced)
    - Low Quality (40% - maximum compression)
  - Show estimated size reduction percentage (e.g., "~50% smaller")
- Format selection:
  - Enabled for "Convert format only" and "Convert + Reduce size" modes
  - Disabled/hidden for "Reduce file size only" mode
- Visual grouping: Mode selection at top, then quality settings (if applicable), then format selection (if applicable)

### Feature 3: MediaBunny Conversion
**Purpose**: Execute video processing based on selected operation mode

**Requirements**:
- Create MediaBunny Conversion instance
- Add Input from source video
- **Configure based on operation mode**:

  **Mode 1: Convert format only**
  - Configure output format based on selection (supported formats only):
    - MP4: Container format mp4, video codec h264, audio codec aac
    - WebM: Container format webm, video codec vp9, audio codec opus
    - MOV: Container format mov, video codec h264
  - Maintain source quality settings (no quality reduction)
  
  **Mode 2: Reduce file size only**
  - Keep source container format and codecs
  - Apply quality reduction based on slider selection:
    - High Quality (80%): Set bitrate to 80% of source
    - Medium Quality (60%): Set bitrate to 60% of source
    - Low Quality (40%): Set bitrate to 40% of source
  - Adjust video encoding parameters (CRF/bitrate)
  - Maintain audio codec but reduce audio bitrate proportionally
  
  **Mode 3: Convert + Reduce size**
  - Apply format conversion to selected format (MP4/WebM/MOV)
  - Apply quality reduction as per quality slider
  - Combine both transformations in single conversion pass

- Execute conversion and collect output blob
- Handle conversion errors gracefully
- Clean up resources after completion

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

**User Flow 1: Convert Format Only**:
1. User clicks settings menu → "Convert Format..."
2. Modal opens showing operation modes
3. "Convert format only" is selected by default
4. User selects "WebM" from format options
5. User checks "Add to playlist"
6. User clicks "Convert"
7. Progress bar appears
8. Conversion completes (e.g., 30 seconds)
9. Success message: "Video converted! Click Download to save."
10. Download button appears
11. New playlist item appears below source
12. User clicks "Download" button
13. File downloads as WebM

**User Flow 2: Reduce File Size Only**:
1. User clicks settings menu → "Convert Format..."
2. Modal opens
3. User selects "Reduce file size only" operation mode
4. Format options become disabled/hidden
5. Quality slider appears
6. User selects "Medium Quality (60%)"
7. Estimated size reduction shows: "~40% smaller"
8. User clicks "Convert"
9. Progress bar appears
10. Compression completes
11. Success message shows
12. Download button appears
13. File downloads in original format but smaller size

**User Flow 3: Convert + Reduce Size (Combined)**:
1. User selects "Convert + Reduce size" operation mode
2. Quality slider appears
3. User sets quality to "Low Quality (40%)"
4. User selects "MP4" format
5. Estimated size: "~60% smaller"
6. User clicks "Convert"
7. Both conversion and compression applied
8. File downloads as smaller MP4

**User Flow 4: Error Handling (Unsupported Format)**:
1. User tries to select disabled format (e.g., AVI)
2. Radio button is disabled (not clickable)
3. Hover shows tooltip: "Coming Soon"
4. User must select supported format (MP4/WebM/MOV)

**User Flow 5: Download Only (No Playlist)**:
1. User unchecks "Add to playlist"
2. Selects operation mode and settings
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
- **Disabled state**:
  - Greyed out appearance (opacity: 0.5)
  - Not clickable (pointer-events: none on radio input)
  - Cursor changes to not-allowed on hover
  - Tooltip appears on hover: "Coming Soon"
  - Format name still visible but clearly inactive

**Quality Slider** (when shown):
- Full-width horizontal slider
- Min: 40% (Low), Max: 80% (High), Default: 60% (Medium)
- Three labeled stops: Low (40%), Medium (60%), High (80%)
- Current value displayed: "Medium Quality (60%)"
- Estimated size reduction text below: "~40% smaller"
- Theme-styled track and thumb
- Smooth animation on value change

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

**Modal & UI**:
- [ ] Modal opens from settings menu
- [ ] Modal title: "Convert & Optimize Video"
- [ ] All format options displayed (supported and disabled)
- [ ] Disabled formats show "Coming Soon" tooltip on hover
- [ ] Disabled formats are not clickable

**Operation Modes**:
- [ ] "Convert format only" mode works
- [ ] "Reduce file size only" mode works
- [ ] "Convert + Reduce size" mode works
- [ ] Format selection disabled when "Reduce file size only" selected
- [ ] Quality slider appears for size reduction modes
- [ ] Quality slider hidden for "Convert format only"

**Format Conversion (Supported)**:
- [ ] MP4 conversion works
- [ ] WebM conversion works
- [ ] MOV conversion works

**Quality Reduction**:
- [ ] High quality (80%) compression works
- [ ] Medium quality (60%) compression works
- [ ] Low quality (40%) compression works
- [ ] Estimated size reduction displayed
- [ ] Actual output size matches estimate (±10%)
- [ ] Quality reduction maintains playback compatibility

**Combined Operations**:
- [ ] Convert to MP4 + reduce size works
- [ ] Convert to WebM + reduce size works
- [ ] Combined operation produces smaller file in new format

**General**:
- [ ] Progress indicator shows during conversion
- [ ] Converted video added to playlist (when checked)
- [ ] Download button appears after completion
- [ ] Filename generated correctly
- [ ] Error handling works
- [ ] Modal closes after successful conversion
- [ ] Converted/compressed video plays correctly

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

