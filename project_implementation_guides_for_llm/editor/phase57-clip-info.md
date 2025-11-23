# Phase 57: Selected Clip Info

## Goal
Show clip metadata, update when clip selected

## Group
**Properties Panel**

## Feature to Implement

### ONE Feature: Clip Information Display
**Purpose**: Display metadata and information about the currently selected clip

**Requirements**:

#### 1. What to Build
Add clip info display to "Clip Info" section:
- Clip name/filename
- Duration
- Start time on timeline
- End time on timeline
- Source media type (video/audio/image)
- Resolution (for videos/images)
- Optional: File size, codec

#### 2. Information to Display
Show these fields:

**Required**:
1. **Name**: Filename or custom name
2. **Type**: Video, Audio, or Image
3. **Duration**: Clip length (e.g., "0:05", "0:15")
4. **Start**: Position on timeline (e.g., "0:00", "0:30")
5. **End**: End position on timeline (e.g., "0:05", "0:45")

**Optional** (for videos/images):
6. **Resolution**: 1920x1080
7. **FPS**: 30fps (videos only)
8. **Size**: File size in MB

#### 3. Display Format
Layout options:

**Option A - Label-Value Pairs**:
```
Name:     Beach_vacation.mp4
Type:     Video
Duration: 0:15
Start:    0:30
End:      0:45
```

**Option B - Inline**:
```
Beach_vacation.mp4 (Video)
0:15 • 0:30 - 0:45 • 1920x1080
```

Recommendation: **Option A - Label-Value Pairs** (clearer).

#### 4. Layout Structure
Structure within "Clip Info" section:
- Use grid or flexbox for label-value pairs
- Labels: Right-aligned or left-aligned, bold
- Values: Left-aligned, normal weight
- Row spacing: 8-12px
- Font size: 13-15px

#### 5. Getting Clip Data
When clip selected (Phase 73):
1. Get selected clip ID
2. Retrieve clip object from timeline state
3. Extract metadata:
   - Name from clip data
   - Type from clip.sourceType
   - Duration: clip.endTime - clip.startTime
   - Start: clip.startTime on timeline
   - End: clip.endTime on timeline
   - Resolution/FPS: From source media (IndexedDB)

#### 6. Update on Selection
When user selects clip:
- Hide empty state (Phase 55)
- Show properties panel content
- Populate "Clip Info" section with clip data
- Expand "Clip Info" section if collapsed

When clip deselected:
- Clear clip info values
- Show empty state again

#### 7. Time Formatting
Use same time formatter from Phase 51:
- Format: "M:SS" or "H:MM:SS"
- Examples: "0:05", "1:23", "1:23:45"
- Consistent formatting across editor

#### 8. Clip Name Editing (Optional for this phase)
For now: Display name as read-only text

Future enhancement:
- Click to edit name
- Inline editing
- Save to clip data

Recommendation: **Read-only for this phase**, editing later.

#### 9. Resolution & FPS Display
For video clips:
- Get resolution from source media metadata (IndexedDB)
- Get FPS from source media
- Display as "1920x1080 @ 30fps"
- OR: Separate rows

For audio/image clips:
- Skip resolution/FPS (or adapt for images: show dimensions)

#### 10. Styling Requirements
Apply Dark Neobrutalism theme:
- Labels: Bold, secondary text color
- Values: Normal weight, primary text color
- Spacing: Adequate padding/margin between rows
- Background: Transparent or subtle
- No thick borders (keep it subtle within section)
- BEM naming: `.clip-info`, `.clip-info__field`, `.clip-info__label`, `.clip-info__value`

#### 11. Edge Cases
- **No clip selected**: Show empty state (Phase 55)
- **Clip data missing**: Show "Unknown" or "--" for missing fields
- **Very long filename**: Truncate with ellipsis, show tooltip with full name
- **Image clip**: Skip duration/FPS, show dimensions
- **Audio clip**: Skip resolution, show duration

#### 12. Accessibility
- Use semantic HTML: `<dl>` (description list) for label-value pairs
  - Labels: `<dt>` (term)
  - Values: `<dd>` (definition)
- OR: Table structure with headers
- Each field should be readable by screen readers
- Update announced when clip changes (live region)

#### 13. Integration with Timeline (Future)
Phase 73+ will:
- Trigger clip selection
- Pass clip data to properties panel
- Update clip info when different clip selected

For this phase: Mock with sample data or wait for P hase 73.

#### 14. Files to Create/Modify
- `editor.html` - Add clip info fields to "Clip Info" section
- `assets/css/editor.css` - Add clip info styles
- `assets/js/properties-panel.js` - Add updateClipInfo() method
- `assets/js/timeline.js` - Will call updateClipInfo() in Phase 73

#### 15. JavaScript Organization
Extend PropertiesPanel class:
- `updateClipInfo(clipData)` - Populate clip info fields
- `clearClipInfo()` - Clear all values
- `formatClipDuration(duration)` - Format time
- `getClipName(clipData)` - Extract name
- `getSourceMetadata(clipData)` - Get resolution/FPS from IndexedDB

#### 16. Data Attributes
- `data-clip-field="name"` on name field
- `data-clip-field="duration"` on duration field
- etc. for each field

#### 17. What NOT to Do
- ❌ Do NOT add clip name editing (read-only for now)
- ❌ Do NOT add clip deletion button (comes later as toolbar action)
- ❌ Do NOT add clip duplication or other actions
- ❌ Do NOT add thumbnail preview (keep it simple)
- This phase is **clip info display ONLY**

**MediaBunny Integration**: May use metadata from Player if clip loaded in preview

## References
- **Phase 41-43**: Source media metadata stored in IndexedDB
- **Phase 51**: Time formatting function (reuse)
- **Phase 56**: "Clip Info" collapsible section (content goes here)
- **Phase 73**: Clip selection triggers update

## Testing Checklist
- [ ] "Clip Info" section contains clip metadata fields
- [ ] Name field displays clip filename
- [ ] Type field displays media type (Video/Audio/Image)
- [ ] Duration formatted correctly (M:SS format)
- [ ] Start time displays clip position on timeline
- [ ] End time displays clip end position on timeline
- [ ] Resolution shown for video clips (1920x1080)
- [ ] FPS shown for video clips (30fps)
- [ ] Fields update when different clip selected (manual test or Phase 73)
- [ ] Long filename truncates with ellipsis
- [ ] Tooltip shows full filename on hover (if truncated)
- [ ] Label-value layout clear and readable
- [ ] Adequate spacing between fields
- [ ] Text readable with good contrast
- [ ] Empty values show "--" or "Unknown"
- [ ] No console errors

## Done When
✅ Clip info fields created in "Clip Info" section  
✅ Name, type, duration, start, end displayed  
✅ Resolution and FPS shown for videos  
✅ Time formatting applied  
✅ Layout clean and readable  
✅ Ready to receive clip data from Phase 73  
✅ All tests pass  
✅ Ready for Phase 58 (Volume Slider Control)

---
**Phase**: 57 | **Component**: Editor | **Group**: Properties Panel  
**Estimated Time**: 20 min

## Implementation Notes
- Use description list (`<dl>`) for semantic label-value pairs
- Reuse time formatter from Phase 51
- Get source metadata from IndexedDB (Phases 41-43)
- Clip data comes from timeline (Phase 73 will trigger this)
- For now, can use mock data to test layout
- Read-only display; editing comes in future enhancements
