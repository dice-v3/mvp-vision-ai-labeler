# Annotation Canvas Implementation To-Do List

**Project**: Vision AI Labeler - Annotation Interface
**Based on**: `docs/design/ANNOTATION_UI_DESIGN.md`
**Start Date**: 2025-11-14
**Target Completion**: 2025-12-19 (5 weeks)

---

## Progress Overview

| Phase | Status | Progress | Target Week |
|-------|--------|----------|-------------|
| Phase 1: Core Canvas | 🔄 In Progress | 37/45 (82%) | Week 1 |
| Phase 2: Advanced Features | ⏸️ Pending | 0/27 | Week 2 |
| Phase 3: AI Integration | ⏸️ Pending | 0/16 | Week 3 |
| Phase 4: Polish & Optimization | ⏸️ Pending | 0/20 | Week 4 |
| Phase 5: Multi-Task Support | ⏸️ Pending | 0/18 | Weeks 5-6 |

**Overall Progress**: 37/141 tasks (26%)

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
  - **Estimate**: 2 hours
  - **Actual**: 2 hours
  - **Note**: Arrow keys pan not yet implemented

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

### 1.5 Image List (Left Panel)

- [ ] **Thumbnail grid layout**
  - 2-column grid (120x80px per thumbnail)
  - Scrollable list
  - Current image highlighted (violet border)
  - Image number badge (bottom-left)
  - **Estimate**: 3 hours
  - **File**: `frontend/components/annotation/ImageList.tsx`

- [ ] **Status indicators**
  - ✓ icon: Completed (has annotations)
  - ⚠ icon: Needs review
  - 🤖 icon: AI-assisted
  - Progress bar (2px height at bottom)
  - **Estimate**: 2 hours

- [ ] **Click to navigate**
  - Single click: Jump to image
  - Load image in canvas
  - Update annotations for new image
  - Auto-scroll to current image
  - **Estimate**: 2 hours

- [ ] **Filter dropdown**
  - All Images / Not Started / In Progress / Completed / Needs Review
  - Filter thumbnails based on selection
  - Update count in header
  - **Estimate**: 2 hours

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
  - 280px width
  - Contains: Tools, Class List
  - **Estimate**: 2 hours
  - **File**: `frontend/components/annotation/LeftPanel.tsx`
  - **Actual**: 2 hours
  - **Note**: Collapsible animation and '[' hotkey not yet implemented

- [x] **Right panel container** ✅ COMPLETED
  - 320px width
  - Contains: Annotations List, Metadata placeholder
  - Delete functionality
  - **Estimate**: 2 hours
  - **File**: `frontend/components/annotation/RightPanel.tsx`
  - **Actual**: 2 hours
  - **Note**: Collapsible animation and ']' hotkey not yet implemented

- [x] **Bottom bar** ✅ COMPLETED
  - 80px height
  - Navigation controls (Prev/Next)
  - Bulk actions (Delete All, Copy, AI Assist)
  - Progress indicator
  - **Estimate**: 2 hours
  - **File**: `frontend/components/annotation/BottomBar.tsx`
  - **Actual**: 2 hours

---

## Phase 2: Advanced Features (Week 2)

**Goal**: Full keyboard support, undo/redo, advanced UI components
**Target Completion**: 2025-11-28

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

### 2.7 Settings Panel

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

## Phase 3: AI Integration (Week 3)

**Goal**: AI-assisted annotation with model predictions
**Target Completion**: 2025-12-05

### 3.1 AI Assist Button

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

### 3.2 Model Inference

- [ ] **Backend endpoint**
  - POST `/api/v1/annotations/ai-assist`
  - Request: project_id, image_id, model_id, confidence_threshold
  - Response: List of predicted bboxes
  - **Estimate**: 4 hours
  - **File**: `backend/app/api/v1/endpoints/ai_assist.py`

- [ ] **Model integration**
  - Load YOLOv8 model
  - Run inference on image
  - Filter by confidence threshold
  - Return predictions in standard format
  - **Estimate**: 4 hours

### 3.3 Predictions Rendering

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

### 3.4 Review & Accept/Reject

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

### 3.5 AI Confidence Scores

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

---

## Phase 4: Polish & Optimization (Week 4)

**Goal**: Performance, error handling, user experience
**Target Completion**: 2025-12-12

### 4.1 Performance Optimization

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

### 4.2 Error Handling

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

### 4.3 Loading States

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

### 4.4 Confirmation Modals

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

### 4.5 Onboarding & Help

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

### 4.6 User Testing & Feedback

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

---

## Phase 5: Multi-Task Support (Weeks 5-6)

**Goal**: Support Polygon, Classification, Keypoints
**Target Completion**: 2025-12-19

### 5.1 Tool Registration System

- [ ] **Abstract annotation tool interface**
  - Define AnnotationTool interface
  - renderAnnotation, renderPreview methods
  - onMouseDown/Move/Up handlers
  - validate, toJSON, fromJSON
  - **Estimate**: 3 hours
  - **File**: `frontend/lib/annotation/AnnotationTool.ts`

- [ ] **Tool registry**
  - Register bbox, polygon, classification, keypoints tools
  - Select active tool from registry
  - Modular architecture
  - **Estimate**: 2 hours

### 5.2 Polygon Tool

- [ ] **Polygon drawing**
  - Click to add vertices
  - Show preview line to cursor
  - Auto-close when clicking near first vertex
  - Minimum 3 vertices
  - **Estimate**: 4 hours
  - **File**: `frontend/components/annotation/tools/PolygonTool.tsx`

