# Task Type Architecture Refactoring Branch

**Branch:** `feature/task-type-refactoring`
**Base:** `develop`
**Created:** 2025-11-20
**Status:** 🚧 In Progress - Phase 1

---

## Overview

This branch implements an **aggressive refactoring** of the task type architecture as outlined in [REFACTORING_PLAN.md](./REFACTORING_PLAN.md).

### Goals

- 🎯 Plugin-based task definitions
- 🔥 Remove all conditional logic (43+ locations)
- ⚡ Database schema optimizations
- 🆕 Type-safe enums throughout
- ✅ Clean architecture with zero technical debt

### Approach

**Aggressive refactoring with breaking changes:**
- No backward compatibility constraints
- New database instance for testing
- Delete legacy code immediately
- Fix errors as they arise

---

## Progress

### Phase 1: Foundation & Database Setup (Days 1-3)

**Target:** Create new database, enums, and registries

- [ ] **Day 1: Database Setup**
  - [ ] Create new PostgreSQL database: `mvp_vision_ai_labeler_v2`
  - [ ] Add task_type column to annotations table
  - [ ] Remove legacy classes column
  - [ ] Add database-level enum constraints
  - [ ] Create optimized indexes

- [ ] **Day 2: Backend Foundation**
  - [ ] Create TaskType and AnnotationType enums
  - [ ] Implement TaskDefinition abstract base class
  - [ ] Create TaskRegistry singleton
  - [ ] Implement concrete task definitions (Detection, Segmentation, Classification, Geometry)

- [ ] **Day 3: Frontend Foundation**
  - [ ] Create frontend TaskType and AnnotationType enums
  - [ ] Implement frontend TaskRegistry
  - [ ] Create task definition objects for all tasks
  - [ ] Wire up registry initialization

**Milestone 1:** ✅ Clean foundation with new DB and registries

---

### Phase 2: Aggressive Backend Migration (Days 4-8)

**Target:** Complete backend migration with breaking changes

- [ ] **Day 4: Database Models**
  - [ ] Update Annotation model with task_type column
  - [ ] Remove legacy classes field completely
  - [ ] Create Alembic migration
  - [ ] Fix all model references

- [ ] **Day 5: Annotation Endpoints**
  - [ ] Remove get_task_type_from_annotation() function
  - [ ] Use direct task_type column access
  - [ ] Update all CRUD operations
  - [ ] Remove no_object special case handling

- [ ] **Day 6: Image Status Service**
  - [ ] Delete ANNOTATION_TYPE_TO_TASK dict
  - [ ] Use registry exclusively
  - [ ] Simplify queries (no OR clauses)
  - [ ] Implement 10x faster queries

- [ ] **Day 7: Export Services**
  - [ ] Remove inline task mappings
  - [ ] Create base exporter class
  - [ ] Refactor COCO/YOLO/DICE exporters
  - [ ] Use task definitions for filtering

- [ ] **Day 8: Testing & Fixes**
  - [ ] Run test suite
  - [ ] Fix all breaking changes
  - [ ] Update integration tests
  - [ ] Validate performance improvements

**Milestone 2:** ✅ Backend completely refactored, no legacy code

---

### Phase 3: Aggressive Frontend Migration (Days 9-13)

**Target:** Delete all conditional logic, implement clean rendering

- [ ] **Day 9: Annotation Store**
  - [ ] Change currentTask to TaskType enum
  - [ ] Remove all string-based task handling
  - [ ] Add strict validation
  - [ ] Update all store methods

- [ ] **Days 10-12: Canvas Component Rewrite**
  - [ ] Delete ALL task conditionals (15+ locations)
  - [ ] Extract task-specific logic to plugins
  - [ ] Use registry for tool rendering
  - [ ] Use registry for validation
  - [ ] Target: 3300 → 1800 lines (-45%)

- [ ] **Day 13: Other Components & API**
  - [ ] Refactor TopBar, RightPanel, ExportModal
  - [ ] Delete all hardcoded task strings
  - [ ] Update API client with TaskType enum
  - [ ] Fix TypeScript errors
  - [ ] Fix runtime errors

**Milestone 3:** ✅ Frontend completely refactored, ~1500 lines removed

---

### Phase 4: Testing & Polish (Days 14-15)

**Target:** Comprehensive testing and documentation

- [ ] **Day 14: Testing**
  - [ ] Unit tests for task definitions
  - [ ] Integration tests for workflows
  - [ ] E2E tests for UI
  - [ ] Performance benchmarks
  - [ ] Validate 10x query improvement

