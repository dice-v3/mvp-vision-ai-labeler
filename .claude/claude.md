# Claude Code Guidelines for Vision AI Labeler

This document contains project-specific guidelines for Claude Code when working on the Vision AI Labeler project.

---

## 📋 TODO Documentation Management

**CRITICAL**: Always maintain the project's TODO documentation when implementing features or making changes.

### 1. **Before Starting Any Implementation**

**ALWAYS** read and review the current state:
- 📖 **Primary**: `docs/ANNOTATION_IMPLEMENTATION_TODO.md`
  - Check the Progress Overview table for current phase status
  - Review the specific phase section you'll be working on
  - Understand dependencies and context from "Current Focus" section
  - Check Session Notes for recent work and known issues

**Example workflow**:
```
User: "Implement side-by-side diff view for Phase 11"

Assistant should:
1. Read docs/ANNOTATION_IMPLEMENTATION_TODO.md
2. Find Phase 11 section
3. Check current progress (85% - overlay mode complete)
4. Review what's pending (side-by-side mode, animation mode)
5. Then start implementation
```

### 2. **During Implementation**

**Track progress** in the TODO document:
- [ ] Mark tasks as complete when finished: `- [ ]` → `- [x]`
- [ ] Add implementation notes with file paths and line numbers
- [ ] Update progress percentages in the overview table
- [ ] Document any deviations from the original plan

**Example**:
```markdown
**11.2.3 Canvas Diff Overlay** (4-6h)
- [x] **Overlay Mode** (default): Show both versions on same canvas ← UPDATE THIS
  - Implementation: frontend/components/annotation/Canvas.tsx:1234-1567
  - Added color coding: red (removed), green (added), yellow (modified)
```

### 3. **After Completing Implementation**

**MUST** update the TODO document with:

#### A. Progress Overview Table
Update the phase status and progress percentage:
```markdown
| **Phase 11: Version Diff & Comparison** | **✅ Complete** | **100%** | **2025-11-26** |
```

#### B. Phase Section Updates
- Mark completed tasks with `[x]`
- Update status from `⏸️ Pending` → `🔄 In Progress` → `✅ Complete`
- Add "Implementation Time" if different from estimate
- Document key decisions and trade-offs

#### C. Session Notes
Add a new session note at the bottom of the document:
```markdown
### 2025-11-26 (PM): Phase 11 Side-by-Side Diff View ✅

**Task**: Implement side-by-side diff view mode

**Status**: ✅ Complete (~4 hours implementation time)

**Context**: [Brief context about why this was needed]

**Implementation Summary**:
1. [Key change 1] (Xh)
2. [Key change 2] (Xh)

**Commits**:
- `abc1234`: feat: Add side-by-side diff view mode

**Files Modified**:
- frontend/components/annotation/DiffCanvas.tsx (234 lines)
- frontend/lib/stores/annotationStore.ts (15 insertions)

**Key Achievements**:
- ✅ [Achievement 1]
- ✅ [Achievement 2]

**Testing**:
- [x] Test scenario 1
- [x] Test scenario 2
```

#### D. Current Focus Section
Update the "Current Focus" list to reflect what was just completed:
```markdown
**Current Focus**: Phase 11 (Version Diff & Comparison) - ✅ Complete (all features)
```

### 4. **File Path References**

When documenting implementations, ALWAYS include:
- **File paths**: Absolute or relative from project root
- **Line numbers**: Specific ranges for key changes
- **Function/Component names**: What was added/modified

**Good example**:
```markdown
- `backend/app/services/version_diff_service.py:218-260` (normalize_geometry function)
- `frontend/components/annotation/Canvas.tsx:656-677` (snapshotToAnnotation fix)
```

**Bad example**:
```markdown
- Updated the diff service
- Fixed canvas rendering
```

### 5. **When to Update**

| Trigger | Action Required |
|---------|----------------|
| **Starting a new phase** | Update phase status to `🔄 In Progress`, add start date |
| **Completing a task** | Mark task `[x]`, add file references |
| **Completing a phase** | Update to `✅ Complete`, add completion date, write session note |
| **Making architectural decisions** | Document in phase section or ADR |
| **Encountering blockers** | Add to Session Notes with context |
| **Deviating from plan** | Document reason and new approach |

### 6. **Cross-Phase Dependencies**

When working on a phase:
- ✅ Check "Dependencies" section to ensure prerequisites are met
- ✅ Update dependent phases if your changes affect them
- ✅ Document breaking changes or API modifications

---

## 📝 Documentation Standards

### Commit Message Format

When documenting commits in TODO:
```markdown
**Commits**:
- `abc1234`: feat: Add side-by-side diff view
- `def5678`: fix: Resolve geometry normalization issue
```

### Implementation Time Tracking

Always compare estimated vs actual time:
```markdown
**Duration**: 1-2 days (22h estimated, 8h actual)
```

This helps improve future estimates.

### Status Emoji Guide

| Emoji | Status | When to Use |
|-------|--------|-------------|
| ✅ | Complete | Phase/task finished and tested |
| 🔄 | In Progress | Currently being worked on |
| ⏸️ | Pending | Planned but not started |
| ⏭️ | Skipped | Intentionally deferred or cancelled |
| ❌ | Failed/Blocked | Attempted but couldn't complete |

---

## 🎯 Implementation Workflow Summary

```
1. Read docs/ANNOTATION_IMPLEMENTATION_TODO.md
   ↓
2. Find relevant phase and check status
   ↓
3. Review dependencies and current focus
   ↓
4. Start implementation (mark as 🔄 In Progress)
   ↓
5. During work: mark completed tasks [x]
   ↓
6. After completion: Update all sections
   - Progress table
   - Phase status (✅ Complete)
   - Add Session Note
   - Update Current Focus
   ↓
7. Verify all documentation is accurate
```

---

## 🚨 Critical Reminders

1. **NEVER** skip updating `docs/ANNOTATION_IMPLEMENTATION_TODO.md` after implementation
2. **ALWAYS** read the TODO doc before starting any phase work
3. **UPDATE** progress percentages and completion dates
4. **DOCUMENT** deviations from the original plan
5. **ADD** session notes for significant implementations
6. **KEEP** file paths and line numbers accurate

---

## 📚 Related Documents

- `docs/ANNOTATION_IMPLEMENTATION_TODO.md` - Main implementation tracking (PRIMARY)
- `docs/ARCHITECTURE_SUMMARY.md` - Project architecture overview
- `docs/phase-*.md` - Detailed phase planning documents
- `docs/architecture-decision-records.md` - ADRs for major decisions

---

**Last Updated**: 2025-11-26
**Maintained by**: Claude Code + Development Team
