# Theme Component - Goal

## Component Overview
The theme system provides the visual foundation for the entire MediaBunnyPlayer application, implementing a bold **Dark Neobrutalism** design aesthetic.

## Primary Objectives

### 1. Establish Visual Identity
Create a distinctive, memorable design language that:
- Uses high-contrast dark colors with neon accents
- Features thick borders and bold shadows
- Employs sharp, angular geometric shapes
- Maintains consistency across all pages

### 2. Provide Reusable Design System
Build a comprehensive CSS framework with:
- Global CSS variables for colors, spacing, typography
- Utility classes for common patterns
- Reusable component styles (buttons, cards, controls)
- Responsive breakpoint system

### 3. Ensure Accessibility
Maintain web accessibility standards:
- High contrast ratios (21:1 minimum)
- Clear focus indicators
- Screen reader compatibility
- Keyboard navigation support

## Key Deliverables

### CSS Files
- `assets/css/theme.css` - Global theme variables and utilities
- Component-specific CSS files that extend the theme

### Design Tokens
- Color palette (backgrounds, accents, text)
- Typography scale (font families, sizes, weights)
- Spacing system (margins, padding, gaps)
- Border and shadow specifications

### Component Library
- Buttons (primary, secondary, icon)
- Cards and containers
- Form inputs and controls
- Navigation elements
- Status indicators

## Design Specifications

### Color Palette
- **Background**: Deep black (#0a0a0a)
- **Surface**: Dark gray variants (#1a1a1a, #2a2a2a)
- **Primary Accent**: Neon green (#00ff88)
- **Secondary Accent**: Neon pink/cyan (optional)
- **Text**: White (#ffffff), Gray (#b0b0b0)

### Typography
- **Primary Font**: Sans-serif, bold, high contrast
- **Monospace Font**: For code, technical details
- **Scale**: 16px base, modular scale for headings

### Spacing
- Base unit: 8px
- Compact: 4px, 8px
- Standard: 16px, 24px, 32px
- Generous: 48px, 64px

### Borders & Shadows
- Border width: 4-6px for major elements
- Shadow style: Offset, solid (no blur)
- Sharp corners (border-radius: 0)

## Success Criteria
- ✅ All pages use consistent theme variables
- ✅ Design is recognizably "neobrutalist"
- ✅ WCAG AA accessibility compliance
- ✅ Responsive across all device sizes
- ✅ Easy for developers to extend and customize

## Integration Points
- **Used by**: [`dashboard/`](../dashboard/goal.md), [`player/`](../player/goal.md), [`editor/`](../editor/goal.md), [`core/`](../core/goal.md)
- **Phase**: Phase 0 (Foundation)
- **Implementation**: See [`phase0.md`](phase0.md)

## References
- [Neobrutalism Design Trends](https://www.awwwards.com/)
- [WCAG Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties)

---

**Phase**: 0 (Foundation)  
**Dependencies**: None  
**Last Updated**: 2025-11-22
