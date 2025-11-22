# Implementation Plan: Minimap, Undo/Redo UI, Magnifier

**Date**: 2025-11-22
**Target Phase**: Phase 2 Advanced Features
**Estimated Total**: 16-20 hours

---

## Overview

This document outlines the implementation plan for three annotation canvas features:
1. **Minimap**: Navigation overview with viewport indicator
2. **Undo/Redo UI**: Keyboard shortcuts + toolbar buttons (backend already implemented)
3. **Magnifier**: Zoom lens for detailed pixel-perfect annotation

---

## 1. Minimap (Navigation Overview)

### 1.1 Current Status
- ❌ **Not implemented** (marked as complete in Phase 2.5 but no code exists)
- Backend: No specific backend needed (client-side only)
- Store: Canvas state (zoom, pan) already tracked in `annotationStore.ts`

### 1.2 UI Design

**Position**: Bottom-right corner of canvas container
**Size**: 200x150px (4:3 aspect ratio, adjustable)
**Style**:
```
┌─────────────────────────────────────────┐
│                                         │
│                                         │
│          Main Canvas                    │
│                                         │
│                                         │
│                    ┌──────────┐        │
│                    │ Minimap  │        │
│                    │ ┌──────┐ │        │
│                    │ │ View │ │        │
│                    │ └──────┘ │        │
│                    └──────────┘        │
└─────────────────────────────────────────┘
```

**Visual Elements**:
- Semi-transparent background: `bg-gray-900/80`
- Border: `border border-gray-700`
- Rounded corners: `rounded-lg`
- Padding: `p-2`
- Shadow: `shadow-lg`

**Minimap Canvas**:
- Shows entire image at thumbnail scale
- Renders all annotations (simplified)
- Red rectangle showing current viewport
- Draggable viewport indicator

**Toggle Button**:
- Position: Top-right of minimap
- Icon: Eye (show) / Eye-slash (hide)
- Hotkey: `M` (toggle)

### 1.3 Interaction

**Viewport Navigation**:
1. Click anywhere on minimap → Pan main canvas to that position
2. Drag viewport rectangle → Real-time pan on main canvas
3. Scroll on minimap → Zoom main canvas

**Annotation Display**:
- All annotations rendered at minimap scale
- Use same colors as main canvas
- Simplified rendering (no handles, thinner strokes)

### 1.4 Implementation Details

**Component Structure**:
```
components/annotation/
  ├── Canvas.tsx (main canvas)
  └── Minimap.tsx (new component)
```

**Minimap.tsx**:
```typescript
interface MinimapProps {
  image: HTMLImageElement | null;
  annotations: Annotation[];
  canvasState: CanvasState;
  onViewportChange: (x: number, y: number) => void;
  onZoomChange?: (zoom: number) => void;
}

export default function Minimap({
  image,
  annotations,
  canvasState,
  onViewportChange,
  onZoomChange,
}: MinimapProps) {
  // Canvas ref for minimap
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);

  // Visibility state
  const [isVisible, setIsVisible] = useState(true);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);

  // Render minimap on every update
  useEffect(() => {
    renderMinimap();
  }, [image, annotations, canvasState]);

  // Render function
  const renderMinimap = () => {
    // 1. Draw image (fit to minimap size)
    // 2. Draw annotations (scaled)
    // 3. Draw viewport rectangle
  };

  // Handle click on minimap
  const handleMinimapClick = (e: React.MouseEvent) => {
    // Convert click position to canvas coordinates
    // Call onViewportChange
  };

  // Handle viewport drag
  const handleViewportDrag = (e: React.MouseEvent) => {
    // Update viewport position in real-time
  };

  return (
    <div className="absolute bottom-4 right-4 ...">
      {/* Toggle button */}
      <button onClick={() => setIsVisible(!isVisible)}>
        {isVisible ? <EyeIcon /> : <EyeSlashIcon />}
      </button>

      {/* Minimap canvas */}
      {isVisible && (
        <canvas
          ref={minimapCanvasRef}
          width={200}
          height={150}
          onClick={handleMinimapClick}
          onMouseDown={handleViewportDragStart}
        />
      )}
    </div>
  );
}
```

