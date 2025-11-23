# Phase 90: Text Content Input

## Goal
Edit the content of a selected text clip

## Group
**Text Overlays**

## Feature to Implement

### ONE Feature: Text Input Field
**Purpose**: Change "Your Text Here" to actual content

**Requirements**:

#### 1. What to Build
- **UI**:
    - In **Properties Panel**, when a Text clip is selected:
    - Show `textarea` or `input[type="text"]`.
    - Label: "Content".
- **Logic**:
    - Bind input value to `clip.content`.
    - Trigger re-render of the preview immediately (on `input` event).

#### 2. Interaction
- Select Text Clip -> Type in Properties -> Preview updates.

#### 3. Files to Create/Modify
- `assets/js/properties/text-properties.js`
- `assets/js/timeline-renderer.js` (Update clip label on timeline too?)

#### 4. MediaBunny Integration
- Update the `CanvasSource` or `TextNode` with new string.

#### 5. What NOT to Do
- ❌ Do NOT implement on-canvas editing (typing directly on the video). Use the side panel.

## Testing Checklist
- [ ] Input field appears for text clips
- [ ] Typing updates the preview instantly
- [ ] Typing updates the timeline clip label (optional but nice)
- [ ] Empty text is handled gracefully

## Done When
✅ Can edit text content  
✅ Preview reflects changes  
✅ Ready for Phase 91
