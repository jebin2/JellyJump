# Dashboard (Landing Page) - Goal

## Component Overview
The dashboard serves as the main entry point and navigation hub for MediaBunnyPlayer. It showcases features, establishes brand identity, and routes users to the player or editor.

## Primary Objectives

### 1. Make Strong First Impression
Create an engaging landing experience that:
- Immediately communicates the platform's value
- Demonstrates visual design excellence
- Builds user confidence and excitement
- Establishes neobrutalism brand identity

### 2. Guide User Navigation
Provide clear pathways to:
- Video Player page (player.html)
- Video Editor page (editor.html)
- Feature demonstrations
- Documentation/help (if needed)

### 3. Showcase Core Features
Effectively communicate capabilities:
- Advanced video playback
- Timeline-based editing
- Format support
- Keyboard shortcuts
- Client-side processing

## Key Deliverables

### HTML Page
- `index.html` - Main landing page

### Sections
1. **Hero Section** - Bold headline, value proposition, primary CTAs
2. **Features Showcase** - Visual demos of player and editor
3. **Technology Stack** (optional) - Build trust with technical details
4. **Footer** - Quick links and credits

### Interactive Elements
- "LAUNCH PLAYER" CTA → player.html
- "OPEN EDITOR" CTA → editor.html
- Feature cards with hover effects
- Optional: Embedded demo player

## Design Requirements

### Visual Identity
- Hero: Full viewport height, bold typography
- Features: Card-based layout with screenshots
- Theme: Dark neobrutalism (per theme.md)
- Colors: Deep black bg, neon green accents
- Typography: Large, bold, uppercase for headlines

### Responsive Behavior
- **Desktop (1024px+)**: Multi-column feature grid, side-by-side CTAs
- **Tablet (768-1023px)**: Two-column grid, adjusted proportions
- **Mobile (<768px)**: Single column, stacked CTAs, hamburger menu

## Content Strategy

### Headlines (Choose One)
- "VIDEO PLAYER & EDITOR. NO COMPROMISES."
- "POWERFUL VIDEO TOOLS. BRUTALLY SIMPLE."
- "PLAY. EDIT. CREATE. ALL IN ONE."

### Tone
- Confident and bold
- Direct and no-nonsense
- Technical but accessible
- Empowering language

## Success Criteria
- ✅ Page loads in < 2 seconds
- ✅ Clear navigation to player and editor
- ✅ Visually impressive on first view
- ✅ Consistent with neobrutalism theme
- ✅ Responsive across all devices
- ✅ Accessible (WCAG AA)
- ✅ SEO optimized

## Integration Points
- **Routes to**: [`player/`](../player/goal.md), [`editor/`](../editor/goal.md)
- **Depends on**: [`theme/`](../theme/goal.md)
- **Phase**: Phase 0 (Foundation)
- **Implementation**: See [`phase0.md`](phase0.md)

## Optional Features
- Interactive demo player (embed core player with sample video)
- Feature comparison table
- Keyboard shortcut reference
- Video format compatibility chart
- Testimonials or use cases

## References
- [Landing Page Best Practices](https://www.awwwards.com/)
- [Web Performance Optimization](https://web.dev/performance/)
- [SEO Guidelines](https://developers.google.com/search/docs)

---

**Phase**: 0 (Foundation)  
**Dependencies**: theme  
**Last Updated**: 2025-11-22
