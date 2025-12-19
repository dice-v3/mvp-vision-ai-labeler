# Canvas Architecture - Target Design

**Design Date**: 2025-12-10
**Phase**: 18 - Canvas Architecture Refactoring
**Goal**: Reduce Canvas.tsx from 4,100 to <500 lines

---

## Architecture Overview

```
frontend/components/annotation/
├── Canvas.tsx                     (<500 lines) - Main orchestration
├── hooks/                         (Custom hooks for logic)
│   ├── useCanvasState.ts         (State management)
│   ├── useCanvasTransform.ts     (Zoom/pan/coordinates)
│   ├── useToolState.ts           (Tool-specific state)
│   ├── useCanvasEvents.ts        (Mouse/keyboard events)
│   ├── useCanvasGestures.ts      (Pan/zoom gestures)
│   ├── useImageManagement.ts     (Image loading/lock)
│   └── useAnnotationSync.ts      (Backend sync)
├── renderers/                     (Rendering components)
│   ├── CanvasRenderer.tsx        (Core canvas rendering)
│   ├── ToolOverlay.tsx           (Tool-specific overlays)
│   ├── MagnifierOverlay.tsx      (Magnifier display)
│   ├── LockOverlay.tsx           (Lock warning UI)
│   └── DiffRenderer.tsx          (Version comparison)
└── utils/                         (Pure utility functions)
    ├── coordinateTransform.ts    (Canvas ↔ Image coords)
    ├── geometryHelpers.ts        (Bbox, polygon, circle math)
    ├── renderHelpers.ts          (Drawing primitives)
    └── annotationHelpers.ts      (Annotation conversion)
```

---

## Module Responsibilities

### 1. Canvas.tsx (Main Component) - <500 lines

**Responsibility**: Orchestrate all sub-modules

```typescript
export default function Canvas() {
  // 1. Get state from custom hooks
  const canvasState = useCanvasState();
  const transform = useCanvasTransform();
  const toolState = useToolState(tool);
  const imageState = useImageManagement(currentImage);
  const events = useCanvasEvents(canvasState, toolState, transform);

  // 2. Setup refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 3. Render
  return (
    <div ref={containerRef}>
      <canvas
        ref={canvasRef}
        onMouseDown={events.handleMouseDown}
        onMouseMove={events.handleMouseMove}
        onMouseUp={events.handleMouseUp}
        onWheel={events.handleWheel}
      />

      <CanvasRenderer
        canvas={canvasRef.current}
        image={imageState.image}
        annotations={annotations}
        transform={transform}
      />

      {toolState.isDrawing && (
        <ToolOverlay tool={tool} state={toolState} transform={transform} />
      )}

      {shouldShowMagnifier && (
        <MagnifierOverlay canvas={canvasRef.current} position={cursorPos} />
      )}

      {imageState.isLocked && (
        <LockOverlay lockedBy={imageState.lockedBy} />
      )}

      {diffMode.enabled && (
        <DiffRenderer mode={diffMode} annotations={annotations} />
      )}
    </div>
  );
}
```

**Size Target**: <500 lines
**Complexity**: Low (orchestration only)
**Testability**: Integration tests

---

### 2. Custom Hooks

#### 2.1 useCanvasState.ts (~150 lines)

**Responsibility**: Manage UI state (modals, saving, cursors)

```typescript
interface CanvasStateReturn {
  // UI state
  showClassSelector: boolean;
  setShowClassSelector: (show: boolean) => void;
  canvasCursor: string;
  setCanvasCursor: (cursor: string) => void;

  // Saving state
  isSaving: boolean;
  setSaving: (saving: boolean) => void;

  // Batch operations
  batchProgress: { current: number; total: number } | null;
  setBatchProgress: (progress: any) => void;

  // Conflict handling
  conflictDialog: ConflictDialogState;
  showConflictDialog: (info: ConflictInfo) => void;
  hideConflictDialog: () => void;
}

export function useCanvasState(): CanvasStateReturn {
  const [showClassSelector, setShowClassSelector] = useState(false);
  const [canvasCursor, setCanvasCursor] = useState('default');
  const [isSaving, setIsSaving] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null);
  const [conflictDialog, setConflictDialog] = useState({...});

  return {
    showClassSelector,
    setShowClassSelector,
    canvasCursor,
    setCanvasCursor,
    isSaving,
    setSaving: setIsSaving,
    batchProgress,
    setBatchProgress,
    conflictDialog,
    showConflictDialog: (info) => setConflictDialog({ open: true, info }),
    hideConflictDialog: () => setConflictDialog({ open: false, info: null }),
  };
}
```

