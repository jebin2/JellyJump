# Phase 37: Video Information

## Goal
Display comprehensive video metadata and technical properties in an information modal, helping users understand file details before processing.

**MediaBunny Note**: This phase uses MediaBunny's Input metadata extraction APIs. Consult `mediabunny-llms-full.md` for reading video/audio track information, codec details, and format properties.

---

## What to Build

Video information display system with:
- Modal showing detailed metadata
- Organized sections for different property types
- Copy-to-clipboard functionality
- Formatted, human-readable values
- Technical and user-friendly details

---

## Features to Implement

### Feature 1: Info Modal
**Purpose**: Display video properties in organized modal

**Requirements**:
- Modal opens when "Video Info" (ℹ️) clicked in settings menu
- Modal title: "Video Information"
- Clean, organized layout
- Grouped sections:
  - File Properties
  - Video Stream
  - Audio Stream
  - Technical Details
- Close button
- Copy All button (copy entire info to clipboard)
- Apply theme modal styling

### Feature 2: File Properties Section
**Purpose**: Show basic file information

**Requirements**:
- **Filename**: Full filename with extension
- **Format**: Container format (MP4, WebM, AVI, MOV)
- **File Size**: Formatted (e.g., "125.4 MB", "2.3 GB")
- **Duration**: Formatted (e.g., "5:23", "1:23:45")
- **Creation Date**: File timestamp (if available)
- **Path**: File path or "Uploaded from browser" for blobs
- Clean label-value pairs
- Copy icon next to each value

### Feature 3: Video Stream Information
**Purpose**: Display video track details

**Requirements**:
- **Codec**: Video codec (H.264, VP9, MPEG-4, etc.)
- **Resolution**: Width x Height (e.g., "1920x1080")
- **Aspect Ratio**: Calculated ratio (e.g., "16:9")
- **Frame Rate**: FPS (e.g., "29.97 fps", "60 fps")
- **Bitrate**: Video bitrate (e.g., "5.2 Mbps")
- **Color Space**: Color format (e.g., "YUV420p")
- **Pixel Format**: If available
- Handle videos with no video stream (audio-only)

### Feature 4: Audio Stream Information
**Purpose**: Display audio track details

**Requirements**:
- **Codec**: Audio codec (AAC, MP3, Opus, etc.)
- **Channels**: Number of channels (e.g., "Stereo (2)", "5.1 Surround (6)")
- **Sample Rate**: Hz (e.g., "48 kHz", "44.1 kHz")
- **Bitrate**: Audio bitrate (e.g., "192 kbps")
- **Language**: Track language if available
- Handle videos with no audio stream (video-only)
- Handle multiple audio tracks (show first or list all)

### Feature 5: Technical Details Section
**Purpose**: Advanced metadata for technical users

**Requirements**:
- **Total Bitrate**: Combined video + audio (e.g., "5.4 Mbps")
- **Container**: Container format details
- **Metadata**: Any embedded metadata (title, author, etc.)
- **Stream Count**: Number of video/audio streams
- **Has Subtitles**: Yes/No
- **Encoder**: Encoding software info if available
- **Profile/Level**: Codec profile (e.g., "High@L4.1")

### Feature 6: MediaBunny Metadata Extraction
**Purpose**: Extract all properties using MediaBunny

**Requirements**:
- Create/access MediaBunny Input for video
- Query video metadata:
  - `getFormat()` for container info
  - Video track properties (codec, resolution, fps, bitrate)
  - Audio track properties (codec, channels, sample rate)
  - Duration, file size
- Parse codec strings into readable names
- Calculate derived values (aspect ratio, total bitrate)
- Handle missing properties gracefully

### Feature 7: Value Formatting
**Purpose**: Display values in human-readable format

**Requirements**:
- File size: Convert bytes to KB/MB/GB
  - < 1024 KB: Show in KB
  - < 1024 MB: Show in MB
  - >= 1024 MB: Show in GB
  - One decimal place: "125.4 MB"
- Duration: Format as HH:MM:SS or MM:SS
- Bitrate: Show in Kbps or Mbps
- Sample rate: Show in kHz
- Aspect ratio: Reduce to simplest form (16:9, 21:9, etc.)
- Codec names: Friendly names (H.264 not avc1)

### Feature 8: Copy to Clipboard
**Purpose**: Allow copying values and entire info

**Requirements**:
- Copy icon next to each property value
- Clicking copies that value to clipboard
- "Copy All" button copies entire info as formatted text
- Toast notification: "Copied to clipboard!"
- Formatted copy output:
  ```
  Video Information
  -----------------
  Filename: vacation.mp4
  Format: MP4
  Resolution: 1920x1080 (16:9)
  Duration: 5:23
  ...
  ```
