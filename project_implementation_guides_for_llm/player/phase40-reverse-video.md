# Phase 40: Reverse Video

## Goal
Enable users to reverse video playback by processing the video frames in reverse order, with progress indication during processing and automatic playlist addition upon completion.

**MediaBunny Note**: This phase uses MediaBunny's frame processing capabilities to reverse video playback. Consult `mediabunny-llms-full.md` for frame extraction, reordering, and video reconstruction.

---

## What to Build

Video reversal system with:
- "Reverse Video..." option in settings menu
- Modal dialog with progress bar
- MediaBunny frame-by-frame processing
- Automatic playlist addition after completion
- Download button for reversed video

---

## Features to Implement

### Feature 1: Reverse Video Modal
**Purpose**: Provide UI for video reversal operation with progress tracking

**Requirements**:
- Menu item in settings: "🔄 Reverse Video..."
- Opens modal when clicked
- Modal title: "Reverse Video"
- Display source video info:
  - Filename
  - Total duration
  - Resolution
  - Estimated processing time
- Info text: "This will create a new video that plays in reverse"
- Progress bar (0-100%)
- Progress percentage text: "Processing... XX%"
- Current operation text: "Extracting frames..." / "Reversing..." / "Encoding..."
- Cancel button (before processing starts)
- Close button (after completion)
- Apply theme modal styling

### Feature 2: MediaBunny Video Reversal
**Purpose**: Reverse video playback using frame processing

**Requirements**:
- Create MediaBunny Conversion instance
- Extract all video frames in order
- Store frames in memory or temporary storage
- Reverse frame order
- Re-encode frames to create reversed video
- Maintain original:
  - Resolution
  - Frame rate
  - Video format (MP4 recommended for compatibility)
- Audio handling options:
  - Option 1: Reverse audio as well (advanced)
  - Option 2: Remove audio (simpler, recommended initially)
  - Show checkbox: "Include reversed audio" (default: unchecked)
- Progress callback for each processing stage
- Clean up resources after completion

### Feature 3: Progress Indication
**Purpose**: Show detailed progress during video reversal

**Requirements**:
- Progress bar with three stages:
  - Stage 1: "Extracting frames... XX%" (0-40%)
  - Stage 2: "Reversing frames... XX%" (40-60%)
  - Stage 3: "Encoding video... XX%" (60-100%)
- Show current frame being processed: "Frame 245 / 720"
- Estimated time remaining
- Prevent modal close during processing
- Disable cancel button once encoding starts
- Show animated processing indicator (spinning icon or dots)

### Feature 4: Playlist Addition
**Purpose**: Automatically add reversed video to playlist

**Requirements**:
- **CRITICAL**: Original source video ALWAYS remains in playlist (never removed)
- After reversal completes:
  - Create new playlist item below source video
  - Filename: `{original-name}-reversed.{ext}`
  - Extract metadata using MediaBunny
  - Generate thumbnail (first frame of reversed video)
  - Mark as new with animation
  - Add special badge/icon: "🔄" to indicate reversed
  - Both original and reversed videos now in playlist
- Success message: "Video reversed! Added to playlist."
- Download button also shown

### Feature 5: Download Button
**Purpose**: Allow user to download reversed video

**Requirements**:
- Show download button after reversal completes
- Button label: "Download Reversed Video"
- Filename: `{original-name}-reversed.{ext}`
- Button available until modal closed
- Success message includes download option
- User can download even though it's already in playlist

### Feature 6: Processing Optimization
**Purpose**: Handle long videos efficiently

**Requirements**:
- Show warning for videos longer than 60 seconds:
  - "⚠️ Long video detected. Processing may take several minutes."
- Show estimated processing time before starting:
  - Based on video duration and resolution
  - Example: "Estimated time: ~2 minutes"
- Consider frame sampling for very long videos (optional):
  - Reduce frame rate for faster processing
  - Show option: "Fast mode (reduce quality for speed)"
