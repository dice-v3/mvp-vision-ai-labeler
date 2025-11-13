# Vision AI Labeler - Project Design Document

**Date**: 2025-01-13 (Updated)
**Status**: Design Review v1
**Version**: 0.2

## Table of Contents

- [Overview](#overview)
- [Core Objectives](#core-objectives)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [User Experience](#user-experience)
- [Data Management](#data-management)
- [Integration with Platform](#integration-with-platform)
- [Development Phases](#development-phases)
- [Performance Requirements](#performance-requirements)

---

## Overview

Vision AI Labeler는 Vision AI 플랫폼의 데이터셋 annotation을 위한 웹 기반 레이블링 도구입니다. Storage에 저장된 이미지를 불러와 다양한 Computer Vision task에 대한 annotation을 수행하며, 사용자 경험과 생산성을 최우선으로 합니다.

### Project Context

- **Parent Platform**: Vision AI Training Platform
- **Shared Resources**: Storage (MinIO/R2), Database (PostgreSQL), Authentication
- **Deployment**: Docker-based, 플랫폼과 함께 배포

---

## Core Objectives

### 1. Comprehensive Task Support

다양한 Computer Vision task를 지원하며, 향후 확장 가능한 구조:

- **Classification**: Single-label, Multi-label, Group label, Hierarchical classes
- **Object Detection**: Horizontal bbox, Rotated bbox (OBB)
- **Segmentation**: Polygon, Free-form mask, Brush
- **Line Detection**: Straight line, Polyline, Circle/Arc
- **Open Vocabulary**: Standalone or combined with Classification/Detection/Segmentation
- **Pose Estimation**: Keypoint annotation with skeleton templates
- **OCR**: Text detection + recognition
- **Future**: Video annotation, 3D point cloud, Instance tracking

### 2. Superior User Experience

빠르고 직관적인 annotation 워크플로우:

- 빠른 이미지 로딩 (< 500ms)
- 부드러운 인터랙션 (60 FPS)
- 키보드 단축키 지원
- Undo/Redo 기능
- Auto-save
- 실시간 미리보기

### 3. Collaborative Workflows

팀 단위의 효율적인 작업 지원:

- Multi-user annotation
- Task assignment
- Review workflow
- Annotation quality metrics
- Progress tracking

### 4. Flexible Architecture

확장 가능하고 유지보수가 용이한 구조:

- Plugin 기반 task 추가
- Customizable UI components
- API-first design
- Storage-agnostic architecture

---

## Key Features

### Annotation Tools

#### 1. Classification Tool
```
Features:
- Single-label / Multi-label selection
- Group labeling (multiple images → single class)
  * Select multiple images in grid view
  * Assign same class to all selected
  * Useful for sorting/filtering tasks
- Hierarchical class structure
  * Tree-based class taxonomy (e.g., Animal → Mammal → Dog → Husky)
  * Drill-down UI for nested classes
  * Support for multiple inheritance paths
- Batch annotation (keyboard shortcuts)
- Smart suggestions (ML-assisted pre-labeling)
- Confidence score input (optional)
- Class attributes (e.g., quality: good/bad/unsure)
```

#### 2. Object Detection Tool
```
Features:
- Horizontal bounding box (HBB)
  * Rectangle drawing (drag & drop)
  * Resize & move with handles
  * Smart snap-to-edges
- Rotated bounding box (OBB)
  * 5-point representation: (cx, cy, width, height, angle)
  * Rotation handle for angle adjustment
  * Use cases: Aerial imagery, text in the wild, oriented objects
- Class assignment per box
- Attribute tagging (truncated, occluded, difficult, etc.)
- Copy/paste boxes across images
- Duplicate & offset (for similar objects)
- Zoom & pan (mouse wheel, trackpad gestures)
- Multi-select for batch operations
- Open Vocabulary integration (optional caption per box)
```

#### 3. Segmentation Tool
```
Features:
- Polygon drawing (click-based)
  * Click to add vertices
  * Double-click or Enter to close polygon
  * Edit vertices after creation
- Free-form brush
  * Adjustable brush size
  * Smooth curves
  * Pressure sensitivity (tablet support)
- Magic wand (AI-assisted)
  * Click to select similar pixels
  * Adjustable tolerance
- SAM (Segment Anything Model) integration
  * Click prompts (positive/negative)
  * Box prompts
  * Auto-segmentation
- Eraser tool
- Fill tool (flood fill for closed regions)
- Bezier curve editing (smooth curves)
- Mask overlay opacity control
- Multi-class instance segmentation
- Open Vocabulary integration (optional caption per instance)
```

#### 4. Line Detection Tool
```
Features:
- Straight line
  * Click two points to define line
  * Infinite line or line segment (configurable)
  * Width attribute (for thick lines)
- Polyline
  * Click to add vertices (like polygon, but open-ended)
  * Support for spline interpolation
  * Edit vertices after creation
- Circle / Arc
  * Circle: Click center + drag radius
  * Arc: Click center + drag radius + set start/end angles
  * Ellipse support (separate width/height)
- Line attributes
  * Line type (solid, dashed, dotted)
  * Color & thickness
  * Class assignment (e.g., lane line, power line, boundary)
- Use cases
  * Autonomous driving: Lane detection, road boundaries
  * Medical imaging: Measurement lines, annotations
  * Satellite imagery: Infrastructure detection (roads, pipelines)
  * Document analysis: Table borders, text baselines
```

#### 5. Open Vocabulary Tool
```
Features:
- Standalone mode
  * Image-level captions (no spatial annotation)
  * Multiple captions per image
  * Tag-based organization
- Combined mode (with other tasks)
  * Classification + caption (explain why this class)
  * Detection + caption (describe each box)
  * Segmentation + caption (describe each instance)
- Natural language description input
  * Free-form text area
  * Character limit: 500 chars (configurable)
- Pre-defined prompt templates
  * "Describe this object in detail"
  * "What is unusual about this image?"
  * "List all visible objects"
- LLM-assisted caption generation
  * Auto-generate captions using CLIP/BLIP models
  * Edit generated captions
  * Confidence scores
- Bulk caption editing
  * Find & replace
  * Copy captions across similar images
```

#### 6. Pose Estimation Tool
```
Features:
- Skeleton template selection
  * COCO (17 keypoints)
  * MPII (16 keypoints)
  * Custom skeletons (user-defined)
- Keypoint placement (click-based)
  * Click to place keypoint
  * Drag to reposition
  * Auto-snap to detected joints (AI-assisted)
- Automatic symmetry
  * Mirror left/right keypoints
  * Flip skeleton
- Visibility flags
  * Visible / Occluded / Not labeled
  * Per-keypoint confidence
- Multiple person tracking
  * Assign unique ID to each person
  * Track across frames (video)
- Interpolation between frames (video)
  * Linear interpolation
  * Spline interpolation
```

#### 7. OCR Tool
```
Features:
- Text detection
  * Bounding box (horizontal or rotated)
  * Polygon (for curved text)
  * Auto-detection using EAST/CRAFT models
- Text recognition
  * Manual transcription input
  * Auto-recognition using Tesseract/PaddleOCR
  * Edit recognized text
- Text attributes
  * Language (multi-language support)
  * Font properties (size, style, color)
  * Reading order (for layout analysis)
  * Confidence score
- Layout analysis
  * Group text into paragraphs/sections
  * Table detection & cell extraction
  * Hierarchical structure (title, heading, body)
- Use cases
  * Document digitization
  * Scene text recognition (street signs, storefronts)
  * Handwritten text annotation
  * Invoice/receipt parsing
```

### Supporting Features

#### Navigation & Organization
- Grid view with thumbnail preview
- Filter by annotation status (unlabeled, in-progress, completed, reviewed)
- Search by filename, class, attributes
- Bookmarking
- Custom sorting

#### Quality Control
- Annotation validation rules
- Inter-annotator agreement metrics
- Review mode with approve/reject
- Annotation history & versioning
- Anomaly detection (suspicious annotations)

#### Productivity Tools
- Keyboard shortcuts (customizable)
- Annotation templates
- Batch operations (delete, copy, export)
- Smart defaults (remember last class, size, etc.)
- AI-assisted pre-labeling

#### Collaboration
- User assignment
- Comment & discussion threads
- Real-time collaboration indicators
- Activity log
- Notification system

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (Web UI)                            │
│                    (Next.js + Canvas/WebGL)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐         │
│  │ Annotation   │  │ Image Viewer │  │ Dataset Manager   │         │
│  │ Tools        │  │ (Canvas)     │  │                   │         │
│  └──────────────┘  └──────────────┘  └───────────────────┘         │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ HTTP/WebSocket
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Backend Service (FastAPI)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐         │
│  │ Annotation   │  │ Dataset API  │  │ User & Auth       │         │
│  │ API          │  │              │  │                   │         │
│  └──────────────┘  └──────────────┘  └───────────────────┘         │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐         │
│  │ AI Assist    │  │ Export API   │  │ Real-time Sync    │         │
│  │ (ML Models)  │  │              │  │ (WebSocket)       │         │
│  └──────────────┘  └──────────────┘  └───────────────────┘         │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Data Layer                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │PostgreSQL│  │  Redis   │  │ S3/R2    │  │ Cache    │           │
│  │(Metadata)│  │(Sessions)│  │(Images)  │  │(Thumbnails)          │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### Frontend Architecture

```
frontend/
├── app/                          # Next.js 14 App Router
│   ├── (auth)/                  # Auth pages
│   │   ├── login/
│   │   └── signup/
│   ├── datasets/                # Dataset management
│   │   ├── [id]/
│   │   │   ├── page.tsx        # Dataset detail
│   │   │   └── label/          # Annotation workspace
│   │   │       └── page.tsx
│   │   └── page.tsx            # Dataset list
│   └── layout.tsx
│
├── components/
│   ├── annotation/              # Annotation tools
│   │   ├── canvas/             # Canvas rendering
│   │   │   ├── ImageCanvas.tsx
│   │   │   ├── AnnotationLayer.tsx
│   │   │   └── InteractionLayer.tsx
│   │   ├── tools/              # Task-specific tools
│   │   │   ├── ClassificationTool.tsx
│   │   │   ├── DetectionTool.tsx
│   │   │   ├── SegmentationTool.tsx
│   │   │   ├── LineDetectionTool.tsx
│   │   │   ├── OpenVocabTool.tsx
│   │   │   ├── PoseTool.tsx
│   │   │   └── OCRTool.tsx
│   │   └── toolbar/            # Tool controls
│   │       ├── ToolSelector.tsx
│   │       └── ToolSettings.tsx
│   │
│   ├── dataset/                 # Dataset components
│   │   ├── ImageGrid.tsx
│   │   ├── ImageThumbnail.tsx
│   │   └── DatasetStats.tsx
│   │
│   ├── ui/                      # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Modal.tsx
│   │   └── ...
│   │
│   └── layout/
│       ├── Sidebar.tsx
│       └── Header.tsx
│
├── lib/
│   ├── annotation-engine/       # Core annotation logic
│   │   ├── shapes/             # Shape primitives
│   │   │   ├── Rectangle.ts
│   │   │   ├── RotatedBox.ts
│   │   │   ├── Polygon.ts
│   │   │   ├── Line.ts
│   │   │   ├── Polyline.ts
│   │   │   ├── Circle.ts
│   │   │   ├── Keypoint.ts
│   │   │   └── TextBox.ts
│   │   ├── renderer/           # Canvas rendering
│   │   │   ├── CanvasRenderer.ts
│   │   │   └── WebGLRenderer.ts (for large images)
│   │   ├── interaction/        # Mouse/keyboard handling
│   │   │   ├── MouseHandler.ts
│   │   │   └── KeyboardShortcuts.ts
│   │   └── state/              # Annotation state
│   │       ├── AnnotationStore.ts
│   │       └── UndoRedoManager.ts
│   │
│   ├── api/                     # API clients
│   │   ├── dataset.ts
│   │   ├── annotation.ts
│   │   └── storage.ts
│   │
│   └── utils/
│       ├── image-loader.ts     # Progressive image loading
│       ├── format-converter.ts # Annotation format conversion
│       └── validation.ts
│
└── stores/                      # State management (Zustand)
    ├── annotation-store.ts
    ├── dataset-store.ts
    └── user-store.ts
```

#### Backend Architecture

```
backend/
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── datasets/       # Dataset management
│   │   │   │   ├── __init__.py
│   │   │   │   ├── routes.py
│   │   │   │   └── schemas.py
│   │   │   │
│   │   │   ├── annotations/    # Annotation CRUD
│   │   │   │   ├── routes.py
│   │   │   │   ├── schemas.py
│   │   │   │   └── validation.py
│   │   │   │
│   │   │   ├── images/         # Image access & thumbnails
│   │   │   │   ├── routes.py
│   │   │   │   └── presigned.py
│   │   │   │
│   │   │   ├── export/         # Export to various formats
│   │   │   │   ├── routes.py
│   │   │   │   └── formatters/
│   │   │   │       ├── coco.py
│   │   │   │       ├── yolo.py
│   │   │   │       └── pascal_voc.py
│   │   │   │
│   │   │   └── ai_assist/      # ML-assisted annotation
│   │   │       ├── routes.py
│   │   │       └── models/
│   │   │           ├── sam.py  # Segment Anything
│   │   │           └── preprocess.py
│   │   │
│   │   └── websocket/          # Real-time collaboration
│   │       └── routes.py
│   │
│   ├── db/
│   │   ├── models.py           # SQLAlchemy models
│   │   ├── session.py
│   │   └── migrations/         # Alembic migrations
│   │
│   ├── services/
│   │   ├── annotation_service.py
│   │   ├── dataset_service.py
│   │   ├── storage_service.py  # S3 abstraction
│   │   ├── export_service.py
│   │   └── ai_service.py
│   │
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py         # JWT, permissions
│   │   └── storage.py          # S3 client wrapper
│   │
│   └── main.py                 # FastAPI app
│
└── tests/
    ├── unit/
    └── integration/
```

---

## Technology Stack

### Frontend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | **Next.js 14** (App Router) | React framework with SSR |
| Language | **TypeScript 5.3** | Type safety |
| UI Library | **TailwindCSS** + **shadcn/ui** | Styling & components |
| Canvas | **Fabric.js** or **Konva.js** | 2D annotation rendering |
| WebGL | **Three.js** (optional) | Large image rendering |
| State | **Zustand** | Client state management |
| API | **TanStack Query** | Server state & caching |
| Forms | **React Hook Form** + **Zod** | Form handling & validation |
| WebSocket | **Socket.io-client** | Real-time collaboration |

**Why these choices?**
- **Fabric.js**: Rich canvas API, built-in object manipulation
- **Zustand**: Lightweight, no boilerplate, good for annotation state
- **TanStack Query**: Automatic caching, refetching, optimistic updates

### Backend

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | **FastAPI 0.109** | Async Python web framework |
| Language | **Python 3.11** | Backend logic |
| ORM | **SQLAlchemy 2.0** | Database abstraction |
| Validation | **Pydantic 2.5** | Request/response validation |
| Auth | **python-jose** (JWT) | Authentication |
| WebSocket | **FastAPI WebSocket** | Real-time updates |
| Storage | **boto3** | S3 API client |
| Cache | **Redis 7.2** | Session & thumbnail cache |
| Tasks | **Celery** (optional) | Background jobs (export, AI) |
| Testing | **pytest** + **pytest-asyncio** | Test framework |

**Shared with Platform**:
- Database schema (User, Dataset, Snapshot tables)
- Storage client (S3/R2)
- Authentication (JWT tokens)

### Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Database | **PostgreSQL 16** | Metadata, annotations |
| Cache | **Redis 7.2** | Sessions, thumbnails, pub/sub |
| Storage | **MinIO** (dev) / **R2** (prod) | Image storage |
| Container | **Docker** + **Docker Compose** | Development |
| Deployment | **Kubernetes** (Railway) | Production |

---

## User Experience

### Annotation Workspace Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│  Header: Dataset Name | Progress (45/100) | Save Status | Settings  │
├──────────┬───────────────────────────────────────────┬───────────────┤
│          │                                           │               │
│  Image   │                                           │  Annotation   │
│  List    │          Main Canvas                      │  Panel        │
│          │      (Image + Annotations)                │               │
│  [▼]     │                                           │  Class List   │
│  img1.jpg│                                           │  ☑ cat        │
│  img2.jpg│                                           │  ☐ dog        │
│  img3.jpg│                                           │  ☐ bird       │
│          │                                           │               │
│          │                                           │  Properties   │
│          │                                           │  - Truncated  │
│          │                                           │  - Occluded   │
│          │                                           │               │
│          │                                           │  Actions      │
│          │                                           │  [Delete]     │
│          │                                           │  [Copy]       │
├──────────┴───────────────────────────────────────────┴───────────────┤
│  Toolbar: [Selection] [Rect] [Polygon] [Brush] [Zoom] [Undo] [Redo] │
└──────────────────────────────────────────────────────────────────────┘
```

### Key Interactions

#### Fast Annotation Flow
1. **Keyboard navigation**: Arrow keys to move between images
2. **Quick class selection**: Number keys (1-9) for frequent classes
3. **Tool shortcuts**: R=Rectangle, P=Polygon, B=Brush
4. **Auto-save**: Save on every action (with debounce)
5. **Smart defaults**: Remember last tool, class, attributes

#### Smooth Performance
- **Progressive image loading**: Show thumbnail → low-res → high-res
- **Lazy rendering**: Only render visible annotations
- **WebGL fallback**: Use GPU for large images (> 4K)
- **Request batching**: Batch API calls to reduce latency
- **Optimistic UI**: Immediate feedback, sync in background

#### Error Handling
- **Auto-recovery**: Restore from local storage on crash
- **Conflict resolution**: Show diff when concurrent edits detected
- **Validation feedback**: Real-time validation with clear error messages

---

## Data Management

### Annotation Format (Platform Standard)

The platform uses a unified JSON format that supports all task types. Each annotation includes a `type` field to distinguish between different annotation types.

```json
{
  "format_version": "1.0",
  "dataset_id": "dataset-abc123",
  "task_types": ["classification", "detection", "segmentation"],  // Can support multiple tasks

  "classes": [
    {
      "id": 0,
      "name": "cat",
      "color": "#FF5733",
      "parent_id": null,  // For hierarchical classes
      "attributes": ["domestic", "wild"]
    },
    {
      "id": 1,
      "name": "persian_cat",
      "color": "#FF6733",
      "parent_id": 0  // Child of "cat"
    }
  ],

  "images": [
    {
      "id": 1,
      "file_name": "images/cats/cat001.jpg",
      "width": 1920,
      "height": 1080,

      // Image-level annotations (classification, captions)
      "image_annotations": {
        "classes": [0, 1],  // Multi-label classification
        "captions": [
          {
            "text": "A fluffy Persian cat sitting on a couch",
            "confidence": 0.95,
            "source": "human"  // or "ai"
          }
        ]
      },

      // Spatial annotations (detection, segmentation, lines, etc.)
      "annotations": [
        // Object Detection (Horizontal BBox)
        {
          "id": 1,
          "type": "bbox",
          "class_id": 0,
          "bbox": [100, 200, 300, 400],  // [x, y, width, height]
          "area": 120000,
          "attributes": {
            "occluded": false,
            "truncated": false
          },
          "caption": "Main cat in focus",  // Open vocab integration
          "annotator_id": "user-123",
          "created_at": "2025-01-13T10:00:00Z"
        },

        // Object Detection (Rotated BBox / OBB)
        {
          "id": 2,
          "type": "rotated_bbox",
          "class_id": 1,
          "rotated_bbox": {
            "cx": 250,
            "cy": 400,
            "width": 300,
            "height": 200,
            "angle": 45  // degrees, 0-360
          },
          "area": 60000,
          "attributes": {"difficult": false}
        },

        // Segmentation (Polygon)
        {
          "id": 3,
          "type": "polygon",
          "class_id": 0,
          "segmentation": [[100, 200, 150, 180, 200, 220, 180, 250, 120, 240]],  // [x1,y1, x2,y2, ...]
          "area": 5000,
          "bbox": [100, 180, 100, 70],  // Bounding box of polygon
          "caption": "Cat's body outline"
        },

        // Segmentation (RLE mask)
        {
          "id": 4,
          "type": "mask",
          "class_id": 0,
          "segmentation": {
            "size": [1080, 1920],
            "counts": "encoded_rle_string..."  // Run-length encoding
          },
          "area": 45000,
          "bbox": [50, 150, 400, 500]
        },

        // Line Detection (Straight Line)
        {
          "id": 5,
          "type": "line",
          "class_id": 2,  // e.g., "lane_line"
          "line": {
            "p1": [100, 500],  // [x1, y1]
            "p2": [800, 600],  // [x2, y2]
            "width": 5  // Line thickness in pixels
          },
          "attributes": {
            "line_style": "solid",
            "color": "white"
          }
        },

        // Line Detection (Polyline)
        {
          "id": 6,
          "type": "polyline",
          "class_id": 2,
          "polyline": {
            "points": [[100, 500], [300, 520], [500, 540], [800, 600]],  // List of [x, y]
            "width": 5,
            "closed": false  // If true, connects last to first point
          }
        },

        // Line Detection (Circle/Arc)
        {
          "id": 7,
          "type": "circle",
          "class_id": 3,  // e.g., "roundabout"
          "circle": {
            "center": [500, 500],
            "radius": 200,
            "start_angle": 0,   // For arcs (degrees)
            "end_angle": 270    // Full circle if start=0, end=360
          }
        },

        // Pose Estimation
        {
          "id": 8,
          "type": "keypoints",
          "class_id": 4,  // e.g., "person"
          "keypoints": [
            // [x, y, visibility] for each keypoint
            [512, 200, 2],  // nose: visible
            [500, 180, 2],  // left_eye: visible
            [524, 180, 1],  // right_eye: occluded
            [0, 0, 0]       // left_ear: not labeled
            // ... (17 keypoints for COCO format)
          ],
          "skeleton": "coco_17",  // Skeleton template used
          "num_keypoints": 15,
          "bbox": [450, 150, 150, 400]
        },

        // OCR
        {
          "id": 9,
          "type": "text",
          "class_id": 5,  // e.g., "text_region"
          "text": {
            "transcription": "Stop Sign",
            "language": "en",
            "confidence": 0.98,
            "reading_order": 1  // For layout analysis
          },
          "bbox": [700, 100, 150, 80],  // or rotated_bbox or polygon
          "attributes": {
            "font_size": "large",
            "text_color": "white",
            "background_color": "red"
          }
        }
      ]
    },

    // Example: Group labeling (multiple images with same class)
    {
      "id": 2,
      "file_name": "images/cats/cat002.jpg",
      "width": 1920,
      "height": 1080,
      "group_id": "group-001",  // Links multiple images together
      "image_annotations": {
        "classes": [0]  // All images in group-001 labeled as class 0
      },
      "annotations": []
    },
    {
      "id": 3,
      "file_name": "images/cats/cat003.jpg",
      "width": 1920,
      "height": 1080,
      "group_id": "group-001",  // Same group
      "image_annotations": {
        "classes": [0]
      },
      "annotations": []
    }
  ]
}
```

### Database Schema

```python
# Extends platform's Dataset model

class AnnotationProject(Base):
    """Annotation project (extends Dataset)"""
    __tablename__ = "annotation_projects"

    id = Column(String, primary_key=True)
    dataset_id = Column(String, ForeignKey("datasets.id"))
    name = Column(String)
    description = Column(Text)

    # Task configuration
    task_type = Column(String)  # classification, detection, segmentation, etc.
    task_config = Column(JSON)  # Task-specific settings

    # Classes
    classes = Column(JSON)  # [{"id": 0, "name": "cat", "color": "#FF5733"}]

    # Workflow
    workflow_type = Column(String, default="simple")  # simple, review, consensus
    enable_ai_assist = Column(Boolean, default=False)

    # Stats
    total_images = Column(Integer)
    annotated_images = Column(Integer, default=0)
    reviewed_images = Column(Integer, default=0)

    # Metadata
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)


class Annotation(Base):
    """Individual annotation (stored in DB for fast queries)"""
    __tablename__ = "annotations"

    id = Column(Integer, primary_key=True)
    project_id = Column(String, ForeignKey("annotation_projects.id"))
    image_id = Column(Integer)  # References image in annotations.json

    # Annotation data
    class_id = Column(Integer)
    geometry = Column(JSON)  # bbox, polygon, keypoints, etc.
    attributes = Column(JSON)
    confidence = Column(Float, nullable=True)

    # Metadata
    annotator_id = Column(Integer, ForeignKey("users.id"))
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String, default="pending")  # pending, approved, rejected

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)


class AnnotationTask(Base):
    """Task assignment for collaborative workflows"""
    __tablename__ = "annotation_tasks"

    id = Column(Integer, primary_key=True)
    project_id = Column(String, ForeignKey("annotation_projects.id"))
    assignee_id = Column(Integer, ForeignKey("users.id"))

    # Images assigned to this task
    image_ids = Column(JSON)  # [1, 2, 3, ...]

    # Progress
    status = Column(String, default="assigned")  # assigned, in_progress, completed
    progress = Column(Integer, default=0)  # 0-100

    # Metadata
    assigned_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
```

### Storage Strategy

**Dual Storage Approach** (consistent with Platform):

1. **S3 Storage** (Source of truth):
   - `datasets/{dataset-id}/images/` - Original images
   - `datasets/{dataset-id}/annotations.json` - Complete annotations (HEAD)
   - `datasets/{dataset-id}/snapshots/{snapshot-id}.json` - Version snapshots

2. **Database** (Query optimization):
   - Individual annotations for fast filtering/search
   - User assignments, task status
   - Annotation history & audit log

**Sync strategy**:
- Read: DB for list/filter → S3 for full data
- Write: DB + S3 simultaneously (atomic)
- Export: Generate from S3 annotations.json

---

## Integration with Platform

### Shared Resources

```
Platform Stack (Reused by Labeler):
├── infrastructure/
│   ├── docker-compose.dev.yml      ← PostgreSQL, Redis, MinIO
│   └── ...
├── backend/
│   ├── app/
│   │   ├── db/
│   │   │   └── models.py           ← User, Dataset models (extended)
│   │   ├── core/
│   │   │   ├── security.py         ← JWT auth (reused)
│   │   │   └── storage.py          ← S3 client (reused)
│   │   └── ...
```

### Dataset Lifecycle

```
1. Platform: Create Dataset
   └─> datasets/{id}/images/ uploaded

2. Labeler: Create Annotation Project
   └─> Link to dataset_id
   └─> Configure task_type, classes

3. Labeler: Annotate Images
   └─> Save to DB (fast queries)
   └─> Auto-sync to S3 annotations.json

4. Labeler: Export Snapshot
   └─> Create snapshot in S3
   └─> datasets/{id}/snapshots/{snapshot-id}.json

5. Platform: Train Model
   └─> Use snapshot for training
   └─> Reproducible with snapshot reference
```

### API Integration Points

```python
# Labeler Backend connects to Platform Backend

# 1. Dataset listing (read-only)
GET /api/v1/datasets → Platform API
Response: List of datasets available for labeling

# 2. Annotation project creation
POST /api/v1/annotation-projects
Body: {
  "dataset_id": "dataset-abc123",
  "task_type": "detection",
  "classes": [...]
}

# 3. Snapshot creation (after annotation)
POST /api/v1/datasets/{id}/snapshots
Triggers: Platform's snapshot creation flow
```

---

## Development Phases

### Phase 1: Core Annotation (Weeks 1-5)
**Goal**: Foundation - Classification & Object Detection

**Features**:
- User authentication (JWT, shared with Platform)
- Dataset integration (read from Platform storage)
- Image grid view with thumbnails
- Navigation & filtering
- **Classification Tool**
  - Single-label classification
  - Multi-label classification
  - Batch annotation (keyboard shortcuts)
- **Object Detection Tool**
  - Horizontal bounding box (HBB)
  - Drag, resize, move
  - Class assignment per box
  - Attributes (occluded, truncated, difficult)
- Canvas rendering (Fabric.js)
  - Pan & zoom
  - Multi-select
  - Copy/paste
- Undo/Redo system
- Auto-save to DB + S3
- Export to COCO format

**Tech Stack**:
- Next.js 14 + TypeScript
- Fabric.js for canvas
- FastAPI backend
- PostgreSQL + MinIO (docker-compose)

---

### Phase 2: Advanced Annotation Types (Weeks 6-10)
**Goal**: Segmentation, Lines, Rotated Boxes, Advanced Classification

**Features**:
- **Advanced Classification**
  - Group labeling (multi-image → single class)
  - Hierarchical class structure (tree-based taxonomy)
  - Drill-down UI for nested classes
- **Rotated Bounding Box (OBB)**
  - 5-point representation (cx, cy, w, h, angle)
  - Rotation handle
  - Export to DOTA/HRSC format
- **Segmentation Tool**
  - Polygon drawing (click-based)
  - Free-form brush
  - Eraser & fill tools
  - Bezier curve editing
  - Mask opacity control
- **Line Detection Tool**
  - Straight line (two points)
  - Polyline (multiple vertices)
  - Circle & arc (center + radius + angles)
  - Line attributes (style, thickness, color)
- Export formats
  - YOLO (including OBB)
  - Pascal VOC
  - Custom JSON format

**Tech Additions**:
- Custom shape primitives (RotatedBox, Line, Circle)
- Advanced canvas interactions

---

### Phase 3: OCR & AI Assistance (Weeks 11-15)
**Goal**: Text annotation & ML-powered productivity

**Features**:
- **OCR Tool**
  - Text detection (bbox/rotated bbox/polygon)
  - Manual transcription input
  - Auto-detection (EAST/CRAFT models)
  - Auto-recognition (Tesseract/PaddleOCR)
  - Language selection (multi-language)
  - Layout analysis (paragraph grouping, reading order)
  - Table detection & cell extraction
- **AI Assistance**
  - SAM (Segment Anything Model) integration
    * Click prompts (positive/negative)
    * Box prompts
    * Auto-segmentation
  - Auto-labeling suggestions (classification)
  - Smart bbox proposals (detection)
  - Quality validation (anomaly detection)
  - Batch annotation with AI pre-fill
- Background job processing (Celery)
- Real-time progress updates (WebSocket)

**Tech Additions**:
- Celery for background tasks
- GPU inference server (SAM, OCR models)
- Model serving (FastAPI endpoints)
- WebSocket for real-time updates

---

### Phase 4: Pose, Open Vocab, Collaboration (Weeks 16-20)
**Goal**: Specialized tasks & multi-user workflows

**Features**:
- **Pose Estimation Tool**
  - Skeleton templates (COCO-17, MPII-16, custom)
  - Keypoint placement & editing
  - Visibility flags (visible/occluded/unlabeled)
  - Multiple person tracking
  - Auto-snap to detected joints (AI-assisted)
- **Open Vocabulary Tool**
  - Standalone mode (image-level captions)
  - Combined mode (caption per bbox/segment)
  - Pre-defined prompt templates
  - LLM-assisted caption generation (CLIP/BLIP)
  - Bulk caption editing
- **Collaboration Features**
  - Task assignment (distribute images to annotators)
  - Review workflow (approve/reject)
  - Real-time collaboration indicators
  - Comment threads on annotations
  - Activity log & audit trail
  - Inter-annotator agreement metrics
- Export integration with Platform
  - Create snapshot after annotation
  - Link to training jobs

**Tech Additions**:
- LLM integration (OpenAI/Anthropic API)
- Vision-language models (CLIP, BLIP)
- WebSocket for multi-user sync
- Redis pub/sub for notifications

---

### Phase 5: Production Polish (Weeks 21-24)
**Goal**: Performance, UX, Documentation

**Features**:
- **Performance Optimizations**
  - WebGL rendering for large images (> 4K)
  - Image tiling for gigapixel images
  - Virtual scrolling for large datasets
  - Thumbnail caching (Redis)
  - Lazy loading & pagination
- **Advanced Features**
  - Advanced filtering & search
    * By class, attribute, annotator, status
    * Similarity search (find similar images)
  - Annotation statistics & analytics
  - Bulk operations (delete, copy, export)
  - Customizable keyboard shortcuts
  - Annotation templates (save & reuse common patterns)
- **Mobile Support**
  - Responsive layout (tablets)
  - Touch gestures (pinch-to-zoom, two-finger pan)
  - Mobile-optimized tools
- **Documentation**
  - User guide (per-tool tutorials)
  - API documentation (OpenAPI/Swagger)
  - Video tutorials
  - Developer guide (for extending tools)
- **Deployment**
  - Production Docker images
  - Kubernetes manifests (integrate with Platform)
  - Monitoring & logging (Prometheus, Grafana)

---

### Summary Timeline

| Phase | Weeks | Focus | Deliverable |
|-------|-------|-------|-------------|
| 1 | 1-5 | Core annotation | Classification + Detection (HBB) |
| 2 | 6-10 | Advanced types | Segmentation, Lines, OBB, Hierarchical classes |
| 3 | 11-15 | OCR + AI | OCR tool, SAM, Auto-labeling |
| 4 | 16-20 | Pose + Collaboration | Pose estimation, Open Vocab, Multi-user |
| 5 | 21-24 | Polish | Performance, UX, Docs, Deployment |

**Total**: 24 weeks (~6 months)

---

## Performance Requirements

### Speed Benchmarks

| Operation | Target | Notes |
|-----------|--------|-------|
| Image load | < 500ms | Progressive: thumbnail → full |
| Tool switch | < 50ms | Instant feedback |
| Save annotation | < 200ms | Optimistic UI + background sync |
| Canvas render (60 FPS) | < 16ms | For smooth interactions |
| Undo/Redo | < 50ms | In-memory state |
| Export 1000 images | < 10s | Background job |

### Scalability Targets

| Metric | Target | Strategy |
|--------|--------|----------|
| Images per project | 100,000+ | Pagination, lazy loading |
| Annotations per image | 1,000+ | Spatial indexing, lazy render |
| Concurrent users | 50+ | WebSocket scaling with Redis |
| Image size | Up to 8K | WebGL rendering, tiling |

### Browser Support

- **Chrome/Edge**: 100+ (primary)
- **Firefox**: 100+ (full support)
- **Safari**: 16+ (full support)
- **Mobile**: iOS Safari 16+, Chrome Android 100+

---

## Security & Privacy

### Access Control

```python
# Role-based permissions
class Role(Enum):
    ADMIN = "admin"          # Full access
    ANNOTATOR = "annotator"  # Annotate assigned tasks
    REVIEWER = "reviewer"    # Review + annotate
    VIEWER = "viewer"        # Read-only

# Permission checks
- Dataset access: User must be project member
- Annotation edit: Must be assigned annotator or admin
- Review: Must have reviewer role
- Export: Must have annotator+ role
```

### Data Protection

- **JWT tokens**: Short-lived (1 hour), refresh tokens for persistence
- **Presigned URLs**: Time-limited S3 access (1 hour expiry)
- **HTTPS only**: All communication encrypted
- **CORS**: Whitelist frontend domain
- **Rate limiting**: Prevent abuse (100 req/min per user)

---

## Monitoring & Observability

### Key Metrics

1. **Performance**:
   - Image load time (P50, P95, P99)
   - Canvas FPS
   - API response times

2. **Usage**:
   - Annotations per day
   - Active users
   - Most used tools

3. **Quality**:
   - Annotation validation failures
   - Inter-annotator agreement
   - Review approval rate

### Logging

```python
# Structured logging
{
  "timestamp": "2025-01-13T10:00:00Z",
  "level": "INFO",
  "service": "labeler-backend",
  "user_id": "user-123",
  "action": "save_annotation",
  "project_id": "project-abc",
  "image_id": 42,
  "duration_ms": 150
}
```

---

## Open Questions & Future Exploration

### Decisions Made

1. ✅ **Task Support**: 7 tasks confirmed
   - Classification (group label, hierarchical)
   - Object Detection (horizontal + rotated bbox)
   - Segmentation (polygon, brush, mask)
   - Line Detection (straight, polyline, circle/arc)
   - Open Vocabulary (standalone + integrated)
   - Pose Estimation
   - OCR (included in Phase 3, not future work)

2. ✅ **Task Types**: Multiple task types can be combined in a single project

3. ✅ **Open Vocabulary**: Must support both standalone and combined modes

### Decisions Finalized

4. ✅ **Canvas Library**: **Fabric.js** (confirmed)
   - Rich object manipulation, proven for complex interactions
   - Mature ecosystem and documentation
   - Good balance of features and performance

5. ✅ **Phase 1 Scope**: **Classification, Detection, Segmentation, Line Detection, Open Vocab**
   - OCR moved to Phase 3 (with AI assistance)
   - Pose Estimation in Phase 4

6. ✅ **AI Features**: **Essential** (not optional)
   - Core competitive advantage
   - SAM integration (Phase 3)
   - Smart validation algorithms (all phases)
   - Auto-labeling suggestions

7. ✅ **Collaboration**: **Async task assignment + communication tools**
   - No real-time concurrent editing (too complex for MVP)
   - Task assignment and review workflows (Phase 4)
   - Comment threads and notes for communication
   - Activity indicators (who's working on what)

8. ✅ **Mobile Support**: **Not required**
   - Focus on desktop/laptop experience
   - Minimum screen size: 1280px
   - Tablet support deferred to post-MVP

9. ✅ **Import Strategy**: **Flexible converter architecture**
   - Must support import functionality
   - Generic converter interface (not tied to specific formats initially)
   - Add format-specific converters as needed
   - Priority formats: COCO, YOLO, CVAT XML (Phase 2-3)

10. ✅ **Smart Validation**: **Essential feature**
    - Basic validation mandatory (minimum sizes, vertex counts)
    - Smart algorithms for common issues:
      * Auto-fix self-intersecting polygons
      * Snap to pixel grid
      * Remove duplicate vertices
      * Normalize angles (0-360)
    - User-configurable strictness levels
    - Auto-fix suggestions (user can accept/reject)

### Remaining Questions

1. **Annotation Versioning Granularity**:
   - Track individual annotation edits? (storage-intensive)
   - Or project-level snapshots only? (simpler, less storage)
   - **Recommendation**: Project-level snapshots + last 10 edits per annotation

2. **AI Model Hosting**:
   - Self-hosted GPU server for SAM/OCR?
   - Or cloud APIs (HuggingFace, Replicate)?
   - **Recommendation**: Start with cloud APIs, add self-hosted option in Phase 3

### Future Enhancements

**Post-MVP (6+ months)**:
- **Video annotation**: Frame-by-frame + object tracking
- **3D point cloud**: LiDAR annotation for autonomous driving
- **Active learning**: Prioritize uncertain samples for annotation
- **Federated learning**: Privacy-preserving annotation workflows
- **Custom task plugins**: User-defined annotation types via plugin API
- **Multi-modal**: Audio + image annotation (e.g., audio scene description)
- **Temporal annotation**: Action recognition, event detection in videos

---

## References

### Platform Documentation
- [Platform Overview](../../mvp-vision-ai-platform/platform/docs/architecture/OVERVIEW.md)
- [Dataset Storage Strategy](../../mvp-vision-ai-platform/platform/docs/architecture/DATASET_STORAGE_STRATEGY.md)
- [Backend Design](../../mvp-vision-ai-platform/platform/docs/architecture/BACKEND_DESIGN.md)

### External Tools (for inspiration)
- [CVAT](https://github.com/opencv/cvat) - Open-source annotation tool
- [Labelbox](https://labelbox.com/) - Commercial labeling platform
- [Label Studio](https://labelstud.io/) - Open-source labeling tool
- [Roboflow](https://roboflow.com/) - Dataset management & labeling

### Technologies
- [Fabric.js](http://fabricjs.com/) - Canvas library
- [Konva.js](https://konvajs.org/) - Alternative canvas library
- [SAM (Segment Anything)](https://github.com/facebookresearch/segment-anything) - AI segmentation

---

**Last Updated**: 2025-01-13
**Status**: Design Final v2 (all decisions finalized, ready for implementation)
