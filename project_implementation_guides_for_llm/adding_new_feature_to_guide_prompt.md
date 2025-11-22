# Template: Adding New Features to Implementation Guide

## Purpose
Use this prompt template when you need to add, update, or modify features in the MediaBunnyPlayer implementation guide. This ensures new features are properly integrated with correct phase numbering.

---

## Feature Request Template

### Features to Add/Modify

**Component**: [Core / Player / Editor / Dashboard]

**Feature List**:
1. [Feature name] - [Brief description of what it does]
2. [Feature name] - [Brief description]
3. ...

**Examples**:
- Frame Screenshot - Capture current video frame and save as PNG
- Playback Speed Control - Adjust video speed from 0.25x to 2x
- A-B Loop - Loop specific section of video with start/end markers

---

## Implementation Requirements

### 1. Phase Granularity
✅ **REQUIRED**: Each distinct feature should be its own separate phase
- Makes implementation easier for LLMs
- Allows incremental progress tracking
- Clear testing and verification per feature

❌ **AVOID**: Combining multiple features into one phase

### 2. Phase Numbering
When adding new phases, you MUST renumber subsequent phases:

**Example**: Adding 3 new features to Player (currently phases 15-25)
- Insert new phases where appropriate (e.g., after phase 16)
- Old phases 17-25 become new phases 20-28
- Editor phases 26-32 become 29-35
- **Total phases increase** (e.g., 32 → 35)

**Critical**: Update phase numbers in:
- [ ] Phase file names
- [ ] Phase file titles (# Phase XX:)
- [ ] Phase footer (**Phase**: XX)
- [ ] README.md phase listings
- [ ] Overview.md files (player/editor/core)
- [ ] goal.md files
- [ ] LLM_PROMPT.md
- [ ] LLM_VERIFIER_PROMPT.md
- [ ] main.md (if applicable)
- [ ] Dependency diagrams
- [ ] Time estimates

### 3. Insertion Point
Specify WHERE new phases should be inserted:

**Options**:
- **After existing phase**: "Insert after Phase 16 (Playlist)"
- **Before existing phase**: "Insert before Phase 22 (Upload)"
- **At component start**: "Insert at beginning of Player section"
- **At component end**: "Insert at end of Player  section"

**Recommended strategy**: Insert advanced features BEFORE polish/upload/management phases

### 4. Feature Details

For each feature, provide:

#### Required Information:
- **Feature name**: Clear, concise name
- **Purpose**: What problem does it solve?
- **UI location**: Where does it appear? (controller, playlist, modal, etc.)
- **User interaction**: How do users activate it? (button, keyboard shortcut, etc.)
- **MediaBunny integration**: Which MediaBunny APIs are needed?

#### Optional Information:
- **Dependencies**: Does it require other phases to be complete first?
- **Edge cases**: Special scenarios to handle
- **Estimated time**: How long to implement (20-60 min typical)

---

## Example Feature Request

```markdown
**Component**: Player

**Features to Add**:
1. Picture-in-Picture Mode - Enable browser PiP for video
2. Volume Boost - Allow volume above 100% (up to 200%)
3. Auto Quality Switch - Automatically adjust quality based on network

**Insertion Point**: After Phase 21 (A-B Loop), before Phase 22 (Upload)

**Feature Details**:

### Feature 1: Picture-in-Picture Mode
- **Purpose**: Watch video in floating window while browsing other tabs
- **UI Location**: PiP button in controller
- **User Interaction**: Click button or keyboard shortcut (Ctrl+P)
- **MediaBunny Integration**: Consult mediabunny-llms-full.md for PiP support
- **Estimated Time**: 30 minutes

### Feature 2: Volume Boost
- **Purpose**: Increase volume beyond standard 100% for quiet videos
- **UI Location**: Volume slider in controller
- **User Interaction**: Volume slider extends to 200%, visual indicator when boosted
- **MediaBunny Integration**: Audio gain control via MediaBunny
- **Estimated Time**: 25 minutes

### Feature 3: Auto Quality Switch
- **Purpose**: Adapt video quality based on available bandwidth
- **UI Location**: Quality selector shows "Auto (adapting...)"
- **User Interaction**: Automatic, can be toggled on/off
- **MediaBunny Integration**: Quality detection and stream switching
- **Estimated Time**: 45 minutes
```

---

## Checklist Before Submitting

Before asking for feature implementation, ensure:

- [ ] Feature list is complete and detailed
- [ ] Each feature warrants its own phase (not too small/trivial)
- [ ] Insertion point is clearly specified
- [ ] Component is identified (Core/Player/Editor/Dashboard)
- [ ] MediaBunny integration needs are considered
- [ ] Understand that subsequent phases will be renumbered
- [ ] Ready for potential changes to 20+ documentation files

---

## Expected Workflow

1. **You provide**: Feature list using this template
2. **LLM creates**: Implementation plan showing:
   - New phase file names and numbers
   - Renumbering strategy for existing phases
   - Documentation files to update
3. **You approve**: Implementation plan
4. **LLM executes**:
   - Creates new phase files
   - Renames and renumbers existing phases
   - Updates all documentation
   - Verifies consistency
5. **LLM provides**: Completion walkthrough

---

## Notes

- **Phase count will increase**: Adding N features adds N phases to total
- **Time estimates will change**: New features add to total implementation time
- **Major update**: Expect 20-30 file changes for multiple new features
- **MediaBunny required**: All video features should use MediaBunny APIs
- **Theme consistency**: New features must follow Dark Neobrutalism theme

---

## Quick Start

Copy-paste this template and fill in your features:

```markdown
**Component**: [Core/Player/Editor/Dashboard]

**Features to Add**:
1. [Name] - [Description]
2. [Name] - [Description]

**Insertion Point**: [Where to insert]

**Feature Details**:
[Provide details for each feature]
```

Then send to LLM with: "I need to add new features to the implementation guide. See attached prompt."