**Tests**: Unit test state transitions

#### 2.2 useCanvasTransform.ts (~120 lines)

**Responsibility**: Zoom, pan, coordinate transformations

```typescript
interface TransformState {
  zoom: number;
  offset: { x: number; y: number };

  // Actions
  setZoom: (zoom: number) => void;
  setPan: (offset: { x: number; y: number }) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  fitToScreen: () => void;

  // Coordinate conversion
  canvasToImage: (x: number, y: number) => [number, number];
  imageToCanvas: (x: number, y: number) => [number, number];

  // Helpers
  getVisibleRect: () => Rect;
  isPointVisible: (x: number, y: number) => boolean;
}

export function useCanvasTransform(
  canvasRef: RefObject<HTMLCanvasElement>,
  imageRef: RefObject<HTMLImageElement>
): TransformState {
  const { zoom, offset } = useAnnotationStore(state => state.canvas);

  const canvasToImage = useCallback((x: number, y: number): [number, number] => {
    // Transform logic using coordinateTransform utils
    return coordinateTransform.canvasToImage(x, y, zoom, offset);
  }, [zoom, offset]);

  // ... more implementations

  return { zoom, offset, setZoom, setPan, canvasToImage, ... };
}
```

**Tests**: Unit test coordinate transformations

#### 2.3 useToolState.ts (~180 lines)

**Responsibility**: Tool-specific temporary state

```typescript
interface ToolState {
  // Bbox state
  bbox?: {
    pending: BBox | null;
    isResizing: boolean;
    resizeHandle: string | null;
    resizeStart: any;
  };

  // Polygon state
  polygon?: {
    vertices: [number, number][];
    isDraggingVertex: boolean;
    draggedVertexIndex: number | null;
    isDraggingPolygon: boolean;
  };

  // Circle state
  circle?: {
    center: [number, number] | null;
    points: [number, number][];  // for 3-point
    isDragging: boolean;
    isResizing: boolean;
  };

  // Actions
  reset: () => void;
  update: (updates: Partial<ToolState>) => void;
}

export function useToolState(tool: string): ToolState {
  const [bboxState, setBboxState] = useState({...});
  const [polygonState, setPolygonState] = useState({...});
  const [circleState, setCircleState] = useState({...});

  // Reset on tool change
  useEffect(() => {
    setBboxState({...});
    setPolygonState({...});
    setCircleState({...});
  }, [tool]);

  return {
    bbox: tool === 'bbox' ? bboxState : undefined,
    polygon: tool === 'polygon' ? polygonState : undefined,
    circle: ['circle', 'circle3p'].includes(tool) ? circleState : undefined,
    reset: () => { /* reset all */ },
    update: (updates) => { /* update relevant state */ },
  };
}
```

**Tests**: Unit test state transitions per tool

#### 2.4 useCanvasEvents.ts (~200 lines)

**Responsibility**: Mouse and keyboard event delegation

```typescript
interface CanvasEvents {
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: (e: React.MouseEvent) => void;
  handleWheel: (e: React.WheelEvent) => void;
}

export function useCanvasEvents(
  canvasState: CanvasStateReturn,
  toolState: ToolState,
  transform: TransformState,
  imageState: ImageManagementState
): CanvasEvents {
  const tool = useAnnotationStore(state => state.tool);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (imageState.isLocked) {
      toast.error('Image is locked');
      return;
    }

    const coords = getCanvasCoordinates(e, canvasRef);
    const imageCoords = transform.canvasToImage(coords.x, coords.y);

    // Delegate to tool
    const currentTool = ToolRegistry.get(tool);
    currentTool.onMouseDown({
      coords: imageCoords,
      canvasCoords: coords,
      toolState,
      annotations,
      transform,
    });
  }, [tool, imageState.isLocked, toolState, transform]);

  // Similar for handleMouseMove, handleMouseUp

  return { handleMouseDown, handleMouseMove, handleMouseUp, handleWheel };
}
```

