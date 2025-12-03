# Phase 36: Resize Video

## Goal
Enable users to resize videos to custom dimensions with optional aspect ratio preservation, using preset options or manual width/height values.

**MediaBunny Note**: This phase uses MediaBunny's VideoTransform for scaling operations during conversion. Consult `mediabunny-llms-full.md` for VideoTransform, scaling techniques, and aspect ratio calculations.

---

## What to Build

Video resizing system with:
- Modal dialog for dimension configuration
- Preset resolution buttons (1080p, 720p, etc.)
- Custom width/height inputs
- Aspect ratio lock toggle
- Option to add resized video to playlist
- Real-time dimension calculations

---

## Features to Implement

### Feature 1: Resize Modal
**Purpose**: Provide UI for configuring output dimensions

**Requirements**:
- Modal opens when "Resize Video..." clicked in settings menu
- Modal title: "Resize Video"
- Display source video info:
  - Current resolution (e.g., "1920x1080")
  - Current aspect ratio (e.g., "16:9")
  - File size
- Width and height input fields
- Aspect ratio lock toggle
- Preset resolution buttons
- Checkbox: "Add to playlist after resizing"
- Cancel and Resize buttons
- Apply theme modal styling

### Feature 2: Dimension Inputs
**Purpose**: Allow manual dimension entry

**Requirements**:
- Width input field (pixels)
- Height input field (pixels)
- Number inputs with validation
- Min value: 128px (prevent too small)
- Max value: 7680px (8K max)
- Step: 2 (even numbers for codec compatibility)
- Show calculated aspect ratio below inputs
- Real-time validation
- Error messages for invalid values

### Feature 3: Aspect Ratio Lock
**Purpose**: Maintain proportions when resizing

**Requirements**:
- Toggle switch/checkbox: "🔒 Maintain aspect ratio"
- Enabled by default
- When locked:
  - Changing width auto-calculates height
  - Changing height auto-calculates width
  - Preserve original aspect ratio
  - Update other input in real-time
- When unlocked:
  - Allow independent width/height changes
  - Show warning: "Video may appear stretched"
  - Display calculated aspect ratio (e.g., "21:9")

### Feature 4: Preset Resolutions
**Purpose**: Quick selection of common resolutions

**Requirements**:
- Preset buttons in modal:
  - **1080p** - 1920x1080 (Full HD)
  - **720p** - 1280x720 (HD)
  - **480p** - 854x480 (SD)
  - **360p** - 640x360 (Mobile)
  - **Custom** - Enable manual inputs
- Clicking preset fills width/height inputs
- Respect aspect ratio lock when setting preset
- Visual indication of selected preset
- Disable "Custom" as a button, just a label when manual entry

### Feature 5: MediaBunny Resizing
**Purpose**: Execute video resizing using MediaBunny

**Requirements**:
- Create MediaBunny Conversion instance
- Add Input from source video
- Apply VideoTransform for scaling:
  - Set target width and height
  - Configure scaling algorithm (bicubic for quality)
  - Maintain aspect ratio if locked
- Maintain codec and format (or re-encode if needed)
- Execute conversion
- Collect output blob (resized video)
- Clean up resources

### Feature 6: Aspect Ratio Calculation
**Purpose**: Real-time ratio calculations and validation

**Requirements**:
- Calculate aspect ratio from width/height
- Reduce to simplest form (e.g., 1920:1080 → 16:9)
- Display in readable format: "16:9", "21:9", "4:3"
- Detect common ratios:
  - 16:9 (widescreen)
  - 21:9 (ultrawide)
  - 4:3 (standard)
  - 1:1 (square)
  - Custom (show "X:Y" format)
- Show warning if aspect ratio changes significantly

### Feature 7: Add to Playlist Option
**Purpose**: Optionally add resized video to playlist

**Requirements**:
- Checkbox: "Add to playlist after resizing" (checked by default)
- If checked:
  - Create new playlist item below source
  - Filename: `{original-name}-{width}x{height}.{ext}`
  - Extract metadata from resized video
  - Generate thumbnail
  - Mark as new
- If unchecked: Never add to playlist, download button shown
- Show "Download" button after resizing completes
- User clicks button to download resized file

### Feature 8: Progress Tracking
**Purpose**: Show resizing progress

**Requirements**:
- Disable form during resizing
- Progress bar with percentage
- Text: "Resizing video... (1920x1080 → 1280x720)"
- Show target dimensions in progress text
- Estimated time (resizing can be slow for large videos)
- Prevent modal close during operation

### Feature 9: Validation
**Purpose**: Ensure valid resize parameters

**Requirements**:
- Width and height must be positive
- Minimum: 128px (prevent unusably small)
- Maximum: 7680px (8K limit)
- Both dimensions even numbers (codec requirement)
- Warn if upscaling (target larger than source):
  - "Warning: Upscaling may reduce quality"
- Disable Resize button if validation fails
- Show clear error messages

---

## Interaction Behavior

**User Flow 1: Preset Selection**:
1. User clicks "Resize Video..." from settings
2. Modal shows current resolution: 1920x1080
3. User clicks "720p" preset
4. Width/height update to 1280x720
5. Aspect ratio lock enabled by default
6. User clicks "Resize"
7. Progress bar shows
8. Resized video downloads and added to playlist

