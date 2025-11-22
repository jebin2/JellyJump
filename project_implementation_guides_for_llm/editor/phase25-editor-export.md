# Phase 25: Editor Export

## Goal
Export edited video using MediaBunny Conversion API with format/quality options and progress tracking

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

### Feature 2: Export Modal/Dialog
**Purpose**: Configure export settings

**Requirements**:
- Modal dialog with export options
- Format selection dropdown
- Quality/resolution options
- Filename input
- Export button

### Feature 3: Format Options
**Purpose**: Choose output video format using MediaBunny

**Requirements**:
- **Consult**: mediabunny-llms-full.md for output formats and codecs
- MP4 with H.264 codec (most compatible) - Use `Mp4OutputFormat`
- WebM with VP9 codec (modern browsers) - Use `WebMOutputFormat`
- Other formats as supported by MediaBunny
- Default to MP4
- **Reference**: "Output formats" and "Supported formats and codecs" in mediabunny-llms-full.md

### Feature 4: Quality Settings
**Purpose**: Control output quality using MediaBunny encoding options

**Requirements**:
- **Consult**: mediabunny-llms-full.md for video encoding configuration
- Low (720p) - Use lower bitrate or `QUALITY_LOW`
- Medium (1080p) - Use `QUALITY_MEDIUM` or balanced bitrate
- High (1080p, high quality) - Use `QUALITY_HIGH` or custom high bitrate
- Custom resolution option using `width` and `height` in conversion video options
- Estimated file size display (calculate from bitrate × duration)
- **Reference**: "Video options" and "subjective qualities" in converting media files section

### Feature 5: Progress Indicator
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

### Feature 6: Download Rendered File
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
- [ ] Export dialog works with format/quality options
- [ ] Can select different output formats (MP4, WebM)
- [ ] Progress bar updates during conversion
- [ ] File downloads successfully after conversion
- [ ] Exported video plays correctly with applied edits

## Done When
✅ Export functionality works using MediaBunny  
✅ MediaBunny Conversion integration complete  
✅ Progress feedback works  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 25 | **Component**: Editor
**Estimated Time**: 60-90 minutes
