# Phase 03: Theme Components

## Goal
Create reusable CSS classes for common UI components following Dark Neobrutalism design principles.

---

## What to Build

Reusable component classes:
- Button styles (primary, secondary, icon)
- Card/container styles
- Input field styles
- Layout utilities (grid, flexbox)
- Video control styles

---

## Features to Implement

### Feature 1: Button Styles

**Purpose**: Provide consistent, accessible buttons across the application

**Button Types Needed**:
- **Primary Button**: Main call-to-action (uses accent color)
- **Secondary Button**: Alternative actions (outlined style)
- **Icon Button**: Square buttons for icons/controls

**Primary Button Requirements**:
- Background: Theme primary accent color
- Text: Dark color for contrast
- Border: Thick black border
- Shadow: Solid brutal shadow (medium size)
- Text: Uppercase, bold weight, letter spacing
- Padding: Medium vertical, extra-large horizontal

**Primary Button States**:
- Hover: Shift shadow (move button down-right, shadow up-left)
- Active/Pressed: Full shift (button at shadow position, no shadow)
- Focus: Visible outline for keyboard navigation
- Disabled: Muted colors, no pointer cursor

**Secondary Button Requirements**:
- Background: Transparent
- Border: Thick accent color border
- Text: Accent color
- Shadow: Solid brutal shadow
- Same states as primary

**Icon Button Requirements**:
- Square shape (48x48px typical)
- Centered icon
- Background: Tertiary background color
- Border: Medium border with accent color
- Smaller shadow
- Same interaction states

---

### Feature 2: Card Styles

**Purpose**: Container components for content grouping

**Card Requirements**:
- Background: Secondary background color
- Border: Medium border with accent color
- Shadow: Large brutal shadow
- Padding: Extra-large all around
- Sharp corners (zero border radius)

**Card States**:
- Default: Standard shadow
- Hover: Lift effect (shift up-left, shadow increases)
- No active state needed

**Card Structure**:
- Header section with bottom border
- Title in header (uppercase, bold)
- Body section for content
- Optional footer section

---

### Feature 3: Input Field Styles

**Purpose**: Form inputs with consistent styling

**Input Types**:
- Text input
- Textarea (multi-line)
- Select dropdown

**Input Requirements**:
- Background: Tertiary background
- Border: Medium border (dark color default)
- Text: Primary text color
- Font: Monospace font for inputs
- Padding: Medium all around
- Width: 100% of container
- Sharp corners

**Input States**:
- Focus: Border changes to accent color, add subtle glow
- Hover: Border preview of accent color
- Disabled: Muted background and text
- Error: Border in danger color

**Placeholder Styling**:
- Color: Muted text color
- Same font as input

---

### Feature 4: Layout Utilities

**Purpose**: Common layout patterns using CSS Grid and Flexbox

**Grid Utilities**:
- 2-column grid (50/50 split)
- 3-column grid (equal thirds)
- Configurable gaps using spacing variables

**Flexbox Utilities**:
- Horizontal center alignment
- Vertical center alignment
- Space-between alignment
- Column direction
- Gap controls (small, medium, large, extra-large)

**Container Utility**:
- Max-width constraint (1280px)
- Centered with auto margins
- Horizontal padding

---

### Feature 5: Video Control Styles

**Purpose**: Specialized buttons for video player controls

**Control Button Requirements**:
- Size: 48x48px square
- Background: Tertiary background
- Border: Medium border with accent color
- Icon: Centered, primary text color
- Shadow: Small brutal shadow

**Control States**:
- Hover: Background changes to accent, icon to dark
- Active/Pressed: Shadow disappears (pressed effect)
- Selected/Active state: Stays in accent color

**Special Considerations**:
- Fast transitions for responsive feel
- Clear visual feedback
- Touch-friendly sizing (min 44px)

---

## Design Principles

**Neobrutalism Requirements**:
- ✅ NO border-radius anywhere
- ✅ Thick borders (4-6px typical)
- ✅ Solid shadows only (no blur)
- ✅ High contrast colors
- ✅ Bold, uppercase typography
- ✅ Generous spacing

**Accessibility Requirements**:
- All interactive elements keyboard accessible
- Sufficient color contrast (minimum 4.5:1)
- Visible focus states
- Touch targets minimum 44x44px
- Screen reader friendly

---

---

## Testing Checklist

### Visual Tests
- [ ] All button types render correctly
- [ ] Cards have proper shadows and borders  
- [ ] Input fields styled consistently
- [ ] Layout utilities create proper grids/flexbox
- [ ] Video controls sized appropriately
- [ ] All corners are sharp (no rounding)
- [ ] Shadows are solid (no blur visible)

### Interaction Tests
- [ ] Button hovers show shadow shift
- [ ] Button active shows pressed state
- [ ] Card hover lifts effectively
- [ ] Input focus states work
- [ ] Focus outlines visible for keyboard nav

### Consistency Tests
- [ ] All components use theme variables
- [ ] Spacing is consistent
- [ ] Border widths match
- [ ] Shadow styles uniform
- [ ] Color usage follows palette

---

---

## Done When

✅ All button styles defined (primary, secondary, icon)  
✅ Card component complete with hover states  
✅ Input field styles cover all input types  
✅ Layout utilities functional  
✅ Video control buttons styled  
✅ All components use theme variables  
✅ No border-radius anywhere  
✅ All shadows are solid  
✅ Hover and active states work  
✅ Components ready for use in pages

---

## Next Phase

**[Phase 04: Theme Polish](phase04-theme-polish.md)** - Add responsive design, accessibility features, and final refinements.

---

**Phase**: 03 | **Component**: Theme  
**Estimated Time**: 30-40 minutes  
**Complexity**: Medium
