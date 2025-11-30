# Phase File Generator for Editor (Phases 27-103)
# Run this script to generate all 77 granular phase files

$phases = @(
    @{num=27; name="navigation-bar"; title="Top Navigation Bar Structure"; group="Navigation"; est="15-20 min"; 
      desc="Create fixed top bar with branding, menu placeholders, styling and positioning"},
    
    @{num=28; name="file-menu"; title="File Menu Dropdown"; group="Navigation"; est="20 min";
      desc="Implement File menu dropdown with New, Open, Save, Save As options and toggle logic"},
    
    @{num=29; name="edit-menu"; title="Edit Menu Dropdown"; group="Navigation"; est="15 min";
      desc="Implement Edit menu dropdown with Undo, Redo, Cut, Copy, Paste options"},
    
    @{num=30; name="import-media"; title="Import Media Button"; group="Navigation"; est="25 min";
      desc="File picker for videos/audio/images, add to media library IndexedDB, success notification"},
    
    @{num=31; name="export-dropdown"; title="Export Dropdown Menu"; group="Navigation"; est="15 min";
      desc="Export dropdown UI with Video, Library, JSON options (functionality in later phases)"},
    
    @{num=32; name="tab-bar"; title="Tab Bar Structure"; group="Tab Management"; est="15 min";
      desc="Create tab container below top nav with [+] button visual"},
    
    @{num=33; name="create-tab"; title="Create New Tab"; group="Tab Management"; est="20 min";
      desc="Click [+] to create tab with UUID, default name, max 10 tabs limit"},
    
    @{num=34; name="tab-switching"; title="Tab Switching"; group="Tab Management"; est="20 min";
      desc="Click tab to activate, visual states, load tab's project data"},
    
    @{num=35; name="tab-close"; title="Tab Close Button"; group="Tab Management"; est="15 min";
      desc="[X] button on each tab, remove from UI, switch to adjacent tab"},
    
    @{num=36; name="unsaved-confirmation"; title="Unsaved Changes Confirmation"; group="Tab Management"; est="25 min";
      desc="Show dialog on close if unsaved, Save/Don't Save/Cancel buttons"},
    
    @{num=37; name="tab-persistence"; title="Tab Persistence"; group="Tab Management"; est="20 min";
      desc="Save tab list to localStorage, restore tabs on page load"},
    
    @{num=38; name="media-panel"; title="Media Panel Structure"; group="Media Library"; est="10 min";
      desc="Create 20% width left panel container with styling"},
    
    @{num=39; name="vertical-tabs"; title="Vertical Tab Buttons"; group="Media Library"; est="20 min";
      desc="6 vertical tab buttons (Videos, Audio, Images, Text, Effects, Projects) with icons, labels, counts"},
    
    @{num=40; name="tab-switching-media"; title="Vertical Tab Switching"; group="Media Library"; est="20 min";
      desc="Click to show category content, active/inactive states, persist active tab"},
    
    @{num=41; name="upload-videos"; title="Upload Video Files"; group="Media Library"; est="30 min";
      desc="File picker for videos, add to Videos category, store in IndexedDB"},
    
    @{num=42; name="upload-audio"; title="Upload Audio Files"; group="Media Library"; est="20 min";
      desc="File picker for audio, add to Audio category"},
    
    @{num=43; name="upload-images"; title="Upload Image Files"; group="Media Library"; est="20 min";
      desc="File picker for images, add to Images category"},
    
    @{num=44; name="search-media"; title="Search Media Items"; group="Media Library"; est="25 min";
      desc="Search input, filter all categories real-time, highlight results"},
    
    @{num=45; name="tile-display"; title="Tile/Grid Display"; group="Media Library"; est="25 min";
      desc="2-3 tiles per row, filename, duration badge, click to select"},
    
    @{num=46; name="thumbnails"; title="Video Thumbnail Generation"; group="Media Library"; est="35 min";
      desc="MediaBunny VideoSampleSink for first frame, cache in IndexedDB, lazy loading"},
    
    @{num=47; name="drag-media"; title="Drag Media Setup"; group="Media Library"; est="20 min";
      desc="Make tiles draggable, drag cursor, visual feedback, drag data"},
    
    @{num=48; name="preview-panel"; title="Preview Panel Structure"; group="Preview Player"; est="10 min";
      desc="50% width center panel, video container placeholder"},
    
    @{num=49; name="player-integration"; title="MediaBunny Player Integration"; group="Preview Player"; est="30 min";
      desc="Initialize MediaBunny player, load video from selected clip"},
    
    @{num=50; name="play-pause"; title="Play/Pause Controls"; group="Preview Player"; est="20 min";
      desc="Play and Pause buttons, toggle state, Spacebar shortcut"},
    
    @{num=51; name="time-display"; title="Time Display"; group="Preview Player"; est="15 min";
      desc="Current time / Total duration (00:00:05 / 00:00:30), real-time update"},
    
    @{num=52; name="resolution-fps"; title="Resolution & FPS Display"; group="Preview Player"; est="10 min";
      desc="Show video metadata: 1920x1080 @ 30fps"},
    
    @{num=53; name="fullscreen"; title="Full-Screen Toggle"; group="Preview Player"; est="20 min";
      desc="Full-screen button, Fullscreen API, F key shortcut"},
    
    @{num=54; name="properties-panel"; title="Properties Panel Structure"; group="Properties Panel"; est="10 min";
      desc="30% width right panel, container styling"},
    
    @{num=55; name="empty-state"; title="Empty State Display"; group="Properties Panel"; est="10 min";
      desc="'Select a clip to edit' message when nothing selected"},
    
    @{num=56; name="collapsible-sections"; title="Collapsible Section Headers"; group="Properties Panel"; est="25 min";
      desc="6 section headers with expand/collapse, smooth animation, persist state"},
    
    @{num=57; name="clip-info"; title="Selected Clip Info"; group="Properties Panel"; est="20 min";
      desc="Show clip metadata, update when clip selected"},
    
    @{num=58; name="volume-slider"; title="Volume Slider Control"; group="Properties Panel"; est="20 min";
      desc="Volume slider (0-100%), apply to selected clip"},
    
    @{num=59; name="mute-toggle"; title="Mute Toggle Button"; group="Properties Panel"; est="15 min";
      desc="Mute/unmute button, visual feedback"},
    
    @{num=60; name="timeline-container"; title="Timeline Container"; group="Timeline Foundation"; est="10 min";
      desc="Bottom 30% panel, container styling"},
    
    @{num=61; name="timeline-header"; title="Timeline Header"; group="Timeline Foundation"; est="15 min";
      desc="Header with controls, duration, settings, fixed position"},
    
    @{num=62; name="ruler-structure"; title="Time Ruler Structure"; group="Timeline Foundation"; est="10 min";
      desc="Ruler container, background grid"},
    
    @{num=63; name="ruler-markers"; title="Time Ruler Markers"; group="Timeline Foundation"; est="25 min";
      desc="Time markers (0:00, 0:05, etc.), tick marks, update with zoom"},
    
    @{num=64; name="track-container"; title="Track Container"; group="Timeline Foundation"; est="15 min";
      desc="4 track lanes (Video 1, Video 2, Audio, Text) with labels"},
    
    @{num=65; name="edit-toolbar"; title="Edit Toolbar"; group="Timeline Foundation"; est="15 min";
      desc="Toolbar with Cut, Trim, Split buttons (styling only, functionality later)"},
    
    @{num=66; name="drop-media"; title="Drop Media onto Timeline"; group="Timeline Interaction"; est="30 min";
      desc="Drop target for dragged media, calculate clip position, add to track"},
    
    @{num=67; name="clip-rendering"; title="Clip Visual Rendering"; group="Timeline Interaction"; est="20 min";
      desc="Render clips as colored rectangles, show filename"},
    
    @{num=68; name="clip-thumbnails"; title="Clip Thumbnails (Optional)"; group="Timeline Interaction"; est="30 min";
      desc="Show video thumbnail on timeline clip"},
    
    @{num=69; name="playhead-visual"; title="Playhead Visual"; group="Timeline Interaction"; est="15 min";
      desc="Vertical red line at current time position"},
    
    @{num=70; name="playhead-sync"; title="Playhead-Preview Sync"; group="Timeline Interaction"; est="25 min";
      desc="Bidirectional sync between playhead and preview player"},
    
    @{num=71; name="timeline-scrubbing"; title="Timeline Scrubbing"; group="Timeline Interaction"; est="25 min";
      desc="Drag playhead to scrub, update preview in real-time"},
    
    @{num=72; name="timeline-zoom"; title="Timeline Zoom"; group="Timeline Interaction"; est="30 min";
      desc="Zoom buttons (25%-400%), update ruler and clip widths"},
    
    @{num=73; name="select-clip"; title="Click to Select Clip"; group="Clip Selection"; est="20 min";
      desc="Click clip to select, highlight, update Properties panel"},
    
    @{num=74; name="multi-select"; title="Multi-Clip Selection (Optional)"; group="Clip Selection"; est="25 min";
      desc="Ctrl+Click for multi-select, Shift+Click for range select"},
    
    @{num=75; name="trim-handles"; title="Clip Trim Handles"; group="Clip Editing"; est="15 min";
      desc="Resize handles on clip edges, cursor change on hover"},
    
    @{num=76; name="drag-trim"; title="Drag to Trim Clip"; group="Clip Editing"; est="30 min";
      desc="Drag left/right edges to trim start/end, visual feedback"},
    
    @{num=77; name="split-clip"; title="Split Clip at Playhead"; group="Clip Editing"; est="25 min";
      desc="Split button functionality, create two clips from one"},
    
    @{num=78; name="delete-clip"; title="Delete Selected Clip"; group="Clip Editing"; est="20 min";
      desc="Delete key or button, remove from timeline, gap handling"},
    
    @{num=79; name="rearrange-clips"; title="Drag to Rearrange Clips"; group="Clip Editing"; est="35 min";
      desc="Drag clips horizontally/vertically, collision detection"},
    
    @{num=80; name="undo-redo-stack"; title="Undo/Redo Stack"; group="Undo/Redo"; est="35 min";
      desc="Command pattern for all operations, history stack (max 50)"},
    
    @{num=81; name="undo-redo-ui"; title="Undo/Redo UI"; group="Undo/Redo"; est="15 min";
      desc="Ctrl+Z, Ctrl+Y shortcuts, button states"},
    
    @{num=82; name="fade-transition"; title="Fade In/Out Transition"; group="Transitions"; est="30 min";
      desc="Add fade to clip, duration control (0.5s-3s)"},
    
    @{num=83; name="crossfade"; title="Crossfade Transition"; group="Transitions"; est="30 min";
      desc="Crossfade between clips, overlap duration control"},
    
    @{num=84; name="wipe-transition"; title="Wipe Transition"; group="Transitions"; est="30 min";
      desc="Wipe effect with direction options (left, right, up, down)"},
    
    @{num=85; name="brightness-contrast"; title="Brightness/Contrast Filter"; group="Video Filters"; est="25 min";
      desc="Sliders for brightness/contrast, real-time preview"},
    
    @{num=86; name="saturation"; title="Saturation Filter"; group="Video Filters"; est="20 min";
      desc="Saturation slider (0-200%), real-time preview"},
    
    @{num=87; name="grayscale"; title="Grayscale Filter"; group="Video Filters"; est="15 min";
      desc="Toggle grayscale filter on/off"},
    
    @{num=88; name="sepia"; title="Sepia Filter"; group="Video Filters"; est="15 min";
      desc="Toggle sepia tone filter on/off"},
    
    @{num=89; name="add-text"; title="Add Text Clip"; group="Text Overlays"; est="25 min";
      desc="Create text clip, add to Text track, set start/end time"},
    
    @{num=90; name="text-content"; title="Text Content Input"; group="Text Overlays"; est="15 min";
      desc="Text input field, update preview in real-time"},
    
    @{num=91; name="text-styling"; title="Text Styling"; group="Text Overlays"; est="30 min";
      desc="Font family, size, color picker"},
    
    @{num=92; name="text-position"; title="Text Position"; group="Text Overlays"; est="25 min";
      desc="X/Y position sliders, alignment options"},
    
    @{num=93; name="position-xy"; title="Position Controls"; group="Transform"; est="20 min";
      desc="X/Y position sliders, apply to selected clip"},
    
    @{num=94; name="scale"; title="Scale Control"; group="Transform"; est="20 min";
      desc="Scale slider (10%-200%), maintain aspect ratio"},
    
    @{num=95; name="rotation"; title="Rotation Control"; group="Transform"; est="20 min";
      desc="Rotation slider (0-360°), preview update"},
    
    @{num=96; name="opacity"; title="Opacity Control"; group="Transform"; est="15 min";
      desc="Opacity slider (0-100%), preview update"},
    
    @{num=97; name="export-video"; title="Export Video Download"; group="Export"; est="45 min";
      desc="MediaBunny Conversion API, format/quality options, progress bar, download"},
    
    @{num=98; name="export-library"; title="Export to Library"; group="Export"; est="30 min";
      desc="Render and save to media library, add to Videos category"},
    
    @{num=99; name="export-json"; title="Export JSON Project"; group="Export"; est="25 min";
      desc="Serialize timeline to JSON, download .json file"},
    
    @{num=100; name="import-json"; title="Import JSON Project"; group="Project Management"; est="35 min";
      desc="Load .json file, parse and restore timeline state"},
    
    @{num=101; name="auto-save"; title="Auto-Save Project"; group="Project Management"; est="20 min";
      desc="Save to localStorage every 30s, show 'Saving..' indicator"},
    
    @{num=102; name="templates"; title="Project Templates"; group="Project Management"; est="25 min";
      desc="Save current project as template, load from template list"},
    
    @{num=103; name="polish"; title="Keyboard Shortcuts & Polish"; group="Polish"; est="45 min";
      desc="All keyboard shortcuts, performance optimization, cross-browser testing"}
)

