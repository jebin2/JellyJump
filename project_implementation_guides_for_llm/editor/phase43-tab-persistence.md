# Phase 43: Tab Persistence

## Goal
Save tab list to localStorage, restore tabs on page load, persist active tab

## Group
**Tab Management**

## Feature to Implement

### ONE Feature: Tab Persistence in localStorage
**Purpose**: Save and restore user's open tabs and project data across browser sessions

**Requirements**:

#### 1. What to Build
Implement tab persistence using localStorage:
- Save all open tabs to localStorage when tabs change
- Save each tab's project data (timeline, settings, etc.)
- Restore tabs on page load
- Restore which tab was active
- Handle first-time load (no saved data)

#### 2. What Data to Save
For each tab, persist:
```
{
  id: string (UUID),
  name: string,
  isActive: boolean,
  hasUnsavedChanges: boolean,
  projectData: {
    timeline: [],
    clips: [],
    mediaLibrary: [],
    settings: {}
  },
  createdAt: timestamp,
  lastModified: timestamp
}
```

Also save:
- Array of all tab IDs (in order)
- Active tab ID
- Last save timestamp

#### 3. localStorage Key Structure
Use these keys:
- `mediabunny_editor_tabs` - Array of tab data objects
- `mediabunny_editor_active_tab` - ID of active tab
- `mediabunny_editor_last_save` - Timestamp of last save

#### 4. When to Save
Automatically save to localStorage:
- **After creating new tab** (Phase 33)
- **After closing tab** (Phase 35)
- **After switching tabs** (Phase 34)
- **After tab data changes** (timeline edits, property changes - later phases)
- **Debounced**: Wait 500ms after changes to avoid excessive writes

#### 5. Page Load Restoration Flow
On page load (`DOMContentLoaded` or similar):
1. Check if localStorage has saved tabs
2. If no saved data:
   - Show empty state (no tabs)
   - Wait for user to click [+] to create first tab
3. If saved data exists:
   - Parse tab data from localStorage
   - Recreate all tabs in the UI
   - Restore tab names, order, states
   - Activate the previously active tab
   - Load that tab's project data into editor
   - Log: "Restored [N] tabs from localStorage"

#### 6. Tab Restoration Details
For each restored tab:
- Recreate tab DOM element with correct UUID
- Set tab name (could be "Untitled Project" or custom name)
- Show asterisk (*) if `hasUnsavedChanges: true`
- Load project data into internal state
- Don't activate yet (only activate the previously active tab)

#### 7. Active Tab Restoration
After all tabs restored:
- Find tab with matching active tab ID
- If found, activate that tab (call `switchToTab()` from Phase 34)
- If not found (data corruption), activate first tab
- Load that tab's project data into editor UI

#### 8. Data Validation
Validate restored data:
- Check if data is valid JSON
- Check if required fields exist (id, name, etc.)
- If corrupted, skip that tab or show error
- If all data corrupted, clear localStorage and start fresh
- Log validation errors to console

#### 9. Error Handling
Handle these scenarios:
- **localStorage not available**: Show warning, continue without persistence
- **localStorage quota exceeded**: Show error "Storage full, couldn't save"
- **Corrupted data**: Clear bad data, start fresh
- **Missing tab data**: Skip that tab, load others
- **Version mismatch** (if data structure changes): Migrate or clear data

#### 10. localStorage Size Management
Monitor storage size:
- Estimate: ~5MB limit in most browsers
- Each tab with project data could be 100-500KB
- Warn if approaching limit (> 4MB)
- Optional: Compress data with JSON.stringify optimization
- Don't store large blobs (media files stay in IndexedDB)

#### 11. First-Time User Experience
When no saved data exists:
- Show empty state (no tabs initially)
- User clicks [+] to create first tab
- That tab is saved immediately
- OR: Auto-create one tab on first load (design choice)

Recommendation: **Auto-create first tab** if no saved data, better UX.

#### 12. Debounced Saving
Implement debounced save to avoid excessive writes:
- Use debounce function (500ms delay)
- Each tab change resets the timer
- After 500ms of no changes, save to localStorage
- Exception: Tab close/create saves immediately (important actions)