**Tests**: Integration test with mock tools

#### 2.5 useCanvasGestures.ts (~100 lines)

**Responsibility**: Pan and zoom gesture detection

```typescript
interface GestureState {
  isPanning: boolean;
  panStart: { x: number; y: number } | null;
  startPan: (x: number, y: number) => void;
  updatePan: (x: number, y: number) => void;
  endPan: () => void;
}

export function useCanvasGestures(
  transform: TransformState
): GestureState {
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{x: number; y: number} | null>(null);

  const startPan = useCallback((x: number, y: number) => {
    setIsPanning(true);
    setPanStart({ x, y });
  }, []);

  const updatePan = useCallback((x: number, y: number) => {
    if (!isPanning || !panStart) return;

    const dx = x - panStart.x;
    const dy = y - panStart.y;

    transform.setPan({
      x: transform.offset.x + dx,
      y: transform.offset.y + dy,
    });

    setPanStart({ x, y });
  }, [isPanning, panStart, transform]);

  const endPan = useCallback(() => {
    setIsPanning(false);
    setPanStart(null);
  }, []);

  return { isPanning, panStart, startPan, updatePan, endPan };
}
```

**Tests**: Unit test gesture state machine

#### 2.6 useImageManagement.ts (~180 lines)

**Responsibility**: Image loading and lock management

```typescript
interface ImageManagementState {
  image: HTMLImageElement | null;
  imageLoaded: boolean;
  isLocked: boolean;
  lockedBy: string | null;
  showLockedDialog: boolean;

  // Lock actions
  acquireLock: () => Promise<boolean>;
  releaseLock: () => Promise<void>;
  heartbeat: () => Promise<void>;
}

export function useImageManagement(
  currentImage: Image | null,
  projectId: string
): ImageManagementState {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  const [heartbeatInterval, setHeartbeatInterval] = useState<NodeJS.Timeout | null>(null);

  // Load image when currentImage changes
  useEffect(() => {
    if (!currentImage) {
      setImage(null);
      setImageLoaded(false);
      return;
    }

    const loadImage = async () => {
      try {
        // Try acquire lock
        const lockResult = await acquireLock();
        if (!lockResult.success) {
          setIsLocked(true);
          setLockedBy(lockResult.lockedBy);
          return;
        }

        // Load image
        const img = new Image();
        img.onload = () => {
          setImage(img);
          setImageLoaded(true);
        };
        img.src = currentImage.url;

        // Setup heartbeat
        const interval = setInterval(heartbeat, 5000);
        setHeartbeatInterval(interval);
      } catch (error) {
        toast.error('Failed to load image');
      }
    };

    loadImage();

    // Cleanup
    return () => {
      releaseLock();
      if (heartbeatInterval) clearInterval(heartbeatInterval);
    };
  }, [currentImage?.id]);

  return { image, imageLoaded, isLocked, lockedBy, ... };
}
```

**Tests**: Integration test with mock API

#### 2.7 useAnnotationSync.ts (~150 lines)

**Responsibility**: Backend synchronization with conflict detection

```typescript
interface AnnotationSyncState {
  isSaving: boolean;

  // CRUD operations
  create: (annotation: AnnotationCreate) => Promise<Annotation>;
  update: (id: string, data: AnnotationUpdate) => Promise<Annotation>;
  delete: (id: string) => Promise<void>;

  // Batch operations
  deleteAll: () => Promise<void>;

  // Conflict resolution
  resolveConflict: (strategy: 'keep' | 'overwrite') => Promise<void>;
}

export function useAnnotationSync(
  projectId: string,
  imageId: string
): AnnotationSyncState {
  const [isSaving, setIsSaving] = useState(false);

  const create = useCallback(async (annotation: AnnotationCreate) => {
    setIsSaving(true);
    try {
      const created = await createAnnotation(projectId, imageId, annotation);
      useAnnotationStore.getState().addAnnotation(created);
      toast.success('Annotation saved');
      return created;
    } catch (error) {
      if (error.status === 409) {
        // Version conflict
        handleConflict(error);
      }
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [projectId, imageId]);

  const update = useCallback(async (id: string, data: AnnotationUpdate) => {
    // Similar to create, with version check
    ...
  }, [projectId, imageId]);

  return { isSaving, create, update, delete: deleteAnnotation, deleteAll, resolveConflict };
}
```

