# Phase 18: Optional Control Components

## Goal
Make control bar components optional and configurable for different use cases (player vs editor).

---

## What to Build

Flexible control configuration system:
- Configuration object with boolean flags for each control
- Runtime methods to show/hide controls
- Preset configurations (Player, Editor, Minimal)
- Responsive control layout
- CSS-based visibility management

---

## Features to Implement

### Feature 1: Control Configuration Object
**Purpose**: Define which controls are visible

**Requirements**:
- Create configuration object with boolean flags for each control
- Controls: play/pause, progress, time, volume, fullscreen, speed, download, navigation, loop, screenshot, settings
- Store configuration in player instance
- Default: All controls visible (backward compatibility)
- Support runtime configuration updates

### Feature 2: Conditional Rendering
**Purpose**: Show/hide controls based on configuration

**Requirements**:
- Each control checks configuration before rendering
- Use CSS classes for visibility: `.control--hidden`
- Alternatively, don't render DOM elements if `show*: false`
- Apply configuration on initialization
- Update DOM when configuration changes
- Smooth transitions when toggling visibility

### Feature 3: Configuration Methods
**Purpose**: Allow runtime updates to control visibility

**Requirements**:
- Method to set full configuration: `setControlsConfig(config)`
- Method to toggle individual control: `toggleControl(name, visible)`
- Method to get current configuration: `getControlsConfig()`
- Emit event when configuration changes
- Update UI immediately when configuration changes

### Feature 4: Preset Configurations
**Purpose**: Quick setup for common scenarios

**Requirements**:
- **Player Mode** (default): All controls visible
- **Editor Mode**: Hide download, navigation, loop (keep playback essentials)
- **Minimal Mode**: Only play/pause, progress, time
- **Custom Mode**: User-defined configuration
- Easy to apply: `player.applyPreset('editor')`

### Feature 5: Responsive Control Layout
**Purpose**: Adjust control visibility based on available space

**Requirements**:
- On narrow screens: Hide less critical controls
- Priority order: Play/Pause > Progress > Time > Volume > Others
- Use ResizeObserver to detect overflow
- Show hidden controls in overflow menu ("⋮" button) - optional
- Mobile: Show only essential controls by default

**Responsive Strategy**:
- Desktop (1024px+): Show all configured controls
- Tablet (768-1023px): Hide download, navigation
- Mobile (<768px): Show only play/pause, progress, time, fullscreen

---

## Interaction Behavior

**User Flow 1: Apply Editor Preset**:
1. Initialize player with editor preset
2. Controls bar shows: play/pause, progress, time, volume, fullscreen, speed, screenshot, settings
3. Hidden: download, navigation, loop buttons
4. Layout adjusts smoothly

**User Flow 2: Runtime Configuration**:
1. Player running with default config
2. Call `player.toggleControl('download', false)`
3. Download button fades out or is removed
4. Control bar reflows to fill space

**User Flow 3: Custom Configuration**:
1. Create custom config object
2. Call `player.setControlsConfig(customConfig)`
3. Only specified controls visible
4. All others hidden

---

## Edge Cases

- Hiding all controls: Ensure at least play/pause is functional
- Control dependencies: If hiding progress, should time still show?
- Keyboard shortcuts: Should they work even if button hidden? (Yes)
- Mobile: Ensure minimum viable controls on small screens
- Screen reader: Announce control visibility changes

---

## Accessibility

- Hidden controls should be `aria-hidden="true"`
- Keyboard shortcuts work regardless of visual visibility
- Screen reader announces available controls
- Focus management: Skip hidden controls in tab order
- Provide alternative ways to access hidden features (e.g., keyboard shortcuts)

---

## What NOT to Do

- ❌ Don't remove control functionality, only visibility
- ❌ Don't break keyboard shortcuts for hidden controls
- ❌ Don't forget to handle dependencies between controls
- ❌ Don't hide critical controls (play/pause) on any preset
- ❌ Don't ignore screen reader accessibility

---

## Testing Checklist

- [ ] Default configuration shows all controls
- [ ] Setting config to hide control removes it from UI
- [ ] Setting config to show control adds it to UI
- [ ] `setControlsConfig()` updates UI immediately
- [ ] `toggleControl()` works for individual controls
- [ ] `getControlsConfig()` returns current state
- [ ] Preset configurations work correctly
- [ ] Player mode preset shows all controls
- [ ] Editor mode preset hides download, navigation, loop
- [ ] Minimal mode preset shows only essentials
- [ ] Responsive layout hides controls on small screens
- [ ] No JavaScript errors with missing controls
- [ ] Controls still functional after visibility changes
- [ ] Keyboard shortcuts work for hidden controls

---

## Done When

✅ Configuration object defined  
✅ `setControlsConfig()` method implemented  
✅ `toggleControl()` method works  
✅ `getControlsConfig()` returns current state  
✅ Presets (player, editor, minimal) implemented  
✅ Controls show/hide based on configuration  
✅ Responsive behavior implemented  
✅ All tests pass  
✅ Keyboard accessible  
✅ Ready for next phase

---

**Phase**: 18 | **Component**: Player  
**Estimated Time**: 50-70 minutes