**Integration in Canvas.tsx**:
```typescript
// In Canvas component
<Minimap
  image={image}
  annotations={annotations}
  canvasState={canvasState}
  onViewportChange={(x, y) => setPan({ x, y })}
  onZoomChange={(zoom) => setZoom(zoom)}
/>
```

**Rendering Logic**:
```typescript
const renderMinimap = () => {
  const canvas = minimapCanvasRef.current;
  if (!canvas || !image) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Calculate scale to fit image in minimap
  const scaleX = canvas.width / image.width;
  const scaleY = canvas.height / image.height;
  const scale = Math.min(scaleX, scaleY);

  const displayWidth = image.width * scale;
  const displayHeight = image.height * scale;
  const offsetX = (canvas.width - displayWidth) / 2;
  const offsetY = (canvas.height - displayHeight) / 2;

  // Draw image
  ctx.drawImage(
    image,
    offsetX,
    offsetY,
    displayWidth,
    displayHeight
  );

  // Draw annotations (simplified)
  annotations.forEach(ann => {
    if (ann.type === 'bbox') {
      ctx.strokeStyle = ann.color || '#3b82f6';
      ctx.lineWidth = 1;
      ctx.strokeRect(
        offsetX + ann.bbox[0] * scale,
        offsetY + ann.bbox[1] * scale,
        ann.bbox[2] * scale,
        ann.bbox[3] * scale
      );
    }
    // Similar for polygon, circle, etc.
  });

  // Draw viewport rectangle
  const viewportWidth = (canvas.width / canvasState.zoom) * scale;
  const viewportHeight = (canvas.height / canvasState.zoom) * scale;
  const viewportX = offsetX - (canvasState.pan.x * scale / canvasState.zoom);
  const viewportY = offsetY - (canvasState.pan.y * scale / canvasState.zoom);

  ctx.strokeStyle = '#ef4444'; // Red
  ctx.lineWidth = 2;
  ctx.strokeRect(viewportX, viewportY, viewportWidth, viewportHeight);
};
```

### 1.5 Keyboard Shortcuts
- `M`: Toggle minimap visibility
- `Alt + Click on Minimap`: Zoom to clicked area

### 1.6 Estimate
**Total**: 6-8 hours
- UI component: 2h
- Rendering logic: 2h
- Interaction handlers: 2h
- Integration & testing: 1-2h

---

## 2. Undo/Redo UI Integration

### 2.1 Current Status
- ✅ **Backend implemented** in `annotationStore.ts`
  - `undo()`, `redo()` functions
  - `canUndo()`, `canRedo()` state
  - `history.past`, `history.future` stacks
- ❌ **UI not implemented** (no toolbar buttons, no keyboard shortcuts)

### 2.2 UI Design

**Position**: Bottom-left zoom toolbar (integrated with existing zoom controls)

**Layout**:
```
Canvas Bottom-Left:
┌──────────────────────────────────────────────────┐
│ [↶] [↷] │ [−] [100%] [+] │ [Fit] │              │
└──────────────────────────────────────────────────┘
   Undo Redo   Zoom Controls    Fit Button
```

**Current Zoom Toolbar** (Canvas.tsx line 3280):
```tsx
<div className="absolute bottom-4 left-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-2 flex items-center gap-2 shadow-lg">
  {/* Add Undo/Redo here */}
  <button>−</button>
  <span>100%</span>
  <button>+</button>
  <div className="divider"></div>
  <button>Fit</button>
</div>
```

**Undo Button**:
- Icon: `ArrowUturnLeftIcon` (Heroicons) - **Icon only, no text**
- Size: `w-4 h-4` (small icon to match zoom controls)
- Tooltip: "Undo (Ctrl+Z)"
- Disabled state: `!canUndo()` (gray, not clickable)
- Active state: Hover background change

**Redo Button**:
- Icon: `ArrowUturnRightIcon` (Heroicons) - **Icon only, no text**
- Size: `w-4 h-4`
- Tooltip: "Redo (Ctrl+Y or Ctrl+Shift+Z)"
- Disabled state: `!canRedo()`
- Active state: Hover background change