**Tests**: Unit test with mock API, conflict scenarios

---

### 3. Renderer Components

#### 3.1 CanvasRenderer.tsx (~120 lines)

**Responsibility**: Pure rendering of canvas content

```typescript
interface CanvasRendererProps {
  canvas: HTMLCanvasElement | null;
  image: HTMLImageElement | null;
  annotations: Annotation[];
  transform: TransformState;
  showGrid: boolean;
  showCrosshair: boolean;
}

export const CanvasRenderer = React.memo<CanvasRendererProps>(({
  canvas,
  image,
  annotations,
  transform,
  showGrid,
  showCrosshair,
}) => {
  useEffect(() => {
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image
    const { zoom, offset } = transform;
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);
    ctx.drawImage(image, 0, 0);
    ctx.restore();

    // Draw grid
    if (showGrid) {
      renderHelpers.drawGrid(ctx, canvas.width, canvas.height, zoom, offset);
    }

    // Draw annotations
    annotations
      .filter(ann => isAnnotationVisible(ann))
      .forEach(ann => {
        renderHelpers.drawAnnotation(ctx, ann, zoom, offset);
      });

    // Draw crosshair
    if (showCrosshair) {
      renderHelpers.drawCrosshair(ctx, canvas.width / 2, canvas.height / 2);
    }
  }, [canvas, image, annotations, transform, showGrid, showCrosshair]);

  return null; // No JSX, pure side effect
});
```

**Tests**: Visual regression tests, snapshot tests

#### 3.2 ToolOverlay.tsx (~100 lines)

**Responsibility**: Render tool-specific overlays

```typescript
interface ToolOverlayProps {
  tool: string;
  state: ToolState;
  transform: TransformState;
}

export const ToolOverlay: React.FC<ToolOverlayProps> = ({
  tool,
  state,
  transform,
}) => {
  switch (tool) {
    case 'bbox':
      return state.bbox?.pending ? (
        <BboxPreview bbox={state.bbox.pending} transform={transform} />
      ) : null;

    case 'polygon':
      return state.polygon?.vertices.length > 0 ? (
        <PolygonPreview vertices={state.polygon.vertices} transform={transform} />
      ) : null;

    case 'circle':
      return state.circle?.center ? (
        <CirclePreview center={state.circle.center} transform={transform} />
      ) : null;

    default:
      return null;
  }
};
```

**Tests**: Unit test with mock tool states

#### 3.3 MagnifierOverlay.tsx (~80 lines)

**Responsibility**: Magnifier display

```typescript
interface MagnifierOverlayProps {
  canvas: HTMLCanvasElement | null;
  position: { x: number; y: number };
  magnification: number;
  size: number;
}

export const MagnifierOverlay: React.FC<MagnifierOverlayProps> = ({
  canvas,
  position,
  magnification,
  size,
}) => {
  const magnifierRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvas || !magnifierRef.current) return;

    const ctx = magnifierRef.current.getContext('2d');
    if (!ctx) return;

    // Clone canvas region around cursor
    ctx.drawImage(
      canvas,
      position.x - size / (2 * magnification),
      position.y - size / (2 * magnification),
      size / magnification,
      size / magnification,
      0,
      0,
      size,
      size
    );
  }, [canvas, position, magnification, size]);

  return (
    <div
      className="magnifier"
      style={{
        position: 'absolute',
        left: position.x + 20,
        top: position.y + 20,
        width: size,
        height: size,
      }}
    >
      <canvas ref={magnifierRef} width={size} height={size} />
    </div>
  );
};
```

