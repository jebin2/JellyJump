# Phase 11: Core Media Features

## Goal
Add subtitle support, audio track switching, and quality selection with controller UI integration.

**Note**: This phase includes both backend media handling AND controller UI for subtitles and audio tracks.

## Features to Implement

### Feature 1: Subtitle Loading System
**Purpose**: Load external subtitle files using MediaBunny

**Requirements**:
- **Consult**: mediabunny-llms-full.md for subtitle track handling
- Support VTT format (primary standard)
- Support SRT format (convert to VTT if needed)
- Accept subtitle file URL or file object
- Parse subtitle content into cues using MediaBunny capabilities
- Add as text track to video element
- Handle loading errors gracefully
- **Reference**: Track management and subtitle features in mediabunny-llms-full.md

### Feature 2: Subtitle Display Toggle
**Purpose**: Control subtitle visibility on/off

**Requirements**:
- Subtitle toggle button in control bar
- 'CC' icon or text label on button
- Toggle text track mode between 'showing' and 'hidden'
- Remember user's subtitle preference
- Show active state when subtitles enabled
- Apply theme button styling

### Feature 3: Subtitle Track Selector
**Purpose**: Choose between multiple subtitle languages

**Requirements**:
- Dropdown or menu listing available subtitle tracks
- Show language name/label for each track
- Include 'Off' option to disable all subtitles
- Highlight currently active track
- Switch tracks without interrupting playback
- Close menu after selection

### Feature 3b: SRT/VTT File Upload Button
**Purpose**: Allow users to upload external subtitle files

**Requirements**:
- Upload button near subtitle toggle in controller
- Icon: 📄 or "Add Captions"
- Opens file picker for .srt or .vtt files
- Loads selected file using Feature 1's loading system
- Adds uploaded subtitle as new track
- Auto-enable newly uploaded subtitle
- Show feedback when subtitle loaded successfully
- Apply theme button styling

### Feature 4: Audio Track Switching
**Purpose**: Switch between audio tracks using MediaBunny with controller UI

**Requirements**:
- **Consult**: mediabunny-llms-full.md for audio track detection and switching
- **Audio track button/icon in controller** (🔊 or "Audio")
- Detect available audio tracks using MediaBunny track API
- Dropdown menu showing all audio track options
- Label tracks by language or descriptive name (e.g., "English", "Spanish")
- Switch tracks seamlessly during playback using MediaBunny methods
- Highlight/check currently active audio track in menu
- Only show button if multiple audio tracks available (hide for single track)
- Close menu after selection
- Apply theme styling to button and dropdown
- **Reference**: Reading track metadata and input formats in mediabunny-llms-full.md

### Feature 5: Quality Selector
**Purpose**: Choose video quality level using MediaBunny

**Requirements**:
- **Consult**: mediabunny-llms-full.md for video track and quality management
- 'Auto' quality option as default (adaptive)
- List available quality levels (480p, 720p, 1080p, etc.)
- Switch quality when user selects different level using MediaBunny
- Show current quality in UI
- Handle quality transitions smoothly (may cause brief buffering)
- Only show if multiple quality streams exist
- **Reference**: Video track handling in mediabunny-llms-full.md

## Testing Checklist
- [ ] Subtitles load and display correctly
- [ ] CC toggle turns subtitles on/off
- [ ] Track selector changes subtitle language
- [ ] Audio tracks switch correctly (if available)
- [ ] Quality selector changes stream quality
- [ ] UI elements hidden if feature unavailable

## Done When
✅ Subtitles work  
✅ Audio/Quality switching works  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 11 | **Component**: Core
**Estimated Time**: 30-50 minutes