**Visual Feedback**:
- Show toast notification on undo/redo
  - "Undone: Delete annotation" (with action type)
  - "Redone: Create bbox"
- Brief highlight animation on affected annotations

### 2.3 Implementation Details

**Component**: Directly integrate into Canvas.tsx zoom toolbar (no separate component needed)

**Integration in Canvas.tsx** (around line 3280):

```typescript
// Import icons at top
import { ArrowUturnLeftIcon, ArrowUturnRightIcon } from '@heroicons/react/24/outline';

// In Canvas component, get undo/redo from store
const { undo, redo, canUndo, canRedo } = useAnnotationStore();

// In JSX, update zoom controls:
<div className="absolute bottom-4 left-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-2 flex items-center gap-2 shadow-lg">
  {/* Undo button */}
  <button
    onClick={() => {
      if (canUndo()) {
        undo();
        toast.success('Undone');
      }
    }}
    disabled={!canUndo()}
    className={`
      w-8 h-8 flex items-center justify-center rounded transition-colors
      ${canUndo()
        ? 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
        : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
      }
    `}
    title="Undo (Ctrl+Z)"
  >
    <ArrowUturnLeftIcon className="w-4 h-4" />
  </button>

  {/* Redo button */}
  <button
    onClick={() => {
      if (canRedo()) {
        redo();
        toast.success('Redone');
      }
    }}
    disabled={!canRedo()}
    className={`
      w-8 h-8 flex items-center justify-center rounded transition-colors
      ${canRedo()
        ? 'hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white'
        : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
      }
    `}
    title="Redo (Ctrl+Y)"
  >
    <ArrowUturnRightIcon className="w-4 h-4" />
  </button>

  {/* Divider */}
  <div className="w-px h-6 bg-gray-300 dark:bg-gray-700 mx-1"></div>

  {/* Existing zoom controls */}
  <button onClick={() => setZoom(canvasState.zoom - 0.25)} ...>
    −
  </button>
  <span className="text-xs text-gray-600 dark:text-gray-400 w-12 text-center">
    {Math.round(canvasState.zoom * 100)}%
  </span>
  <button onClick={() => setZoom(canvasState.zoom + 0.25)} ...>
    +
  </button>

  {/* Existing divider and Fit button */}
  ...
</div>
```

**Keyboard Shortcuts**: Add to Canvas.tsx

```typescript
// In Canvas component, add keyboard event listener
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Undo: Ctrl+Z (Windows/Linux) or Cmd+Z (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (canUndo()) {
        undo();
        toast.success('Undone');
      }
    }

    // Redo: Ctrl+Y or Ctrl+Shift+Z
    if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      if (canRedo()) {
        redo();
        toast.success('Redone');
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [canUndo, canRedo, undo, redo]);
```

**Ensure recordSnapshot is called**: Verify all annotation changes call `recordSnapshot()`

```typescript
// Example: When creating annotation
const handleCreateAnnotation = async (data: AnnotationData) => {
  const newAnnotation = await createAnnotation(data);
  addAnnotation(newAnnotation);

  // Record for undo/redo
  recordSnapshot('create', [newAnnotation.id]);
};

// Example: When deleting annotation
const handleDeleteAnnotation = async (id: string) => {
  await deleteAnnotationAPI(id);
  deleteAnnotation(id);

  // Record for undo/redo
  recordSnapshot('delete', [id]);
};
```

### 2.4 Keyboard Shortcuts Summary
- `Ctrl+Z` / `Cmd+Z`: Undo
- `Ctrl+Y` / `Cmd+Y`: Redo
- `Ctrl+Shift+Z` / `Cmd+Shift+Z`: Redo (alternative)

### 2.5 Estimate
**Total**: 3-4 hours (reduced - no separate component needed)
- Integrate into zoom toolbar: 1h
- Keyboard shortcuts: 0.5h
- Toast notifications: 0.5h
- Verify recordSnapshot coverage: 1h
- Testing & polish: 0.5h

---

## 3. Magnifier (Zoom Lens)

