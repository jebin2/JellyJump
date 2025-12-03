# Phase 39: Create GIF from Video

## Goal
Enable users to create animated GIFs from video segments by selecting start and end times, with options to download the GIF and optionally add it to the playlist.

**MediaBunny Note**: This phase uses MediaBunny's Conversion API for GIF generation from video segments. Consult `mediabunny-llms-full.md` for GIF output format, frame rate control, and time-based segment extraction.

---

## What to Build

GIF creation system with:
- "Create GIF..." option in settings menu
- Modal dialog for time selection
- Start/End time inputs (similar to trim)
- GIF settings (frame rate, quality, size)
- Process button to generate GIF
- Download button after creation
- Add to playlist checkbox

---

## Features to Implement

### Feature 1: GIF Creation Modal
**Purpose**: Provide UI for selecting video segment to convert to GIF

**Requirements**:
- Menu item in settings: "🎞️ Create GIF..."
- Opens modal when clicked
- Modal title: "Create GIF"
- Display source video info:
  - Filename
  - Total duration
  - Current resolution
- Start time input (HH:MM:SS format)
- End time input (HH:MM:SS format)
- Duration display (calculated from start/end)
- GIF settings section
- Checkbox: "Add to playlist after creation"
- Cancel and Create GIF buttons
- Apply theme modal styling

### Feature 2: Time Selection
**Purpose**: Allow users to select GIF segment

**Requirements**:
- Two time input fields: Start Time, End Time
- Format: HH:MM:SS or MM:SS (auto-format)
- Placeholder: "00:00:00"
- Validation:
  - Start time < End time
  - Both times within video duration
  - Valid time format
  - Minimum segment: 0.5 seconds
  - Maximum segment: 60 seconds (GIF limit)
- Show error messages for invalid times
- Auto-correct invalid values
- Real-time duration calculation
- Display: "GIF duration: X.X seconds"

### Feature 3: GIF Settings
**Purpose**: Configure GIF quality and appearance

**Requirements**:
- **Frame Rate** dropdown:
  - 10 FPS (Smooth, larger file)
  - 15 FPS (Recommended)
  - 20 FPS (Very smooth, large file)
  - 5 FPS (Choppy, smaller file)
  - Default: 15 FPS
- **Size** dropdown:
  - Original size
  - 720p (1280x720)
  - 480p (854x480)
  - 360p (640x360)
  - Custom (width input)
  - Default: 480p (good balance)
- **Quality** slider:
  - Low (smaller file, lower quality)
  - Medium (balanced) - Default
  - High (larger file, better quality)
- Show estimated file size (if possible)

### Feature 4: MediaBunny GIF Generation
**Purpose**: Convert video segment to animated GIF

**Requirements**:
- Create MediaBunny Conversion instance
- Add Input from source video
- Set start offset using `setStartOffset(startSeconds)`
- Set duration using `setDuration(durationSeconds)`
- Configure GIF output:
  - Set output format to GIF
  - Set frame rate (from user selection)
  - Set dimensions (resize if needed)
  - Apply quality settings
- Execute conversion
- Collect GIF blob

### Feature 5: Progress Indication
**Purpose**: Show GIF creation progress

**Requirements**:
- Disable form during creation
- Progress bar with percentage
- Text: "Creating GIF... XX%"
- Estimated time remaining (optional)
- GIF creation can be slow for long segments
- Prevent modal close during operation
- "Creating GIF..." text with animated dots



### Feature 6: GIF Preview
**Purpose**: Show preview of created GIF in modal

**Requirements**:
- After GIF creation completes, show preview in modal
- Display animated GIF (auto-playing)
- Preview size: Max 400px width, maintain aspect ratio
- Show below progress bar, above download button
- Visual frame: Bordered container for preview
- GIF loops automatically
- File size display: "GIF size: 2.5 MB"
- Keep preview visible until modal closes
- Preview doesn't interfere with download/playlist controls

### Feature 6: Download Button
**Purpose**: Allow user to download created GIF

