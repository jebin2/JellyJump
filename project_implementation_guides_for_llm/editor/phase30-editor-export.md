# Phase 30: Editor Export

## Goal
Export edited video using MediaBunny with multiple export options: video download, save to media library, and JSON project export for reusable templates.

**MediaBunny Integration**: Use MediaBunny for ALL export operations (NO FFmpeg.wasm). **Consult** mediabunny-llms-full.md for:
- `Conversion` API for converting/exporting edited videos
- `Output` with `Mp4OutputFormat`, `WebMOutputFormat`, etc.
- `BufferTarget` or `FileSystemWritableFileStreamTarget` for saving
- Video/audio encoding configuration (bitrate, quality, codec)
- Progress tracking with `conversion.onProgress`
- Format-specific options and codec support

## Features to Implement

### Feature 1: MediaBunny Conversion Setup
**Purpose**: Initialize MediaBunny for video export operations

**Requirements**:
- **Consult**: mediabunny-llms-full.md "Converting media files" section
- Set up Conversion with Input from editing timeline
- Configure Output with target format
- Apply editing operations (trim, effects) during conversion
- **Reference**: Complete conversion examples in mediabunny-llms-full.md

### Feature 2: Export Dropdown Menu
**Purpose**: Provide multiple export options from top navigation

**Requirements**:
- **Export Button**: [📤 Export ▾] in top navigation bar (right side)
- **Dropdown Menu** with three options:
  1. **💾 Export Video (Download)**: Render and download video file
  2. **📚 Export to Media Library**: Save rendered video to Media Library for reuse
  3. **📋 Export JSON**: Export project configuration as reusable template
- Clicking an option opens corresponding modal/dialog
- Apply Dark Neobrutalism theme to dropdown
- Close dropdown when option selected or user clicks outside

### Feature 3: Export Video Modal (Enhanced)
**Purpose**: Configure video export settings for download

**Requirements**:
- Modal dialog with export options
- Format selection dropdown
- Quality/resolution options
- Filename input
- Export button
- This is the existing video export functionality

### Feature 4: Export to Media Library
**Purpose**: Save rendered video to Media Library for reuse in other projects

**Requirements**:
- Use same conversion process as Feature 3
- After rendering completes, save to Media Library instead of downloading
- Prompt for video name/title
- Add to "📹 Videos" category in Media Library
- Success message: "Video saved to Media Library"
- Option to "Open in new project" or "Close"

### Feature 5: Export JSON
**Purpose**: Export project configuration for reusable templates

**Requirements**:
- **Project Name Prompt**: Modal asking user to enter custom `projectName`
- Default to current project name if already set
- Placeholder: "Enter template name (e.g., Wedding Video Template)"
- **JSON Structure**: Complete project data:
  ```json
  {
    "projectId": "uuid-v4",
    "projectName": "User-provided name",
    "version": "1.0",
    "created": "ISO timestamp",
    "modified": "ISO timestamp",
    "canvas": {"resolution": "...", "fps": 30, "duration": 30},
    "timeline": {"tracks": [...]},
    "effects": {"global": [], "presets": [...]},
    "export": {"format": "mp4", "quality": "high", "bitrate": "8000k"}
  }
  ```
- **Download JSON**: Save as `{projectName}.json`
- **Success Message**: "Project exported! You can import this JSON to reuse settings."
- **Instructions**: Brief tooltip on how to import (via [📥 Import] button)

### Feature 6: Format Options
**Purpose**: Choose output video format using MediaBunny

**Requirements**:
- **Consult**: mediabunny-llms-full.md for output formats and codecs
- MP4 with H.264 codec (most compatible) - Use `Mp4OutputFormat`
- WebM with VP9 codec (modern browsers) - Use `WebMOutputFormat`
- Other formats as supported by MediaBunny
- Default to MP4
- **Reference**: "Output formats" and "Supported formats and codecs" in mediabunny-llms-full.md

### Feature 7: Quality Settings
**Purpose**: Control output quality using MediaBunny encoding options

**Requirements**:
- **Consult**: mediabunny-llms-full.md for video encoding configuration
- Low (720p) - Use lower bitrate or `QUALITY_LOW`
- Medium (1080p) - Use `QUALITY_MEDIUM` or balanced bitrate
- High (1080p, high quality) - Use `QUALITY_HIGH` or custom high bitrate
- Custom resolution option using `width` and `height` in conversion video options
- Estimated file size display (calculate from bitrate × duration)
- **Reference**: "Video options" and "subjective qualities" in converting media files section

### Feature 8: Progress Indicator
**Purpose**: Show rendering progress using MediaBunny conversion tracking

**Requirements**:
- **Consult**: mediabunny-llms-full.md for conversion progress monitoring
- Use `conversion.onProgress` callback to track conversion progress
- Progress bar (0-100%) from progress value
- Percentage complete text
- Estimated time remaining (calculate from progress rate)
- Cancel button using `conversion.cancel()`
- Progress updates propagate from MediaBunny conversion
- **Reference**: "Monitoring progress" in converting media files section

### Feature 9: Download Rendered File
**Purpose**: Save exported video using MediaBunny targets

**Requirements**:
- **Consult**: mediabunny-llms-full.md for output targets
- Use `BufferTarget` to get ArrayBuffer then download via blob URL
- OR use `FileSystemWritableFileStreamTarget` to save directly
- After `conversion.execute()` completes, access `output.target.buffer`
- Create blob URL and trigger download with specified filename
- Success message when download completes
- Option to export another video
- **Reference**: "Writing media files" targets section in mediabunny-llms-full.md

## Testing Checklist
- [ ] MediaBunny Conversion initializes correctly
- [ ] Export dropdown button appears in top navigation
- [ ] Dropdown shows all three export options
- [ ] **Export Video (Download)**: Dialog works with format/quality options
- [ ] **Export to Media Library**: Prompts for name and saves to library
- [ ] **Export JSON**: Prompts for project name and downloads JSON
- [ ] Can select different output formats (MP4, WebM)
- [ ] Progress bar updates during video conversion
- [ ] File downloads successfully after conversion
- [ ] Exported video plays correctly with applied edits
- [ ] JSON export has correct structure and can be saved
- [ ] JSON includes user-provided project name

## Done When
✅ Export dropdown menu implemented with three options  
✅ Video export (download) works using MediaBunny  
✅ Export to Media Library saves rendered video  
✅ JSON export prompts for project name and downloads  
✅ MediaBunny Conversion integration complete  
✅ Progress feedback works  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 30 | **Component**: Editor  
**Estimated Time**: 70-100 minutes