### 3.1 Current Status
- ❌ **Not in TODO list** (new feature)
- Purpose: Pixel-perfect annotation for small objects
- Similar to Photoshop's magnifier tool

### 3.2 UI Design

**Activation Methods**:
1. **Manual**: `Z` key (press and hold) - Works in any mode
2. **Auto**: Automatically shows when entering drawing tools:
   - Detection (bbox) tool
   - Polygon/Segmentation tool
   - Polyline tool
   - Circle tool
   - Circle 3-point tool
3. **Tool Detection**: Check `currentTool` from store

**Positioning Modes** (implement both, test to decide):
1. **Following Mode** (default):
   - Magnifier follows cursor with offset (50px right, 50px down)
   - Auto-adjusts near canvas edges
   - `pointer-events: none` to not interfere with drawing

2. **Fixed Mode** (alternative):
   - Fixed position (e.g., top-right corner)
   - Shows magnified view of cursor location
   - User can toggle position

**Appearance**:
```
Main Canvas (zoomed in):
┌────────────────────────────────┐
│                                │
│       ┌──────────┐            │
│       │ Original │            │
│       │  Area    │            │
│       └──────────┘            │
│           ↓                    │
│      ┌──────────────┐         │
│      │  Magnified   │         │
│      │   (3x zoom)  │         │
│      │  ┌────────┐  │         │
│      │  │Crosshair│ │         │
│      │  └────────┘  │         │
│      └──────────────┘         │
└────────────────────────────────┘
```

**Magnifier Circle**:
- Diameter: 200px (adjustable)
- Border: 3px solid white with shadow
- Background: Magnified canvas region
- Magnification: 2x, 3x, 4x (adjustable with mouse wheel)
- Crosshair: Center crosshair for precise positioning
- Follow cursor: Moves with mouse (offset to not obscure)

**Display Information**:
- Top-right of magnifier: "3.0x" (current zoom level)
- Bottom: Pixel coordinates "(X: 1234, Y: 567)"
- Optional: RGB color under cursor

### 3.3 Interaction

**Activation Logic**:
```typescript
// Check if magnifier should be active
const shouldShowMagnifier =
  manualMagnifierActive || // Z key pressed
  (isDrawingTool(currentTool) && preferences.autoMagnifier); // Auto mode

const isDrawingTool = (tool: string) => {
  return ['detection', 'polygon', 'polyline', 'circle', 'circle3p'].includes(tool);
};
```

**Manual Activation**:
1. Press and hold `Z` key → Magnifier appears
2. Move mouse → Magnifier follows cursor (following mode) or shows cursor area (fixed mode)
3. Click → Can still draw normally with magnified view
4. Release `Z` → Magnifier disappears

**Auto Activation** (when in drawing tools):
1. Select Detection/Polygon/Polyline/Circle tool
2. Magnifier automatically appears
3. Stays visible while using the tool
4. Disappears when switching to non-drawing tools

**Zoom Control**:
- Scroll while magnifier active → Change magnification (2x-8x)
- Display current zoom level in magnifier
- Default: 3x

**Positioning Modes**:

1. **Following Mode**:
   - Offset from cursor: `{ x: 50, y: 50 }` (adjustable)
   - Edge detection: If near right/bottom edge, flip to left/top
   - Smooth following (no lag)

2. **Fixed Mode**:
   - Position: Top-right corner of canvas
   - Always shows area under cursor
   - More predictable position

**Settings** (add to preferences):
```typescript
preferences: {
  autoMagnifier: boolean; // Auto-show in drawing tools
  magnifierMode: 'following' | 'fixed'; // Position mode
  magnifierSize: number; // Diameter (default 200)
  magnificationLevel: number; // Default zoom (default 3.0)
}
```

### 3.4 Implementation Details

**Component**: `Magnifier.tsx`

