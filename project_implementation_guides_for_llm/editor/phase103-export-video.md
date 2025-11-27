# Phase 103: Export Video Download

## Goal
Render the timeline to a video file and download it

## Group
**Export**

## Feature to Implement

### ONE Feature: Video Export
**Purpose**: The final output of the editor

**Requirements**:

#### 1. What to Build
- **Trigger**: "Export Video" button in Export Menu (Phase 31).
- **UI**:
    - Modal or Panel overlay.
    - **Settings**:
        - Format: MP4 (default), WebM.
        - Quality: High, Medium, Low.
        - Resolution: 1080p, 720p.
    - **Action**: "Start Export" button.
    - **Progress**: Progress bar (0-100%) and "Rendering..." text.
- **Logic**:
    - Initialize `MediaBunny.Conversion`.
    - Configure `Mp4OutputFormat` / `WebMOutputFormat`.
    - Start conversion.
    - On complete: Trigger browser download.

#### 2. MediaBunny Integration
- **CRITICAL**: This is the core engine function.
- `conversion = new Conversion(timeline, outputFormat)`
- `conversion.start()`
- `conversion.onProgress((p) => updateProgressBar(p))`
- `conversion.onComplete((blob) => download(blob))`

#### 3. Files to Create/Modify
- `assets/js/export/video-export.js`
- `assets/js/export/export-modal.js`

#### 4. What NOT to Do
- ❌ Do NOT implement server-side rendering. Client-side only (WASM).

## Testing Checklist
- [ ] Export modal opens
- [ ] Start button triggers conversion
- [ ] Progress bar updates
- [ ] File downloads upon completion
- [ ] Video plays correctly in external player

## Done When
✅ Can export a playable video file  
✅ Progress feedback works  
✅ Ready for Phase 98