**User Flow 2: Custom Dimensions with Lock**:
1. Modal opens (aspect ratio locked)
2. User types width: 1000
3. Height auto-calculates to 562 (maintains 16:9)
4. User confirms dimensions look good
5. User clicks "Resize"
6. Operation completes successfully

**User Flow 3: Custom Dimensions Without Lock**:
1. User unlocks aspect ratio
2. User types width: 1920
3. User types height: 800
4. Aspect ratio shows: "12:5 (Custom)"
5. Warning: "Video may appear stretched"
6. User proceeds anyway
7. Resized video has 1920x800 resolution

**User Flow 4: Validation Error**:
1. User types width: 50
2. Error: "Width must be at least 128px"
3. Resize button disabled
4. User corrects to 640
5. Error clears, button enabled

---

## Edge Cases

- Upscaling (target > source): Warn about quality loss, but allow
- Extreme aspect ratios (e.g., 100:1): Warn, but allow
- Odd dimensions: Auto-round to even numbers for codec compatibility
- Same as source dimensions: Warn "No resize needed" but allow (re-encode)
- Very large source (4K → 8K): Show long processing time warning
- Portrait vs landscape: Handle correctly

---

## Styling Requirements

**Theme**: Dark Neobrutalism

**Modal**:
- Width: 550px (max-width: 90vw on mobile)
- Padding: 24px
- Bold border and shadow

**Dimension Inputs**:
- Width: 120px each
- Monospace font for numbers
- Bold border
- Error state: Red border
- Group inputs with "×" between them visually

**Preset Buttons**:
- Grid layout: 2x2
- Bold borders, equal size
- Active state: Primary color fill
- Hover: Scale 1.05x

**Aspect Ratio Lock**:
- Toggle switch styled to theme
- Locked: Show lock icon 🔒
- Unlocked: Show unlock icon 🔓

**Progress Indicator**:
- Progress bar: 8px height
- Show current/target resolution in text

---

## Accessibility

- Modal: `role="dialog"`, `aria-labelledby="resize-title"`
- Width input: `aria-label="Video width in pixels"`
- Height input: `aria-label="Video height in pixels"`
- Aspect ratio toggle: `aria-label="Maintain aspect ratio"`, `aria-pressed`
- Preset buttons: `aria-label="Set resolution to 1080p"`
- Error messages: `role="alert"`
- Progress bar: `role="progressbar"`, `aria-valuenow`

---

## What NOT to Do

- ❌ Don't allow dimensions below codec minimums
- ❌ Don't forget to warn about upscaling
- ❌ Don't calculate aspect ratios incorrectly
- ❌ Don't use odd dimensions (causes codec issues)
- ❌ Don't lose source video if resizing fails

---

## MediaBunny Integration

This phase requires MediaBunny VideoTransform for scaling.

**Consult `mediabunny-llms-full.md`** for:
- Creating VideoTransform instances
- Setting target dimensions (width, height)
- Configuring scaling algorithm (bicubic, bilinear)
- Applying transforms during conversion
- Maintaining quality during resize
- Resource cleanup

**Example workflow**:
```
1. Get target width and height from user input
2. Create Conversion with source video Input
3. Create VideoTransform
4. Set transform dimensions: transform.setSize(width, height)
5. Apply transform to conversion
6. Execute conversion
7. Collect resized video blob
8. Download and/or add to playlist
9. Clean up resources
```

---

## Testing Checklist

- [ ] Modal opens from settings menu
- [ ] Current resolution displayed correctly
- [ ] Preset buttons work (1080p, 720p, 480p, 360p)
- [ ] Width input updates height when aspect locked
- [ ] Height input updates width when aspect locked
- [ ] Aspect ratio lock toggle works
- [ ] Custom dimensions work when unlocked
- [ ] Aspect ratio calculates correctly
- [ ] Validation catches invalid dimensions
- [ ] Warning shows for upscaling
- [ ] Resizing executes successfully
- [ ] Progress indicator shows
- [ ] Resized video downloads with correct filename
- [ ] Add to playlist option works
- [ ] Resized video has correct dimensions
- [ ] Resized video plays correctly

---

## Done When

✅ Resize modal implemented  
✅ Dimension inputs functional  
✅ Aspect ratio lock working  
✅ Preset resolutions functional  
✅ MediaBunny resizing successful  
✅ Aspect ratio calculations correct  
✅ Add to playlist option working  
✅ Progress tracking implemented  
✅ Validation complete  
✅ All tests pass  
✅ Ready for next phase (Phase 37: Video Info)

---

**Phase**: 36 | **Component**: Player  
**Estimated Time**: 50-60 minutes

---

## Code Reusability Note

**IMPORTANT**: This phase shares common patterns with other processing phases (33-39):
- MediaBunny conversion/processing
- Download button functionality
- Add to playlist checkbox

**Following COC**: Extract these into reusable utility modules (MediaProcessor, DownloadManager, PlaylistManager).
DO NOT duplicate code across phases. See Phase 39 for detailed reusability guidelines.

