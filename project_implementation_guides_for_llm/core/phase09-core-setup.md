# Phase 09: MediaBunny Setup

## Goal
Install and configure MediaBunny library, create configuration file

## What to Implement

**This phase should result in**: MediaBunny initialized, test video plays

### Key Requirements

### Feature 1: MediaBunny Library
- Import via CDN (ESM):
  ```html
  <script type="module">
    import mediabunny from 'https://cdn.jsdelivr.net/npm/mediabunny@1.25.1/+esm'
  </script>
  ```
- Verify `mediabunny` object availability in console
- Ensure no loading errors

### Feature 2: Configuration
- Create config file
- Set defaults
- Export settings

### Feature 3: File Structure
- Create directories
- Organize files

### Feature 4: Initialize
- Create CorePlayer class
- Test playback
