# Phase 42: Upload Audio Files

## Goal
File picker for audio files, add to Audio category

## Group
**Media Library**

## Feature to Implement

### ONE Feature: Upload Audio Files to Media Library
**Purpose**: Add audio file upload functionality specifically for the Audio category

**Requirements**:

#### 1. What to Build
Add audio upload capability to Audio category:
- Click or button in Audio category to trigger file picker
- Accept only audio files (.mp3, .wav, .ogg, .m4a, .aac, .flac)
- Allow multiple file selection
- Extract audio metadata (duration, sample rate, channels)
- Store audio in IndexedDB
- Update Audio count badge
- Display uploaded audio in Audio category

#### 2. Upload Trigger UI
Add upload button to Audio content section:
- Button text: "+ Add Audio" or "📥 Import Audio"
- Dark Neobrutalism button style
- Positioned at top of Audio content area
- Always visible
- Clickable empty state as alternative trigger

#### 3. File Picker Configuration
Configure audio file input:
- Accept attribute: `audio/*, .mp3, .wav, .ogg, .m4a, .aac, .flac`
- Multiple: true (allow multiple selection)
- Hidden input, triggered by button click

#### 4. Audio Processing Flow
When audio files selected:
1. Validate each file is an audio type
2. For each valid audio file:
   - Generate unique UUID
   - Extract metadata: duration, sample rate, channels, bitrate
   - Create audio object with metadata
   - Store blob in IndexedDB
   - Add to Audio category display
   - Update Audio count badge
3. Show success notification: "✅ 3 audio files added"

#### 5. Metadata Extraction
Use HTML5 Audio element to extract:
- **Duration**: Total length in seconds
- **Sample Rate**: e.g., 44100 Hz (if available via Web Audio API)
- **Channels**: Mono (1) or Stereo (2) (if available)
- **Size**: File size in bytes
- **Filename**: Original filename

**HTML5 Audio approach**:
```
- Create <audio> element
- Set src to blob URL
- Listen for 'loadedmetadata' event
- Read duration
- Optional: Use Web Audio API for sample rate/channels
```

**Simplified approach** (recommended):
```
- Extract duration from <audio>.duration
- Store other metadata as unavailable (0 or null)
- Keep it simple for this phase
```

#### 6. IndexedDB Storage
Store audio in same database structure:
```
Database: "MediaLibraryDB"
Store: "media"
Object: {
  id: UUID,
  name: filename,
  type: "audio",
  blob: Blob,
  size: number (bytes),
  duration: number (seconds),
  sampleRate: number (Hz) - optional,
  channels: number (1 or 2) - optional,
  dateAdded: timestamp,
  category: "audio"
}
```

#### 7. Audio Category Update
After successful upload:
- Increment Audio count badge: "(0)" → "(3)"
- Add audio items to Audio content area
- Remove empty state message if showing
- Scroll to show newly added audio

#### 8. User Feedback
Provide clear feedback:
- **During upload**: Loading spinner "Importing audio..."
- **On success**: "✅ 3 audio files added to library"
- **On error**: "❌ Failed to import filename.mp3: invalid file"
- **File type error**: "❌ Only audio files are supported"
- Notifications auto-dismiss after 3 seconds

#### 9. Error Handling
Handle these errors:
- **No file selected**: Do nothing
- **Non-audio file**: Skip with error notification
- **Metadata extraction failed**: Still import, use defaults (duration: 0)
- **IndexedDB error**: Show "Failed to save audio"
- **Corrupted audio**: Use defaults, still import

#### 10. Pattern Consistency
Follow same pattern as Phase 41 (Videos):
- Same UI structure (upload button at top)
- Same notification style
- Same IndexedDB structure
- Same error handling approach

This maintains consistency across media types.

#### 11. Duplicate Handling
Same as videos:
- Allow duplicate filenames (create new UUID)
- No warning needed (keeps it simple)

#### 12. Edge Cases
- **Upload when Videos tab active**: Audio still goes to Audio category
- **Large audio files** (> 50MB): Warn but allow
- **Exotic formats** (FLAC, ALAC): Browser support varies, may fail gracefully
- **Very short audio** (< 1 second): Allow, valid use case

#### 13. Accessibility
- Upload button keyboard accessible (Tab, Enter/Space)
- Add `aria-label="Upload audio files"`
- Announce upload success/error to screen readers
- File input has `aria-label="Select audio files"`

#### 14. Files to Create/Modify
- `editor.html` - Add upload button to Audio content area
- `editor.html` - Add hidden file input for audio
- `assets/js/media-library.js` - Add audio upload logic (similar to videos)
- Reuse `assets/js/indexeddb-helper.js`
- `assets/css/editor.css` - Style upload button (reuse video button styles)

#### 15. JavaScript Organization
Extend MediaLibrary class:
- `uploadAudio()` - Trigger file picker
- `processAudioFiles(files)` - Loop through files
- `extractAudioMetadata(file)` - Get duration, etc.
- `saveAudioToIndexedDB(audioData)` - Store in database
- `addAudioToUI(audioData)` - Add to category display
- `updateAudioCount()` - Increment badge count

**Code Reuse**: Most logic similar to Phase 41, can abstract common upload logic.

#### 16. Data Attributes
- `data-upload="audio"` on upload button
- `data-file-input="audio-upload"` on hidden file input

#### 17. What NOT to Do
- ❌ Do NOT create waveform visualizations (not in scope)
- ❌ Do NOT create audio previews/players yet (comes later if needed)
- ❌ Do NOT implement full tile display yet (that's Phase 45)
- ❌ Do NOT implement search/filter (that's Phase 44)
- This phase is **audio upload ONLY**

**MediaBunny Integration**: Not needed for basic audio metadata

## References
- **Phase 41**: Videos upload (same pattern)
- **Phase 30**: Generic import and IndexedDB setup
- **Phase 40**: Audio category tab switching
- **Phase 45**: Full tile/grid display for audio

## Testing Checklist
- [ ] Click "+ Add Audio" button opens file picker
- [ ] File picker accepts only audio files (.mp3, .wav, .ogg, .m4a)
- [ ] Can select multiple audio files at once
- [ ] Selected audio stored in IndexedDB
- [ ] Audio metadata extracted (duration at minimum)
- [ ] Audio count badge updates: "(0)" → "(3)"
- [ ] Success notification: "✅ 3 audio files added"
- [ ] Notification auto-dismisses
- [ ] Empty state disappears when audio added
- [ ] Non-audio files rejected with error
- [ ] Audio files persist after page reload
- [ ] Console has no errors
- [ ] Upload button keyboard accessible
- [ ] Different audio formats supported (MP3, WAV, OGG)

## Done When
✅ Upload button functional in Audio category  
✅ File picker accepts audio files only  
✅ Multiple audio files can be uploaded  
✅ Metadata extracted (duration)  
✅ Audio stored in IndexedDB  
✅ Count badge updates  
✅ Success/error notifications work  
✅ All tests pass  
✅ Ready for Phase 43 (Upload Image Files)

---
**Phase**: 42 | **Component**: Editor | **Group**: Media Library  
**Estimated Time**: 20 min

## Implementation Notes
- Very similar to Phase 41 (Videos)
- Can abstract common upload logic into shared function
- HTML5 Audio element sufficient for basic metadata
- Web Audio API optional for advanced metadata
- Keep it simple - duration is most important metadata
