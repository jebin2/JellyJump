# Phase 11: Core Media Features

## Goal
Add subtitle support, audio track switching, and quality selection.

## Features to Implement

### Feature 1: Subtitle Loading System
**Purpose**: Load external subtitle files and add to video

**Requirements**:
- Support VTT format (primary standard)
- Support SRT format (convert to VTT if needed)
- Accept subtitle file URL or file object
- Parse subtitle content into cues
- Add as text track to video element
- Handle loading errors gracefully

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

### Feature 4: Audio Track Switching
**Purpose**: Switch between audio tracks if video has multiple

**Requirements**:
- Detect available audio tracks using **MediaBunny**
- Menu showing all audio track options
- Label tracks by language or descriptive name
- Switch tracks seamlessly during playback
- Indicate currently active audio track
- Only show if multiple audio tracks available

### Feature 5: Quality Selector
**Purpose**: Choose video quality level if multiple streams available

**Requirements**:
- 'Auto' quality option as default (adaptive)
- List available quality levels (480p, 720p, 1080p, etc.)
- Switch quality when user selects different level
- Show current quality in UI
- Handle quality transitions smoothly (may cause brief buffering)
- Only show if multiple quality streams exist

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
