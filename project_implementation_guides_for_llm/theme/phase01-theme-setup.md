# Phase 01: Theme Setup

## Goal
Create the foundational CSS file structure and configure fonts for the Dark Neobrutalism theme.

---

## What to Build

---

### Feature 1: Theme CSS File Structure

**Purpose**: Establish the main stylesheet that will contain all theme styles

**File Requirements**:
- Create `assets/css/theme.css` as the primary theme stylesheet
- Set up proper directory structure (`assets/css/` folder)
- Ensure file is ready to import in HTML pages

**Organization**:
- File should be structured with clear sections for different concerns
- Include comment headers to separate major sections
- Leave space for CSS variables (added in Phase 02)

---

---

### Feature 2: CSS Reset/Normalize

**Purpose**: Ensure consistent baseline styles across all browsers

**Requirements**:
- Reset default browser margins and padding on all elements
- Set `box-sizing: border-box` globally for predictable sizing
- Configure font smoothing for better text rendering
- Remove default button, input, and link styles
- Reset list styles (remove bullets/numbers)
- Make images responsive by default

**Visual Standards**:
- Base font size: 16px
- Line height: 1.6 for readability
- Remove default focus outlines (will add custom ones later)

---

---

### Feature 3: Font Configuration

**Purpose**: Load and configure the typography system fonts

**Font Requirements**:
- **Primary Font**: Space Grotesk (sans-serif)
  - Weights needed: 400 (Regular), 500 (Medium), 700 (Bold), 900 (Black)
- **Monospace Font**: Space Mono
  - Weights needed: 400 (Regular), 700 (Bold)

**Import Method**:
- Use Google Fonts CDN for quick setup
- Configure for display swap to avoid invisible text during load
- Include fallback fonts (system fonts) if primary fonts fail

**Fallback Stack**:
- Sans-serif fallbacks: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
- Monospace fallbacks: 'Courier New', Consolas, Monaco, monospace

---

---

### Feature 4: Global Body Styles

**Purpose**: Set baseline styles for the entire application

**Requirements**:
- Background color: Deep black (#0a0a0a)
- Text color: White (#ffffff)  
- Default font: Space Grotesk with fallbacks
- Base font size: 16px
- Line height: 1.6
- Remove default margins

**Anti-aliasing**:
- Enable font smoothing for crisp text rendering
- Configure for both WebKit and Mozilla browsers

---

## HTML Integration

**Import in HTML**:
- Add `<link>` tag in `<head>` section of all HTML files
- Import theme.css BEFORE any other stylesheets
- Ensure import path is correct relative to HTML file location

---

---

## Testing Checklist Criteria

### Visual Tests
- [ ] Open any HTML page in browser
- [ ] Background appears deep black (#0a0a0a)
- [ ] Text appears white by default
- [ ] Space Grotesk font loads correctly (check in browser DevTools)
- [ ] Space Mono font loads correctly
- [ ] No browser default styles visible (margins, paddings, bullets, etc.)

### Browser DevTools Tests
- [ ] Open Network tab - verify theme.css loads (Status 200)
- [ ] Check Fonts tab - verify Space Grotesk and Space Mono loaded
- [ ] Inspect body element - verify black background and white text
- [ ] No console errors related to missing files or fonts

### Cross-Browser Tests
- [ ] Test in Chrome/Edge
- [ ] Test in Firefox
- [ ] Test in Safari (if available)
- [ ] Font rendering looks smooth in all browsers

---

---

## Done When

✅ `assets/css/theme.css` file exists and is properly structured  
✅ CSS reset removes all default browser styles  
✅ Space Grotesk and Space Mono fonts load successfully  
✅ Page background is deep black with white text  
✅ File imports correctly in HTML pages  
✅ No console errors or missing file warnings  
✅ Ready for Phase 02 (adding CSS variables)

---

## Next Phase

**[Phase 02: Theme Tokens](phase02-theme-tokens.md)** - Define all CSS custom properties (variables) for colors, typography, spacing, borders, and shadows.

---

**Phase**: 01 | **Component**: Theme  
**Estimated Time**: 15-20 minutes  
**Complexity**: Low