**Tests**: Visual tests, position calculations

#### 3.4 LockOverlay.tsx (~60 lines)

**Responsibility**: Lock warning UI

```typescript
interface LockOverlayProps {
  lockedBy: string;
  onClose: () => void;
}

export const LockOverlay: React.FC<LockOverlayProps> = ({
  lockedBy,
  onClose,
}) => {
  return (
    <div className="lock-overlay">
      <div className="lock-warning">
        <LockIcon />
        <p>This image is currently being edited by {lockedBy}</p>
        <button onClick={onClose}>OK</button>
      </div>
    </div>
  );
};
```

**Tests**: UI component test

#### 3.5 DiffRenderer.tsx (~150 lines)

**Responsibility**: Version comparison rendering

```typescript
interface DiffRendererProps {
  mode: DiffMode;
  annotations: Annotation[];
  baseAnnotations: Annotation[];
  transform: TransformState;
}

export const DiffRenderer: React.FC<DiffRendererProps> = ({
  mode,
  annotations,
  baseAnnotations,
  transform,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (mode.type === 'overlay') {
      renderOverlayDiff(ctx, annotations, baseAnnotations, transform);
    } else if (mode.type === 'side-by-side') {
      renderSideBySideDiff(ctx, annotations, baseAnnotations, transform);
    }
  }, [mode, annotations, baseAnnotations, transform]);

  return <canvas ref={canvasRef} />;
};
```

**Tests**: Visual regression tests for diff modes

---

### 4. Utility Functions

#### 4.1 coordinateTransform.ts (~80 lines)

**Responsibility**: Canvas ↔ Image coordinate conversion

```typescript
export const coordinateTransform = {
  /**
   * Convert canvas coordinates to image coordinates
   */
  canvasToImage(
    canvasX: number,
    canvasY: number,
    zoom: number,
    offset: { x: number; y: number }
  ): [number, number] {
    const imageX = (canvasX - offset.x) / zoom;
    const imageY = (canvasY - offset.y) / zoom;
    return [imageX, imageY];
  },

  /**
   * Convert image coordinates to canvas coordinates
   */
  imageToCanvas(
    imageX: number,
    imageY: number,
    zoom: number,
    offset: { x: number; y: number }
  ): [number, number] {
    const canvasX = imageX * zoom + offset.x;
    const canvasY = imageY * zoom + offset.y;
    return [canvasX, canvasY];
  },

  /**
   * Get canvas rectangle in image coordinates
   */
  getCanvasRectInImage(
    canvas: HTMLCanvasElement,
    zoom: number,
    offset: { x: number; y: number }
  ): Rect {
    const [x1, y1] = this.canvasToImage(0, 0, zoom, offset);
    const [x2, y2] = this.canvasToImage(canvas.width, canvas.height, zoom, offset);
    return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  },

  // ... more helper functions
};
```

**Tests**: Unit tests with known input/output pairs

#### 4.2 geometryHelpers.ts (~120 lines)

**Responsibility**: Geometric calculations

```typescript
export const geometryHelpers = {
  /**
   * Get bbox handle positions
   */
  getBboxHandles(bbox: BBox): Handle[] {
    return [
      { name: 'tl', x: bbox.x, y: bbox.y },
      { name: 'tr', x: bbox.x + bbox.width, y: bbox.y },
      { name: 'bl', x: bbox.x, y: bbox.y + bbox.height },
      { name: 'br', x: bbox.x + bbox.width, y: bbox.y + bbox.height },
      { name: 't', x: bbox.x + bbox.width / 2, y: bbox.y },
      { name: 'b', x: bbox.x + bbox.width / 2, y: bbox.y + bbox.height },
      { name: 'l', x: bbox.x, y: bbox.y + bbox.height / 2 },
      { name: 'r', x: bbox.x + bbox.width, y: bbox.y + bbox.height / 2 },
    ];
  },

  /**
   * Check if point is inside bbox
   */
  isInsideBbox(x: number, y: number, bbox: BBox): boolean {
    return x >= bbox.x && x <= bbox.x + bbox.width &&
           y >= bbox.y && y <= bbox.y + bbox.height;
  },

  /**
   * Get polygon center
   */
  getPolygonCenter(vertices: [number, number][]): [number, number] {
    const sumX = vertices.reduce((sum, [x]) => sum + x, 0);
    const sumY = vertices.reduce((sum, [, y]) => sum + y, 0);
    return [sumX / vertices.length, sumY / vertices.length];
  },

  /**
   * Calculate circle radius from 3 points
   */
  calculateCircleFrom3Points(
    p1: [number, number],
    p2: [number, number],
    p3: [number, number]
  ): { center: [number, number]; radius: number } {
    // ... circle calculation
  },

  /**
   * Distance between two points
   */
  distance(p1: [number, number], p2: [number, number]): number {
    const [x1, y1] = p1;
    const [x2, y2] = p2;
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  },

  // ... more geometry functions
};
```

