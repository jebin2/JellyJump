# Phase 47: Drag Media Setup

## Goal
Make tiles draggable, drag cursor, visual feedback, drag data (drop in Phase 66)

## Group
**Media Library**

## Feature to Implement

### ONE Feature: Drag Media Tiles
**Purpose**: Enable dragging media tiles from library (actual drop to timeline in Phase 66)

**Requirements**:

#### 1. What to Build
Make media tiles draggable:
- Add `draggable="true"` to tiles
- Implement drag start event
- Custom drag cursor/ghost image
- Visual feedback during drag
- Store drag data (media ID, type)
- Note: Drop functionality in Phase 66 (timeline)

#### 2. Draggable Attribute
Make tiles draggable:
- Add `draggable="true"` to each media tile element
- Only for videos, audio, and images (not text, effects for now)
- Tiles should show drag cursor on hover

#### 3. Drag Start Event
When drag starts (`dragstart` event):
1. Get media item ID from tile (`data-media-id`)
2. Get media type (video, audio, image)
3. Store in drag event dataTransfer:
   - `event.dataTransfer.setData('mediaId', id)`
   - `event.dataTransfer.setData('mediaType', type)`
4. Set drag effect: `event.dataTransfer.effectAllowed = 'copy'`
5. Add visual feedback to tile (dim or highlight)
6. Set custom drag image (optional)
7. Log to console: "Dragging: filename.mp4"

#### 4. Drag Cursor
Change cursor during drag:
- Use `cursor: grab` when hovering over tile
- Use `cursor: grabbing` when dragging
- CSS cursor property handles this automatically with `draggable="true"`

#### 5. Custom Drag Image (Optional)
For better UX, set custom drag ghost:
- Create preview element (small version of tile)
- Include thumbnail + filename
- Use `event.dataTransfer.setDragImage(element, x, y)`

Example:
```javascript
const dragPreview = tile.cloneNode(true);
dragPreview.style.opacity = '0.8';
event.dataTransfer.setDragImage(dragPreview, 50, 50);
```

Recommendation: **Default drag image is fine** for v1, custom optional.

#### 6. Visual Feedback During Drag
When dragging:
- **Source tile**: Dim opacity to 0.5, add dashed border
- **Other tiles**: Normal (no change)
- **On drag end**: Restore tile to normal state

CSS classes:
- `.media-tile--dragging` for tile being dragged
- Remove class on `dragend` event

#### 7. Drag Data Transfer
Store essential data in dataTransfer:
```javascript
event.dataTransfer.setData('application/x-mediabunny-media', JSON.stringify({
  id: mediaId,
  type: mediaType,  // 'video', 'audio', 'image'
  name: filename,
  duration: duration,  // for videos/audio
  width: width,        // for videos/images
  height: height       // for videos/images
}));
```

Use custom MIME type to ensure only timeline accepts drops (Phase 66).

Alternative simpler approach:
```javascript
event.dataTransfer.setData('text/plain', mediaId);
// Retrieve full data from IndexedDB in Phase 66
```

Recommendation: **Simple approach** - just store media ID, fetch full data on drop.

#### 8. Drag End Event
When drag ends (`dragend` event):
- Remove `.media-tile--dragging` class
- Restore tile opacity to 1.0
- No other action needed (drop handled in Phase 66)

#### 9. Multi-Item Drag (Skip for Now)
For future enhancement:
- Drag multiple selected tiles at once
- Not needed in this phase - single tile drag only

#### 10. Edge Cases
- **Drag cancelled** (Esc key): Restore tile, no action
- **Drag outside valid drop zone**: No action, tile returns to normal
- **Rapid drag attempts**: Ensure clean state transitions
- **Drag while search active**: Works normally

#### 11. Accessibility
Dragging not keyboard accessible by default:
- Provide alternative: Select tile + button to "Add to Timeline"
- OR: Keyboard shortcut (e.g., Ctrl+Enter) to add selected tile to timeline
- This alternative can be added in Phase 66