- Memory management:
  - Process in chunks if video is very large
  - Clean up frames as they're encoded
- Show error if video is too large/long to process

### Feature 7: Audio Handling
**Purpose**: Handle audio track during reversal

**Requirements**:
- Default behavior: Remove audio (simpler)
- Checkbox: "Include reversed audio" (unchecked by default)
- If checked:
  - Reverse audio waveform
  - Maintain audio-video sync
  - Show warning: "Audio reversal is experimental"
- If unchecked:
  - Create silent video
  - Show info: "Audio will be removed"
- Display audio status in modal

### Feature 8: Error Handling
**Purpose**: Handle processing errors gracefully

**Requirements**:
- Catch MediaBunny errors:
  - Frame extraction failures
  - Encoding errors
  - Memory errors
- Show specific error messages:
  - "Failed to extract frames. Video may be corrupted."
  - "Encoding failed. Try a different format."
  - "Insufficient memory for this operation."
- Keep modal open on error
- Show "Try Again" button
- Don't add to playlist if failed
- Clean up partial resources
- Log errors for debugging

---

## Interaction Behavior

**User Flow 1: Simple Reverse (No Audio)**:
1. User clicks settings → "Reverse Video..."
2. Modal opens
3. Shows video info: "vacation.mp4, 15 seconds, 1920x1080"
4. Info text: "Audio will be removed"
5. User clicks "Start Reversal" button
6. Progress bar appears
7. "Extracting frames... 25%" (6 seconds)
8. "Reversing frames... 50%" (2 seconds)
9. "Encoding video... 85%" (7 seconds)
10. Completion: "Video reversed! Added to playlist."
11. Download button appears
12. New playlist item shows with 🔄 badge
13. User closes modal or downloads

**User Flow 2: Reverse with Warning (Long Video)**:
1. User selects 3-minute video
2. Clicks "Reverse Video..."
3. Modal shows warning: "⚠️ Long video detected. Processing may take several minutes."
4. Estimated time: "~5 minutes"
5. User decides to proceed
6. Clicks "Start Reversal"
7. Progress proceeds through stages
8. User waits patiently
9. Reversal completes successfully
10. Video added to playlist

**User Flow 3: With Reversed Audio**:
1. User clicks "Reverse Video..."
2. Checks "Include reversed audio"
3. Warning shows: "Audio reversal is experimental"
4. User clicks "Start Reversal"
5. Processing takes longer (audio processing added)
6. Progress shows: "Processing audio... 70%"
7. Completes with audio reversed
8. Reversed video plays with backward audio

**User Flow 4: Processing Error**:
1. User starts reversal
2. Process reaches 45%
3. Encoding fails
4. Error message: "Encoding failed. Try a different format."
5. "Try Again" button appears
6. User clicks "Try Again"
7. Process restarts
8. Succeeds on second attempt

---

## Edge Cases

- Very short videos (<1 second): Allow but show warning about minimal effect
- Very long videos (>5 minutes): Show strong warning, recommend trimming first
- High resolution videos (4K+): Warn about processing time and memory
- Corrupted or incomplete frames: Handle gracefully, skip bad frames
- Out of memory: Show error, suggest lower resolution
- Audio-only files: Disable reverse (video only feature)
- Already reversed video: Allow (can reverse again to restore)
- Empty video (0 frames): Show error

---

## Styling Requirements

**Theme**: Dark Neobrutalism

**Modal**:
- Width: 500px (max-width: 90vw)
- Padding: 24px
- Bold border and shadow

**Progress Bar**:
- Height: 12px
- Primary color fill
- Animated gradient during processing
- Percentage text above bar
- Stage text below bar

**Video Info Display**:
- Monospace font for filename
- Secondary color for metadata
- Clear spacing between items

**Buttons**:
- "Start Reversal": Primary style, full width
- "Cancel": Secondary style, available during processing
- "Download": Primary style, shown after completion
- "Try Again": Accent style, shown on error

