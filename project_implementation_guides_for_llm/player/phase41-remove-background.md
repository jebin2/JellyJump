# Phase 41: Remove Background with Color Picker

## Goal
Enable users to remove background colors from videos using a color picker interface, with live preview, transparent output or custom background color, and automatic playlist addition.

**MediaBunny Note**: This phase uses MediaBunny's frame processing with custom color removal logic. Consult `mediabunny-llms-full.md` for frame-by-frame processing with callbacks, canvas manipulation, and video encoding with alpha channel support.

---

## What to Build

Background removal system with:
- "Remove Background..." option in settings menu
- Two-column modal layout
- Left: Video preview player with playback controls
- Right: Color picker and selected colors list
- Live preview of background removal
- Process and save to playlist
- Option for transparent or custom background color

---

## Features to Implement

### Feature 1: Remove Background Modal
**Purpose**: Provide comprehensive UI for background removal workflow

**Requirements**:
- Menu item in settings: "🎨 Remove Background..."
- Opens modal when clicked
- Modal title: "Remove Background"
- Two-column layout:
  - **Left Column (60% width)**: Video preview
  - **Right Column (40% width)**: Color picker and controls
- Modal size: 900px width (max-width: 95vw)
- Responsive: Stacks on mobile
- Apply theme modal styling

### Feature 2: Left Column - Video Preview Player
**Purpose**: Show video with playback controls for color selection

**Requirements**:
- Embedded video player showing current frame
- Displays processed video with selected colors removed (live preview)
- Playback controls:
  - Play/Pause button
  - Timeline scrubber (seek bar)
  - Current time / Total duration display
  - Frame-by-frame navigation buttons (optional)
- **No** volume, speed, or fullscreen controls (keep it simple)
- Player syncs with main player's current time
- Click on video frame to pick color at that pixel
- Crosshair cursor when hovering over player
- Show picked color coordinates on hover (optional)

### Feature 3: Right Column - Color Picker
**Purpose**: Select colors to remove from background

**Requirements**:
- **Color Picker Section**:
  - Large color input (HTML5 color picker)
  - OR canvas-based eyedropper from video frame
  - Click video on left to pick color at pixel
  - Alternative: Manual hex input field
  - Color preview swatch showing selected color
  - "Add Color" button to add to removal list
  
- **Selected Colors List**:
  - Display all colors marked for removal
  - Each color item shows:
    - Color swatch (visual preview)
    - Hex code
    - Tolerance slider (0-100, default: 10)
      - Controls color matching range
      - Higher tolerance = remove similar colors
    - Remove button (X icon)
  - Scrollable if many colors selected
  - Empty state: "Click on the video to select colors to remove"

- **Color Selection Behavior**:
  - Click video → Color picked → Shows in picker → Click "Add Color"
  - OR: Click video → Automatically adds to list (simpler)
  - Support multiple colors (up to 10)
  - Prevent duplicate colors

### Feature 4: Live Preview Processing
**Purpose**: Show real-time result of background removal

**Requirements**:
- When color added to list: Re-process current frame
- When color removed from list: Re-process current frame
- When tolerance slider adjusted: Re-process current frame (with debouncing)
- Processing algorithm:
  - For each pixel in frame:
    - Check if pixel color matches any selected color (within tolerance)
    - If match: Make pixel transparent
    - If no match: Keep original pixel
- Update left video player with processed frame
- Render on canvas for transparency support
- Smooth transitions between updates
- Show loading indicator during processing ("Processing frame...")
- Only process current visible frame (not entire video yet)

### Feature 5: Background Options
**Purpose**: Choose output background (transparent vs. solid color)

**Requirements**:
- Radio buttons:
  - ⚪ **Transparent** (default)
    - Output: WebM or PNG sequence with alpha channel
    - Best for overlaying on other content
  - ⚪ **Custom Background Color**
    - Shows color picker for background color
    - Replaces removed colors with chosen color
    - Output: MP4 or WebM (no transparency needed)
- Background preview in left player
- If transparent: Show checkered pattern behind video
- If custom color: Show solid color behind video
- Update preview when background option changes

### Feature 6: MediaBunny Frame Processing
**Purpose**: Process entire video with background removal

