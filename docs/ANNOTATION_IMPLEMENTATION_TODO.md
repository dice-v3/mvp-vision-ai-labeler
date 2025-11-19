# Annotation Canvas Implementation To-Do List

**Project**: Vision AI Labeler - Annotation Interface
**Based on**: `docs/design/ANNOTATION_UI_DESIGN.md`
**Start Date**: 2025-11-14
**Target Completion**: 2025-12-19 (5 weeks)

---

## Progress Overview

| Phase | Status | Progress | Target Week |
|-------|--------|----------|-------------|
| Phase 1: Core Canvas | ✅ Complete | 44/45 (98%) | Week 1 |
| Phase 2: Advanced Features | 🔄 In Progress | 85% core features | Week 2-6 |
| Phase 3: Multi-Task Tools | ⏸️ Pending | 0/29 | Weeks 7-8 |
| Phase 4: AI Integration | ⏸️ Pending | 0/22 | Weeks 9-10 |
| Phase 5: Polish & Optimization | ⏸️ Pending | 0/20 | Week 11 |

**Overall Progress**: ~75% Phase 2 features complete
**Phase 2 Breakdown**:
- 2.7 Confirmation: 12/13 tasks ✅ Feature Complete!
- 2.8 Version Mgmt: 12/15 tasks ✅ Backend Complete!
- 2.9 Task-Based Architecture: ✅ Complete!
- 2.10.1 Dataset Deletion: ✅ Complete!
- Other features: 0/45 tasks (Undo/Redo, Shortcuts, etc.)

---

## Phase 1: Core Canvas (Week 1)

**Goal**: Functional image viewer with basic bbox drawing and saving
**Target Completion**: 2025-11-21

### 1.1 Project Setup & Routing ✅

- [x] **Create annotation page route** ✅ COMPLETED
  - Path: `frontend/app/annotate/[projectId]/page.tsx`
  - Dynamic route for project ID
  - Protected route (requires auth)
  - Redirects from dashboard on "레이블링 시작" click
  - **Estimate**: 1 hour
  - **Actual**: 1 hour

- [x] **Setup layout structure** ✅ COMPLETED
  - Top bar component
  - Left panel component
  - Canvas area component
  - Right panel component
  - Bottom bar component
  - **Estimate**: 2 hours
  - **Actual**: 2 hours

### 1.2 Canvas Component ✅

