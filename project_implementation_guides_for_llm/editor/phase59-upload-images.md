# Phase 49: Upload Image Files

## Goal
File picker for images, add to Images category

---

## What to Build

Upload image files:
- File picker for image formats
- Drag-and-drop zone
- Format validation (PNG, JPG, GIF)
- Image preview thumbnails
- Add to Images tab
- Dimension detection

---

## Feature to Implement

### ONE Feature: Upload Image Files to Media Library
**Purpose**: Add image file upload functionality specifically for the Images category

**Requirements**:

#### 1. What to Build
Add image upload capability to Images category:
- Click or button in Images category to trigger file picker
- Accept only image files (.jpg, .jpeg, .png, .gif, .webp, .svg, .bmp)
- Allow multiple file selection
- Extract image metadata (width, height, file size)
- Store images in IndexedDB
- Update Images count badge
- Display uploaded images in Images category

#### 2. Upload Trigger UI
Add upload button to Images content section:
- Button text: "+ Add Images" or "📥 Import Images"
- Dark Neobrutalism button style
- Positioned at top of Images content area
- Always visible
- Clickable empty state as alternative trigger

#### 3. File Picker Configuration
Configure image file input:
- Accept attribute: `image/*, .jpg, .jpeg, .png, .gif, .webp, .svg, .bmp`
- Multiple: true (allow multiple selection)
- Hidden input, triggered by button click

#### 4. Image Processing Flow
When image files selected:
1. Validate each file is an image type
2. For each valid image:
   - Generate unique UUID
   - Extract metadata: width, height, file size
   - Create image object with metadata
   - Store blob in IndexedDB
   - Add to Images category display
   - Update Images count badge
3. Show success notification: "✅ 5 images added"

#### 5. Metadata Extraction
Use HTML5 Image element to extract dimensions:
- **Width**: Image width in pixels
- **Height**: Image height in pixels
- **Aspect Ratio**: Calculated (width/height)
- **Size**: File size in bytes
- **Format**: File extension (jpg, png, etc.)
- **Filename**: Original filename

**Image metadata approach**:
```javascript
const img = new Image();
img.onload = () => {
  const width = img.naturalWidth;
  const height = img.naturalHeight;
  // Save to IndexedDB
};
img.src = URL.createObjectURL(file);
```

#### 6. IndexedDB Storage
Store images in same database structure:
```
Database: "MediaLibraryDB"
Store: "media"
Object: {
  id: UUID,
  name: filename,
  type: "image",
  blob: Blob,
  size: number (bytes),
  width: number (pixels),
  height: number (pixels),
  aspectRatio: number,
  format: string (jpg, png, etc.),
  dateAdded: timestamp,
  category: "images"
}
```

#### 7. Images Category Update
After successful upload:
- Increment Images count badge: "(0)" → "(5)"
- Add image items to Images content area
- Remove empty state message if showing
- Scroll to show newly added images

#### 8. User Feedback
Provide clear feedback:
- **During upload**: Loading spinner "Importing images..."
- **On success**: "✅ 5 images added to library"
- **On error**: "❌ Failed to import filename.jpg: invalid file"
- **File type error**: "❌ Only image files are supported"
- Notifications auto-dismiss after 3 seconds

#### 9. Image Display (Preview)
For this phase, basic display:
- Show image thumbnail in Images content area
- Thumbnail can be the actual image (blob URL)
- Full tile/grid display comes in Phase 45

Optional: Create small thumbnail (resize to 200x200) to save memory

#### 10. Error Handling
Handle these errors:
- **No file selected**: Do nothing
- **Non-image file**: Skip with error notification
- **Metadata extraction failed**: Still import, use defaults (width: 0, height: 0)
- **IndexedDB error**: Show "Failed to save image"
- **Corrupted image**: Metadata extraction fails, show error, skip file

#### 11. Image Format Support
Support common formats:
- **JPEG/JPG**: Most common, always supported
- **PNG**: Transparency support
- **GIF**: Animated GIF supported
- **WebP**: Modern format, good compression
- **SVG**: Vector format, special handling may be needed
- **BMP**: Older format, less common

Browser handles format support automatically.

