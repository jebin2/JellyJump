# Phase 40: Tab Switching

## Goal
Click tab to activate, visual active/inactive states, load tab's project data

## Group
**Tab Management**

## Feature to Implement

### ONE Feature: Tab Switching Functionality
**Purpose**: Allow users to switch between different project tabs by clicking them

**Requirements**:

#### 1. What to Build
Make tabs clickable to switch between projects:
- Click any tab to activate it
- Deactivate previously active tab
- Update visual states (active/inactive)
- Load the tab's project data into the editor
- Update URL hash with active tab ID (optional for this phase)

#### 2. Tab Click Behavior
When a tab is clicked:
1. Check if tab is already active
2. If already active, do nothing (early return)
3. If different tab:
   - Deactivate currently active tab (remove active state)
   - Activate clicked tab (add active state)
   - Update tab internal state (isActive flags)
   - Load tab's project data into editor
   - Log to console: "Switched to tab: [UUID]"

#### 3. Visual State Updates
**Activate clicked tab**:
- Add active state class (`tab--active` or similar)
- Apply highlighted background
- Apply thick bottom border (4px)
- Make text bold and higher contrast
- Update `aria-selected="true"`

**Deactivate previous tab**:
- Remove active state class
- Apply dimmed background
- Apply thin bottom border (2px)
- Make text normal weight
- Update `aria-selected="false"`

#### 4. Project Data Loading
When switching to a tab:
- Retrieve tab's project data from internal tabs array
- Load the following into editor (empty for now in this phase):
  - Timeline clips (will have data in later phases)
  - Media library items (will have data in later phases)
  - Properties panel settings (will have data in later phases)
- If tab has no data, editor should show empty/default state
- Clear previous tab's data from UI before loading new data

#### 5. Active Tab Tracking
Maintain state of which tab is active:
- Store active tab ID in JavaScript variable
- Only one tab can be active at a time
- On page load, no tab active until one is clicked or created
- Set `isActive: true` on active tab object, `isActive: false` on others

#### 6. Event Handling
Use event delegation for tab clicks:
- Attach single click event listener to tab bar container
- Check if click target is a tab element (has `data-tab-id`)
- Ignore clicks on close button [×] (that's handled in Phase 35)
- Call tab switching logic with clicked tab's ID

#### 7. Keyboard Navigation
Support keyboard tab switching:
- Arrow keys (Left/Right) to navigate between tabs
- Enter or Space to activate focused tab
- Focus should move to tab content area after switching
- Visual focus indicator on tabs

#### 8. Edge Cases
- **Click same tab**: Do nothing (already active)
- **Click during project save**: Allow switch (no blocking in this phase)
- **No tabs exist**: Tab switching shouldn't be possible
- **Single tab exists**: Tab is active, clicking it does nothing
- **Click close button area**: Should not trigger tab switch (Phase 35 handles close)

#### 9. What Data to Load (Empty for Now)
When switching tabs, prepare to load (actual loading in later phases):
- **Timeline**: Empty timeline tracks (Phase 60+)
- **Media Library**: Empty media items (Phase 38+)
- **Preview Player**: No video loaded initially (Phase 48+)
- **Properties Panel**: Show empty state (Phase 54+)

For this phase, simply log: "Loading project data for tab: [UUID]" and clear editor to default empty state.

#### 10. Styling Requirements
Ensure active/inactive states are clearly distinguishable:
- Use CSS transitions for smooth state changes (200-300ms)
- Active tab should "pop" visually (shadow, border, color)
- Inactive tabs should be subtle but still readable
- Hover state on inactive tabs to show they're clickable
- No hover state change on already-active tab

#### 11. Accessibility
- Use `role="tablist"` on tab bar container
- Use `role="tab"` on each tab element
- Use `role="tabpanel"` on main editor content area
- Link tabs to content with `aria-controls` and `id` attributes
- Update `aria-selected="true/false"` when switching
- Announce tab switches to screen readers with live region

#### 12. Files to Create/Modify
- `assets/js/tab-manager.js` - Extend from Phase 33, add switching logic
- `assets/css/editor.css` - Ensure active/inactive state styles are polished
- No new files needed

#### 13. JavaScript Organization
Extend TabManager class/module from Phase 33:
- `switchToTab(tabId)` - Main tab switching method
- `setActiveTab(tabId)` - Update active states
- `loadTabData(tabId)` - Load tab's project data (placeholder for now)
- `clearEditor()` - Clear current project data from UI
- `attachTabClickHandlers()` - Event delegation for tab clicks

#### 14. Data Attributes
- `data-tab-id="[UUID]"` on each tab (already added in Phase 33)
- `data-tab-close` on close button [×] (to distinguish from tab click)

#### 15. What NOT to Do
- ❌ Do NOT implement unsaved changes confirmation (that's Phase 36)
- ❌ Do NOT implement tab persistence/restoration (that's Phase 37)
- ❌ Do NOT actually load timeline clips or media (those phases come later)
- ❌ Do NOT implement tab reordering (drag to rearrange)
- This phase is **tab switching logic ONLY**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Phase 33**: Tabs already created with UUIDs
- **Phase 35**: Will handle close button clicks (need to prevent switch on close)
- **Phase 36**: Will add unsaved changes confirmation
- **Phase 37**: Will restore active tab on page load
- **Code of Conduct**: Use event delegation, cache selectors

## Testing Checklist
- [ ] Click a tab activates it (visual change)
- [ ] Previously active tab becomes inactive
- [ ] Only one tab active at a time
- [ ] Click already-active tab does nothing
- [ ] Active tab has distinct visual style (bold, thick border, shadow)
- [ ] Inactive tabs are dimmed
- [ ] Hover effect on inactive tabs
- [ ] No hover effect on active tab
- [ ] Click tab logs: "Switched to tab: [UUID]"
- [ ] "Loading project data" logged for each switch
- [ ] Clicking close button [×] does NOT switch tabs
- [ ] Tab switching has smooth CSS transition
- [ ] Arrow keys navigate between tabs (Left/Right)
- [ ] Enter key activates focused tab
- [ ] `aria-selected` attribute updates correctly
- [ ] No console errors

## Done When
✅ Tab clicking switches active state  
✅ Visual active/inactive states work  
✅ Only one tab active at a time  
✅ Event delegation for clicks  
✅ Keyboard navigation works  
✅ Close button doesn't trigger switch  
✅ Smooth CSS transitions  
✅ All tests pass  
✅ Ready for Phase 35 (Tab Close Button)

---
**Phase**: 40 | **Component**: Editor | **Group**: Tab Management  
**Estimated Time**: 20 min

## Implementation Notes
- Use event delegation pattern for performance
- Check if click is on close button before switching
- Project data loading is placeholder for now (logs only)
- Actual timeline/media loading happens in later phases when those systems exist
- Keep tab switching fast and responsive