```typescript
// components/annotation/Magnifier.tsx
interface MagnifierProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  imageRef: React.RefObject<HTMLImageElement>;
  annotations: Annotation[];
  cursorPosition: { x: number; y: number }; // Canvas coordinates
  magnification: number; // 2x, 3x, 4x, etc.
  mode: 'following' | 'fixed'; // Position mode
  size: number; // Diameter in pixels
}

export default function Magnifier({
  canvasRef,
  imageRef,
  annotations,
  cursorPosition,
  magnification,
  mode,
  size,
}: MagnifierProps) {
  const magnifierRef = useRef<HTMLCanvasElement>(null);

  // Calculate offset for following mode
  const getOffset = () => {
    if (mode === 'fixed') return { x: 0, y: 0 };

    const canvas = canvasRef.current;
    if (!canvas) return { x: 50, y: 50 };

    const rect = canvas.getBoundingClientRect();
    const offset = { x: 50, y: 50 };

    // Edge detection: flip offset if near edges
    if (cursorPosition.x + offset.x + size > rect.width) {
      offset.x = -size - 20; // Flip to left
    }
    if (cursorPosition.y + offset.y + size > rect.height) {
      offset.y = -size - 20; // Flip to top
    }

    return offset;
  };

  // Render magnified view
  useEffect(() => {
    renderMagnifier();
  }, [cursorPosition, magnification, mode, size]);

  const renderMagnifier = () => {
    const magnifierCanvas = magnifierRef.current;
    const mainCanvas = canvasRef.current;
    if (!magnifierCanvas || !mainCanvas) return;

    const ctx = magnifierCanvas.getContext('2d');
    if (!ctx) return;

    // Magnifier dimensions
    const magnifierSize = 200; // Diameter
    const radius = magnifierSize / 2;

    // Source region to magnify (on main canvas)
    const sourceSize = magnifierSize / magnification;
    const sourceX = cursorPosition.x - sourceSize / 2;
    const sourceY = cursorPosition.y - sourceSize / 2;

    // Clear and set circular clip
    ctx.clearRect(0, 0, magnifierSize, magnifierSize);
    ctx.save();
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 2, 0, Math.PI * 2);
    ctx.clip();

    // Draw magnified region from main canvas
    ctx.drawImage(
      mainCanvas,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      magnifierSize,
      magnifierSize
    );

    ctx.restore();

    // Draw border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(radius, radius, radius - 2, 0, Math.PI * 2);
    ctx.stroke();

    // Draw crosshair
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(radius, magnifierSize);
    ctx.stroke();

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(0, radius);
    ctx.lineTo(magnifierSize, radius);
    ctx.stroke();
  };

  // Calculate magnifier position
  const offset = getOffset();
  const position = mode === 'fixed'
    ? { left: 'auto', right: '16px', top: '16px', bottom: 'auto' } // Fixed top-right
    : {
        left: `${cursorPosition.x + offset.x}px`,
        top: `${cursorPosition.y + offset.y}px`,
        right: 'auto',
        bottom: 'auto',
      };

  return (
    <div
      className="absolute pointer-events-none z-50"
      style={position}
    >
      {/* Magnifier canvas */}
      <canvas
        ref={magnifierRef}
        width={size}
        height={size}
        className="rounded-full shadow-2xl"
      />

      {/* Zoom level indicator */}
      <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
        {magnification.toFixed(1)}x
      </div>

      {/* Coordinates display */}
      <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
        X: {Math.round(cursorPosition.x)}, Y: {Math.round(cursorPosition.y)}
      </div>

      {/* Mode indicator (optional) */}
      <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-2 py-1 rounded">
        {mode === 'following' ? '📍 Following' : '📌 Fixed'}
      </div>
    </div>
  );
}
```

**Integration in Canvas.tsx**:

