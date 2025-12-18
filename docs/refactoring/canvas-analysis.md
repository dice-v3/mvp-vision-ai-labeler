# Canvas.tsx - Current State Analysis

**Analysis Date**: 2025-12-10
**File**: `frontend/components/annotation/Canvas.tsx`
**Total Lines**: 4,100
**Status**: 🔴 Critical - Requires immediate refactoring

---

## Executive Summary

Canvas.tsx has grown to 4,100 lines with severe code smell issues:
- **Massive event handlers**: 3 mouse handlers totaling 1,253 lines (30% of file)
- **30+ local state variables**: useState scattered throughout
- **588-line useEffect**: Keyboard shortcuts handler
- **Multiple responsibilities**: Rendering, events, tools, locks, diffs, magnifier
- **Poor testability**: Tightly coupled logic, no unit tests possible
- **High maintenance cost**: Any feature addition touches 100+ lines

**Recommendation**: Immediate modular refactoring required

---

## File Structure Breakdown

### 1. Imports & Setup (Lines 1-150)

**Imports** (31 lines):
- React hooks: `useEffect`, `useRef`, `useState`, `useCallback`
- Store: `useAnnotationStore` (Zustand)
- Components: ClassSelectorModal, Magnifier, Diff components, ConflictDialog
- API: annotations, projects, image-locks
- Tools: ToolRegistry, all tool implementations
- Utils: toast, confirm

**Refs** (3):
```typescript
const canvasRef = useRef<HTMLCanvasElement>(null);
const containerRef = useRef<HTMLDivElement>(null);
const imageRef = useRef<HTMLImageElement>(null);
```

**Store Hooks** (44 destructured values):
```typescript
const {
  currentImage, annotations, selectedAnnotationId, selectAnnotation,
  canvas: canvasState, tool, setTool, isDrawing, drawingStart,
  preferences, setZoom, setPan, setCursor, startDrawing,
  updateDrawing, finishDrawing, addAnnotation, project,
  isAnnotationVisible, currentIndex, images, goToNextImage,
  goToPrevImage, setCurrentIndex, currentTask, deleteAnnotation,
  updateAnnotation: updateAnnotationStore, selectedImageIds,
  clearImageSelection, getCurrentClasses, selectedVertexIndex,
  selectedBboxHandle, undo, redo, canUndo, canRedo,
  showMinimap, diffMode, getDiffForCurrentImage
} = useAnnotationStore();
```

**Local State** (30+ useState hooks):

| Category | States | Count |
|----------|--------|-------|
| **Image** | image, imageLoaded | 2 |
| **Pan/Zoom** | isPanning, panStart, canvasCursor, cursorPos | 4 |
| **UI Modal** | showClassSelector | 1 |
| **Bbox Tool** | pendingBbox, isResizing, resizeHandle, resizeStart | 4 |
| **Polygon Tool** | polygonVertices, isDraggingVertex, draggedVertexIndex, isDraggingPolygon, polygonDragStart | 5 |
| **Polyline Tool** | polylineVertices | 1 |
| **Circle Tool** | circleCenter, circle3pPoints, isDraggingCircle, circleDragStart, isResizingCircle, circleResizeStart, selectedCircleHandle | 7 |
| **Magnifier** | manualMagnifierActive, magnifierForceOff, magnification | 3 |
| **Image Lock** | heartbeatInterval, isImageLocked, lockedByUser, showLockedDialog | 4 |
| **Conflict** | conflictDialogOpen, conflictInfo, pendingAnnotationUpdate | 3 |
| **Saving** | isSaving, confirmingImage, batchProgress | 3 |

**Total**: 37 local useState + 44 store values = **81 state values**

**Issues**:
- ❌ Too many responsibilities in one component
- ❌ Tool-specific state should be in tool modules
- ❌ Lock/conflict state should be in separate hooks
- ❌ No clear state management strategy

---

### 2. Helper Functions (Lines 151-327)

**setSelectedVertexIndex** (Lines 148-150):
- Updates store directly

**setSelectedBboxHandle** (Lines 153-155):
- Updates store directly

**updateAnnotationWithHistory** (Lines 164-162):
- Wrapper for annotation updates with history tracking
- **Issue**: Should be in a custom hook

**isDrawingTool** (Lines 170-175):
- Checks if tool is a drawing tool
- **Issue**: Should be in tool utils

**shouldShowMagnifier** (Lines 177-184):
- Complex conditional logic for magnifier display
- **Issue**: Should be in magnifier hook