**Requirements**:
- When user clicks "Process Video" button:
  - Create MediaBunny Conversion instance
  - Add Input from source video
  - Set up frame-by-frame processing with callback
  - **For each frame**:
    - Extract frame to canvas
    - Apply color removal algorithm
    - Replace each selected color with transparency or background color
    - Pass processed frame to encoder
  - Progress callback shows: "Processing frame X / Y"
  - Encode to appropriate format:
    - Transparent → WebM with VP9 codec and alpha channel
    - Custom background → MP4 with H.264
  - Collect output blob

### Feature 7: Tolerance Control
**Purpose**: Fine-tune color matching sensitivity

**Requirements**:
- Tolerance slider for each selected color (0-100)
- Default tolerance: 10
- Lower values: Exact color match only
- Higher values: Match similar colors
- Algorithm uses RGB distance calculation:
  ```
  ColorDistance = sqrt((R1-R2)² + (G1-G2)² + (B1-B2)²)
  If ColorDistance <= Tolerance: Remove pixel
  ```
- Live preview updates when tolerance adjusted
- Debounce updates (wait 300ms after last adjustment)
- Show tolerance value label on slider

### Feature 8: Progress Indication
**Purpose**: Show processing progress for full video

**Requirements**:
- Progress bar (0-100%)
- Frame counter: "Processing frame 245 / 720"
- Percentage text: "XX%"
- Estimated time remaining
- Processing stages:
  - "Extracting frames..."
  - "Removing background..."
  - "Encoding video..."
- Disable all controls during processing
- Prevent modal close during processing
- Cancel button (stops processing)
- Show preview of last processed frame (optional)

### Feature 9: Playlist Addition
**Purpose**: Automatically add processed video to playlist after completion

**Requirements**:
- **CRITICAL**: Original source video ALWAYS remains in playlist (never removed)
- After processing completes:
  - Create new playlist item below source video
  - Filename: 
    - Transparent: `{original-name}-nobg.webm`
    - Custom BG: `{original-name}-bg-{color}.mp4`
  - Extract metadata using MediaBunny
  - Generate thumbnail (first frame of processed video)
  - Mark as new with animation
  - Add special badge/icon: "🎨" to indicate background removed
  - Both original and processed videos now in playlist
- Success message: "Background removed! Added to playlist."
- Download button also shown

### Feature 10: Download Button
**Purpose**: Allow user to download processed video

**Requirements**:
- Show download button after processing completes
- Button label: "Download Video"
- Filename matches playlist item name
- Button available until modal closed
- Success message includes download option
- User can download even though it's in playlist

### Feature 11: Error Handling
**Purpose**: Handle processing errors and edge cases

**Requirements**:
- Validate at least one color selected before processing
- Show error if no colors selected: "Please select at least one color to remove"
- Handle MediaBunny processing errors
- Show specific error messages:
  - "Failed to process frame. Video may be corrupted."
  - "Encoding failed. Try a different format."
  - "Browser does not support transparency. Use custom background instead."
- Keep modal open on error
- Show "Try Again" button
- Don't add to playlist if failed
- Clean up resources

---

## Interaction Behavior

**User Flow 1: Simple Background Removal (Transparent)**:
1. User clicks settings → "Remove Background..."
2. Modal opens with two-column layout
3. Left: Video player showing current frame
4. Right: Color picker and empty list
5. User clicks on green screen area in video
6. Color #00FF00 appears in color picker
7. User clicks "Add Color" (or auto-adds)
8. Color added to list below with tolerance slider set to 10
9. Left player updates: Green pixels now transparent (checkered pattern)
10. User adjusts tolerance to 20 for better edge matching
11. Preview updates with smoother edges
12. User clicks "Process Video" button
13. Progress bar: "Processing frame 120 / 360... 33%"
14. Encoding completes (~30 seconds)
15. Success: "Background removed! Added to playlist."
16. Download button appears
17. New WebM file in playlist with transparency
18. User closes modal

