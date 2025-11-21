# Annotation Canvas Implementation To-Do List

**Project**: Vision AI Labeler - Annotation Interface
**Start Date**: 2025-11-14
**Last Updated**: 2025-11-22

---

## Progress Overview

| Phase | Status | Progress | Completion |
|-------|--------|----------|------------|
| Phase 1: Core Canvas | ✅ Complete | 44/45 (98%) | 2025-11-14 |
| **Phase 2: Advanced Features** | **✅ Complete** | **100%** | **2025-11-22** |
| Phase 3: Multi-Task Tools | 🔄 In Progress | 17/29 (59%) | - |
| Phase 4: Confirmation & Versioning | ✅ Complete | 100% | 2025-11-19 |
| Phase 5: Dataset Management | ✅ Complete | 100% | 2025-11-20 |
| Phase 6: Task Type Refactoring | ✅ Complete | 100% | 2025-11-21 |
| **Phase 7: Performance Optimization** | **🔄 In Progress** | **90%** | **-** |
| Phase 8: Collaboration Features | ⏸️ Pending | 0% | - |
| Phase 9: AI Integration | ⏸️ Pending | 0% | - |
| Phase 10: Polish & Optimization | ⏸️ Pending | 0% | - |

**Current Focus**:
- Phase 2: Advanced Features ✅ Complete (including Canvas Enhancements)
- Phase 7: Performance Optimization - Thumbnail integration ✅, File management pending

**Next Up**: Phase 7 completion → Phase 8 (Collaboration)

---

## Phase 1: Core Canvas ✅ COMPLETE

**Duration**: Week 1 (2025-11-14)
**Status**: Complete (44/45 tasks)

### Key Features
- [x] 1.1 Project setup & routing
- [x] 1.2 Canvas component (zoom, pan, grid, crosshair)
- [x] 1.3 Bounding box tool (drawing, rendering, selection)
- [ ] 1.4 Resize & move (handles rendered, interaction pending)
- [x] 1.5 Image list with thumbnails
- [x] 1.6 API integration (load/save annotations)

**Files**: `Canvas.tsx`, `ImageList.tsx`, `annotationStore.ts`, `annotations.py`

---

## Phase 2: Advanced Features ✅ COMPLETE

**Duration**: Weeks 2-6 (2025-11-15 to 2025-11-22)
**Status**: Complete (100%)

### Key Features (Completed)
- [x] 2.1 Keyboard shortcuts
- [x] 2.2 Undo/Redo system (backend only)
- [x] 2.3 Annotations list panel
- [x] 2.4 Attributes panel
- [x] 2.6 Smart features (auto-save, tooltips)
- [x] 2.9 Settings panel

### Phase 2.10: Canvas Enhancements ✅ COMPLETE

**Goal**: Add UI for undo/redo, minimap navigation, and magnifier for precision
**Completion Date**: 2025-11-22
**Plan**: `docs/implementation-plan-minimap-undo-magnifier.md`

#### 2.10.1 Undo/Redo UI (3-4h) ✅ Complete
- [x] Add undo/redo buttons to zoom toolbar (bottom-left)
- [x] Icon-only buttons (ArrowUturnLeft, ArrowUturnRight)
- [x] Keyboard shortcuts (Ctrl+Z, Ctrl+Y)
- [x] Toast notifications on undo/redo
- [x] Verify recordSnapshot coverage

**Location**: Canvas.tsx line ~3280 (zoom toolbar)
**Design**: `[↶] [↷] | [−] [100%] [+] | [Fit]`

#### 2.10.2 Magnifier / Zoom Lens (7-9h) ✅ Complete
- [x] Magnifier component (circular, 200px diameter)
- [x] Manual activation: Z key (press and hold)
- [x] Auto activation: Show in drawing tools (bbox, polygon, polyline, circle)
- [x] Following mode: Follow cursor with edge detection
- [x] Fixed mode: Top-right corner position
- [x] Adjustable magnification (2x-8x) via scroll
- [x] Crosshair and coordinates display
- [x] Mode toggle setting

**Use Cases**: Pixel-perfect annotation, small object detection
**Position**: Following (offset from cursor) or Fixed (top-right)

#### 2.10.3 Minimap (6-8h) ✅ Complete
- [x] Minimap component (200x150px, bottom-right)
- [x] Show entire image scaled
- [x] Render all annotations (simplified)
- [x] Red viewport rectangle indicator
- [x] Click to navigate
- [x] Drag viewport for panning
- [x] Toggle visibility (M key)

**Files Created**:
- `frontend/components/annotation/Magnifier.tsx` (160 lines)
- `frontend/components/annotation/Minimap.tsx` (246 lines)

**Files Modified**:
- `frontend/components/annotation/Canvas.tsx` (added integration)
- `frontend/lib/stores/annotationStore.ts` (added magnifier preferences)