- Handle copy failures gracefully

---

## Interaction Behavior

**User Flow 1: View Info**:
1. User clicks settings menu → "Video Info"
2. Modal opens
3. All metadata displayed instantly (already extracted)
4. User reads properties
5. User clicks close or ESC

**User Flow 2: Copy Single Value**:
1. Info modal open
2. User hovers over "Resolution" value
3. Copy icon appears
4. User clicks copy icon
5. "1920x1080" copied to clipboard
6. Toast: "Copied to clipboard!"

**User Flow 3: Copy All**:
1. Info modal open
2. User clicks "Copy All" button
3. Entire formatted info copied
4. User pastes into document/chat
5. Readable formatted text

---

## Edge Cases

- Video-only file: Show "No audio stream" in audio section
- Audio-only file: Show "No video stream" in video section
- Missing metadata: Show "Unknown" or "N/A"
- Very old codecs: Show codec ID if friendly name unavailable
- Multiple audio tracks: Show first, or list all
- Corrupted metadata: Handle extraction errors, show partial info
- Very large file sizes (>100GB): Format correctly

---

## Styling Requirements

**Theme**: Dark Neobrutalism

**Modal**:
- Width: 600px (max-width: 90vw on mobile)
- Padding: 24px
- Bold border and shadow
- Scrollable content if needed

**Layout**:
- Sections separated by horizontal lines (bold)
- Section headers: Bold, primary color, 18px
- Property labels: Secondary color, 14px
- Property values: White/primary text, 14px, bold
- Grid layout for label-value pairs
- Copy icons: 16px, subtle color, hover → primary color

**Copy All Button**:
- Position: Top-right of modal (or bottom)
- Secondary button style
- Icon + "Copy All" text

**Property Grid**:
- Two-column layout
- Label left-aligned
- Value right-aligned
- Row padding: 8px
- Hover: Subtle background highlight

---

## Accessibility

- Modal: `role="dialog"`, `aria-labelledby="info-title"`
- Property grid: `role="grid"` or `role="list"`
- Copy buttons: `aria-label="Copy [property name]"`
- All values readable by screen readers
- Keyboard accessible (Tab through properties)
- Focus management (trap focus in modal)

---

## What NOT to Do

- ❌ Don't re-extract metadata (use cached from Phase 22)
- ❌ Don't show raw codec strings (format them)
- ❌ Don't display bytes unformatted (show MB/GB)
- ❌ Don't forget to handle missing properties
- ❌ Don't make copy functionality fail silently

---

## MediaBunny Integration

This phase uses MediaBunny Input metadata APIs.

**Consult `mediabunny-llms-full.md`** for:
- Accessing Input metadata
- Reading format and container info
- Querying video track properties
- Querying audio track properties
- Extracting codec details
- Getting duration and bitrate
- Handling missing metadata

**Example workflow**:
```
1. Access cached MediaBunny Input for video
2. Call input.getFormat() for container info
3. Query video tracks: codec, resolution, fps, bitrate
4. Query audio tracks: codec, channels, sample rate
5. Extract duration, file size
6. Calculate derived values (aspect ratio)
7. Format all values for display
8. Populate modal sections
```

**Note**: Metadata should already be extracted in Phase 22 (Playlist). This phase just displays it in a formatted modal.

---

## Testing Checklist

- [ ] Modal opens from settings menu
- [ ] All file properties displayed correctly
- [ ] Video stream info shows (codec, resolution, fps)
- [ ] Audio stream info shows (codec, channels, sample rate)
- [ ] Technical details section populated
- [ ] Values formatted correctly (MB, fps, kHz, etc.)
- [ ] Aspect ratio calculated correctly
- [ ] Copy icon works for individual values
- [ ] "Copy All" button works
- [ ] Toast notification shows after copy
- [ ] Handles video-only files
- [ ] Handles audio-only files
- [ ] Handles missing metadata gracefully
- [ ] Works with different video formats

---

## Done When

✅ Info modal implemented  
✅ File properties section complete  
✅ Video stream information displayed  
✅ Audio stream information displayed  
✅ Technical details shown  
✅ MediaBunny metadata extraction working  
✅ Value formatting correct  
✅ Copy to clipboard functional  
✅ All tests pass  
✅ Ready for next phase (Phase 38: Merge Videos)

---

**Phase**: 37 | **Component**: Player  
**Estimated Time**: 30-40 minutes
