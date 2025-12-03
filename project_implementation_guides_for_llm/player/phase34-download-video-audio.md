# Phase 34: Download/Manage Video & Audio Tracks

## Goal
Provide a comprehensive track management interface where users can view all video and audio tracks, download them separately, and optionally add them to the playlist.

**MediaBunny Note**: This phase uses MediaBunny's track selection and extraction capabilities. Consult `mediabunny-llms-full.md` for Input track filtering, Conversion with specific tracks, and audio/video stream isolation.

---

## What to Build

Track management system with:
- "Download/Manage Tracks..." option in settings menu
- Modal dialog showing all video and audio tracks
- Track list with metadata (codec, bitrate, resolution)
- Download button for each track
- Add to playlist checkbox for each track
- Progress indicators for extraction
- Proper filename generation

---

## Features to Implement

### Feature 1: Track Management Modal
**Purpose**: Provide interface to view and manage all tracks in video file

**Requirements**:
- Menu item in settings: "🎬 Download/Manage Tracks..."
- Opens modal when clicked
- Modal title: "Video & Audio Tracks"
- Display source filename at top
- Two main sections: Video Tracks, Audio Tracks
- Cancel/Close button
- Apply theme modal styling

### Feature 2: Video Tracks Section
**Purpose**: Display all video tracks with individual controls