$basePath = "c:\Users\jebinwin\Documents\git\JellyJump\project_implementation_guides_for_llm\editor"

foreach ($phase in $phases) {
    $fileName = "phase$($phase.num)-$($phase.name).md"
    $filePath = Join-Path $basePath $fileName
    
    $content = @"
# Phase $($phase.num): $($phase.title)

## Goal
$($phase.desc)

## Group
**$($phase.group)**

## Feature to Implement

### ONE Feature: $($phase.title)
**Purpose**: $($phase.desc)

**Requirements**:
- [LLM: Implement this ONE atomic feature]
- Follow Dark Neobrutalism theme
- Add proper error handling
- Include basic validation
- Test thoroughly

**MediaBunny Integration** (if applicable):
- Consult mediabunny-llms-full.md for video operations
- Use appropriate MediaBunny APIs

## Testing Checklist
- [ ] Feature implemented and functional
- [ ] Styling matches Dark Neobrutalism theme
- [ ] No console errors
- [ ] Works in Chrome, Firefox, Edge
- [ ] Responsive behavior (if applicable)
- [ ] Keyboard shortcuts work (if applicable)

## Done When
✅ $($phase.title) fully functional  
✅ Passes all manual tests  
✅ Integrated with existing code  
✅ Ready for next phase

---
**Phase**: $($phase.num) | **Component**: Editor | **Group**: $($phase.group)  
**Estimated Time**: $($phase.est)
"@
    
    Set-Content -Path $filePath -Value $content
}

Write-Output "Created $($phases.Count) phase files (27-103)"
