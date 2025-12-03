# Phase 38: Merge Videos

## Goal
Enable users to select and merge multiple videos from the entire playlist, combining them into a single video file in a custom order.

**MediaBunny Note**: This phase uses MediaBunny's Conversion API to concatenate multiple video inputs. Consult `mediabunny-llms-full.md` for adding multiple Inputs to a single Conversion and handling different formats/resolutions.

---

## What to Build

Video merging system with:
- "Merge Videos..." option in settings menu
- Video selection modal showing entire playlist
- Multi-select interface with checkboxes/selectable items
- Drag-and-drop reordering of selected videos
- Merge preview showing order, total duration, and warnings
- Handling of format/resolution differences
- Option to add merged video to playlist (never adds if unchecked)
- Option to remove source videos after merge
- Download button shown after merge completes

---

## Features to Implement

### Feature 1: Merge Menu Option
**Purpose**: Add merge option to settings menu

**Requirements**:
- Menu item: "🔗 Merge Videos..."
- Always enabled (opens video selection modal)
- Opens selection modal when clicked
- No tooltip needed (not conditionally disabled)

### Feature 2: Video Selection Modal
**Purpose**: Allow users to select multiple videos from playlist to merge

**Requirements**:
- Modal opens when "Merge Videos..." clicked
- Modal title: "Select Videos to Merge"
- **Video List Section**:
  - Display all videos from playlist
  - Each video shows: Thumbnail, filename, duration, resolution
  - Checkbox next to each video (or clickable div with selected state)
  - Multi-select: User can select multiple videos
  - Minimum selection: 2 videos required to proceed
  - Visual indication of selected videos (highlight, checkmark)
  - Selection counter: "X videos selected"
- **Selected Videos Section**:
  - Shows selected videos in merge order
  - Drag-and-drop to reorder selected videos
  - Visual numbering (1, 2, 3...)
  - Remove button (X) to deselect individual videos
  - Clear all button to deselect everything
- **Merge Preview**:
  - Total combined duration
  - Show output resolution
  - Warnings if applicable:
    - Different resolutions: "Videos will be scaled to match"
    - Different formats: "Videos will be re-encoded to MP4"
    - Different aspect ratios: "Aspect ratios will be normalized"
- **Options**:
  - Checkbox: "Add to playlist after merge" (checked by default)
  - Checkbox: "Remove source videos after merge" (unchecked by default)
- **Action Buttons**:
  - Cancel button
  - Merge button (disabled if < 2 videos selected)
- **Validation**:
  - Disable Merge button if fewer than 2 videos selected
  - Show message: "Select at least 2 videos to merge"

### Feature 3: MediaBunny Video Concatenation
**Purpose**: Merge selected videos using MediaBunny

**Requirements**:
- Create MediaBunny Conversion instance
- Add all selected videos as Inputs in user-defined order
- Process each video in the order shown in "Selected Videos" section
- Handle resolution differences:
  - If resolutions match: Concatenate directly
  - If different: Scale to common resolution (larger or smaller, user choice)
- Handle format differences:
  - Convert all to common format (MP4 recommended)
- Concatenate videos in order (1st, 2nd, 3rd, etc.)
- Execute conversion
- Collect merged video blob

### Feature 4: Resolution Handling
**Purpose**: Handle videos with different resolutions