**Tests**: Unit tests with mathematical proofs

#### 4.3 renderHelpers.ts (~100 lines)

**Responsibility**: Canvas drawing primitives

```typescript
export const renderHelpers = {
  /**
   * Draw bbox with handles
   */
  drawBbox(
    ctx: CanvasRenderingContext2D,
    bbox: BBox,
    options: {
      strokeColor?: string;
      fillColor?: string;
      lineWidth?: number;
      showHandles?: boolean;
    }
  ): void {
    ctx.save();

    ctx.strokeStyle = options.strokeColor || '#00ff00';
    ctx.lineWidth = options.lineWidth || 2;

    ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height);

    if (options.showHandles) {
      const handles = geometryHelpers.getBboxHandles(bbox);
      handles.forEach(handle => {
        this.drawHandle(ctx, handle.x, handle.y);
      });
    }

    ctx.restore();
  },

  /**
   * Draw polygon with vertices
   */
  drawPolygon(
    ctx: CanvasRenderingContext2D,
    vertices: [number, number][],
    options: {
      strokeColor?: string;
      fillColor?: string;
      closed?: boolean;
    }
  ): void {
    if (vertices.length < 2) return;

    ctx.save();

    ctx.strokeStyle = options.strokeColor || '#00ff00';
    ctx.fillStyle = options.fillColor || 'rgba(0, 255, 0, 0.2)';

    ctx.beginPath();
    ctx.moveTo(vertices[0][0], vertices[0][1]);

    for (let i = 1; i < vertices.length; i++) {
      ctx.lineTo(vertices[i][0], vertices[i][1]);
    }

    if (options.closed) {
      ctx.closePath();
      ctx.fill();
    }

    ctx.stroke();
    ctx.restore();
  },

  /**
   * Draw circle
   */
  drawCircle(
    ctx: CanvasRenderingContext2D,
    center: [number, number],
    radius: number,
    options: {
      strokeColor?: string;
      fillColor?: string;
    }
  ): void {
    ctx.save();

    ctx.strokeStyle = options.strokeColor || '#00ff00';
    ctx.fillStyle = options.fillColor || 'rgba(0, 255, 0, 0.2)';

    ctx.beginPath();
    ctx.arc(center[0], center[1], radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  },

  /**
   * Draw grid
   */
  drawGrid(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    zoom: number,
    offset: { x: number; y: number }
  ): void {
    // ... grid drawing logic
  },

  /**
   * Draw crosshair
   */
  drawCrosshair(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number = 20
  ): void {
    ctx.save();

    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);
    ctx.stroke();

    ctx.restore();
  },

  // ... more drawing functions
};
```

**Tests**: Visual tests, snapshot tests

#### 4.4 annotationHelpers.ts (~60 lines)

**Responsibility**: Annotation format conversion