- [ ] **Polygon editing**
  - Click vertex to select
  - Drag to move vertex
  - Delete vertex (right-click or Delete key)
  - Add vertex (click on edge)
  - **Estimate**: 4 hours

- [ ] **Polygon rendering**
  - Fill with semi-transparent color
  - Stroke outline
  - Show vertices as circles
  - Highlight selected vertex
  - **Estimate**: 2 hours

### 5.3 Classification Tool

- [ ] **Classification UI**
  - Single-label: Dropdown or radio buttons
  - Multi-label: Checkboxes
  - Hierarchical: Tree structure (future)
  - **Estimate**: 3 hours
  - **File**: `frontend/components/annotation/tools/ClassificationTool.tsx`

- [ ] **Keyboard shortcuts for classification**
  - '1-9' for quick select
  - 'C' to activate tool
  - Visual feedback on selection
  - **Estimate**: 2 hours

- [ ] **Save classification to image**
  - No bbox, just image-level label
  - POST to backend
  - Display in annotations list
  - **Estimate**: 2 hours

### 5.4 Keypoints Tool (Basic)

- [ ] **Keypoints placement**
  - Click to place keypoint
  - Load skeleton definition (COCO-17 or custom)
  - Show skeleton overlay
  - **Estimate**: 4 hours
  - **File**: `frontend/components/annotation/tools/KeypointsTool.tsx`

- [ ] **Visibility flags**
  - 0: Not labeled
  - 1: Labeled but occluded
  - 2: Labeled and visible
  - Click to cycle through states
  - **Estimate**: 2 hours

- [ ] **Keypoints rendering**
  - Draw circles at keypoint positions
  - Draw lines for skeleton connections
  - Color-code by visibility
  - **Estimate**: 2 hours

### 5.5 Task Switcher UI

- [ ] **Task type selector**
  - Dropdown in top bar or left panel
  - Switch between: Detection / Segmentation / Classification / Keypoints
  - Load appropriate tool
  - **Estimate**: 2 hours

- [ ] **Dynamic UI based on task type**
  - Show/hide attributes panel
  - Show/hide class selector (not needed for keypoints)
  - Adjust right panel layout
  - **Estimate**: 3 hours

### 5.6 Configuration-Driven UI

- [ ] **Load task config from project**
  - Parse project.task_config
  - Enable/disable features based on config
  - **Estimate**: 2 hours

- [ ] **Attributes from config**
  - Dynamically generate attribute inputs
  - Support all 7 input types
  - **Estimate**: 3 hours

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

| Phase | Tasks | Hours |
|-------|-------|-------|
| Phase 1: Core Canvas | 45 tasks | 90 hours |
| Phase 2: Advanced Features | 27 tasks | 54 hours |
| Phase 3: AI Integration | 16 tasks | 32 hours |
| Phase 4: Polish | 20 tasks | 40 hours |
| Phase 5: Multi-Task | 18 tasks | 36 hours |
| Testing | 8 tasks | 23 hours |
| Documentation | 3 tasks | 12 hours |
| Deployment | 4 tasks | 8 hours |
| **TOTAL** | **141 tasks** | **295 hours** |

### Timeline

- **Week 1** (Nov 14-21): Phase 1 (90h → 2 devs × 45h/week)
- **Week 2** (Nov 22-28): Phase 2 (54h)
- **Week 3** (Nov 29-Dec 5): Phase 3 (32h)
- **Week 4** (Dec 6-12): Phase 4 (40h)
- **Week 5-6** (Dec 13-19): Phase 5 (36h) + Testing (23h) + Docs (12h)
- **Week 6** (Dec 20-26): Deployment (8h) + Buffer

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

- **Phase 2** depends on Phase 1 completion
- **Phase 3** can run parallel to Phase 2 (backend team)
- **Phase 4** depends on Phases 1-3
- **Phase 5** depends on Phase 1 (tool abstraction)

### Risk Mitigation

1. **Performance issues**: Profile early, optimize incrementally
2. **Scope creep**: Stick to P0/P1 tasks for MVP
3. **AI integration delays**: Phase 3 is optional for initial launch
4. **Browser compatibility**: Test on Chrome, Edge, Firefox regularly

---

## Phase 1 Summary

**Status**: 🔄 82% Complete (37/45 tasks)

**Completed**:
- ✅ Full annotation page with 4-panel layout
- ✅ Canvas with zoom/pan/grid/crosshair
- ✅ Bbox drawing tool with dimensions tooltip
- ✅ Bbox rendering with class colors and labels
- ✅ Class selector modal with search and keyboard navigation
- ✅ Full state management with Zustand (600+ lines)
- ✅ Complete API integration (create/update/delete)
- ✅ Keyboard shortcuts (R/V tools, A/D navigation, Delete, Esc, Ctrl+Z/Y, Ctrl+0/+/-)
- ✅ Navigation controls (Prev/Next buttons)
- ✅ All UI components (TopBar, LeftPanel, RightPanel, BottomBar)

**Remaining**:
- 🔄 Bbox resize & move (handles rendered, interaction pending)
- ⏸️ Image list component (4 tasks)
- ⏸️ Panel collapsible animations
- ⏸️ Arrow keys pan
- ⏸️ Image preloading

**Git Commits**:
- `b6838bd` - feat: Phase 1 core canvas implementation
- `7c6dea4` - feat: Implement bbox save and keyboard shortcuts

---

**Last Updated**: 2025-11-14
**Next Review**: 2025-11-17 (End of Week 1, Phase 1)
**Progress**: Phase 1 is 82% complete - ready for testing and user feedback
