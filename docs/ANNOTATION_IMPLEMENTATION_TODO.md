# Annotation Canvas Implementation To-Do List

**Project**: Vision AI Labeler - Annotation Interface
**Start Date**: 2025-11-14
**Last Updated**: 2025-12-18 (Phase 18.1 Complete - Canvas Refactoring Documentation)

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
| **Phase 7: Performance Optimization** | **✅ Complete** | **100%** | **2025-11-22** |
| **Phase 8: Collaboration Features** | **🔄 In Progress** | **70%** (8.5, 8.5.1, 8.5.2, 8.1, 8.2 complete) | **-** |
| **Phase 9: Database Migration & Deployment** | **🔄 In Progress** | **74%** (9.1, 9.3, 9.4 complete) | **-** |
| **Phase 10: Application Performance Optimization** | **✅ Complete** | **100%** | **2025-11-25** |
| **Phase 11: Version Diff & Comparison** | **🔄 In Progress** | **85%** | **-** |
| **Phase 12: Dataset Publish Improvements** | **✅ Complete** | **100%** | **2025-11-26** |
| Phase 13: AI Integration | ⏸️ Pending | 0% | - |
| Phase 14: Polish & Optimization | ⏸️ Pending | 0% | - |
| **Phase 15: Admin Dashboard & Audit** | **✅ Complete** | **100%** | **2025-11-27** |
| **Phase 16: Platform Integration** | **🔄 In Progress** | **60%** (16.5: 60% complete, 16.6: planned) | **-** |
| **Phase 17: SSO Integration** | **🔄 In Progress** | **95%** | **2025-12-10** |
| **Phase 18: Canvas Architecture Refactoring** | **🔄 In Progress** | **10%** (18.1 complete) | **2025-12-18** |

**Current Focus**:
- Phase 2: Advanced Features ✅ Complete (including Canvas Enhancements)
- Phase 7: Performance Optimization ✅ Complete
- **Phase 8.5: Concurrent Handling ✅ Complete** (Backend + Frontend integrated)
- **Phase 8.5.1: Optimistic Locking ✅ Complete** (Version conflict detection)
- **Phase 8.5.2: Strict Lock + Real-time ✅ Complete** (Lock overlay + 5s polling)
- **Phase 8.1: RBAC Permission System ✅ Complete** (5-role hierarchy)
- **Phase 8.2: Invitation System ✅ Complete** (Invite-accept workflow)
- **Phase 9.1: User DB Separation ✅ Complete** (PostgreSQL migration)
- **Phase 9.3: External Storage → R2 ✅ Complete** (3,451 files, Hybrid URL generation)
- **Phase 9.4: Demo Deployment ✅ Complete** (Cloudflare Tunnel + Railway Frontend)
- **Phase 10: Application Performance Optimization ✅ Complete** (Quick Wins - 80% latency reduction)
- **Phase 12: Dataset Publish Improvements ✅ Complete** (DICE format enhancements, hash-based splits)

**Current Focus**:
- Phase 11 (Version Diff & Comparison) - Overlay mode complete, side-by-side mode pending
- **Phase 16.5 (Hybrid JWT Migration)** - Service Account → JWT 전환 진행 중 🔄
- **Phase 17 (SSO Integration)** - Platform → Labeler 자동 로그인 구현 중 🔄
- **Phase 18 (Canvas Refactoring)** - 4100라인 Canvas.tsx 모듈화 시작 🆕

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

## Phase 7: Performance Optimization ✅ COMPLETE (Core)

**Duration**: Week 8 (2025-11-22)
**Status**: ✅ Core Complete (Phase 7.1 - 100%), 📝 File Management Deferred (Phase 7.2-7.3)

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

## Phase 8: Collaboration Features 🔄 IN PROGRESS

**Duration**: Weeks 9-10 (87h total)
**Status**: 🔄 In Progress - Phase 8.5 & 8.1 Complete (35/87h = 40%)
**Implementation Order**: 8.5 → 8.1 → 8.2 → 8.3 → 8.4 (per ADR-003)

### 8.5 Concurrent Handling (25h) ✅ COMPLETE

**Status**: ✅ Complete (2025-11-22)
**Implementation Time**:
- Backend: 4-5 hours
- Frontend: 3-4 hours
- Testing & Debugging: 2-3 hours

#### 8.5.1 Optimistic Locking (12h) ✅ Complete
- [x] Database migration: Add `version` field to annotations
- [x] Backend: Version checking in update_annotation endpoint
- [x] Backend: 409 Conflict response with detailed info
- [x] Frontend: Add `version` to annotation types
- [x] Frontend: AnnotationConflictDialog component
- [x] **Frontend: Integrate conflict dialog in Canvas**
- [x] Frontend: Version conflict handling in Canvas.tsx
- [x] Frontend: Conflict resolution UI (reload/overwrite/cancel)

**Files**:
- ✅ Backend: `backend/alembic/versions/20251122_1000_add_annotation_version_for_locking.py`
- ✅ Backend: `backend/app/db/models/labeler.py:263`
- ✅ Backend: `backend/app/schemas/annotation.py:32,52`
- ✅ Backend: `backend/app/api/v1/endpoints/annotations.py:291-344`
- ✅ Frontend: `frontend/lib/api/annotations.ts:67,164`
- ✅ Frontend: `frontend/lib/stores/annotationStore.ts:102`
- ✅ Frontend: `frontend/components/annotations/AnnotationConflictDialog.tsx`

#### 8.5.2 Image Locks (13h) ✅ Complete
- [x] Database migration: Create `image_locks` table
- [x] Backend: ImageLock model
- [x] Backend: ImageLockService (7 methods, 318 lines)
- [x] Backend: Image lock API endpoints (6 endpoints)
- [x] Frontend: API client (`frontend/lib/api/image-locks.ts`)
- [x] **Frontend: Lock acquisition in Canvas**
- [x] **Frontend: Lock indicators in ImageList** (green/red/gray icons)
- [x] **Frontend: Heartbeat mechanism** (every 2 minutes)
- [x] Frontend: Lock release on unmount
- [x] Frontend: "Image locked by user" dialog

**Files**:
- ✅ Backend: `backend/alembic/versions/20251122_1100_add_image_locks_table.py`
- ✅ Backend: `backend/app/db/models/labeler.py:499-518`
- ✅ Backend: `backend/app/services/image_lock_service.py` (318 lines)
- ✅ Backend: `backend/app/api/v1/endpoints/image_locks.py` (278 lines)
- ✅ Backend: `backend/app/api/v1/router.py:5,15`
- ✅ Frontend: `frontend/lib/api/image-locks.ts` (148 lines)
- ✅ Frontend: `frontend/components/annotation/Canvas.tsx` (~150 lines added)
- ✅ Frontend: `frontend/components/annotation/ImageList.tsx` (~50 lines added)

**Documentation**:
- ✅ `docs/phase-8.5-revised-design.md` - Design rationale (Image Lock vs Annotation Lock)
- ✅ `docs/phase-8.5.1-implementation-summary.md` - Optimistic locking details
- ✅ `docs/phase-8.5-implementation-complete.md` - Complete implementation guide
- ✅ `docs/phase-8.5-frontend-integration-guide.md` - Frontend integration examples
- ✅ `docs/architecture-decision-records.md` - ADR-001, ADR-002, ADR-003

**API Endpoints** (Live):
- ✅ `POST /api/v1/image-locks/acquire` - Acquire lock
- ✅ `DELETE /api/v1/image-locks/{project_id}/{image_id}` - Release lock
- ✅ `POST /api/v1/image-locks/{project_id}/{image_id}/heartbeat` - Keep alive
- ✅ `GET /api/v1/image-locks/{project_id}` - Get all project locks
- ✅ `GET /api/v1/image-locks/{project_id}/{image_id}/status` - Get lock status
- ✅ `DELETE /api/v1/image-locks/{project_id}/{image_id}/force` - Force release (owner)

**Testing**:
- [x] Database migrations executed successfully
- [x] Frontend compiles without errors
- [x] Lock acquisition on image load
- [x] Heartbeat mechanism running (2 min intervals)
- [x] Lock indicators visible in ImageList
- [ ] Test optimistic locking with two users (manual testing needed)
- [ ] Test image lock acquisition/release (manual testing needed)
- [ ] Test lock expiration (5 min timeout) (manual testing needed)
- [ ] Test concurrent editing scenarios (manual testing needed)

**Deployment Status**:
- ✅ Frontend: Running on http://localhost:3010
- ✅ Backend: Running on http://localhost:8080
- ✅ Database: Migrations applied
- 📝 Ready for manual testing and validation

### 8.1 User Management & Roles (18h) ✅ COMPLETE

**Status**: ✅ Complete (2025-11-23)
**Implementation Time**: ~10 hours

#### 8.1.1 ProjectPermission System ✅
- [x] ProjectPermission table and Alembic migration
- [x] 5-role RBAC system (owner > admin > reviewer > annotator > viewer)
- [x] Role hierarchy implementation (`ROLE_HIERARCHY`)
- [x] `require_project_permission()` dependency factory

#### 8.1.2 Data Migration ✅
- [x] Migration script: DatasetPermission → ProjectPermission
- [x] Role mapping: owner→owner, member→annotator
- [x] Verification script for migration results
- [x] Executed migration (2 permissions migrated)

#### 8.1.3 API Implementation ✅
- [x] Project permission CRUD endpoints
- [x] Transfer ownership endpoint
- [x] Updated image lock endpoints (require_project_permission)
- [x] Updated annotation endpoints (permission checks)
- [x] Router registration

**Files**:
- ✅ `backend/alembic/versions/20251123_1000_add_project_permissions_table.py`
- ✅ `backend/app/db/models/labeler.py` (ProjectPermission model)
- ✅ `backend/app/schemas/permission.py` (schemas)
- ✅ `backend/app/core/security.py` (require_project_permission)
- ✅ `backend/app/api/v1/endpoints/project_permissions.py` (NEW)
- ✅ `backend/scripts/migrate_dataset_permissions_to_project.py`
- ✅ `docs/phase-8.1-implementation-complete.md`

**Dependencies**: Phase 8.5 complete ✅

### 8.2 Invitation System (18h) ✅ COMPLETE

**Status**: ✅ Complete (2025-11-23 PM)
**Priority**: High (Core collaboration feature)
**Goal**: Implement invite-accept workflow for dataset/project collaboration

#### Problem Statement
**Current State** (Too Simple):
- ✅ InviteMemberModal exists (email input only)
- ✅ Roles: owner/member (old DatasetPermission)
- ❌ No real user search
- ❌ No invite-accept workflow (immediate permission grant)
- ❌ Not using 5-role RBAC system

**Desired State**:
- ✅ User search from User DB
- ✅ 5-role RBAC integration (owner/admin/reviewer/annotator/viewer)
- ✅ Invite-accept workflow (not immediate grant)
- ✅ In-app notifications

#### Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                 Invitation Workflow                          │
├─────────────────────────────────────────────────────────────┤
│  Inviter → Search User → Select Role → Send Invitation      │
│                                              ↓               │
│  Invitee ← Notification ← Token + Expires (7 days)         │
│     ↓                                                        │
│  Accept/Reject → ProjectPermission Auto-Created             │
└─────────────────────────────────────────────────────────────┘
```

#### 8.2.1 Backend API (8-10h)

**8.2.1.1 User Search API (2h)** ✅
- [x] `GET /api/v1/users/search?q={query}` endpoint
- [x] Search by email/name in User DB
- [x] Exclude current user and already-permitted users
- [x] Return max 10 results with avatar/badge

**Files**:
- ✅ `backend/app/api/v1/endpoints/users.py` (NEW)
- ✅ `backend/app/schemas/user.py` (NEW - UserSearchResponse)

**8.2.1.2 Invitation CRUD API (5h)** ✅
- [x] `POST /api/v1/invitations` - Create invitation
- [x] `GET /api/v1/invitations?type=received` - List received invitations
- [x] `GET /api/v1/invitations?type=sent` - List sent invitations
- [x] `POST /api/v1/invitations/accept` - Accept invitation (token-based)
- [x] `POST /api/v1/invitations/{id}/cancel` - Cancel invitation (by inviter/invitee)

**Business Logic**:
- ✅ Token generation (secrets.token_urlsafe)
- ✅ Expiration (7 days)
- ✅ Duplicate invitation prevention
- ✅ Role validation (5-role RBAC)
- ✅ Check existing ProjectPermission

**Database**: User DB `invitations` table (already exists)

**Files**:
- ✅ `backend/app/api/v1/endpoints/invitations.py` (NEW)
- ✅ `backend/app/schemas/invitation.py` (NEW)
- ✅ `backend/app/db/models/user.py` (UPDATE - add Invitation model)

**8.2.1.3 Permission Integration (3h)** ✅
- [x] ProjectPermission auto-creation on accept
- [x] Cross-database transaction (User DB + Labeler DB)
- [x] Invitation status update (pending → accepted/cancelled)
- [x] Error handling (expired/already-accepted/already-has-permission)

**Integration Flow**:
```python
# On accept (implemented in accept_invitation endpoint):
1. ✅ Validate invitation (User DB)
2. ✅ Check expiration → auto-mark as 'expired' if past expires_at
3. ✅ Create ProjectPermission (Labeler DB)
4. ✅ Update invitation.status = 'accepted' (User DB)
5. ✅ Commit both databases separately (no distributed transaction needed)
```

#### 8.2.2 Frontend UI (7-8h)

**8.2.2.1 Enhanced Invite Dialog (4h)** ✅
- [x] Replace simple InviteMemberModal
- [x] User search with real-time autocomplete (300ms debounce)
- [x] 5-role selector with descriptions
- [x] User profile display (avatar, email, name)
- [x] User badge color integration

**Components** (NEW):
- ✅ `frontend/components/datasets/InviteDialog.tsx` (combined all-in-one component)
- ✅ `frontend/components/datasets/UserAvatar.tsx` (reusable avatar component)
- ✅ `frontend/lib/api/users.ts` (API client)
- ✅ `frontend/lib/api/invitations.ts` (API client)

**8.2.2.2 Invitations Management (3h)** ✅
- [x] InvitationsPanel with tabs (Received/Sent)
- [x] Received: Accept/Decline buttons, inviter info, role badges
- [x] Sent: Status badges, Cancel button
- [x] Invitation cards with project/dataset info
- [x] Time-based formatting (e.g., "2h ago", "3d ago")
- [x] Expired invitation handling

**Components** (NEW):
- ✅ `frontend/components/invitations/InvitationsPanel.tsx` (all-in-one panel)

**8.2.2.3 Notification System (2h)** ✅
- [x] Notification bell icon in Sidebar
- [x] Bell opens InvitationsPanel
- [x] Toast notifications for invite actions
- [x] "View All" functionality via bell click

**Components** (Modified):
- ✅ `frontend/components/Sidebar.tsx` (added bell icon + onInvitationsClick prop)
- ✅ `frontend/app/page.tsx` (integrated InvitationsPanel)

#### 8.2.3 Integration & Testing (1h) ✅
- [x] Backend server startup verification
- [x] API endpoint registration confirmed
- [x] Authentication working (returns 401 for unauthenticated requests)
- [x] Import/model validation passed
- [x] Cross-database integration logic implemented

**Edge Cases Handled**:
- ✅ Expired invitation (auto-marks as 'expired' on accept attempt)
- ✅ Duplicate invitation prevention (checks for existing pending invitation)
- ✅ Already has permission (checks ProjectPermission before creating invitation)
- ✅ Invalid token handling
- ✅ Permission validation (only owner/admin can invite)

**Files Modified**:
- ✅ `frontend/app/page.tsx` (replaced InviteMemberModal with InviteDialog)
- ✅ `backend/app/api/v1/router.py` (registered users + invitations routers)
- ✅ `backend/app/db/models/user.py` (added is_verified field, Invitation model)

**Implementation Priority**: ✅ Both phases completed
1. ✅ **Phase 1 (Core)**: 8.2.1 + 8.2.2.1 + Testing (11h)
2. ✅ **Phase 2 (UX)**: 8.2.2.2 + 8.2.2.3 (7h)

**Dependencies**:
- ✅ Phase 8.1 complete (ProjectPermission system)
- ✅ Phase 9.1 complete (User DB separation)
- ✅ User DB `invitations` table (already exists)

**Total**: 18h (actual: 18h)

**Implementation Summary** (2025-11-23 PM):
- ✅ All backend endpoints implemented and tested
- ✅ All frontend components created and integrated
- ✅ Cross-database workflow (User DB + Labeler DB) working
- ✅ Authentication, validation, and error handling complete
- ✅ 5-role RBAC fully integrated
- ✅ UI/UX polished with avatars, badges, and time formatting
- 📝 Note: User DB migrations not needed (managed by Platform)

### 8.3 Task Assignment (18h) ⏸️ Pending
- [ ] Assign images to users
- [ ] Assignment strategies (round-robin, manual, workload-based)
- [ ] Annotator workspace (filtered view)

**Dependencies**: Phase 8.2 complete

### 8.4 Review & Approval (17h) ⏸️ Pending
- [ ] Review queue system
- [ ] Approve/reject interface
- [ ] Notification system (email + in-app)

**Dependencies**: Phase 8.3 complete

### 8.6 Activity Log (9h) ⏸️ Pending
- [ ] Activity logging (annotations, assignments, reviews)
- [ ] Activity feed UI
- [ ] Export reports

**Dependencies**: Phase 8.4 complete

**Phase 8 Summary**:
- 8.5: Concurrent Handling (25h) ✅
- 8.1: RBAC Permission System (18h) ✅
- 8.2: Invitation System (18h) ✅
- 8.3: Task Assignment (18h) ⏸️
- 8.4: Review & Approval (17h) ⏸️
- 8.6: Activity Log (9h) ⏸️

**Total**: 105h
**Progress**: 61/105h = 58% (Phase 8.5, 8.1, 8.2 complete)
**Note**: Phase 8.2 completed with full invite-accept workflow and 5-role RBAC integration

---

## Phase 9: Database Migration & Deployment 🔄 IN PROGRESS

**Duration**: 1-2 weeks (32-38h total, including storage)
**Status**: 🔄 In Progress (17/38h = 45%)
**Context**: Microservices preparation - User DB separation + R2 storage migration

### Overview

플랫폼 마이크로서비스 전환에 맞춰 Labeler도 Railway로 데이터베이스를 이전합니다.

**Platform 3-Step Plan**:
1. ✅ 로컬 PostgreSQL에서 DB 분리 구현
2. **Railway 배포 후 연결** ← 레이블러 대응 시점 (Next)
3. On-prem K8s화

### 9.1 User DB 연결 준비 (6h) ✅ COMPLETE

**Status**: ✅ Complete (2025-11-23)
**Implementation Time**: ~6 hours

- [x] 환경 변수 추가 (USER_DB_HOST, USER_DB_PORT, USER_DB_NAME)
- [x] User 모델을 Platform에서 User DB로 분리
- [x] `get_user_db()` 세션 팩토리 추가 (PostgreSQL)
- [x] API 엔드포인트 업데이트 (User 조회 33곳)
- [x] 통합 테스트 성공 (로그인, /auth/me, datasets)

**Database Configuration**:
- User DB: PostgreSQL (localhost:5433/users)
- Connection: SQLAlchemy with connection pooling
- Migration: All User queries from Platform DB → User DB

**Files Created**:
- `backend/app/db/models/user.py` (User, Organization models)

**Files Modified**:
- `backend/app/core/config.py` (USER_DB_* settings)
- `backend/app/core/database.py` (get_user_db session factory)
- `backend/app/core/security.py` (get_current_user → User DB)
- `backend/app/api/v1/endpoints/auth.py` (login → User DB)
- `backend/app/api/v1/endpoints/annotations.py` (4 functions, 8 User queries)
- `backend/app/api/v1/endpoints/projects.py` (1 function, 1 User query)
- `backend/app/api/v1/endpoints/image_locks.py` (5 functions, 5 User queries)
- `backend/app/api/v1/endpoints/export.py` (1 function, 1 User query)
- `backend/app/api/v1/endpoints/project_permissions.py` (3 functions, 5 User queries)
- `backend/app/api/v1/endpoints/datasets.py` (6 functions, 12 User queries)
- `backend/.env` and `backend/.env.example` (environment variables)

**Integration Test Results**:
```
✅ Login: User DB authentication successful
✅ /api/v1/auth/me: User info retrieval successful
✅ /api/v1/datasets: User DB owner info retrieval successful
```

**Total User Queries Migrated**: 33 locations across 7 API endpoint files

### 9.2 Labeler DB Railway 배포 준비 (4-6h)
- [ ] Railway 프로젝트 생성
- [ ] PostgreSQL 플러그인 추가
- [ ] Alembic 마이그레이션 실행
- [ ] 데이터 이전 스크립트 작성
- [ ] 백업/복원 절차 수립

**Railway Setup**:
- Database: PostgreSQL 15
- Region: US West
- Plan: Hobby or Pro

### 9.3 환경 변수 및 설정 관리 (3-4h)
- [ ] `.env.example` 업데이트
- [ ] `railway.toml` 설정 파일 작성
- [ ] 연결 풀 튜닝 (pool_size, max_overflow)
- [ ] 타임아웃 설정

**Configuration**:
```bash
# User DB (Railway)
USER_DB_HOST=containers-us-west-xxx.railway.app
USER_DB_URL=postgresql://...

# Labeler DB (Railway)
LABELER_DB_HOST=containers-us-west-yyy.railway.app
LABELER_DB_URL=postgresql://...
```

### 9.4 마이그레이션 실행 및 검증 (5-6h)
- [ ] Staging 환경에서 테스트
- [ ] 성능 벤치마크 (레이턴시 < 10% 증가)
- [ ] 프로덕션 마이그레이션
- [ ] 롤백 계획 수립

**Test Checklist**:
- [ ] User 인증/조회
- [ ] Dataset CRUD
- [ ] Annotation CRUD
- [ ] Image lock 동작
- [ ] ProjectPermission 동작

### 9.3 External Storage → R2 Migration (8-10h) ✅ COMPLETE

**Status**: ✅ Complete (2025-11-25)
**Implementation Time**: ~10 hours
**Context**: MinIO (localhost:9000) → Cloudflare R2 (training-datasets bucket)

#### Implementation Summary

- [x] Cloudflare R2 계정 설정 및 버킷 생성
- [x] 데이터 마이그레이션 (3,451 files, 1.59 GB)
- [x] R2 Public Development URL 설정
- [x] **Hybrid URL Generation** 구현 (CRITICAL)
- [x] S3/R2 호환성 검증
- [x] 환경 변수 업데이트

#### Key Changes

**Migration**:
- 3,451 files migrated successfully (100%)
- 1.59 GB data transferred
- Zero migration failures
- Metadata and Content-Type preserved

**Hybrid URL Generation** (On-prem S3 Compatibility):
```python
# storage.py - generate_presigned_url()
if settings.R2_PUBLIC_URL and bucket == self.datasets_bucket:
    # R2 mode: Use public R2.dev URL (no signature)
    return f"{settings.R2_PUBLIC_URL}/{key}"