For now:
- Focus on mouse/touch drag
- Ensure tiles still selectable via keyboard (Phase 45)

#### 12. Touch/Mobile Support
For touch devices:
- HTML5 drag-and-drop has limited touch support
- May need touch event handlers (`touchstart`, `touchmove`, `touchend`)
- OR: Use library like interact.js (if needed)

Recommendation: **Desktop-first** - touch support can be added later.

#### 13. Styling Requirements
Apply Dark Neobrutalism theme:
- Dragging tile: 50% opacity, dashed border
- Cursor: `grab` on hover, `grabbing` while dragging
- Drag image: Semi-transparent version of tile
- Smooth CSS transitions

#### 14. Integration with Phase 45
Extend existing tile elements:
- Add `draggable="true"` attribute
- Add drag event listeners
- Apply dragging class during drag

#### 15. Files to Create/Modify
- `editor.html` - Add `draggable="true"` to tile elements
- `assets/css/editor.css` - Add dragging state styles
- `assets/js/media-library.js` - Add drag event handlers
- `assets/js/drag-handler.js` - Optional: separate module for drag logic

#### 16. JavaScript Organization
Extend MediaLibrary class:
- `attachDragHandlers()` - Add drag event listeners to tiles
- `onDragStart(event)` - Handle drag start
- `onDragEnd(event)` - Handle drag end
- `setDragData(event, mediaItem)` - Set dataTransfer data
- `createDragPreview(tile)` - Optional: custom drag image

#### 17. Data Attributes
- `draggable="true"` on tile elements
- `data-media-id="[UUID]"` on tiles (already exists from Phase 45)
- `data-media-type="video|audio|image"` on tiles (already exists)

#### 18. What NOT to Do
- ❌ Do NOT implement drop functionality (that's Phase 66 - drop to timeline)
- ❌ Do NOT implement drag-to-reorder in media library
- ❌ Do NOT implement multi-tile drag (Shift+Click to select multiple)
- ❌ Do NOT implement drag-to-delete
- This phase is **drag start/end ONLY**, drop comes later

**MediaBunny Integration**: Not applicable for drag setup

## References
- **Phase 45**: Tile display (will add drag to these tiles)
- **Phase 66**: Drop onto timeline functionality
- **HTML5 Drag-and-Drop API**: Use built-in browser API

## Testing Checklist
- [ ] Tiles show `draggable="true"` attribute
- [ ] Cursor changes to "grab" on tile hover
- [ ] Can initiate drag by clicking and holding tile
- [ ] Cursor changes to "grabbing" during drag
- [ ] Tile becomes semi-transparent (50%) while dragging
- [ ] Tile has dashed border while dragging
- [ ] Drag data stored in event.dataTransfer
- [ ] Console logs "Dragging: filename.mp4"
- [ ] Release drag restores tile to normal state
- [ ] `dragend` event fires when drag completes
- [ ] Esc key cancels drag, restores tile
- [ ] Can drag videos, audio, and images
- [ ] Drag works across all media categories
- [ ] No console errors
- [ ] Smooth visual transitions

## Done When
✅ Tiles are draggable  
✅ Drag cursor changes correctly  
✅ Visual feedback during drag (opacity, border)  
✅ Drag data stored in dataTransfer  
✅ Drag end restores tile state  
✅ All tests pass  
✅ Ready for Phase 48 (Preview Panel Structure)

---
**Phase**: 47 | **Component**: Editor | **Group**: Media Library  
**Estimated Time**: 20 min

## Implementation Notes
- HTML5 drag-and-drop API is built into browsers
- Store minimal data in dataTransfer (just media ID)
- Actual drop and timeline placement in Phase 66
- Custom drag image optional but nice UX enhancement
- This completes the Media Library group (Phases 38-47)!
- Keyboard alternative for accessibility in Phase 66