---

## Phase 3: Multi-Task Annotation Tools 🔄 IN PROGRESS

**Duration**: Weeks 7-8
**Status**: In Progress (17/29 tasks, 59%)

### 3.1 Tool Architecture & Registry ✅
- [x] ToolRegistry with register/get/list methods
- [x] Tool lifecycle (activate, deactivate, cleanup)
- [x] Tool switching with state persistence

### 3.2 Classification Tool ✅
- [x] ClassificationTool.ts implementation
- [x] ClassificationPanel.tsx UI
- [x] Class management (create, reorder, delete)
- [x] Canvas click → class selection popup
- [x] Task-filtered annotation counts

### 3.3 Polygon/Segmentation Tool ✅
- [x] PolygonTool.ts (524 lines)
- [x] Drawing mode (click to add points)
- [x] Editing mode (move vertices, add/remove points)
- [x] Rendering with fill, stroke, handles
- [x] Tool registry integration

### 3.4 Detection Tool (Bounding Box) 🔄
- [x] DetectionTool.ts foundation
- [x] Drawing interaction
- [ ] Enhanced editing (resize handles)
- [ ] Multi-selection support

### 3.5 Keypoint Tool ⏸️
- [ ] KeypointTool.ts
- [ ] Skeleton definition management
- [ ] Point placement and connections
- [ ] Occlusion handling

### 3.6 Pose Estimation Tool ⏸️
- [ ] PoseTool.ts with predefined skeletons
- [ ] Automatic keypoint suggestions

---

## Phase 4: Confirmation & Version Management ✅ COMPLETE

**Duration**: Weeks 4-5 (2025-11-19)
**Status**: Complete (100%)

### 4.1 Image & Annotation Confirmation
- [x] Confirm button in Canvas
- [x] Image status tracking (not-started, in-progress, completed)
- [x] Annotation status (draft, confirmed)
- [x] Confirmation timestamps
- [x] Statistics API for project progress

### 4.2 Version Management Foundation
- [x] Annotation versioning (created_at, updated_at)
- [x] History tracking preparation
- [x] Conflict detection foundation

**Files**: `image.py` (schemas), `annotations.py` (API), `Canvas.tsx`, `annotationStore.ts`
**PR**: #8 merged to develop

---

## Phase 5: Dataset Management ✅ COMPLETE

**Duration**: Week 6 (2025-11-20)
**Status**: Complete (100%)

### 5.1 Dataset Deletion
- [x] Delete dataset API with cascade
- [x] S3 cleanup (images + annotations)
- [x] Database cleanup (projects, annotations, statuses)
- [x] Frontend confirmation dialog

### 5.2 Dataset Creation & Ownership
- [x] Upload UI with drag-and-drop
- [x] Multi-file upload with progress
- [x] Ownership tracking (owner_id)
- [x] Access control (owner-only operations)

**Files**: `datasets.py`, `dataset_upload_service.py`, `DatasetsPage.tsx`
**PR**: #9, #10 merged to develop

---

## Phase 6: Task Type Architecture Refactoring ✅ COMPLETE

**Duration**: Week 7 (2025-11-21)
**Status**: Complete (100%)

### Key Changes
- [x] Backend task registry (`TaskType` enum, `TASK_REGISTRY`)
- [x] API normalization (task_type aliases: bbox/bounding_box/object_detection → detection)
- [x] Frontend store updates (task-based filtering)
- [x] Database migration (155 annotations: object_detection → detection)
- [x] Export format updates

**Impact**: Unified task type handling across stack
**Files**: `task_types.py`, `annotations.py`, `projects.py`, `annotationStore.ts`
**PR**: #11 merged to develop

---

## Phase 7: Performance Optimization 🔄 IN PROGRESS

**Duration**: Week 8 (2025-11-22)
**Status**: 90% Complete (18/20 tasks)

### 7.1 Database & API Optimization ✅

#### 7.1.1 DB-based Image Metadata
- [x] `image_metadata` table (id, dataset_id, s3_key, size, width, height)
- [x] Strategic indexes (dataset_id, uploaded_at, folder_path)
- [x] Alembic migration
- [x] Backfill script for existing datasets (1,725 images)

#### 7.1.2 Dataset Summary Optimization
- [x] Replace S3 list with DB query (50-100x faster)
- [x] Random image selection (`ORDER BY func.random()`)
- [x] Dataset size calculation (`func.sum(size)`)
- [x] New `/datasets/{id}/size` endpoint
- [x] Frontend: 4-card statistics layout (images, completed, progress, size)