```typescript
// State for magnifier
const [manualMagnifierActive, setManualMagnifierActive] = useState(false);
const [magnification, setMagnification] = useState(3.0);
const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });

// Get preferences and tool from store
const { preferences, tool: currentTool } = useAnnotationStore();

// Helper: Check if current tool is a drawing tool
const isDrawingTool = (tool: string | null) => {
  if (!tool) return false;
  return ['detection', 'polygon', 'polyline', 'circle', 'circle3p'].includes(tool);
};

// Determine if magnifier should be shown
const shouldShowMagnifier =
  manualMagnifierActive || // Z key pressed
  (isDrawingTool(currentTool) && preferences.autoMagnifier); // Auto mode

// Keyboard handler for manual activation
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Z key (not Ctrl+Z for undo)
    if (e.key === 'z' && !e.ctrlKey && !e.metaKey) {
      setManualMagnifierActive(true);
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.key === 'z') {
      setManualMagnifierActive(false);
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);

  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
}, []);

// Mouse move handler (update cursor position)
const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  setCursorPos({ x, y });

  // ... existing mouse move logic
};

// Scroll handler for magnification adjustment (when magnifier active)
const handleMagnifierScroll = (e: WheelEvent) => {
  if (!shouldShowMagnifier) return;

  e.preventDefault();
  const delta = e.deltaY > 0 ? -0.5 : 0.5; // Decrease/increase by 0.5x
  setMagnification(prev => Math.max(2.0, Math.min(8.0, prev + delta)));
};

useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas || !shouldShowMagnifier) return;

  canvas.addEventListener('wheel', handleMagnifierScroll);
  return () => canvas.removeEventListener('wheel', handleMagnifierScroll);
}, [shouldShowMagnifier]);

// Render magnifier
return (
  <div className="relative">
    <canvas
      ref={canvasRef}
      onMouseMove={handleMouseMove}
      // ... other handlers
    />

    {/* Magnifier overlay */}
    {shouldShowMagnifier && (
      <Magnifier
        canvasRef={canvasRef}
        imageRef={imageRef}
        annotations={annotations}
        cursorPosition={cursorPos}
        magnification={magnification}
        mode={preferences.magnifierMode || 'following'}
        size={preferences.magnifierSize || 200}
      />
    )}
  </div>
);
```

**Toolbar Button** (optional):

