# Canvas.tsx Refactoring - Migration Plan

**Document Version**: 1.0
**Created**: 2025-12-18
**Phase**: 18 (Canvas Architecture Refactoring)
**Estimated Duration**: 40-60 hours over 2-3 weeks

---

## Table of Contents

1. [Migration Overview](#migration-overview)
2. [Migration Principles](#migration-principles)
3. [Prerequisites](#prerequisites)
4. [Migration Phases](#migration-phases)
5. [Testing Strategy](#testing-strategy)
6. [Risk Mitigation](#risk-mitigation)
7. [Rollback Procedures](#rollback-procedures)
8. [Timeline & Milestones](#timeline--milestones)
9. [Success Criteria](#success-criteria)

---

## Migration Overview

### Current State
- **File**: `frontend/components/annotation/Canvas.tsx`
- **Size**: 4,100 lines
- **State Values**: 81 (37 useState + 44 store)
- **Test Coverage**: 0%
- **Maintainability**: 🔴 Critical

### Target State
- **Main Component**: <500 lines
- **Custom Hooks**: 7 hooks (~800 lines total)
- **Renderer Components**: 5 components (~600 lines total)
- **Utility Modules**: 4 modules (~400 lines total)
- **Test Coverage**: >70%
- **Maintainability**: ✅ Good

### Migration Strategy

**Approach**: **Incremental Extraction** (Safe, testable, reversible)

```
Phase 1: Extract Utilities (pure functions)
    ↓
Phase 2: Extract Custom Hooks (state & logic)
    ↓
Phase 3: Extract Renderer Components (UI)
    ↓
Phase 4: Refactor Tool System (strategy pattern)
    ↓
Phase 5: Add Comprehensive Tests
    ↓
Phase 6: Performance Optimization
```

**Key Principle**: Each phase produces a **working, deployable** version

---

## Migration Principles

### 1. **Backward Compatibility**
- Maintain existing API and behavior
- No breaking changes to external components
- Store interface remains unchanged

### 2. **Incremental Progress**
- Each extraction is a separate, testable commit
- Feature flag protection for risky changes
- Can deploy after each phase

### 3. **Test-Driven Migration**
- Write tests BEFORE refactoring
- Integration tests protect against regressions
- Unit tests ensure correctness

### 4. **Safety First**
- Always have rollback plan
- Keep old code commented until new code is proven
- Use feature branches, not direct commits to main

### 5. **Documentation**
- Update JSDoc for all extracted functions
- Document hook usage and dependencies
- Update architecture diagrams

---

## Prerequisites

### Before Starting

- [ ] **Backup Current State**
  - Create snapshot branch: `backup/canvas-pre-refactor`
  - Tag current commit: `v-canvas-before-refactor`
  - Document current behavior with screen recordings

- [ ] **Set Up Testing Infrastructure**
  - Install testing dependencies: `@testing-library/react`, `@testing-library/react-hooks`, `vitest` or `jest`
  - Configure test environment
  - Create test utilities and mocks

- [ ] **Create Feature Branch**
  - Branch: `feature/canvas-refactoring` ✅ (Already created)
  - Branch from: `develop`

- [ ] **Freeze New Features**
  - No new Canvas.tsx features during refactoring
  - Document any urgent bug fixes needed

- [ ] **Communication**
  - Notify team of refactoring timeline
  - Establish code review process
  - Set up daily progress tracking

---

## Migration Phases

### Phase 18.2: Extract Utility Functions (8-10h)

**Goal**: Extract pure functions with no state dependencies

**Status**: ⏸️ Pending

#### Step 1: Create Utility Modules (2h)

**Files to Create**:
```
frontend/lib/annotation/utils/
  ├── coordinateTransform.ts      # Canvas ↔ image coordinate conversion
  ├── geometryHelpers.ts          # Shape calculations (intersections, distances)
  ├── renderHelpers.ts            # Drawing utilities (grid, badges, shapes)
  └── annotationHelpers.ts        # Annotation data transformations
```

**Extract Functions**:

**`coordinateTransform.ts`** (~100 lines):
- `screenToCanvas(x, y, canvasRect)` - Screen → canvas coordinates
- `canvasToImage(x, y, zoom, pan)` - Canvas → image coordinates
- `imageToCanvas(x, y, zoom, pan)` - Image → canvas coordinates
- `canvasToScreen(x, y, canvasRect)` - Canvas → screen coordinates
- `getTransformMatrix(zoom, pan)` - Compute transformation matrix
- `applyTransform(points, matrix)` - Apply transformation to points

**`geometryHelpers.ts`** (~150 lines):
- `pointToLineDistance(point, lineStart, lineEnd)` - Distance from point to line segment
- `pointInPolygon(point, polygon)` - Point-in-polygon test (ray casting)
- `pointInBbox(point, bbox)` - Point-in-bounding-box test
- `pointNearCircle(point, circle, tolerance)` - Point near circle perimeter
- `bboxIntersection(bbox1, bbox2)` - Bbox intersection test
- `polygonIntersection(poly1, poly2)` - Polygon intersection test (SAT algorithm)
- `calculatePolygonArea(polygon)` - Polygon area calculation
- `calculateBboxArea(bbox)` - Bbox area calculation
- `normalizeAngle(angle)` - Normalize angle to [0, 2π]
- `calculateCircleFrom3Points(p1, p2, p3)` - 3-point circle calculation

**`renderHelpers.ts`** (~100 lines):
- `drawGrid(ctx, width, height, zoom, pan, gridSize)` - Draw canvas grid
- `drawCrosshair(ctx, x, y, size, color)` - Draw crosshair cursor
- `drawNoObjectBadge(ctx, x, y, width, height)` - Draw "No Object" badge
- `drawVertexHandle(ctx, x, y, size, selected)` - Draw polygon/polyline vertex
- `drawBboxHandle(ctx, x, y, size, handleType)` - Draw bbox resize handle
- `drawCircleHandle(ctx, x, y, size, handleType)` - Draw circle handle
- `setupCanvasContext(ctx, zoom)` - Set default canvas context properties

**`annotationHelpers.ts`** (~50 lines):
- `snapshotToAnnotation(snapshot)` - Convert snapshot format to annotation
- `annotationToSnapshot(annotation)` - Convert annotation to snapshot format
- `isAnnotationVisible(annotation, filters)` - Check if annotation should be displayed
- `sortAnnotationsByZIndex(annotations)` - Sort annotations for rendering order
- `calculateAnnotationBounds(annotation)` - Get bounding box of any annotation type

#### Step 2: Write Unit Tests (3h)

**Test Files**:
```
frontend/lib/annotation/utils/__tests__/
  ├── coordinateTransform.test.ts
  ├── geometryHelpers.test.ts
  ├── renderHelpers.test.ts
  └── annotationHelpers.test.ts
```

**Test Coverage Target**: >90% for utility functions

**Example Test**:
```typescript
describe('coordinateTransform', () => {
  describe('canvasToImage', () => {
    it('should convert canvas coordinates to image coordinates', () => {
      const result = canvasToImage(100, 100, 2.0, { x: 50, y: 50 });
      expect(result).toEqual({ x: 25, y: 25 });
    });

    it('should handle negative coordinates', () => {
      const result = canvasToImage(-50, -50, 1.0, { x: 0, y: 0 });
      expect(result).toEqual({ x: -50, y: -50 });
    });
  });
});
```

#### Step 3: Extract Functions from Canvas.tsx (3h)

**Process**:
1. Copy function implementation to utility module
2. Import utility function in Canvas.tsx
3. Replace inline function with imported utility
4. Run tests to verify behavior
5. Commit: `refactor: Extract [function] to [module]`

**Example**:
```typescript
// Before (in Canvas.tsx)
const canvasToImage = (x: number, y: number) => {
  return {
    x: (x - canvasState.pan.x) / canvasState.zoom,
    y: (y - canvasState.pan.y) / canvasState.zoom,
  };
};

// After (Canvas.tsx)
import { canvasToImage } from '@/lib/annotation/utils/coordinateTransform';

// Function removed from Canvas.tsx
```

#### Step 4: Verify Integration (2h)

- [ ] Manual testing: All tools work correctly
- [ ] Integration test: Canvas rendering unchanged
- [ ] Performance test: No performance regression
- [ ] Code review
- [ ] Commit: `refactor: Complete utility extraction (Phase 18.2)`

**Expected Outcome**:
- Canvas.tsx: 4,100 → ~3,700 lines (-400 lines)
- 4 new utility modules: ~400 lines
- Test coverage: 0% → ~10%

---

### Phase 18.3: Extract Custom Hooks (12-16h)

**Goal**: Extract state management and side effects into custom hooks

**Status**: ⏸️ Pending

**Dependencies**: Phase 18.2 complete

#### Step 1: Create Hook Structure (1h)

**Files to Create**:
```
frontend/lib/annotation/hooks/
  ├── useCanvasState.ts           # Local state management
  ├── useCanvasTransform.ts       # Zoom, pan, cursor state
  ├── useToolState.ts             # Tool-specific state
  ├── useCanvasEvents.ts          # Mouse/keyboard event handlers
  ├── useCanvasGestures.ts        # High-level gestures (pan, zoom)
  ├── useImageManagement.ts       # Image loading & locking
  └── useAnnotationSync.ts        # Version conflict & sync
```

#### Step 2: Extract `useCanvasState` (2h)

**Purpose**: Central state management for Canvas component

**State to Extract**:
- `showClassSelector`
- `canvasCursor`
- `cursorPos`
- All tool-specific local states (consolidate into `toolState`)

**API Design**:
```typescript
const {
  showClassSelector,
  setShowClassSelector,
  canvasCursor,
  setCanvasCursor,
  cursorPos,
  setCursorPos,
  toolState,
  updateToolState,
  resetToolState,
} = useCanvasState();
```

**Implementation**:
```typescript
// frontend/lib/annotation/hooks/useCanvasState.ts
export function useCanvasState() {
  const [showClassSelector, setShowClassSelector] = useState(false);
  const [canvasCursor, setCanvasCursor] = useState<string>('default');
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

  // Consolidated tool state (replaces 20+ individual useState)
  const [toolState, setToolState] = useState<ToolState>({
    // Bbox tool
    pendingBbox: null,
    isResizing: false,
    resizeHandle: null,

    // Polygon tool
    polygonVertices: [],
    isDraggingVertex: false,
    draggedVertexIndex: null,

    // Circle tool
    circleCenter: null,
    circle3pPoints: [],

    // ... etc
  });

  const updateToolState = useCallback((updates: Partial<ToolState>) => {
    setToolState(prev => ({ ...prev, ...updates }));
  }, []);

  const resetToolState = useCallback(() => {
    setToolState(getInitialToolState());
  }, []);

  return {
    showClassSelector,
    setShowClassSelector,
    canvasCursor,
    setCanvasCursor,
    cursorPos,
    setCursorPos,
    toolState,
    updateToolState,
    resetToolState,
  };
}
```

**Testing**:
```typescript
// useCanvasState.test.ts
describe('useCanvasState', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => useCanvasState());
    expect(result.current.showClassSelector).toBe(false);
    expect(result.current.canvasCursor).toBe('default');
  });

  it('should update tool state', () => {
    const { result } = renderHook(() => useCanvasState());
    act(() => {
      result.current.updateToolState({ pendingBbox: { x: 0, y: 0, width: 100, height: 100 } });
    });
    expect(result.current.toolState.pendingBbox).toBeDefined();
  });
});
```

#### Step 3: Extract `useCanvasTransform` (2h)

**Purpose**: Pan, zoom, and coordinate transformation

**API Design**:
```typescript
const {
  zoom,
  pan,
  setZoom,
  setPan,
  zoomIn,
  zoomOut,
  resetView,
  fitToScreen,
  canvasToImage,
  imageToCanvas,
} = useCanvasTransform(imageRef, canvasRef);
```

**Implementation** (~150 lines):
- Encapsulates zoom/pan state
- Provides transformation utilities
- Integrates with store (`setZoom`, `setPan`)
- Handles zoom constraints (min/max)

#### Step 4: Extract `useToolState` (2h)

**Purpose**: Tool-specific state management

**API Design**:
```typescript
const {
  currentTool,
  toolConfig,
  toolState,
  updateToolState,
  resetTool,
  switchTool,
} = useToolState();
```

**Implementation** (~120 lines):
- Manages tool-specific state
- Tool lifecycle (enter, exit, reset)
- Tool configuration (e.g., circle tool: 3-point vs center-radius)

#### Step 5: Extract `useCanvasEvents` (3h)

**Purpose**: Mouse and keyboard event handlers

**API Design**:
```typescript
const {
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleWheel,
  handleKeyDown,
  handleKeyUp,
} = useCanvasEvents({
  canvasRef,
  imageRef,
  toolState,
  updateToolState,
  // ... other dependencies
});
```

**Implementation** (~300 lines):
- Still tool-based dispatch (will be refactored in Phase 18.5)
- Uses extracted utilities for coordinate conversion
- Integrates with hooks for state updates

**Note**: This is a transitional step. Event handlers will still be large, but extracted from Canvas.tsx. Full refactoring happens in Phase 18.5 (Tool System).

#### Step 6: Extract `useCanvasGestures` (1h)

**Purpose**: High-level gesture handling (pan, pinch-zoom)

**API Design**:
```typescript
const {
  isPanning,
  startPan,
  updatePan,
  endPan,
  handlePinchZoom,
} = useCanvasGestures(canvasRef);
```

**Implementation** (~80 lines):
- Pan gesture state machine
- Touch gesture support (future)
- Integrates with `useCanvasTransform`

#### Step 7: Extract `useImageManagement` (2h)

**Purpose**: Image loading, caching, and locking

**API Design**:
```typescript
const {
  image,
  imageLoaded,
  isImageLocked,
  lockedByUser,
  showLockedDialog,
  lockImage,
  releaseImage,
} = useImageManagement(currentImage);
```

**Implementation** (~150 lines):
- Image loading with retry logic
- Lock acquisition and heartbeat
- Lock release on unmount
- Extracts the 126-line useEffect from Canvas.tsx

#### Step 8: Extract `useAnnotationSync` (2h)

**Purpose**: Annotation version conflict detection and resolution

**API Design**:
```typescript
const {
  isSaving,
  conflictDialogOpen,
  conflictInfo,
  updateAnnotationWithVersionCheck,
  resolveConflict,
} = useAnnotationSync();
```

**Implementation** (~120 lines):
- Version conflict detection
- Server sync with retry
- Conflict resolution UI integration
- Extracts `updateAnnotationWithVersionCheck` function

#### Step 9: Integration & Testing (3h)

**Update Canvas.tsx**:
```typescript
// Before: 37 useState, 4 useEffect (scattered)

// After: 7 custom hooks
const canvasState = useCanvasState();
const transform = useCanvasTransform(imageRef, canvasRef);
const toolState = useToolState();
const events = useCanvasEvents({ /* dependencies */ });
const gestures = useCanvasGestures(canvasRef);
const imageManagement = useImageManagement(currentImage);
const annotationSync = useAnnotationSync();
```

**Testing**:
- [ ] Unit tests for each hook
- [ ] Integration test: Canvas with all hooks
- [ ] Manual testing: All features work
- [ ] Performance test: No regression

**Expected Outcome**:
- Canvas.tsx: ~3,700 → ~2,500 lines (-1,200 lines)
- 7 new hooks: ~800 lines
- Test coverage: ~10% → ~40%

---

### Phase 18.4: Extract Renderer Components (8-10h)

**Goal**: Split rendering logic into specialized components

**Status**: ⏸️ Pending

**Dependencies**: Phase 18.3 complete

#### Step 1: Create Renderer Components (1h)

**Files to Create**:
```
frontend/components/annotation/renderers/
  ├── CanvasRenderer.tsx          # Main canvas + grid + annotations
  ├── ToolOverlay.tsx             # Tool-specific overlays (previews)
  ├── MagnifierOverlay.tsx        # Magnifier component
  ├── LockOverlay.tsx             # Image lock warning
  └── DiffRenderer.tsx            # Diff mode rendering
```

#### Step 2: Extract `CanvasRenderer` (3h)

**Purpose**: Core canvas rendering (grid, image, annotations)

**Props**:
```typescript
interface CanvasRendererProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  imageRef: RefObject<HTMLImageElement>;
  width: number;
  height: number;
  zoom: number;
  pan: { x: number; y: number };
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  showGrid?: boolean;
}
```

**Implementation** (~200 lines):
- Encapsulates the rendering useEffect
- Uses `renderHelpers` utilities
- Memoized with `React.memo`
- Implements dirty rect tracking (optimization)

**Extract from Canvas.tsx**:
- Rendering useEffect (166 lines)
- `drawAnnotations` function (126 lines)
- `drawGrid` function (32 lines)

#### Step 3: Extract `ToolOverlay` (2h)

**Purpose**: Tool-specific drawing previews

**Props**:
```typescript
interface ToolOverlayProps {
  canvasRef: RefObject<HTMLCanvasElement>;
  tool: ToolType;
  toolState: ToolState;
  zoom: number;
  pan: { x: number; y: number };
}
```

**Implementation** (~150 lines):
- Separate canvas layer (overlay)
- Renders tool-specific previews:
  - Bbox: pending bbox
  - Polygon: current vertices + line to cursor
  - Polyline: current vertices + line to cursor
  - Circle: circle preview
  - Circle3p: arc through points
- Uses `renderHelpers` utilities

**Extract from Canvas.tsx**:
- `drawBboxPreview` (30 lines)
- `drawPolygonPreview` (31 lines)
- `drawPolylinePreview` (31 lines)
- `drawCirclePreview` (31 lines)
- `drawCircle3pPreview` (31 lines)

#### Step 4: Extract `MagnifierOverlay` (1h)

**Purpose**: Magnifier component (already separate, just refactor)

**Changes**:
- Move from inline JSX to separate file
- Add proper TypeScript types
- Add tests

#### Step 5: Extract `LockOverlay` (1h)

**Purpose**: Image lock warning overlay

**Changes**:
- Extract lock warning UI from Canvas.tsx JSX
- Create dedicated component
- Add tests

#### Step 6: Extract `DiffRenderer` (2h)

**Purpose**: Version diff rendering (already exists, refactor)

**Changes**:
- Integrate with new architecture
- Use extracted utilities
- Simplify prop passing

#### Step 7: Update Canvas.tsx JSX (1h)

**Before** (547 lines of JSX):
```tsx
return (
  <div>
    {/* Complex canvas rendering inline */}
    {/* Multiple conditional overlays */}
    {/* Modals */}
  </div>
);
```

**After** (~100 lines of JSX):
```tsx
return (
  <div ref={containerRef} className="relative">
    <CanvasRenderer
      canvasRef={canvasRef}
      imageRef={imageRef}
      width={canvasState.width}
      height={canvasState.height}
      zoom={transform.zoom}
      pan={transform.pan}
      annotations={annotations}
      selectedAnnotationId={selectedAnnotationId}
      showGrid={preferences.showGrid}
    />

    <ToolOverlay
      canvasRef={canvasRef}
      tool={tool}
      toolState={toolState}
      zoom={transform.zoom}
      pan={transform.pan}
    />

    {shouldShowMagnifier && (
      <MagnifierOverlay
        canvasRef={canvasRef}
        imageRef={imageRef}
        cursorPos={canvasState.cursorPos}
        magnification={magnification}
      />
    )}

    {isImageLocked && (
      <LockOverlay
        lockedByUser={imageManagement.lockedByUser}
        onClose={() => setShowLockedDialog(false)}
      />
    )}

    {diffMode && (
      <DiffRenderer
        currentAnnotations={annotations}
        diffData={getDiffForCurrentImage()}
      />
    )}

    <ClassSelectorModal
      isOpen={canvasState.showClassSelector}
      onSelect={handleClassSelect}
      onClose={handleClassSelectorClose}
    />
  </div>
);
```

**Expected Outcome**:
- Canvas.tsx: ~2,500 → ~1,200 lines (-1,300 lines)
- 5 new renderer components: ~600 lines
- Test coverage: ~40% → ~55%

---

### Phase 18.5: Refactor Tool System (10-12h)

**Goal**: Implement Strategy Pattern for tool logic

**Status**: ⏸️ Pending

**Dependencies**: Phase 18.4 complete

**Note**: This is the **highest risk** phase. Requires careful planning.

#### Step 1: Design Tool Interface (2h)

**Create Base Tool Class**:
```typescript
// frontend/lib/annotation/tools/BaseTool.ts

export interface ToolContext {
  // Canvas state
  canvasRef: RefObject<HTMLCanvasElement>;
  imageRef: RefObject<HTMLImageElement>;

  // Transformation
  zoom: number;
  pan: { x: number; y: number };
  canvasToImage: (x: number, y: number) => { x: number; y: number };
  imageToCanvas: (x: number, y: number) => { x: number; y: number };

  // State management
  toolState: ToolState;
  updateToolState: (updates: Partial<ToolState>) => void;

  // Annotation management
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  selectAnnotation: (id: string | null) => void;

  // UI
  setShowClassSelector: (show: boolean) => void;
  setCursor: (cursor: string) => void;
}

export abstract class BaseTool {
  protected context: ToolContext;

  constructor(context: ToolContext) {
    this.context = context;
  }

  // Lifecycle
  onActivate(): void {}
  onDeactivate(): void {}

  // Event handlers
  abstract onMouseDown(e: React.MouseEvent<HTMLCanvasElement>): void;
  abstract onMouseMove(e: React.MouseEvent<HTMLCanvasElement>): void;
  abstract onMouseUp(e: React.MouseEvent<HTMLCanvasElement>): void;

  // Optional handlers
  onKeyDown?(e: KeyboardEvent): void;
  onKeyUp?(e: KeyboardEvent): void;

  // Rendering
  abstract render(ctx: CanvasRenderingContext2D): void;
}
```

#### Step 2: Implement Tool Classes (6h)

**Create Tool Implementations**:
```
frontend/lib/annotation/tools/
  ├── BaseTool.ts                 # Base class + interface
  ├── SelectTool.ts               # Selection, vertex drag, bbox resize
  ├── BboxTool.ts                 # Bbox drawing
  ├── PolygonTool.ts              # Polygon drawing
  ├── PolylineTool.ts             # Polyline drawing
  ├── CircleTool.ts               # Circle drawing (center + radius)
  ├── Circle3pTool.ts             # Circle drawing (3 points)
  ├── PanTool.ts                  # Pan gesture
  └── ToolRegistry.ts             # Tool factory + registry
```

**Example Implementation** - `BboxTool.ts`:
```typescript
export class BboxTool extends BaseTool {
  onActivate() {
    this.context.setCursor('crosshair');
  }

  onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return; // Left click only

    const rect = this.context.canvasRef.current!.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const imgPos = this.context.canvasToImage(canvasX, canvasY);

    // Start bbox drawing
    this.context.updateToolState({
      pendingBbox: {
        x: imgPos.x,
        y: imgPos.y,
        width: 0,
        height: 0,
      },
      isDrawing: true,
    });
  }

  onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const { pendingBbox, isDrawing } = this.context.toolState;
    if (!isDrawing || !pendingBbox) return;

    const rect = this.context.canvasRef.current!.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    const imgPos = this.context.canvasToImage(canvasX, canvasY);

    // Update bbox size
    this.context.updateToolState({
      pendingBbox: {
        ...pendingBbox,
        width: imgPos.x - pendingBbox.x,
        height: imgPos.y - pendingBbox.y,
      },
    });
  }

  onMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    const { pendingBbox } = this.context.toolState;
    if (!pendingBbox) return;

    // Normalize bbox (handle negative width/height)
    const normalizedBbox = normalizeBbox(pendingBbox);

    // Validate minimum size (e.g., 5x5 pixels)
    if (normalizedBbox.width < 5 || normalizedBbox.height < 5) {
      this.context.updateToolState({ pendingBbox: null, isDrawing: false });
      return;
    }

    // Show class selector
    this.context.setShowClassSelector(true);
    this.context.updateToolState({ isDrawing: false });
  }

  render(ctx: CanvasRenderingContext2D) {
    const { pendingBbox } = this.context.toolState;
    if (!pendingBbox) return;

    // Draw preview bbox
    const topLeft = this.context.imageToCanvas(pendingBbox.x, pendingBbox.y);
    const bottomRight = this.context.imageToCanvas(
      pendingBbox.x + pendingBbox.width,
      pendingBbox.y + pendingBbox.height
    );

    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(
      topLeft.x,
      topLeft.y,
      bottomRight.x - topLeft.x,
      bottomRight.y - topLeft.y
    );
    ctx.setLineDash([]);
  }
}
```

**Tool Registry**:
```typescript
// ToolRegistry.ts
export class ToolRegistry {
  private tools: Map<ToolType, typeof BaseTool> = new Map();

  register(type: ToolType, toolClass: typeof BaseTool) {
    this.tools.set(type, toolClass);
  }

  createTool(type: ToolType, context: ToolContext): BaseTool {
    const ToolClass = this.tools.get(type);
    if (!ToolClass) {
      throw new Error(`Tool not registered: ${type}`);
    }
    return new ToolClass(context);
  }
}

// Initialize registry
const registry = new ToolRegistry();
registry.register('select', SelectTool);
registry.register('bbox', BboxTool);
registry.register('polygon', PolygonTool);
// ... etc
```

#### Step 3: Update Canvas Event Handlers (2h)

**Before** (in Canvas.tsx):
```typescript
const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
  // 535 lines of tool-specific logic
  if (tool === 'bbox') {
    // bbox logic
  } else if (tool === 'polygon') {
    // polygon logic
  }
  // ... etc
};
```

**After**:
```typescript
const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
  const currentTool = toolRegistry.createTool(tool, toolContext);
  currentTool.onMouseDown(e);
};

const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
  const currentTool = toolRegistry.createTool(tool, toolContext);
  currentTool.onMouseMove(e);
};

const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
  const currentTool = toolRegistry.createTool(tool, toolContext);
  currentTool.onMouseUp(e);
};
```

**Optimization**: Cache tool instances instead of creating on every event
```typescript
// In Canvas component or custom hook
const [toolInstance, setToolInstance] = useState<BaseTool | null>(null);

useEffect(() => {
  // Create tool instance when tool changes
  const instance = toolRegistry.createTool(tool, toolContext);
  instance.onActivate();
  setToolInstance(instance);

  return () => {
    instance.onDeactivate();
  };
}, [tool]);

const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
  toolInstance?.onMouseDown(e);
};
```

#### Step 4: Testing (2h)

- [ ] Unit test each tool class
- [ ] Integration test tool switching
- [ ] Manual testing: All tools work
- [ ] Performance test: No regression

**Expected Outcome**:
- Canvas.tsx: ~1,200 → ~500 lines (-700 lines)
- Tool classes: ~600 lines
- Test coverage: ~55% → ~65%

---

### Phase 18.6: Add Comprehensive Tests (6-8h)

**Goal**: Achieve >70% test coverage

**Status**: ⏸️ Pending

**Dependencies**: Phase 18.5 complete

#### Test Coverage Targets

| Module | Coverage Target | Estimated Time |
|--------|----------------|----------------|
| Utility functions | >90% | 2h |
| Custom hooks | >80% | 2h |
| Renderer components | >70% | 2h |
| Tool classes | >80% | 2h |

#### Test Strategy

**1. Unit Tests**:
- All utility functions (pure functions → easy to test)
- All custom hooks (using `@testing-library/react-hooks`)
- All tool classes (mock context, test event handlers)

**2. Integration Tests**:
- Canvas component with all hooks
- Tool switching flow
- Annotation creation flow
- Pan/zoom interaction

**3. Visual Regression Tests** (Optional):
- Snapshot tests for rendering output
- Use `canvas-to-image` library for canvas snapshots

**4. E2E Tests** (Optional, future work):
- Full annotation workflow
- User interaction flows

#### Test Examples

**Utility Test**:
```typescript
describe('geometryHelpers', () => {
  describe('pointInPolygon', () => {
    it('should return true for point inside polygon', () => {
      const polygon = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
      const point = { x: 50, y: 50 };
      expect(pointInPolygon(point, polygon)).toBe(true);
    });

    it('should return false for point outside polygon', () => {
      const polygon = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
      const point = { x: 150, y: 150 };
      expect(pointInPolygon(point, polygon)).toBe(false);
    });
  });
});
```

**Hook Test**:
```typescript
describe('useCanvasTransform', () => {
  it('should initialize with default zoom and pan', () => {
    const { result } = renderHook(() => useCanvasTransform(imageRef, canvasRef));
    expect(result.current.zoom).toBe(1.0);
    expect(result.current.pan).toEqual({ x: 0, y: 0 });
  });

  it('should zoom in correctly', () => {
    const { result } = renderHook(() => useCanvasTransform(imageRef, canvasRef));
    act(() => {
      result.current.zoomIn();
    });
    expect(result.current.zoom).toBeGreaterThan(1.0);
  });
});
```

**Tool Test**:
```typescript
describe('BboxTool', () => {
  let tool: BboxTool;
  let mockContext: ToolContext;

  beforeEach(() => {
    mockContext = createMockToolContext();
    tool = new BboxTool(mockContext);
  });

  it('should start bbox drawing on mouse down', () => {
    const event = createMockMouseEvent({ clientX: 100, clientY: 100 });
    tool.onMouseDown(event);
    expect(mockContext.updateToolState).toHaveBeenCalledWith({
      pendingBbox: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      isDrawing: true,
    });
  });

  it('should update bbox size on mouse move', () => {
    // Simulate drawing start
    mockContext.toolState.pendingBbox = { x: 0, y: 0, width: 0, height: 0 };
    mockContext.toolState.isDrawing = true;

    const event = createMockMouseEvent({ clientX: 150, clientY: 150 });
    tool.onMouseMove(event);

    expect(mockContext.updateToolState).toHaveBeenCalledWith({
      pendingBbox: expect.objectContaining({
        width: expect.any(Number),
        height: expect.any(Number),
      }),
    });
  });
});
```

**Integration Test**:
```typescript
describe('Canvas Integration', () => {
  it('should render canvas with annotations', () => {
    const annotations = [
      createMockAnnotation({ type: 'bbox', geometry: { x: 10, y: 10, width: 50, height: 50 } }),
    ];

    render(<Canvas annotations={annotations} />);

    const canvas = screen.getByRole('img'); // Canvas has role="img" for accessibility
    expect(canvas).toBeInTheDocument();
  });

  it('should switch tools correctly', () => {
    const { rerender } = render(<Canvas tool="select" />);

    // Initially select tool
    expect(screen.getByRole('img')).toHaveStyle({ cursor: 'default' });

    // Switch to bbox tool
    rerender(<Canvas tool="bbox" />);
    expect(screen.getByRole('img')).toHaveStyle({ cursor: 'crosshair' });
  });
});
```

---

### Phase 18.7: Performance Optimization (4-6h)

**Goal**: Improve rendering performance and reduce re-renders

**Status**: ⏸️ Pending

**Dependencies**: Phase 18.6 complete

#### Optimization Strategies

**1. Memoization** (2h):
- Wrap all renderer components with `React.memo`
- Use `useMemo` for expensive calculations
- Use `useCallback` for event handlers passed as props

**Example**:
```typescript
export const CanvasRenderer = React.memo<CanvasRendererProps>(
  ({ canvasRef, annotations, zoom, pan }) => {
    // Component implementation
  },
  (prevProps, nextProps) => {
    // Custom comparison function
    return (
      prevProps.zoom === nextProps.zoom &&
      prevProps.pan.x === nextProps.pan.x &&
      prevProps.pan.y === nextProps.pan.y &&
      shallowEqual(prevProps.annotations, nextProps.annotations)
    );
  }
);
```

**2. Canvas Optimization** (2h):
- Implement dirty rect tracking (only redraw changed regions)
- Use offscreen canvas for static content (grid, image)
- Debounce/throttle mouse move events

**Dirty Rect Example**:
```typescript
// Track which canvas regions need redraw
const dirtyRects: Rect[] = [];

function markDirty(rect: Rect) {
  dirtyRects.push(rect);
}

function render(ctx: CanvasRenderingContext2D) {
  if (dirtyRects.length === 0) return; // Nothing to redraw

  // Clear and redraw only dirty regions
  for (const rect of dirtyRects) {
    ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
    renderRegion(ctx, rect);
  }

  dirtyRects.length = 0; // Clear dirty rects
}
```

**3. State Update Optimization** (1h):
- Batch state updates where possible
- Reduce unnecessary store subscriptions
- Use Zustand selectors efficiently

**4. Performance Monitoring** (1h):
- Add React DevTools Profiler
- Measure render times
- Set performance budgets (e.g., <16ms per frame for 60fps)

---

## Testing Strategy

### Test Pyramid

```
        E2E Tests (5%)
       /              \
      /   Integration   \
     /     Tests (20%)   \
    /                     \
   /____ Unit Tests (75%) ___\
```

### Test Coverage Goals

| Phase | Module | Coverage | Tests |
|-------|--------|----------|-------|
| 18.2 | Utilities | >90% | 40+ |
| 18.3 | Hooks | >80% | 30+ |
| 18.4 | Renderers | >70% | 20+ |
| 18.5 | Tools | >80% | 35+ |
| **Total** | | **>70%** | **125+** |

### Testing Tools

- **Unit Tests**: Vitest or Jest
- **React Testing**: @testing-library/react, @testing-library/react-hooks
- **Mocking**: vi.mock or jest.mock
- **Canvas Testing**: canvas-mock, jest-canvas-mock
- **Coverage**: c8 or jest --coverage

### Continuous Testing

**During Migration**:
- Run tests after each extraction
- Use watch mode during development
- Pre-commit hook: lint + test

**After Migration**:
- CI/CD pipeline: tests must pass before merge
- Coverage gating: block PR if coverage drops below 70%

---

## Risk Mitigation

### Risk 1: Breaking Tool Interactions

**Risk Level**: 🔴 High

**Mitigation**:
- Comprehensive manual testing after each tool extraction
- Record screen videos of current behavior as reference
- Integration tests for tool workflows
- Feature flag for new tool system (toggle between old/new)

**Rollback Plan**:
- Keep old event handlers commented in Canvas.tsx
- Feature flag: `USE_NEW_TOOL_SYSTEM = false`
- Revert commit if critical bugs found

### Risk 2: Performance Regression

**Risk Level**: 🟡 Medium

**Mitigation**:
- Benchmark current performance before refactoring
- Monitor performance after each phase
- Use React DevTools Profiler
- Set performance budgets (e.g., <100ms for annotation rendering)

**Rollback Plan**:
- Revert optimization changes if performance degrades
- Investigate bottlenecks with profiler
- Consider partial rollback of specific changes

### Risk 3: State Synchronization Issues

**Risk Level**: 🟡 Medium

**Mitigation**:
- Carefully track state flow during extraction
- Use TypeScript for type safety
- Add runtime assertions for critical state
- Integration tests for state updates

**Rollback Plan**:
- Revert to previous hook version
- Re-examine state dependencies
- Add logging to track state changes

### Risk 4: Testing Infrastructure Delays

**Risk Level**: 🟢 Low

**Mitigation**:
- Set up testing infrastructure in Phase 18.2 (first phase)
- Start with simple utility tests to validate setup
- Document testing patterns and examples

**Rollback Plan**:
- If testing setup is blocked, continue with manual testing
- Prioritize critical path tests
- Defer comprehensive tests to Phase 18.6

### Risk 5: Scope Creep

**Risk Level**: 🟡 Medium

**Mitigation**:
- Stick to refactoring only (no new features)
- Document any "nice to have" improvements for future work
- Time-box each phase
- Regular check-ins with team

**Rollback Plan**:
- Cut scope if timeline exceeds 3 weeks
- Defer Phase 18.7 (optimization) if needed
- Deliver working product after Phase 18.5

---

## Rollback Procedures

### Rollback Triggers

Rollback if any of the following occur:
- Critical bug in production affecting users
- Performance degradation >20%
- Test coverage drops below 50%
- Timeline exceeds 4 weeks
- Team consensus to pause refactoring

### Rollback Steps

#### Immediate Rollback (Production Issue)

1. **Revert Deployment**:
   ```bash
   git checkout main
   git revert <merge-commit-sha>
   git push origin main
   ```

2. **Notify Team**:
   - Slack/email: "Canvas refactoring rolled back due to [reason]"
   - Document issue in GitHub issue

3. **Deploy Previous Version**:
   - Deploy previous stable commit
   - Verify production is stable

4. **Post-Mortem**:
   - Identify root cause
   - Add regression test
   - Plan fix

#### Partial Rollback (Specific Phase)

1. **Identify Problematic Phase**:
   - e.g., "Phase 18.5 (Tool System) causing issues"

2. **Revert Phase Commits**:
   ```bash
   git revert <phase-start-commit>..<phase-end-commit>
   ```

3. **Keep Previous Phases**:
   - Phases 18.2-18.4 remain in codebase
   - Only revert problematic phase

4. **Document Reason**:
   - Update `docs/ANNOTATION_IMPLEMENTATION_TODO.md`
   - Mark phase as ⏭️ Deferred with reason

#### Feature Flag Rollback

1. **Toggle Feature Flag**:
   ```typescript
   // frontend/lib/featureFlags.ts
   export const USE_NEW_TOOL_SYSTEM = false; // Rollback
   ```

2. **Deploy with Flag Disabled**:
   - New code remains in codebase
   - Old code path is active

3. **Investigate Issue**:
   - Debug new code without affecting users
   - Re-enable flag when fixed

---

## Timeline & Milestones

### Estimated Timeline: 40-60 hours over 2-3 weeks

```
Week 1 (20-24h):
  ├── Phase 18.2: Extract Utilities (8-10h)
  └── Phase 18.3: Extract Hooks (12-16h)

Week 2 (18-22h):
  ├── Phase 18.4: Extract Renderers (8-10h)
  └── Phase 18.5: Refactor Tools (10-12h)

Week 3 (10-14h):
  ├── Phase 18.6: Add Tests (6-8h)
  └── Phase 18.7: Optimize (4-6h)
```

### Milestones

| Milestone | Completion Criteria | Target Date |
|-----------|---------------------|-------------|
| **M1: Utilities Extracted** | Phase 18.2 complete, 4 utility modules, tests pass | Week 1, Day 3 |
| **M2: Hooks Extracted** | Phase 18.3 complete, 7 hooks, Canvas.tsx <2,500 lines | Week 1, End |
| **M3: Renderers Extracted** | Phase 18.4 complete, 5 components, Canvas.tsx <1,200 lines | Week 2, Day 3 |
| **M4: Tools Refactored** | Phase 18.5 complete, Strategy Pattern implemented, Canvas.tsx <500 lines | Week 2, End |
| **M5: Tests Complete** | Phase 18.6 complete, >70% coverage | Week 3, Day 2 |
| **M6: Optimization Complete** | Phase 18.7 complete, performance validated | Week 3, End |

### Daily Checklist

**Each Day**:
- [ ] Run full test suite
- [ ] Manual smoke test (create 1 annotation of each type)
- [ ] Update `docs/ANNOTATION_IMPLEMENTATION_TODO.md` with progress
- [ ] Commit with descriptive message
- [ ] Push to feature branch

**End of Each Phase**:
- [ ] Code review (self or peer)
- [ ] Update progress percentage in TODO
- [ ] Tag commit: `phase-18.X-complete`
- [ ] Document any deviations or issues

---

## Success Criteria

### Quantitative Metrics

| Metric | Current | Target | Success |
|--------|---------|--------|---------|
| **Canvas.tsx Lines** | 4,100 | <500 | ✅ >88% reduction |
| **Largest Function** | 588 lines | <200 | ✅ >66% reduction |
| **Test Coverage** | 0% | >70% | ✅ Comprehensive tests |
| **State Values** | 81 | <30 | ✅ Simplified state |
| **Re-render Frequency** | High | -50% | ✅ Performance improved |
| **Build Time** | Baseline | -20% | ✅ Faster builds |

### Qualitative Metrics

- ✅ **Maintainability**: New features can be added without touching Canvas.tsx
- ✅ **Testability**: All business logic has unit tests
- ✅ **Readability**: Code is self-documenting, clear abstractions
- ✅ **Modularity**: Components can be reused independently
- ✅ **Type Safety**: Full TypeScript coverage, no `any` types
- ✅ **Documentation**: All modules have JSDoc comments

### Acceptance Criteria

**Phase 18 Complete** when:
1. Canvas.tsx is <500 lines
2. All 7 hooks extracted and tested
3. All 5 renderers extracted and tested
4. Tool system uses Strategy Pattern
5. Test coverage >70%
6. No performance regression
7. All existing features work identically
8. Documentation updated (architecture diagrams, JSDoc)

### Definition of Done

**Each Phase** is done when:
- [ ] Code written and committed
- [ ] Tests written and passing
- [ ] Code reviewed (self or peer)
- [ ] Documentation updated
- [ ] Manual testing completed
- [ ] Progress logged in TODO document
- [ ] No known critical bugs

---

## Post-Migration Tasks

### After Phase 18 Complete

1. **Update Documentation**:
   - Architecture diagrams (new component structure)
   - Developer guide (how to add new tools)
   - Contribution guidelines

2. **Team Training**:
   - Demo new architecture to team
   - Document patterns and conventions
   - Create examples of common tasks

3. **Monitoring**:
   - Monitor production for issues (1-2 weeks)
   - Collect user feedback
   - Performance monitoring

4. **Future Improvements**:
   - Touch gesture support (mobile)
   - Keyboard shortcut customization
   - Tool plugin system (external tools)
   - Advanced undo/redo (per-tool history)

---

## Conclusion

This migration plan provides a **safe, incremental, and testable** approach to refactoring Canvas.tsx from 4,100 lines to <500 lines.

**Key Principles**:
- ✅ Backward compatibility at all times
- ✅ Each phase produces a working, deployable version
- ✅ Comprehensive testing throughout
- ✅ Clear rollback procedures
- ✅ Risk mitigation strategies

**Expected Outcome**:
- 🎯 88% code reduction (4,100 → <500 lines)
- 🎯 >70% test coverage (0% → 70%+)
- 🎯 Improved maintainability and scalability
- 🎯 Better performance (fewer re-renders)
- 🎯 Easier onboarding for new developers

**Timeline**: 40-60 hours over 2-3 weeks

**Next Steps**: Begin Phase 18.2 (Extract Utility Functions)

---

**Document Status**: ✅ Complete
**Ready to Begin**: Phase 18.2 (Extract Utility Functions)
