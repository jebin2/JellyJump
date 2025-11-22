# Phase 39: Video Filters

## Goal
Implement color and visual filters for video clips

**MediaBunny Integration**: Filters applied via frame processing during preview and export. **Consult** mediabunny-llms-full.md for:
- `video.process` callback for frame-by-frame manipulation
- Canvas 2D context for applying filters
- Image data manipulation

## Features to Implement

### Feature 1: Filters Panel in Properties
**Purpose**: Filter controls in right sidebar

**Requirements**:
- **🎨 Filters** section in Properties Panel (Phase 29)
- Show when clip selected
- List of available filters
- Sliders for each filter parameter
- Real-time preview toggle
- Reset all filters button
- Apply to selected clip

### Feature 2: Brightness Filter
**Purpose**: Adjust image brightness

**Requirements**:
- Slider: -100 to +100 (default: 0)
- **Implementation**:
  ```javascript
  // For each pixel in frame:
  pixel.r = clamp(pixel.r + brightnessValue, 0, 255);
  pixel.g = clamp(pixel.g + brightnessValue, 0, 255);
  pixel.b = clamp(pixel.b + brightnessValue, 0, 255);
  ```
- Real-time preview in Preview Panel
- Store value in clip's filters array

### Feature 3: Contrast Filter
**Purpose**: Adjust image contrast

**Requirements**:
- Slider: -100 to +100 (default: 0)
- **Implementation**:
  ```javascript
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
  pixel.r = clamp(factor * (pixel.r - 128) + 128, 0, 255);
  // Similar for g, b
  ```
- Real-time preview
- Store in clip's filters array

### Feature 4: Saturation Filter
**Purpose**: Adjust color saturation

**Requirements**:
- Slider: -100 to +100 (default: 0)
- **Implementation**:
  - Convert RGB to HSL
  - Adjust S component
  - Convert back to RGB
- Real-time preview
- Store in clip's filters array

### Feature 5: Grayscale Filter
**Purpose**: Convert to black and white

**Requirements**:
- Toggle checkbox (on/off)
- **Implementation**:
  ```javascript
  const gray = 0.299 * pixel.r + 0.587 * pixel.g + 0.114 * pixel.b;
  pixel.r = pixel.g = pixel.b = gray;
  ```
- Real-time preview
- Store in clip's filters array

### Feature 6: Sepia Filter
**Purpose**: Apply vintage sepia tone

**Requirements**:
- Toggle checkbox (on/off)
- **Implementation**:
  ```javascript
  const tr = 0.393 * r + 0.769 * g + 0.189 * b;
  const tg = 0.349 * r + 0.686 * g + 0.168 * b;
  const tb = 0.272 * r + 0.534 * g + 0.131 * b;
  pixel = [clamp(tr), clamp(tg), clamp(tb)];
  ```
- Real-time preview
- Store in clip's filters array

### Feature 7: Blur Filter (Optional)
**Purpose**: Apply gaussian blur

**Requirements**:
- Slider: 0 to 20 (default: 0)
- **Implementation**: Use CSS filter or canvas blur
- Performance intensive - may skip real-time preview
- Store in clip's filters array

### Feature 8: Filter Presets (Optional)
**Purpose**: Quick apply common filter combinations

**Requirements**:
- Preset buttons:
  - "Cinematic" (slight desaturation, contrast +20)
  - "Vintage" (sepia + brightness -10)
  - "Vibrant" (saturation +30, contrast +15)
- One-click apply
- Save custom presets (to localStorage or JSON)

### Feature 9: Reset Filters
**Purpose**: Clear all filters from clip

**Requirements**:
- **Reset** button below filters
- Resets all sliders to default values
- Removes all filters from clip's filters array
- Updates preview
- Adds to undo stack (Phase 37)

### Feature 10: Real-Time Preview
**Purpose**: See filter effects immediately

**Requirements**:
- Apply filters to Preview Panel (Phase 28) video
- Update on slider change (debounced to avoid lag)
- Use canvas overlay or WebGL for performance
- Toggle real-time preview on/off (for performance)
- **Note**: Actual export application in Phase 42

### Feature 11: Filter Timeline Indicator
**Purpose**: Show which clips have filters

**Requirements**:
- Small icon overlay on timeline clip
- Tooltip showing active filters on hover
- Filter count badge (e.g., "3 filters")

## Testing Checklist
- [ ] Filters panel displays in Properties Panel
- [ ] Brightness slider adjusts correctly (-100 to +100)
- [ ] Contrast slider adjusts correctly
- [ ] Saturation slider changes color intensity
- [ ] Grayscale toggle converts to B&W
- [ ] Sepia toggle applies vintage tone
- [ ] Blur filter works (if implemented)
- [ ] Filter presets apply combinations (if implemented)
- [ ] Reset button clears all filters
- [ ] Real-time preview updates (if enabled)
- [ ] Filters export correctly (verified in Phase 42)
- [ ] Timeline shows filter indicators
- [ ] Undo/redo works with filters

## Done When
✅ Filters panel functional in Properties  
✅ All basic filters implemented (brightness, contrast, saturation, grayscale, sepia)  
✅ Filter sliders update clip data  
✅ Real-time preview works  
✅ Reset filters functional  
✅ Timeline indicators show filtered clips  
✅ All tests pass  
✅ Ready for Phase 40 (Text Overlays)

---
**Phase**: 39 | **Component**: Editor  
**Estimated Time**: 35-45 minutes
