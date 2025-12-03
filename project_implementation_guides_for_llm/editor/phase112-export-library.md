# Phase 104: Export to Library

## Goal
Save the rendered video back to the Media Library

---

## What to Build

Export to library:
- Save to media library option
- Auto-add exported video
- Generate thumbnail
- Store metadata
- Quick re-import
- Version management

---

## Feature to Implement

### ONE Feature: Save to Library
**Purpose**: Use the output of one project as input for another (nested comps)

**Requirements**:

#### 1. What to Build
- **UI**: Checkbox in Export Modal: "Add to Media Library".
- **Logic**:
    - After conversion completes (Phase 97):
    - Take the resulting `Blob`.
    - Create a new `MediaItem` (Video).
    - Store in IndexedDB (Phase 41).
    - Refresh Media Panel.

#### 2. Interaction
- User checks box -> Exports -> New video appears in "Videos" tab.

#### 3. Files to Create/Modify
- `assets/js/export/video-export.js`

#### 4. What NOT to Do
- ❌ Do NOT implement automatic re-import without user consent.

---

## Testing Checklist Checklist
- [ ] Checkbox works
- [ ] Exported video appears in library
- [ ] Can be dragged to timeline immediately

---

## Done When
✅ Can export directly to library  
✅ Ready for Phase 99