- [ ] **Day 15: Documentation & PR**
  - [ ] Code cleanup
  - [ ] Update architecture docs
  - [ ] "How to add a new task" guide
  - [ ] Create PR for review
  - [ ] Prepare migration scripts

**Milestone 4:** ✅ Ready for review and merge

---

## Success Criteria

### Code Quality
- ✅ Canvas.tsx reduced to <1800 lines (-45%)
- ✅ Total reduction: ~925 lines (-21%)
- ✅ Zero hardcoded task conditionals
- ✅ All legacy code removed
- ✅ Test coverage ≥ 85%

### Performance
- ✅ Image status queries: <100ms (vs ~1s)
- ✅ No performance regressions
- ✅ Export generation: same or faster

### Architecture
- ✅ Plugin-based task system
- ✅ Single source of truth
- ✅ Type-safe throughout
- ✅ Add new task in ~30 minutes

---

## Database Changes

### New Schema Optimizations

```sql
-- Add task_type column to annotations
ALTER TABLE annotations ADD COLUMN task_type VARCHAR(50) NOT NULL;
CREATE INDEX idx_annotations_task_type ON annotations(task_type);

-- Remove legacy classes column
ALTER TABLE annotation_projects DROP COLUMN classes;

-- Add database-level enum
CREATE TYPE task_type_enum AS ENUM (
    'classification',
    'detection',
    'segmentation',
    'geometry',
    'keypoint',
    'line'
);
```

### Migration Strategy

**For Development:**
- Create new database: `mvp_vision_ai_labeler_v2`
- Fresh schema with optimizations
- Test thoroughly before production

**For Production Deployment:**
- Option 1: Migrate existing DB with script
- Option 2: Fresh start (if acceptable)
- Planned maintenance window required

---

## Architecture Overview

### Before Refactoring

```
Task Logic
├── Scattered conditionals (43+ locations)
├── Hardcoded ANNOTATION_TYPE_TO_TASK dict
├── String-based task types
└── Legacy dual storage (classes + task_classes)
```

### After Refactoring

```
Task System
├── TaskRegistry (singleton)
│   ├── TaskType enum (type-safe)
│   └── AnnotationType enum
├── Task Definitions (plugin-based)
│   ├── DetectionTask
│   ├── SegmentationTask
│   ├── ClassificationTask
│   └── GeometryTask
└── Services (registry-aware)
    ├── ImageStatusService (10x faster)
    ├── ExportServices (unified)
    └── AnnotationEndpoints (simplified)
```

---

## Development Guidelines

### Working on This Branch

1. **Break things aggressively**
   - No need for backward compatibility
   - Delete legacy code immediately
   - Fix errors as they arise

2. **Test frequently**
   - Run tests after each change
   - Validate database queries
   - Check UI functionality

3. **Commit regularly**
   - Small, focused commits
   - Clear commit messages
   - Push daily for backup

4. **Follow the plan**
   - Work through phases sequentially
   - Check off tasks as completed
   - Update this README with progress

### Testing Strategy

```bash
# Backend tests
cd backend
pytest

# Frontend type checking
cd frontend
npm run type-check

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e
```

---

## Timeline

**Total Duration:** 3 weeks (15 working days)

| Phase | Days | Status |
|-------|------|--------|
| Phase 1: Foundation | 1-3 | 🔲 Not Started |
| Phase 2: Backend | 4-8 | 🔲 Not Started |
| Phase 3: Frontend | 9-13 | 🔲 Not Started |
| Phase 4: Testing | 14-15 | 🔲 Not Started |

**Start Date:** TBD
**Target Completion:** TBD

---

## Resources

- [REFACTORING_PLAN.md](./REFACTORING_PLAN.md) - Detailed implementation plan
- [Task Registry Pattern](https://martinfowler.com/eaaCatalog/registry.html)
- [Plugin Architecture](https://en.wikipedia.org/wiki/Plug-in_(computing))
- [TypeScript Enums](https://www.typescriptlang.org/docs/handbook/enums.html)

---

## Notes

### Database Backup Strategy

Before starting Phase 1, create backup of current database:

```bash
pg_dump mvp_vision_ai_labeler > backup_before_refactoring.sql
```

### Rollback Strategy

- **Before merge:** Just don't merge the branch
- **After merge:** Revert the merge commit
- **After deployment:** Restore DB backup + redeploy old version

Recovery time: ~30 minutes with backup

---

**Last Updated:** 2025-11-20
**Maintained By:** Development Team
**Questions?** See [REFACTORING_PLAN.md](./REFACTORING_PLAN.md)