**draftAnnotations & draftCount** (Lines 185-188):
- Filter and count draft annotations
- **Issue**: Should be computed in store or custom hook

**updateAnnotationWithVersionCheck** (Lines 194-326):
- 133 lines! Version conflict detection and resolution
- **Issue**: Should be in `useAnnotationSync` hook

---

### 3. Image Loading & Lock Management (Lines 327-627)

**useEffect #1** (Lines 327-334):
- Update magnification when preferences change
- **OK**: Simple effect

**useEffect #2** (Lines 336-461) - 126 lines!:
- Acquire image lock
- Load image with retry logic
- Release lock on unmount
- Heartbeat interval
- **Issues**:
  - ❌ 126 lines in one useEffect
  - ❌ Should be in `useImageManagement` hook
  - ❌ Lock logic should be in `useImageLock` hook

**useEffect #3** (Lines 462-627) - 166 lines!:
- Canvas rendering logic
- Draws grid, annotations, overlays, magnifier
- **Issues**:
  - ❌ 166 lines in one useEffect
  - ❌ Rendering logic mixed with effect
  - ❌ Should be in `CanvasRenderer` component

---

### 4. Drawing Helper Functions (Lines 628-1062)

| Function | Lines | Purpose | Issues |
|----------|-------|---------|--------|
| `drawGrid` | 32 | Draw canvas grid | ✅ Good candidate for util |
| `snapshotToAnnotation` | 62 | Convert snapshot format | ❌ Should be in util |
| `drawAnnotations` | 126 | Draw all annotations | ❌ Too complex, needs breakdown |
| `drawNoObjectBadge` | 40 | Draw "No Object" badge | ✅ Good candidate for util |
| `drawBboxPreview` | 30 | Preview bbox during drawing | ✅ Tool-specific, move to tool |
| `drawPolygonPreview` | 31 | Preview polygon | ✅ Tool-specific |
| `drawPolylinePreview` | 31 | Preview polyline | ✅ Tool-specific |
| `drawCirclePreview` | 31 | Preview circle | ✅ Tool-specific |
| `drawCircle3pPreview` | 31 | Preview 3-point circle | ✅ Tool-specific |
| `drawCrosshair` | 20 | Draw crosshair cursor | ✅ Good candidate for util |

**Total**: 434 lines of drawing functions

**Recommendations**:
- Move tool preview functions to tool modules
- Extract `drawAnnotations` into smaller functions
- Create `renderHelpers.ts` utility file
- Create `ToolOverlay.tsx` component

---

### 5. Event Handlers - Mouse (Lines 1063-2313)

### 5.1 handleMouseDown (Lines 1063-1597) - **535 lines!**

**Structure**:
```typescript
const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
  // Phase 11: Diff mode - prevent interactions (10 lines)
  // Lock check (10 lines)

  // Get canvas coordinates (20 lines)

  // Tool-specific logic:
  if (tool === 'select') {
    // Selection logic (150 lines)
    // - Annotation selection
    // - Vertex selection (polygon)
    // - Handle selection (bbox)
    // - Circle handle selection
  }
  else if (tool === 'bbox') {
    // Bbox drawing start (30 lines)
  }
  else if (tool === 'polygon') {
    // Polygon vertex placement (80 lines)
  }
  else if (tool === 'polyline') {
    // Polyline vertex placement (50 lines)
  }
  else if (tool === 'circle') {
    // Circle center placement (40 lines)
  }
  else if (tool === 'circle3p') {
    // 3-point circle logic (60 lines)
  }
  else if (tool === 'pan') {
    // Pan start (20 lines)
  }

  // Re-render (5 lines)
};
```

**Critical Issues**:
- ❌ **535 lines** in single function
- ❌ Tool-specific logic should be in tool classes
- ❌ Massive if-else chain
- ❌ Impossible to test individual tool behaviors
- ❌ Violates Single Responsibility Principle

### 5.2 handleMouseMove (Lines 1598-1983) - **387 lines!**

**Structure**: Similar tool-based if-else chain
- Select tool: vertex dragging, bbox resizing, circle resizing (150 lines)
- Bbox tool: preview update (30 lines)
- Polygon tool: preview update (40 lines)
- Polyline tool: preview update (30 lines)
- Circle tools: preview update (50 lines)
- Pan tool: pan dragging (40 lines)
- Cursor updates (20 lines)