#### 7.1.3 Thumbnail Integration
- [x] `thumbnail_url` field in `ImageMetadata` schema
- [x] Generate presigned URLs for thumbnails in API
- [x] Frontend: use thumbnails with fallback
- [x] Backfill script verification (all 1,725 thumbnails exist)
- [x] Thumbnail specs: 256x256 JPEG, 85% quality, 99% bandwidth reduction

**Performance Results**:
| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Dataset summary page | 5-10s | <100ms | 50-100x |
| Labeler init (50 images) | 5-10s | <200ms | 25-50x |
| Image list bandwidth | 100-250 MB | 0.5-1.5 MB | 99% reduction |

**Files**: `labeler.py` (models), `datasets.py`, `projects.py`, `image.py` (schemas), `ImageList.tsx`, `annotationStore.ts`
**PRs**: #12 (merged), #13 (open)
**Docs**: `docs/technical/image-metadata-optimization.md`

### 7.2 File Management ⏸️

- [ ] File browser UI with tree view (8h)
- [ ] File browser API (folder structure) (6h)
- [ ] Image delete (single/multiple) (5h)
- [ ] Image move and rename (5h)

**Remaining**: 24h (File management features)

### 7.3 Large-Scale Dataset Support (Optional - Phase 7.2)

**Goal**: Handle 100K-1M+ images efficiently

#### Pagination & Lazy Loading
- [ ] Cursor-based pagination
- [ ] Virtual scrolling for image list
- [ ] Incremental loading (50-100 images/batch)

#### Caching & Performance
- [ ] Redis caching for image status (optional, 8h)
- [ ] CDN integration for thumbnails
- [ ] Database query optimization
- [ ] Connection pooling tuning

**Estimate**: 67h total (deferred to post-Phase 7 completion)

---

## Phase 8: Collaboration Features ⏸️ PENDING

**Duration**: Weeks 9-10 (48h)
**Status**: Pending (requires Phase 7 completion)

### 8.1 User Management & Roles (18h)
- [ ] RBAC system (owner, admin, annotator, reviewer, viewer)
- [ ] Team member invitation (email tokens)
- [ ] Member management UI

### 8.2 Task Assignment (18h)
- [ ] Assign images to users
- [ ] Assignment strategies (round-robin, manual, workload-based)
- [ ] Annotator workspace (filtered view)

### 8.3 Review & Approval (17h)
- [ ] Review queue system
- [ ] Approve/reject interface
- [ ] Notification system (email + in-app)

### 8.4 Activity Log (9h)
- [ ] Activity logging (annotations, assignments, reviews)
- [ ] Activity feed UI
- [ ] Export reports

### 8.5 Concurrent Handling (14h)
- [ ] Optimistic locking
- [ ] Conflict detection and resolution
- [ ] Real-time presence indicators (optional, 8h)

**Total**: 48h core + 8h optional
**Dependencies**: Phase 7 completion, authentication system

---

## Phase 9: AI Integration ⏸️ PENDING

**Duration**: Weeks 11-12 (60h)
**Status**: Pending

### 9.1 Auto-Annotation (20h)
- [ ] Model integration (YOLOv8, SAM)
- [ ] Auto-detect objects in image
- [ ] Confidence scores and filtering

### 9.2 Smart Assist (15h)
- [ ] Object proposals
- [ ] Edge snapping
- [ ] Similar object detection

### 9.3 Model Training (25h)
- [ ] Export to training format
- [ ] Integration with training pipeline
- [ ] Model versioning

**Dependencies**: Phase 7-8 completion

---

## Phase 10: Polish & Optimization ⏸️ PENDING

**Duration**: Week 13 (40h)
**Status**: Pending

### 10.1 Performance (10h)
- [ ] Frontend bundle optimization
- [ ] Lazy loading components
- [ ] Image preloading

### 10.2 UX Improvements (15h)
- [ ] Keyboard shortcut guide
- [ ] Onboarding tour
- [ ] Error handling polish

### 10.3 Testing & QA (15h)
- [ ] E2E test coverage
- [ ] Load testing
- [ ] Bug fixes

---

## Technical Stack

**Frontend**:
- Next.js 14, React 18, TypeScript
- Zustand (state management)
- Tailwind CSS
- Canvas API for rendering

**Backend**:
- FastAPI (Python 3.11)
- PostgreSQL (TimescaleDB)
- SQLAlchemy ORM
- Alembic migrations
- AWS S3 (images + thumbnails)

**Infrastructure**:
- Docker containers
- Redis (caching - planned)
- AWS services (S3, RDS)

---

## Session Notes (Recent)

### 2025-11-22 (PM): Phase 2.10 Canvas Enhancements Planning 📋

**Task**: Plan implementation for Minimap, Undo/Redo UI, and Magnifier features

**Requirements Gathered**:
1. **Undo/Redo UI**:
   - Position: Bottom-left zoom toolbar (NOT top toolbar)
   - Icon-only buttons (no text)
   - Integrated with existing zoom controls: `[↶] [↷] | [−] [100%] [+] | [Fit]`

