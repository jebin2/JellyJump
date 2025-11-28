# Phase 05: Dashboard Structure

## Goal
Create the HTML page structure for the landing page with navigation, hero section, features section, and footer.

---

## What to Build

Landing page structure with:
- Complete HTML5 document foundation
- Sticky navigation header
- Hero section container
- Features section container
- Footer

---

## Features to Implement

### Feature 1: Page Foundation

**Purpose**: Set up the basic HTML document structure

**Requirements**:
- Create `index.html` as the main landing page file
- Include proper HTML5 doctype and semantic structure
- Set up `<head>` section with meta tags
- Import theme CSS (must be first stylesheet)
- Configure viewport for responsive design

**Meta Tags Needed**:
- Character set (UTF-8)
- Viewport (responsive)
- Title: "MediaBunny Player - Video Player & Editor"
- Description meta tag (for SEO)
- Open Graph tags (for social sharing)

---

### Feature 2: Navigation Header

**Purpose**: Sticky navigation bar at the top of the page

**Requirements**:
- Position: Sticky at top (stays visible when scrolling)
- Layout: Horizontal flex layout with space-between
- Left side: Logo/brand name ("MediaBunny" or "MediaBunny Player")
- Right side: Navigation links and action buttons

**Navigation Items**:
- Link to features section (anchor link #features)
- "PLAYER" button linking to player.html
- "EDITOR" button linking to editor.html

**Visual Design**:
- Use theme flex utilities for layout
- Apply theme padding (large)
- Background: Primary or secondary background color
- Border bottom: Accent color border

**Interactions**:
- Links: Smooth scroll to sections (for anchors)
- Buttons: Navigate to respective pages
- Hover states on all clickable items

---

### Feature 3: Hero Section Structure

**Purpose**: Main landing area that captures attention

**Requirements**:
- Section takes significant viewport height (100vh or similar)
- Centered content both vertically and horizontally
- Container div to constrain max-width
- Text should be center-aligned

**Content Structure** (detailed in Phase 06):
- Headline (large, bold)
- Subheadline/tagline
- Call-to-action buttons

**Visual Design**:
- Use theme flex utilities for centering
- Background: Primary background
- Generous padding/spacing

---

### Feature 4: Features Section Structure

**Purpose**: Showcase key features of the application

**Requirements**:
- Section clearly separated from hero
- Container to constrain width
- Grid layout for feature cards (detailed in Phase 07)

**Layout**:
- Section padding: Extra large top and bottom
- Content container: Max-width constraint
- Heading: "FEATURES" or similar
- Grid container for feature cards

**Visual Design**:
- Background: Can be same or contrasting to hero
- Use theme spacing variables

---

### Feature 5: Footer Section

**Purpose**: Page footer with copyright and links

**Requirements**:
- Bottom of page
- Centered content
- Copyright notice
- Optional: Links to About, Privacy, etc.

**Layout**:
- Horizontal padding
- Vertical padding (extra large)
- Text centered
- Border top: Accent color

**Content**:
- Copyright text: "© 2025 MediaBunny Player"
- Optional additional links

**Visual Design**:
- Use theme text utilities
- Secondary text color
- Border top matches theme

---

## Layout Structure

**Page Flow** (top to bottom):
1. Navigation Header (sticky)
2. Hero Section (full viewport height)
3. Features Section (auto height based on content)
4. Footer (auto height)

**HTML Semantic Structure**:
- Use `<header>` for navigation
- Use `<section>` for hero and features
- Use `<footer>` for footer
- Use `<nav>` within header
- Use proper heading hierarchy (h1, h2, h3)

---

## Accessibility Requirements

**Landmarks**:
- Header has role="banner" (implicit with <header>)
- Navigation has role="navigation" (implicit with <nav>)
- Main content in <main> tag
- Footer has role="contentinfo" (implicit with <footer>)

**Heading Structure**:
- One h1 for main page title
- h2 for section headings
- Logical hierarchy

**Keyboard Navigation**:
- All links and buttons accessible via Tab
- Skip to main content link (optional but recommended)

---

---

## Testing Checklist

### Structure Tests
- [ ] HTML validates (use W3C validator)
- [ ] All sections render in correct order
- [ ] Navigation sticky behavior works
- [ ] Viewport meta tag makes page responsive
- [ ] Theme CSS loads correctly

### Navigation Tests
- [ ] Logo/brand name displays
- [ ] Navigation links present and clickable
- [ ] Anchor links scroll to sections smoothly
- [ ] Player and Editor buttons link correctly

### Layout Tests
- [ ] Hero section takes full viewport height
- [ ] Content is centered in hero
- [ ] Features section has proper spacing
- [ ] Footer appears at bottom
- [ ] Container max-widths applied correctly

### Accessibility Tests
- [ ] Semantic HTML elements used
- [ ] Heading hierarchy correct (h1 > h2)
- [ ] Can navigate with keyboard only
- [ ] Screen reader announces landmarks

---

---

## Done When

✅ index.html file created with complete structure  
✅ Theme CSS imported and working  
✅ Navigation header visible and sticky  
✅ Hero section structure in place  
✅ Features section structure ready  
✅ Footer displays correctly  
✅ All sections use semantic HTML  
✅ Page validates with no errors  
✅ Ready for Phase 06 (adding hero content)

---

## Next Phase

**[Phase 06: Dashboard Hero](phase06-dashboard-hero.md)** - Add content to hero section with headline and CTAs.

---

**Phase**: 05 | **Component**: Dashboard  
**Estimated Time**: 20-30 minutes  
**Complexity**: Low
