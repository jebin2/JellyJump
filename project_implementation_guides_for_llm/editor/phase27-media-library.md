# Phase 27: Media Library Panel

## Goal
Create left sidebar panel (20% width) for organizing and browsing media assets

## Features to Implement

### Feature 1: Panel Structure
**Purpose**: Left sidebar container with fixed width

**Requirements**:
- Container div with 20% width
- Fixed position or flex layout integration
- Minimum width: 15%, Maximum width: 30%
- Resizable panel (optional drag handle)
- Apply Dark Neobrutalism theme borders
- Scroll if content overflows

### Feature 2: Category Folders
**Purpose**: Organized media categories

**Requirements**:
- Category sections with icons and labels:
  - 📹 Videos
  - 🎵 Audio
  - 🖼️ Images
  - 📝 Text
  - 🎨 Effects
  - 📁 Projects
- Collapsible/expandable sections (optional)
- Item count badges (e.g., "Videos (12)")
- Empty state message when category is empty
- Theme styling for category headers

### Feature 3: Upload & Record Buttons
**Purpose**: Add new media to library

**Requirements**:
- **[+ Upload]** button
  - Opens file picker
  - Accept video, audio, image files
  - Multiple file selection
- **[+ Record]** button (optional)
  - Record from webcam/mic
  - Future enhancement placeholder
- Button styling with Dark Neobrutalism theme
- Loading state during upload
- Success/error notifications

### Feature 4: Search Functionality
**Purpose**: Find media items quickly

**Requirements**:
- **[🔍 Search...]** input field at top/bottom of panel
- Filter items in real-time as user types
- Search across all categories
- Clear search button (X icon)
- Highlight matching results
- Show "No results" message when no matches

### Feature 5: Media Item Display
**Purpose**: Show media files with previews

**Requirements**:
- List view of media items in each category
- Thumbnail preview (for videos/images)
- File name and duration/size
- Hover effects for selection
- Click to select/preview
- Right-click context menu (optional: delete, rename)

### Feature 6: Drag-to-Timeline Setup
**Purpose**: Prepare drag-and-drop for timeline

**Requirements**:
- Make media items draggable
- Show drag cursor on hover
- **Note**: Actual drop-to-timeline functionality implemented in Phase 31
- Visual feedback during drag (semi-transparent clone)
- Drag data includes file reference and metadata

## Testing Checklist
- [ ] Media library panel renders at 20% width
- [ ] All category folders display correctly
- [ ] Item counts update when media added
- [ ] Upload button opens file picker
- [ ] Files can be uploaded to library
- [ ] Search filters items correctly
- [ ] Media items show thumbnails
- [ ] Items are draggable (drag setup only)
- [ ] Panel is resizable (if implemented)
- [ ] Theme styling applied consistently

## Done When
✅ Media library panel structure complete  
✅ Category folders with counts functional  
✅ Upload functionality works  
✅ Search filters items  
✅ Items display with thumbnails  
✅ Drag setup complete (drop handled in Phase 31)  
✅ All tests pass  
✅ Ready for next phase

---
**Phase**: 27 | **Component**: Editor  
**Estimated Time**: 25-35 minutes