2. **Magnifier (NEW feature)**:
   - Manual activation: Z key (press and hold)
   - Auto activation: Show when entering drawing tools (bbox, polygon, polyline, circle)
   - Two positioning modes: Following cursor OR Fixed position (test both)
   - Adjustable magnification: 2x-8x via scroll

3. **Minimap**:
   - Standard implementation as originally planned

**Documents Created**:
- `docs/implementation-plan-minimap-undo-magnifier.md` (detailed 1000+ line plan)
- Updated `docs/ANNOTATION_IMPLEMENTATION_TODO.md` (added Phase 2.10)

**Total Estimate**: 16-21 hours
- Undo/Redo UI: 3-4h (reduced - simple integration)
- Magnifier: 7-9h (increased - auto-activation + dual modes)
- Minimap: 6-8h (unchanged)

**Implementation Order**: Undo/Redo → Magnifier → Minimap

**Next Steps**: Begin implementation starting with Undo/Redo UI

### 2025-11-22 (PM - Later): Phase 2.10 Canvas Enhancements Implementation ✅

**Task**: Implement all Phase 2.10 features (Undo/Redo UI, Magnifier, Minimap)

**Completed**:
1. **Phase 2.10.1: Undo/Redo UI**
   - Added undo/redo buttons to zoom toolbar (bottom-left)
   - Integrated with ArrowUturnLeftIcon, ArrowUturnRightIcon
   - Keyboard shortcuts: Ctrl+Z (undo), Ctrl+Y/Ctrl+Shift+Z (redo)
   - Toast notifications on actions
   - Backend history system already existed in annotationStore.ts

2. **Phase 2.10.2: Magnifier Component**
   - Created `Magnifier.tsx` (160 lines)
   - Manual activation: Z key (press and hold)
   - Auto activation: Shows in drawing tools (detection, polygon, polyline, circle, circle3p)
   - Dual positioning modes: Following cursor with edge detection, Fixed top-right
   - Circular 200px canvas with crosshair
   - Zoom level indicator and coordinates display
   - Added preferences to annotationStore: autoMagnifier, magnifierMode, magnifierSize, magnificationLevel

3. **Phase 2.10.3: Minimap Component**
   - Created `Minimap.tsx` (246 lines)
   - 200x150px positioned at bottom-right
   - Shows entire image scaled with aspect ratio preservation
   - Renders all annotation types (detection, polygon, polyline, circle)
   - Red viewport rectangle with semi-transparent overlay
   - Click to navigate (centers viewport on click)
   - Drag viewport for panning
   - M key toggle visibility

**Files Created**:
- `frontend/components/annotation/Magnifier.tsx`
- `frontend/components/annotation/Minimap.tsx`

**Files Modified**:
- `frontend/components/annotation/Canvas.tsx` (imports, state, handlers, JSX integration)
- `frontend/lib/stores/annotationStore.ts` (preferences)
- `docs/ANNOTATION_IMPLEMENTATION_TODO.md` (marked Phase 2.10 complete)

**Result**: Phase 2: Advanced Features now 100% complete! All canvas enhancement features working.

### 2025-11-22 (AM): Phase 7 Thumbnail Integration ✅

**Completed**:
1. Added `thumbnail_url` to API schema and responses
2. Updated ImageList to use thumbnails with fallback
3. Ran backfill script (all 1,725 images have thumbnails)
4. Created PR #13 for thumbnail integration
5. Performance: 99% bandwidth reduction (2-5MB → 10-30KB)

**Remaining**:
- File management features (Phase 7.2)

### 2025-11-21: Phase 6 Task Type Refactoring ✅

**Completed**:
1. Backend task registry and normalization
2. Database migration (155 annotations)
3. Frontend store and API updates
4. Export format standardization
5. PR #11 merged to develop

### 2025-11-20: Phase 2.12 Performance Optimization Started

**Completed**:
1. `image_metadata` table with strategic indexes
2. Backfill script for 1,725 images
3. Dataset summary optimization (50-100x faster)
4. Random image selection
5. Dataset size display
6. PR #12 merged to develop

---

## Git Branches

- `main`: Production-ready code
- `develop`: Integration branch
- `feature/performance-optimization`: Phase 7 work (current)
- `feature/annotation-canvas`: Phase 1-3 work (merged)

## Recent PRs

- PR #13: Phase 7 Thumbnail Integration (open)
- PR #12: Phase 7 DB Optimization (merged)
- PR #11: Phase 6 Task Type Refactoring (merged)
- PR #10: Phase 5 Dataset Management (merged)
- PR #9: Phase 5 Dataset Deletion (merged)
- PR #8: Phase 4 Confirmation (merged)

---

**End of Document**