# S3 mode: Use presigned URL (with signature)
return self.s3_client.generate_presigned_url(...)
```

**Environment Configuration**:
```bash
# R2 Development
R2_PUBLIC_URL=https://pub-xxx.r2.dev
S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com

# S3 On-prem (No code changes!)
R2_PUBLIC_URL=  # Leave empty
S3_ENDPOINT=https://your-s3-endpoint.com
```

**Files Created**:
- `backend/scripts/migrate_minio_to_r2.py` (migration script)
- `backend/scripts/test_r2_access.py` (R2 access test)
- `backend/scripts/test_hybrid_url.py` (Hybrid URL test)
- `docs/phase-9.3-r2-external-storage-migration-complete.md` (detailed docs)

**Files Modified**:
- `backend/.env` (R2 credentials + R2_PUBLIC_URL)
- `backend/.env.example` (R2 template)
- `backend/app/core/config.py` (R2_PUBLIC_URL setting)
- `backend/app/core/storage.py` (Hybrid URL generation)

**Key Benefits**:
- ✅ No code changes between R2 and S3 environments
- ✅ Only environment variable configuration required
- ✅ Same codebase supports both cloud and on-prem deployments
- ✅ On-prem S3 compatibility confirmed

### 9.4 Demo Deployment - Cloudflare Tunnel + Railway (6-8h) ✅ COMPLETE

**Status**: ✅ Complete (2025-11-25)
**Implementation Time**: ~6 hours
**Context**: Railway DB 비용 문제 ($10/week) → Local Backend + Railway Frontend 하이브리드 구조

#### Architecture

```
Demo Users
  ↓
Railway Frontend (Next.js)
  ↓
Cloudflare Tunnel (https://labeler-api.yourdomain.com)
  ↓
Local PC
  ├─ Backend (FastAPI:8011)
  ├─ PostgreSQL (User DB)
  └─ PostgreSQL (Labeler DB)
  ↓
Cloudflare R2 (Image Storage)
```

#### Cost Comparison

| Deployment | Monthly Cost | Notes |
|------------|--------------|-------|
| **Previous (Railway DB)** | ~$40/month | User DB + Labeler DB on Railway |
| **Current (Hybrid)** | ~$6.5/month | Frontend ($5) + R2 ($1.5) |
| **Savings** | **84%** | Backend + DB on local PC |

#### Implementation Checklist

**Documentation Created** ✅
- [x] `docs/deployment/cloudflare_tunnel_setup.md` (Tunnel 설정 가이드)
- [x] `docs/deployment/railway_frontend_deployment.md` (Railway 배포 가이드)
- [x] `docs/deployment/deployment_checklist.md` (배포 체크리스트)
- [x] `frontend/.env.production.template` (환경 변수 템플릿)

**Configuration Updates** ✅
- [x] Backend CORS 설정 업데이트 (Railway frontend URL 지원)
- [x] Frontend `.gitignore` 업데이트 (.env.production 제외)

**Key Features**:
- ✅ Cloudflare Tunnel for local backend exposure (무료)
- ✅ Railway Frontend only deployment (~$5/month)
- ✅ Local PostgreSQL (0원)
- ✅ Cloudflare R2 for images (~$1.5/month for 100GB)
- ✅ Complete deployment documentation
- ✅ Security considerations documented

**Files Created**:
- `docs/deployment/cloudflare_tunnel_setup.md`
- `docs/deployment/railway_frontend_deployment.md`
- `docs/deployment/deployment_checklist.md`
- `frontend/.env.production.template`
- `backend/check_db.py` (User DB 연결 확인 유틸리티)
- `backend/init_db.py` (테스트 사용자 초기화 스크립트)
- `docs/r2-cors-config.json` (R2 CORS 정책 설정 파일)

**Files Modified**:
- `backend/.env` (CORS origins + User DB configuration fix)
- `frontend/.gitignore` (.env.production added)

**Post-Deployment Issues Fixed** (2025-11-25 Late Night):
- [x] User DB configuration error (port 5432 → 5433, name platform → users)
- [x] R2 CORS policy configuration for Railway frontend
- [x] Database utility scripts for troubleshooting

**Benefits**:
- ✅ 84% cost reduction (~$40 → ~$6.5/month)
- ✅ Full control over local databases
- ✅ Demo-friendly (start/stop anytime)
- ✅ Production-ready architecture documentation

### 9.5 Internal Storage → R2 Migration (Optional - 4-6h) ⏸️
- [ ] Migrate `annotations` bucket to R2
- [ ] Update export endpoints to use R2
- [ ] Test version export/download
- [ ] Update environment variables

**Context**: MinIO annotations bucket → Cloudflare R2

**Note**: Export files are small and regenerable, can be deferred

### 9.6 Production Deployment (Optional - 6-8h) ⏸️
- [ ] Deploy backend to Railway (production)
- [ ] Deploy frontend to Railway/Vercel (production)
- [ ] Update connection strings
- [ ] End-to-end testing
- [ ] Monitor costs and performance

**Total**: 38-46h (18-22h DB + 10h External Storage + 6-8h Demo + 4-6h Internal Storage)
**Progress**: 34/46h = 74% (Phase 9.1, 9.3, 9.4 complete)

**Dependencies**: Phase 8.1 complete, Platform User DB separation
**Detailed Plan**: `docs/phase-9-database-deployment-plan.md`

---

## Phase 10: Application Performance Optimization ✅ COMPLETE

**Duration**: 1 week (6-8h Quick Wins + 12-15h Future)
**Status**: ✅ Complete (Quick Wins - 2025-11-25)
**Implementation Time**: ~6 hours
**Context**: Railway 배포 후 성능 저하 발견 (15초 페이지 로드) → 최적화 완료

### Problem Analysis

**Symptoms** (Post-Phase 9.3 R2 Migration):
- Initial page load: ~15 seconds (로그인 + 새로고침만)
- 데이터셋 선택도 하지 않은 상태에서 과도한 API 호출
- Backend logs: 30+ User DB queries (같은 사용자 정보 반복 조회)
- Railway DB latency: ~200ms per query

**Root Causes Identified**:
1. **Frontend Auto-select**: 첫 dataset을 자동 선택 → 6+ API 연쇄 호출
2. **Sidebar Polling Bug**: `useEffect([user])` → interval 중복 생성 → Invitations API 5+ 회 호출
3. **Sequential API Calls**: Dataset 선택 시 6개 API를 순차 실행 (1.2초)
4. **N+1 User Queries**: 매 API 요청마다 User DB 조회 (30+ 회, 6초 낭비)

### 10.1 Frontend Optimizations (3-4h) ✅ Complete

**10.1.1 Remove Auto-Select on Initial Load** ✅
```typescript
// frontend/app/page.tsx:97-98
// Performance: Don't auto-select - let user explicitly select dataset
// This prevents loading 6+ APIs on initial page load
```

**Impact**: 초기 페이지 로드 시 6개 불필요한 API 호출 제거

**10.1.2 Fix Sidebar Invitation Polling Dependency** ✅
```typescript
// frontend/components/Sidebar.tsx:89
}, [user?.id]); // Only re-run when user.id changes, not user object reference
```

**Impact**: Invitations API 중복 호출 5+ 회 → 1 회 (80% 감소)

**10.1.3 Parallelize API Calls in Dataset Selection** ✅
```typescript
// frontend/app/page.tsx:117-155
// Phase 1: Fetch permissions and project info in parallel
const [perms, projectData] = await Promise.all([
  listPermissions(datasetId),
  getProjectForDataset(datasetId)
]);

// Phase 2: Parallelize all project-related API calls
const [statsResponse, historyData, imagesData, sizeData] = await Promise.all([
  getProjectStats(projectData.id),
  getProjectHistory(projectData.id, 0, 10),
  getDatasetImages(datasetId, 8),
  getDatasetSize(datasetId)
]);
```

**Impact**: Dataset 선택 시 1.2초 → 0.4초 (66% 감소)

**Files Modified**:
- `frontend/app/page.tsx` (auto-select 제거, API 병렬화)
- `frontend/components/Sidebar.tsx` (polling dependency 수정)

### 10.2 Backend Optimizations (2-3h) ✅ Complete

**10.2.1 In-Memory User Cache with TTL** ✅
```python
# backend/app/core/security.py:107-185
_user_cache: Dict[int, Tuple[any, datetime]] = {}
USER_CACHE_TTL = 30  # seconds

async def get_current_user(...):
    # Check cache first
    cached_user = _get_cached_user(user_id)
    if cached_user is not None:
        return cached_user

    # DB query only on cache miss
    user = db.query(User).filter(User.id == user_id).first()

    # Cache for future requests
    _cache_user(user_id, user)
    return user
```

**Impact**:
- User DB 쿼리 30+ 회 → 1-2 회 (95% 감소)
- Railway DB latency 절약: 30 × 200ms = 6초

**Files Modified**:
- `backend/app/core/security.py` (user caching logic)

#### Performance Results

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Initial Page Load** | ~15s | ~2-3s | **80% ↓** |
| **Dataset Selection** | ~1.2s | ~0.4s | **66% ↓** |
| **User DB Queries** | 30+ times | 1-2 times | **95% ↓** |
| **Invitations API Calls** | 5+ times | 1 time | **80% ↓** |

### 10.3 Additional Optimizations (Future - Optional) ⏸️

**High Priority**:
- [ ] Redis caching for User queries (replace in-memory cache)
- [ ] DB connection pooling tuning for Railway
- [ ] Implement request-level memoization

**Medium Priority**:
- [ ] Frontend code splitting (lazy load panels)
- [ ] Image preloading strategy
- [ ] API response compression (gzip)

**Low Priority**:
- [ ] CDN integration for R2
- [ ] Database query optimization (EXPLAIN ANALYZE)
- [ ] Frontend bundle optimization

**Total**: 6-8h (Quick Wins) + 12-15h (Future Optimizations)
**Progress**: 6-8h = 100% (Quick Wins complete)

**Files Created**:
- None (only code modifications)

**Files Modified**:
- `frontend/app/page.tsx` (auto-select 제거, API 병렬화)
- `frontend/components/Sidebar.tsx` (polling dependency 수정)
- `backend/app/core/security.py` (user caching)
- `docs/annotation_implementation_todo.md` (Phase 9.5 추가)

**Key Learnings**:
- Railway DB latency (~200ms) makes N+1 queries critical
- Frontend auto-select 기능은 신중하게 사용해야 함
- API 병렬화는 큰 성능 개선 효과
- 간단한 in-memory 캐싱도 충분한 효과

**Next**: Test performance improvements → Phase 9.2 (Labeler DB Railway deployment)

### 9.6 Backend/Frontend → Railway (Optional - 6-8h) ⏸️
- [ ] Deploy backend to Railway
- [ ] Deploy frontend to Railway/Vercel
- [ ] Update connection strings
- [ ] End-to-end testing

**Total**: 38-44h (18-22h DB + 10h External Storage + 4-6h Internal Storage + 6-8h Performance)
**Progress**: 23/44h = 52% (Phase 9.1, 9.3, 9.5 complete)

**Dependencies**: Phase 8.1 complete, Platform User DB separation
**Detailed Plan**: `docs/phase-9-database-deployment-plan.md`

---

## Phase 11: Version Diff & Comparison 🔄 IN PROGRESS

**Duration**: 2-3 days (18-22h)
**Status**: 🔄 In Progress (85% - Overlay mode complete)
**Goal**: Git-style diff visualization for annotation versions

### Overview

Leverage existing version management system to provide visual comparison between annotation versions, similar to git diff functionality.

**Use Cases**:
- Review changes between working and published versions
- Compare different annotators' work on same images
- Track annotation evolution over time
- Quality assurance and validation
- Training data consistency checks

### 11.1 Backend: Version Comparison API (6-8h)

**11.1.1 Diff Calculation Engine** (3-4h)
- [x] Implement annotation diff algorithm
  - Compare two versions by image_id
  - Categorize annotations: `added`, `removed`, `modified`, `unchanged`
  - Calculate modification details (bbox moved, class changed, etc.)
- [x] Create `AnnotationDiff` model/schema
  ```python
  {
    "image_id": "img_001",
    "version_a": "v1.0",
    "version_b": "v2.0",
    "added": [...],      # New annotations in version_b
    "removed": [...],    # Deleted from version_a
    "modified": [...],   # Changed annotations
    "unchanged": [...]   # No changes
  }
  ```
- [x] Support multiple diff modes:
  - Bounding box position changes (IoU-based matching)
  - Class label changes
  - Attribute changes
  - Confidence changes
- [x] **Hybrid data source** (Working vs Published):
  - **Working/Draft versions**: Load from DB (`annotations` table)
  - **Published versions**: Load from R2 (`annotations/exports/{project_id}/{task_type}/{version}/annotations.json`)
  - Enables "Working vs v1.0" comparisons before publishing

**11.1.2 Comparison Endpoints** (2-3h)
- [x] `GET /api/v1/version-diff/versions/{version_a}/compare/{version_b}`
  - Query params: `image_id` (optional - single image or all)
  - Response: Diff summary + detailed changes
- [x] `GET /api/v1/version-diff/versions/{version_a}/compare/{version_b}/summary`
  - Compact summary-only response for quick overview
- [ ] `GET /api/v1/versions/{version_a}/compare/{version_b}/summary`
  - Statistics: total added, removed, modified counts
  - Per-class breakdown
  - Per-image change counts
- [ ] Add pagination for large datasets

**11.1.3 Performance Optimization** (1h)
- [ ] Cache diff results (Redis - 5min TTL)
- [ ] Batch processing for large version comparisons
- [ ] Add database indexes on version lookups

### 11.2 Frontend: Diff Visualization (8-10h)

**11.2.1 Version Selector UI** (2h)
- [ ] Version comparison dropdown (select 2 versions)
- [ ] Quick shortcuts: "Working vs Latest", "v1.0 vs v2.0"
- [ ] Show version metadata (created_at, created_by, stats)
- [ ] Validation: prevent comparing same version

**11.2.2 Diff Summary Panel** (2h)
- [ ] Overview statistics card
  - Total changes: Added (+5), Removed (-3), Modified (~7)
  - Per-class breakdown (color-coded)
  - Images affected: 12/150
- [ ] Filter controls
  - Show only: Added | Removed | Modified | All
  - Filter by class
  - Filter by image
- [ ] Export diff report (CSV/JSON)

**11.2.3 Canvas Diff Overlay** (4-6h)
- [x] **Overlay Mode** (default): Show both versions on same canvas
  - Version A (old): Semi-transparent red (#ff000050)
  - Version B (new): Semi-transparent green (#00ff0050)
  - Unchanged: Gray (#80808030)
  - Modified: Yellow outline (#ffff00)
- [ ] **Side-by-Side Mode**: Split canvas view
  - Left: Version A
  - Right: Version B
  - Synchronized zoom/pan
  - Diff highlights on both sides
- [ ] **Animation Mode**: Toggle between versions
  - Smooth transition (0.3s fade)
  - Keyboard shortcut: Space to toggle
- [x] Diff legend
  - Color indicators for each change type
  - Counts per category
  - Toggle visibility per category

### 11.3 Advanced Features (4-6h)

**11.3.1 Image-by-Image Navigation** (2h)
- [x] Navigate images with changes only
  - Skip unchanged images
  - Keyboard: N (next change), P (previous change)
- [x] Change summary per image
  - Show diff count badge on thumbnail
  - Red badge: has removals/modifications
  - Green badge: only additions

**11.3.2 Annotation Detail Comparison** (2-3h)
- [ ] Side-by-side property comparison
  ```
  Version A         |  Version B
  ------------------|------------------
  Class: "car"      |  Class: "truck"  ✎
  BBox: [10,20,50]  |  BBox: [12,20,50] ✎
  Conf: 0.95        |  Conf: 0.95
  ```
- [ ] Highlight modified fields
- [ ] Show old → new values with arrow
- [ ] Include modification metadata (when, who)

**11.3.3 Bulk Accept/Reject** (1-2h)
- [ ] Accept all changes from version B → A
- [ ] Reject specific changes
- [ ] Create new version from diff selection
- [ ] Conflict resolution UI (if both versions modified)

### 11.4 Integration & Testing (2h)

- [x] Add "Compare Versions" button to version history panel
- [x] Keyboard shortcut: `Esc` to exit diff mode
- [x] Toast notifications for diff calculations
- [x] Loading states for large diffs
- [x] Error handling: version not found, no annotations
- [ ] E2E test: compare two versions, verify diff accuracy

### Technical Implementation Notes

**Diff Algorithm**:
```python
def calculate_diff(version_a, version_b):
    """
    Compare annotations by matching logic:
    1. Same annotation_id → Check for modifications
    2. Similar bbox (IoU > 0.8) → Mark as modified
    3. No match → New annotation (added/removed)
    """
    added = []
    removed = []
    modified = []
    unchanged = []

    for ann_b in version_b.annotations:
        match = find_match(ann_b, version_a.annotations)
        if not match:
            added.append(ann_b)
        elif has_changes(match, ann_b):
            modified.append({"old": match, "new": ann_b})
        else:
            unchanged.append(ann_b)

    for ann_a in version_a.annotations:
        if not find_match(ann_a, version_b.annotations):
            removed.append(ann_a)

    return {"added": added, "removed": removed, ...}
```

**Canvas Rendering**:
```typescript
// Render diff overlays
annotations.forEach(ann => {
  const color = getDiffColor(ann.diffStatus);
  drawBBox(ann.bbox, color, opacity);
  if (ann.diffStatus === 'modified') {
    drawComparisonArrow(ann.oldBbox, ann.newBbox);
  }
});
```

**Performance Considerations**:
- Lazy load diff data (only calculate when requested)
- Incremental diff (only compare changed images)
- Web Worker for diff calculation (large datasets)
- Virtual scrolling for image list with changes

**Total**: 18-22h
**Priority**: High (valuable for QA and team collaboration)
**Dependencies**: Phase 4 (Version Management) complete

**Files to Create**:
- `backend/app/api/v1/endpoints/version_diff.py`
- `backend/app/services/diff_service.py`
- `frontend/components/annotation/VersionDiffPanel.tsx`
- `frontend/components/annotation/DiffCanvas.tsx`
- `frontend/lib/utils/diffCalculator.ts`

**Files to Modify**:
- `frontend/components/annotation/RightPanel.tsx` (add diff tab)
- `backend/app/api/v1/router.py` (register diff endpoints)
- `frontend/lib/stores/annotationStore.ts` (add diff state)

---

## Phase 12: Dataset Publish Improvements ✅ COMPLETE

**Duration**: 1-2 days (22h estimated, 8h actual)
**Status**: ✅ Complete (2025-11-26)
**Branch**: `feature/dataset-publish-improvements`
**Goal**: Improve DICE export format quality, metadata completeness, and ML pipeline compatibility

### Overview

Phase 12에서는 published annotations.json 파일의 구조를 개선하여:
- 데이터 일관성 및 추적성 향상
- ML 파이프라인 호환성 개선
- 메타데이터 품질 강화

### 12.1 Critical Fixes (4h) ✅ Complete

**12.1.1 Fix labeled_by / reviewed_by null issue** (2h) ✅
- [x] Add fallback logic for missing created_by
  - Iterate through all annotations to find user info
  - Prevents null values in metadata
- [x] Add fallback logic for confirmed_by
  - Check all annotations for reviewer info
- [x] Test with existing data

**Implementation** (`dice_export_service.py:216-238`):
```python
# Find labeled_by: Check all annotations for created_by
for ann in image_annotations:
    if ann.created_by:
        labeled_by_user = user_db.query(User).filter(
            User.id == ann.created_by
        ).first()
        if labeled_by_user:
            break

# Find reviewed_by: Look for confirmed_by
for ann in image_annotations:
    if ann.confirmed_by:
        reviewed_by_user = user_db.query(User).filter(
            User.id == ann.confirmed_by
        ).first()
        if reviewed_by_user:
            break
```

**12.1.2 Implement hash-based split** (2h) ✅
- [x] Add `get_split_from_image_id()` function
- [x] MD5 hash-based assignment (deterministic)
- [x] 70% train / 20% val / 10% test ratio
- [x] Update dice_export_service.py
- [x] Test split distribution

**Implementation** (`dice_export_service.py:48-80`):
```python
def get_split_from_image_id(image_id: str, train_ratio: float = 0.7, val_ratio: float = 0.2) -> str:
    """
    Deterministically assign train/val/test split based on image_id hash.

    Returns:
        "train", "val", or "test"
    """
    hash_val = int(hashlib.md5(image_id.encode()).hexdigest(), 16)
    normalized = (hash_val % 10000) / 10000.0

    if normalized < train_ratio:
        return "train"
    elif normalized < train_ratio + val_ratio:
        return "val"
    else:
        return "test"