**Critical Issues**: Same as handleMouseDown

### 5.3 handleMouseUp (Lines 1984-2313) - **331 lines!**

**Structure**: Tool-based finalization logic
- Select tool: finish drag/resize operations
- Drawing tools: finalize annotation, show class selector
- Pan tool: finish panning

**Critical Issues**: Same as above

### Event Handler Summary

**Total Mouse Handler Lines**: 1,253 (30% of file!)

**Refactoring Priority**: 🔴 **CRITICAL**

**Target Architecture**:
```typescript
// Instead of massive if-else:
const handleMouseDown = (e: React.MouseEvent) => {
  const tool = getTool(currentTool);
  tool.onMouseDown(context);
};

// Each tool implements its own handlers:
class BboxTool {
  onMouseDown(context: CanvasContext) { /* 20 lines */ }
  onMouseMove(context: CanvasContext) { /* 15 lines */ }
  onMouseUp(context: CanvasContext) { /* 25 lines */ }
}
```

---

### 6. Other Event Handlers (Lines 2314-2963)

| Handler | Lines | Issues |
|---------|-------|--------|
| `handleClassSelect` | 327 | ❌ Too complex, async logic scattered |
| `handleClassSelectorClose` | 10 | ✅ OK |
| `handleNoObject` | 107 | ❌ Business logic should be in hook |
| `handleDeleteAllAnnotations` | 88 | ❌ Should be in annotation service |
| `handleConfirmImage` | 117 | ❌ Should be in image service |

**Total**: 649 lines

---

### 7. Keyboard Shortcuts (Lines 2964-3552) - **588 lines!**

**useEffect #4** - Keyboard event listeners

**Structure**:
- Tool shortcuts (1-9 keys, B, P, L, C, etc.) - 100 lines
- Navigation (Arrow keys, Enter) - 80 lines
- Undo/Redo (Ctrl+Z, Ctrl+Y) - 20 lines
- Magnifier (Z key) - 30 lines
- Delete (Delete, Backspace) - 40 lines
- Confirm (Space, Ctrl+Enter) - 50 lines
- Zoom (Ctrl++, Ctrl+-) - 30 lines
- Pan (Space + drag) - 40 lines
- Event listeners setup/cleanup - 50 lines

**Critical Issues**:
- ❌ **588 lines** in single useEffect!
- ❌ Keyboard logic mixed with canvas logic
- ❌ Should be in `useKeyboardShortcuts` hook
- ❌ Hard to override or customize shortcuts

---

### 8. JSX Return (Lines 3553-4100) - 547 lines

**Structure**:
```tsx
return (
  <div>
    {/* Phase 11: Diff Mode UI (80 lines) */}
    <DiffToolbar ... />
    <DiffActions ... />

    {/* Main Canvas Container (150 lines) */}
    <canvas ref={canvasRef} ... />

    {/* Phase 8.5.2: Lock Overlay (60 lines) */}
    {isImageLocked && <LockWarning ... />}

    {/* Phase 2.10.2: Magnifier (40 lines) */}
    {shouldShowMagnifier && <Magnifier ... />}

    {/* Phase 2.10: Undo/Redo Buttons (50 lines) */}
    <UndoRedoButtons ... />

    {/* Modals (150 lines) */}
    <ClassSelectorModal ... />
    <AnnotationConflictDialog ... />

    {/* Additional UI elements (100 lines) */}
  </div>
);
```

**Issues**:
- ❌ 547 lines of JSX
- ❌ Complex conditional rendering
- ❌ Multiple overlay layers
- ❌ Should be broken into sub-components

---

## Complexity Metrics

### Code Size
| Metric | Value | Status |
|--------|-------|--------|
| Total Lines | 4,100 | 🔴 Critical |
| Mouse Handlers | 1,253 (30%) | 🔴 Critical |
| Keyboard Handler | 588 (14%) | 🔴 Critical |
| Drawing Functions | 434 (11%) | 🟡 High |
| JSX Return | 547 (13%) | 🟡 High |
| Other Logic | 1,278 (31%) | 🟡 High |

### State Complexity
| Metric | Count | Status |
|--------|-------|--------|
| useState Hooks | 37 | 🔴 Critical |
| Store Values | 44 | 🔴 Critical |
| Total State Values | 81 | 🔴 Critical |
| useEffect Hooks | 4+ | 🟡 High |
| useCallback Hooks | 3+ | ✅ OK |