#### 13. Integration with Previous Phases
Connect to existing functionality:
- **Phase 33** (Create Tab): Save after creation
- **Phase 34** (Tab Switch): Save active tab ID
- **Phase 35** (Tab Close): Save after removal, update localStorage
- **Phase 36** (Unsaved): Real save now updates localStorage and marks `hasUnsavedChanges: false`

#### 14. Styling Requirements
No new UI in this phase, but:
- Ensure asterisk (*) displays on restored unsaved tabs
- Ensure tab names display correctly on restoration
- Smooth loading (no flash of empty state if data exists)

#### 15. Accessibility
- During restoration, announce to screen readers: "Restored [N] tabs"
- Focus should move to active tab after restoration
- Loading should not block keyboard navigation

#### 16. Files to Create/Modify
- `assets/js/tab-manager.js` - Extend with save/restore methods
- `assets/js/storage-helper.js` - Create new file for localStorage utils
- `assets/js/main.js` or `editor.html` - Add restoration call on page load

#### 17. JavaScript Organization
Extend TabManager class:
- `saveToLocalStorage()` - Save all tabs to localStorage
- `loadFromLocalStorage()` - Restore tabs on page load
- `serializeTabData(tabId)` - Convert tab to JSON-safe object
- `deserializeTabData(data)` - Convert JSON back to tab object
- `validateTabData(data)` - Check data integrity

Create StorageHelper utility:
- `saveItem(key, value)` - Save to localStorage with error handling
- `loadItem(key)` - Load from localStorage with parsing
- `removeItem(key)` - Remove from localStorage
- `clearAll()` - Clear all editor data
- `isAvailable()` - Check if localStorage available
- `getUsedSpace()` - Estimate storage usage

#### 18. Data Attributes
No new attributes needed for UI, but useful for debugging:
- `data-restored="true"` on tabs loaded from localStorage (optional)

#### 19. What NOT to Do
- ❌ Do NOT store media file blobs in localStorage (use IndexedDB, already done in Phase 30)
- ❌ Do NOT store video thumbnails in localStorage (too large, use IndexedDB)
- ❌ Do NOT implement cloud sync or account-based storage
- ❌ Do NOT implement export/import of tab data (that's Phase 99-100 for JSON)
- This phase is **localStorage persistence ONLY**

**MediaBunny Integration**: Not applicable for this phase

## References
- **Phase 33-36**: All tab functionality now persists
- **Phase 30**: Media files in IndexedDB, not localStorage
- **Phase 101**: Auto-save will use this persistence system
- **localStorage API**: Standard browser API, no external libraries

## Testing Checklist
- [ ] Create tab, refresh page → tab restored
- [ ] Create multiple tabs, refresh → all tabs restored in correct order
- [ ] Close tab, refresh → tab remains closed
- [ ] Switch to tab 2, refresh → tab 2 is active on reload
- [ ] Tab with asterisk (*), refresh → asterisk still shown
- [ ] First-time load (clear localStorage) → auto-creates first tab or shows empty state
- [ ] Corrupted localStorage data → clears and starts fresh
- [ ] localStorage not available → shows warning, continues without persistence
- [ ] Tab names restored correctly
- [ ] Active tab restored and activated
- [ ] Project data restored (timeline, clips - will see effect in later phases)
- [ ] Console logs restoration: "Restored [N] tabs"
- [ ] No flash of empty state if data exists
- [ ] Debounced save works (check localStorage in DevTools)
- [ ] localStorage doesn't grow excessively large

## Done When
✅ Tabs save to localStorage automatically  
✅ All tabs restored on page load  
✅ Active tab restored correctly  
✅ Tab order preserved  
✅ Unsaved changes (*) persist  
✅ Debounced saving implemented  
✅ Error handling for corrupted data  
✅ localStorage quota checks  
✅ All tests pass  
✅ Ready for Phase 38 (Media Panel Structure)

---
**Phase**: 43 | **Component**: Editor | **Group**: Tab Management  
**Estimated Time**: 20 min

## Implementation Notes
- Use `JSON.stringify()` and `JSON.parse()` for serialization
- Wrap all localStorage access in try-catch for quota errors
- This completes the Tab Management group (Phases 32-37)
- Future phases will use this persistence automatically
- Project data is mostly empty now, will populate in timeline/media phases