```

**Benefits**:
- ✅ Deterministic: same image_id → same split
- ✅ Reproducible ML experiments
- ✅ No configuration needed
- ✅ Stable across dataset updates

### 12.2 Optional Enhancements (1h) ✅ Complete

**12.2.1 Add file_format field** (1h) ✅
- [x] Extract from file_name
- [x] Add to DICE output
- [x] Support png, jpg, jpeg, bmp, etc.

**Implementation** (`dice_export_service.py:262-264`):
```python
file_ext = os.path.splitext(file_name)[1]  # e.g., ".png"
file_format = file_ext[1:].lower() if file_ext else "unknown"  # e.g., "png"
```

**Output**:
```json
{
  "id": 1,
  "file_name": "images/zipper/combined/001.png",
  "file_format": "png",
  "width": 1024,
  "height": 768
}
```

### 12.3 Image ID Format Fix (3h) ✅ Complete

**Problem**: Image IDs were stored without file extensions, causing:
- file_format to be "unknown"
- Annotation matching issues
- Export inconsistencies

**Solution** (Commit `5ab11a4`):
- [x] Update `list_dataset_images()` to preserve full path with extensions
- [x] Changed from `"images/zipper/001"` to `"images/zipper/001.png"`
- [x] Create migration script for existing data
- [x] Execute migration (1725 records updated)

**Files Modified**:
- `backend/app/core/storage.py` - Preserve extensions in list_dataset_images
- `backend/scripts/migrate_add_file_extensions.py` - Migration script (300 lines)
- `backend/scripts/verify_file_extensions.py` - Verification script (82 lines)

**Migration Results**:
```
✅ Successfully updated 1725 ImageMetadata records
✅ Successfully updated 1725 ImageAnnotationStatus records
✅ Successfully updated 2847 Annotation records
✅ All file extensions preserved
```

### 12.4 Timezone Display Fix (1h) ✅ Complete

**Problem**: All timestamps displayed in UTC instead of Asia/Seoul (KST)

**Solution** (Commit `5ab11a4`):
- [x] Fix frontend timezone parsing
  - Add 'Z' suffix to UTC timestamps for proper parsing
  - Convert to Asia/Seoul before display
- [x] Apply to all date displays:
  - Annotation Versions
  - Version History
  - Dataset summary annotation history
  - Project creation dates

**Files Modified**:
- `frontend/app/page.tsx` - Dataset summary timestamps
- `frontend/components/annotation/AnnotationHistory.tsx` - Annotation history
- `frontend/components/annotation/VersionHistoryModal.tsx` - Version history

### 12.5 Database Session Separation (included in 12.3)

- [x] Add `user_db` session parameter to DICE export functions
- [x] Properly separate user/platform/labeler database concerns
- [x] Fix cross-database queries

### Implementation Summary

**Commits**:
- `204e4b0`: feat: Improve DICE export format with metadata enhancements
- `5ab11a4`: fix: Preserve file extensions in image_ids and fix timezone display

**Total Implementation Time**: ~8 hours (vs 22h estimated)

**Files Modified**:
- `backend/app/services/dice_export_service.py` (59 insertions, 5 deletions)
- `backend/app/core/storage.py` (9 insertions, 1 deletion)
- `backend/app/api/v1/endpoints/datasets.py` (1 insertion)
- `backend/app/api/v1/endpoints/export.py` (6 insertions)
- `backend/app/services/dataset_delete_service.py` (7 insertions, 1 deletion)
- `frontend/app/page.tsx` (30 insertions, 11 deletions)
- `frontend/components/annotation/AnnotationHistory.tsx` (8 insertions)
- `frontend/components/annotation/Canvas.tsx` (7 insertions)
- `frontend/components/annotation/VersionHistoryModal.tsx` (8 insertions)

**Files Created**:
- `backend/scripts/migrate_add_file_extensions.py` (300 lines)
- `backend/scripts/verify_file_extensions.py` (82 lines)

### Testing & Validation

- [x] Test DICE export with zipper dataset
- [x] Verify labeled_by / reviewed_by populated
- [x] Verify split distribution (70/20/10)
- [x] Verify file_format extracted correctly
- [x] Verify image_id includes file extensions
- [x] Verify timezone display in KST
- [x] Verify migration script (1725 records)

### Key Achievements

✅ **Metadata Quality**: labeled_by/reviewed_by fallback prevents null values
✅ **ML Pipeline Ready**: Deterministic train/val/test splits
✅ **Data Consistency**: File extensions preserved in all image_ids
✅ **Timezone Accuracy**: All dates display in correct timezone (KST)
✅ **Database Integrity**: Proper session separation and cross-DB queries

### Deferred Items (Future Phases)

**Image ID Strategy** (Not changed):
- Current: Sequential integer ID (COCO compatible) + file_name with extension
- Future options:
  - Hybrid approach (integer ID + file_path field)
  - UUID-based stable IDs
- Decision: Keep current format for COCO compatibility

**iscrowd Support** (Phase 13+):
- Current: Always 0 (instance annotation)
- Future: Add UI for crowd annotation marking

**Attributes Schema Validation** (Phase 13+):
- Current: Flexible JSON structure
- Future: Project-level schema validation

### Dependencies

- ✅ Phase 4 (Version Management) complete
- ✅ Phase 9.1 (User DB separation) complete
- ✅ Phase 9.3 (R2 External Storage) complete

**Related Documentation**:
- `docs/phase-11-dataset-publish-improvements.md` - Detailed planning document

---

## Phase 13: AI Integration ⏸️ PENDING

**Duration**: Weeks 13-14 (60h)
**Status**: Pending

### 13.1 Auto-Annotation (20h)
- [ ] Model integration (YOLOv8, SAM)
- [ ] Auto-detect objects in image
- [ ] Confidence scores and filtering

### 13.2 Smart Assist (15h)
- [ ] Object proposals
- [ ] Edge snapping
- [ ] Similar object detection

### 13.3 Model Training (25h)
- [ ] Export to training format
- [ ] Integration with training pipeline
- [ ] Model versioning

**Dependencies**: Phase 9 completion (stable production DB)

---

## Phase 14: Polish & Optimization ⏸️ PENDING

**Duration**: Week 15 (40h)
**Status**: Pending

### 14.1 Performance (10h)
- [ ] Frontend bundle optimization
- [ ] Lazy loading components
- [ ] Image preloading

### 14.2 UX Improvements (15h)
- [ ] Keyboard shortcut guide
- [ ] Onboarding tour
- [ ] Error handling polish

### 14.3 Testing & QA (15h)
- [ ] E2E test coverage
- [ ] Load testing
- [ ] Bug fixes

**Dependencies**: Phase 13 completion

---

## Phase 15: Admin Dashboard & Audit ⏸️ PENDING

**Duration**: 2-3 weeks (60-75h)
**Status**: Pending
**Priority**: High (Production readiness)

### Overview

Phase 15에서는 시스템 관리자를 위한 포괄적인 관리 기능을 구축합니다. 데이터셋 현황, 사용자 활동, 시스템 리소스를 모니터링하고, 전체 시스템 사용에 대한 audit trail을 제공하여 프로덕션 환경에서의 운영 효율성과 보안을 강화합니다.

**Key Features**:
- 📊 Admin Dashboard: 데이터셋 현황, 레이블링 진행도, 사용자 통계
- 📝 Audit Log System: 모든 시스템 작업에 대한 상세 로그 및 추적
- 📈 System Statistics: 사용자 활동, 리소스 사용량, 성능 메트릭

### 15.1 Admin Dashboard - Dataset Manager (18-22h) ⏸️

**Goal**: 전체 데이터셋 현황을 한눈에 파악하고 관리

#### 15.1.1 Backend API (8-10h) ✅ Complete
- [x] Dataset overview API (`GET /api/v1/admin/datasets/overview`)
  - Total datasets, images, storage, annotations
  - Datasets by status (active/completed/archived)
  - Recent updates timeline
- [x] Dataset detail API (`GET /api/v1/admin/datasets/{id}/details`)
  - Dataset metadata and associated projects
  - User permissions table
  - Recent activity timeline
- [x] Labeling progress API (`GET /api/v1/admin/datasets/{id}/progress`)
  - Images by status breakdown
  - Annotations by task type
  - Completion rate trends
  - User contribution stats
  - Average labeling time

#### 15.1.2 Frontend Dashboard (10-12h) ✅ Complete
- [x] Dataset Manager page (`frontend/app/admin/datasets/page.tsx`)
  - Overview cards (datasets, images, storage, annotations)
  - Dataset list with recent updates
  - Click to view details
- [x] Dataset detail view
  - Info panel (metadata, size, projects)
  - Storage information
  - Progress visualization
- [x] Admin menu in Sidebar
  - Only shown for admin users (system_role === 'admin')
  - Links to Dataset Manager and Audit Logs

### 15.2 Audit Log System (20-25h) ⏸️

**Goal**: 모든 시스템 작업에 대한 추적 및 로그

#### 15.2.1 Library Selection & Architecture (2h) ✅ Complete
- [x] Evaluate audit logging libraries
  - Custom implementation (FastAPI middleware + SQLAlchemy events)
  - SQLAlchemy-Continuum
  - Python-audit-log
- [x] **Decision**: Custom implementation for FastAPI compatibility
- [x] Design database schema (`audit_logs`, `user_sessions` tables)

#### 15.2.2 Backend Implementation (10-12h) 🔄 In Progress
- [x] Audit service (`backend/app/services/audit_service.py`)
  - Core logging functions (log_action, log_login, log_create, etc.)
  - Async logging for performance
  - Session tracking integration
- [x] Audit middleware (`backend/app/middleware/audit_middleware.py`)
  - Automatic request/response logging
  - IP address and user agent capture
  - Exclude health checks and static assets
  - Optional: Can be enabled in main.py
- [ ] Model event listeners
  - SQLAlchemy events (before_insert, before_update, before_delete)
  - Field-level change tracking
  - Models: User, Dataset, Project, Annotation, Permissions
- [x] Audit log query API
  - `GET /api/v1/admin/audit-logs` (paginated, filtered)
  - `GET /api/v1/admin/audit-logs/{id}` (detail)
  - `GET /api/v1/admin/audit-logs/stats/summary` (statistics)

#### 15.2.3 Frontend Audit Viewer (8-10h) ✅ Complete
- [x] Audit log page (`frontend/app/admin/audit-logs/page.tsx`)
  - Log table (timestamp, user, action, resource, status, IP)
  - Statistics cards (total logs, unique users, success rate, errors)
  - Color-coded status badges
- [x] Advanced filters
  - Action type filter (dropdown)
  - Resource type filter (dropdown)
  - Status filter (success/failure/error)
  - Time range filter for stats (1/7/30/90 days)
- [x] Log detail modal
  - Full details with timestamp, user, action, resource
  - IP address, user agent, session info
  - JSON details display
  - Error message (if applicable)
- [x] Pagination
  - 50 logs per page
  - Previous/Next navigation

### 15.3 System Statistics Dashboard (22-28h) ✅ Complete

**Goal**: 시스템 전체 통계 및 사용 패턴 분석

#### 15.3.1 Backend Statistics API (10-12h) ✅ Complete
- [x] User statistics API
  - `GET /api/v1/admin/stats/users` (total, active, new users)
  - `GET /api/v1/admin/stats/sessions` (duration, active sessions, timeline)
- [x] Resource usage statistics API
  - `GET /api/v1/admin/stats/resources` (datasets, images, annotations, storage)
- [x] Performance metrics API
  - `GET /api/v1/admin/stats/performance` (annotation rate, task distribution, top annotators)
- [x] System overview API
  - `GET /api/v1/admin/stats/overview` (comprehensive system stats)
- [x] Statistics service (`backend/app/services/system_stats_service.py`)
  - User activity stats (registration trend, login activity)
  - Resource usage stats (datasets, images, annotations, storage)
  - Performance metrics (annotation rate, task distribution)
  - Session statistics (active sessions, avg duration)

#### 15.3.2 Frontend Statistics Dashboard (12-16h) ✅ Complete
- [x] Overview dashboard (`frontend/app/admin/stats/page.tsx`)
  - KPI cards (total users, active users, new users, logins)
  - Resource usage cards (datasets, images, annotations, storage)
  - Performance cards (avg annotations/day, active sessions, session duration)
- [x] User activity section
  - Registration trend chart (bar chart)
  - Active users metrics (7d/30d)
  - New users tracking
  - Login activity stats
- [x] Resource usage section
  - Datasets by status
  - Annotations by task type (progress bars)
  - Storage usage
  - Recent activity tracking
- [x] Performance metrics section
  - Daily annotation rate chart (bar chart)
  - Daily sessions chart (bar chart)
  - Task distribution
  - Session statistics
- [x] Time range filter (7/30/90 days)
- [x] Refresh functionality

### 15.4 Integration & Polish (10-12h) ✅ Complete

#### 15.4.1 Permission & Access Control (3-4h) ✅ Complete
- [x] ~~Add `is_admin` field~~ ✅ 이미 존재 (user.system_role, user.is_admin)
- [x] Implement `require_admin` dependency (`get_current_admin_user`)
- [x] Admin menu visibility logic (sidebar, check user.system_role === 'admin')
- [x] API authorization (403 for non-admin via Depends(get_current_admin_user))
- [x] Route guards (redirect non-admin to home page)

#### 15.4.2 UI/UX Polish (4-5h) ✅ Complete
- [x] Sidebar menu updates
  - Add admin section above user profile
  - 3 menu items: Dataset Manager, System Logs, System Stats
  - Icons and hover effects
- [x] Admin page layout
  - Page headers with title and description
  - Action buttons (refresh)
  - Time range selectors
- [x] Loading & error states
  - Loading indicators
  - Error handling with toast notifications
  - Empty states with helpful messages
  - 403 error redirect to home

#### 15.4.3 Testing & Documentation (3h)
- [ ] Unit tests (audit_service, stats_cache_service)
- [ ] Integration tests (admin APIs)
- [ ] E2E tests (dashboard navigation)
- [ ] Performance testing (statistics queries)
- [ ] Documentation
  - Admin user guide (`docs/admin-dashboard-guide.md`)
  - Audit log specification (`docs/audit-log-specification.md`)
  - Update API docs (Swagger)
  - Update RBAC docs

### Database Schema

**CONSTRAINT**: UserDB는 플랫폼팀 소유로 수정 불가

**New Tables** (Labeler DB):
- `audit_logs` (Labeler DB) - Comprehensive audit trail
- `user_sessions` (Labeler DB) - Session tracking for analytics
- `system_stats_cache` (Labeler DB) - Pre-calculated statistics

**User Model**: ✅ 수정 불필요
- `system_role` 필드 이미 존재 ('admin' or 'user')
- `is_admin` property 이미 구현됨

### Technical Decisions

**Key Choices**:
1. **Audit logs in Labeler DB**: UserDB 수정 불가 → Labeler DB 활용 ✅
2. **Custom audit implementation**: FastAPI middleware + SQLAlchemy events
3. **Hybrid statistics**: Real-time for simple counts, cached for expensive aggregations
4. **Async logging**: Non-blocking audit writes for performance
5. **Retention policy**: 90 days hot, 1 year warm (archived), 1+ year cold (R2)
6. **Admin role**: 기존 `user.is_admin` property 활용 (system_role 기반)

### UI Structure

```
Sidebar                    Main Content
---------                  ------------
Datasets                   [Selected Dashboard Content]
Projects
...
────────────────
📊 Dataset Manager   ← New
📝 System Logs       ← New
📈 System Stats      ← New
────────────────
User Profile
Logout
```

**Dependencies**:
- ✅ Phase 8.1 (RBAC) - Permission system 기초
- ✅ Phase 9.1 (User DB) - User.system_role 필드 활용

**Implementation Constraints** (2025-11-26):
- ❌ UserDB 수정 불가 (플랫폼팀 소유)
- ✅ Labeler DB에 모든 새 테이블 생성
- ✅ user.is_admin property 활용 (이미 구현됨)

**Total**: 60-75h over 2-3 weeks

**Files to Create**:
- Backend: `audit_service.py`, `stats_cache_service.py`, `audit_middleware.py`, `admin_*.py` (APIs), `audit.py` (models)
- Frontend: `app/admin/*` (pages), `components/admin/*` (components), `lib/api/admin.ts` (client)
- Docs: `admin-dashboard-guide.md`, `audit-log-specification.md`

**Detailed Plan**: `docs/phase-15-admin-dashboard-and-audit.md`

---

## Phase 16: Platform Integration - Hybrid JWT Authentication 🔄 IN PROGRESS

**Duration**: 1 week (35-40h)
**Status**: 🔄 In Progress (16.1-16.4 기존 구현 → 16.5 Hybrid JWT 전환)
**Priority**: 🔴 Critical (Platform Training Jobs 의존성)

### Overview

Phase 16에서는 Platform과 Labeler 간 **Hybrid JWT Authentication**을 구현하여 안전한 마이크로서비스 간 통신을 구축합니다. Dataset 관리가 Platform → Labeler로 이전되면서 발생한 데이터 중복 문제를 해결하고, Labeler를 **Dataset의 Single Source of Truth**로 확립합니다.

**Architecture Principle**:
```
┌─────────────────────────────────────┐
│        Platform Backend             │
│                                     │
│  User Requests                      │
│  ↓                                  │
│  Generate Hybrid JWT (5min)         │
│  • user_id (from session)           │
│  • service: "platform"              │
│  • scopes: ["labeler:read"]         │
│  ↓                                  │
│  Authorization: Bearer {JWT}        │
└──────────┬──────────────────────────┘
           │ HTTPS
           ▼
┌─────────────────────────────────────┐
│        Labeler Backend              │
│                                     │
│  Verify JWT Signature               │
│  ↓                                  │
│  Extract user_id + service          │
│  ↓                                  │
│  Check user permissions             │
│  ↓                                  │
│  Return dataset data                │
└─────────────────────────────────────┘
```

**Key Features**:
- 🔐 **Hybrid JWT Authentication**: User context + Service identity
- 👤 **User Context**: JWT carries user_id for permission checks
- ⏱️ **Short-lived Tokens**: 5min (user requests), 1h (background jobs)
- 🎯 **Scope-based Authorization**: labeler:read, labeler:write, labeler:delete
- 🔒 **Shared Secret**: SERVICE_JWT_SECRET between Platform & Labeler
- 📊 **Dataset Query API**: Single/List/Batch with filtering
- 🔒 **Permission Check API**: User-level dataset access validation
- 📦 **Download URL Generation**: R2 Presigned URL

**Requirements Documents**:
- Platform 요청: `C:\Users\flyto\Project\Github\mvp-vision-ai-platform\docs\cowork\LABELER_AUTHENTICATION_GUIDE.md`
- Dataset API: `C:\Users\flyto\Project\Github\mvp-vision-ai-platform\docs\integration\LABELER_DATASET_API_REQUIREMENTS.md`

**Architecture Decision** (2025-11-28):
- ❌ **Deprecated**: Service Account API Key 방식 (Phase 16.1-16.4)
- ✅ **Adopted**: Hybrid JWT Authentication (Platform 표준)
- **Reason**: Microservice 간 통합 인증 표준화, User context 필요성

### 16.1 Service Account Authentication (8-10h) ✅ **DEPRECATED**

**Status**: ✅ Complete (2025-11-28) → ❌ **To be replaced by Hybrid JWT (16.5)**
**Goal**: ~~Platform에서 Labeler API를 안전하게 호출할 수 있는 인증 시스템 구축~~

**Deprecation Note**:
- Service Account API Key 방식으로 구현 완료
- Platform 팀 요청으로 Hybrid JWT 방식으로 전환 결정
- Phase 16.5에서 코드 삭제 및 JWT 방식 구현 예정

#### 16.1.1 Database Schema (2h) ⏸️
- [ ] Service Account model (User DB)
  - `id` VARCHAR PRIMARY KEY (e.g., "sa_platform_12345")
  - `service_name` VARCHAR (e.g., "vision-platform")
  - `api_key_hash` VARCHAR (bcrypt hashed)
  - `scopes` TEXT[] (e.g., ["datasets:read", "datasets:download"])
  - `created_by` INTEGER (admin user ID)
  - `created_at`, `expires_at`, `last_used_at` TIMESTAMP
- [ ] Alembic migration
  - `alembic revision --autogenerate -m "Add service_accounts table"`
  - Apply migration to User DB

**Schema**:
```sql
CREATE TABLE service_accounts (
    id VARCHAR PRIMARY KEY,
    service_name VARCHAR NOT NULL UNIQUE,
    api_key_hash VARCHAR NOT NULL,
    scopes TEXT[] NOT NULL,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NULL,
    last_used_at TIMESTAMP NULL
);
CREATE INDEX idx_service_accounts_service_name ON service_accounts(service_name);
```

#### 16.1.2 Backend Implementation (4-5h) ⏸️
- [ ] Service Account model (`backend/app/db/models/user.py`)
  - SQLAlchemy model with `scopes` as ARRAY type
  - `verify_api_key()` method
  - `has_scope()` helper method
- [ ] Service Account schemas (`backend/app/schemas/service_account.py`)
  - `ServiceAccountCreate`, `ServiceAccountResponse`
- [ ] Service Account service (`backend/app/services/service_account_service.py`)
  - `create_service_account()` - Generate API key, hash, store
  - `verify_service_account()` - Verify API key and scopes
  - `update_last_used()` - Track last usage
  - `revoke_service_account()` - Soft delete
- [ ] Auth dependency (`backend/app/core/security.py`)
  - `get_current_service_account()` - Verify Bearer token as service account
  - `require_scope()` - Check if service account has required scope

#### 16.1.3 Admin API Endpoints (2-3h) ⏸️
- [ ] Create service account (`POST /api/v1/auth/service-accounts`)
  - Admin only (`Depends(get_current_admin_user)`)
  - Generate random API key (32 characters)
  - Return plaintext key once (never stored)
  - Response: `{ "service_account_id", "api_key", "scopes", "expires_at" }`
- [ ] List service accounts (`GET /api/v1/auth/service-accounts`)
  - Admin only
  - Return list without API keys
- [ ] Revoke service account (`DELETE /api/v1/auth/service-accounts/{id}`)
  - Admin only
  - Soft delete or hard delete (TBD)

**API Example**:
```http
POST /api/v1/auth/service-accounts HTTP/1.1
Authorization: Bearer {admin_token}

{
  "service_name": "vision-platform",
  "scopes": ["datasets:read", "datasets:download", "datasets:permissions"]
}

Response 201:
{
  "service_account_id": "sa_platform_abc123",
  "api_key": "labeler_sk_def456ghi789...",  ← Only shown once
  "scopes": ["datasets:read", "datasets:download", "datasets:permissions"],
  "expires_at": null
}
```

**Platform Usage**:
```python
# platform/backend/.env
LABELER_API_URL=https://labeler-api.example.com
LABELER_SERVICE_KEY=labeler_sk_def456ghi789...

# All Platform → Labeler API calls use this header:
Authorization: Bearer labeler_sk_def456ghi789...
```

### 16.2 Dataset Query API (10-12h) ✅ **COMPLETE - Auth to be updated**

**Status**: ✅ Complete (2025-11-28) → 🔄 **Auth migration needed (16.5)**
**Goal**: Platform이 데이터셋 메타데이터를 조회할 수 있는 API 제공

**Implementation Note**:
- 엔드포인트 구현 완료 (Service Account 인증)
- Phase 16.5에서 Hybrid JWT 인증으로 전환

#### 16.2.1 Enhanced Single Dataset Query (3-4h) ⏸️
- [ ] Update `GET /api/v1/datasets/{id}` endpoint
  - Support service account authentication
  - Add new response fields:
    - `storage_type` ("r2")
    - `storage_path` ("datasets/ds_abc/")
    - `annotation_path` ("datasets/ds_abc/annotations_detection.json")
    - `content_hash` ("sha256:...")
    - `version` (integer)
    - `class_names` (list of strings)
    - `tags` (list of strings)
  - Enrich from Project info (num_images, num_classes)
- [ ] Update dataset schema (`backend/app/schemas/dataset.py`)
  - `DatasetDetailResponse` with all new fields

**Response Schema** (enhanced):
```json
{
  "id": "ds_c75023ca76d7448b",
  "name": "mvtec-bottle-detection",
  "description": "MVTec Bottle Detection Dataset",
  "format": "coco",
  "labeled": true,
  "storage_type": "r2",
  "storage_path": "datasets/ds_c75023ca76d7448b/",
  "annotation_path": "datasets/ds_c75023ca76d7448b/annotations_detection.json",
  "num_classes": 2,
  "num_images": 1000,
  "class_names": ["broken", "normal"],
  "tags": ["mvtec", "bottle", "detection"],
  "visibility": "public",
  "owner_id": 1,
  "created_at": "2025-11-20T10:00:00Z",
  "updated_at": "2025-11-27T09:30:00Z",
  "version": 1,
  "content_hash": "sha256:abc123..."
}
```

#### 16.2.2 Dataset List with Filtering (3-4h) ⏸️
- [ ] Update `GET /api/v1/datasets` endpoint
  - Add query parameters:
    - `user_id` (optional): Filter by owner
    - `visibility` (optional): "public", "private", "organization"
    - `labeled` (optional): true/false
    - `tags` (optional): Comma-separated (e.g., "detection,mvtec")
    - `format` (optional): "coco", "yolo", "dice", "imagefolder"
    - `page` (optional): Default 1
    - `limit` (optional): Default 50, max 200
  - Paginated response with total count
- [ ] Backend service enhancements
  - Build dynamic SQLAlchemy filters
  - Efficient query with pagination
  - Include dataset counts in response

**Endpoint**: `GET /api/v1/datasets?visibility=public&labeled=true&format=coco&limit=10`

**Response**:
```json
{
  "total": 150,
  "page": 1,
  "limit": 10,
  "datasets": [
    {
      "id": "ds_c75023ca76d7448b",
      "name": "mvtec-bottle-detection",
      "format": "coco",
      "labeled": true,
      "num_images": 1000,
      "num_classes": 2,
      "visibility": "public",
      "owner_id": 1,
      "storage_type": "r2",
      "created_at": "2025-11-20T10:00:00Z"
    },
    ...
  ]
}
```

#### 16.2.3 Batch Dataset Query (4h) ⏸️
- [ ] Create `POST /api/v1/datasets/batch` endpoint
  - Accept list of dataset IDs (max 50)
  - Optional `fields` parameter for partial response
  - Return dictionary keyed by dataset_id
  - Partial success: Return found datasets + errors for missing ones
- [ ] Batch query service
  - Single DB query with `WHERE id IN (...)`
  - Field filtering logic
  - Error handling per dataset

**Endpoint**: `POST /api/v1/datasets/batch`

**Request**:
```json
{
  "dataset_ids": ["ds_c75023ca76d7448b", "ds_abc123", "ds_xyz789"],
  "fields": ["id", "name", "num_images", "format", "storage_path"]
}
```

**Response**:
```json
{
  "datasets": {
    "ds_c75023ca76d7448b": {
      "id": "ds_c75023ca76d7448b",
      "name": "mvtec-bottle-detection",
      "num_images": 1000,
      "format": "coco",
      "storage_path": "datasets/ds_c75023ca76d7448b/"
    },
    "ds_abc123": {
      "id": "ds_abc123",
      "name": "coco128",
      "num_images": 128,
      "format": "coco",
      "storage_path": "datasets/ds_abc123/"
    },
    "ds_xyz789": null
  },
  "errors": {
    "ds_xyz789": "Dataset not found"
  }
}
```

### 16.3 Permission Check API (4-5h) ✅ **COMPLETE - Auth to be updated**

**Status**: ✅ Complete (2025-11-28) → 🔄 **Auth migration needed (16.5)**
**Goal**: Platform이 사용자의 데이터셋 접근 권한을 확인할 수 있는 API

**Implementation Note**:
- 엔드포인트 구현 완료 (Service Account 인증)
- Phase 16.5에서 Hybrid JWT 인증으로 전환

#### 16.3.1 Permission Check Endpoint (4-5h) ⏸️
- [ ] Create `GET /api/v1/datasets/{dataset_id}/permissions/{user_id}` endpoint
  - Service account authentication required
  - Permission check logic:
    1. Check if user is owner (`dataset.owner_id == user_id`)
    2. Check if dataset is public (`dataset.visibility == 'public'`)
    3. Check organization membership (if implemented)
    4. Check explicit permissions (ProjectPermission table from Phase 8)
  - Return access status + role + reason
- [ ] Permission service (`backend/app/services/permission_service.py`)
  - `check_dataset_access(dataset_id, user_id)` - Comprehensive check
  - Return `{ has_access, role, reason }`

**Endpoint**: `GET /api/v1/datasets/{dataset_id}/permissions/{user_id}`

**Response**:
```json
{
  "dataset_id": "ds_c75023ca76d7448b",
  "user_id": 42,
  "has_access": true,
  "role": "viewer",
  "reason": "public_dataset"
}
```

**Possible Reasons**:
- `"owner"`: User owns the dataset
- `"public_dataset"`: Dataset is public
- `"organization_member"`: User is in the same organization
- `"explicit_permission"`: User has been granted permission (Phase 8)
- `"no_access"`: User cannot access

### 16.4 Download URL Generation (6-8h) ✅ **COMPLETE - Auth to be updated**

**Status**: ✅ Complete (2025-11-28) → 🔄 **Auth migration needed (16.5)**
**Goal**: Platform Training Service가 데이터셋을 다운로드할 수 있는 임시 URL 생성

**Implementation Note**:
- 엔드포인트 구현 완료 (Service Account 인증)
- Phase 16.5에서 Hybrid JWT 인증으로 전환

#### 16.4.1 R2 Presigned URL Generation (6-8h) ⏸️
- [ ] Create `POST /api/v1/datasets/{dataset_id}/download-url` endpoint
  - Service account authentication required
  - Verify user has permission to access dataset
  - Generate R2 presigned URL (S3-compatible API)
  - Configurable expiration (default 1 hour, max 24 hours)
  - Audit log the download request
  - Return URL + metadata (size, format, manifest)
- [ ] Download URL service (`backend/app/services/download_url_service.py`)
  - `generate_download_url(dataset_id, user_id, expiration_seconds, purpose)`
  - Use `CloudflareR2StorageBackend.generate_presigned_url()`
  - Track download in audit logs
  - Include manifest (images path, annotations path, readme)
- [ ] Dataset packaging considerations
  - Assume dataset is already in R2 as ZIP or directory
  - If directory, return presigned URL to root
  - If ZIP, return presigned URL to archive.zip

**Endpoint**: `POST /api/v1/datasets/{dataset_id}/download-url`

**Request**:
```json
{
  "user_id": 42,
  "expiration_seconds": 3600,
  "purpose": "training_job_123"
}
```

**Response**:
```json
{
  "dataset_id": "ds_c75023ca76d7448b",
  "download_url": "https://r2.cloudflare.com/datasets/.../archive.zip?X-Amz-Algorithm=...",
  "expires_at": "2025-11-27T11:15:00Z",
  "format": "zip",
  "size_bytes": 524288000,
  "manifest": {
    "images": "images/",
    "annotations": "annotations_detection.json",
    "readme": "README.md"
  }
}
```

**Implementation Notes**:
- Use `boto3` S3 client with R2 credentials
- `generate_presigned_url(ClientMethod='get_object', ExpiresIn=3600)`
- URL expires automatically (no cleanup needed)
- Consider adding download count tracking in audit logs

### 16.5 Hybrid JWT Authentication Migration (12-15h) 🔄 **IN PROGRESS**

**Status**: 🔄 In Progress (2025-11-28) - **70% Complete** (16.5.1, 16.5.2, 16.5.3 완료)
**Goal**: Service Account API Key 방식을 Hybrid JWT 방식으로 완전 전환

**Progress**:
- ✅ 16.5.1: Service Account 코드 삭제 (2h)
- ✅ 16.5.2: Hybrid JWT 인증 구현 (4h)
- ✅ 16.5.3: Platform Dataset Endpoints 업데이트 (3h)
- ⏸️ 16.5.4: Testing & Validation (2h) - Pending
- ⏸️ 16.5.5: Documentation Update (1h) - Pending

**Architecture Decision**:
- Platform 팀이 모든 마이크로서비스에서 Hybrid JWT 표준 사용
- User context (user_id)가 필요한 permission 로직에 필수적
- Short-lived tokens (5min user, 1h background)으로 보안 강화

**Requirements Document**: `C:\Users\flyto\Project\Github\mvp-vision-ai-platform\docs\cowork\LABELER_AUTHENTICATION_GUIDE.md`

#### 16.5.1 기존 Service Account 코드 삭제 (2-3h) ✅ **COMPLETE**

**Completion Date**: 2025-11-28
**Actual Duration**: ~2h

**삭제 완료**:
```
backend/app/db/models/labeler.py
- ✅ ServiceAccount model (lines 804-858) 삭제
- ✅ pwd_context import (line 20) 삭제

backend/app/schemas/service_account.py
- ✅ 전체 파일 삭제

backend/app/services/service_account_service.py
- ✅ 전체 파일 삭제

backend/app/api/v1/endpoints/service_accounts.py
- ✅ 전체 파일 삭제

backend/app/core/security.py
- ✅ get_current_service_account() (lines 404-460) 삭제
- ✅ require_scope() (lines 463-502) 삭제

backend/app/api/v1/router.py
- ✅ service_accounts import 삭제
- ✅ service_accounts router 삭제

backend/alembic/versions/20251127_2141_20f9d474c620_*.py
- ✅ Migration 파일 삭제
```

**작업 완료**:
- [x] service_accounts 테이블 삭제 (Direct SQL - Alembic downgrade 실패로 인한 대안)
- [x] 코드 파일 삭제 (4개 파일)
- [x] Import 정리 (5개 파일 수정)
- [x] Git commit: `a68bf52 - refactor: Remove deprecated Service Account authentication (Phase 16.5.1)`

**Note**: Alembic downgrade failed due to ip_address column type conflicts in unrelated migrations. Used direct SQL `DROP TABLE service_accounts CASCADE` instead.

#### 16.5.2 Hybrid JWT 인증 구현 (5-6h) ✅ **COMPLETE**

**Completion Date**: 2025-11-28
**Actual Duration**: ~4h

**Configuration** (`backend/app/core/config.py`):
- [x] Add `SERVICE_JWT_SECRET` to settings
  ```python
  SERVICE_JWT_SECRET: str = "service-jwt-secret-change-in-production"
  SERVICE_JWT_ALGORITHM: str = "HS256"
  ```
- Implementation: `backend/app/core/config.py:121-124`

**JWT Verification** (`backend/app/core/service_jwt.py` - 새 파일):
- [x] Created new module with 285 lines
- [x] Verification functions:
  * `verify_service_jwt()` - Decode JWT with SERVICE_JWT_SECRET
  * `validate_service_jwt_payload()` - Check required fields (sub, service, type, scopes)
  * `extract_user_id_from_jwt()` - Extract user_id from 'sub' claim as integer
  * `check_jwt_scopes()` - Validate required scopes
- [x] FastAPI dependencies:
  * `get_service_jwt_payload()` - Extract & verify JWT from Authorization header
  * `require_service_scope()` - Dependency factory for scope validation
  * `get_service_user_id()` - Direct user_id extraction
- [x] Scope validation logic with HTTPException(403) for missing scopes
- [x] Service & type validation (must be "platform" and "service")
- [x] JWT expiration handled by jose library

**Files Created**:
- `backend/app/core/service_jwt.py` (285 lines)

**Implementation Notes**:
- Uses existing PyJWT from jose library (no new dependencies)
- JWT validation checks: signature, expiration, type, service, scopes
- User context extracted from "sub" claim (string → int conversion)
- Supports both user requests (5min) and background jobs (1h) via exp claim

#### 16.5.3 Platform Dataset Endpoints 업데이트 (3-4h) ✅ **COMPLETE**

**Completion Date**: 2025-11-28
**Actual Duration**: ~3h

**Update** (`backend/app/api/v1/endpoints/platform_datasets.py`):
- [x] Replace authentication dependencies
  ```python
  # Before:
  service_account: ServiceAccount = Depends(get_current_service_account),
  _scope: ServiceAccount = Depends(require_scope("datasets:read")),

  # After:
  jwt_payload: Dict[str, Any] = Depends(get_service_jwt_payload),
  _scope: Dict = Depends(require_service_scope("labeler:read")),
  ```
- [x] Updated all 5 endpoints with JWT auth:
  - ✅ `GET /api/v1/platform/datasets/{dataset_id}` → `labeler:read` scope
  - ✅ `GET /api/v1/platform/datasets` → `labeler:read` scope
  - ✅ `POST /api/v1/platform/datasets/batch` → `labeler:read` scope
  - ✅ `GET /api/v1/platform/datasets/{dataset_id}/permissions/{user_id}` → `labeler:read` scope
  - ✅ `POST /api/v1/platform/datasets/{dataset_id}/download-url` → `labeler:read` scope
- [x] Extract user_id from JWT payload
  ```python
  user_id = extract_user_id_from_jwt(jwt_payload)
  # Used for permission checks in download-url endpoint
  ```
- [x] Updated permission checks to use JWT user_id
- [x] Removed all service_account references
- [x] Updated imports to include service_jwt functions
- [x] Updated docstrings to reflect JWT authentication

**Schema Update** (`backend/app/schemas/platform.py`):
- [x] Updated `PlatformDownloadUrlRequest`:
  - Removed `user_id` field (now from JWT)
  - Added migration note

**Scope Mapping**:
```
Platform Scope → Required for Endpoints
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
labeler:read  → ✅ GET /platform/datasets/*
                ✅ POST /platform/datasets/batch
labeler:write → (future) POST/PUT dataset operations
labeler:delete → (future) DELETE dataset operations
```

**Files Modified**:
- `backend/app/api/v1/endpoints/platform_datasets.py` (updated auth in 5 endpoints)
- `backend/app/schemas/platform.py` (removed user_id from PlatformDownloadUrlRequest)

**Commit**:
- `1d46d52 - feat: Phase 16.5.2 - Implement Hybrid JWT Authentication for Platform Integration`

#### 16.5.4 Testing & Validation (2h) ⏸️

**Unit Tests** (`backend/tests/test_service_jwt.py` - 새 파일):
- [ ] Test JWT verification
  ```python
  def test_verify_valid_jwt():
      """Test valid JWT with user_id"""

  def test_verify_background_jwt():
      """Test background job JWT (no user_id)"""

  def test_expired_jwt():
      """Test expired JWT returns 401"""

  def test_insufficient_scope():
      """Test missing scope returns 403"""
  ```

**Integration Tests**:
- [ ] Generate test JWT using Platform secret
- [ ] Test all 5 platform endpoints with JWT auth
- [ ] Verify user_id is extracted correctly
- [ ] Verify permission checks use JWT user_id

**Manual Testing**:
- [ ] Create test JWT with Python script
  ```python
  import jwt
  from datetime import datetime, timedelta

  payload = {
      "sub": "1",  # user_id
      "service": "platform",
      "scopes": ["labeler:read"],
      "type": "service",
      "iat": datetime.utcnow(),
      "exp": datetime.utcnow() + timedelta(minutes=5),
  }
  token = jwt.encode(payload, SERVICE_JWT_SECRET, algorithm="HS256")
  print(f"Test JWT: {token}")
  ```
- [ ] Test with curl:
  ```bash
  curl -H "Authorization: Bearer {JWT}" \
       http://localhost:8000/api/v1/platform/datasets/ds_test
  ```

#### 16.5.5 Documentation Update (1h) ⏸️

- [ ] Update API documentation
  - Swagger/OpenAPI: Update security scheme from ApiKey to Bearer JWT
  - Add JWT token structure documentation
  - Add scope requirements to endpoint descriptions
- [ ] Update README
  - Remove Service Account setup instructions
  - Add JWT authentication setup
  - Add SERVICE_JWT_SECRET configuration
- [ ] Create migration guide for Platform team
  - Before/After authentication flow
  - JWT payload format
  - Error handling changes

**Summary**:
```
✅ Phase 16.1-16.4: Dataset API 구현 완료 (Service Account)
✅ Phase 16.5: Hybrid JWT 전환 완료 (70%)
   → 16.5.1: 기존 코드 삭제 ✅
   → 16.5.2: JWT 인증 구현 ✅
   → 16.5.3: Endpoints 업데이트 ✅
   → 16.5.4: Testing ⏸️
   → 16.5.5: Documentation ⏸️
```

---

### 16.6 Task-Type-Specific Dataset Query (8-10h) ⏸️ **NEW**

**Goal**: 데이터셋의 task_type별 publish 상태 추적 및 task_type 기반 필터링

**Status**: ⏸️ Pending (2025-11-30 계획 수립)

**Background**:
- 하나의 데이터셋은 여러 task_type으로 publish 가능
- Example: mvtec-ad → detection ✅, segmentation ✅, classification ✅
- Platform이 특정 task_type으로 학습하려면 해당 task_type의 annotation만 필요
- 현재 문제: Dataset에 task_type 정보가 없어 필터링 불가

**Architecture**:
```python
# Before (현재):
Dataset {
    labeled: True,  # Boolean (어떤 task든 publish되면 True)
    annotation_path: "exports/.../detection/v9.0/annotations.json"  # 하나만 저장
}

# After (목표):
Dataset {
    labeled: True,  # published_task_types가 비어있지 않으면 True
    published_task_types: ["detection", "segmentation"],  # 배열
    # annotation_path는 deprecated 또는 latest만 저장
}

# Platform API 요청:
GET /api/v1/platform/datasets?task_type=segmentation&labeled=true
→ published_task_types에 "segmentation"이 포함된 데이터셋만 반환
→ annotation_path는 segmentation의 latest version export_path
```

**Use Cases**:
```
Case 1: mvtec-ad published as detection, segmentation
  - Platform requests: task_type=segmentation
  - Result: ✅ mvtec-ad returned with segmentation annotation_path

Case 2: mvtec-ad published as detection only
  - Platform requests: task_type=segmentation
  - Result: ❌ mvtec-ad excluded (not published for segmentation)

Case 3: mvtec-ad published as detection, segmentation, classification
  - Platform requests: task_type=classification
  - Result: ✅ mvtec-ad returned with classification annotation_path
```

#### 16.6.1 Database Schema (2-3h) ⏸️

**Add `published_task_types` to Dataset**:
```python
# backend/app/db/models/labeler.py
class Dataset(LabelerBase):
    # ... existing fields ...

    # Phase 16.6: Track which task_types are published
    published_task_types = Column(ARRAY(String(20)))  # ['detection', 'segmentation', 'classification']

    # annotation_path becomes deprecated or stores latest only
    annotation_path = Column(String(500))  # Latest published annotation (for backward compatibility)
```

**Alembic Migration**:
```bash
alembic revision --autogenerate -m "Add published_task_types to datasets table (Phase 16.6)"
```

**Migration File**:
```python
def upgrade():
    op.add_column('datasets', sa.Column('published_task_types', sa.ARRAY(sa.String(20)), nullable=True))

    # Migrate existing data: detect task_type from annotation_path
    # Example: "exports/.../detection/v9.0/annotations.json" → ["detection"]

def downgrade():
    op.drop_column('datasets', 'published_task_types')
```

#### 16.6.2 Update export.py Logic (2-3h) ⏸️

**Publish시 published_task_types 업데이트**:
```python
# backend/app/api/v1/endpoints/export.py (line ~460)
dataset = labeler_db.query(Dataset).filter(Dataset.id == project.dataset_id).first()
if dataset:
    dataset.annotation_path = annotation_path  # Latest annotation
    dataset.labeled = True

    # Phase 16.6: Add task_type to published_task_types array
    if dataset.published_task_types is None:
        dataset.published_task_types = []

    if task_type not in dataset.published_task_types:
        dataset.published_task_types.append(task_type)
        logger.info(f"Added {task_type} to published_task_types: {dataset.published_task_types}")

    labeler_db.commit()
```

**Logic**:
- publish 시마다 task_type을 배열에 추가 (중복 방지)
- `labeled = True`는 `len(published_task_types) > 0` 의미
- `annotation_path`는 가장 최근 publish된 것 (backward compatibility)

#### 16.6.3 Platform API: task_type Parameter (2-3h) ⏸️

**Add task_type query parameter**:
```python
# backend/app/api/v1/endpoints/platform_datasets.py

@router.get("", response_model=PlatformDatasetListResponse)
async def list_datasets_for_platform(
    task_type: Optional[str] = Query(None, description="Filter by published task_type (detection/segmentation/classification)"),
    labeled: Optional[bool] = Query(None),
    # ... other params ...
):
    """
    List datasets with task_type filtering.

    Example:
        GET /api/v1/platform/datasets?task_type=segmentation&labeled=true
        → Returns only datasets published for segmentation task
    """
    query = db.query(Dataset)

    # Filter by task_type (if provided)
    if task_type:
        # Use PostgreSQL array contains operator
        query = query.filter(Dataset.published_task_types.contains([task_type]))

    # Filter by labeled
    if labeled is not None:
        query = query.filter(Dataset.labeled == labeled)

    # ... rest of filtering ...
```

**Single Dataset Endpoint**:
```python
@router.get("/{dataset_id}", response_model=PlatformDatasetResponse)
async def get_dataset_for_platform(
    dataset_id: str,
    task_type: Optional[str] = Query(None, description="Get annotation for specific task_type"),
    # ... auth params ...
):
    """
    Get dataset with task-specific annotation path.

    If task_type is provided, returns annotation_path for that task_type.
    Otherwise, returns latest annotation_path.
    """
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()

    if not dataset:
        raise HTTPException(404, "Dataset not found")

    # Get task-specific annotation_path
    if task_type:
        if task_type not in (dataset.published_task_types or []):
            raise HTTPException(
                404,
                f"Dataset not published for task_type={task_type}. "
                f"Available: {dataset.published_task_types}"
            )

        # Get latest version for this task_type
        latest_version = db.query(AnnotationVersion).filter(
            AnnotationVersion.project_id == project.id,
            AnnotationVersion.task_type == task_type,
            AnnotationVersion.version_type == "published"
        ).order_by(AnnotationVersion.version_number.desc()).first()

        annotation_path = latest_version.export_path if latest_version else None
    else:
        annotation_path = dataset.annotation_path  # Default to latest

    return PlatformDatasetResponse(
        ...
        task_types=dataset.published_task_types,  # 새 필드
        annotation_path=annotation_path,  # task_type별 동적 경로
        ...
    )
```

#### 16.6.4 Update Schema (1h) ⏸️

**PlatformDatasetResponse**:
```python
# backend/app/schemas/platform.py

class PlatformDatasetResponse(BaseModel):
    id: str
    name: str
    # ... existing fields ...

    # Phase 16.6: Task-type information
    labeled: bool
    task_types: Optional[List[str]] = None  # ['detection', 'segmentation']
    annotation_path: Optional[str] = None   # Task-specific annotation (based on query param)

    # ... rest of fields ...
```

#### 16.6.5 Data Migration (1h) ⏸️

**Migrate existing datasets**:
```python
# Script: backend/scripts/migrate_published_task_types.py

from app.core.database import LabelerSessionLocal
from app.db.models.labeler import Dataset, AnnotationVersion

db = LabelerSessionLocal()

datasets = db.query(Dataset).filter(Dataset.labeled == True).all()

for dataset in datasets:
    # Find all published task_types from AnnotationVersion
    project_id = db.query(AnnotationProject).filter(
        AnnotationProject.dataset_id == dataset.id
    ).first().id

    published_tasks = db.query(AnnotationVersion.task_type).filter(
        AnnotationVersion.project_id == project_id,
        AnnotationVersion.version_type == "published"
    ).distinct().all()

    dataset.published_task_types = [t[0] for t in published_tasks]
    print(f"{dataset.name}: {dataset.published_task_types}")

db.commit()
```

#### 16.6.6 Testing (1-2h) ⏸️

**Test Cases**:
```python
# Test 1: List datasets for specific task_type
GET /api/v1/platform/datasets?task_type=detection&labeled=true
→ mvtec-ad returned (has detection)

GET /api/v1/platform/datasets?task_type=segmentation&labeled=true
→ mvtec-ad excluded (doesn't have segmentation yet)

# Test 2: Get dataset with task_type
GET /api/v1/platform/datasets/ds_c75023ca76d7448b?task_type=detection
→ annotation_path: "exports/.../detection/v10.0/annotations.json"

GET /api/v1/platform/datasets/ds_c75023ca76d7448b?task_type=segmentation
→ 404: "Dataset not published for task_type=segmentation"

# Test 3: Publish new task_type
POST /api/v1/projects/{project_id}/versions (publish segmentation)
→ dataset.published_task_types: ["detection", "segmentation"]

GET /api/v1/platform/datasets?task_type=segmentation&labeled=true
→ mvtec-ad now returned
```

**Summary**:
```
Phase 16.6 구현 순서:
1. Database: published_task_types 컬럼 추가 (2-3h)
2. Export Logic: publish 시 task_type 추가 (2-3h)
3. Platform API: task_type 파라미터 & 필터링 (2-3h)
4. Schema: PlatformDatasetResponse 업데이트 (1h)
5. Data Migration: 기존 데이터 마이그레이션 (1h)
6. Testing: task_type 기반 조회 테스트 (1-2h)

Total: 8-10h
```

---

### 16.10 Rate Limiting & Security (4-5h) ⏸️ (기존 16.5)

**Goal**: API 남용 방지 및 공정한 리소스 사용 보장

#### 16.5.1 Rate Limiting Middleware (3-4h) ⏸️
- [ ] Install `slowapi` or `fastapi-limiter`
  - Add to `requirements.txt`
  - Configure Redis connection for distributed rate limiting
- [ ] Rate limit configuration
  - Service account global: 1000 requests/minute
  - Per dataset: 100 requests/minute
  - Per IP (fallback): 60 requests/minute
- [ ] Rate limit middleware
  - Apply to all `/api/v1/datasets/*` endpoints
  - Apply to service account endpoints
  - Return 429 with retry-after header
- [ ] Response headers
  - `X-RateLimit-Limit`: Total allowed requests
  - `X-RateLimit-Remaining`: Remaining requests in window
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

**Response Headers** (success):
```http
HTTP/1.1 200 OK
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 950
X-RateLimit-Reset: 1701090000
```

**429 Response**:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Retry after 60 seconds.",
    "retry_after": 60,
    "timestamp": "2025-11-27T10:30:00Z"
  }
}
```

#### 16.5.2 Security Enhancements (1h) ⏸️
- [ ] Input validation
  - Validate dataset_id format (UUID or custom format)
  - Validate user_id (positive integer)
  - Validate expiration_seconds (max 86400 = 24 hours)
- [ ] Scope enforcement
  - Check service account has required scope before processing
  - `datasets:read` for query endpoints
  - `datasets:download` for download URL generation
  - `datasets:permissions` for permission checks

### 16.6 Error Handling Standardization (2-3h) ⏸️

**Goal**: 일관된 에러 응답으로 Platform 팀의 통합 용이성 향상

#### 16.6.1 Error Response Schema (1h) ⏸️
- [ ] Define error response model (`backend/app/schemas/error.py`)
  - `ErrorResponse` with `code`, `message`, `details`, `timestamp`
  - Error code constants (enum)
- [ ] HTTP status mapping
  - 404: `DATASET_NOT_FOUND`
  - 403: `ACCESS_DENIED`
  - 400: `INVALID_DATASET_ID`, `INVALID_REQUEST`
  - 429: `RATE_LIMIT_EXCEEDED`
  - 500: `INTERNAL_ERROR`
  - 503: `R2_UNAVAILABLE`
  - 401: `INVALID_SERVICE_ACCOUNT`

**Error Response Schema**:
```json
{
  "error": {
    "code": "DATASET_NOT_FOUND",
    "message": "Dataset ds_xyz789 not found",
    "details": {
      "dataset_id": "ds_xyz789"
    },
    "timestamp": "2025-11-27T10:30:00Z"
  }
}
```

**Error Code List**:
| HTTP | Error Code | Description |
|------|------------|-------------|
| 404 | `DATASET_NOT_FOUND` | Dataset ID not found |
| 403 | `ACCESS_DENIED` | User lacks permission |
| 400 | `INVALID_DATASET_ID` | Malformed dataset ID |
| 400 | `INVALID_REQUEST` | Request validation failed |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |
| 503 | `R2_UNAVAILABLE` | R2 storage unavailable |
| 401 | `INVALID_SERVICE_ACCOUNT` | Invalid/expired API key |

#### 16.6.2 Error Middleware (1-2h) ⏸️
- [ ] Global exception handler (`backend/app/middleware/error_handler.py`)
  - Catch all exceptions
  - Convert to standardized error response
  - Log errors with context
- [ ] Specific exception handlers
  - `DatasetNotFoundException` → 404
  - `AccessDeniedException` → 403
  - `RateLimitExceededException` → 429
  - `R2ConnectionException` → 503

### 16.7 Testing & Documentation (6-8h) ⏸️

**Goal**: 철저한 테스트와 명확한 문서로 안정적인 통합 보장

#### 16.7.1 Backend Tests (4-5h) ⏸️
- [ ] Unit tests (`tests/unit/`)
  - `test_service_account_service.py` (create, verify, revoke)
  - `test_permission_service.py` (access check logic)
  - `test_download_url_service.py` (presigned URL generation)
- [ ] Integration tests (`tests/integration/`)
  - `test_service_account_endpoints.py` (CRUD operations)
  - `test_dataset_query_endpoints.py` (single, list, batch)
  - `test_permission_check_endpoint.py`
  - `test_download_url_endpoint.py`
  - `test_rate_limiting.py` (429 responses)
- [ ] Load tests (`tests/load/`)
  - Simulate 1000 req/min
  - Verify rate limiting works
  - Check P95 latency targets

#### 16.7.2 Documentation (2-3h) ⏸️
- [ ] Postman collection
  - Service account creation (admin)
  - GET single dataset
  - GET dataset list (with various filters)
  - POST batch query
  - GET permission check
  - POST download URL generation
  - Rate limit testing (send 100+ requests)
- [ ] OpenAPI spec update
  - Add new endpoints to Swagger docs
  - Document request/response schemas
  - Document error responses
- [ ] Mock dataset setup
  - Create 3 test datasets in R2:
    - `ds_test_coco_001`: COCO format, 100 images, detection
    - `ds_test_yolo_002`: YOLO format, 50 images, classification
    - `ds_test_dice_003`: DICE format, 200 images, segmentation
  - Upload sample images + annotations
- [ ] Integration guide for Platform team
  - `docs/platform-integration-guide.md`
  - LabelerClient usage examples
  - Error handling best practices
  - Rate limiting guidelines

**Postman Collection Structure**:
```
Labeler Dataset API (Platform Integration)
├── 1. Authentication
│   ├── Create Service Account (Admin)
│   ├── List Service Accounts (Admin)
│   └── Revoke Service Account (Admin)
├── 2. Dataset Queries
│   ├── GET Single Dataset
│   ├── GET Dataset List (no filters)
│   ├── GET Dataset List (filtered: public, labeled, coco)
│   ├── GET Dataset List (paginated: page=2, limit=20)
│   └── POST Batch Query (3 datasets)
├── 3. Permissions
│   ├── GET Permission Check (has access)
│   └── GET Permission Check (no access)
├── 4. Download URLs
│   ├── POST Generate Download URL (1 hour expiration)
│   └── POST Generate Download URL (custom purpose)
└── 5. Rate Limiting
    └── POST Batch Query x100 (trigger 429)
```

### 16.8 Platform Client Implementation ⏸️ (Platform Team)

**Responsibility**: Platform team
**Duration**: 2 days
**Status**: Waiting for Labeler API completion

#### Platform Team Tasks (Platform 팀 작업)
- [ ] LabelerClient class implementation
  - `platform/backend/app/services/labeler_client.py`
  - `httpx` based async client
  - Methods: `get_dataset()`, `list_datasets()`, `batch_query()`, `check_permission()`, `generate_download_url()`
- [ ] Environment configuration
  - `LABELER_API_URL` in .env
  - `LABELER_SERVICE_KEY` in .env (secret management)
- [ ] Retry logic
  - Exponential backoff for 503, 429 errors
  - Max 3 retries
- [ ] Caching (optional)
  - Redis cache for dataset metadata (TTL: 5 minutes)
  - Cache invalidation strategy
- [ ] Training Job integration
  - Update `create_training_job()` to use Labeler API
  - Verify dataset exists and user has access
  - Generate download URL for training service
- [ ] E2E integration tests
  - Joint testing with Labeler team
  - Test all error scenarios

**Example LabelerClient** (Platform's code):
```python
# platform/backend/app/services/labeler_client.py
import httpx
from app.core.config import settings

class LabelerClient:
    def __init__(self):
        self.base_url = settings.LABELER_API_URL
        self.headers = {
            "Authorization": f"Bearer {settings.LABELER_SERVICE_KEY}"
        }

    async def get_dataset(self, dataset_id: str):
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/datasets/{dataset_id}",
                headers=self.headers,
                timeout=10.0
            )
            response.raise_for_status()
            return response.json()

    async def check_permission(self, dataset_id: str, user_id: int):
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/api/v1/datasets/{dataset_id}/permissions/{user_id}",
                headers=self.headers
            )
            response.raise_for_status()
            return response.json()

    async def generate_download_url(self, dataset_id: str, user_id: int, purpose: str):
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/api/v1/datasets/{dataset_id}/download-url",
                headers=self.headers,
                json={
                    "user_id": user_id,
                    "expiration_seconds": 3600,
                    "purpose": purpose
                }
            )
            response.raise_for_status()
            return response.json()
```

### 16.9 Migration & Deployment (2-3h) ⏸️

**Goal**: Platform DB Dataset 테이블 단계적 폐기 및 안전한 마이그레이션

#### 16.9.1 Migration Strategy ⏸️
- [ ] **Phase 1**: Labeler API 구현 (Labeler 팀)
  - Duration: 3-4 days
  - Deliverable: All endpoints working + tests passing
- [ ] **Phase 2**: Platform 통합 (Platform 팀)
  - Duration: 2 days
  - Deliverable: LabelerClient implemented + integration tests
- [ ] **Phase 3**: Dual Read (Platform 팀)
  - Duration: 1-2 days
  - Platform reads from both Platform DB and Labeler API
  - Use Labeler API as primary, Platform DB as fallback
  - Monitor error rates and latency
- [ ] **Phase 4**: Switch to Labeler API (Both 팀)
  - Duration: 1 day
  - Update env config to use Labeler API only
  - Remove fallback logic
  - Monitor for issues
- [ ] **Phase 5**: Deprecate Platform DB Dataset table (Platform 팀)
  - Duration: 1 day (after 2 weeks of stability)
  - Mark table as deprecated
  - Keep for rollback purposes (read-only)
  - Eventually drop table after 1 month

#### 16.9.2 Rollback Plan ⏸️
- [ ] Keep Platform DB Dataset table read-only for 2 weeks
- [ ] Monitor Labeler API error rates (< 0.1% acceptable)
- [ ] Quick switch back to Platform DB if critical issues
  - Environment variable toggle
  - No code changes needed
- [ ] Gradual rollout using feature flags
  - 10% traffic → Labeler API
  - 50% traffic → Labeler API
  - 100% traffic → Labeler API

### Performance Requirements

| Endpoint | Target P95 Latency | Notes |
|----------|-------------------|-------|
| GET /datasets/{id} | < 100ms | Single row query |
| GET /datasets (list) | < 300ms | With pagination |
| GET /permissions/{user_id} | < 150ms | Permission check logic |
| POST /download-url | < 200ms | R2 presigned URL generation |
| POST /batch | < 500ms | Up to 50 dataset IDs |

**SLA**: 99.9% uptime

**Caching Strategy**:
- Redis cache for dataset metadata (TTL: 5 minutes)
- Cache invalidation on dataset update
- Cache permission checks (TTL: 1 minute)

### Timeline

| Day | Focus | Owner | Deliverables |
|-----|-------|-------|--------------|
| **Day 1** | Service Account Auth | Labeler | DB schema, models, auth logic |
| **Day 2** | Dataset Query API (single + list) | Labeler | Enhanced endpoints, filtering |
| **Day 3** | Batch Query + Permission Check | Labeler | Batch endpoint, permission logic |
| **Day 4** | Download URL + Rate Limiting | Labeler | Presigned URLs, rate limits |
| **Day 5** | Error Handling + Testing | Labeler | Unit tests, integration tests |
| **Day 6** | Documentation + Postman | Labeler | OpenAPI, collection, mock data |
| **Day 7-8** | Platform Integration | Platform | LabelerClient, E2E tests |

**Total**: ~1 week (7-8 days)

### Success Criteria

✅ **Functionality**:
- [ ] Platform can query dataset metadata without direct DB access
- [ ] Service account authentication works reliably
- [ ] Rate limiting prevents abuse (429 errors when exceeded)
- [ ] Download URLs generate valid R2 presigned URLs
- [ ] Batch queries handle up to 50 datasets efficiently
- [ ] Permission checks return accurate results

✅ **Performance**:
- [ ] All endpoints meet P95 latency targets
- [ ] No N+1 query problems
- [ ] Caching reduces DB load by >50%
- [ ] Service handles 1000 req/min sustained load

✅ **Security**:
- [ ] Service account scopes enforced correctly
- [ ] Permission checks prevent unauthorized access
- [ ] Presigned URLs expire after configured time
- [ ] API keys are hashed (never stored plaintext)

✅ **Integration**:
- [ ] Platform Training Jobs can create jobs using Labeler datasets
- [ ] E2E tests pass (Platform → Labeler → R2 download)
- [ ] Zero downtime migration
- [ ] Rollback plan tested and verified

### Files to Create

**Backend**:
- `backend/app/db/models/user.py` (ServiceAccount model)
- `backend/app/schemas/service_account.py` (schemas)
- `backend/app/schemas/error.py` (standardized errors)
- `backend/app/services/service_account_service.py` (auth logic)
- `backend/app/services/permission_service.py` (access checks)
- `backend/app/services/download_url_service.py` (presigned URLs)
- `backend/app/api/v1/endpoints/service_accounts.py` (admin endpoints)
- `backend/app/middleware/rate_limit.py` (rate limiting)
- `backend/app/middleware/error_handler.py` (global error handler)
- `backend/alembic/versions/YYYYMMDD_add_service_accounts.py` (migration)

**Frontend**: None (backend-only integration)

**Documentation**:
- `docs/platform-integration-guide.md` (Platform team guide)
- Postman collection (JSON export)
- OpenAPI spec update (Swagger)

**Tests**:
- `tests/unit/test_service_account_service.py`
- `tests/unit/test_permission_service.py`
- `tests/unit/test_download_url_service.py`
- `tests/integration/test_service_account_endpoints.py`
- `tests/integration/test_dataset_query_endpoints.py`
- `tests/integration/test_permission_check.py`
- `tests/integration/test_download_url.py`
- `tests/integration/test_rate_limiting.py`
- `tests/load/test_sustained_load.py`

### Dependencies

**Completed Phases**:
- ✅ Phase 8.1 (RBAC) - ProjectPermission table
- ✅ Phase 9.1 (User DB) - User model with system_role
- ✅ Phase 15 (Admin) - Admin authorization (`get_current_admin_user`)

**External Dependencies**:
- Platform team availability for integration testing
- R2 storage access and credentials
- Redis instance for rate limiting

### Related Documents

- **Requirements**: `C:\Users\flyto\Project\Github\mvp-vision-ai-platform\docs\integration\LABELER_DATASET_API_REQUIREMENTS.md`
- **Platform Integration**: `docs/design/PLATFORM_INTEGRATION.md`
- **API Spec**: `docs/design/API_SPEC.md`
- **Database Schema**: `docs/design/DATABASE_SCHEMA.md`

**Total**: 35-40h over ~1 week

---

## Phase 17: SSO Integration (Platform → Labeler) 🆕

**Duration**: 8-12h
**Status**: 🔄 In Progress
**Priority**: 🔴 High (Platform Integration Dependency)
**Start Date**: 2025-12-10

### Overview

Platform → Labeler 간 SSO(Single Sign-On)를 구현하여 사용자가 Platform에서 "데이터셋" 버튼 클릭 시 Labeler로 자동 로그인됩니다. Service JWT 기반의 안전한 인증으로 별도 로그인 없이 끊김 없는 UX를 제공합니다.

**Architecture**:
```
Platform (port 8001)
  ↓ User clicks "데이터셋"
  ↓ POST /api/v1/auth/labeler-token
  ↓ Receive service_token (5min expiry)
  ↓ Redirect: labeler/sso?token=xxx

Labeler (port 8011)
  ↓ GET /sso?token=xxx
  ↓ Decode & validate (SERVICE_JWT_SECRET)
  ↓ Find or create user (Shared User DB)
  ↓ Create session (HTTP-only cookie)
  ↓ Redirect to /datasets
```

**Key Features**:
- 🔐 Service JWT validation (separate from user JWT)
- 👤 User auto-creation from Platform payload
- ⏱️ 5-minute token expiry for security
- 🎯 HTTP-only session cookie
- 🔄 Seamless Platform ↔ Labeler navigation

**Requirements Document**: `C:\Users\flyto\Project\Github\mvp-vision-ai-platform\docs\integration\LABELER_SSO_INTEGRATION.md`

### 17.1: Environment Variable Setup (0.5h) ✅

**Status**: ✅ Complete (2025-12-10)
**Goal**: Verify and document SERVICE_JWT_SECRET configuration

#### Tasks
- [x] Verify `SERVICE_JWT_SECRET` in `.env` matches Platform
- [x] Update `.env.example` with SERVICE_JWT_SECRET template
- [x] Add validation in `config.py` (warn if not set)
- [x] Document in deployment guide

**Implementation Notes**:
- `.env` already configured with `SERVICE_JWT_SECRET=8f7e6d5c4b3a29180716253e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a`
- `.env.example` includes SERVICE_JWT_SECRET template at lines 64-68
- `config.py` has SERVICE_JWT_SECRET field at lines 105-108

**Environment Variables**:
```bash
# Service-to-Service JWT Secret (MUST match Platform exactly)
SERVICE_JWT_SECRET=8f7e6d5c4b3a29180716253e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a
SERVICE_JWT_ALGORITHM=HS256
```

**Files**:
- `backend/.env` (already has SERVICE_JWT_SECRET)
- `backend/.env.example` (add SERVICE_JWT_SECRET)
- `backend/app/core/config.py` (add SERVICE_JWT_SECRET field)

### 17.2: Service Token Validation (2-3h) ✅

**Status**: ✅ Complete (2025-12-10)
**Goal**: Implement decode_service_token() for JWT validation

#### Tasks
- [x] Add `decode_service_token()` to `backend/app/core/security.py`
- [x] Verify token type (`type: "service"`)
- [x] Verify issuer (`iss: "platform"`)
- [x] Verify audience (`aud: "labeler"`)
- [x] Add comprehensive error handling
- [ ] Add unit tests (optional - can be added later)

**Implementation**:
- `backend/app/core/security.py:101-160` - decode_service_token() function
- Validates signature using SERVICE_JWT_SECRET
- Checks token type, issuer, and audience
- Raises JWTError with descriptive messages on validation failure

**Implementation**:
```python
def decode_service_token(token: str) -> Dict[str, Any]:
    """
    Decode and verify service JWT from Platform.

    Validates:
    - Signature (SERVICE_JWT_SECRET)
    - Expiration (5min from Platform)
    - Token type (must be "service")
    - Issuer (must be "platform")
    - Audience (must be "labeler")
    """
    payload = jwt.decode(
        token,
        settings.SERVICE_JWT_SECRET,
        algorithms=[settings.SERVICE_JWT_ALGORITHM]
    )

    if payload.get("type") != "service":
        raise JWTError("Not a service token")
    if payload.get("iss") != "platform":
        raise JWTError("Invalid issuer")
    if payload.get("aud") != "labeler":
        raise JWTError("Invalid audience")

    return payload
```

**Service JWT Payload**:
```json
{
  "user_id": "123",
  "email": "user@example.com",
  "full_name": "홍길동",
  "system_role": "user",
  "badge_color": "blue",
  "exp": 1733900000,
  "type": "service",
  "iss": "platform",
  "aud": "labeler"
}
```

**Files**:
- `backend/app/core/security.py` (add decode_service_token)
- `tests/unit/test_service_token.py` (new)

### 17.3: SSO Endpoint Implementation (3-4h) ✅

**Status**: ✅ Complete (2025-12-10)
**Goal**: Create GET /sso endpoint for automatic login

#### Tasks
- [x] Create `GET /api/v1/auth/sso` endpoint
- [x] Decode service token
- [x] Find or create user in Shared User DB
- [x] Update user info if already exists
- [x] Create session (access_token)
- [x] Set HTTP-only cookie
- [x] Redirect to `/datasets`
- [x] Add error handling (invalid token, DB errors)
- [ ] Add integration tests (optional - can be added later)

**Implementation**:
- `backend/app/api/v1/endpoints/auth.py:79-195` - SSO login endpoint
- Imports: Added datetime, RedirectResponse, JWTError
- Validates service token → extracts user info
- Find or create user logic with proper error handling
- Sets HTTP-only cookie with 1h max_age
- Returns HTTP 303 redirect to /datasets
- Comprehensive error handling for JWT, ValueError, and general exceptions

**Endpoint Flow**:
1. Receive `?token=xxx` query parameter
2. Validate service JWT → extract user_id, email, full_name, etc.
3. Query Shared User DB by user_id
4. If not exists: Create new user (no password for SSO users)
5. If exists: Update full_name, system_role, badge_color
6. Generate access_token (user JWT, 24h expiry)
7. Set cookie: `access_token=Bearer {token}` (HTTP-only, 1h max_age)
8. Redirect: `HTTP 303 → /datasets`

**API Signature**:
```python
@router.get("/sso")
async def sso_login(
    token: str,
    response: Response,
    db: Session = Depends(get_user_db)
):
    """
    SSO endpoint for Platform → Labeler integration.

    Args:
        token: Service JWT from Platform (5min expiry)
        response: FastAPI Response for setting cookies
        db: Shared User DB session

    Returns:
        RedirectResponse to /datasets (HTTP 303)

    Raises:
        HTTPException 401: Invalid/expired token
        HTTPException 500: User creation failed
    """
```

**Files**:
- `backend/app/api/v1/endpoints/auth.py` (add /sso endpoint)
- `backend/app/api/v1/router.py` (ensure auth router registered)
- `tests/integration/test_sso.py` (new)

### 17.4: Frontend Integration (1-2h) ✅

**Status**: ✅ Complete (2025-12-10) - No frontend code needed
**Goal**: Handle SSO redirect on frontend

#### Tasks
- [x] Verify SSO flow works with existing `/datasets` page
- [x] Document SSO redirect flow
- [x] Confirm no additional frontend code needed

**Implementation Note**:
**Chosen Approach (Simpler)**:
- Platform directly redirects to backend: `http://localhost:8011/api/v1/auth/sso?token=xxx`
- Backend validates token, sets HTTP-only cookie, and redirects to: `http://localhost:3010/datasets`
- Frontend `/datasets` page already exists and uses cookie-based authentication
- **No additional frontend code required**

**SSO Flow**:
```
1. User clicks "데이터셋" button on Platform
2. Platform → POST /api/v1/auth/labeler-token (get service JWT)
3. Platform redirects browser to: http://localhost:8011/api/v1/auth/sso?token={service_jwt}
4. Labeler backend validates token, creates session, sets cookie
5. Labeler backend redirects to: http://localhost:3010/datasets
6. Frontend loads with authenticated session (cookie)
```

**Files**:
- No new frontend files needed
- Existing `/datasets` page handles authenticated access

### 17.5: Testing & Validation (2-3h) ⏸️

**Status**: ⏸️ Pending
**Goal**: Comprehensive testing of SSO flow

#### Tasks
- [ ] Manual browser testing (Platform → Labeler)
- [ ] API testing with curl (service token → session)
- [ ] Integration test script (Python)
- [ ] Error case testing (invalid token, expired, malformed)
- [ ] Cross-browser testing (Chrome, Firefox, Safari)
- [ ] Document test results
- [ ] Create troubleshooting guide

**Test Scenarios**:
1. ✅ Happy path: Valid token → User created → Session → Redirect
2. ✅ Existing user: Valid token → User updated → Session → Redirect
3. ❌ Invalid token: Malformed JWT → 401 error
4. ❌ Expired token: Token > 5min old → 401 error
5. ❌ Wrong issuer: `iss != "platform"` → 401 error
6. ❌ Wrong audience: `aud != "labeler"` → 401 error
7. ❌ DB connection fail: User creation error → 500 error

**Testing Methods**:
```bash
# 1. Manual test (Browser)
# - Login to Platform
# - Click "데이터셋" button
# - Verify redirect to Labeler /datasets
# - Verify no login required

# 2. API test (curl)
curl -i -X GET "http://localhost:8011/api/v1/auth/sso?token=xxx"
# Expected: HTTP 303, Set-Cookie, Location: /datasets

# 3. Integration test (Python)
python tests/integration/test_sso.py
```

**Files**:
- `tests/integration/test_sso.py` (comprehensive test suite)
- `docs/testing/SSO_TEST_RESULTS.md` (test documentation)

### Dependencies

**Completed Phases**:
- ✅ Phase 9.1 (User DB Separation) - Shared User DB
- ✅ Phase 16.5 (Hybrid JWT) - SERVICE_JWT_SECRET setup

**External Dependencies**:
- Platform's `/api/v1/auth/labeler-token` endpoint (Platform Phase 11.5.6)
- SERVICE_JWT_SECRET must match Platform exactly

### Related Documents

- **Requirements**: `C:\Users\flyto\Project\Github\mvp-vision-ai-platform\docs\integration\LABELER_SSO_INTEGRATION.md`
- **Platform Phase**: Phase 11.5.6 - Hybrid JWT for Microservice SSO
- **Security Design**: JWT authentication, session management

**Total**: 8-12h over ~1-2 days

---

## Phase 18: Canvas Architecture Refactoring 🆕

**Duration**: 2-3 weeks (40-60h)
**Status**: 🔄 In Progress
**Priority**: 🟡 Medium (Technical Debt, Maintainability)
**Start Date**: 2025-12-10

### Overview

Canvas.tsx가 4,100 라인으로 비대해져 유지보수가 어려운 상태입니다. 이를 모듈화하고 관심사를 분리하여 코드 품질을 개선하고 향후 확장성을 확보합니다.

**Current Issues**:
- 📏 **4,100 lines**: Single component with excessive complexity
- 🔄 **40+ useState hooks**: State management scattered throughout
- 🎨 **Multiple responsibilities**: Rendering, event handling, tool logic, lock management, diff mode
- 🔧 **Hard to test**: Tightly coupled logic
- 📚 **Poor maintainability**: Difficult to add new features or fix bugs

**Architecture Goals**:
```
Canvas.tsx (4,100 lines) → Modular Architecture

1. Canvas Container (Main Component)
   ├── hooks/
   │   ├── useCanvasState.ts       (State management)
   │   ├── useCanvasEvents.ts      (Mouse/keyboard events)
   │   ├── useImageManagement.ts   (Image loading/lock)
   │   └── useAnnotationSync.ts    (Backend sync)
   │
   ├── components/
   │   ├── CanvasRenderer.tsx      (Pure rendering logic)
   │   ├── ToolOverlay.tsx         (Drawing tools overlay)
   │   ├── MagnifierOverlay.tsx    (Magnifier display)
   │   └── LockOverlay.tsx         (Lock warning UI)
   │
   └── utils/
       ├── coordinateTransform.ts  (Canvas ↔ Image coordinates)
       ├── geometryHelpers.ts      (Bbox, polygon calculations)
       └── renderHelpers.ts        (Drawing primitives)
```

### Goals

**Primary**:
- ✅ Reduce Canvas.tsx to <500 lines (main orchestration only)
- ✅ Extract custom hooks for state and event handling
- ✅ Separate rendering logic into components
- ✅ Improve testability with pure functions

**Secondary**:
- ✅ Add comprehensive JSDoc documentation
- ✅ Improve TypeScript type safety
- ✅ Remove code duplication
- ✅ Optimize re-rendering performance

### 18.1: Analysis & Planning (4-6h) ✅

**Status**: ✅ Complete (2025-12-18)
**Goal**: Analyze current Canvas.tsx structure and create detailed refactoring plan
**Actual Time**: ~5h

#### Tasks
- [x] Map all Canvas.tsx responsibilities
  - State management (37 useState + 44 store values = 81 total)
  - Event handlers (mouse: 1,253 lines, keyboard: 588 lines)
  - Rendering logic (annotations, tools, overlays)
  - Tool-specific logic (bbox, polygon, circle, etc.)
  - Lock management and conflict detection
  - Diff mode rendering
  - Magnifier logic
  - History/undo management
- [x] Identify shared utilities and helpers
- [x] Define module boundaries and interfaces
- [x] Create dependency graph
- [x] Document breaking change risks
- [x] Define testing strategy

**Deliverables**:
- ✅ `docs/refactoring/canvas-analysis.md` - Current state analysis (493 lines)
  - Comprehensive breakdown of all 4,100 lines
  - Complexity metrics and function-level analysis
  - Risk assessment for each major section
- ✅ `docs/refactoring/canvas-architecture.md` - Target architecture (550+ lines)
  - 7 custom hooks with detailed specifications
  - 5 renderer components
  - 4 utility modules
  - Data flow diagrams and component hierarchy
- ✅ `docs/refactoring/migration-plan.md` - Step-by-step migration plan (900+ lines)
  - 6 migration phases with detailed steps
  - Testing strategy (>70% coverage target)
  - Risk mitigation and rollback procedures
  - Timeline and success criteria

**Files Analyzed**:
- `frontend/components/annotation/Canvas.tsx` (4,100 lines) ✅
- Related tools: `lib/annotation/tools/*.ts` ✅
- Related stores: `lib/stores/annotationStore.ts` ✅

**Key Findings**:
- **Critical Issues**:
  - Mouse handlers: 1,253 lines (30% of file)
  - handleMouseDown: 535 lines, handleMouseMove: 387 lines, handleMouseUp: 331 lines
  - Keyboard shortcuts: 588 lines in single useEffect
  - 0% test coverage, impossible to unit test
- **Target Metrics**:
  - Canvas.tsx: 4,100 → <500 lines (88% reduction)
  - Test coverage: 0% → >70%
  - Component re-render: -50%

### 18.2: Extract Utility Functions (8-10h) ⏸️

**Status**: ⏸️ Pending
**Goal**: Extract pure functions with no state dependencies (safest first step)

**Strategy**: Start with utilities because they are pure functions, easiest to test, and lowest risk.

#### 18.2.1: Create Utility Modules (2h)
- [ ] Create `utils/coordinateTransform.ts` (~100 lines)
  - `screenToCanvas(x, y, canvasRect)` - Screen → canvas coordinates
  - `canvasToImage(x, y, zoom, pan)` - Canvas → image coordinates
  - `imageToCanvas(x, y, zoom, pan)` - Image → canvas coordinates
  - `canvasToScreen(x, y, canvasRect)` - Canvas → screen coordinates
  - `getTransformMatrix(zoom, pan)` - Compute transformation matrix
  - `applyTransform(points, matrix)` - Apply transformation to points

- [ ] Create `utils/geometryHelpers.ts` (~150 lines)
  - `pointToLineDistance(point, lineStart, lineEnd)` - Distance from point to line
  - `pointInPolygon(point, polygon)` - Point-in-polygon test (ray casting)
  - `pointInBbox(point, bbox)` - Point-in-bounding-box test
  - `pointNearCircle(point, circle, tolerance)` - Point near circle perimeter
  - `bboxIntersection(bbox1, bbox2)` - Bbox intersection test
  - `polygonIntersection(poly1, poly2)` - Polygon intersection (SAT algorithm)
  - `calculatePolygonArea(polygon)` - Polygon area calculation
  - `calculateBboxArea(bbox)` - Bbox area calculation
  - `normalizeAngle(angle)` - Normalize angle to [0, 2π]
  - `calculateCircleFrom3Points(p1, p2, p3)` - 3-point circle calculation

- [ ] Create `utils/renderHelpers.ts` (~100 lines)
  - `drawGrid(ctx, width, height, zoom, pan, gridSize)` - Draw canvas grid
  - `drawCrosshair(ctx, x, y, size, color)` - Draw crosshair cursor
  - `drawNoObjectBadge(ctx, x, y, width, height)` - Draw "No Object" badge
  - `drawVertexHandle(ctx, x, y, size, selected)` - Draw polygon/polyline vertex
  - `drawBboxHandle(ctx, x, y, size, handleType)` - Draw bbox resize handle
  - `drawCircleHandle(ctx, x, y, size, handleType)` - Draw circle handle
  - `setupCanvasContext(ctx, zoom)` - Set default canvas context properties

- [ ] Create `utils/annotationHelpers.ts` (~50 lines)
  - `snapshotToAnnotation(snapshot)` - Convert snapshot format to annotation
  - `annotationToSnapshot(annotation)` - Convert annotation to snapshot format
  - `isAnnotationVisible(annotation, filters)` - Check if annotation should be displayed
  - `sortAnnotationsByZIndex(annotations)` - Sort annotations for rendering order
  - `calculateAnnotationBounds(annotation)` - Get bounding box of any annotation type

#### 18.2.2: Write Unit Tests (3h)
- [ ] `coordinateTransform.test.ts` - Test all coordinate conversion functions
- [ ] `geometryHelpers.test.ts` - Test geometry calculations
- [ ] `renderHelpers.test.ts` - Test canvas drawing functions (with mock canvas)
- [ ] `annotationHelpers.test.ts` - Test annotation transformations
- **Target Coverage**: >90% for utility functions

#### 18.2.3: Extract from Canvas.tsx (3h)
- [ ] Extract functions from Canvas.tsx (~400 lines)
- [ ] Import utilities in Canvas.tsx
- [ ] Replace inline functions with imported utilities
- [ ] Run integration tests
- [ ] Manual smoke test (all tools work)

#### 18.2.4: Verify Integration (2h)
- [ ] All tools work correctly (manual testing)
- [ ] Canvas rendering unchanged (visual regression)
- [ ] No performance regression
- [ ] Code review

**Expected Outcome**:
- Canvas.tsx: 4,100 → ~3,700 lines (-400 lines)
- 4 new utility modules: ~400 lines
- Test coverage: 0% → ~10%

**Files Created**:
- `frontend/lib/annotation/utils/coordinateTransform.ts`
- `frontend/lib/annotation/utils/geometryHelpers.ts`
- `frontend/lib/annotation/utils/renderHelpers.ts`
- `frontend/lib/annotation/utils/annotationHelpers.ts`
- `frontend/lib/annotation/utils/__tests__/*`

---

### 18.3: Extract Custom Hooks (12-16h) ⏸️

**Status**: ⏸️ Pending
**Dependencies**: Phase 18.2 complete
**Goal**: Extract state management and side effects into custom hooks

#### 18.3.1: useCanvasState (2h)
- [ ] Extract local state management
  - `showClassSelector`, `canvasCursor`, `cursorPos`
  - Consolidate tool-specific states into single `toolState` object (replaces 20+ useState)
- [ ] API: `{ showClassSelector, canvasCursor, cursorPos, toolState, updateToolState, resetToolState }`
- [ ] Write hook tests

#### 18.3.2: useCanvasTransform (2h)
- [ ] Extract pan, zoom, coordinate transformation
- [ ] Integrate with utils from Phase 18.2
- [ ] API: `{ zoom, pan, zoomIn, zoomOut, resetView, fitToScreen, canvasToImage, imageToCanvas }`
- [ ] Write hook tests

#### 18.3.3: useToolState (2h)
- [ ] Extract tool-specific state management
- [ ] Tool lifecycle (enter, exit, reset)
- [ ] API: `{ currentTool, toolConfig, toolState, updateToolState, resetTool, switchTool }`
- [ ] Write hook tests

#### 18.3.4: useCanvasEvents (3h)
- [ ] Extract mouse and keyboard event handlers (still tool-based dispatch for now)
- [ ] Uses extracted utilities for coordinate conversion
- [ ] API: `{ handleMouseDown, handleMouseMove, handleMouseUp, handleWheel, handleKeyDown, handleKeyUp }`
- [ ] **Note**: Still large handlers, will be refactored in Phase 18.5
- [ ] Write hook tests

#### 18.3.5: useCanvasGestures (1h)
- [ ] Extract high-level gesture handling (pan, pinch-zoom)
- [ ] API: `{ isPanning, startPan, updatePan, endPan, handlePinchZoom }`
- [ ] Write hook tests

#### 18.3.6: useImageManagement (2h)
- [ ] Extract image loading, caching, and locking (the 126-line useEffect)
- [ ] API: `{ image, imageLoaded, isImageLocked, lockedByUser, showLockedDialog, lockImage, releaseImage }`
- [ ] Write hook tests

#### 18.3.7: useAnnotationSync (2h)
- [ ] Extract annotation version conflict detection and resolution
- [ ] Extract `updateAnnotationWithVersionCheck` function (133 lines)
- [ ] API: `{ isSaving, conflictDialogOpen, conflictInfo, updateAnnotationWithVersionCheck, resolveConflict }`
- [ ] Write hook tests

**Expected Outcome**:
- Canvas.tsx: ~3,700 → ~2,500 lines (-1,200 lines)
- 7 new hooks: ~800 lines
- Test coverage: ~10% → ~40%

**Files Created**:
- `frontend/lib/annotation/hooks/useCanvasState.ts`
- `frontend/lib/annotation/hooks/useCanvasTransform.ts`
- `frontend/lib/annotation/hooks/useToolState.ts`
- `frontend/lib/annotation/hooks/useCanvasEvents.ts`
- `frontend/lib/annotation/hooks/useCanvasGestures.ts`
- `frontend/lib/annotation/hooks/useImageManagement.ts`
- `frontend/lib/annotation/hooks/useAnnotationSync.ts`
- `frontend/lib/annotation/hooks/__tests__/*`

---

### 18.4: Extract Renderer Components (8-10h) ⏸️

**Status**: ⏸️ Pending
**Dependencies**: Phase 18.3 complete
**Goal**: Split rendering logic into specialized components

#### 18.4.1: CanvasRenderer (3h)
- [ ] Extract core canvas rendering (grid, image, annotations)
- [ ] Extract from Canvas.tsx: rendering useEffect (166 lines), `drawAnnotations` (126 lines), `drawGrid` (32 lines)
- [ ] Implement with React.memo and custom comparison
- [ ] Props: `{ canvasRef, imageRef, width, height, zoom, pan, annotations, selectedAnnotationId, showGrid }`
- [ ] Write component tests

#### 18.4.2: ToolOverlay (2h)
- [ ] Extract tool-specific drawing previews (separate canvas layer)
- [ ] Extract: `drawBboxPreview`, `drawPolygonPreview`, `drawPolylinePreview`, `drawCirclePreview`, `drawCircle3pPreview` (154 lines total)
- [ ] Props: `{ canvasRef, tool, toolState, zoom, pan }`
- [ ] Write component tests

#### 18.4.3: MagnifierOverlay (1h)
- [ ] Refactor existing Magnifier component
- [ ] Move from inline JSX to separate file
- [ ] Add proper TypeScript types
- [ ] Write component tests

#### 18.4.4: LockOverlay (1h)
- [ ] Extract lock warning overlay from Canvas.tsx JSX
- [ ] Create dedicated component
- [ ] Props: `{ lockedByUser, onClose }`
- [ ] Write component tests

#### 18.4.5: DiffRenderer (2h)
- [ ] Refactor existing DiffRenderer (already exists, integrate with new architecture)
- [ ] Use extracted utilities
- [ ] Simplify prop passing
- [ ] Write component tests

#### 18.4.6: Update Canvas.tsx JSX (1h)
- [ ] Replace 547 lines of JSX with component calls
- [ ] Canvas.tsx JSX: 547 → ~100 lines

**Expected Outcome**:
- Canvas.tsx: ~2,500 → ~1,200 lines (-1,300 lines)
- 5 renderer components: ~600 lines
- Test coverage: ~40% → ~55%

**Files Created/Modified**:
- `frontend/components/annotation/renderers/CanvasRenderer.tsx`
- `frontend/components/annotation/renderers/ToolOverlay.tsx`
- `frontend/components/annotation/renderers/MagnifierOverlay.tsx`
- `frontend/components/annotation/renderers/LockOverlay.tsx`
- `frontend/components/annotation/renderers/DiffRenderer.tsx`
- `frontend/components/annotation/renderers/__tests__/*`

---

### 18.5: Refactor Tool System (10-12h) ⏸️

**Status**: ⏸️ Pending
**Dependencies**: Phase 18.4 complete
**Goal**: Implement Strategy Pattern for tool logic (highest risk phase)

**Note**: This is the **most critical** phase. Requires careful planning.

#### 18.5.1: Design Tool Interface (2h)
- [ ] Create `BaseTool` abstract class
- [ ] Define `ToolContext` interface (canvas state, methods, callbacks)
- [ ] Design tool lifecycle (onActivate, onDeactivate)
- [ ] Design event handler interface (onMouseDown, onMouseMove, onMouseUp, onKeyDown)
- [ ] Write interface documentation

#### 18.5.2: Implement Tool Classes (6h)
- [ ] Create `SelectTool.ts` - Selection, vertex drag, bbox resize (~150 lines)
- [ ] Create `BboxTool.ts` - Bbox drawing (~60 lines)
- [ ] Create `PolygonTool.ts` - Polygon drawing (~80 lines)
- [ ] Create `PolylineTool.ts` - Polyline drawing (~70 lines)
- [ ] Create `CircleTool.ts` - Circle drawing (center + radius) (~60 lines)
- [ ] Create `Circle3pTool.ts` - Circle drawing (3 points) (~70 lines)
- [ ] Create `PanTool.ts` - Pan gesture (~40 lines)
- [ ] Create `ToolRegistry.ts` - Tool factory + registry (~50 lines)

#### 18.5.3: Update Canvas Event Handlers (2h)
- [ ] Replace 1,253 lines of tool-specific if-else chains
- [ ] Implement tool delegation pattern: `toolInstance.onMouseDown(e)`
- [ ] Add tool instance caching (create once, reuse)
- [ ] Canvas event handlers: 1,253 → ~50 lines

#### 18.5.4: Testing (2h)
- [ ] Unit test each tool class
- [ ] Integration test tool switching
- [ ] Manual testing: All tools work
- [ ] Performance test: No regression

**Expected Outcome**:
- Canvas.tsx: ~1,200 → ~500 lines (-700 lines)
- Tool classes: ~600 lines
- Test coverage: ~55% → ~65%

**Files Created**:
- `frontend/lib/annotation/tools/BaseTool.ts`
- `frontend/lib/annotation/tools/SelectTool.ts`
- `frontend/lib/annotation/tools/BboxTool.ts`
- `frontend/lib/annotation/tools/PolygonTool.ts`
- `frontend/lib/annotation/tools/PolylineTool.ts`
- `frontend/lib/annotation/tools/CircleTool.ts`
- `frontend/lib/annotation/tools/Circle3pTool.ts`
- `frontend/lib/annotation/tools/PanTool.ts`
- `frontend/lib/annotation/tools/ToolRegistry.ts`
- `frontend/lib/annotation/tools/__tests__/*`

---

### 18.6: Add Comprehensive Tests (6-8h) ⏸️

**Status**: ⏸️ Pending
**Dependencies**: Phase 18.5 complete
**Goal**: Achieve >70% test coverage

#### Test Coverage Targets
- [ ] Utility functions: >90% coverage (2h)
- [ ] Custom hooks: >80% coverage (2h)
- [ ] Renderer components: >70% coverage (2h)
- [ ] Tool classes: >80% coverage (2h)

#### Test Strategy
- **Unit Tests**: All utility functions, hooks, tools
- **Integration Tests**: Canvas with all hooks, tool switching, annotation flow
- **Visual Regression Tests** (Optional): Canvas snapshot tests

**Expected Outcome**:
- Test coverage: ~65% → >70%
- 125+ tests total
- All critical paths covered

**Testing Tools**:
- Vitest or Jest
- @testing-library/react, @testing-library/react-hooks
- canvas-mock or jest-canvas-mock
- Coverage: c8 or jest --coverage

---

### 18.7: Performance Optimization (4-6h) ⏸️

**Status**: ⏸️ Pending
**Dependencies**: Phase 18.6 complete
**Goal**: Improve rendering performance and reduce re-renders

#### 18.7.1: Memoization (2h)
- [ ] Wrap all renderer components with `React.memo` + custom comparison
- [ ] Use `useMemo` for expensive calculations
- [ ] Use `useCallback` for event handlers passed as props

#### 18.7.2: Canvas Optimization (2h)
- [ ] Implement dirty rect tracking (only redraw changed regions)
- [ ] Use offscreen canvas for static content (grid, image)
- [ ] Debounce/throttle mouse move events

#### 18.7.3: State Update Optimization (1h)
- [ ] Batch state updates where possible
- [ ] Reduce unnecessary store subscriptions
- [ ] Use Zustand selectors efficiently

#### 18.7.4: Performance Monitoring (1h)
- [ ] Add React DevTools Profiler
- [ ] Measure render times
- [ ] Set performance budgets (e.g., <16ms per frame for 60fps)
- [ ] Compare before/after metrics

**Expected Outcome**:
- Component re-render frequency: -50%
- Build time: -20%
- Smooth 60fps rendering

### Dependencies

**Required**:
- None (internal refactoring)

**Nice to Have**:
- Phase 11 (Version Diff) complete - for better diff rendering integration

### Success Criteria

**Code Quality**:
- ✅ Canvas.tsx reduced to <500 lines
- ✅ All hooks <200 lines each
- ✅ All components <150 lines each
- ✅ All utilities <100 lines each
- ✅ Test coverage >70%

**Functionality**:
- ✅ All existing features work identically
- ✅ No performance regression
- ✅ Improved render performance (target: 10% improvement)

**Maintainability**:
- ✅ Clear module boundaries
- ✅ Comprehensive documentation
- ✅ Easy to add new tools/features

### Related Documents

- Current Canvas: `frontend/components/annotation/Canvas.tsx`
- Tool Implementations: `frontend/lib/annotation/tools/*.ts`
- Annotation Store: `frontend/lib/stores/annotationStore.ts`

**Total**: 40-60h over ~2-3 weeks

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

### 2025-12-10: Phase 17 SSO Integration (Platform → Labeler) 🔄

**Task**: Implement SSO integration for seamless Platform → Labeler navigation

**Status**: 🔄 In Progress (85% complete, ~6 hours implementation time)

**Context**: Platform 팀에서 SSO integration 문서 제공. Phase 11.5.6에서 Platform이 Service JWT 발급 엔드포인트를 구현하여 Labeler로 자동 로그인이 가능하도록 요청.

**Implementation Summary**:

1. **Environment Variable Setup** (0.5h) ✅
   - Verified `SERVICE_JWT_SECRET` in `.env` matches Platform
   - Already configured: `SERVICE_JWT_SECRET=8f7e6d5c4b3a29180716253e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a`
   - `.env.example` includes SERVICE_JWT_SECRET template
   - `config.py` has SERVICE_JWT_SECRET and SERVICE_JWT_ALGORITHM fields

2. **Service Token Validation** (2h) ✅ - `backend/app/core/security.py:101-160`
   - Implemented `decode_service_token()` function
   - Validates JWT signature with SERVICE_JWT_SECRET
   - Checks token type (`type: "service"`)
   - Validates issuer (`iss: "platform"`)
   - Validates audience (`aud: "labeler"`)
   - Comprehensive error handling with descriptive messages

3. **SSO Endpoint Implementation** (3h) ✅ - `backend/app/api/v1/endpoints/auth.py:79-172`
   - Created `GET /api/v1/auth/sso?token=xxx` endpoint
   - Decodes and validates service JWT
   - Extracts user info: user_id, email, full_name, system_role, badge_color
   - Find or create user in Shared User DB
   - Updates user info if already exists
   - Creates access_token (user JWT, 24h expiry)
   - Redirects to Frontend with token: `/?sso_token={access_token}` (HTTP 303)
   - Error handling: 401 (invalid token), 400 (bad payload), 500 (server error)

4. **Frontend Integration** (1h) ✅ - `frontend/app/page.tsx:42-58`
   - Added SSO token handling in Dashboard page
   - Detects `sso_token` query parameter
   - Stores token in localStorage
   - Cleans URL (removes token from URL bar)
   - Reloads page to initialize auth context with new token
   - Token stored in localStorage (compatible with existing auth flow)

**SSO Flow**:
```
1. User clicks "데이터셋" on Platform
2. Platform → POST /api/v1/auth/labeler-token (get 5min service JWT)
3. Platform redirects: GET http://localhost:8011/api/v1/auth/sso?token={jwt}
4. Labeler backend:
   - Validates service JWT
   - Creates/updates user in User DB
   - Generates access_token (24h expiry)
   - Redirects to: http://localhost:3010/?sso_token={access_token}
5. Frontend:
   - Receives sso_token query parameter
   - Stores token in localStorage
   - Cleans URL (removes token from URL)
   - Reloads page with authenticated session
6. Dashboard loads with user data
```

**Files Modified**:
- `backend/app/core/security.py` (+60 lines) - decode_service_token()
- `backend/app/core/config.py` (+2 lines) - FRONTEND_URL setting
- `backend/app/api/v1/endpoints/auth.py` (+95 lines) - SSO endpoint
- `backend/.env` (+2 lines) - FRONTEND_URL config
- `backend/.env.example` (+3 lines) - FRONTEND_URL template
- `frontend/app/page.tsx` (+16 lines) - SSO token handling
- `docs/ANNOTATION_IMPLEMENTATION_TODO.md` (+300 lines) - Phase 17 documentation

**Commits**:
- (pending) `feat: Add SSO integration for Platform → Labeler navigation`

**Key Achievements**:
- ✅ Service JWT validation implemented (verify_aud/verify_iss fix)
- ✅ SSO endpoint with user auto-creation
- ✅ localStorage-based token management (query parameter passing)
- ✅ Seamless redirect flow (Platform → Labeler)
- ✅ Frontend SSO token handling with URL cleanup
- ✅ Backend server running successfully on port 8011

**Pending**:
- Integration testing with Platform (requires Platform Phase 11.5.6 completion)
- Optional: Unit tests for decode_service_token()
- Optional: Integration test script

**Next Steps**:
- Coordinate with Platform team for end-to-end SSO testing
- Verify SERVICE_JWT_SECRET matches between Platform and Labeler
- Test SSO flow once Platform implements `/api/v1/auth/labeler-token`

---

### 2025-11-26 (PM): Phase 12 Dataset Publish Improvements ✅

**Task**: Improve DICE export format quality, metadata completeness, and ML pipeline compatibility

**Status**: ✅ Complete (~8 hours implementation time)

**Context**: Export된 annotations.json 파일에서 labeled_by/reviewed_by가 null이고, train/val/test split이 없으며, 파일 확장자 정보가 누락되는 문제 발견

**Problems Discovered**:
1. **labeled_by / reviewed_by null**: 첫 번째 annotation에 created_by가 없으면 null 반환
2. **No train/val/test split**: 모든 이미지가 "train"으로 하드코딩됨
3. **file_format unknown**: 파일 확장자 정보가 없어 "unknown"으로 표시
4. **Image ID without extension**: "images/zipper/001" (확장자 없음) → 매칭 문제
5. **Timezone display issues**: UTC로 표시되어야 할 시간이 KST로 변환되지 않음

**Implementation Summary**:

1. **labeled_by/reviewed_by Fallback Logic** (2h) - Commit `204e4b0`
   - 모든 annotation을 순회하여 created_by/confirmed_by 찾기
   - Null 값 방지 로직 추가
   ```python
   for ann in image_annotations:
       if ann.created_by:
           labeled_by_user = user_db.query(User).filter(
               User.id == ann.created_by
           ).first()
           if labeled_by_user:
               break
   ```

2. **Hash-based Deterministic Split** (2h) - Commit `204e4b0`
   - MD5 해시 기반 train/val/test split (70/20/10)
   - Deterministic: 동일 image_id → 동일 split
   - ML 재현성 보장
   ```python
   def get_split_from_image_id(image_id: str) -> str:
       hash_val = int(hashlib.md5(image_id.encode()).hexdigest(), 16)
       normalized = (hash_val % 10000) / 10000.0
       if normalized < 0.7: return "train"
       elif normalized < 0.9: return "val"
       else: return "test"
   ```

3. **file_format Field Addition** (1h) - Commit `204e4b0`
   - 파일 확장자 추출 및 저장
   ```python
   file_ext = os.path.splitext(file_name)[1]  # ".png"
   file_format = file_ext[1:].lower() if file_ext else "unknown"  # "png"
   ```

4. **Image ID Extension Preservation** (3h) - Commit `5ab11a4`
   - `list_dataset_images()` 수정: 파일 확장자 보존
   - "images/zipper/001" → "images/zipper/001.png"
   - Migration script 작성 및 실행 (1725 레코드 업데이트)
   - ImageMetadata, ImageAnnotationStatus, Annotation 테이블 모두 업데이트

5. **Timezone Display Fix** (1h) - Commit `5ab11a4`
   - Frontend에서 UTC timestamp에 'Z' suffix 추가하여 올바른 파싱
   - Asia/Seoul 타임존 적용
   - 적용 범위: Annotation Versions, Version History, Dataset summary, Project dates

**Commits**:
- `204e4b0`: feat: Improve DICE export format with metadata enhancements
- `5ab11a4`: fix: Preserve file extensions in image_ids and fix timezone display

**Files Modified**:
- `backend/app/services/dice_export_service.py` (59 insertions, 5 deletions)
- `backend/app/core/storage.py` (9 insertions, 1 deletion)
- `backend/app/api/v1/endpoints/datasets.py`, `export.py` (7 insertions)
- `backend/app/services/dataset_delete_service.py` (7 insertions, 1 deletion)
- `frontend/app/page.tsx` (30 insertions, 11 deletions)
- `frontend/components/annotation/AnnotationHistory.tsx` (8 insertions)
- `frontend/components/annotation/Canvas.tsx` (7 insertions)
- `frontend/components/annotation/VersionHistoryModal.tsx` (8 insertions)

**Files Created**:
- `backend/scripts/migrate_add_file_extensions.py` (300 lines)
- `backend/scripts/verify_file_extensions.py` (82 lines)

**Migration Results**:
```
✅ 1725 ImageMetadata records updated
✅ 1725 ImageAnnotationStatus records updated
✅ 2847 Annotation records updated
✅ All file extensions preserved
```

**Key Achievements**:
- ✅ **Metadata Quality**: labeled_by/reviewed_by 항상 채워짐
- ✅ **ML Pipeline Ready**: Deterministic train/val/test splits
- ✅ **Data Consistency**: 모든 image_id에 파일 확장자 포함
- ✅ **Timezone Accuracy**: 모든 날짜가 KST로 정확히 표시
- ✅ **COCO Compatibility**: Sequential integer ID 유지

**Testing**:
- ✅ DICE export 테스트 (zipper dataset)
- ✅ labeled_by / reviewed_by 채워짐 확인
- ✅ Split 분포 검증 (70/20/10)
- ✅ file_format 추출 확인
- ✅ 파일 확장자 보존 확인
- ✅ Timezone 표시 확인

**Phase 12 Progress**: 100% complete (8h/22h estimated)

**Next**: Phase 11 Version Diff 완료, Phase 8 Collaboration 진행

---

### 2025-11-26 (AM): Phase 11 Version Diff & Comparison - Geometry Normalization & Canvas Rendering ✅

**Task**: Working vs Published 버전 비교 시 geometry format 불일치 해결 및 diff 표시 버그 수정

**Status**: ✅ Complete (~4 hours implementation time)

**Context**: Phase 11 diff 기능 테스트 중 Working(DB) vs Published(R2) 버전 비교 시 모든 annotation이 diff로 표시되는 문제 발견

**Problems Discovered**:
1. **All Diffs in Working vs Published**: Working과 Published 버전 비교 시 모든 annotation이 modified로 표시
2. **Geometry Format Mismatch**: DB format `{x, y, width, height}` vs R2 format `{bbox: [x, y, w, h]}`
3. **Confidence Mismatch**: DB `confidence: 1.0` vs R2 `confidence: None` → false diff 발생
4. **Diff Annotations at 0,0**: Canvas에서 diff annotation들이 실제 위치가 아닌 (0,0)에 표시

**Root Causes Identified**:
1. **Hybrid Data Sources**: Working(PostgreSQL) vs Published(R2 DICE) 서로 다른 geometry 포맷 사용
2. **No Geometry Normalization**: `compare_annotations()`가 geometry 객체를 직접 비교하여 키 불일치 감지
3. **Confidence Default Handling**: None과 1.0을 다른 값으로 간주
4. **Canvas Format Detection**: `snapshotToAnnotation()`이 DB format만 처리, R2 bbox 배열 미지원

**Implementation Summary**:

1. **SQL Logging Reduction** (0.5h)
   - `backend/app/core/database.py`: 모든 engine에서 `echo=False` 설정
   - `image_lock` 관련 verbose SQL 로그 제거로 디버깅 개선
   - Application DEBUG mode는 유지

2. **Geometry Normalization** (1.5h)
   - `backend/app/services/version_diff_service.py`: `normalize_geometry()` 함수 추가 (lines 218-260)
   - DB format `{x, y, width, height}` → 정규화
   - R2 format `{bbox: [x, y, w, h]}` → `{x, y, width, height}`로 변환
   - Polygon/Circle geometry도 지원
   - `find_best_match()`와 `compare_annotations()`에서 정규화된 geometry 사용

3. **Confidence Normalization** (0.5h)
   - `compare_annotations()`에서 None을 1.0(default)로 처리
   - False diff 제거: DB의 1.0과 R2의 None을 동일하게 간주

4. **Canvas Rendering Fix** (1.5h)
   - `frontend/components/annotation/Canvas.tsx`: `snapshotToAnnotation()` 수정 (lines 656-677)
   - R2 bbox array format 감지 및 처리
   - DB format과 R2 format 모두 지원
   ```typescript
   if (snapshot.geometry.bbox && Array.isArray(snapshot.geometry.bbox)) {
     // R2 format: already has bbox array
     geometry = { type: 'bbox', bbox: snapshot.geometry.bbox };
   } else {
     // DB format: convert to bbox array
     geometry = {
       type: 'bbox',
       bbox: [x || 0, y || 0, width || 0, height || 0]
     };
   }
   ```

5. **UX Improvement** (0.5h)
   - `frontend/lib/hooks/useKeyboardShortcuts.ts`: Delete/Backspace 키 확인 다이얼로그
   - Browser confirm → Global confirm dialog (일관된 UX)

**Files Modified**:
- `backend/app/core/database.py`: SQL echo logging disabled
- `backend/app/services/version_diff_service.py`:
  - `normalize_geometry()` 추가
  - `compare_annotations()` confidence 처리
  - `find_best_match()` geometry normalization
- `frontend/components/annotation/Canvas.tsx`: `snapshotToAnnotation()` dual format 지원
- `frontend/lib/hooks/useKeyboardShortcuts.ts`: Global confirm 적용

**Debug Logging Added**:
- Geometry keys 비교 로그
- Confidence 값 비교 로그
- Changes dict 상세 로그
- 추후 제거 또는 조건부 활성화 필요

**Key Technical Insights**:
- **Geometry Normalization Pattern**: 서로 다른 데이터 소스(DB vs R2) 통합 시 정규화 계층 필수
- **Default Value Handling**: null/None 값은 비즈니스 로직상 의미 있는 default로 변환
- **Format Detection Logic**: Frontend에서 두 가지 포맷 모두 지원하여 hybrid 환경 대응
- **IoU-based Matching**: Annotation ID가 없어도 geometry 유사도로 매칭 가능

**Phase 11 Progress**:
- Overlay Mode: ✅ Complete
- Diff Calculation: ✅ Complete (geometry normalization)
- Diff Navigation: ✅ Complete (badges, filtering)
- Side-by-side Mode: ⏸️ Pending
- Animation Mode: ⏸️ Pending
- Overall: **85%** complete

**Testing Results**:
- ✅ Published vs Published: 정상 작동 (same format)
- ✅ Working vs Published: 정상 작동 (geometry normalization)
- ✅ Diff badges: Added/Removed/Modified 정확히 표시
- ✅ Canvas rendering: 모든 diff annotation 올바른 위치에 표시
- ✅ Version auto-sorting: 항상 older → newer 비교 방향

**Next Steps**:
- Debug logging 제거 또는 조건부 활성화
- Side-by-side view mode 구현
- Animation toggle mode 구현
- E2E tests for diff accuracy

**Git Commits**:
- `bd78592`: fix: Normalize geometry formats for Working vs Published comparison

### 2025-11-25 (Late Night): Phase 9.4 Railway Deployment Troubleshooting & R2 CORS ✅

**Task**: Railway 배포 테스트 및 인증/CORS 문제 해결

**Status**: ✅ Complete (~3 hours implementation time)

**Context**: Phase 9.4 완료 후 Railway 배포 테스트 중 401 인증 오류 및 R2 CORS 문제 발견

**Problems Discovered**:
1. **401 Authentication Error**: Railway/Local frontend 모두 `admin@example.com / admin123` 로그인 실패
2. **User DB Configuration Error**: `.env` 파일의 User DB 설정이 잘못됨
3. **R2 CORS Policy Missing**: Railway frontend에서 R2 이미지 로드 실패 (CORS 차단)

**Root Causes Identified**:
1. **User DB Port Mismatch**: `.env`에서 port 5432로 설정, 실제 Docker 컨테이너는 port 5433에서 실행
2. **User DB Name Mismatch**: `.env`에서 "platform" DB, 실제 Docker 컨테이너는 "users" DB 사용
3. **R2 CORS Not Configured**: Cloudflare R2 버킷에 Railway frontend URL CORS 정책 미설정

**Implementation Summary**:

1. **User DB Configuration Fix** (1h)
   ```bash
   # backend/.env
   USER_DB_PORT=5432 → 5433  # Docker container port mapping
   USER_DB_NAME=platform → users  # Actual database name in container
   ```
   - Docker 컨테이너 확인: `platform-postgres-user-tier0` (port 5433)
   - Database 확인: `psql -h localhost -p 5433 -U admin -l`
   - Admin 사용자 확인: `check_db.py` 스크립트로 검증 (5명 사용자 존재)

2. **Database Utilities Created** (1h)
   - `backend/check_db.py`: User DB 연결 및 사용자 확인 유틸리티
   - `backend/init_db.py`: 테스트 사용자 초기화 스크립트
   - 두 스크립트 모두 포트 설정 오류 디버깅에 활용

3. **R2 CORS Configuration** (1h)
   - `docs/r2-cors-config.json` 생성: Railway frontend URL 포함 CORS 정책
   ```json
   {
     "AllowedOrigins": [
       "http://localhost:3000",
       "http://localhost:3001",
       "http://localhost:3010",
       "https://mvp-vision-ai-labeler-production.up.railway.app"
     ],
     "AllowedMethods": ["GET", "HEAD"],
     "AllowedHeaders": ["*"],
     "MaxAgeSeconds": 3600
   }
   ```
   - Cloudflare 대시보드에서 수동 설정 필요 (wrangler CLI 미설치)

4. **Branch Management**
   - `production` 브랜치에서 변경사항 커밋 및 푸시
   - `develop` 브랜치로 병합 (91 files changed)

**Files Created**:
- `backend/check_db.py` (DB 연결 및 사용자 확인 유틸리티)
- `backend/init_db.py` (테스트 사용자 초기화 스크립트)
- `docs/r2-cors-config.json` (R2 CORS 정책 설정 파일)

**Files Modified** (`.env` - gitignored):
- `backend/.env`:
  - `USER_DB_PORT`: 5432 → 5433
  - `USER_DB_NAME`: platform → users

**Key Learnings**:
- Docker 컨테이너 포트 매핑 확인 중요 (host:5433 → container:5432)
- 데이터베이스 이름은 `docker exec` 명령으로 확인 가능 (`psql -l`)
- R2 CORS 정책은 프론트엔드 배포 시 반드시 설정 필요
- Railway 배포 시 환경 변수 검증 스크립트가 유용함

**Next Steps**:
- Cloudflare 대시보드에서 R2 버킷 CORS 정책 적용
  - `training-datasets` 버킷
  - `annotations` 버킷
- Railway 프론트엔드에서 이미지 로드 테스트

**Phase 9 Progress**: 34/46h = 74% (Phase 9.1, 9.3, 9.4 complete, troubleshooting done)

**Git Commits**:
- `bad16f4`: Add R2 CORS configuration and database utilities for Railway deployment
- `bd770be`: Merge production branch to develop

### 2025-11-25 (PM - Late): Phase 9.5 Railway Performance Optimization ✅

**Task**: Railway DB 성능 저하 문제 분석 및 최적화

**Status**: ✅ Complete (~6 hours implementation time)

**Context**: Phase 9.3 R2 마이그레이션 완료 후 실제 환경 테스트 중 성능 저하 발견 (초기 페이지 로드 15초)

**Problem Discovery**:
- User가 로그인 + 페이지 새로고침만 했는데 15초 소요
- 데이터셋 조회조차 하지 않은 상태에서 과도한 API 호출 발생
- 백엔드 로그: 30+ User DB queries (같은 사용자 정보 반복 조회)
- Railway DB latency: ~200ms per query

**Root Causes Identified**:
1. **Frontend Auto-select Bug**: `fetchDatasets()` 완료 후 자동으로 첫 dataset 선택 → 6+ API 연쇄 호출
2. **Sidebar Polling Bug**: `useEffect([user])` dependency가 user 객체 참조 변경마다 재실행 → interval 중복 생성 → Invitations API 5+ 회 호출
3. **Sequential API Calls**: Dataset 선택 시 6개 API를 순차적으로 실행 (1.2초 소요)
4. **N+1 User Query Problem**: 매 API 요청마다 `get_current_user`가 User DB 조회 (캐싱 없음)

**Implementation Summary**:

1. **Frontend Optimizations** (3-4h)
   - Auto-select 제거: `frontend/app/page.tsx:97-98` (사용자가 명시적으로 선택할 때만 로드)
   - Sidebar polling 수정: `useEffect([user?.id])` (user.id 변경 시에만 재실행)
   - API 병렬화: `Promise.all()` 사용 (6개 API를 2 phases로 병렬 실행)

2. **Backend Optimizations** (2-3h)
   - User 쿼리 캐싱: `backend/app/core/security.py` (in-memory cache with 30s TTL)
   - `get_current_user()` 함수에 캐싱 로직 추가
   - 첫 조회 후 30초간 캐시 사용 (DB 쿼리 95% 감소)

**Performance Results**:

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Initial Page Load | ~15s | ~2-3s | **80% ↓** |
| Dataset Selection | ~1.2s | ~0.4s | **66% ↓** |
| User DB Queries | 30+ times | 1-2 times | **95% ↓** |
| Invitations API | 5+ times | 1 time | **80% ↓** |

**Files Modified**:
- `frontend/app/page.tsx` (auto-select 제거, API 병렬화)
- `frontend/components/Sidebar.tsx` (polling dependency 수정)
- `backend/app/core/security.py` (user caching logic 추가)
- `docs/annotation_implementation_todo.md` (Phase 9.5 추가)

**Key Learnings**:
- Railway DB latency (~200ms) makes N+1 queries critical
- Frontend auto-select 기능은 사용자 경험보다 성능 저하가 클 수 있음
- `Promise.all()` API 병렬화는 간단하지만 큰 효과
- 간단한 in-memory 캐싱도 충분한 성능 개선 (Redis 불필요)
- `useEffect` dependency array는 신중하게 관리해야 함

**Additional Optimizations Identified (Future)**:
- Redis caching for multi-instance deployment
- DB connection pooling tuning
- Frontend code splitting
- API response compression

**Phase 9 Progress**: 23/44h = 52% (Phase 9.1 + 9.3 + 9.5 complete)

**Next**: Performance testing → Phase 9.2 (Labeler DB Railway deployment) when Platform completes deployment

### 2025-11-25 (PM): Phase 9.3 External Storage → R2 Migration ✅

**Task**: Migrate External Storage (training-datasets) from MinIO to Cloudflare R2

**Status**: ✅ Complete (~10 hours implementation time)

**Context**: 실제 on-prem 배포 시 S3를 사용해야 하므로, R2와 S3를 코드 수정 없이 환경 변수만으로 전환할 수 있는 메커니즘 필요

**Implementation Summary**:

1. **Data Migration** (3,451 files, 1.59 GB)
   - Created `migrate_minio_to_r2.py` script
   - 100% success rate (0 failures)
   - Metadata and Content-Type preserved
   - Duration: 42 minutes

2. **R2 Public Development URL Setup**
   - Configured: `https://pub-300ed1553b304fc5b1d83684b73fc318.r2.dev`
   - Tested: HTTP 200 OK (1.3 MB image successfully accessed)
   - Note: R2 Presigned URLs don't work (403 Forbidden) - Expected R2 behavior

3. **Hybrid URL Generation Implementation** (CRITICAL)
   - **Problem**: User needs S3 compatibility for on-prem deployment
   - **Solution**: Environment variable toggle (`R2_PUBLIC_URL`)
   - **Implementation**:
     ```python
     # backend/app/core/storage.py
     def generate_presigned_url(self, bucket: str, key: str, expiration: int = 3600) -> str:
         # R2 mode: Use public R2.dev URL
         if settings.R2_PUBLIC_URL and bucket == self.datasets_bucket:
             return f"{settings.R2_PUBLIC_URL}/{key}"

         # S3 mode: Use presigned URL (with signature)
         return self.s3_client.generate_presigned_url(...)
     ```

4. **Testing & Verification**
   - Created `test_hybrid_url.py` test script
   - ✅ R2 mode: Uses R2.dev public URLs (no signatures)
   - ✅ S3 mode: Uses presigned URLs (with signatures)
   - ✅ Environment variable toggle working correctly
   - ✅ On-prem S3 compatibility confirmed

**Files Created**:
- `backend/scripts/migrate_minio_to_r2.py` (migration script)
- `backend/scripts/test_r2_access.py` (R2 access test)
- `backend/scripts/test_hybrid_url.py` (Hybrid URL test)
- `backend/migration_log.txt` (3,451 entries)
- `docs/phase-9.3-r2-external-storage-migration-complete.md` (comprehensive docs)

**Files Modified**:
- `backend/.env` (R2 credentials + `R2_PUBLIC_URL`)
- `backend/.env.example` (R2 template)
- `backend/app/core/config.py` (added `R2_PUBLIC_URL` setting)
- `backend/app/core/storage.py` (Hybrid URL generation logic)
- `docs/ANNOTATION_IMPLEMENTATION_TODO.md` (Phase 9.3 complete)

**Deployment Strategy**:

| Environment | R2_PUBLIC_URL | URL Type | Use Case |
|-------------|---------------|----------|----------|
| **Development (R2)** | `https://pub-xxx.r2.dev` | Public R2.dev URL | Cloud development |
| **Production (S3)** | (empty) | Presigned URL | On-prem deployment |

**Key Benefits**:
- ✅ No code changes between R2 and S3 environments
- ✅ Only environment variable configuration required
- ✅ Same codebase supports both cloud and on-prem deployments
- ✅ On-prem S3 compatibility confirmed with tests

**Phase 9 Progress**: 17/38h = 45% (Phase 9.1 + 9.3 complete)

**Next**: Phase 9.4 (Internal Storage → R2) or Phase 9.2 (Labeler DB Railway deployment)

### 2025-11-25 (AM): Railway Deployment Planning & Bug Fixes ✅

**Task**: Create Railway deployment plan and update TODO list with recent work

**Completed**:
1. **Railway Deployment Planning**
   - Created `docs/railway-deployment-guide.md` (comprehensive guide)
   - 5-phase deployment sequence:
     1. User DB → Railway (Platform team) + Labeler integration ✅
     2. Labeler DB → Railway + Labeler integration
     3. S3 Internal → Cloudflare R2 + Labeler integration
     4. S3 External → R2 + Labeler integration
     5. Labeler backend/frontend → Railway deployment
   - Detailed checklists, rollback procedures, cost estimates
   - Performance targets and monitoring guidelines

2. **Recent Bug Fixes & Enhancements** (Phase 2.7, Phase 8.5)
   - **Confirmation Persistence Fix**:
     - Fixed race condition in `reloadImageStatuses` useEffect
     - Added `images.length === 0` guard to prevent premature execution
     - Added `images.length` to dependency array
     - Enhanced `handleConfirmToggle` to immediately update image status
     - Increased pagination limit from 50 to 200
   - **Infinite Scroll** (ImageList):
     - Auto-loads when scrolled within 100px of bottom
     - No manual "+ Load More" click required
     - Smooth background loading
   - **Magnifier Remote Desktop Fix**:
     - Changed from hold-to-toggle mode (Z key press/release)
     - Fixed lock overlay blocking mouse events (`pointer-events-none`)
     - Removed excessive debug logging
   - **Lock System Improvements**:
     - Auto-acquire/refresh locks for same user
     - Direct database update for lock refresh
     - Fixed AttributeError in annotation deletion

**Files Created**:
- `docs/railway-deployment-guide.md` (comprehensive deployment plan)

**Files Modified** (Recent bug fixes):
- `frontend/app/annotate/[projectId]/page.tsx` (race condition fix, pagination)
- `frontend/components/annotation/RightPanel.tsx` (immediate status update)
- `frontend/components/annotation/ImageList.tsx` (infinite scroll)
- `frontend/components/annotation/Canvas.tsx` (magnifier toggle mode, lock overlay)
- `frontend/components/annotation/Magnifier.tsx` (removed debug logs)
- `backend/app/api/v1/endpoints/annotations.py` (lock refresh fix)
- `docs/ANNOTATION_IMPLEMENTATION_TODO.md` (this file - updated)

**PRs**:
- PR #15: Collaboration features + bug fixes (feature/collaboration-features → develop)

**Impact**:
- Confirmation status now persists correctly after page reload
- Smoother UX with infinite scroll
- Better remote desktop compatibility
- More robust lock system

**Phase Status Updates**:
- Phase 2.7: Image Confirmation ✅ Complete (with bug fixes)
- Phase 8.5: Concurrent Handling ✅ Complete (with lock improvements)
- Phase 9: Database Deployment 📋 Planning complete

**Next**: Phase 9.2 (Labeler DB Railway deployment) when Platform completes Railway migration

---

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

### 2025-11-23 (AM): Phase 8.1 RBAC Implementation & Phase 9 Planning ✅

**Phase 8.1 Completed**:
1. ✅ ProjectPermission table creation (Alembic migration)
2. ✅ ProjectPermission model with 5-role RBAC (owner > admin > reviewer > annotator > viewer)
3. ✅ Data migration: DatasetPermission → ProjectPermission (2 permissions migrated)
4. ✅ `require_project_permission()` helper with role hierarchy
5. ✅ Project permission API endpoints (list, add, update, remove, transfer ownership)
6. ✅ Updated image lock endpoints to use ProjectPermission
7. ✅ Updated annotation endpoints to use ProjectPermission
8. ✅ Frontend API client updated (acquireLock endpoint changed)
9. ✅ Bug fix: Added version increment to confirm/unconfirm operations
10. ✅ Frontend: Reload annotations after confirm to sync version

**Phase 9 Planning**:
1. Created `docs/phase-9-database-deployment-plan.md` (detailed 18-22h plan)
2. Updated `ANNOTATION_IMPLEMENTATION_TODO.md` (Phase 9 → 10 → 11 shift)
3. Architecture designed for Railway deployment:
   - User DB separation (align with Platform)
   - Labeler DB Railway migration
   - Environment variable management
   - Migration & rollback procedures

**Files Created**:
- `backend/alembic/versions/20251123_1000_add_project_permissions_table.py`
- `backend/scripts/migrate_dataset_permissions_to_project.py`
- `backend/scripts/verify_migration.py`
- `backend/app/api/v1/endpoints/project_permissions.py`
- `docs/phase-8.1-implementation-complete.md`
- `docs/phase-9-database-deployment-plan.md`

**Files Modified**:
- `backend/app/db/models/labeler.py` (ProjectPermission model)
- `backend/app/schemas/permission.py` (ProjectPermission schemas)
- `backend/app/core/security.py` (require_project_permission, ROLE_HIERARCHY)
- `backend/app/api/v1/endpoints/image_locks.py` (all endpoints)
- `backend/app/api/v1/endpoints/annotations.py` (permission checks, version increment)
- `backend/app/api/v1/endpoints/projects.py` (confirm/unconfirm version increment)
- `backend/app/api/v1/router.py` (project_permissions router)
- `frontend/lib/api/image-locks.ts` (acquireLock endpoint URL)
- `frontend/components/annotation/Canvas.tsx` (reload annotations after confirm)

### 2025-11-23 (PM): Phase 9.1 User DB Separation Implementation ✅

**Status**: ✅ Complete (~6 hours implementation time)

**Context**: Platform에서 User DB 분리 완료 (로컬 PostgreSQL localhost:5433), Labeler도 User DB 사용하도록 마이그레이션

**Implementation Summary**:
1. ✅ Database Configuration
   - User DB: PostgreSQL (localhost:5433/users)
   - Updated config.py with USER_DB_HOST, USER_DB_PORT, USER_DB_NAME
   - Created `get_user_db()` session factory in database.py
   - Updated .env and .env.example files

2. ✅ User Model Separation
   - Created `backend/app/db/models/user.py`
   - Migrated User and Organization models from platform.py
   - All models now use UserBase (PostgreSQL)

3. ✅ Authentication System Migration
   - Updated `security.py`: get_current_user() now uses User DB
   - Updated `auth.py`: login endpoint uses User DB
   - All JWT token validation queries User DB

4. ✅ API Endpoints Migration (33 User queries across 7 files)
   - auth.py: 1 function, 1 User query
   - annotations.py: 4 functions, 8 User queries
   - projects.py: 1 function, 1 User query
   - image_locks.py: 5 functions (+ helper), 5 User queries
   - export.py: 1 function, 1 User query
   - project_permissions.py: 3 functions, 5 User queries
   - datasets.py: 6 functions, 12 User queries

5. ✅ Integration Testing
   - Login test: ✅ User DB authentication successful
   - /api/v1/auth/me: ✅ User info retrieval successful
   - /api/v1/datasets: ✅ Owner info from User DB successful

**Architecture Changes**:
```
Before (Phase 8):
- Platform DB (5432): users, datasets, projects, etc.
- Labeler DB (5435): annotations, locks, permissions

After (Phase 9.1):
- User DB (5433): users, organizations (shared with Platform)
- Platform DB (5432): datasets, projects, etc. (users table deprecated)
- Labeler DB (5435): annotations, locks, permissions
```

**Files Created**:
- `backend/app/db/models/user.py` (User, Organization models for User DB)

**Files Modified**:
- `backend/app/core/config.py` (USER_DB configuration)
- `backend/app/core/database.py` (get_user_db session factory)
- `backend/app/core/security.py` (User DB authentication)
- `backend/app/api/v1/endpoints/auth.py` (User DB login)
- `backend/app/api/v1/endpoints/annotations.py` (User DB queries)
- `backend/app/api/v1/endpoints/projects.py` (User DB queries)
- `backend/app/api/v1/endpoints/image_locks.py` (User DB queries)
- `backend/app/api/v1/endpoints/export.py` (User DB queries)
- `backend/app/api/v1/endpoints/project_permissions.py` (User DB queries)
- `backend/app/api/v1/endpoints/datasets.py` (User DB queries)
- `backend/.env` (USER_DB environment variables)
- `backend/.env.example` (USER_DB template)
- `docs/ANNOTATION_IMPLEMENTATION_TODO.md` (Phase 9.1 complete)

**Performance**: All User queries now route to dedicated User DB, improving separation of concerns and preparing for Railway deployment.

**Next**: Phase 9.2 (Labeler DB Railway deployment) when Platform completes Railway migration

### 2025-11-23 (PM - Late): Phase 8.2 Invitation System Implementation ✅

**Status**: ✅ Complete (~18 hours implementation time)

**Context**: Implement full invite-accept workflow with 5-role RBAC integration and User DB separation

**Implementation Summary**:

1. ✅ Backend API (10h)
   - **User Search API** (`/api/v1/users/search`)
     - Search by email/name in User DB
     - Exclude already-permitted users (project_id filter)
     - Return user avatar/badge info
   - **Invitation CRUD API** (`/api/v1/invitations`)
     - POST: Create invitation (owner/admin only)
     - GET: List invitations (received/sent with filters)
     - POST /accept: Accept invitation (creates ProjectPermission)
     - POST /{id}/cancel: Cancel invitation
   - **Cross-Database Integration**
     - User DB: invitations table (token, status, expires_at)
     - Labeler DB: ProjectPermission auto-creation on accept
     - 5-role RBAC validation (owner/admin/reviewer/annotator/viewer)

2. ✅ Frontend UI (8h)
   - **Enhanced InviteDialog**
     - Real-time user search with 300ms debouncing
     - User avatars with badge colors
     - 5-role selector with descriptions
     - Toast notifications
   - **InvitationsPanel**
     - Tabs: Received/Sent
     - Accept/Decline/Cancel actions
     - Time-based formatting ("2h ago", "3d ago")
     - Expired invitation handling
   - **Notification System**
     - Bell icon in Sidebar
     - Opens InvitationsPanel on click
     - Toast feedback for all actions

**Architecture**:
```
Invitation Workflow:
┌────────────────────────────────────────────────────┐
│  Inviter → Search User (User DB)                   │
│          → Select Role (5-role RBAC)               │
│          → Create Invitation (User DB invitations) │
│          → Token + 7-day expiration                │
└────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────┐
│  Invitee → View in InvitationsPanel                │
│          → Accept/Decline                          │
│          → ProjectPermission Created (Labeler DB)  │
│          → Invitation status updated (User DB)     │
└────────────────────────────────────────────────────┘
```

**Files Created**:
- `backend/app/api/v1/endpoints/users.py` (User search)
- `backend/app/api/v1/endpoints/invitations.py` (Invitation CRUD)
- `backend/app/schemas/user.py` (UserSearchResponse)
- `backend/app/schemas/invitation.py` (InvitationResponse, etc.)
- `frontend/lib/api/users.ts` (User search client)
- `frontend/lib/api/invitations.ts` (Invitations client)
- `frontend/components/datasets/InviteDialog.tsx` (Enhanced dialog)
- `frontend/components/datasets/UserAvatar.tsx` (Reusable avatar)
- `frontend/components/invitations/InvitationsPanel.tsx` (Management panel)

**Files Modified**:
- `backend/app/db/models/user.py` (added Invitation model, is_verified field)
- `backend/app/api/v1/router.py` (registered users + invitations routers)
- `frontend/app/page.tsx` (replaced InviteMemberModal with InviteDialog, added InvitationsPanel)
- `frontend/components/Sidebar.tsx` (added notification bell icon)

**Edge Cases Handled**:
- ✅ Expired invitations (auto-marked on accept attempt)
- ✅ Duplicate invitation prevention
- ✅ Already-has-permission check
- ✅ Permission validation (only owner/admin can invite)
- ✅ Invalid token handling
- ✅ Cross-database consistency (User DB + Labeler DB)

**Testing**: Backend server startup verified, all endpoints registered, authentication working

**Phase 8 Progress**: 61/105h = 58% (Phase 8.5, 8.1, 8.2 complete)

**Next**: Phase 8.3 (Task Assignment) or Phase 9.2 (Labeler DB deployment)

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

## Session Notes

### 2025-12-18: Phase 18.1 - Canvas Architecture Analysis & Planning ✅

**Task**: Analyze current Canvas.tsx structure and create comprehensive refactoring documentation

**Status**: ✅ Complete (~5 hours implementation time)

**Context**: Canvas.tsx has grown to 4,100 lines with severe code smell issues - massive event handlers (1,253 lines of mouse handlers alone), 588-line keyboard shortcuts useEffect, 81 state values, and 0% test coverage. This phase creates a detailed analysis and migration plan for refactoring into a modular architecture.

**Implementation Summary**:
1. **Canvas Analysis** (~2h):
   - Analyzed entire 4,100-line Canvas.tsx structure
   - Mapped all responsibilities: state (81 values), events (1,841 lines), rendering, tools
   - Identified mouse handlers taking 30% of file (handleMouseDown: 535 lines)
   - Documented keyboard shortcuts taking 14% of file (588 lines in single useEffect)
   - Created complexity metrics and risk assessment

2. **Target Architecture Design** (~2h):
   - Designed 7 custom hooks (useCanvasState, useCanvasTransform, useToolState, useCanvasEvents, useCanvasGestures, useImageManagement, useAnnotationSync)
   - Specified 5 renderer components (CanvasRenderer, ToolOverlay, MagnifierOverlay, LockOverlay, DiffRenderer)
   - Defined 4 utility modules (coordinateTransform, geometryHelpers, renderHelpers, annotationHelpers)
   - Created data flow diagrams and component hierarchy
   - Documented hook interfaces and dependencies

3. **Migration Plan** (~1h):
   - Created 6-phase migration plan with detailed steps (18.2-18.7)
   - Defined testing strategy (>70% coverage target, 125+ tests)
   - Documented risk mitigation and rollback procedures
   - Set timeline (40-60h over 2-3 weeks) and success criteria
   - Created detailed extraction order for safe, incremental refactoring

**Commits**:
- N/A (Documentation only)

**Files Created**:
- `docs/refactoring/canvas-analysis.md` (493 lines)
  - Comprehensive breakdown of all 4,100 lines
  - Section-by-section analysis with line numbers
  - Complexity metrics (state, functions, cyclomatic complexity)
  - Performance analysis and risk assessment

- `docs/refactoring/canvas-architecture.md` (550+ lines)
  - Target architecture with module structure
  - 7 custom hooks with detailed specifications
  - 5 renderer components with props and responsibilities
  - 4 utility modules with function signatures
  - Data flow diagrams and component hierarchy
  - Hook dependency graph

- `docs/refactoring/migration-plan.md` (900+ lines)
  - 6 migration phases (18.2: Utilities, 18.3: Hooks, 18.4: Renderers, 18.5: Tool System, 18.6: Tests, 18.7: Optimization)
  - Step-by-step extraction procedures
  - Testing strategy (Unit, Integration, E2E)
  - Risk mitigation strategies
  - Rollback procedures
  - Timeline and success metrics

**Files Modified**:
- `docs/ANNOTATION_IMPLEMENTATION_TODO.md`
  - Updated Phase 18 to 10% complete (18.1 done)
  - Marked all Phase 18.1 tasks as complete
  - Added key findings and deliverables

**Key Achievements**:
- ✅ Complete structural analysis of 4,100-line Canvas.tsx
- ✅ Identified critical issues: 1,253 lines of mouse handlers, 588-line useEffect, 81 state values
- ✅ Designed modular architecture with clear separation of concerns
- ✅ Created comprehensive migration plan with risk mitigation
- ✅ Set measurable success criteria: Canvas.tsx 4,100 → <500 lines (88% reduction), 0% → >70% test coverage

**Target Metrics** (After Full Refactoring):
- Canvas.tsx: 4,100 → <500 lines (88% reduction)
- Largest function: 588 → <200 lines (66% reduction)
- Test coverage: 0% → >70%
- State values: 81 → <30
- Component re-renders: -50%

**Next Steps**:
- Phase 18.2: Extract Utility Functions (8-10h)
  - Create 4 utility modules (coordinateTransform, geometryHelpers, renderHelpers, annotationHelpers)
  - Extract ~400 lines of pure functions from Canvas.tsx
  - Write unit tests (>90% coverage for utilities)

---

**End of Document**

---

## ISSUES

### Upload Progress & Completion Issue (2025-11-26)

**Status**: Needs Investigation

**Description**:
업로드 프로그레스바가 97%까지 진행되고, 첫 번째 파일에서 스피너가 계속 돌면서 완료되지 않는 문제.

**Observed Behavior**:
1. 프로그레스바가 97%까지 주욱 진행
2. 파일 리스트에서 첫 번째 파일만 스피너 표시 (uploading)
3. 나머지 파일들은 대기 상태 (pending)
4. 천천히 100%에 도달하지만 여전히 첫 번째 파일에서 멈춘 것처럼 보임
5. 한참을 기다려도 완료되지 않음
6. R2 Storage에는 모든 파일이 업로드된 것으로 보임 (완전히 확인은 안됨)

**Attempted Fixes** (Commit: 958ffd7):
1. Backend: 50개마다 DB commit 추가
   - 문제: 500개 INSERT가 pending 상태로 쌓여서 마지막 commit이 오래 걸림
   - 해결: `COMMIT_BATCH_SIZE = 50` 도입

2. Frontend: 파일 상태 업데이트 로직 수정
   - 문제: `findIndex()` 사용으로 첫 번째 파일만 업데이트
   - 해결: 정확한 배치 인덱스 (start ~ end) 사용

**Current Status**:
- 수정은 완료했으나 실제로 문제가 해결되었는지 확인 필요
- 면밀한 테스트와 분석 필요
- 추가 디버깅 로그 추가 검토

**Next Steps**:
- [ ] 다양한 파일 개수로 업로드 테스트 (10개, 50개, 100개, 500개)
- [ ] Backend 로그 확인 (commit 타이밍, 소요 시간)
- [ ] Frontend 상태 업데이트 로직 검증
- [ ] R2 업로드 vs DB commit 타이밍 분석
- [ ] 네트워크 타임아웃 설정 확인

**Related Files**:
- `backend/app/services/dataset_upload_service.py`
- `frontend/components/datasets/upload/Step4Upload.tsx`
- `backend/app/api/v1/endpoints/datasets.py` (add_images_to_dataset)

**Related Commits**:
- 958ffd7: fix: Resolve upload hanging issue with batch commits and status tracking

---

---

## ISSUES

### Upload Progress & Completion Issue (2025-11-26)

**Status**: Needs Investigation

**Description**:
업로드 프로그레스바가 97%까지 진행되고, 첫 번째 파일에서 스피너가 계속 돌면서 완료되지 않는 문제.

**Observed Behavior**:
1. 프로그레스바가 97%까지 주욱 진행
2. 파일 리스트에서 첫 번째 파일만 스피너 표시 (uploading)
3. 나머지 파일들은 대기 상태 (pending)
4. 천천히 100%에 도달하지만 여전히 첫 번째 파일에서 멈춘 것처럼 보임
5. 한참을 기다려도 완료되지 않음
6. R2 Storage에는 모든 파일이 업로드된 것으로 보임 (완전히 확인은 안됨)

**Attempted Fixes** (Commit: 958ffd7):
1. Backend: 50개마다 DB commit 추가
   - 문제: 500개 INSERT가 pending 상태로 쌓여서 마지막 commit이 오래 걸림
   - 해결: COMMIT_BATCH_SIZE = 50 도입

2. Frontend: 파일 상태 업데이트 로직 수정
   - 문제: findIndex() 사용으로 첫 번째 파일만 업데이트
   - 해결: 정확한 배치 인덱스 (start ~ end) 사용

**Current Status**:
- 수정은 완료했으나 실제로 문제가 해결되었는지 확인 필요
- 면밀한 테스트와 분석 필요
- 추가 디버깅 로그 추가 검토

**Next Steps**:
- [ ] 다양한 파일 개수로 업로드 테스트 (10개, 50개, 100개, 500개)
- [ ] Backend 로그 확인 (commit 타이밍, 소요 시간)
- [ ] Frontend 상태 업데이트 로직 검증
- [ ] R2 업로드 vs DB commit 타이밍 분석
- [ ] 네트워크 타임아웃 설정 확인

**Related Files**:
- backend/app/services/dataset_upload_service.py
- frontend/components/datasets/upload/Step4Upload.tsx
- backend/app/api/v1/endpoints/datasets.py (add_images_to_dataset)

**Related Commits**:
- 958ffd7: fix: Resolve upload hanging issue with batch commits and status tracking

---
