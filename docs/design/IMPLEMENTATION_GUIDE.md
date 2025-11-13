# Implementation Guide - Phase 1

**Date**: 2025-01-13
**Status**: Ready for Development
**Version**: 1.0
**Phase**: 1 (Core Annotation - Weeks 1-5)

## Table of Contents

- [Overview](#overview)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [Development Workflow](#development-workflow)
- [Week-by-Week Plan](#week-by-week-plan)
- [Testing Strategy](#testing-strategy)
- [Deployment](#deployment)

---

## Overview

### Phase 1 Goals

Build the core annotation system supporting:
- **Classification**: Single-label, multi-label, group labeling, hierarchical classes
- **Object Detection**: Horizontal bbox, rotated bbox (OBB)
- **Segmentation**: Polygon drawing, brush tool
- **Line Detection**: Straight line, polyline, circle/arc
- **Open Vocabulary**: Image-level captions + per-annotation captions

### Success Criteria

- ✅ User can create project with multiple task types
- ✅ Canvas renders smoothly at 60 FPS for 100+ annotations
- ✅ Image loads in < 500ms
- ✅ Undo/Redo works for all annotation operations
- ✅ Auto-save every 5 seconds (debounced)
- ✅ Export to COCO format
- ✅ 80% test coverage for core logic

---

## Frontend Architecture

### Technology Stack

```json
{
  "framework": "Next.js 14 (App Router)",
  "language": "TypeScript 5.3",
  "ui": "TailwindCSS + shadcn/ui",
  "canvas": "Fabric.js 5.3",
  "state": "Zustand 4.4",
  "api": "TanStack Query 5.x",
  "forms": "React Hook Form + Zod",
  "testing": "Vitest + Testing Library"
}
```

### Project Structure

```
labeler/frontend/
├── app/                           # Next.js App Router
│   ├── (auth)/                   # Auth routes
│   │   ├── login/
│   │   └── signup/
│   ├── projects/                 # Main app
│   │   ├── page.tsx             # Project list
│   │   ├── new/                 # Create project
│   │   └── [id]/
│   │       ├── page.tsx         # Project overview
│   │       └── label/
│   │           └── page.tsx     # Annotation workspace
│   └── layout.tsx
│
├── components/
│   ├── annotation/               # Core annotation components
│   │   ├── workspace/
│   │   │   ├── AnnotationWorkspace.tsx      # Main workspace layout
│   │   │   ├── ImageCanvas.tsx              # Fabric.js canvas wrapper
│   │   │   ├── Toolbar.tsx                  # Tool selector
│   │   │   └── PropertyPanel.tsx            # Right sidebar
│   │   │
│   │   ├── tools/                # Tool implementations
│   │   │   ├── ClassificationTool.tsx
│   │   │   ├── DetectionTool.tsx            # HBB + OBB
│   │   │   ├── SegmentationTool.tsx         # Polygon + brush
│   │   │   ├── LineDetectionTool.tsx
│   │   │   └── OpenVocabTool.tsx
│   │   │
│   │   ├── controls/             # Tool controls
│   │   │   ├── ClassSelector.tsx
│   │   │   ├── AttributeEditor.tsx
│   │   │   └── CaptionInput.tsx
│   │   │
│   │   └── overlays/             # UI overlays
│   │       ├── MiniMap.tsx
│   │       └── ZoomControls.tsx
│   │
│   ├── dataset/
│   │   ├── ImageGrid.tsx
│   │   ├── ImageThumbnail.tsx
│   │   └── ImageList.tsx         # Left sidebar
│   │
│   └── ui/                        # shadcn/ui components
│       ├── button.tsx
│       ├── dialog.tsx
│       └── ...
│
├── lib/
│   ├── annotation-engine/         # Core logic (framework-agnostic)
│   │   ├── canvas/
│   │   │   ├── FabricCanvas.ts            # Fabric.js wrapper
│   │   │   ├── CanvasEventHandler.ts      # Mouse/keyboard events
│   │   │   └── CanvasRenderer.ts          # Render annotations
│   │   │
│   │   ├── shapes/                # Shape primitives
│   │   │   ├── BaseShape.ts
│   │   │   ├── Rectangle.ts
│   │   │   ├── RotatedBox.ts
│   │   │   ├── Polygon.ts
│   │   │   ├── Line.ts
│   │   │   ├── Polyline.ts
│   │   │   └── Circle.ts
│   │   │
│   │   ├── tools/                 # Tool state machines
│   │   │   ├── BaseTool.ts
│   │   │   ├── RectangleTool.ts
│   │   │   ├── RotatedBoxTool.ts
│   │   │   ├── PolygonTool.ts
│   │   │   └── LineTool.ts
│   │   │
│   │   ├── state/
│   │   │   ├── AnnotationStore.ts         # Annotation state
│   │   │   ├── UndoRedoManager.ts         # History management
│   │   │   └── SelectionManager.ts        # Multi-select
│   │   │
│   │   └── utils/
│   │       ├── geometry.ts                # Math utilities
│   │       ├── validation.ts              # Annotation validation
│   │       └── serialization.ts           # To/from JSON
│   │
│   ├── api/                        # API clients (TanStack Query)
│   │   ├── projects.ts
│   │   ├── annotations.ts
│   │   ├── images.ts
│   │   └── exports.ts
│   │
│   └── stores/                     # Zustand stores
│       ├── useProjectStore.ts
│       ├── useAnnotationStore.ts
│       └── useUIStore.ts           # UI state (tool, zoom, etc.)
│
├── hooks/
│   ├── useKeyboardShortcuts.ts
│   ├── useAutoSave.ts
│   └── useImageLoader.ts
│
└── types/
    ├── annotation.ts
    ├── project.ts
    └── api.ts
```

### State Management

**1. Project State (Zustand)**:
```typescript
// stores/useProjectStore.ts
interface ProjectState {
  project: Project | null;
  images: Image[];
  currentImageIndex: number;

  // Actions
  setProject: (project: Project) => void;
  loadImages: () => Promise<void>;
  nextImage: () => void;
  prevImage: () => void;
}

const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  images: [],
  currentImageIndex: 0,

  setProject: (project) => set({ project }),
  loadImages: async () => {
    const images = await fetchImages(get().project.id);
    set({ images });
  },
  nextImage: () => set((state) => ({
    currentImageIndex: Math.min(state.currentImageIndex + 1, state.images.length - 1)
  })),
  prevImage: () => set((state) => ({
    currentImageIndex: Math.max(state.currentImageIndex - 1, 0)
  }))
}));
```

**2. Annotation State (Zustand + Immer)**:
```typescript
// stores/useAnnotationStore.ts
interface AnnotationState {
  annotations: Annotation[];
  selectedIds: number[];
  clipboard: Annotation[];

  // Actions
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: number, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: number) => void;
  selectAnnotation: (id: number, multi: boolean) => void;

  // Undo/Redo
  undo: () => void;
  redo: () => void;
}

const useAnnotationStore = create<AnnotationState>()(
  immer((set) => ({
    annotations: [],
    selectedIds: [],
    clipboard: [],

    addAnnotation: (annotation) => set((state) => {
      state.annotations.push(annotation);
      state.selectedIds = [annotation.id];
      undoRedoManager.push({ type: 'add', annotation });
    }),

    updateAnnotation: (id, updates) => set((state) => {
      const idx = state.annotations.findIndex(a => a.id === id);
      if (idx !== -1) {
        const prev = state.annotations[idx];
        Object.assign(state.annotations[idx], updates);
        undoRedoManager.push({ type: 'update', id, prev, next: updates });
      }
    }),

    deleteAnnotation: (id) => set((state) => {
      const idx = state.annotations.findIndex(a => a.id === id);
      if (idx !== -1) {
        const annotation = state.annotations[idx];
        state.annotations.splice(idx, 1);
        state.selectedIds = state.selectedIds.filter(sid => sid !== id);
        undoRedoManager.push({ type: 'delete', annotation });
      }
    }),

    undo: () => undoRedoManager.undo(),
    redo: () => undoRedoManager.redo()
  }))
);
```

**3. UI State (Zustand)**:
```typescript
// stores/useUIStore.ts
interface UIState {
  activeTool: ToolType;
  selectedClass: number;
  zoom: number;
  showLabels: boolean;

  setActiveTool: (tool: ToolType) => void;
  setSelectedClass: (classId: number) => void;
  setZoom: (zoom: number) => void;
}
```

### Rendering Pipeline

```
1. Image Load
   → Progressive: Thumbnail → Low-res → Full-res
   → Store in canvas background

2. Annotation Render
   → For each annotation:
      - Get Fabric.js object (cached)
      - Update style (selected, hovered, class color)
      - Render on canvas

3. Tool Interaction
   → Mouse down → Create temp shape
   → Mouse move → Update temp shape
   → Mouse up → Finalize annotation
   → Add to store → Re-render

4. Canvas Update (60 FPS)
   → Fabric.js requestRenderAll()
   → Only render visible annotations (viewport culling)
```

### Key Interactions

**1. Rectangle Tool (HBB)**:
```typescript
// lib/annotation-engine/tools/RectangleTool.ts
class RectangleTool extends BaseTool {
  onMouseDown(point: Point) {
    this.startPoint = point;
    this.tempRect = new fabric.Rect({
      left: point.x,
      top: point.y,
      width: 0,
      height: 0,
      fill: 'transparent',
      stroke: this.getClassColor(),
      strokeWidth: 2
    });
    this.canvas.add(this.tempRect);
  }

  onMouseMove(point: Point) {
    if (!this.tempRect) return;

    const width = point.x - this.startPoint.x;
    const height = point.y - this.startPoint.y;

    this.tempRect.set({
      left: width > 0 ? this.startPoint.x : point.x,
      top: height > 0 ? this.startPoint.y : point.y,
      width: Math.abs(width),
      height: Math.abs(height)
    });

    this.canvas.requestRenderAll();
  }

  onMouseUp(point: Point) {
    if (!this.tempRect) return;

    const bbox = [
      this.tempRect.left,
      this.tempRect.top,
      this.tempRect.width,
      this.tempRect.height
    ];

    // Validation
    if (bbox[2] < this.minSize || bbox[3] < this.minSize) {
      this.canvas.remove(this.tempRect);
      return;
    }

    // Create annotation
    const annotation = {
      annotation_type: 'bbox',
      class_id: this.selectedClass,
      geometry: { type: 'bbox', bbox }
    };

    this.emit('annotationCreated', annotation);
    this.canvas.remove(this.tempRect);
    this.tempRect = null;
  }
}
```

**2. Rotated Box Tool (OBB)**:
```typescript
// lib/annotation-engine/tools/RotatedBoxTool.ts
class RotatedBoxTool extends BaseTool {
  // Phase 1: Draw initial rectangle
  // Phase 2: Add rotation handle
  // Phase 3: Rotate with handle drag

  onMouseUp(point: Point) {
    if (this.phase === 'rotation') {
      const cx = this.tempRect.left + this.tempRect.width / 2;
      const cy = this.tempRect.top + this.tempRect.height / 2;
      const angle = this.tempRect.angle || 0;

      const annotation = {
        annotation_type: 'rotated_bbox',
        class_id: this.selectedClass,
        geometry: {
          type: 'rotated_bbox',
          cx, cy,
          width: this.tempRect.width,
          height: this.tempRect.height,
          angle
        }
      };

      this.emit('annotationCreated', annotation);
    }
  }
}
```

**3. Polygon Tool**:
```typescript
// lib/annotation-engine/tools/PolygonTool.ts
class PolygonTool extends BaseTool {
  points: Point[] = [];

  onMouseDown(point: Point) {
    this.points.push(point);

    // Draw vertex circle
    const circle = new fabric.Circle({
      left: point.x - 3,
      top: point.y - 3,
      radius: 3,
      fill: this.getClassColor()
    });
    this.canvas.add(circle);

    // Update polygon
    this.updatePolygon();
  }

  onDoubleClick() {
    // Close polygon
    if (this.points.length < 3) return;

    const annotation = {
      annotation_type: 'polygon',
      class_id: this.selectedClass,
      geometry: {
        type: 'polygon',
        points: this.points
      }
    };

    this.emit('annotationCreated', annotation);
    this.reset();
  }
}
```

---

## Backend Architecture

### Project Structure

```
labeler/backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── projects.py          # Project CRUD
│   │       ├── annotations.py       # Annotation CRUD
│   │       ├── images.py            # Image access
│   │       ├── tasks.py             # Task management
│   │       ├── comments.py          # Comments
│   │       ├── exports.py           # Export functionality
│   │       └── ai.py                # AI assist (Phase 3)
│   │
│   ├── core/
│   │   ├── config.py                # Settings
│   │   ├── security.py              # JWT validation
│   │   └── storage.py               # S3 client
│   │
│   ├── db/
│   │   ├── base.py                  # SQLAlchemy base
│   │   ├── session.py               # DB session
│   │   └── models/
│   │       ├── project.py
│   │       ├── annotation.py
│   │       ├── task.py
│   │       └── comment.py
│   │
│   ├── schemas/                      # Pydantic models
│   │   ├── project.py
│   │   ├── annotation.py
│   │   └── common.py
│   │
│   ├── services/
│   │   ├── project_service.py
│   │   ├── annotation_service.py
│   │   ├── storage_service.py
│   │   ├── export_service.py
│   │   └── validation_service.py     # Smart validation
│   │
│   └── main.py                       # FastAPI app
│
├── alembic/                          # DB migrations
│   └── versions/
│
├── tests/
│   ├── unit/
│   └── integration/
│
├── requirements.txt
└── Dockerfile
```

### Core Services

**1. Annotation Service** (with smart validation):
```python
# app/services/annotation_service.py

class AnnotationService:
    def __init__(self, db: Session, storage: StorageService):
        self.db = db
        self.storage = storage
        self.validator = SmartValidator()

    async def create_annotation(
        self,
        project_id: str,
        annotation_data: AnnotationCreate
    ) -> Annotation:
        # 1. Validate
        validation_result = self.validator.validate(annotation_data)
        if validation_result.auto_fixable:
            annotation_data = validation_result.fixed_data
        elif validation_result.errors:
            raise ValidationError(validation_result.errors)

        # 2. Create in DB
        annotation = Annotation(
            project_id=project_id,
            **annotation_data.dict()
        )
        self.db.add(annotation)
        await self.db.commit()

        # 3. Sync to S3 (async)
        asyncio.create_task(
            self.storage.sync_annotations_to_s3(project_id)
        )

        return annotation
```

**2. Smart Validator**:
```python
# app/services/validation_service.py

class SmartValidator:
    """Smart annotation validation with auto-fix"""

    def validate(self, annotation: AnnotationCreate) -> ValidationResult:
        errors = []
        fixes = {}

        if annotation.annotation_type == 'bbox':
            # Check minimum size
            bbox = annotation.geometry['bbox']
            if bbox[2] < 5 or bbox[3] < 5:
                errors.append("Bounding box too small (min 5px)")

            # Auto-fix: Snap to pixel grid
            fixes['bbox'] = [round(x) for x in bbox]

        elif annotation.annotation_type == 'polygon':
            points = annotation.geometry['points']

            # Check minimum vertices
            if len(points) < 3:
                errors.append("Polygon must have at least 3 vertices")

            # Auto-fix: Remove duplicate consecutive points
            unique_points = []
            for i, p in enumerate(points):
                if i == 0 or p != points[i-1]:
                    unique_points.append(p)

            if len(unique_points) != len(points):
                fixes['points'] = unique_points

            # Auto-fix: Self-intersecting polygon
            if self.is_self_intersecting(points):
                fixed_points = self.fix_self_intersection(points)
                fixes['points'] = fixed_points

        elif annotation.annotation_type == 'rotated_bbox':
            # Normalize angle to 0-360
            angle = annotation.geometry.get('angle', 0)
            fixes['angle'] = angle % 360

        return ValidationResult(
            valid=len(errors) == 0,
            errors=errors,
            auto_fixable=len(fixes) > 0,
            fixes=fixes
        )

    def is_self_intersecting(self, points: List[Point]) -> bool:
        """Check if polygon self-intersects"""
        # Implement line segment intersection algorithm
        ...

    def fix_self_intersection(self, points: List[Point]) -> List[Point]:
        """Fix self-intersecting polygon"""
        # Use Shapely or custom algorithm
        from shapely.geometry import Polygon
        poly = Polygon(points)
        if not poly.is_valid:
            poly = poly.buffer(0)  # Fix self-intersection
        return list(poly.exterior.coords)[:-1]
```

**3. Export Service**:
```python
# app/services/export_service.py

class ExportService:
    async def export_to_coco(
        self,
        project_id: str,
        include_images: bool = False
    ) -> str:
        """Export annotations to COCO format"""

        # 1. Load project and annotations
        project = await self.get_project(project_id)
        annotations = await self.get_all_annotations(project_id)

        # 2. Build COCO structure
        coco = {
            "info": {...},
            "licenses": [...],
            "categories": [
                {"id": cls['id'], "name": cls['name']}
                for cls in project.classes
            ],
            "images": [],
            "annotations": []
        }

        # 3. Convert annotations
        for img_id, img_anns in self.group_by_image(annotations):
            coco['images'].append({
                "id": img_id,
                "file_name": img_anns[0].image_filename,
                ...
            })

            for ann in img_anns:
                coco['annotations'].append(
                    self.to_coco_annotation(ann)
                )

        # 4. Write to file and upload to S3
        export_path = f"exports/{project_id}/coco_{timestamp}.json"
        await self.storage.upload_json(export_path, coco)

        return export_path

    def to_coco_annotation(self, ann: Annotation) -> dict:
        """Convert annotation to COCO format"""
        if ann.annotation_type == 'bbox':
            return {
                "id": ann.id,
                "image_id": ann.image_id,
                "category_id": ann.class_id,
                "bbox": ann.geometry['bbox'],
                "area": ann.geometry['bbox'][2] * ann.geometry['bbox'][3],
                "iscrowd": 0
            }
        elif ann.annotation_type == 'polygon':
            points = ann.geometry['points']
            flat_points = [coord for point in points for coord in point]
            return {
                "id": ann.id,
                "image_id": ann.image_id,
                "category_id": ann.class_id,
                "segmentation": [flat_points],
                "area": self.calculate_polygon_area(points),
                "bbox": self.get_bounding_box(points),
                "iscrowd": 0
            }
```

---

## Week-by-Week Plan

### Week 1: Setup & Infrastructure

**Goals**:
- Set up project structure
- Configure Docker development environment
- Implement authentication
- Database migrations

**Tasks**:
- [ ] Initialize Next.js + FastAPI projects
- [ ] Set up docker-compose with PostgreSQL, Redis, MinIO
- [ ] Implement JWT authentication (shared with Platform)
- [ ] Create database schema (Alembic migrations)
- [ ] Set up Fabric.js canvas (basic rendering)

**Deliverable**: Working development environment, user can log in

### Week 2: Project Management & Image Loading

**Goals**:
- Project CRUD operations
- Image listing and loading
- Presigned URL generation

**Tasks**:
- [ ] Implement Projects API (create, read, update, delete)
- [ ] Build project creation UI
- [ ] Implement image loading from S3
- [ ] Progressive image loading (thumbnail → full)
- [ ] Image grid view with thumbnails

**Deliverable**: User can create project and see dataset images

### Week 3: Classification & Detection Tools

**Goals**:
- Classification tool (single/multi-label)
- Horizontal bounding box tool

**Tasks**:
- [ ] Classification UI (class selector, group labeling)
- [ ] Hierarchical class structure UI
- [ ] Rectangle drawing tool (Fabric.js)
- [ ] Annotation state management (Zustand)
- [ ] Undo/Redo system
- [ ] Auto-save to backend

**Deliverable**: User can classify images and draw bounding boxes

### Week 4: Advanced Tools (OBB, Segmentation, Lines)

**Goals**:
- Rotated bounding box
- Polygon drawing
- Line detection tools

**Tasks**:
- [ ] Rotated bbox tool with rotation handle
- [ ] Polygon tool (click-to-add-vertex)
- [ ] Line tools (straight, polyline, circle)
- [ ] Tool-specific property panels
- [ ] Keyboard shortcuts (R=Rectangle, P=Polygon, L=Line)

**Deliverable**: All Phase 1 annotation tools working

### Week 5: Polish & Export

**Goals**:
- Export functionality
- Performance optimization
- Bug fixes

**Tasks**:
- [ ] Export to COCO format
- [ ] Canvas performance optimization (viewport culling)
- [ ] Smart validation implementation
- [ ] Error handling and user feedback
- [ ] Integration testing
- [ ] Documentation

**Deliverable**: Production-ready Phase 1 release

---

## Testing Strategy

### Unit Tests

**Frontend** (Vitest):
```typescript
// lib/annotation-engine/shapes/Rectangle.test.ts
describe('Rectangle', () => {
  it('should create rectangle from two points', () => {
    const rect = Rectangle.fromPoints(
      { x: 100, y: 200 },
      { x: 400, y: 600 }
    );

    expect(rect.bbox).toEqual([100, 200, 300, 400]);
  });

  it('should handle negative dimensions', () => {
    const rect = Rectangle.fromPoints(
      { x: 400, y: 600 },
      { x: 100, y: 200 }
    );

    expect(rect.bbox).toEqual([100, 200, 300, 400]);
  });
});
```

**Backend** (pytest):
```python
# tests/unit/test_validation_service.py
def test_validate_bbox_minimum_size():
    validator = SmartValidator()

    annotation = AnnotationCreate(
        annotation_type='bbox',
        geometry={'bbox': [100, 200, 2, 3]}  # Too small
    )

    result = validator.validate(annotation)
    assert not result.valid
    assert 'too small' in result.errors[0].lower()

def test_auto_fix_self_intersecting_polygon():
    validator = SmartValidator()

    # Self-intersecting polygon (figure-8)
    annotation = AnnotationCreate(
        annotation_type='polygon',
        geometry={'points': [[0,0], [100,100], [100,0], [0,100]]}
    )

    result = validator.validate(annotation)
    assert result.auto_fixable
    assert not validator.is_self_intersecting(result.fixes['points'])
```

### Integration Tests

```typescript
// tests/integration/annotation-workflow.test.ts
describe('Annotation Workflow', () => {
  it('should create, update, and delete annotation', async () => {
    const { user } = await setupTest();

    // 1. Create project
    const project = await createProject(user, {
      name: 'Test Project',
      task_types: ['detection']
    });

    // 2. Load image
    await loadImage(project.id, 1);

    // 3. Draw rectangle
    const annotation = await drawRectangle({
      left: 100,
      top: 200,
      width: 300,
      height: 400
    });

    expect(annotation.id).toBeDefined();
    expect(annotation.annotation_type).toBe('bbox');

    // 4. Update
    await updateAnnotation(annotation.id, {
      class_id: 1
    });

    const updated = await getAnnotation(annotation.id);
    expect(updated.class_id).toBe(1);

    // 5. Delete
    await deleteAnnotation(annotation.id);
    const deleted = await getAnnotation(annotation.id);
    expect(deleted).toBeNull();
  });
});
```

---

## Deployment

### Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  labeler-backend:
    build: ./backend
    ports: ["8001:8001"]
    environment:
      DATABASE_URL: postgresql://platform:platform@postgres:5432/platform
      R2_ENDPOINT: http://minio:9000
      JWT_SECRET: dev-secret
    depends_on:
      - postgres
      - minio

  labeler-frontend:
    build: ./frontend
    ports: ["3001:3000"]
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8001

  postgres:
    image: postgres:16
    ports: ["5432:5432"]
    environment:
      POSTGRES_DB: platform
      POSTGRES_USER: platform
      POSTGRES_PASSWORD: platform

  minio:
    image: minio/minio
    ports: ["9000:9000", "9001:9001"]
    command: server /data --console-address ":9001"
```

### Commands

```bash
# Start development environment
docker-compose up -d

# Run migrations
docker-compose exec labeler-backend alembic upgrade head

# Run tests
docker-compose exec labeler-backend pytest
docker-compose exec labeler-frontend npm test

# View logs
docker-compose logs -f labeler-backend

# Stop
docker-compose down
```

---

## References

- [Project Design](./PROJECT_DESIGN.md)
- [Platform Integration](./PLATFORM_INTEGRATION.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [API Specification](./API_SPEC.md)

---

**Last Updated**: 2025-01-13
**Status**: Ready for Implementation