#### 12. File Size Considerations
Images can be large:
- **Small** (< 1MB): No issue
- **Medium** (1-5MB): Fine
- **Large** (5-20MB): Warn user but allow
- **Very Large** (> 20MB): Show warning "Large file may impact performance"

Optional: Resize very large images (> 4K) to reduce storage.

#### 13. Duplicate Handling
Same as videos/audio:
- Allow duplicate filenames (create new UUID)
- No warning needed

#### 14. Edge Cases
- **Upload when Videos tab active**: Images still go to Images category
- **Animated GIF**: Treat as normal image, animation preserved in blob
- **SVG format**: Text-based, may have large file size despite small visual size
- **Very high resolution** (> 8K): Allow but warn about performance

#### 15. Accessibility
- Upload button keyboard accessible (Tab, Enter/Space)
- Add `aria-label="Upload images"`
- Announce upload success/error to screen readers
- File input has `aria-label="Select image files"`
- Uploaded images should have `alt` text (filename for now)

#### 16. Files to Create/Modify
- `editor.html` - Add upload button to Images content area
- `editor.html` - Add hidden file input for images
- `assets/js/media-library.js` - Add image upload logic (similar to videos/audio)
- Reuse `assets/js/indexeddb-helper.js`
- `assets/css/editor.css` - Style upload button (reuse existing styles)

#### 17. JavaScript Organization
Extend MediaLibrary class:
- `uploadImages()` - Trigger file picker
- `processImageFiles(files)` - Loop through files
- `extractImageMetadata(file)` - Get width, height
- `saveImageToIndexedDB(imageData)` - Store in database
- `addImageToUI(imageData)` - Add to category display
- `updateImagesCount()` - Increment badge count

**Code Reuse**: Abstract common upload logic shared by videos, audio, images.

#### 18. Data Attributes
- `data-upload="images"` on upload button
- `data-file-input="image-upload"` on hidden file input

#### 19. What NOT to Do
- ❌ Do NOT implement image editing (crop, rotate, filters) - out of scope
- ❌ Do NOT create advanced thumbnail generation (that's Phase 46 for videos)
- ❌ Do NOT implement full tile display yet (that's Phase 45)
- ❌ Do NOT implement search/filter (that's Phase 44)
- ❌ Do NOT resize images automatically (keep original)
- This phase is **image upload ONLY**

**MediaBunny Integration**: Not applicable (images don't need MediaBunny)

## References
- **Phase 41**: Videos upload (same pattern)
- **Phase 42**: Audio upload (same pattern)
- **Phase 30**: Generic import and IndexedDB setup
- **Phase 40**: Images category tab switching
- **Phase 45**: Full tile/grid display for images

---

## Testing Checklist Checklist
- [ ] Click "+ Add Images" button opens file picker
- [ ] File picker accepts only image files (.jpg, .png, .gif, .webp)
- [ ] Can select multiple image files at once
- [ ] Selected images stored in IndexedDB
- [ ] Image metadata extracted (width, height)
- [ ] Images count badge updates: "(0)" → "(5)"
- [ ] Success notification: "✅ 5 images added"
- [ ] Notification auto-dismisses
- [ ] Empty state disappears when images added
- [ ] Non-image files rejected with error
- [ ] Images persist after page reload
- [ ] Different formats supported (JPG, PNG, GIF, WebP)
- [ ] Large images (> 5MB) import successfully
- [ ] Animated GIF preserved correctly
- [ ] Console has no errors
- [ ] Upload button keyboard accessible

---

## Done When
✅ Upload button functional in Images category  
✅ File picker accepts image files only  
✅ Multiple images can be uploaded  
✅ Metadata extracted (width, height)  
✅ Images stored in IndexedDB  
✅ Count badge updates  
✅ Success/error notifications work  
✅ All tests pass  
✅ Ready for Phase 44 (Search Media Items)

---
**Phase**: 49 | **Component**: Editor | **Group**: Media Library  
**Estimated Time**: 20 min

## Implementation Notes
- Very similar to Phase 41-42
- Image metadata extraction is synchronous (simpler than video/audio)
- Use Image() constructor for width/height
- Original image blob stored as-is (no resizing in this phase)
- Can display images directly using blob URLs
- Consider abstracting common upload logic across phases 41-43
