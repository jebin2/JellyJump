# Phase 35: Trim Video

## Goal
Enable users to trim videos by specifying start and end times, creating a new video segment that can be added to the playlist.

**MediaBunny Note**: This phase uses MediaBunny's Conversion API with time-based trimming via `setStartOffset()` and `setDuration()`. Consult `mediabunny-llms-full.md` for temporal clipping and conversion configuration.

---

## What to Build

Video trimming system with:
- Modal dialog for time selection
- Visual timeline slider for trim range
- Preview functionality
- Option to add trimmed video to playlist
- Time validation

---

## Features to Implement

### Feature 1: Trim Modal
**Purpose**: Provide UI for selecting video segment to trim

**Requirements**:
- Modal opens when "Trim Video..." clicked in settings menu
- Modal title: "Trim Video"
- Display source video filename and total duration
- Visual timeline representation
- Start time input (HH:MM:SS format)
- End time input (HH:MM:SS format)
- Duration display (calculated from start/end)
- Preview button (optional but recommended)
- Checkbox: "Add to playlist after trimming"
- Cancel and Trim buttons
- Apply theme modal styling

### Feature 2: Time Input Fields
**Purpose**: Allow precise time entry

**Requirements**:
- Two input fields: Start Time, End Time
- Format: HH:MM:SS or MM:SS (auto-format)
- Placeholder: "00:00:00"
- Validation on blur:
  - Start time < End time
  - Both times within video duration
  - Valid time format
- Show error messages for invalid times
- Auto-correct invalid values (e.g., 90:00 → 01:30:00)
- Allow keyboard input and paste

### Feature 3: Visual Timeline Slider
**Purpose**: Provide intuitive visual selection

**Requirements**:
- Display video duration as horizontal timeline
- Two draggable handles: Start marker, End marker
- Shaded area between markers = trimmed segment
- Click timeline to jump markers
- Snap to seconds (or frames for precision)
- Update time inputs when dragging markers
- Markers update when typing in time inputs
- Show current selection duration above timeline
- Minimum segment duration: 1 second

### Feature 4: Preview Functionality
**Purpose**: Let users verify trim selection before processing

**Requirements**:
- "Preview" button in modal
- Clicking preview:
  - Seek current video player to start time
  - Play segment from start to end
  - Loop segment for review
  - Stop at end time
- Visual indicator: "Previewing segment..."
- Stop preview button
- Preview doesn't close modal

### Feature 5: MediaBunny Trimming
**Purpose**: Execute video trimming using MediaBunny

**Requirements**:
- Create MediaBunny Conversion instance
- Add Input from source video
- Set start offset: `conversion.setStartOffset(startSeconds)`
- Set duration: `conversion.setDuration(durationSeconds)`
- Maintain original format and quality
- Execute conversion
- Collect output blob (trimmed video)
- Clean up resources after completion

### Feature 6: Add to Playlist Option
**Purpose**: Optionally add trimmed video to playlist

**Requirements**:
- Checkbox: "Add to playlist after trimming" (checked by default)
- If checked:
  - Create new playlist item below source video
  - Filename: `{original-name}-trimmed-{start}-{end}.{ext}`
  - Extract metadata using MediaBunny
  - Generate thumbnail for trimmed segment
  - Mark as new with animation
- If unchecked: Never add to playlist, download button shown
- Show "Download" button after trimming completes
- User clicks button to download trimmed file

### Feature 7: Progress Tracking
**Purpose**: Show trimming progress

**Requirements**:
- Disable form during trimming
- Progress bar with percentage
- Text: "Trimming video..."
- Estimated time remaining (optional)
- Prevent modal close during operation
- Cancel button (if MediaBunny supports)

### Feature 8: Time Validation
**Purpose**: Ensure valid trim parameters

**Requirements**:
- Start time must be >= 00:00:00
- End time must be <= video duration
- End time must be > start time
- Minimum duration: 1 second
- Show clear error messages:
  - "Start time must be before end time"
  - "End time exceeds video duration"
  - "Segment must be at least 1 second"
- Disable Trim button if validation fails
- Visual error indicators (red border, icon)

---

## Interaction Behavior

**User Flow 1: Timeline Drag**:
1. User clicks "Trim Video..." from settings
2. Modal opens showing timeline
3. User drags start marker to 00:30
4. Start time input updates to "00:00:30"
5. User drags end marker to 01:45
6. End time input updates to "00:01:45"
7. Duration shows: "1 minute 15 seconds"
8. User clicks "Trim"
9. Progress bar appears
10. Trimmed video downloads and added to playlist

**User Flow 2: Manual Time Entry (Download Only)**:
1. Modal opens
2. User types start time: "01:23"
3. Timeline start marker moves to 1:23
4. User types end time: "03:45"
5. Timeline end marker moves to 3:45
6. Duration calculated: "2 minutes 22 seconds"
7. User unchecks "Add to playlist"
8. User clicks "Trim"
9. Trimming completes
10. Download button appears
11. User clicks "Download"
12. Trimmed video downloads

