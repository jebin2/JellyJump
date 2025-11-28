# Phase 09: MediaBunny Setup

## Goal
Install and configure MediaBunny library, create configuration file.

**MediaBunny Note**: Consult `mediabunny-llms-full.md` for installation methods, API initialization, and configuration options.

---

## What to Build

MediaBunny foundation:
- Library installation (npm or CDN)
- Configuration file with default settings
- CorePlayer class initialization
- Test video playback verification

---

## Features to Implement

### Feature 1: MediaBunny Library Installation
**Purpose**: Install and initialize the MediaBunny library for video operations

**Requirements**:
- **Consult**: `mediabunny-llms-full.md` for installation methods (npm or CDN)
- Choose appropriate installation method for vanilla JS project
- Verify MediaBunny is properly loaded and accessible
- Test basic initialization to ensure no loading errors
- **Reference**: Installation guide in mediabunny-llms-full.md

### Feature 2: Configuration File
**Purpose**: Set up MediaBunny configuration for the player

**Requirements**:
- Create player configuration file
- **Consult**: mediabunny-llms-full.md for supported formats and codecs
- Configure default playback settings
- Export configuration for use across components
- **Reference**: Format and codec documentation in mediabunny-llms-full.md

### Feature 3: Project File Structure
**Purpose**: Organize core player component files

**Requirements**:
- Create `core/` directory for player component
- Create `CorePlayer.js` (main player class)
- Create `CorePlayer.css` (player styles)
- Create `config.js` (MediaBunny configuration)
- Organize imports and module structure

### Feature 4: Initialize and Test Playback
**Purpose**: Create player component and test MediaBunny playback

**Requirements**:
- Create CorePlayer class/component
- **Consult**: mediabunny-llms-full.md "Reading media files" section
- Initialize MediaBunny for video playback
- Test with a sample video file
- Verify playback works correctly
- **Reference**: Reading media files guide in mediabunny-llms-full.md

---

## MediaBunny Integration

This phase requires MediaBunny library setup.

**Consult `mediabunny-llms-full.md`** for:
- Installation methods (npm, CDN, ESM)
- Basic initialization patterns
- Input creation and BlobSource usage
- Format detection and validation

**Suggested approach**: Use CDN for simplicity in vanilla project, or npm if using build tools. Initialize MediaBunny in CorePlayer constructor.

---

## Testing Checklist

- [ ] MediaBunny library loads without errors
- [ ] Configuration file created and exports properly
- [ ] CorePlayer class instantiates successfully
- [ ] Test video can be loaded using MediaBunny
- [ ] Video plays when using MediaBunny playback API
- [ ] No console errors during initialization
- [ ] File structure is organized

---

## Done When

✅ MediaBunny library installed and accessible  
✅ Configuration file created  
✅ CorePlayer class structure in place  
✅ Test video plays successfully  
✅ Project file structure organized  
✅ Ready for Phase 10 (adding controls)

---

**Phase**: 09 | **Component**: Core  
**Estimated Time**: 20-30 minutes  
**Complexity**: Low-Medium