**Requirements**:
- Show download button after GIF creation completes
- Button label: "Download GIF"
- Filename: `{original-name}-{start}-{end}.gif`
  - Example: `vacation-00-05-00-10.gif` (5s to 10s)
  - Or simpler: `vacation-gif.gif`
- Button available until modal is closed
- Success message: "GIF created! Click Download to save."
- User clicks button to download

### Feature 7: Add to Playlist Option
**Purpose**: Optionally add GIF to playlist

**Requirements**:
- Checkbox: "Add to playlist after creation" (unchecked by default)
- If checked:
  - Create new playlist item below source video
  - Filename: `{original-name}-gif.gif`
  - Extract metadata (duration, size)
  - Generate thumbnail (first frame of GIF)
  - Mark as GIF item (special badge/icon)
  - Display as animated preview on hover (optional)
- If unchecked: Never add to playlist
- Show download button regardless of checkbox state
- User clicks download when ready

### Feature 8: Time Validation
**Purpose**: Ensure valid GIF parameters

**Requirements**:
- Validate time inputs:
  - Start time >= 00:00:00
  - End time <= video duration
  - End time > start time
  - Duration between 0.5s and 60s
- Show specific error messages:
  - "Start time must be before end time"
  - "GIF duration must be between 0.5 and 60 seconds"
  - "End time exceeds video duration"
- Disable "Create GIF" button if validation fails
- Visual error indicators (red border, icon)
- Clear errors when corrected

### Feature 9: Preview Option
**Purpose**: Let user preview segment before creating GIF

**Requirements**:
- "Preview" button (optional but recommended)
- Clicking preview:
  - Seek main player to start time
  - Play segment from start to end
  - Loop segment
  - Stop at end time
- Visual indicator: "Previewing segment..."
- Stop preview button
- Preview doesn't close modal

---

## Interaction Behavior

**User Flow 1: Create Simple GIF**:
1. User clicks settings → "Create GIF..."
2. Modal opens
3. User types start time: "00:05"
4. User types end time: "00:10"
5. Duration shows: "5.0 seconds"
6. Settings show: 15 FPS, 480p, Medium quality
7. User clicks "Create GIF"
8. Progress bar: "Creating GIF... 45%"
9. Creation completes (~15 seconds)
10. GIF preview appears in modal (animated, looping)
11. File size shown: "GIF size: 1.8 MB"
12. Success message: "GIF created! Click Download to save."
13. Download button appears
14. User clicks "Download"
15. File downloads: `vacation-gif.gif`

**User Flow 2: Create and Add to Playlist**:
1. User selects time range (2s - 7s)
2. User checks "Add to playlist"
3. User sets quality to High, 720p
4. User clicks "Create GIF"
5. Progress bar shows
6. GIF created
7. New playlist item appears with GIF icon
8. Download button shown
9. User can still download if wanted

**User Flow 3: Preview Before Creating**:
1. User sets time range
2. User clicks "Preview"
3. Main player seeks to 00:05
4. Plays 5 second segment, loops
5. User verifies it looks good
6. User clicks "Create GIF"
7. GIF creation proceeds

**User Flow 4: Validation Error**:
1. User types start: "01:00"
2. User types end: "01:50"
3. Error: "GIF duration must be between 0.5 and 60 seconds" (50s is too long)
4. Create button disabled
5. User adjusts end to "01:30"
6. Error clears, button enabled

**User Flow 5: Custom Settings**:
1. User selects unusual segment (0.5s)
2. User sets frame rate to 20 FPS for smoothness
3. User sets size to Original (1080p)
4. Warning: "Large GIF file size expected"
5. User proceeds anyway
6. High-quality GIF created

---

## Edge Cases

- Very short segments (< 0.5s): Require minimum duration
- Very long segments (> 60s): Show error, GIFs should be short
- High resolution + high FPS: Warn about large file size
- Entire video as GIF: Allow but warn about size
- Invalid time format: Auto-correct or show format hint
- Video without video track (audio-only): Disable GIF option
- Already created GIF from same segment: Allow duplicate