**Requirements**:
- Section header: "📹 Video Tracks" with count (e.g., "2 tracks")
- List each video track as separate div/card:
  - Track number (#1, #2, etc.)
  - Resolution (1920x1080)
  - Codec (H.264, VP9, etc.)
  - Bitrate (5.2 Mbps)
  - Duration
- Each track has:
  - **Download button**: "Download Video Track #1"
  - **Add to Playlist checkbox**: "Add to playlist as video-only"
  - Filename preview: `{name}-video-track1.mp4`
- If no video tracks: Show "No video tracks available"

### Feature 3: Audio Tracks Section
**Purpose**: Display all audio tracks with individual controls

**Requirements**:
- Section header: "🎵 Audio Tracks" with count (e.g., "3 tracks")
- List each audio track as separate div/card:
  - Track number (#1, #2, etc.)
  - Language (English, Spanish, etc.) if available
  - Codec (AAC, MP3, Opus, etc.)
  - Bitrate (256 kbps)
  - Channels (Stereo, 5.1, etc.)
  - Duration
- Each track has:
  - **Download button**: "Download Audio Track #1"
  - **Add to Playlist checkbox**: "Add to playlist as audio-only"
  - Filename preview: `{name}-audio-track1.m4a`
- If no audio tracks: Show "No audio tracks available"

### Feature 4: MediaBunny Track Extraction
**Purpose**: Extract specific tracks using MediaBunny

**Requirements**:
- Create MediaBunny Conversion instance
- Add Input from source video
- For video track extraction:
  - Select specific video track by index
  - Disable all audio tracks
  - Set output container: MP4
  - Maintain video codec (no re-encode if possible)
- For audio track extraction:
  - Select specific audio track by index
  - Disable all video tracks
  - Set output container: M4A or MP3
  - Maintain audio codec (AAC preferred)
- Execute conversion
- Collect output blob

### Feature 5: Download Functionality
**Purpose**: Download extracted tracks

**Requirements**:
- Download button for each track (initially visible)
- On click:
  - Extract the specific track
  - Show progress indicator on that track's div
  - Generate filename: `{original-name}-{track-type}-track{number}.{ext}`
  - Show download button when extraction completes
  - User clicks download button to save file
- Track-specific progress indicators
- Allow multiple simultaneous extractions

### Feature 6: Add to Playlist Option
**Purpose**: Optionally add extracted tracks to playlist

**Requirements**:
- Checkbox for each track: "Add to playlist"
- Unchecked by default
- **CRITICAL**: This checkbox ONLY controls the extracted track (NEW item)
- **CRITICAL**: The original source video ALWAYS remains in the playlist (never removed or affected)
- If checked:
  - After extraction, create new playlist item for the extracted track
  - Video tracks: Add as video-only playlist item
  - Audio tracks: Add as audio-only playlist item with special styling
    - Music icon or waveform icon
    - Different background/border color
    - "Audio" badge
  - Position: Below source video in playlist
  - Generate appropriate metadata
  - Original source video remains in playlist alongside extracted track
- If unchecked: 
  - Extract track but don't add to playlist
  - Original source video remains in playlist (unchanged)
  - Download button shown for extracted track
- Checkbox state remembered during session

### Feature 7: Track Metadata Display
**Purpose**: Show detailed track information

**Requirements**:
- Query MediaBunny for available tracks
- Display accurate track metadata:
  - Video: Resolution, codec, bitrate, FPS
  - Audio: Codec, bitrate, channels, language
- Format bitrates: "5.2 Mbps", "256 kbps"
- Show track count per type
- Indicate primary/default tracks (if applicable)

### Feature 8: Progress Indication
**Purpose**: Show extraction progress for each track

**Requirements**:
- Progress indicator per track (not global)
- Replace download button with progress during extraction
- Show percentage if available from MediaBunny
- Text: "Extracting..." with animated dots
- Small spinner or progress bar
- Re-enable download button when complete
- Allow cancellation (optional)

### Feature 9: Error Handling
**Purpose**: Handle extraction failures gracefully

**Requirements**:
- Detect unsupported codecs
- Show error messages per track:
  - "Extraction failed for this track"
  - "Codec not supported: {codec name}"
  - "Try again?"
- Disable download for problematic tracks
- Show retry button on error
- Don't affect other tracks
- MediaBunny codec errors: Show friendly message

---

## Interaction Behavior

**User Flow 1: View All Tracks**:
1. User clicks settings menu → "Download/Manage Tracks..."
2. Modal opens showing track information
3. User sees 1 video track (H.264, 1080p)
4. User sees 2 audio tracks (English AAC, Spanish AAC)
5. All tracks have unchecked "Add to playlist" checkboxes
6. User reviews metadata

**User Flow 2: Download Video Track Only**:
1. Modal open with tracks displayed
2. User clicks "Download" on Video Track #1
3. Extraction starts, progress indicator shows
4. Progress: "Extracting... 45%"
5. Extraction completes
6. Download button appears
7. User clicks "Download"
8. File downloads: `vacation-video-track1.mp4`
9. Modal stays open

**User Flow 3: Extract Audio to Playlist**:
1. User views audio tracks
2. User checks "Add to playlist" for Audio Track #1 (English)
3. User clicks "Download" button
4. Extraction starts
5. Extraction completes
6. New audio-only playlist item appears below video
7. Item has music icon, "Audio" badge
8. Download button shown (user can still download if wanted)
9. Success toast: "Audio track added to playlist!"

**User Flow 4: Multiple Tracks at Once**:
1. User checks "Add to playlist" for Video Track #1
2. User checks "Add to playlist" for Audio Track #1
3. User clicks Download on both
4. Both extractions progress simultaneously
5. Both added to playlist when complete
6. Each gets its own playlist item

**User Flow 5: Download Without Playlist**:
1. User leaves "Add to playlist" unchecked
2. User clicks "Download" on audio track
3. Extraction completes
4. Download button appears
5. User downloads file
6. No playlist item created
7. Modal still open for more operations

---

## Edge Cases

- No video tracks (audio-only file): Show only audio section
- No audio tracks: Show only video section
- Multiple video/audio tracks: List all with track numbers
- Same codec for all tracks: Still show separately
- Track extraction fails: Show error, allow retry, don't affect other tracks
- User closes modal during extraction: Cancel operations (or continue in background)
- Very large files: Show estimated time per track
- Browser blocks download: Instruct user to allow
- Playlist full: Warn before adding

---

## Styling Requirements

**Theme**: Dark Neobrutalism

**Modal**:
- Width: 700px (max-width: 90vw)
- Padding: 24px
- Bold border and shadow

**Track Sections**:
- Section header: Bold, with icon and count
- Margin between sections: 24px

**Track Cards**:
- Each track in bordered div/card
- Padding: 16px
- Grid layout: Metadata left, Controls right
- Hover: Subtle highlight
- Margin between cards: 12px

**Track Metadata**:
- Track number: Large, bold
- Codec/resolution: Monospace font
- Bitrate: Secondary color
- Clean, scannable layout

**Controls (per track)**:
- Download button: Primary style, full width or inline
- Checkbox: Themed, with clear label
- Progress: Small bar or spinner, primary color

**Audio Playlist Items** (when added):
- Background: Slightly different shade
- Icon: Music note or waveform
- Border-left: Accent color (purple/teal)
- Badge: "Audio" label

---

## Accessibility

- Modal: `role="dialog"`, `aria-labelledby="tracks-title"`
- Track lists: `role="list"`, each track `role="listitem"`
- Download buttons: `aria-label="Download video track 1"`
- Checkboxes: Proper labels, `aria-label="Add audio track 1 to playlist"`
- Progress indicators: `role="status"`, `aria-live="polite"`
- Track metadata: Semantic HTML, readable by screen readers

---

## What NOT to Do

- ❌ Don't extract all tracks automatically
- ❌ Don't re-encode unnecessarily
- ❌ Don't allow extraction if track doesn't exist
- ❌ Don't block UI during extraction
- ❌ Don't forget to clean up MediaBunny resources
- ❌ Don't use generic filenames
- ❌ Don't add to playlist if checkbox unchecked
- ❌ **Don't EVER remove the original source video from the playlist** (checkbox only controls extracted tracks)
- ❌ Don't confuse "add to playlist" checkbox with removing anything from the playlist

---

## MediaBunny Integration

This phase requires MediaBunny Input and Conversion APIs for track selection.

**Consult `mediabunny-llms-full.md`** for:
- Querying available tracks (video, audio) from Input
- Track selection and filtering by index
- Conversion with specific tracks disabled
- Audio extraction techniques
- Video extraction without audio
- Format and codec configuration
- Resource cleanup

**Example workflow**:
```
1. Get Input from video blob
2. Query available tracks (getVideoTracks(), getAudioTracks())
3. Display tracks in modal
4. User selects track to extract and clicks Download
5. Create Conversion
6. Configure track selection (select specific track, disable others)
7. Set output format (MP4 for video, M4A for audio)
8. Execute conversion
9. Show download button
10. User downloads resulting blob
11. If "Add to playlist" checked: Create playlist item
12. Clean up resources
```

---

## Testing Checklist

- [ ] "Download/Manage Tracks..." menu item appears
- [ ] Modal opens with track information
- [ ] Video tracks listed with correct metadata
- [ ] Audio tracks listed with correct metadata
- [ ] Track count displayed correctly
- [ ] Download button works for each track
- [ ] Add to playlist checkbox works
- [ ] Video track extraction successful
- [ ] Audio track extraction successful
- [ ] Progress indicator shows during extraction
- [ ] Correct filename generated per track
- [ ] Download button appears when ready
- [ ] Playlist item created when checkbox checked
- [ ] No playlist item when checkbox unchecked
- [ ] Audio playlist items have special styling
- [ ] Multiple tracks can be downloaded
- [ ] Error shown when extraction fails
- [ ] Extracted files play correctly
- [ ] Works with different video formats

---

## Done When

✅ Track management modal implemented  
✅ Video tracks section functional  
✅ Audio tracks section functional  
✅ MediaBunny track extraction working  
✅ Download functionality per track operational  
✅ Add to playlist option working  
✅ Track metadata display accurate  
✅ Progress indicators functional  
✅ Error handling complete  
✅ Audio-only playlist items styled correctly  
✅ All tests pass  
✅ Ready for next phase (Phase 35: Trim Video)

---

**Phase**: 34 | **Component**: Player  
**Estimated Time**: 60-80 minutes