**Requirements**:
- Detect if videos have different resolutions
- If different, show options in modal:
  - ○ Match first video (scale second to first's resolution)
  - ○ Match second video (scale first to second's resolution)
  - ○ Use largest resolution (upscale if needed)
  - ○ Use smallest resolution (downscale if needed)
- Default: Match first video's resolution
- Apply scaling using MediaBunny VideoTransform
- Warn about quality implications

### Feature 5: Add to Playlist Option
**Purpose**: Optionally add merged video to playlist

**Requirements**:
- Checkbox: "Add to playlist after merge" (checked by default)
- If checked:
  - Insert merged video at position of first selected video
  - Filename: `merged-{timestamp}.mp4` or `{first-name}+{second-name}+....mp4`
  - Extract metadata from merged video
  - Generate thumbnail
  - Mark as new
- If unchecked: 
  - Never add to playlist
  - Download button shown
- Show "Download" button after merge completes
- User clicks button to download merged video

### Feature 6: Remove Source Option
**Purpose**: Clean up source videos after merge

**Requirements**:
- Checkbox: "Remove source videos after merge" (unchecked by default)
- If checked:
  - Remove both source videos from playlist after merge completes
  - Only remove after successful merge
  - Merged video takes position of first source
- If unchecked:
  - Keep both source videos in playlist
  - Merged video appears at top or after sources

### Feature 7: Progress Tracking
**Purpose**: Show merge progress

**Requirements**:
- Disable form during merge
- Progress bar with percentage
- Text: "Merging videos... (1/2 processed)"
- Show which video is currently being processed
- Estimated time remaining (optional)
- Merging can be slow for large videos
- Prevent modal close during operation

### Feature 8: Error Handling
**Purpose**: Handle merge failures gracefully

**Requirements**:
- Detect incompatible videos (different codecs, corrupt files)
- Show user-friendly error messages:
  - "Videos could not be merged. Try converting to same format first."
  - "Merge failed due to codec incompatibility."
- Suggest converting both to MP4 first
- Don't remove source videos if merge fails
- Allow retry
- Log technical errors

---

## Interaction Behavior

**User Flow 1: Basic Multi-Video Merge**:
1. User clicks settings on any video → "Merge Videos..."
2. Modal opens showing all playlist videos
3. User selects 3 videos by clicking checkboxes
4. Selection counter shows: "3 videos selected"
5. Selected videos appear in "Selected Videos" section
6. All videos have same resolution (1080p), no warnings
7. Total duration shown: "12:34"
8. User checks "Remove source videos"
9. User clicks "Merge"
10. Progress bar: "Merging videos... 45%"
11. Merge completes
12. Merged video added to playlist
13. Source videos removed
14. Download button appears
15. Success toast: "3 videos merged successfully!"
16. User clicks "Download" to save file

**User Flow 2: Reordering Videos**:
1. User opens merge modal
2. Selects videos: video3.mp4, video1.mp4, video5.mp4
3. Videos appear in selected section in order: 1️⃣ video3, 2️⃣ video1, 3️⃣ video5
4. User drags video1 to top position
5. Order updates: 1️⃣ video1, 2️⃣ video3, 3️⃣ video5
6. User clicks "Merge"
7. Videos merged in new order

**User Flow 3: Different Resolutions**:
1. User selects 1080p video + 720p video + 4K video
2. Modal shows warning: "Videos have different resolutions"
3. Options shown:
   - ○ Match first video (1080p) - Selected
   - ○ Match largest (4K)
   - ○ Match smallest (720p)
4. User selects "Match largest (4K)"
5. Merge proceeds
6. All videos upscaled/maintained to 4K during merge

**User Flow 4: Download Only (No Playlist)**:
1. User selects 2 videos to merge
2. User unchecks "Add to playlist after merge"
3. User clicks "Merge"
4. Merge processes successfully
5. Download button appears
6. Merged video NEVER appears in playlist
7. User clicks "Download" button
8. File downloads
9. Success message shows

**User Flow 5: Insufficient Selection**:
1. User opens merge modal
2. User selects only 1 video
3. Merge button is disabled
4. Message shows: "Select at least 2 videos to merge"
5. User selects second video
6. Merge button becomes enabled

---

## Edge Cases

- Empty playlist: Disable merge option
- Only one video in playlist: Show message in modal "Need at least 2 videos"
- User selects only 1 video: Disable Merge button
- User selects all videos in large playlist (50+ videos): Warn about processing time
- Videos with different frame rates: Handle or warn
- Very long total duration (>2 hours): Warn about processing time
- Videos with different audio tracks: Merge audio as well
- Some videos have audio, others don't: Handle gracefully
- Videos with subtitles: Include or skip (document behavior)
- Merge already-merged video: Allow
- User reorders while merge is processing: Prevent (disable UI)
- User closes modal during selection: Discard selections
- All selected videos have identical resolution: No warning needed

---

## Styling Requirements

**Theme**: Dark Neobrutalism

**Confirmation Modal**:
- Width: 600px (max-width: 90vw)
- Padding: 24px
- Bold border and shadow

**Merge Preview**:
- Visual layout showing: Video 1 + Video 2 = Result
- Use icons or thumbnails for each video
- Display key properties (duration, resolution)
- Warnings in alert boxes (yellow/orange)

**Resolution Options**:
- Radio buttons styled to theme
- Clear labels explaining each option
- Visual indication of quality impact (↑ upscale, ↓ downscale)

**Progress Indicator**:
- Progress bar: 8px height
- Text showing current step
- Estimated time if available

---

## Accessibility

- Modal: `role="dialog"`, `aria-labelledby="merge-title"`
- Resolution options: `role="radiogroup"`
- Checkboxes: Proper labels, `aria-checked`
- Progress: `role="progressbar"`, `aria-valuenow`
- Warnings: `role="alert"`
- Keyboard navigation functional

---

## What NOT to Do

- ❌ Don't remove source videos if merge fails
- ❌ Don't assume videos have same resolution/format
- ❌ Don't forget to handle audio tracks
- ❌ Don't allow merging with fewer than 2 videos selected
- ❌ Don't block UI during long merge operations
- ❌ Don't add to playlist if checkbox unchecked

---

## MediaBunny Integration

This phase requires MediaBunny Conversion with multiple Inputs.

**Consult `mediabunny-llms-full.md`** for:
- Adding multiple Input sources to single Conversion
- Video concatenation techniques
- Handling different resolutions with VideoTransform
- Format normalization
- Audio track handling during merge
- Progress monitoring for multi-input conversion
- Resource cleanup

**Example workflow**:
```
1. User selects multiple videos from playlist (minimum 2)
2. Get Inputs for all selected videos in order
3. Check resolutions, decide common resolution
4. Create Conversion
5. Add each selected Input to Conversion in user's chosen order
6. If needed, apply VideoTransform for scaling
7. Configure output format (MP4)
8. Execute conversion
9. Monitor progress
10. Collect merged video blob
11. Show download button
12. If "Add to playlist" checked: Add to playlist
13. If "Add to playlist" unchecked: Never add to playlist
14. User clicks "Download" to save file
15. If "Remove source" checked: Remove source videos
16. Clean up resources
```

---

## Testing Checklist

- [ ] "Merge with Next" appears in settings menu
- [ ] Disabled when last video in playlist
- [ ] Confirmation modal opens with details
- [ ] Shows correct video filenames and properties
- [ ] Warning displays for different resolutions
- [ ] Resolution options work correctly
- [ ] Merge executes successfully (same resolution)
- [ ] Merge works with different resolutions
- [ ] Progress indicator shows during merge
- [ ] Merged video added to playlist (when checked)
- [ ] Merged filename generated correctly
- [ ] Source videos removed (when checked)
- [ ] Download triggered
- [ ] Merged video plays correctly
- [ ] Audio tracks merged properly
- [ ] Error handling works

---

## Done When

✅ Merge menu option implemented  
✅ Confirmation modal functional  
✅ MediaBunny concatenation working  
✅ Resolution handling complete  
✅ Add to playlist option working  
✅ Remove source option functional  
✅ Progress tracking implemented  
✅ Error handling complete  
✅ All tests pass  
✅ Ready for next phase (Phase 39: Extract Audio)

---

**Phase**: 38 | **Component**: Player  
**Estimated Time**: 60-70 minutes

---

## Code Reusability Note

**IMPORTANT**: This phase shares common patterns with other processing phases (33-39):
- MediaBunny conversion/processing
- Download button functionality
- Add to playlist checkbox

**Following COC**: Extract these into reusable utility modules (MediaProcessor, DownloadManager, PlaylistManager).
DO NOT duplicate code across phases. See Phase 39 for detailed reusability guidelines.

