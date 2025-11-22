# Phase 40: Text Overlays

## Goal
Add text overlays on video with positioning and styling controls

## Features to Implement

### Feature 1: Text Panel in Properties
**Purpose**: Text controls in right sidebar

**Requirements**:
- **📝 Text Overlay** section in Properties Panel (Phase 29)
- Show when text-capable clip selected or text track
- **Add Text** button
- List of existing text overlays
- Edit/delete buttons for each text item

### Feature 2: Text Data Structure
**Purpose**: Store text overlay information

**Requirements**:
- Text overlay object:
  - `id`: Unique identifier
  - `content`: Text string
  - `startTime`: When text appears (timeline seconds)
  - `endTime`: When text disappears
  - `position`: {x, y} coordinates (pixels or percentage)
  - `font`: Font family
  - `fontSize`: Size in pixels
  - `color`: Text color (hex or rgba)
  - `backgroundColor`: Optional background color
  - `alignment`: left/center/right
- Store in separate text track or clip's text array

### Feature 3: Text Content Input
**Purpose**: Enter text to display

**Requirements**:
- **Text Content** textarea
- Multiline support with `\n` for line breaks
- Character count display
- Max length: 500 characters (configurable)
- Real-time preview update

### Feature 4: Font Selection
**Purpose**: Choose text font

**Requirements**:
- **Font Family** dropdown
- Web-safe fonts:
  - Arial
  - Helvetica
  - Times New Roman
  - Courier New
  - Georgia
  - Verdana
  - (Add Google Fonts integration optional)
- Font preview in dropdown
- Apply to preview immediately

### Feature 5: Font Size Control
**Purpose**: Adjust text size

**Requirements**:
- **Font Size** slider or number input
- Range: 10px to 200px
- Default: 48px
- Real-time preview update
- Responsive sizing option (scale with video resolution)

### Feature 6: Color Picker
**Purpose**: Choose text color

**Requirements**:
- **Text Color** color picker input
- Default: White (#FFFFFF)
- Alpha/opacity slider (optional)
- Recent colors palette
- Apply to preview immediately

### Feature 7: Background Color (Optional)
**Purpose**: Add background behind text for readability

**Requirements**:
- **Background Color** toggle + color picker
- Semi-transparent background by default (rgba)
- Padding around text
- Border radius option

### Feature 8: Position Control
**Purpose**: Place text on video canvas

**Requirements**:
- **X Position** slider (-100% to +100%)
- **Y Position** slider (-100% to +100%)
- Default: Center (0%, 0%)
- **OR** Draggable text on Preview Canvas:
  - Click and drag text to reposition
  - Show bounding box while dragging
  - Snap to edges/center (optional)
- Quick position presets:
  - Top-Left, Top-Center, Top-Right
  - Center-Left, Center, Center-Right
  - Bottom-Left, Bottom-Center, Bottom-Right

### Feature 9: Text Timeline Track
**Purpose**: Show text overlays on timeline

**Requirements**:
- Text Track (from Phase 31) shows text clips
- Each text overlay as a clip on text track
- Clip width = duration (endTime - startTime)
- Clip shows first few words as label
- Draggable to change timing
- Trim edges to change duration

### Feature 10: Timing Controls
**Purpose**: Set when text appears/disappears

**Requirements**:
- **Start Time** input (seconds or timecode)
- **End Time** input (seconds or timecode)
- **Duration** display (calculated from end - start)
- **Set to Playhead** button (start text at current time)
- Min duration: 0.5 seconds

### Feature 11: Text Preview on Canvas
**Purpose**: Show text on video preview

**Requirements**:
- Render text over video in Preview Panel (Phase 28)
- Use Canvas 2D context or HTML overlay
- Apply all styling (font, size, color, position)
- Update in real-time as properties change
- Only show text when playhead within text's time range

### Feature 12: Multiple Text Overlays
**Purpose**: Support multiple simultaneous texts

**Requirements**:
- Add multiple text overlays to video
- Each text has independent timing
- Render overlapping texts in Z-order
- List all texts in Properties Panel
- Click to select/edit specific text

### Feature 13: Delete Text Overlay
**Purpose**: Remove text

**Requirements**:
- Delete button next to each text in list
- Confirmation (optional)
- Remove from text track/array
- Update preview
- Add to undo stack (Phase 37)

## Testing Checklist
- [ ] Text panel displays in Properties
- [ ] Can add new text overlay
- [ ] Text content input updates preview
- [ ] Font dropdown changes text font
- [ ] Font size slider adjusts size
- [ ] Color picker changes text color
- [ ] Background color optional (if implemented)
- [ ] Position sliders move text on canvas
- [ ] Draggable positioning works (if implemented)
- [ ] Quick position presets work (if implemented)
- [ ] Start/end time controls set duration
- [ ] Text appears on timeline text track
- [ ] Text renders on video preview
- [ ] Multiple texts can coexist
- [ ] Delete removes text overlay
- [ ] Undo/redo works with text
- [ ] Text exports correctly (verified in Phase 42)

## Done When
✅ Text panel functional in Properties  
✅ Text content and styling controls work  
✅ Position controls functional  
✅ Timing controls set start/end  
✅ Text displays on timeline text track  
✅ Text renders on video preview  
✅ Multiple text overlays supported  
✅ All tests pass  
✅ Ready for Phase 41 (Transform Controls)

---
**Phase**: 40 | **Component**: Editor  
**Estimated Time**: 35-45 minutes
