# Phase 32: Settings Menu

## Goal
Implement a settings/options menu for each playlist item, providing access to advanced video operations.

**MediaBunny Note**: This phase creates the UI foundation for MediaBunny video operations. Consult `mediabunny-llms-full.md` for Conversion, Input, and processing APIs used in subsequent phases.

---

## What to Build

Settings menu system with:
- 3-dot settings icon on playlist items
- Dropdown context menu with operation options
- Proper menu positioning and anchoring
- Click-outside-to-close behavior
- Keyboard navigation support

---

## Features to Implement

### Feature 1: Settings Icon
**Purpose**: Add visual trigger for settings menu on each playlist item

**Requirements**:
- 3-dot vertical menu icon (⋮) on right side of playlist item
- Visible on hover (desktop) or always visible (mobile)
- Position near the duration/time display
- Apply theme button styling (subtle, not distracting)
- Clear visual feedback on hover (color change, scale)
- Keyboard accessible (focusable)

### Feature 2: Dropdown Menu
**Purpose**: Display available operations in a context menu

**Requirements**:
- Menu appears below/above settings icon (smart positioning)
- Contains 8 menu items:
  1. 🔄 Convert Format...
  2. 📥 Download Video Only
  3. 🎵 Download Audio Only
  4. ✂️ Trim Video...
  5. 📐 Resize Video...
  6. ℹ️ Video Info
  7. 🔗 Merge with Next
  8. 🎧 Extract Audio to Playlist
- Each item has icon + label
- Hover states clearly visible
- Click executes action or opens modal
- Divider line between related groups

### Feature 3: Menu Positioning
**Purpose**: Ensure menu is always visible on screen

**Requirements**:
- Default: Appear below and aligned to right edge of icon
- If near bottom of screen: Appear above icon
- If near right edge: Align to left edge of icon
- Calculate available space dynamically
- Never cut off by viewport
- Smooth appearance animation (fade + scale)

### Feature 4: Click-Outside Handling
**Purpose**: Close menu when user clicks elsewhere

**Requirements**:
- Detect clicks outside menu area
- Close menu immediately
- Remove event listeners on close
- Don't trigger playlist item click when closing
- ESC key also closes menu

### Feature 5: Menu State Management
**Purpose**: Handle menu open/close states properly

**Requirements**:
- Only one menu open at a time (close others when opening new one)
- Toggle behavior: Click icon again to close
- Store currently open menu reference
- Clean up state on playlist item removal
- Prevent body scroll when menu open (mobile)

### Feature 6: Conditional Menu Items
**Purpose**: Show/hide menu options based on context

**Requirements**:
- "Merge with Next" disabled if last item in playlist
- "Merge with Previous" disabled if first item (optional future feature)
- Greyed-out disabled items with tooltip explanation
- Show item count in merge option: "Merge with Next (video-2.mp4)"
- Context-aware labeling

---

## Interaction Behavior

**User Flow 1: Open Menu**:
1. User hovers over playlist item
2. Settings icon appears (⋮)
3. User clicks settings icon
4. Dropdown menu appears below icon
5. Menu options are clickable
6. Any previously open menus close

**User Flow 2: Select Operation**:
1. Menu is open
2. User hovers over menu item
3. Item highlights
4. User clicks menu item
5. Menu closes
6. Action executes (modal opens or operation starts)

**User Flow 3: Close Menu**:
1. Menu is open
2. User clicks outside menu area
3. Menu closes with fade animation
4. OR user presses ESC key
5. Menu closes immediately

**Keyboard Navigation**:
- **Tab**: Focus settings icon
- **Enter/Space**: Open menu
- **↑/↓**: Navigate menu items
- **Enter**: Select menu item
- **Esc**: Close menu

---

## Edge Cases

- Multiple menus open: Close all others when one opens
- Playlist item removed while menu open: Close menu gracefully
- Scrolling playlist while menu open: Keep menu positioned or close it
- Very long video titles in merge option: Truncate with ellipsis
- Touch devices: Settings icon always visible (no hover state)
- Small screens: Menu might overlap other items, adjust positioning

---

## Styling Requirements

**Theme**: Dark Neobrutalism

**Settings Icon**:
- Subtle color (theme secondary color)
- Hover: Primary color, slight scale (1.1x)
- Transition: 200ms ease

**Dropdown Menu**:
- Background: Dark surface color (theme background + elevation)
- Bold border: 3px solid (theme border color)
- Shadow: Heavy drop shadow for depth
- Border radius: 8px (neobrutalism style)
- Min-width: 220px
- Max-width: 280px

**Menu Items**:
- Padding: 12px 16px
- Font: Theme body font, 14px
- Hover: Theme primary background, bold text
- Icon: 18px, left-aligned
- Gap between icon and text: 12px
- Transition: 150ms background

**Animations**:
- Menu appear: Fade in + scale from 95% to 100% (200ms)
- Menu disappear: Fade out (150ms)
- Item hover: Background change (100ms)

---

## Accessibility

- Settings icon: `aria-label="Video options menu"`
- Menu: `role="menu"`, `aria-labelledby="settings-icon-{id}"`
- Menu items: `role="menuitem"`
- Disabled items: `aria-disabled="true"`
- Keyboard focus visible with outline
- Screen reader announces menu open/close
- Focus trap within menu when open

---

## What NOT to Do

- ❌ Don't allow multiple menus open simultaneously
- ❌ Don't forget to position menu within viewport bounds
- ❌ Don't make settings icon too large or distracting
- ❌ Don't forget to clean up event listeners
- ❌ Don't trigger playlist item click when clicking menu area

---

## MediaBunny Integration

This phase is primarily UI-focused. MediaBunny integration occurs in subsequent phases (33-39) when actual operations are implemented.

**Preparation for future phases**:
- Store video Input reference for each playlist item
- Ensure file blob/source is accessible for operations
- Cache video metadata (already extracted in Phase 22)

---

## Testing Checklist

- [ ] Settings icon appears on playlist item hover
- [ ] Clicking icon opens dropdown menu
- [ ] Menu displays all 8 operation options
- [ ] Menu positioning works (below, above, left, right)
- [ ] Click outside menu closes it
- [ ] ESC key closes menu
- [ ] Only one menu open at a time
- [ ] Menu items have proper hover states
- [ ] Disabled items are greyed out
- [ ] Keyboard navigation works (Tab, Enter, arrows)
- [ ] Touch devices show icon without hover
- [ ] Menu doesn't overflow viewport

---

## Done When

✅ Settings icon integrated into playlist items  
✅ Dropdown menu renders with all options  
✅ Menu positioning smart and viewport-aware  
✅ Click-outside and ESC key close menu  
✅ Keyboard navigation functional  
✅ Only one menu open at a time  
✅ All tests pass  
✅ Ready for next phase (Phase 33: Format Conversion)

---

**Phase**: 32 | **Component**: Player  
**Estimated Time**: 40-50 minutes