### Function Complexity
| Function | Lines | Cyclomatic Complexity | Status |
|----------|-------|----------------------|--------|
| handleMouseDown | 535 | ~30 | 🔴 Critical |
| handleMouseMove | 387 | ~25 | 🔴 Critical |
| handleMouseUp | 331 | ~20 | 🔴 Critical |
| Keyboard useEffect | 588 | ~40 | 🔴 Critical |
| handleClassSelect | 327 | ~15 | 🟡 High |

---

## Dependencies Analysis

### External Dependencies
- React (hooks)
- Zustand store (@/lib/stores/annotationStore)
- API clients (@/lib/api/*)
- Tool implementations (@/lib/annotation/tools/*)
- UI components (Magnifier, Diff*, ClassSelectorModal, etc.)
- Utility stores (toast, confirm)

### Internal Dependencies
- Canvas.tsx is a **central hub** connecting:
  - Store (state management)
  - Tools (drawing logic)
  - API (backend sync)
  - UI components (overlays, modals)
  - Event system (mouse, keyboard)

**Issue**: Too many responsibilities, violates Single Responsibility Principle

---

## Testing Status

**Current**: ❌ **ZERO tests**

**Why**:
- Impossible to unit test 4,100-line component
- Tightly coupled logic
- No pure functions
- State management scattered
- Event handlers depend on DOM

**After Refactoring**:
- ✅ Unit test utilities (coordinateTransform, geometry)
- ✅ Test hooks in isolation
- ✅ Test render components with mock data
- ✅ Test tool logic independently
- ✅ Integration test full canvas flow

---

## Performance Analysis

### Current Issues
- 🔴 **Excessive re-renders**: 81 state values trigger re-renders
- 🔴 **Large component re-render**: Full 4,100 lines re-execute
- 🔴 **Canvas re-draw**: useEffect draws entire canvas on any state change
- 🟡 **Event handler allocation**: New functions created on every render

### Performance Opportunities
- ✅ Memoize drawing functions
- ✅ Split into smaller components with React.memo
- ✅ Optimize state updates (batch, reduce frequency)
- ✅ Canvas rendering optimization (dirty rect tracking)
- ✅ Debounce/throttle mouse move events

---

## Risk Assessment

### High Risk Areas
1. **Mouse Handlers** (1,253 lines)
   - Risk: Breaking tool interactions
   - Mitigation: Incremental extraction with integration tests

2. **Keyboard Shortcuts** (588 lines)
   - Risk: Breaking shortcuts
   - Mitigation: Maintain compatibility table

3. **Image Lock Management** (126 lines in useEffect)
   - Risk: Race conditions, lock leaks
   - Mitigation: Careful async handling in hook

4. **Diff Mode Rendering** (scattered)
   - Risk: Breaking version comparison
   - Mitigation: Separate DiffRenderer component

### Breaking Change Risks
- **Low**: Internal refactoring, public API unchanged
- **Medium**: Store interface changes (if needed)
- **High**: Tool system refactoring (major change)

---

## Recommendations

### Immediate Actions (Week 1)
1. ✅ Extract utility functions → `utils/` (low risk)
2. ✅ Create custom hooks → `hooks/` (medium risk)
3. ✅ Extract drawing previews to tools (medium risk)

### Short-term (Week 2)
4. ✅ Split rendering logic → `renderers/` (medium risk)
5. ✅ Extract keyboard shortcuts → `useKeyboardShortcuts` (high risk)

### Medium-term (Week 3+)
6. ✅ Refactor tool system → Strategy Pattern (high risk)
7. ✅ Add comprehensive tests
8. ✅ Performance optimization

### Success Metrics
- Canvas.tsx: 4,100 → <500 lines (88% reduction)
- Largest function: 588 → <200 lines (66% reduction)
- Test coverage: 0% → >70%
- Component re-render frequency: -50%
- Build time: -20%

---

## Conclusion

Canvas.tsx requires **immediate refactoring**. Current state is:
- ❌ Unmaintainable (4,100 lines, 81 state values)
- ❌ Untestable (no unit tests possible)
- ❌ Unscalable (adding features touches 100+ lines)
- ❌ Error-prone (complex state interactions)

**Estimated Effort**: 40-60 hours over 2-3 weeks
**Priority**: 🔴 **CRITICAL**
**ROI**: High (improved maintainability, reduced bugs, easier features)

Next steps: Review target architecture in `canvas-architecture.md`