**User Flow 2: Multiple Colors with Custom Background**:
1. User opens modal
2. Clicks on blue sky in video → Blue added
3. Clicks on green grass in video → Green added
4. Both colors now in list
5. User selects "Custom Background Color" radio
6. Picks white (#FFFFFF) as replacement
7. Preview shows: Blue/green pixels replaced with white
8. User adjusts green tolerance to 30 (grass has color variation)
9. Preview updates with more grass removed
10. User clicks "Process Video"
11. Processing completes
12. MP4 file created with white background
13. Added to playlist

**User Flow 3: Real-time Preview Adjustment**:
1. User adds primary color (#FF0000) to list
2. Preview shows some background removed
3. User drags tolerance slider from 10 → 40
4. Preview updates live (debounced)
5. More red tones removed at higher tolerance
6. User finds sweet spot at tolerance 25
7. Verifies by scrubbing through video timeline
8. Different frames show consistent removal
9. User processes full video

**User Flow 4: Pick Multiple Similar Colors**:
1. User has video with gradient background
2. Clicks light blue area → #87CEEB added
3. Clicks darker blue area → #4682B4 added
4. Clicks medium blue → #6495ED added
5. All three shades now in removal list
6. Each has independent tolerance control
7. Preview shows smooth gradient removal
8. User processes video

**User Flow 5: Error - No Colors Selected**:
1. User opens modal
2. Immediately clicks "Process Video" without selecting colors
3. Error message: "Please select at least one color to remove"
4. Process button disabled until color added
5. User adds color
6. Button becomes enabled

---

## Edge Cases

- No colors selected: Disable process button, show error message
- Very similar colors: Allow user to fine-tune with tolerance
- Colors not in video: Allow but show warning if no matches found
- Too many colors selected (>10): Warn about performance
- High tolerance values: Warn about removing too much
- Tolerance = 0: Only exact color match
- Tolerance = 100: May remove entire video
- Video without video track: Disable feature
- Transparency not supported: Force custom background option
- Very long videos: Show processing time warning
- Corrupted frames: Skip and continue processing

---

## Styling Requirements

**Theme**: Dark Neobrutalism

**Modal**:
- Width: 900px (max-width: 95vw)
- Height: 600px (max-height: 90vh)
- Two-column grid layout
- Gap between columns: 16px
- Padding: 24px
- Bold border and shadow

**Left Column - Video Player**:
- Video container: 100% of column width
- Aspect ratio maintained
- Background: Checkered pattern for transparency preview
- Controls bar below video
- Clean, minimal styling
- Crosshair cursor when hovering

**Right Column - Color Picker**:
- Color picker: Large, prominent
- Color swatch: 60px × 60px with border
- Selected colors list: Scrollable container
- Each color item:
  - Flex layout: Swatch | Hex | Tolerance | Remove
  - Swatch: 30px × 30px
  - Tolerance slider: 150px width
  - Hover effect on remove button
- Empty state: Centered, secondary text

**Progress Bar**:
- Height: 10px
- Primary color fill
- Animated gradient
- Percentage and frame count above

**Buttons**:
- "Add Color": Secondary style
- "Process Video": Primary style, full width, prominent
- "Download": Primary style, shown after completion
- Color remove buttons: Small, icon-only

**Background Options**:
- Radio buttons with clear labels
- Color picker for custom background
- Preview swatch next to picker

---

## Accessibility

- Modal: `role="dialog"`, `aria-labelledby="remove-bg-title"`
- Video player: `aria-label="Video preview for color selection"`
- Color picker: `aria-label="Select color to remove"`
- Each color item: `aria-label="Color {hex} with tolerance {value}"`
- Tolerance sliders: `aria-label="Tolerance for {color}"`, `aria-valuemin`, `aria-valuemax`, `aria-valuenow`
- Progress bar: `role="progressbar"`
- Radio buttons: Proper grouping and labels
- Remove buttons: `aria-label="Remove color {hex}"`
- Error messages: `role="alert"`
- Focus trap in modal

---

## What NOT to Do

- ❌ Don't process without at least one color selected
- ❌ Don't allow modal close during processing
- ❌ **Don't EVER remove the original source video from the playlist**
- ❌ Don't process entire video on every color selection (only current frame for preview)
- ❌ Don't update preview on every tolerance slider movement (debounce it)
- ❌ Don't forget to show checkered pattern for transparency
- ❌ Don't use lossy format for transparent output (use WebM VP9 with alpha)
- ❌ Don't forget to clean up MediaBunny resources
- ❌ Don't add to playlist if processing failed
- ❌ Don't allow too many tolerance updates that freeze the UI

---

## MediaBunny Integration

This phase requires MediaBunny's frame-by-frame processing with custom pixel manipulation.

**Consult `mediabunny-llms-full.md`** for:
- Frame extraction to canvas
- Frame-by-frame processing with callbacks
- Canvas pixel data manipulation (getImageData, putImageData)
- Video encoding from canvas frames
- WebM encoding with alpha channel for transparency
- Progress monitoring during processing
- Resource cleanup

**Example workflow**:
```
1. User selects colors to remove via color picker
2. For live preview:
   - Get current frame from player
   - Draw to canvas
   - Get pixel data: context.getImageData()
   - Loop through pixels:
     - Calculate color distance to each selected color
     - If within tolerance: Set alpha to 0 (transparent) or replace with bg color
   - Put pixel data back: context.putImageData()
   - Update preview player
3. When user clicks "Process Video":
   - Create Conversion with source video Input
   - Set up frame processing callback
   - For each frame:
     - Extract frame to canvas
     - Apply color removal algorithm
     - Pass processed frame to encoder
   - Configure output:
     - If transparent: WebM with VP9 codec and alpha channel
     - If custom BG: MP4 with H.264
   - Execute conversion with progress tracking
   - Collect output blob
   - Add to playlist
   - Show download button
   - Clean up resources
```

**Color Removal Algorithm**:
```javascript
function removeColor(imageData, colorsToRemove, backgroundColor) {
  const pixels = imageData.data;
  
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    
    for (const colorData of colorsToRemove) {
      const distance = Math.sqrt(
        Math.pow(r - colorData.r, 2) +
        Math.pow(g - colorData.g, 2) +
        Math.pow(b - colorData.b, 2)
      );
      
      if (distance <= colorData.tolerance) {
        if (backgroundColor) {
          // Replace with background color
          pixels[i] = backgroundColor.r;
          pixels[i + 1] = backgroundColor.g;
          pixels[i + 2] = backgroundColor.b;
        } else {
          // Make transparent
          pixels[i + 3] = 0;
        }
        break;
      }
    }
  }
  
  return imageData;
}
```

---

## Performance Considerations

- **Real-time Preview**: Only process visible frame, not entire video
- **Debouncing**: Wait 300ms after tolerance adjustment before updating
- **Memory Management**: Process frames in chunks for long videos
- **Canvas Operations**: Optimize pixel manipulation loops
- **Web Workers**: Consider offloading color calculation to worker (advanced)
- **Frame Skip**: For very long videos, allow skipping frames during preview
- **Tolerance Optimization**: Cache color distance calculations
- **Progress Updates**: Throttle progress bar updates to avoid UI freeze

---

## Testing Checklist

- [ ] "Remove Background..." menu item appears
- [ ] Modal opens with two-column layout
- [ ] Left video player displays and plays correctly
- [ ] Click on video picks color at pixel location
- [ ] Color picker shows selected color
- [ ] Add color button adds to list
- [ ] Selected colors list displays correctly
- [ ] Remove color button removes from list
- [ ] Live preview updates when color added/removed
- [ ] Tolerance slider adjusts color matching
- [ ] Preview updates when tolerance changed (debounced)
- [ ] Transparent background option works
- [ ] Custom background color option works
- [ ] Checkered pattern shows for transparency
- [ ] Process button triggers full video processing
- [ ] Progress bar updates during processing
- [ ] Frame counter shows current progress
- [ ] Processed video added to playlist automatically
- [ ] Download button appears and works
- [ ] Filename generated correctly
- [ ] Transparency preserved in WebM output
- [ ] Custom background applied in MP4 output
- [ ] Error shown if no colors selected
- [ ] Works with multiple colors
- [ ] Original video remains in playlist
- [ ] Resources cleaned up after processing

---

## Done When

✅ Remove background modal implemented  
✅ Two-column layout functional  
✅ Video preview player working  
✅ Color picker operational  
✅ Selected colors list functional  
✅ Live preview processing working  
✅ Tolerance control implemented  
✅ Background options (transparent/custom) working  
✅ MediaBunny frame processing successful  
✅ Progress indication functional  
✅ Playlist addition automatic  
✅ Download button operational  
✅ Error handling complete  
✅ All tests pass  
✅ Ready for Player component completion

---

**Phase**: 41 | **Component**: Player  
**Estimated Time**: 120-150 minutes