**User Flow 3: Preview Before Trim**:
1. User sets trim range (2:00 - 3:30)
2. User clicks "Preview"
3. Main player seeks to 2:00
4. Plays from 2:00 to 3:30, then loops
5. User verifies selection
6. User clicks "Stop Preview"
7. User clicks "Trim" to proceed

**User Flow 4: Validation Error**:
1. User types start time: "05:00"
2. User types end time: "03:00"
3. Error message: "Start time must be before end time"
4. Trim button disabled
5. User corrects end time: "06:00"
6. Error clears, Trim button enabled

---

## Edge Cases

- Start time = End time: Show error, require minimum 1 second
- Very short segments (<1 sec): Set minimum duration
- Trimming entire video (00:00 to end): Allow, but warn it's unnecessary
- Very long videos (>1 hour): Show estimated processing time
- Invalid time format: Auto-correct or show format hint
- Trimming already-trimmed video: Allow (re-trim)
- Precision trimming (frame-accurate): Optional enhancement

---

## Styling Requirements

**Theme**: Dark Neobrutalism

**Modal**:
- Width: 600px (max-width: 90vw on mobile)
- Padding: 24px
- Bold border and shadow

**Timeline Slider**:
- Height: 60px
- Background: Dark grey gradient
- Selected range: Primary color overlay (semi-transparent)
- Markers: Round handles, 16px diameter, bold border
- Draggable markers: Scale up on hover (1.2x)
- Timeline ticks: Show minute markers

**Time Inputs**:
- Monospace font
- Width: 120px
- Bold border
- Error state: Red border + shake animation

**Progress Bar**:
- Height: 8px
- Primary color fill
- Animated pulse during trimming

---

## Accessibility

- Modal: `role="dialog"`, `aria-labelledby="trim-title"`
- Timeline: `role="slider"` for each marker
- Start marker: `aria-label="Start time"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`
- End marker: `aria-label="End time"`
- Time inputs: Clear labels, `aria-invalid` for errors
- Error messages: `role="alert"`
- Keyboard navigation: Arrow keys move markers (5 sec increments)

---

## What NOT to Do

- ❌ Don't allow start time >= end time
- ❌ Don't forget to validate time ranges
- ❌ Don't re-encode unnecessarily (maintain quality)
- ❌ Don't lose original video if trimming fails
- ❌ Don't block UI during trimming operation

---

## MediaBunny Integration

This phase requires MediaBunny Conversion API for temporal clipping.

**Consult `mediabunny-llms-full.md`** for:
- Using `setStartOffset(seconds)` to set trim start point
- Using `setDuration(seconds)` to set trim duration
- Conversion configuration and codec settings
- Progress monitoring
- Error handling
- Resource cleanup

**Example workflow**:
```
1. Calculate trim parameters (startSeconds, durationSeconds)
2. Create Conversion with source video Input
3. Call conversion.setStartOffset(startSeconds)
4. Call conversion.setDuration(durationSeconds)
5. Configure output format (same as source)
6. Execute conversion
7. Collect trimmed video blob
8. Download and/or add to playlist
9. Clean up resources
```

---

## Testing Checklist

- [ ] Modal opens from settings menu
- [ ] Timeline slider displays correctly
- [ ] Dragging markers updates time inputs
- [ ] Typing in inputs moves markers
- [ ] Duration calculates correctly
- [ ] Preview functionality works
- [ ] Validation catches invalid time ranges
- [ ] Error messages display appropriately
- [ ] Trim button disabled when invalid
- [ ] Trimming executes successfully
- [ ] Progress indicator shows during operation
- [ ] Trimmed video downloads with correct filename
- [ ] Add to playlist option works
- [ ] Trimmed video plays correctly
- [ ] Works with various video formats

---

## Done When

✅ Trim modal implemented  
✅ Time input fields functional  
✅ Visual timeline slider working  
✅ Preview functionality operational  
✅ MediaBunny trimming successful  
✅ Add to playlist option working  
✅ Progress tracking implemented  
✅ Time validation complete  
✅ All tests pass  
✅ Ready for next phase (Phase 36: Resize Video)

---

**Phase**: 35 | **Component**: Player  
**Estimated Time**: 60-80 minutes

---

## Code Reusability Note

**IMPORTANT**: This phase shares common patterns with other processing phases (33-39):
- MediaBunny conversion/processing
- Download button functionality
- Add to playlist checkbox

**Following COC**: Extract these into reusable utility modules (MediaProcessor, DownloadManager, PlaylistManager).
DO NOT duplicate code across phases. See Phase 39 for detailed reusability guidelines.