**Status Messages**:
- Success: Green background
- Warning: Yellow/orange background
- Error: Red background
- Info: Blue background

---

## Accessibility

- Modal: `role="dialog"`, `aria-labelledby="reverse-title"`
- Progress bar: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Progress text: `aria-live="polite"` for screen readers
- Buttons: Clear `aria-label` attributes
- Status messages: `role="alert"` for errors
- Checkbox: `aria-label="Include reversed audio"`
- Focus trap in modal during processing

---

## What NOT to Do

- ❌ Don't start processing without user clicking "Start Reversal"
- ❌ Don't allow modal close during processing
- ❌ **Don't EVER remove the original source video from the playlist**
- ❌ Don't process without checking available memory
- ❌ Don't ignore audio track without informing user
- ❌ Don't show generic "Processing..." without specific stages
- ❌ Don't forget to clean up MediaBunny resources
- ❌ Don't process videos that are too large to handle
- ❌ Don't add to playlist if processing failed

---

## MediaBunny Integration

This phase requires MediaBunny's frame processing and video encoding capabilities.

**Consult `mediabunny-llms-full.md`** for:
- Frame extraction from video (VideoSampleSink or CanvasSink)
- Frame buffering and storage
- Frame reordering techniques
- Video encoding from frames
- Audio extraction and reversal
- Progress callbacks during conversion
- Memory management for large videos
- Resource cleanup

**Example workflow**:
```
1. Create Conversion with source video Input
2. Extract frames using VideoSampleSink/CanvasSink
3. Store frames in array or buffer
4. Update progress: "Extracting frames... XX%"
5. Once all frames extracted, reverse array order
6. Update progress: "Reversing frames..."
7. Create new Conversion for encoding
8. Add frames in reversed order to encoder
9. Configure output format (MP4)
10. If audio included: Extract, reverse, re-add
11. Execute encoding with progress callback
12. Update progress: "Encoding video... XX%"
13. Collect output blob
14. Add to playlist
15. Show download button
16. Clean up all resources
```

---

## Performance Considerations

- **Memory Usage**: Loading all frames in memory can be intensive
  - For videos >30 seconds, consider processing in chunks
  - Use frame buffers to limit memory footprint
- **Processing Time**: Reversal is CPU-intensive
  - Show accurate time estimates
  - Don't block UI thread
  - Use Web Workers if possible (advanced)
- **File Size**: Reversed video should maintain similar file size
  - Use same codec and bitrate as source
  - Optimize encoding settings
- **Browser Limits**: Very large videos may hit browser memory limits
  - Set reasonable maximum (e.g., 100MB or 5 minutes)
  - Show error if exceeded

---

## Testing Checklist

- [ ] "Reverse Video..." menu item appears
- [ ] Modal opens correctly
- [ ] Video info displays accurately
- [ ] Start button initiates processing
- [ ] Progress bar updates through all stages
- [ ] Frame extraction works correctly
- [ ] Frames reverse in proper order
- [ ] Encoding completes successfully
- [ ] Reversed video added to playlist automatically
- [ ] Download button functional
- [ ] Filename generated correctly
- [ ] Reversed video plays correctly (backward)
- [ ] Audio removed by default
- [ ] Audio reversal works when checked (if implemented)
- [ ] Warning shown for long videos
- [ ] Error handling works for failures
- [ ] Resources cleaned up after completion
- [ ] Works with different video formats
- [ ] Original video remains in playlist

---

## Done When

✅ Reverse video modal implemented  
✅ MediaBunny frame processing working  
✅ Progress indication functional  
✅ Playlist addition automatic  
✅ Download button operational  
✅ Audio handling implemented  
✅ Error handling complete  
✅ Performance optimizations applied  
✅ All tests pass  
✅ Ready for Phase 41 (Remove Background)

---

**Phase**: 40 | **Component**: Player  
**Estimated Time**: 90-120 minutes

