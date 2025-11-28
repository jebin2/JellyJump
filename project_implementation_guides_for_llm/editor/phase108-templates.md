# Phase 108: Project Templates

## Goal
Start new projects from predefined templates

---

## What to Build

Project templates:
- Template gallery
- Pre-configured layouts
- Load template button
- Apply to new project
- Customize after load
- Save custom templates

---

## Feature to Implement

### ONE Feature: Template System
**Purpose**: Quick start for common formats (Social Media, YouTube)

**Requirements**:

#### 1. What to Build
- **UI**: "New Project" modal (Phase 33 update).
- **Options**:
    - "Blank Project"
    - "Instagram Story (9:16)"
    - "YouTube (16:9)"
- **Logic**:
    - Load a hardcoded JSON structure for the selected template.
    - Sets resolution, frame rate, maybe intro text clip.

#### 2. Files to Create/Modify
- `assets/js/project/templates.js`
- `assets/js/ui/new-project-modal.js`

#### 3. What NOT to Do
- ❌ Do NOT build a template editor. Just hardcode 2-3 JSONs.

---

## Testing Checklist Checklist
- [ ] Selecting template sets correct resolution
- [ ] Selecting template adds default clips (if any)

---

## Done When
✅ Templates work  
✅ Ready for Phase 103 (Polish)