```typescript
export const annotationHelpers = {
  /**
   * Convert AnnotationSnapshot to Annotation
   */
  snapshotToAnnotation(snapshot: AnnotationSnapshot): Annotation {
    return {
      id: snapshot.id,
      task_type: snapshot.task_type,
      geometry: snapshot.geometry,
      class_id: snapshot.class_id,
      class_name: snapshot.class_name,
      // ... more conversions
    };
  },

  /**
   * Convert Annotation to AnnotationSnapshot
   */
  annotationToSnapshot(annotation: Annotation): AnnotationSnapshot {
    return {
      id: annotation.id,
      task_type: annotation.task_type,
      geometry: annotation.geometry,
      class_id: annotation.class_id,
      class_name: annotation.class_name,
      // ... more conversions
    };
  },

  /**
   * Validate annotation geometry
   */
  validateGeometry(taskType: string, geometry: any): boolean {
    switch (taskType) {
      case 'detection':
        return isValidBbox(geometry);
      case 'segmentation':
        return isValidPolygon(geometry);
      // ... more cases
    }
  },

  // ... more helper functions
};
```

**Tests**: Unit tests with valid/invalid inputs

---

## Data Flow

```
User Input (Mouse/Keyboard)
  ↓
Canvas.tsx (Event Handlers)
  ↓
useCanvasEvents (Event Delegation)
  ↓
Tool.onMouseDown/Move/Up (Tool Logic)
  ↓
useToolState (Update Tool State)
  ↓
Canvas.tsx (Re-render)
  ↓
CanvasRenderer (Render Canvas)
  ↓
ToolOverlay (Render Tool UI)

Save Annotation:
  ↓
Canvas.tsx (Save Button)
  ↓
useAnnotationSync.create()
  ↓
API Call
  ↓
useAnnotationStore (Update Store)
  ↓
Canvas.tsx (Re-render)
  ↓
CanvasRenderer (Show New Annotation)
```

---

## Component Hierarchy

```jsx
<Canvas>
  <div ref={containerRef}>
    <canvas ref={canvasRef} {...eventHandlers} />

    <CanvasRenderer
      canvas={canvasRef}
      image={image}
      annotations={annotations}
      transform={transform}
    />

    {toolState.isDrawing && (
      <ToolOverlay
        tool={tool}
        state={toolState}
        transform={transform}
      />
    )}

    {shouldShowMagnifier && (
      <MagnifierOverlay
        canvas={canvasRef}
        position={cursorPos}
        magnification={magnification}
      />
    )}

    {isLocked && (
      <LockOverlay
        lockedBy={lockedBy}
        onClose={() => setShowLockedDialog(false)}
      />
    )}

    {diffMode.enabled && (
      <DiffRenderer
        mode={diffMode}
        annotations={annotations}
        baseAnnotations={baseAnnotations}
        transform={transform}
      />
    )}

    <ClassSelectorModal ... />
    <AnnotationConflictDialog ... />
  </div>
</Canvas>
```

---

## Hook Dependency Graph

```
Canvas.tsx
  ├── useCanvasState() ──────────── useState (UI state)
  ├── useCanvasTransform() ──────── useAnnotationStore (zoom, pan)
  │     └── coordinateTransform utils
  ├── useToolState(tool) ────────── useState (tool-specific state)
  ├── useImageManagement() ──────── useState, useEffect, API
  │     ├── imageLockAPI
  │     └── useAnnotationStore
  ├── useAnnotationSync() ───────── useState, API
  │     ├── annotationAPI
  │     └── useAnnotationStore
  ├── useCanvasEvents() ─────────── useCallback
  │     ├── useCanvasTransform
  │     ├── useToolState
  │     ├── ToolRegistry
  │     └── useAnnotationSync
  └── useCanvasGestures() ───────── useState
        └── useCanvasTransform
```

---

## Migration Strategy

See `migration-plan.md` for detailed step-by-step migration plan.

---

## Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Canvas.tsx lines | 4,100 | <500 | 88% ↓ |
| Largest function | 588 | <200 | 66% ↓ |
| Num of useState | 37 | ~10 | 73% ↓ |
| Test coverage | 0% | >70% | +70pp |
| Module count | 1 | 16 | +1500% |
| Avg module size | 4,100 | ~120 | 97% ↓ |

---

## Next Steps

1. Review this architecture with team
2. Get approval for breaking changes (if any)
3. Follow migration plan in `migration-plan.md`
4. Implement incrementally with tests
5. Monitor performance and adjust

---

**Last Updated**: 2025-12-10
**Reviewers**: TBD
**Status**: 📝 Proposed