- [x] **Image viewer foundation** ✅ COMPLETED
  - Display image from presigned URL
  - Fit to screen on load
  - Maintain aspect ratio
  - Dark gray background (#1f2937)
  - **Estimate**: 2 hours
  - **File**: `frontend/components/annotation/Canvas.tsx`
  - **Actual**: 2 hours

- [x] **Zoom controls** ✅ COMPLETED
  - Mouse wheel zoom (10% increments)
  - Zoom in/out buttons (+/- 25%)
  - Keyboard: `Ctrl + Plus/Minus`
  - Fit to screen: `Ctrl + 0`
  - Zoom range: 0.25 - 4.0x
  - **Estimate**: 3 hours
  - **Actual**: 3 hours

- [x] **Pan controls** ✅ COMPLETED
  - Shift + Drag: Pan around
  - Middle mouse button drag
  - Arrow keys: 50px increments
  - **Estimate**: 2 hours
  - **Actual**: 2.5 hours

- [x] **Grid overlay** ✅ COMPLETED
  - Subtle gray grid (20px squares)
  - Visible only when zoom > 1.0
  - z-index: 0 (background layer)
  - **Estimate**: 1 hour
  - **Actual**: 1 hour

- [x] **Crosshair cursor** ✅ COMPLETED
  - Full-screen horizontal/vertical lines
  - Visible only while bbox tool active
  - Opacity: 30%
  - z-index: 5 (top layer)
  - **Estimate**: 1 hour
  - **Actual**: 1 hour

### 1.3 Bounding Box Tool 🔄

- [x] **Drawing interaction** ✅ COMPLETED
  - Activate tool with 'V' key or toolbar click
  - Click-drag to create bbox
  - Show dashed preview while dragging
  - Display dimensions tooltip: "W: 240 x H: 180"
  - Validate minimum size (5x5px)
  - **Estimate**: 4 hours
  - **Actual**: 4 hours

- [x] **Rendering bboxes** ✅ COMPLETED
  - Render all bboxes on canvas
  - Stroke width: 2px (normal), 3px (selected)
  - Label background: semi-transparent
  - Font: 12px medium
  - Color: from class definition
  - **Estimate**: 3 hours
  - **Actual**: 3 hours

- [x] **Selection & handles** ✅ COMPLETED
  - Click bbox to select (in RightPanel)
  - Show 8 resize handles (corners + midpoints)
  - Handle size: 8x8px squares
  - **Estimate**: 3 hours
  - **Actual**: 2 hours

- [ ] **Resize & move** 🔄 IN PROGRESS
  - Drag handles to resize
  - Drag inside bbox to move
  - Live dimension updates
  - Cursor changes (resize icons)
  - **Estimate**: 3 hours
  - **Status**: Handles rendered, interaction not implemented yet

### 1.4 Class Selector ✅

- [x] **Left panel class list** ✅ COMPLETED
  - Display all classes from project.classes
  - Color indicators
  - Click to select class
  - **Estimate**: 3 hours
  - **File**: `frontend/components/annotation/LeftPanel.tsx`
  - **Actual**: 2 hours

- [x] **Floating class selector** ✅ COMPLETED
  - Appears after drawing bbox
  - Auto-focus search input
  - Search functionality
  - Arrow keys to navigate
  - Enter to confirm, Escape to cancel
  - Number keys 1-9 for quick selection
  - **Estimate**: 4 hours
  - **File**: `frontend/components/annotation/ClassSelectorModal.tsx`
  - **Actual**: 4 hours

- [x] **Auto-assign last class** ✅ COMPLETED
  - Remember last selected class
  - Setting: "Auto-select last used class" in preferences
  - Implemented in Zustand store
  - **Estimate**: 1 hour
  - **Actual**: 0.5 hours

### 1.5 Image List (Left Panel) ✅

- [x] **Thumbnail grid layout** ✅ COMPLETED
  - 2-column grid with aspect ratio 3:2
  - Scrollable list with lazy loading
  - Current image highlighted (violet border + scale)
  - Image number badge (bottom-left)
  - **Estimate**: 3 hours
  - **File**: `frontend/components/annotation/ImageList.tsx`
  - **Actual**: 2 hours

- [x] **Status indicators** ✅ COMPLETED
  - ✓ icon: Completed (green badge)
  - ⚠ icon: In progress (yellow badge)
  - **Estimate**: 2 hours
  - **Actual**: 1 hour
  - **Note**: AI-assisted indicator not yet implemented

- [x] **Click to navigate** ✅ COMPLETED
  - Single click: Jump to image
  - Load image in canvas
  - Update annotations for new image
  - **Estimate**: 2 hours
  - **Actual**: 1 hour
  - **Note**: Auto-scroll not yet implemented

- [x] **Filter dropdown** ✅ COMPLETED
  - All Images / Not Started / In Progress / Completed
  - Filter thumbnails based on selection
  - Update count in header
  - **Estimate**: 2 hours
  - **Actual**: 1 hour

### 1.6 Navigation Controls ✅

- [x] **Prev/Next buttons** ✅ COMPLETED
  - Bottom bar navigation
  - Keyboard: 'A' (prev), 'D' (next)
  - Disabled at edges (first/last)
  - Auto-load annotations when navigating
  - **Estimate**: 2 hours
  - **File**: `frontend/components/annotation/BottomBar.tsx`
  - **Actual**: 2 hours

- [x] **Image counter** ✅ COMPLETED
  - Display "Image 32 of 209"
  - Update progress percentage
  - **Estimate**: 1 hour
  - **Actual**: 0.5 hours

### 1.7 State Management ✅

- [x] **Setup state structure** ✅ COMPLETED
  - Chose Zustand with DevTools
  - Define AnnotationState interface (600+ lines)
  - Current image, annotations, selected annotation
  - Tool state, canvas state (zoom, pan)
  - UI state (panels collapsed/expanded)
  - History (undo/redo)
  - Preferences
  - **Estimate**: 3 hours
  - **File**: `frontend/lib/stores/annotationStore.ts`
  - **Actual**: 5 hours

- [x] **Image loading state** ✅ COMPLETED
  - Load images from API
  - Loading indicators
  - Error handling
  - **Estimate**: 2 hours
  - **Actual**: 2 hours
  - **Note**: Preload not yet implemented

- [x] **Annotation CRUD state** ✅ COMPLETED
  - Add annotation (local + API)
  - Update annotation (local + API)
  - Delete annotation (local + API)
  - Optimistic UI updates
  - **Estimate**: 3 hours
  - **Actual**: 3 hours

### 1.8 API Integration ✅

- [x] **Fetch project images** ✅ COMPLETED
  - GET `/api/v1/projects/{projectId}/images`
  - Parse response (presigned URLs)
  - Store in state
  - **Estimate**: 1 hour
  - **Actual**: 1 hour

- [x] **Fetch existing annotations** ✅ COMPLETED
  - GET `/api/v1/annotations/project/{projectId}`
  - Load annotations for current image
  - Map to internal format
  - Auto-load on image change
  - **Estimate**: 2 hours
  - **Actual**: 2 hours

- [x] **Save annotation** ✅ COMPLETED
  - POST `/api/v1/annotations`
  - Save immediately after class selection
  - Show save status indicator
  - **Estimate**: 3 hours
  - **Actual**: 3 hours
  - **Note**: Debounced auto-save not yet implemented

- [x] **Update annotation** ✅ COMPLETED
  - PUT `/api/v1/annotations/{id}`
  - API function created
  - **Estimate**: 2 hours
  - **Actual**: 1 hour
  - **Note**: Not yet integrated with UI edit actions

- [x] **Delete annotation** ✅ COMPLETED
  - DELETE `/api/v1/annotations/{id}`
  - Confirmation modal
  - Optimistic removal
  - Works in RightPanel and BottomBar
  - **Estimate**: 1 hour
  - **Actual**: 1.5 hours

### 1.9 Basic Keyboard Shortcuts ✅

- [x] **Tool shortcuts** ✅ COMPLETED
  - 'R': Activate select tool
  - 'V': Activate bbox tool
  - 'Escape': Deselect annotation
  - **Estimate**: 1 hour
  - **File**: `frontend/lib/hooks/useKeyboardShortcuts.ts`
  - **Actual**: 1 hour

- [x] **Class shortcuts** ✅ COMPLETED
  - '1-9': Quick select class in modal
  - Visual feedback in ClassSelectorModal
  - **Estimate**: 2 hours
  - **Actual**: 1 hour (integrated into modal)

- [x] **Navigation shortcuts** ✅ COMPLETED
  - 'A': Previous image
  - 'D': Next image
  - **Estimate**: 1 hour
  - **Actual**: 0.5 hours

- [x] **Editing shortcuts** ✅ COMPLETED
  - 'Delete' / 'Backspace': Delete selected annotation
  - Confirmation required
  - **Estimate**: 1 hour
  - **Actual**: 0.5 hours

- [x] **Zoom shortcuts** ✅ COMPLETED (BONUS)
  - 'Ctrl + 0': Fit to screen
  - 'Ctrl + +/-': Zoom in/out
  - **Actual**: 0.5 hours

- [x] **Undo/Redo shortcuts** ✅ COMPLETED (BONUS)
  - 'Ctrl + Z': Undo
  - 'Ctrl + Shift + Z' / 'Ctrl + Y': Redo
  - **Actual**: 0.5 hours

### 1.10 UI Components ✅

- [x] **Top bar** ✅ COMPLETED
  - Project breadcrumb
  - Progress indicator (32/209)
  - Save status indicator
  - **Estimate**: 2 hours
  - **File**: `frontend/components/annotation/TopBar.tsx`
  - **Actual**: 2 hours
  - **Note**: Fullscreen toggle and exit button not yet implemented

- [x] **Left panel container** ✅ COMPLETED
  - Collapsible (hotkey: '[')
  - 280px width
  - Contains: Tools, Image List, Class List
  - Smooth collapse animation (300ms)
  - **Estimate**: 2 hours
  - **File**: `frontend/components/annotation/LeftPanel.tsx`
  - **Actual**: 2.5 hours

- [x] **Right panel container** ✅ COMPLETED
  - Collapsible (hotkey: ']')
  - 320px width
  - Contains: Annotations List, Metadata placeholder
  - Delete functionality
  - Smooth collapse animation (300ms)
  - **Estimate**: 2 hours
  - **File**: `frontend/components/annotation/RightPanel.tsx`
  - **Actual**: 2.5 hours

- [x] **Bottom bar** ✅ COMPLETED
  - 80px height
  - Navigation controls (Prev/Next)
  - Bulk actions (Delete All, Copy, AI Assist)
  - Progress indicator
  - **Estimate**: 2 hours
  - **File**: `frontend/components/annotation/BottomBar.tsx`
  - **Actual**: 2 hours

---

## Phase 2: Advanced Features (Week 2-3)

**Goal**: Annotation confirmation, version management, keyboard support, undo/redo
**Target Completion**: 2025-12-05
**New Priority**: Confirmation & versioning before advanced shortcuts

### 2.1 Complete Keyboard Shortcuts

- [ ] **Tier 2 shortcuts (Power Users)**
  - `Ctrl + Z`: Undo
  - `Ctrl + Shift + Z`: Redo
  - `Ctrl + S`: Force save
  - `Ctrl + D`: Duplicate selected bbox
  - `Ctrl + A`: Select all annotations
  - `Ctrl + V`: Paste from previous image
  - `Ctrl + C`: Copy selected annotation
  - `Ctrl + 0`: Fit to screen
  - `Ctrl + 1`: Zoom 100%
  - `Ctrl + Plus`: Zoom in
  - `Ctrl + Minus`: Zoom out
  - `F`: Toggle fullscreen
  - `[`: Toggle left panel
  - `]`: Toggle right panel
  - **Estimate**: 4 hours

- [ ] **Tier 3 shortcuts (Experts)**
  - `Shift + 1-9`: Assign attribute preset
  - `G`: Go to image (modal)
  - `S`: Toggle snap to edges
  - `L`: Toggle labels visibility
  - `H`: Hide selected annotation
  - `Ctrl + Shift + H`: Hide all annotations
  - `T`: Toggle dark/light mode
  - `?`: Show keyboard shortcuts help
  - Arrow keys: Move selected bbox (1px)
  - `Shift + Arrows`: Move bbox (10px)
  - `Ctrl + Arrows`: Resize bbox
  - **Estimate**: 4 hours

- [ ] **Keyboard shortcuts cheatsheet modal**
  - Trigger with '?'
  - Organized by category
  - Search/filter shortcuts
  - "Show More" expansion
  - **Estimate**: 3 hours

### 2.2 Undo/Redo System

- [ ] **Snapshot architecture**
  - Record state before each change
  - Stack limit: 50 snapshots
  - Store: timestamp, annotations, action, affectedIds
  - **Estimate**: 3 hours

- [ ] **Undo implementation**
  - `Ctrl + Z` to undo
  - Restore previous state
  - Update canvas and lists
  - Auto-save restored state
  - **Estimate**: 2 hours

- [ ] **Redo implementation**
  - `Ctrl + Shift + Z` to redo
  - Clear redo stack on new action
  - Visual indicator of undo/redo availability
  - **Estimate**: 2 hours

### 2.3 Annotations List (Right Panel)

- [ ] **List all annotations**
  - Display all bboxes on current image
  - Show: class, size, confidence (if AI)
  - Click to select on canvas
  - **Estimate**: 3 hours
  - **File**: `frontend/components/annotation/AnnotationsList.tsx`

- [ ] **Visibility toggle**
  - Eye icon per annotation
  - Hide/show on canvas
  - Useful for overlapping bboxes
  - **Estimate**: 1 hour

- [ ] **Delete from list**
  - Delete icon per annotation
  - Confirmation modal
  - Remove from canvas
  - **Estimate**: 1 hour

- [ ] **Sort & filter**
  - Sort by: Class, Size, Confidence, Time
  - Filter by class (dropdown)
  - Auto-scroll to selected
  - **Estimate**: 2 hours

- [ ] **Bulk actions**
  - "Clear All" button
  - "Hide All" / "Show All"
  - Export annotations (JSON)
  - **Estimate**: 2 hours

### 2.4 Attributes Panel

- [ ] **Conditional display**
  - Only show when project.task_config.enable_attributes = true
  - Show when annotation selected
  - **Estimate**: 1 hour

- [ ] **Attribute input types**
  - Boolean (checkbox)
  - Radio (single choice)
  - Dropdown (many options)
  - Multi-select (checkboxes)
  - Number (slider/input)
  - Text (short input)
  - Rating (1-5 stars)
  - **Estimate**: 4 hours
  - **File**: `frontend/components/annotation/AttributesPanel.tsx`

- [ ] **Auto-apply attributes**
  - "Use as default" checkbox
  - Apply to all new annotations
  - Useful for batch labeling
  - **Estimate**: 2 hours

### 2.5 Minimap

- [ ] **Minimap component**
  - Bottom-right corner of canvas
  - Size: 150x150px
  - Full image thumbnail
  - Viewport indicator (semi-transparent rect)
  - **Estimate**: 3 hours

- [ ] **Click to jump**
  - Click minimap to pan to location
  - Drag viewport indicator to pan
  - **Estimate**: 1 hour

### 2.6 Smart Features

- [ ] **Snap to edges**
  - When dragging near image edge (< 10px)
  - Bbox edge snaps to boundary
  - Visual feedback (yellow edge)
  - Disable with Shift key
  - Toggle with 'S' key
  - **Estimate**: 2 hours

- [ ] **Copy last bbox**
  - `Ctrl + D` to duplicate
  - Creates bbox at offset position (+20px x, +20px y)
  - Same class and attributes
  - **Estimate**: 1 hour

- [ ] **Copy from previous image**
  - `Ctrl + V` to paste
  - Duplicates all annotations from image N-1
  - Useful for video frames
  - **Estimate**: 2 hours

- [ ] **Auto-suggest class (basic)**
  - If multiple bboxes exist, suggest most common class
  - Show in floating selector
  - **Estimate**: 2 hours

### 2.7 Image & Annotation Confirmation ⭐ NEW

**Goal**: Track image status accurately, enable annotation confirmation
**Design Doc**: `docs/design/ANNOTATION_STATE_VERSION_DESIGN.md`
**Status**: 12/13 tasks complete ✅ Feature complete! (Only testing remains)

- [x] **Database migrations** ✅ COMPLETED
  - Create `image_annotation_status` table
  - Add `annotation_state` column to `annotations` table
  - Add `confirmed_at`, `confirmed_by` columns to `annotations`
  - Create indexes for performance
  - Data migration for existing annotations
  - **Estimate**: 2 hours
  - **Actual**: 2 hours
  - **Files**:
    - `backend/alembic/versions/20251114_1600_add_annotation_confirmation.py`
    - `backend/alembic/versions/20251114_1601_migrate_existing_data.py`
    - `backend/app/db/models/labeler.py`

- [x] **Backend API: Annotation confirmation** ✅ COMPLETED
  - `POST /api/v1/annotations/{annotationId}/confirm`
  - `POST /api/v1/annotations/{annotationId}/unconfirm`
  - `POST /api/v1/annotations/bulk-confirm`
  - Update annotation state: draft → confirmed
  - Record confirmed_at timestamp and confirmed_by user
  - History tracking for confirmation actions
  - **Estimate**: 2 hours
  - **Actual**: 2 hours
  - **File**: `backend/app/api/v1/endpoints/annotations.py:575-748`
  - **Schemas**: `backend/app/schemas/annotation.py`

- [x] **Backend API: Image status management** ✅ COMPLETED
  - `GET /api/v1/projects/{projectId}/images/status`
  - `POST /api/v1/projects/{projectId}/images/{imageId}/confirm`
  - `POST /api/v1/projects/{projectId}/images/{imageId}/unconfirm`
  - Calculate status: not-started / in-progress / completed
  - Update annotation counts (total, confirmed, draft)
  - Track first_modified_at, last_modified_at, confirmed_at
  - **Estimate**: 3 hours
  - **Actual**: 3 hours
  - **File**: `backend/app/api/v1/endpoints/projects.py:295-503`
  - **Schemas**: `backend/app/schemas/image.py`

- [x] **Backend: Image status tracking logic** ✅ COMPLETED
  - Auto-update `image_annotation_status` on annotation changes
  - Service layer implementation
  - Status transition rules (see design doc section 4.1)
  - Integrated with all annotation CRUD endpoints
  - **Estimate**: 2 hours
  - **Actual**: 2 hours
  - **Files**:
    - `backend/app/services/image_status_service.py` (new service)
    - `backend/app/api/v1/endpoints/annotations.py` (integrated)
    - `backend/app/api/v1/endpoints/projects.py` (integrated)

- [x] **Frontend: Individual annotation confirm toggle** ✅ COMPLETED
  - Add [✓] button to each annotation in RightPanel
  - Toggle annotation state: draft ↔ confirmed
  - Visual indicator (checkmark icon, green/gray color)
  - API integration (confirmAnnotation/unconfirmAnnotation)
  - Loading state with spinner
  - Draft/Confirmed label display
  - **Estimate**: 2 hours
  - **Actual**: 1.5 hours
  - **File**: `frontend/components/annotation/RightPanel.tsx`

- [x] **Frontend: Bulk confirm annotations** ✅ COMPLETED
  - "Confirm All (N draft)" button in RightPanel
  - Confirm all draft annotations on current image
  - Show confirmation dialog with count
  - API integration (bulkConfirmAnnotations)
  - Disabled when no draft annotations
  - Loading state with spinner
  - **Estimate**: 1 hour
  - **Actual**: 1 hour
  - **File**: `frontend/components/annotation/RightPanel.tsx`

- [x] **Frontend: Confirm Image button** ✅ COMPLETED
  - Add button to Canvas bottom controls
  - Keyboard shortcut: `Ctrl + Enter`
  - Confirms all draft annotations + marks image as completed
  - Auto-navigate to next not-started image
  - Loading state with spinner
  - Dynamic button text based on draft count
  - Shows "Image Confirmed" badge when already confirmed
  - **Estimate**: 2 hours
  - **Actual**: 2 hours
  - **File**: `frontend/components/annotation/Canvas.tsx`

- [x] **Frontend: Enhanced image status badges** ✅ COMPLETED
  - ✓ Completed badge (green with ring)
  - ⚠ In Progress badge (yellow with clock icon)
  - ⚪ Not Started badge (gray with dot)
  - Enhanced visual design with shadows and rings
  - Better icons (checkmark, clock, dot)
  - Larger size (5x5) for better visibility
  - **Estimate**: 1 hour
  - **Actual**: 0.5 hours
  - **File**: `frontend/components/annotation/ImageList.tsx`

- [x] **Frontend: Image status icons in ImageList** ✅ COMPLETED
  - Simple icons for not-started / in-progress / completed
  - Display in both thumbnail view and table view
  - Icon placement: top-right corner (thumbnail), column (table)
  - Icons: ⚪ (not-started), 🔄 (in-progress), ✓ (completed)
  - **Estimate**: 1 hour
  - **Actual**: 1 hour
  - **File**: `frontend/components/annotation/ImageList.tsx:38-60`

- [x] **Frontend: Fix image filter by status** ✅ COMPLETED
  - Update `getImageStatus()` function
  - Use actual image_annotation_status from API
  - Filter works correctly: not-started / in-progress / completed
  - Load image statuses on project initialization
  - **Estimate**: 2 hours
  - **Actual**: 2 hours
  - **Files**:
    - `frontend/components/annotation/ImageList.tsx:26-37`
    - `frontend/app/annotate/[projectId]/page.tsx:95-114`
    - `frontend/lib/api/projects.ts` (added getProjectImageStatuses)

- [x] **Frontend: Annotation History panel** ✅ COMPLETED
  - Add panel above ImageList in LeftPanel
  - Collapsible section with header
  - Table display: Date, Action, User, Annotations count
  - Shows recent annotation changes/versions
  - Fetch real data from API with loading state
  - **Estimate**: 3 hours
  - **Actual**: 3 hours
  - **File**: `frontend/components/annotation/AnnotationHistory.tsx`

- [x] **Frontend: History panel integration** ✅ COMPLETED
  - Fetch annotation history from API
  - Display in LeftPanel above ImageList
  - Collapsible toggle
  - Scroll independently from ImageList
  - **Estimate**: 1 hour
  - **Actual**: 1 hour
  - **File**: `frontend/components/annotation/LeftPanel.tsx`

- [x] **Frontend: Annotation state in store** ✅ COMPLETED
  - Add is_confirmed, status, confirmed_at to ImageData interface
  - Update API client with confirmation functions
  - Handle confirm/unconfirm in annotation schemas
  - **Estimate**: 1 hour
  - **Actual**: 1 hour
  - **Files**:
    - `frontend/lib/stores/annotationStore.ts:33-37`
    - `frontend/lib/api/annotations.ts:65-70, 185-232`
    - `frontend/lib/api/projects.ts:89-137`

- [ ] **Data migration: Existing annotations**
  - Migrate existing annotations to 'confirmed' state
  - Calculate image_annotation_status for existing data
  - **Estimate**: 1 hour

- [ ] **Testing: Confirmation flow**
  - Test annotation confirm/unconfirm
  - Test image status transitions
  - Test filter by status
  - Edge cases: delete all annotations after confirm
  - **Estimate**: 2 hours

**Subtotal**: 21 hours

### 2.8 Version Management Foundation ⭐ NEW

**Goal**: Basic version management for annotation export
**Design Doc**: `docs/design/ANNOTATION_STATE_VERSION_DESIGN.md`, `docs/design/DATA_MANAGEMENT_STRATEGY.md`
**Status**: 12/15 tasks complete (80%) ✅ Backend Complete with DICE!

- [x] **Database migrations** ✅ COMPLETED
  - Create `annotation_versions` table
  - Create `annotation_snapshots` table
  - **Estimate**: 1 hour
  - **Actual**: 1 hour
  - **File**: `backend/alembic/versions/20251116_1000_add_version_management.py`
  - **Models**: `backend/app/db/models/labeler.py:252-306`

- [x] **Backend: COCO export service** ✅ COMPLETED
  - Convert DB annotations to COCO format
  - Handle images, annotations, categories
  - **Estimate**: 3 hours
  - **Actual**: 2 hours
  - **File**: `backend/app/services/coco_export_service.py`

- [x] **Backend: YOLO export service** ✅ COMPLETED
  - Convert DB annotations to YOLO format
  - Generate .txt files per image
  - classes.txt file
  - **Estimate**: 2 hours
  - **Actual**: 1.5 hours
  - **File**: `backend/app/services/yolo_export_service.py`

- [x] **Backend: Export API (current S3 direct)** ✅ COMPLETED
  - `POST /api/v1/projects/{projectId}/export`
  - Generate export file (COCO/YOLO)
  - Upload to S3 directly (temporary, until platform API ready)
  - Return presigned download URL
  - **Estimate**: 3 hours
  - **Actual**: 2 hours
  - **File**: `backend/app/api/v1/endpoints/export.py:29-186`

- [x] **Backend: Version creation API** ✅ COMPLETED
  - `POST /api/v1/projects/{projectId}/versions/publish`
  - Create version record in DB
  - Trigger export
  - Store export metadata
  - Create annotation snapshots
  - **Estimate**: 2 hours
  - **Actual**: 2 hours
  - **File**: `backend/app/api/v1/endpoints/export.py:191-370`

- [x] **Backend: Version list API** ✅ COMPLETED
  - `GET /api/v1/projects/{projectId}/versions`
  - List all published versions
  - Include download URLs (regenerate if expired)
  - **Estimate**: 1 hour
  - **Actual**: 1 hour
  - **File**: `backend/app/api/v1/endpoints/export.py:373-450`

- [x] **Backend: Presigned URL regeneration** ✅ COMPLETED
  - Check if download_url expired
  - Generate new presigned URL
  - Update DB
  - **Estimate**: 1 hour
  - **Actual**: 0.5 hours (integrated into version list)
  - **File**: `backend/app/core/storage.py:302-331`

- [x] **Backend: Storage client extensions** ✅ COMPLETED
  - Upload export files to S3
  - Generate presigned URLs for exports
  - Update Platform S3 annotations
  - **Actual**: 1 hour
  - **File**: `backend/app/core/storage.py:243-376`

- [x] **Backend: DICE export service** ✅ COMPLETED
  - Convert DB annotations to DICE format
  - Handle images, annotations, classes, metadata
  - Calculate statistics
  - **Actual**: 2 hours
  - **File**: `backend/app/services/dice_export_service.py`

- [x] **Backend: DICE format in export API** ✅ COMPLETED
  - Add DICE to export endpoint
  - Support dice/coco/yolo formats
  - **Actual**: 0.5 hours
  - **File**: `backend/app/api/v1/endpoints/export.py:126-153`

- [x] **Backend: DICE in version publish** ✅ COMPLETED
  - Always generate DICE format
  - Optionally generate COCO/YOLO
  - Upload DICE to Platform S3
  - **Actual**: 1 hour
  - **File**: `backend/app/api/v1/endpoints/export.py:311-416`

- [x] **Backend: Platform S3 sync** ✅ COMPLETED
  - Update datasets/{id}/annotations.json on publish
  - Store version metadata
  - **Actual**: 0.5 hours
  - **File**: `backend/app/core/storage.py:333-376`

- [ ] **Frontend: Export button**
  - Add "Export" button to project page or TopBar
  - Modal with format selection (COCO / YOLO)
  - Trigger export API
  - Show download link
  - **Estimate**: 2 hours
  - **File**: `frontend/components/annotation/ExportModal.tsx`

- [ ] **Frontend: Version history UI**
  - List published versions
  - Show: version number, date, annotation count, format
  - Download button per version
  - **Estimate**: 3 hours
  - **File**: `frontend/components/project/VersionHistory.tsx`

- [ ] **Documentation: Export formats**
  - COCO format specification
  - YOLO format specification
  - Export workflow guide
  - **Estimate**: 1 hour

- [ ] **Testing: Export & versioning**
  - Test DICE export correctness
  - Test COCO export correctness
  - Test YOLO export correctness
  - Test version creation
  - Test download URL expiration
  - Test Platform S3 sync
  - **Estimate**: 3 hours

**Subtotal**: 25 hours (15h backend complete, 6h frontend/docs/testing remaining)

**Note**: Phase 2.8 uses S3 direct access temporarily. Will migrate to Platform API in Phase 4 when available.
**Migration Plan**: See `docs/design/PRODUCTION_STORAGE_STRATEGY.md`

### 2.9 Settings Panel

- [ ] **Settings UI**
  - Bottom of left panel
  - Toggle switches
  - **Estimate**: 2 hours

- [ ] **Settings options**
  - Show labels (on/off)
  - Show grid (on/off)
  - Snap to edges (on/off)
  - Auto-select last class (on/off)
  - Dark mode (on/off)
  - **Estimate**: 2 hours

- [ ] **Persist settings**
  - Save to localStorage
  - Load on mount
  - **Estimate**: 1 hour

---

## Phase 3: Multi-Task Annotation Tools (Weeks 7-8) ⭐ NEW

**Goal**: Implement annotation tools for Classification, Segmentation, and extensible tool system
**Target Completion**: 2025-12-06
**Status**: ⏸️ Pending
**Priority**: High - Core feature expansion

### 3.1 Tool Architecture & Registry

- [ ] **Abstract annotation tool interface**
  - Define AnnotationTool interface
  - Methods: renderAnnotation, renderPreview, renderHandles
  - Event handlers: onMouseDown/Move/Up, onKeyDown
  - Validation: validate, getGeometry, fromGeometry
  - Serialization: toJSON, fromJSON
  - **Estimate**: 4 hours
  - **File**: `frontend/lib/annotation/AnnotationTool.ts`

- [ ] **Tool registry system**
  - Register tools by annotation type (bbox, polygon, classification, etc.)
  - Factory pattern for tool creation
  - Tool configuration from project.task_config
  - Hot-swap tools without page reload
  - **Estimate**: 3 hours
  - **File**: `frontend/lib/annotation/ToolRegistry.ts`

- [ ] **Refactor existing BBox tool**
  - Extract to separate tool class implementing interface
  - Move drawing/editing logic from Canvas.tsx
  - Support tool-specific keyboard shortcuts
  - **Estimate**: 3 hours
  - **File**: `frontend/lib/annotation/tools/BBoxTool.ts`

### 3.2 Classification Tool

- [ ] **Classification annotation type**
  - Image-level labels (no geometry)
  - Single-label mode: Radio buttons
  - Multi-label mode: Checkboxes
  - Store as annotation with type='classification'
  - **Estimate**: 4 hours
  - **File**: `frontend/lib/annotation/tools/ClassificationTool.ts`

- [ ] **Classification UI panel**
  - Dedicated panel in RightPanel when classification task active
  - Display all available classes with colors
  - Show current selection state
  - Quick keyboard shortcuts (1-9)
  - **Estimate**: 3 hours
  - **File**: `frontend/components/annotation/ClassificationPanel.tsx`

- [ ] **Classification state management**
  - Store classification annotations in annotationStore
  - Support multiple labels per image (multi-label mode)
  - Sync with backend API
  - **Estimate**: 2 hours

- [ ] **Classification keyboard shortcuts**
  - '1-9': Quick select class
  - 'C': Toggle classification mode
  - 'Space': Confirm and next image
  - **Estimate**: 1 hour

### 3.3 Polygon/Segmentation Tool

- [ ] **Polygon drawing**
  - Click to add vertices
  - Show preview line from last vertex to cursor
  - Double-click or click near first vertex to close
  - Minimum 3 vertices validation
  - Cancel with Escape key
  - **Estimate**: 5 hours
  - **File**: `frontend/lib/annotation/tools/PolygonTool.ts`

- [ ] **Polygon editing**
  - Click vertex to select (show as larger circle)
  - Drag vertex to move
  - Double-click edge to add vertex
  - Delete key to remove selected vertex
  - Drag inside polygon to move entire shape
  - **Estimate**: 5 hours

- [ ] **Polygon rendering**
  - Fill with semi-transparent class color (opacity 0.3)
  - Stroke outline (2px)
  - Render vertices as circles (6px radius)
  - Selected state: Thicker stroke (3px), larger vertices
  - Hover state: Highlight nearest vertex/edge
  - **Estimate**: 3 hours

- [ ] **Polygon to mask conversion (optional)**
  - Convert polygon to binary mask
  - Support for export formats requiring masks
  - **Estimate**: 2 hours

### 3.4 Rotated Bounding Box Tool

- [ ] **Rotated bbox drawing**
  - Draw initial bbox with drag
  - Rotation handle at top center
  - Rotate by dragging handle
  - Display rotation angle in tooltip
  - **Estimate**: 4 hours
  - **File**: `frontend/lib/annotation/tools/RotatedBBoxTool.ts`

- [ ] **Rotated bbox editing**
  - 8 resize handles (corners + midpoints)
  - Rotation handle with angle snap (shift for 15° increments)
  - Keyboard rotation: R/Shift+R for ±5°
  - **Estimate**: 3 hours

- [ ] **Rotated bbox rendering**
  - Apply CSS transform for rotation
  - Render rotation angle badge
  - Handle coordinate system for rotated boxes
  - **Estimate**: 2 hours

### 3.5 Keypoints Tool (Basic)

- [ ] **Keypoint skeleton definition**
  - Load skeleton from task_config (e.g., COCO-17)
  - Define keypoint names and connections
  - Support custom skeleton definitions
  - **Estimate**: 2 hours

- [ ] **Keypoint placement**
  - Click to place each keypoint in sequence
  - Show next expected keypoint name
  - Skip with 'S' key for occluded points
  - Show skeleton overlay during placement
  - **Estimate**: 4 hours
  - **File**: `frontend/lib/annotation/tools/KeypointsTool.ts`

- [ ] **Keypoint visibility states**
  - 0: Not labeled (gray)
  - 1: Labeled but occluded (yellow)
  - 2: Labeled and visible (green)
  - Click to cycle through states
  - **Estimate**: 2 hours

- [ ] **Keypoints rendering**
  - Draw circles at keypoint positions (radius based on state)
  - Draw skeleton connections (lines between keypoints)
  - Color-code by visibility state
  - Labels on hover
  - **Estimate**: 3 hours

### 3.6 Text/Caption Tool (VLM Support)

- [ ] **Object-level text annotation**
  - Attach text labels to existing annotations (bbox, polygon, etc.)
  - Text fields appear when annotation is selected
  - Support multiple text fields per object (name, description, attributes)
  - Store text in annotation.attributes or dedicated text field
  - **Estimate**: 4 hours
  - **File**: `frontend/lib/annotation/tools/TextTool.ts`

- [ ] **Image-level text annotation**
  - Global caption/description for entire image
  - Store as separate annotation with type='text' (no geometry)
  - Support multiple image-level fields
  - **Estimate**: 2 hours

- [ ] **Text input UI panel**
  - Inline text fields in RightPanel annotation card
  - Expandable text area for long descriptions
  - Multiple text fields based on task_config
  - Character/word count display
  - Auto-save on blur
  - **Estimate**: 3 hours
  - **File**: `frontend/components/annotation/TextPanel.tsx`

- [ ] **Text field configuration**
  - Define fields in task_config (e.g., caption, alt_text, description)
  - Field types: single-line, multi-line, structured (QA)
  - Object-level vs image-level field designation
  - Validation rules (min/max length, required)
  - **Estimate**: 2 hours

- [ ] **VLM export format**
  - JSON Lines format for VLM training
  - Support region-text pairs (bbox + description)
  - Support image-text pairs
  - Support conversation format (QA)
  - **Estimate**: 2 hours

### 3.7 Tool Panel & Toolbar Updates

- [ ] **Dynamic tool panel**
  - Show available tools based on current task type
  - Detection: BBox, Rotated BBox
  - Segmentation: Polygon, BBox
  - Classification: (no drawing tools)
  - Keypoints: Keypoint tool
  - Text/Caption: (no drawing tools)
  - **Estimate**: 2 hours

- [ ] **Tool-specific cursors**
  - Crosshair for BBox/Polygon
  - Custom cursor for keypoints (numbered)
  - Default cursor for classification/text
  - **Estimate**: 1 hour

- [ ] **Tool keyboard shortcuts**
  - 'V': BBox tool
  - 'P': Polygon tool
  - 'K': Keypoints tool
  - 'O': Rotated BBox
  - 'T': Text tool
  - 'R': Select tool (existing)
  - **Estimate**: 1 hour

### 3.8 Backend Support

- [ ] **Annotation type validation**
  - Validate geometry based on annotation_type
  - BBox: [x, y, width, height]
  - Rotated BBox: [x, y, width, height, angle]
  - Polygon: [[x1,y1], [x2,y2], ...]
  - Classification: null (image-level)
  - Keypoints: [[x1,y1,v1], [x2,y2,v2], ...]
  - Text: {field_name: text_value, ...}
  - **Estimate**: 2 hours
  - **File**: `backend/app/schemas/annotation.py`

- [ ] **Export format support**
  - COCO polygon format (segmentation)
  - COCO keypoints format
  - YOLO segmentation format
  - JSON Lines for VLM (image-text pairs)
  - Update DICE export for new types
  - **Estimate**: 4 hours

### 3.9 Testing & Documentation

- [ ] **Tool integration tests**
  - Test each tool's drawing/editing
  - Test tool switching
  - Test keyboard shortcuts
  - **Estimate**: 3 hours

- [ ] **Tool documentation**
  - Usage guide for each tool
  - Keyboard shortcuts reference
  - Export format specifications
  - **Estimate**: 2 hours

**Subtotal**: ~78 hours

---

## Phase 4: AI Integration (Weeks 9-10)

**Goal**: AI-assisted annotation with model predictions + VLM text generation
**Target Completion**: 2025-12-20
**Status**: ⏸️ Pending

### 4.1 AI Assist Button

- [ ] **UI button in bottom bar**
  - Icon: 🤖
  - Text: "AI Assist"
  - Disabled when no model available
  - **Estimate**: 1 hour

- [ ] **AI Assist modal**
  - Model selection dropdown
  - Confidence threshold slider (0-100%)
  - Options: Review each / Auto-accept high confidence
  - Run button
  - **Estimate**: 3 hours

### 4.2 Model Inference

- [ ] **Backend endpoint**
  - POST `/api/v1/annotations/ai-assist`
  - Request: project_id, image_id, model_id, confidence_threshold
  - Response: List of predicted bboxes/polygons
  - **Estimate**: 4 hours
  - **File**: `backend/app/api/v1/endpoints/ai_assist.py`

- [ ] **Model integration**
  - Load YOLOv8 model (detection/segmentation)
  - Run inference on image
  - Filter by confidence threshold
  - Return predictions in standard format
  - **Estimate**: 4 hours

### 4.3 Predictions Rendering

- [ ] **Render predictions on canvas**
  - Dashed border (distinguishes from user annotations)
  - Different color (orange)
  - Confidence badge (e.g., "92%")
  - z-index: 2.5 (between annotations and selected)
  - **Estimate**: 2 hours

- [ ] **Prediction list (Right panel)**
  - Separate section: "AI Predictions (5)"
  - Same format as annotations list
  - Show confidence score
  - **Estimate**: 2 hours

### 4.4 Review & Accept/Reject

- [ ] **Accept prediction**
  - Click ✓ or press Space
  - Converts to solid annotation
  - POST to backend
  - Marked as AI-assisted
  - **Estimate**: 2 hours

- [ ] **Reject prediction**
  - Click ✗ or press X
  - Removes from canvas
  - No API call
  - **Estimate**: 1 hour

- [ ] **Edit prediction**
  - Drag handles to adjust
  - Automatically converts to solid annotation
  - Save to backend
  - **Estimate**: 2 hours

- [ ] **Batch accept**
  - `Ctrl + Shift + A` to accept all
  - Confirmation modal
  - Bulk POST to backend
  - **Estimate**: 2 hours

### 4.5 AI Confidence Scores

- [ ] **Display confidence in annotations list**
  - Show "Conf: 95%" for AI-assisted annotations
  - Sort by confidence
  - **Estimate**: 1 hour

- [ ] **Visual confidence indicator**
  - Color-coded border opacity
  - High (>90%): Solid
  - Medium (70-90%): Semi-transparent
  - Low (<70%): Dashed
  - **Estimate**: 2 hours

### 4.6 AI Text Generation (VLM)

- [ ] **VLM integration backend**
  - POST `/api/v1/annotations/ai-caption`
  - Support multiple VLM models (GPT-4V, LLaVA, etc.)
  - Request: image_id, annotation_id (optional), prompt_template
  - Response: generated text
  - **Estimate**: 4 hours
  - **File**: `backend/app/api/v1/endpoints/ai_assist.py`

- [ ] **Image-level caption generation**
  - Generate caption for entire image
  - Customizable prompt templates
  - Multiple caption styles (brief, detailed, technical)
  - **Estimate**: 2 hours

- [ ] **Object-level description generation**
  - Generate description for selected bbox/polygon region
  - Crop region and send to VLM
  - Context-aware prompts (include surrounding context)
  - **Estimate**: 3 hours

- [ ] **Batch text generation**
  - Generate captions for multiple images
  - Generate descriptions for all objects in image
  - Progress indicator and cancel support
  - **Estimate**: 2 hours

- [ ] **Text generation UI**
  - "Generate" button in TextPanel
  - Model selection dropdown
  - Prompt template selection
  - Edit generated text before saving
  - **Estimate**: 3 hours

- [ ] **Text review workflow**
  - Mark generated text as "AI-generated"
  - Review and approve/edit workflow
  - Confidence score for generated text
  - **Estimate**: 2 hours

**Subtotal**: ~42 hours

---

## Phase 5: Polish & Optimization (Week 11)

**Goal**: Performance, error handling, user experience
**Target Completion**: 2025-01-04
**Status**: ⏸️ Pending

### 5.1 Performance Optimization

- [ ] **Canvas rendering optimization**
  - Viewport culling (only render visible annotations)
  - RAF batching (60fps max)
  - Layer separation (static image + dynamic annotations)
  - Debounced redraw during pan/zoom
  - **Estimate**: 4 hours

- [ ] **React optimization**
  - React.memo for expensive components
  - useMemo for computed values
  - useCallback for event handlers
  - Virtualized lists (react-window)
  - **Estimate**: 3 hours

- [ ] **Image preloading**
  - Preload next 3 images in background
  - Use Intersection Observer for thumbnails
  - Cache in browser
  - **Estimate**: 2 hours

- [ ] **Lazy loading**
  - Virtualize image list (only render visible thumbnails)
  - Load ±20 images buffer
  - **Estimate**: 2 hours

### 5.2 Error Handling

- [ ] **Network error handling**
  - Retry with exponential backoff
  - Show error toast
  - Revert optimistic updates
  - **Estimate**: 2 hours

- [ ] **Validation errors**
  - Bbox too small
  - Bbox outside image bounds
  - No class selected
  - **Estimate**: 2 hours

- [ ] **Conflict resolution**
  - Detect concurrent edits
  - Show conflict modal
  - Options: Keep local / Use server / Merge
  - **Estimate**: 3 hours

- [ ] **Error boundaries**
  - Catch component errors
  - Show fallback UI
  - Report to error tracking
  - **Estimate**: 2 hours

### 5.3 Loading States

- [ ] **Loading indicators**
  - Image loading spinner
  - Annotations loading skeleton
  - Save status (Saved / Saving / Error)
  - **Estimate**: 2 hours

- [ ] **Skeleton screens**
  - Left panel skeleton
  - Right panel skeleton
  - Canvas placeholder
  - **Estimate**: 2 hours

### 5.4 Confirmation Modals

- [ ] **Delete annotation confirmation**
  - "Are you sure?"
  - Keyboard: Enter (confirm) / Escape (cancel)
  - **Estimate**: 1 hour

- [ ] **Clear all confirmation**
  - "Delete all N annotations?"
  - Show count
  - **Estimate**: 1 hour

- [ ] **Navigate with unsaved changes**
  - "You have unsaved changes. Continue?"
  - Options: Save & Continue / Discard / Cancel
  - **Estimate**: 2 hours

### 5.5 Onboarding & Help

- [ ] **First-time tutorial**
  - Overlay guide on first visit
  - Highlight key features
  - Skip button
  - **Estimate**: 4 hours

- [ ] **Tooltips**
  - Hover tooltips on all buttons
  - Keyboard shortcut hints
  - **Estimate**: 2 hours

- [ ] **Help modal**
  - Accessible via '?' or help button
  - Keyboard shortcuts reference
  - Feature guide
  - **Estimate**: 2 hours

### 5.6 User Testing & Feedback

- [ ] **Internal testing**
  - Test with 100+ images
  - Measure annotation speed
  - Identify pain points
  - **Estimate**: 4 hours

- [ ] **Feedback collection**
  - In-app feedback button
  - Collect user satisfaction rating
  - Bug reporting
  - **Estimate**: 2 hours

- [ ] **Analytics integration**
  - Track annotation speed
  - Track tool usage
  - Track error rates
  - **Estimate**: 2 hours

**Subtotal**: ~40 hours

---

## Testing & Quality Assurance

### Unit Tests

- [ ] **Canvas component tests**
  - Zoom/pan behavior
  - Rendering annotations
  - **Estimate**: 3 hours

- [ ] **Tool tests**
  - Bbox drawing logic
  - Polygon validation
  - Classification selection
  - **Estimate**: 4 hours

- [ ] **State management tests**
  - Annotation CRUD
  - Undo/redo stack
  - **Estimate**: 3 hours

### Integration Tests

- [ ] **API integration tests**
  - Save annotation flow
  - Load annotations flow
  - AI assist flow
  - **Estimate**: 4 hours

- [ ] **Keyboard shortcuts tests**
  - All tier 1-3 shortcuts
  - No conflicts
  - **Estimate**: 2 hours

### E2E Tests

- [ ] **Complete annotation workflow**
  - Login → Select dataset → Annotate → Save → Export
  - **Estimate**: 4 hours

- [ ] **Multi-user scenario**
  - Concurrent editing
  - Conflict resolution
  - **Estimate**: 3 hours

---

## Documentation

- [ ] **Component documentation**
  - JSDoc comments for all components
  - Props documentation
  - Usage examples
  - **Estimate**: 4 hours

- [ ] **User guide**
  - How to annotate
  - Keyboard shortcuts reference
  - Tips & tricks
  - **Estimate**: 4 hours

- [ ] **Developer guide**
  - Architecture overview
  - Adding new annotation tools
  - State management guide
  - **Estimate**: 4 hours

---

## Deployment

- [ ] **Production build optimization**
  - Code splitting
  - Tree shaking
  - Image optimization
  - **Estimate**: 2 hours

- [ ] **Environment configuration**
  - Production API URLs
  - Error tracking (Sentry)
  - Analytics (Google Analytics)
  - **Estimate**: 2 hours

- [ ] **Staging deployment**
  - Deploy to staging environment
  - Smoke tests
  - **Estimate**: 2 hours

- [ ] **Production deployment**
  - Deploy to production
  - Monitor for errors
  - Rollback plan
  - **Estimate**: 2 hours

---

## Summary

### Total Estimated Hours

| Phase | Tasks | Hours | Status |
|-------|-------|-------|--------|
| Phase 1: Core Canvas | 45 tasks | 90 hours | ✅ Complete |
| Phase 2: Advanced Features | 69 tasks | 138 hours | 🔄 85% Complete |
|   - 2.7 Confirmation | 13 tasks | 21 hours | ✅ Complete |
|   - 2.8 Version Mgmt | 15 tasks | 25 hours | ✅ Complete |
|   - 2.9 Task Architecture | 15 tasks | 25 hours | ✅ Complete |
|   - 2.10 Dataset Mgmt | 20 tasks | 62 hours | 🔄 In Progress |
| Phase 3: Multi-Task Tools | 29 tasks | 78 hours | ⏸️ Pending |
| Phase 4: AI Integration | 22 tasks | 42 hours | ⏸️ Pending |
| Phase 5: Polish & Optimization | 20 tasks | 40 hours | ⏸️ Pending |
| Testing | 8 tasks | 23 hours | ⏸️ Pending |
| Documentation | 3 tasks | 12 hours | ⏸️ Pending |
| Deployment | 4 tasks | 8 hours | ⏸️ Pending |
| **TOTAL** | **~210 tasks** | **~490 hours** | |

### Timeline

- **Week 1** (Nov 14-21): Phase 1 (90h) ✅ Complete
- **Week 2-6** (Nov 22-Nov 30): Phase 2 (138h) 🔄 In Progress
  - 2.7 Confirmation ✅ Complete
  - 2.8 Version Mgmt ✅ Complete
  - 2.9 Task Architecture ✅ Complete
  - 2.10 Dataset Mgmt 🔄 In Progress
- **Week 7-8** (Dec 1-14): Phase 3 - Multi-Task Tools (78h) ⭐ NEXT
  - Classification Tool
  - Polygon/Segmentation Tool
  - Rotated BBox Tool
  - Keypoints Tool (Basic)
  - Text/Caption Tool (VLM)
- **Week 9-10** (Dec 15-28): Phase 4 - AI Integration (42h)
  - Detection/Segmentation AI Assist
  - VLM Text Generation
- **Week 11** (Dec 29-Jan 4): Phase 5 - Polish & Optimization (40h)
- **Week 12-13** (Jan 5-17): Testing (23h) + Docs (12h) + Deployment (8h)

### Success Metrics

By end of Phase 5, we should achieve:

- ✅ **Time per annotation**: < 10 seconds (bbox)
- ✅ **Clicks to complete**: ≤ 2 clicks
- ✅ **Keyboard coverage**: 80%+ actions
- ✅ **60fps canvas rendering**
- ✅ **< 2s image load time**
- ✅ **User satisfaction**: > 4.5/5

---

## Notes

### Priority Labels

- 🔴 **P0 (Critical)**: Must have for MVP
- 🟡 **P1 (High)**: Important for good UX
- 🟢 **P2 (Medium)**: Nice to have
- 🔵 **P3 (Low)**: Future enhancement

### Dependencies

- **Phase 2** depends on Phase 1 completion ✅
- **Phase 2.7-2.8** (Confirmation & Version) are **P0** for production ✅
- **Phase 3** (Multi-Task Tools) depends on Phase 2.9 (Task Architecture) ✅
- **Phase 4** (AI Integration) can run parallel to Phase 3
- **Phase 5** (Polish) depends on Phases 1-4

### Risk Mitigation

1. **Performance issues**: Profile early, optimize incrementally
2. **Scope creep**: Stick to P0/P1 tasks for MVP
3. **AI integration delays**: Phase 4 is optional for initial launch
4. **Browser compatibility**: Test on Chrome, Edge, Firefox regularly
5. **Tool complexity**: Start with simple tools (Classification), then add complex ones (Polygon)

### Storage Strategy ⭐ NEW

**Current Approach** (Development):
- S3 direct access with IAM credentials
- Presigned URLs for image loading
- Direct file upload for exports

**Production Migration Plan**:
- **Phase 2**: Continue with S3 direct access (temporary)
- **Phase 4**: Migrate to Platform Backend API
  - Platform provides: `POST /api/v1/storage/upload`
  - Labeler uploads export files via Platform API
  - Platform manages S3 bucket: `s3://platform-storage/labeler-exports/`
- **Migration Impact**: Minimal code changes (only endpoint URLs)

**Design Documents**:
- `docs/design/ANNOTATION_STATE_VERSION_DESIGN.md` - Confirmation & version management
- `docs/design/PRODUCTION_STORAGE_STRATEGY.md` - Storage architecture & migration

**Platform API Requirements** (ETA: Phase 4):
```
POST /api/v1/storage/upload
  - Upload annotation export files to S3
  - Return presigned download URL
  - Rate limit: 10/min per user
```

**Alternative Fallback**: MinIO (self-hosted S3-compatible storage) if platform API unavailable

---

## Phase 1 Summary

**Status**: ✅ 98% Complete (44/45 tasks)

**Completed**:
- ✅ Full annotation page with 4-panel layout
- ✅ Canvas with zoom/pan/grid/crosshair (mouse wheel, buttons, keyboard)
- ✅ Pan with Shift+Drag, Middle mouse, Arrow keys (50px increments)
- ✅ Pan with Select tool + Drag (added 2025-11-14)
- ✅ Bbox drawing tool with dimensions tooltip
- ✅ Bbox rendering with class colors, labels, and resize handles
- ✅ Class selector modal with search and keyboard navigation (1-9, arrows, Enter, Esc)
- ✅ Image list with thumbnail grid, status indicators, filter, click navigation
- ✅ Full state management with Zustand (600+ lines, undo/redo, preferences)
- ✅ Complete API integration (create/update/delete annotations)
- ✅ Panel collapse/expand with '[' and ']' keys (smooth 300ms animation)
- ✅ Comprehensive keyboard shortcuts:
  - Tools: R (select), V (bbox)
  - Navigation: Arrow keys (prev/next image - changed from pan)
  - Editing: Delete/Backspace (delete selected)
  - Zoom: Ctrl+0/+/-
  - Undo/Redo: Ctrl+Z/Y
  - Panels: [ ] (toggle)
  - Escape: Deselect
- ✅ All UI components (TopBar, LeftPanel with ImageList, RightPanel, BottomBar)
- ✅ Dark/Light mode toggle with full support across all components
- ✅ Annotation visibility toggles (individual + global show/hide)
- ✅ Image list view toggle (grid/table views)
- ✅ Canvas layout redesign with overlay controls (zoom, navigation, AI button)

**UI/UX Improvements (2025-11-14)**:
- ✅ Dark/Light mode implementation
  - Class-based dark mode (`darkMode: 'class'` in tailwind.config.ts)
  - Dynamic document class management
  - Canvas background color responds to theme (gray-800 / gray-100)
  - All components with dark: prefix patterns
- ✅ Class selector modal dark mode support
- ✅ Image list enhancements
  - Grid/list toggle with table view
  - Table shows: image #, filename, annotation count
  - Annotation counts fixed and display correctly
- ✅ Canvas overlay controls redesign
  - Bottom-left: Zoom controls (-, 100%, +, Fit)
  - Bottom-center: Navigation (< 1/32 >)
  - Bottom-right: Image dimensions + AI Assistant button (circular)
  - BottomBar component hidden (navigation moved to Canvas)
- ✅ Annotation visibility controls
  - Individual hide/show toggle per annotation (eye icon)
  - Global show/hide all annotations toggle
  - Set-based state management for hidden annotations
- ✅ Keyboard navigation
  - Arrow keys (↑↓←→) navigate between images
  - Select tool + drag to pan image
- ✅ Compressed class table with tighter spacing and smaller fonts
- ✅ Right panel improvements
  - Fixed "Unlabeled" display (supports snake_case and camelCase)
  - Compressed annotation cards to 1 row
  - Current image classes shown at top with separator

**Remaining (Deferred to Phase 2)**:
- ⏸️ Bbox resize & move interaction (handles rendered, drag not implemented)
- ⏸️ Image preloading (next 3 images)

**Git Commits**:
- `b6838bd` - feat: Phase 1 core canvas implementation
- `7c6dea4` - feat: Implement bbox save and keyboard shortcuts
- `1d112e7` - feat: Complete Phase 1 - Image list, arrow keys pan, panel toggle
- `d020aae` - docs: Update TODO - Phase 1 complete (98%)
- `731d1aa` - fix: Correct Project type definitions and field access

---

**Last Updated**: 2025-11-16
**Next Review**: 2025-11-20
**Progress**: Phase 1: 98% complete (44/45 tasks) ✅ | Phase 2.7: 85% complete (11/13 tasks) 🔄
**Status**: Phase 1 complete. Phase 2.7 all core features complete!

**Phase 2.7 Status** (Updated 2025-11-16):
✅ **Completed Tasks (11/13)**:
- Database migrations (image_annotation_status table, annotation_state column)
- Backend annotation confirmation APIs (confirm/unconfirm/bulk-confirm)
- Backend image status management APIs (status list, confirm/unconfirm image)
- Backend image status auto-update service
- Frontend API client integration
- Image status display with real data (ImageList icons)
- Annotation history panel with real API data
- Data structure updates (Zustand store, TypeScript interfaces)
- Frontend individual annotation confirm toggle
- Frontend bulk confirm all annotations button
- **Frontend confirm image button with Ctrl+Enter** (NEW!)

⏸️ **Remaining Tasks (2/13)** - ~4.5 hours:
- Frontend: Enhanced image status badges (visual improvements) - 1 hour
- Testing: End-to-end confirmation workflow - 3.5 hours

**Git Commits (Phase 2.7)**:
- `799e60c` - feat: Phase 2.7 Backend - Annotation & Image Confirmation API
- `7d0cf5d` - feat: Phase 2.7 Frontend - API Integration & Real Data Display
- `89212d5` - feat: Phase 2.7 - Image Status Auto-Update + Frontend Confirmation UI
- (pending) - feat: Phase 2.7 - Confirm Image Button with Auto-Navigation

**Phase 2 Priority**: Annotation Confirmation (2.7) and Version Management (2.8) - 42h total
**Storage Strategy**: S3 direct access (Phase 2) → Platform API migration (Phase 4)

---

## Phase 2.9: Task-Based Architecture (Week 6) ⭐ NEW

**Goal**: Task-separated annotations with complete context isolation
**Status**: ✅ **COMPLETE** (2025-11-19)
**Documentation**: `docs/phase-2.9-implementation-summary.md`, `docs/task-context-architecture.md`

### Summary

Complete implementation of task-based annotation architecture enabling independent workflows for classification, detection, and segmentation tasks.

**Key Features**:
- Task-separated annotation files (`annotations_classification.json`, `annotations_detection.json`, etc.)
- Independent versioning per task (classification v2.0, detection v1.0)
- Complete UI context isolation (switching tasks resets all state)
- Task-based S3 storage paths (`exports/{project_id}/{task_type}/{version}/`)
- JSONB task_classes structure for flexible class management
- Auto-select primary task based on progress
- Dashboard task tabs with task-specific statistics

**Database Changes**:
- [x] Added `task_type` column to `annotation_versions` table ✅
- [x] Added `task_classes` JSONB column to `annotation_projects` table ✅
- [x] Created unique index on (project_id, task_type, version_number) ✅
- [x] Migrated existing data (all projects → detection) ✅

**Backend Implementation**:
- [x] Updated `AnnotationProject` and `AnnotationVersion` models ✅
- [x] Modified publish_version to include task_type ✅
- [x] Updated storage paths to include task_type ✅
- [x] Added task-to-annotation-type mapping (detection→bbox) ✅
- [x] Updated Platform DB annotation_path on publish ✅
- [x] Added task_type to VersionResponse in list_versions API ✅

**Frontend Implementation**:
- [x] Task switcher dropdown in TopBar ✅
- [x] `switchTask()` function with complete state reset ✅
- [x] Task-specific class display (getCurrentClasses) ✅
- [x] Task-filtered version list in TopBar ✅
- [x] Task-filtered version list in AnnotationHistory ✅
- [x] Tool visibility based on task (hide BBox for classification) ✅
- [x] RightPanel class stats filtered by current task ✅
- [x] Auto-select primary task based on progress on project load ✅
- [x] Reload image statuses when task changes ✅
- [x] Dashboard task tabs with progress percentages ✅
- [x] Dashboard statistics cards show task-specific data ✅
- [x] Dashboard classes table filtered by selected task ✅
- [x] Primary task star indicator on task tabs ✅

**Migration**:
- [x] Database schema migration (alembic upgrade head) ✅
- [x] Data migration (fix_detection_migration.py) ✅
- [x] Platform annotations migration (migrate_storage_annotations_complete.py) ✅
- [x] Export files migration (migrate_export_files.py) ✅

**Files Changed**: 25+ files (9 backend, 11 frontend, 2 migrations, 3 docs)
**Estimate**: 40 hours
**Actual**: ~25 hours
**Completion Date**: 2025-11-19

**Git Commits**:
- `dfa14eb` - docs: Add annotation file management strategy analysis
- (pending) - feat: Phase 2.9 complete - Task-based architecture with dashboard integration

---

## Phase 2.10: Dataset Management (Weeks 7-11) ⭐ NEW

**Goal**: Enable dataset upload/delete in Labeler, preparing for Platform migration
**Status**: 📋 Planning Complete (2025-11-18)
**Priority**: High (Critical bug fix + Infrastructure improvement)
**Documentation**: `docs/phase-2.10-dataset-management.md`

### Current Issue

**Problem**: det-mvtec dataset has corrupted annotations
- Image paths stored as '1', '2', '3' instead of 'bottle/broken_large/000.png'
- Root cause: DICE export uses `image_id` as `file_name`
- Image preview broken for datasets with folder structure

**Immediate Fix**: DICE export service bug (Priority P0)

### Phases

#### Phase 2.10.1: Dataset Deletion (Week 7) - P0 Critical ✅ COMPLETE

**Goal**: Fix broken datasets + Proper cleanup mechanism
**Status**: ✅ Complete (2025-11-19)
**Estimate**: 15 hours
**Actual**: ~12 hours

- [x] **Fix: DICE export service** ✅ COMPLETED
  - Added `_load_image_filename_mapping()` function
  - Load file_name from Platform annotations file
  - Fallback to image_id if mapping not found
  - **Estimate**: 2 hours
  - **Actual**: 2 hours
  - **File**: `backend/app/services/dice_export_service.py:346-395`

- [x] **Backend: DELETE /api/v1/datasets/{id}** ✅ COMPLETED
  - Cascade delete Labeler DB data
  - Delete S3 files (images + annotations + exports)
  - Delete Platform DB record
  - Return deletion summary with impact details
  - **Estimate**: 3 hours
  - **Actual**: 3 hours
  - **File**: `backend/app/api/v1/endpoints/datasets.py:538-620`

- [x] **Backend: Dataset deletion service** ✅ COMPLETED
  - `calculate_deletion_impact()` - Preview what will be deleted
  - `delete_labeler_data()` - Remove projects, annotations, versions
  - `delete_s3_data()` - Clean up S3 buckets
  - `create_final_backup()` - Optional export before deletion
  - **Estimate**: 4 hours
  - **Actual**: 4 hours
  - **File**: `backend/app/services/dataset_delete_service.py`

- [x] **Frontend: Delete confirmation modal** ✅ COMPLETED
  - Dataset name verification input
  - Deletion impact display (images, annotations, versions, storage)
  - Optional backup checkbox
  - Loading states
  - **Estimate**: 3 hours
  - **Actual**: 2.5 hours
  - **File**: `frontend/components/datasets/DeleteDatasetModal.tsx`

- [x] **Frontend: Delete button integration** ✅ COMPLETED
  - Delete button in dashboard dataset detail
  - Success/error toast notifications
  - **Estimate**: 1 hour
  - **Actual**: 0.5 hours
  - **File**: `frontend/app/page.tsx`

- [ ] **Test: Delete det-mvtec dataset**
  - Verify all data cleaned up
  - Check orphaned data
  - Re-upload clean dataset
  - **Estimate**: 2 hours
  - **Status**: Pending testing

**Subtotal**: 15 hours (13h complete, 2h testing remaining)

#### Phase 2.10.2: Dataset Upload (Weeks 8-9) - P1 High

**Goal**: Enable dataset upload from Labeler
**Status**: ⏸️ Deferred (pending deletion implementation)
**Estimate**: 25 hours

- [ ] **Backend: POST /api/v1/datasets/upload**
  - Multi-file upload support
  - ZIP extraction with folder structure preservation
  - Annotation import (COCO/DICE format)
  - Auto-create project
  - **Estimate**: 8 hours

- [ ] **Backend: Upload services**
  - `upload_files_to_s3()` - Handle images + ZIP
  - `parse_annotation_file()` - Support COCO/DICE
  - `import_annotations_to_db()` - Bulk insert
  - **Estimate**: 6 hours

- [ ] **Frontend: Upload wizard**
  - 4-step wizard (Info → Files → Annotations → Review)
  - Drag & drop file upload
  - Progress tracking
  - Folder structure preview
  - **Estimate**: 8 hours

- [ ] **Frontend: Upload progress**
  - Real-time upload progress (bytes/total)
  - File validation
  - Error handling
  - **Estimate**: 3 hours

**Subtotal**: 25 hours

**Requirements**:
- ZIP support (preserve folder structure)
- Annotation format detection (COCO/DICE/YOLO)
- Image dimension extraction (PIL)
- Duplicate name validation

#### Phase 2.10.3: UI Enhancements (Week 10) - P2 Medium

**Goal**: Improved dataset management UX
**Status**: ⏸️ Planning
**Estimate**: 12 hours

- [ ] **Bulk operations**
  - Multi-select datasets
  - Bulk delete with confirmation
  - Bulk export
  - **Estimate**: 4 hours

- [ ] **Dataset detail page**
  - Storage usage breakdown
  - Version history timeline
  - Download options
  - Share/export
  - **Estimate**: 5 hours

- [ ] **Filter & search**
  - Filter by labeled/unlabeled
  - Search by name
  - Sort by size/date/name
  - **Estimate**: 3 hours

**Subtotal**: 12 hours

#### Phase 2.10.4: Safety Features (Week 11) - P2 Medium

**Goal**: Audit log and recovery mechanisms
**Status**: ⏸️ Planning
**Estimate**: 10 hours

- [ ] **Soft delete**
  - Add deleted_at, deleted_by columns
  - Restore endpoint
  - Automatic cleanup after 30 days
  - **Estimate**: 3 hours

- [ ] **Audit log**
  - DatasetAuditLog table
  - Track all dataset actions
  - User attribution
  - **Estimate**: 4 hours

- [ ] **Testing**
  - E2E deletion flow
  - Upload + delete + restore
  - Orphaned data detection
  - **Estimate**: 3 hours

**Subtotal**: 10 hours

### Total Phase 2.10 Estimate

| Phase | Hours | Priority | Status |
|-------|-------|----------|--------|
| 2.10.1: Deletion | 15h | P0 Critical | ✅ Complete (13h done) |
| 2.10.2: Upload | 25h | P1 High | ⏸️ Deferred |
| 2.10.3: UI | 12h | P2 Medium | ⏸️ Planning |
| 2.10.4: Safety | 10h | P2 Medium | ⏸️ Planning |
| **Total** | **62h** | | |

### Migration Strategy

**Month 1-2**: Parallel operation
- Platform: Keep existing features
- Labeler: Add upload/delete
- Users choose which to use

**Month 3-4**: Feature parity
- Labeler: Match Platform features
- Platform: Deprecation notice

**Month 5-6**: Full migration
- Platform: Read-only mode
- Platform: Sunset

### Critical Findings

**Platform-Labeler Separation**:
- ❌ No FK constraints between databases
- ❌ Platform deletion leaves orphaned Labeler data
- ✅ Labeler deletion MUST cascade to both DBs

**Root Cause Analysis**:
- DICE export uses `image_id` (DB string) as `file_name`
- Should use actual file path from S3 or Platform DB
- Affects all datasets with folder structure

---