---

## Styling Requirements

**Theme**: Dark Neobrutalism

**Modal**:
- Width: 600px (max-width: 90vw)
- Padding: 24px
- Bold border and shadow

**Time Inputs**:
- Monospace font for time values
- Width: 120px each
- Bold border
- Error state: Red border + shake animation
- Side-by-side with "to" label between

**GIF Settings**:
- Clear section header
- Dropdowns and slider styled to theme
- Labels explanatory (e.g., "15 FPS (Recommended)")
- Estimated file size in secondary color

**Progress Indicator**:
- Progress bar: 8px height
- Primary color fill
- Percentage text above
- Animated pulse

**Download Button**:
- Primary style, prominent
- Full width or centered
- Icon: 📥 or GIF icon

---

## Accessibility

- Modal: `role="dialog"`, `aria-labelledby="gif-title"`
- Time inputs: Clear labels, `aria-invalid` for errors
- Start input: `aria-label="GIF start time"`
- End input: `aria-label="GIF end time"`
- Settings: Proper labels for all controls
- Progress: `role="progressbar"`, `aria-valuenow`
- Error messages: `role="alert"`
- Download button: `aria-label="Download created GIF"`

---

## What NOT to Do

- ❌ Don't allow GIFs longer than 60 seconds (file size issues)
- ❌ Don't auto-download (use download button)
- ❌ Don't add to playlist if checkbox unchecked
- ❌ Don't lose source video if GIF creation fails
- ❌ Don't create GIF without user clicking "Create GIF" button
- ❌ Don't forget to clean up MediaBunny resources

---

## MediaBunny Integration

This phase requires MediaBunny Conversion API for GIF generation.

**Consult `mediabunny-llms-full.md`** for:
- GIF output format configuration
- Frame rate control for GIFs
- Time-based segment extraction (setStartOffset, setDuration)
- Resizing for smaller GIF files
- Quality/compression settings
- Progress monitoring
- Resource cleanup

**Example workflow**:
```
1. Get start and end times from user
2. Calculate duration (endTime - startTime)
3. Validate duration (0.5s - 60s)
4. Create Conversion with source video Input
5. Set start offset: conversion.setStartOffset(startSeconds)
6. Set duration: conversion.setDuration(durationSeconds)
7. Configure GIF output:
   - Set format to GIF
   - Set frame rate (user selection)
   - Set dimensions (resize if needed)
   - Set quality settings
8. Execute conversion
9. Monitor progress
10. Collect GIF blob
11. Show download button
12. If "Add to playlist" checked: Create playlist item
13. User downloads when ready
14. Clean up resources
```

---

## Testing Checklist

- [ ] "Create GIF..." menu item appears
- [ ] Modal opens correctly
- [ ] Time inputs work and validate
- [ ] Duration calculates correctly
- [ ] GIF settings (FPS, size, quality) functional
- [ ] Preview functionality works
- [ ] Validation catches invalid ranges
- [ ] Error messages display appropriately
- [ ] Create button disabled when invalid
- [ ] GIF creation executes successfully
- [ ] Progress indicator shows during creation
- [ ] Download button appears when ready
- [ ] Filename generated correctly
- [ ] GIF file downloads correctly
- [ ] Add to playlist checkbox works
- [ ] GIF playlist item has special styling
- [ ] Created GIF plays/loops correctly
- [ ] Works with different time ranges

---

## Done When

✅ GIF creation modal implemented  
✅ Time selection functional  
✅ GIF settings operational  
✅ MediaBunny GIF generation working  
✅ Progress indication implemented  
✅ Download button functional  
✅ Add to playlist option working  
✅ Time validation complete  
✅ Preview functionality operational  
✅ All tests pass  
✅ Ready for Player component completion

---

**Phase**: 39 | **Component**: Player  
**Estimated Time**: 60-75 minutes

