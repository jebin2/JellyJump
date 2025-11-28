# Phase 02: Theme Tokens

## Goal
Define all CSS custom properties (variables) for the design system: colors, typography, spacing, borders, and shadows.

---

## What to Build

---

### Feature 1: Color System

**Purpose**: Create a comprehensive color palette for the Dark Neobrutalism theme

**Background Colors**:
- Primary background: Deep black (#0a0a0a) for main surfaces
- Secondary background: Slightly lighter black (#1a1a1a) for cards/elevated surfaces
- Tertiary background: Another shade (#2a2a2a) for highest elevation

**Accent Colors**:
- Primary accent: Neon green (#00ff88) for main actions and highlights
- Secondary accent: Magenta (#ff00ff) for secondary actions
- Tertiary accent: Cyan (#00d4ff) for information/status
- Warning accent: Orange (#ffaa00) for warnings
- Danger accent: Red/pink (#ff3366) for errors and delete actions

**Text Colors**:
- Primary text: Pure white (#ffffff) for main content
- Secondary text: Light gray (#b0b0b0) for less important text
- Muted text: Dark gray (#666666) for hints/disabled states
- Accent text: Neon green (#00ff88) for highlighted text

**Border Colors**:
- Primary borders: Neon green (#00ff88) for main borders
- Secondary borders: White (#ffffff) for alternative borders
- Dark borders: Dark gray (#333333) for subtle dividers

---

---

### Feature 2: Typography System

**Purpose**: Define font families, sizes, and weights

**Font Families**:
- Primary font: Space Grotesk with fallbacks (Inter, system fonts)
- Monospace font: Space Mono with fallbacks (Courier New, Consolas)

**Font Sizes** (use rem units):
- Extra small: 0.75rem (12px) for captions
- Small: 0.875rem (14px) for small text
- Base: 1rem (16px) for body text
- Large: 1.125rem (18px) for large body text
- Extra large: 1.5rem (24px) for headings
- 2X large: 2rem (32px) for large headings
- 3X large: 3rem (48px) for hero text

**Font Weights**:
- Regular: 400 for normal text
- Medium: 500 for emphasis
- Bold: 700 for strong emphasis
- Black: 900 for maximum impact

---

---

### Feature 3: Spacing Scale

**Purpose**: Create consistent spacing system for margins and padding

**Spacing Values** (use rem units):
- Extra small: 0.25rem (4px)
- Small: 0.5rem (8px)
- Medium: 1rem (16px) - Base spacing unit
- Large: 1.5rem (24px)
- Extra large: 2rem (32px)
- 2X large: 3rem (48px)
- 3X large: 4rem (64px)

**Usage**:
- Use these consistently for margins, padding, gaps
- Smaller values for compact UI
- Larger values for generous spacing

---

---

### Feature 4: Border System

**Purpose**: Define border widths for neobrutalism aesthetic

**Border Widths**:
- Thin: 2px for subtle borders
- Medium: 4px for standard borders (most common)
- Thick: 6px for emphasized elements
- Ultra: 8px for maximum impact

**Border Radius**:
- ALWAYS ZERO - No rounded corners in neobrutalism
- Define variables but set to 0 for clarity

**Important**: Neobrutalism = sharp corners only

---

---

### Feature 5: Shadow System

**Purpose**: Create brutalist shadows (solid, no blur)

**Shadow Types**:
- Small: 4px offset, 0 blur, accent color
- Medium: 6px offset, 0 blur, accent color
- Large: 8px offset, 0 blur, accent color  
- Extra large: 12px offset, 0 blur, accent color

**Shadow Colors** (different shadow variations):
- Default: Using primary accent (neon green)
- White shadows: Using white for contrast
- Dark shadows: Using black/dark gray
- Magenta shadows: Using secondary accent

**Critical**: Shadows MUST be solid (no blur) - this is key to neobrutalism

---

---

### Feature 6: Animation Variables

**Purpose**: Define consistent timing and easing for animations

**Transition Speeds**:
- Fast: 0.1s for instant feedback
- Normal: 0.2s for standard animations
- Slow: 0.3s for deliberate animations

**Easing**:
- Prefer linear easing for brutalist aesthetic
- Avoid complex easing curves

---

## Implementation Notes

**CSS Custom Properties**:
- Define all variables in `:root` selector
- Use `--` prefix for all custom properties
- Group variables by category (colors, typography, etc.)
- Add comments to organize sections

**Naming Convention**:
- Use kebab-case: `--bg-primary`, `--text-secondary`
- Be descriptive: `--border-medium` not just `--border-2`
- Consistent prefixes: `--bg-`, `--text-`, `--space-`, etc.

---

---

## Testing Checklist Criteria

### Variable Definition Tests
- [ ] All color variables defined
- [ ] All typography variables defined
- [ ] All spacing variables defined
- [ ] All border variables defined
- [ ] All shadow variables defined
- [ ] All animation variables defined

### Usage Tests
- [ ] Can use variables in styles: `background: var(--bg-primary)`
- [ ] Variables resolve to correct values in DevTools
- [ ] Color values match specifications
- [ ] Spacing creates consistent gaps
- [ ] Shadows appear solid (no blur)

### Visual Verification
- [ ] Test file shows neon green accent color
- [ ] Black backgrounds render correctly
- [ ] White text is clearly visible
- [ ] Spacing looks proportional
- [ ] Shadows are sharp and solid

---

---

## Done When

✅ All CSS custom properties defined in `:root`  
✅ Color system complete (backgrounds, accents, text, borders)  
✅ Typography scale defined (sizes, weights, families)  
✅ Spacing system complete (7 sizes from xs to 3xl)  
✅ Border widths defined (all set to create sharp look)  
✅ Shadow system defined (solid shadows, no blur)  
✅ Animation timing variables set  
✅ Variables work when used in test styles  
✅ All values match Dark Neobrutalism specifications

---

## Next Phase

**[Phase 03: Theme Components](phase03-theme-components.md)** - Create reusable component classes using these variables.

---

**Phase**: 02 | **Component**: Theme  
**Estimated Time**: 20-30 minutes  
**Complexity**: Low-Medium
