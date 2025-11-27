# Phase 39: Create New Tab

## Goal
Click [+] to create tab with UUID, default name "Untitled Project", max 10 tabs limit warning

## Group
**Tab Management**

## Feature to Implement

### ONE Feature: Create New Tab Functionality
**Purpose**: Allow users to create new project tabs by clicking the [+] button

**Requirements**:

#### 1. What to Build
Make the [+] button functional to:
- Create a new tab when clicked
- Generate unique UUID for the tab
- Assign default name "Untitled Project"
- Add tab to the tab bar UI
- Automatically switch to the newly created tab (make it active)
- Enforce maximum limit of 10 tabs

#### 2. Tab Data Structure
Each tab should have this data structure:
```
{
  id: string (UUID),
  name: string ("Untitled Project" or custom name),
  isActive: boolean,
  hasUnsavedChanges: boolean (default: false),
  projectData: {
    timeline: [],
    clips: [],
    // Other project data added in later phases
  },
  createdAt: timestamp
}
```

#### 3. Tab Visual Structure
Create a tab element with:
- Tab name display (editable later, not in this phase)
- Close button [×] (visible but non-functional in this phase)
- Active state styling (highlighted)
- Inactive state styling (dimmed)
- Layout: [Tab Name] [×]
- Fixed width or auto-width based on content (max-width to prevent overflow)

#### 4. Tab Creation Flow
When [+] button is clicked:
1. Check if tab count < 10 (max limit)
2. If at limit, show warning notification: "⚠️ Maximum 10 tabs allowed"
3. If under limit:
   - Generate UUID for new tab
   - Create tab object with default data
   - Add tab to internal tabs array/state
   - Render tab element in tab bar
   - Switch to new tab (make it active)
   - Deactivate all other tabs
   - Log to console: "Created tab: [UUID]"

#### 5. Tab Rendering
When rendering a tab element:
- Insert tab into tab bar container (before [+] button)
- Show tab name: "Untitled Project"
- Show close button [×]
- Apply active state if this is the newly created tab
- Add `data-tab-id="[UUID]"` attribute
- Make tab clickable (functionality in Phase 34)

#### 6. Active/Inactive States
**Active tab** (newly created):
- Highlighted background (primary or accent color)
- Thicker bottom border (4px)
- Slightly elevated (shadow or border effect)
- Text: bold and higher contrast

**Inactive tabs** (others):
- Dimmed background (secondary background)
- Thinner bottom border (2px)
- Normal text weight
- Slightly transparent or lower contrast

#### 7. Tab Limit Enforcement
Maximum 10 tabs:
- Check count before creating new tab
- If at limit, show notification and prevent creation
- Notification should auto-dismiss after 3 seconds
- [+] button could be disabled/grayed when at limit (optional)

#### 8. Initial State
On first page load:
- No tabs exist initially
- First click on [+] creates the first tab
- This first tab becomes active automatically

#### 9. Edge Cases
- **First tab creation**: Should work even when no tabs exist
- **Tab at limit (10)**: Prevent creation, show warning
- **Rapid clicking [+]**: Debounce or disable button temporarily to prevent duplicates
- **Tab name overflow**: Long names should truncate with ellipsis (...)
- **No localStorage yet**: Tabs are not persistent in this phase (Phase 37 handles persistence)

#### 10. Styling Requirements
Apply Dark Neobrutalism theme:
- Active tab: bold background, thick border, offset shadow
- Inactive tab: subtle background, thin border
- Close button [×]: small, circular or square, appears on hover (optional)
- Tabs should have consistent height (45px, matching tab bar)
- Tab spacing: small gap between tabs (4-8px)
- Use CSS variables from theme system

#### 11. Accessibility
- Each tab must be keyboard focusable
- Add `role="tab"` to tab elements
- Add `aria-selected="true"` to active tab, `aria-selected="false"` to inactive
- Add `aria-label="Tab: Untitled Project"` to each tab
- Close button should have `aria-label="Close tab"`
- Ensure focus outlines are visible

#### 12. Files to Create/Modify
- `editor.html` - Tab bar structure already exists from Phase 32
- `assets/css/editor.css` - Add tab element styles (active/inactive states)
- `assets/js/tab-manager.js` - Create new file for tab management logic
- `assets/js/uuid-generator.js` - Create simple UUID generator or use crypto.randomUUID()

#### 13. Data Attributes
- `data-action="create-tab"` on [+] button (already added in Phase 32)
- `data-tab-id="[UUID]"` on each tab element
- `data-tab-close` on close button [×] (for Phase 35)

#### 14. JavaScript Organization
Create a TabManager class or module with methods:
- `createTab()` - Generate UUID, create tab object, render tab
- `renderTab(tabData)` - Create and insert tab DOM element
- `getActiveTab()` - Return currently active tab
- `setActiveTab(tabId)` - Switch active state (used in Phase 34)
- `getTabCount()` - Return number of tabs
- Initialize on page load

#### 15. What NOT to Do
- ❌ Do NOT implement tab switching yet (that's Phase 34)
- ❌ Do NOT make close button functional (that's Phase 35)
- ❌ Do NOT implement tab renaming (comes in later phases)
- ❌ Do NOT implement tab persistence (that's Phase 37)
- ❌ Do NOT load any project data into the tab yet
- This phase is **tab creation ONLY**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Phase 32**: Tab bar structure already exists
- **Phase 34**: Will implement tab switching logic
- **Phase 35**: Will implement tab close functionality
- **Phase 37**: Will implement tab persistence
- **Code of Conduct**: Use event delegation, cache selectors, follow naming conventions

## Testing Checklist
- [ ] Click [+] button creates a new tab
- [ ] New tab displays "Untitled Project" name
- [ ] New tab has unique UUID (check in console or DevTools)
- [ ] New tab is automatically active (highlighted)
- [ ] Previous tabs become inactive when new tab created
- [ ] Tab has close button [×] visible
- [ ] Can create up to 10 tabs
- [ ] 11th tab creation shows warning notification
- [ ] Warning notification: "⚠️ Maximum 10 tabs allowed"
- [ ] Warning auto-dismisses after 3 seconds
- [ ] Tabs display side-by-side in tab bar
- [ ] Tabs have spacing between them
- [ ] Active tab has distinct visual style
- [ ] Inactive tabs have dimmed visual style
- [ ] No console errors
- [ ] Tab bar scrolls horizontally if many tabs (overflow-x: auto)

## Done When
✅ [+] button creates new tabs  
✅ Tabs have unique UUIDs  
✅ Default name "Untitled Project" displayed  
✅ Newly created tab is automatically active  
✅ Max 10 tabs enforced with warning  
✅ Active/inactive states visible  
✅ Dark Neobrutalism styling applied  
✅ All tests pass  
✅ Ready for Phase 34 (Tab Switching)

---
**Phase**: 39 | **Component**: Editor | **Group**: Tab Management  
**Estimated Time**: 20 min

## Implementation Notes
- Use `crypto.randomUUID()` for UUID generation (modern browsers)
- Fallback to simple timestamp-based ID if crypto not available
- Keep tab state in JavaScript array/object initially (localStorage in Phase 37)
- This phase only creates tabs; switching logic comes next in Phase 34
