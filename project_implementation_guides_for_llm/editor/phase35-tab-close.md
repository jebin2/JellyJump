# Phase 35: Tab Close Button

## Goal
[X] button on each tab, remove tab from UI, switch to adjacent tab

## Group
**Tab Management**

## Feature to Implement

### ONE Feature: Tab Close Button Functionality
**Purpose**: Allow users to close project tabs using the [×] close button

**Requirements**:

#### 1. What to Build
Make the [×] close button functional to:
- Close the tab when clicked
- Remove tab from UI (DOM)
- Remove tab from internal tabs array
- Switch to adjacent tab if closing active tab
- Prevent closing if it's the last tab (keep at least 1 tab)

#### 2. Close Button Interaction
When close button [×] is clicked:
1. Stop event propagation (prevent tab switch from Phase 34)
2. Get the tab ID from parent tab element
3. Check if this is the last remaining tab
4. If last tab, show notification: "⚠️ Cannot close last tab"
5. If not last tab:
   - Remove tab from internal tabs array
   - Remove tab element from DOM
   - If closed tab was active, switch to adjacent tab
   - Log to console: "Closed tab: [UUID]"

#### 3. Tab Selection After Close
When closing a tab, determine which tab to activate next:
- **Closing active tab**: Switch to adjacent tab
  - Priority: Right neighbor (next tab)
  - If no right neighbor: Left neighbor (previous tab)
- **Closing inactive tab**: Keep current active tab active, no switch needed

#### 4. Last Tab Protection
Always keep at least 1 tab open:
- If only 1 tab exists, disable close button or show warning
- Show notification: "⚠️ Cannot close last tab"
- Notification auto-dismisses after 3 seconds
- Optional: Visually disable [×] button when only 1 tab (grayed out, no hover)

#### 5. Close Button Visual States
**Normal state**:
- Small [×] text or ✕ icon
- Size: ~20px × 20px
- Position: Right side of tab
- Subtle color (gray or secondary)

**Hover state**:
- Background color change (red or warning color)
- Icon color change (white for contrast)
- Slight scale increase (1.1x) for emphasis

**Active/Click state**:
- Scale down slightly (0.95x)
- Instant visual feedback

**Disabled state** (only 1 tab):
- Grayed out, reduced opacity (0.4)
- No hover effect
- Cursor: not-allowed

#### 6. Event Handling
Attach click handler to close buttons:
- Use event delegation on tab bar container
- Check if click target is close button (`data-tab-close` attribute)
- Stop propagation to prevent tab switching (from Phase 34)
- Call close tab logic with tab ID

#### 7. DOM Manipulation
When removing a tab:
- Find tab element by `data-tab-id`
- Remove element with smooth fade-out animation (optional)
- Clean up any event listeners attached to tab
- Update tabs array in JavaScript state
- Recalculate tab count

#### 8. Edge Cases
- **Close last tab**: Prevent and show warning
- **Close active tab**: Switch to adjacent before removing
- **Close inactive tab**: No switching needed
- **Rapid clicking close buttons**: Ensure clean removal, no duplicate removals
- **Close while unsaved**: In this phase, close immediately (Phase 36 adds confirmation)
- **Only 2 tabs, close one**: One tab remains, disable its close button

#### 9. Tab Count Update
After closing a tab:
- Update internal tab count
- If down to 1 tab, disable remaining tab's close button
- If down to 9 tabs (from 10), re-enable [+] button if it was disabled

#### 10. Accessibility
- Close button should have `aria-label="Close tab: [Tab Name]"`
- When tab is closed, announce to screen readers: "Tab closed"
- Focus management: Move focus to newly active tab after close
- Close button should be keyboard accessible (Tab key)
- Enter or Space on close button should close the tab

#### 11. Keyboard Shortcuts (Optional)
Consider adding:
- Ctrl+W to close active tab
- If implemented, ensure same behavior as clicking [×]

#### 12. Styling Requirements
Apply Dark Neobrutalism theme to close button:
- Small, square or circular button
- Thick border on hover (2px)
- Background color on hover (red/warning color)
- Smooth transition for hover state (150-200ms)
- No brutalist shadow (too small for shadow)
- Use CSS variables from theme

#### 13. Files to Create/Modify
- `assets/js/tab-manager.js` - Extend from Phase 33-34, add close logic
- `assets/css/editor.css` - Add close button hover/active states
- No new files needed

#### 14. JavaScript Organization
Extend TabManager class/module from Phase 33-34:
- `closeTab(tabId)` - Main close method
- `removeTabFromDOM(tabId)` - Remove tab element
- `removeTabFromState(tabId)` - Remove from tabs array
- `selectAdjacentTab(currentTabId)` - Find and activate adjacent tab
- `isLastTab()` - Check if only 1 tab remains
- `updateCloseButtons()` - Enable/disable close buttons based on count

#### 15. Data Attributes
- `data-tab-close` on close button [×] (already suggested in Phase 33)
- `data-tab-id="[UUID]"` on parent tab element (to get tab ID)

#### 16. What NOT to Do
- ❌ Do NOT implement unsaved changes confirmation (that's Phase 36)
- ❌ Do NOT implement tab restoration/undo close (not in scope)
- ❌ Do NOT save tab state to localStorage yet (that's Phase 37)
- This phase is **close button functionality ONLY**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Phase 33**: Tabs created with close buttons (non-functional)
- **Phase 34**: Tab switching logic (need to prevent on close button click)
- **Phase 36**: Will add unsaved changes confirmation before close
- **Phase 37**: Will remove tab from localStorage
- **Code of Conduct**: Use event delegation, clean up properly

## Testing Checklist
- [ ] Click close button [×] closes the tab
- [ ] Tab is removed from UI (DOM)
- [ ] Tab is removed from internal state
- [ ] Close button click does NOT switch tabs (propagation stopped)
- [ ] Closing active tab switches to right neighbor
- [ ] If no right neighbor, switches to left neighbor
- [ ] Closing inactive tab keeps current tab active
- [ ] Cannot close last remaining tab
- [ ] Warning shown: "⚠️ Cannot close last tab"
- [ ] Warning auto-dismisses after 3 seconds
- [ ] Close button grayed out when only 1 tab (optional)
- [ ] Close button has hover effect (color change)
- [ ] Close button has click effect (scale down)
- [ ] Smooth fade-out animation when tab closes (optional)
- [ ] Tab count updates correctly after close
- [ ] [+] button re-enabled if was at 10 tabs limit
- [ ] Focus moves to newly active tab after close
- [ ] No console errors

## Done When
✅ Close button [×] functional  
✅ Tabs close and remove from UI  
✅ Adjacent tab activation works  
✅ Last tab protection works  
✅ Event propagation stopped correctly  
✅ Hover and click states styled  
✅ Warning notification displays  
✅ All tests pass  
✅ Ready for Phase 36 (Unsaved Confirmation)

---
**Phase**: 35 | **Component**: Editor | **Group**: Tab Management  
**Estimated Time**: 15 min

## Implementation Notes
- Use `stopPropagation()` or `stopImmediatePropagation()` on close button click
- Find adjacent tab using array index
- Keep close logic simple (no undo in this phase)
- Phase 36 will add "are you sure?" confirmation for unsaved changes
