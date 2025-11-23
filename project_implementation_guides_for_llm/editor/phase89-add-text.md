# Phase 89: Add Text Clip

## Goal
Create a new text element on the timeline

## Group
**Text Overlays**

## Feature to Implement

### ONE Feature: Add Text Clip
**Purpose**: Allow users to insert titles and captions

**Requirements**:

#### 1. What to Build
- **Trigger**: "Add Text" button in Media Panel (Text tab) or Toolbar.
- **Action**:
    - Creates a new `Clip` object with `type: 'text'`.
    - Default duration: 5 seconds.
    - Default content: "Your Text Here".
    - Adds to the dedicated **Text Track** (Track 4).
- **Visuals**:
    - Render text clip on timeline (distinct color, e.g., Purple).
    - Show "T" icon or text content on the clip bar.

#### 2. Data Model
- `Clip` object extension:
    - `type`: 'video' | 'image' | 'audio' | 'text'
    - `content`: string
    - `style`: object (font, color, size - defaults)

#### 3. Files to Create/Modify
- `assets/js/timeline-actions.js`
- `assets/js/models/Clip.js` (if exists, or update structure)

#### 4. MediaBunny Integration
- Use `TextNode` (if available) or `CanvasNode` to render text.
- **Strategy**: Create a `CanvasSource` that draws text, then treat it like a video frame.

#### 5. What NOT to Do
- ❌ Do NOT implement rich text editor (bold/italic per character). Global style only.

## Testing Checklist
- [ ] "Add Text" button creates a clip
- [ ] Clip appears on Text track
- [ ] Default text is visible in preview
- [ ] Clip has correct default duration

## Done When
✅ Text clip appears on timeline  
✅ Text renders in preview player  
✅ Ready for Phase 90
