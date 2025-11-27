# Phase 97: Text Styling

## Goal
Customize font, size, and color of text clips

## Group
**Text Overlays**

## Feature to Implement

### ONE Feature: Text Style Controls
**Purpose**: Visual customization of titles

**Requirements**:

#### 1. What to Build
- **UI Controls** (Properties Panel):
    - **Font Family**: Dropdown (Arial, Roboto, Courier, Serif).
    - **Font Size**: Number input/Slider (10px to 200px).
    - **Color**: Color Picker (`<input type="color">`).
    - **Background**: Checkbox + Color Picker (optional box behind text).
- **Data Model**:
    - `clip.style.fontFamily`
    - `clip.style.fontSize`
    - `clip.style.color`
    - `clip.style.backgroundColor`

#### 2. Rendering
- Update the Canvas drawing logic to use these properties.
- `ctx.font = "${size}px ${family}"`
- `ctx.fillStyle = color`

#### 3. Files to Create/Modify
- `assets/js/properties/text-properties.js`

#### 4. What NOT to Do
- ❌ Do NOT implement custom font upload yet.

## Testing Checklist
- [ ] Font family changes work
- [ ] Size changes work
- [ ] Color picker updates text color
- [ ] Background color works (if implemented)

## Done When
✅ Text styling controls functional  
✅ Preview updates correctly  
✅ Ready for Phase 92