```typescript
// In TopBar.tsx or similar
<button
  onClick={() => setMagnifierActive(!magnifierActive)}
  className={`
    p-2 rounded transition-colors
    ${magnifierActive ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'}
  `}
  title="Magnifier (Z)"
>
  <MagnifyingGlassIcon className="w-5 h-5" />
</button>
```

### 3.5 Advanced Features (Optional)

**Magnification Adjustment**:
- Scroll while magnifier active: Increase/decrease magnification
- Range: 2x to 8x
- Display current level in magnifier

**Pixel Grid** (when magnification > 4x):
- Show pixel grid lines
- Help with pixel-perfect alignment

**Color Picker**:
- Display RGB/HEX color under cursor
- Useful for debugging or validation

### 3.6 Keyboard Shortcuts
- `Z` (hold): Activate magnifier
- `Scroll` (while active): Adjust magnification
- `Space + Hover`: Alternative activation (like Photoshop)

### 3.7 Estimate
**Total**: 7-9 hours (increased for auto-activation + dual modes)
- Magnifier component: 2h
- Rendering logic (circular clip, magnification): 2h
- Following + Fixed modes: 1h
- Auto-activation logic (tool detection): 1h
- Keyboard/mouse interaction: 1h
- Scroll for magnification: 0.5h
- Integration & testing: 1.5-2h
- Optional features (pixel grid, color picker): +2h

---

## 4. Implementation Order & Priority

### Recommended Order:
1. **Undo/Redo UI** (3-4h) - Easiest, backend done, quick win
2. **Magnifier** (7-9h) - Medium complexity, high value for precision work
3. **Minimap** (6-8h) - Most complex, lower priority, nice-to-have

### Alternative Order (by user request):
1. **Undo/Redo** - Essential for productivity
2. **Magnifier with auto-activation** - Helpful for polygon/bbox drawing
3. **Minimap** - Navigation for very large images

---

## 5. Testing Plan

### Undo/Redo UI
- [ ] Keyboard shortcuts work (Ctrl+Z, Ctrl+Y)
- [ ] Buttons enable/disable correctly
- [ ] Toast notifications show action names
- [ ] All annotation operations are undoable
- [ ] History depth limit (50) works
- [ ] Redo stack clears after new action

### Minimap
- [ ] Shows entire image at correct scale
- [ ] Annotations render correctly
- [ ] Viewport rectangle updates on pan/zoom
- [ ] Click navigation works
- [ ] Drag viewport rectangle works
- [ ] Toggle visibility (M key)
- [ ] Performance with many annotations

### Magnifier
- [ ] Manual activation: Z key press/release works
- [ ] Auto activation: Shows when entering drawing tools (bbox, polygon, etc.)
- [ ] Auto deactivation: Hides when switching to non-drawing tools
- [ ] Following mode: Follows cursor with correct offset
- [ ] Following mode: Edge detection works (flips when near edges)
- [ ] Fixed mode: Stays in top-right corner
- [ ] Magnification adjusts with scroll (2x-8x range)
- [ ] Crosshair centers properly
- [ ] Coordinates display correctly
- [ ] Works with all drawing tools
- [ ] Performance (smooth 60fps rendering)
- [ ] Mode indicator shows current mode (optional)

---

## 6. Technical Considerations

### Performance
- **Minimap**: Throttle rendering to 30fps (requestAnimationFrame)
- **Magnifier**: Render on mouse move (careful with performance)
- **Undo/Redo**: JSON serialization can be slow with many annotations (consider optimization)

### Accessibility
- **Keyboard shortcuts**: Document all shortcuts in help panel
- **Tooltips**: Add to all toolbar buttons
- **Screen readers**: ARIA labels on buttons

### Browser Compatibility
- Canvas API: Widely supported
- Clip paths: Check Safari compatibility
- Keyboard events: Test on Mac (Cmd vs Ctrl)

---

## 7. Files to Create/Modify

### New Files:
- `frontend/components/annotation/Minimap.tsx` (new component)
- `frontend/components/annotation/Magnifier.tsx` (new component)

### Modified Files:
- `frontend/components/annotation/Canvas.tsx`
  - Add undo/redo buttons to zoom toolbar (line ~3280)
  - Integrate Magnifier component
  - Add auto-activation logic for magnifier
  - Add keyboard shortcuts (Ctrl+Z, Ctrl+Y, Z key)
  - Integrate Minimap component
- `frontend/lib/stores/annotationStore.ts`
  - Add magnifier preferences:
    - `autoMagnifier: boolean`
    - `magnifierMode: 'following' | 'fixed'`
    - `magnifierSize: number`
    - `magnificationLevel: number`
  - Verify all annotation operations call `recordSnapshot()`

---

## 8. Total Estimate

| Feature | Hours | Priority | Notes |
|---------|-------|----------|-------|
| Undo/Redo UI | 3-4h | High | Integrated into zoom toolbar |
| Magnifier | 7-9h | High | Auto-activation + dual modes |
| Minimap | 6-8h | Medium | Nice-to-have for navigation |
| **Total** | **16-21h** | - | 2-3 days focused work |

**Updated Requirements**:
- ✅ Undo/Redo: Bottom-left zoom toolbar (icon only)
- ✅ Magnifier: Auto-show in drawing tools + Z key manual activation
- ✅ Magnifier: Following mode + Fixed mode (test both)

**Recommended Sprint**: 2-3 days of focused work (start with Undo/Redo → Magnifier)

---

## 9. Success Criteria

### Undo/Redo UI ✅
- [ ] Toolbar buttons visible and functional
- [ ] Keyboard shortcuts work reliably
- [ ] Toast feedback on each action
- [ ] All annotation changes recorded
- [ ] History limit enforced

### Minimap ✅
- [ ] Visible in bottom-right corner
- [ ] Shows entire image scaled
- [ ] Renders all annotations
- [ ] Viewport indicator accurate
- [ ] Click/drag navigation works
- [ ] Toggle with M key

### Magnifier ✅
- [ ] Manual activation with Z key works
- [ ] Auto-activates in drawing tools (bbox, polygon, polyline, circle)
- [ ] Following mode: Follows cursor smoothly with edge detection
- [ ] Fixed mode: Stays in top-right corner
- [ ] Magnification adjustable (2x-8x) via scroll
- [ ] Crosshair and coordinates visible
- [ ] Mode toggle works (can switch between following/fixed)
- [ ] No performance degradation
- [ ] Doesn't interfere with drawing operations

---

**End of Implementation Plan**
