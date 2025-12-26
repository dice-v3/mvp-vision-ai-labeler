# Task Type Architecture Refactoring Plan

**Project:** MVP Vision AI Labeler
**Version:** 2.0 (Aggressive Refactoring)
**Date:** 2025-11-20
**Status:** Planning Phase
**Approach:** Independent branch, aggressive refactoring with DB schema changes

---

## Executive Summary

This document outlines a comprehensive refactoring plan to address architectural limitations in the current task type implementation. The refactoring will be performed on an **independent branch** with an **aggressive, clean-slate approach** that transforms the codebase from a **conditional-logic-based** approach to a **plugin-based architecture**.

### Key Principles

🎯 **Aggressive Refactoring** - No compromises, clean architecture from day one
🔥 **No Backward Compatibility** - Break everything, fix everything
⚡ **Database Schema Changes** - Optimize schema for new architecture
🆕 **New Database Instance** - Fresh start with clean schema
🚫 **No Fallback Routes** - Single, correct implementation only
✅ **Fix Errors Immediately** - Address issues as they arise during refactoring

### Key Goals

1. **Centralize task type definitions** - Single source of truth for all task types
2. **Eliminate scattered conditional logic** - Replace with polymorphic design patterns
3. **Enable plugin-based task extensions** - Allow new tasks without core code changes
4. **Improve type safety** - Use TypeScript enums and strict typing
5. **Reduce coupling** - Decouple task logic from business logic
6. **Optimize database schema** - Add proper columns, remove legacy fields, improve performance

### Impact Summary

- **Files affected:** ~30 files across frontend and backend
- **Estimated effort:** 2-3 weeks (aggressive implementation)
- **Risk level:** Low (independent branch, can be tested thoroughly before merge)
- **Database changes:** New DB instance with optimized schema
- **Legacy code:** Completely removed

---

## Table of Contents

1. [Current Architecture Analysis](#current-architecture-analysis)
2. [Identified Problems](#identified-problems)
3. [Proposed Solution Architecture](#proposed-solution-architecture)
4. [Detailed Refactoring Plan](#detailed-refactoring-plan)
5. [Migration Strategy](#migration-strategy)
6. [Risk Assessment](#risk-assessment)
7. [Testing Strategy](#testing-strategy)
8. [Rollback Plan](#rollback-plan)
9. [Timeline & Milestones](#timeline--milestones)

---

## Current Architecture Analysis

### Overview

The application currently supports multiple task types (classification, detection, segmentation, geometry) through a **procedural, conditional-logic approach**. Task types are stored as string arrays, with behavior determined by if/switch statements scattered throughout the codebase.

### Key Components

#### Backend Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Database Models                             │
├─────────────────────────────────────────────────────────────────┤
│ AnnotationProject                                                │
│   ├── task_types: string[]                                       │
│   ├── task_config: JSONB                                         │
│   ├── task_classes: JSONB {task_type: {class_id: ClassInfo}}    │
│   └── classes: JSONB [LEGACY]                                    │
├─────────────────────────────────────────────────────────────────┤
│ ImageAnnotationStatus                                            │
│   ├── task_type: string (nullable)                               │
│   └── Unique: (project, image, task_type)                        │
├─────────────────────────────────────────────────────────────────┤
│ AnnotationVersion                                                │
│   ├── task_type: string                                          │
│   ├── export_format: string                                      │
│   └── Unique: (project, task_type, version_number)               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Services Layer                              │
├─────────────────────────────────────────────────────────────────┤
│ image_status_service.py                                          │
│   └── ANNOTATION_TYPE_TO_TASK = {                                │
│       'bbox': 'detection',                                        │
│       'polygon': 'segmentation',                                  │
│       'polyline': 'geometry',                                     │
│       'circle': 'geometry',                                       │
│       ...                                                         │
│   }                                                               │
├─────────────────────────────────────────────────────────────────┤
│ Export Services (COCO, YOLO, DICE)                               │
│   ├── Each has own task-to-annotation-type mapping               │
│   ├── Duplicate filtering logic                                  │
│   └── Inconsistent task support                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Frontend Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Annotation Store                            │
├─────────────────────────────────────────────────────────────────┤
│ annotationStore.ts                                               │
│   ├── currentTask: string | null                                 │
│   ├── project.taskTypes: string[]                                │
│   ├── project.taskClasses: Record<task, Record<id, ClassInfo>>  │
│   └── getCurrentClasses() → task-specific classes                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      Tool Registry                               │
├─────────────────────────────────────────────────────────────────┤
│ ToolRegistry.ts                                                  │
│   ├── tools: Map<string, IAnnotationTool>                        │
│   ├── toolsByTask: Map<string, string[]>                         │
│   └── Each tool defines: supportedTasks: string[]                │
├─────────────────────────────────────────────────────────────────┤
│ Tool Classes                                                     │
│   ├── BBoxTool: supportedTasks = ['detection', 'segmentation']  │
│   ├── ClassificationTool: supportedTasks = ['classification']   │
│   ├── PolygonTool: supportedTasks = ['segmentation']            │
│   ├── PolylineTool: supportedTasks = ['geometry']               │
│   └── CircleTool: supportedTasks = ['geometry']                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      UI Components                               │
├─────────────────────────────────────────────────────────────────┤
│ Canvas.tsx (3300+ lines)                                         │
│   ├── if (currentTask === 'classification') { ... }             │
│   ├── if (currentTask === 'detection') { ... }                  │
│   ├── if (currentTask === 'segmentation') { ... }               │
│   └── if (currentTask === 'geometry') { ... }                   │
│                                                                   │
│   Scattered throughout:                                          │
│   ├── Tool display logic (lines 3160-3214)                       │
│   ├── Class validation (lines 1093+)                             │
│   ├── Batch operations (lines 1968-1970)                         │
│   └── No_object handling (line 2328)                             │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action (e.g., Draw BBox)
         ↓
Canvas.tsx (currentTask check)
         ↓
Tool (e.g., BBoxTool.supportedTasks check)
         ↓
Create Annotation
         ↓
POST /annotations
         ↓
get_task_type_from_annotation()
    ├── ANNOTATION_TYPE_TO_TASK lookup
    └── Special case: no_object → attributes['task_type']
         ↓
update_image_status(task_type)
    ├── Filter annotations by task type
    ├── Complex OR query for no_object
    └── Create/Update ImageAnnotationStatus
```

---

## Identified Problems

### 1. **Annotation Type Mapping Duplication** (High Priority)

**Location:** Multiple files
- `backend/app/services/image_status_service.py:18-27`
- `backend/app/services/dice_export_service.py:103-111`
- Implicit in COCO/YOLO exporters

**Issue:**
```python
# image_status_service.py
ANNOTATION_TYPE_TO_TASK = {
    'bbox': 'detection',
    'polygon': 'segmentation',
    'polyline': 'geometry',
    # ...
}

# dice_export_service.py (different structure!)
task_to_annotation_types = {
    'detection': ['bbox'],
    'segmentation': ['polygon'],
    'geometry': ['polyline', 'circle'],
    # ...
}
```

**Impact:**
- Adding a new annotation type requires updates in 3+ places
- Inconsistencies lead to bugs (e.g., geometry annotations not exported)
- No single source of truth
- Difficult to test comprehensively

**Severity:** 🔴 Critical

---

### 2. **Task Type String Literals** (High Priority)

**Location:** Throughout codebase
- `'classification'`, `'detection'`, `'segmentation'`, `'geometry'`
- No enum or constant definitions
- Prone to typos (e.g., `'detction'` vs `'detection'`)

**Issue:**
```typescript
// Frontend - strings everywhere
if (currentTask === 'classification') { ... }
switchTask('detection');

// Backend - validation is manual
valid_task_types = ["classification", "detection", "segmentation", ...]
```

**Impact:**
- TypeScript cannot catch typos
- Runtime errors instead of compile-time errors
- Refactoring requires find-replace across entire codebase
- No autocomplete support

**Severity:** 🔴 Critical

---

### 3. **Scattered Conditional Logic** (High Priority)

**Location:** `Canvas.tsx` (primary offender)
- Lines 1093, 1160, 1968, 3160-3214

**Issue:**
```typescript
// Canvas.tsx has 15+ conditional branches based on currentTask
if (currentTask === 'classification') {
  // 50 lines of classification logic
} else if (currentTask === 'detection') {
  // 80 lines of detection logic
} else if (currentTask === 'segmentation') {
  // 60 lines of segmentation logic
}
// ... repeated throughout 3300+ line file
```

**Impact:**
- 3300+ line file is unmaintainable
- Logic for one task scattered across multiple locations
- Adding new task requires touching 10+ locations
- High risk of breaking existing tasks when modifying
- Difficult to test in isolation

**Severity:** 🔴 Critical

---

### 4. **Task Type Validation Inconsistency** (Medium Priority)

**Location:**
- `backend/app/api/v1/endpoints/projects.py:321`
- Frontend: No validation before API calls

**Issue:**
```python
# Backend hardcoded list
valid_task_types = ["classification", "detection", "segmentation", "geometry", "bbox", "polygon", "keypoint", "line"]

# Frontend can switch to any task without validation
switchTask('invalid_task');  // No error until API call fails
```

**Impact:**
- Frontend can send invalid task types
- Validation happens too late (at API layer)
- User sees cryptic error messages
- List must be manually synchronized between frontend/backend

**Severity:** 🟡 Medium

---

### 5. **Export Service Task Filtering Duplication** (Medium Priority)

**Location:**
- `backend/app/services/dice_export_service.py:98-120`
- `backend/app/services/yolo_export_service.py:70-73`
- `backend/app/services/coco_export_service.py` (no task support)

**Issue:**
```python
# DICE exporter
task_to_annotation_types = {
    'classification': ['classification'],
    'detection': ['bbox'],
    'geometry': ['polyline', 'circle'],
}

# YOLO exporter
# Only supports bbox, hardcoded filter
annotations = annotations.filter(Annotation.annotation_type == 'bbox')

# COCO exporter
# No task type support at all!
```

**Impact:**
- Each exporter implements own mapping
- COCO export doesn't support multi-task projects
- YOLO limited to detection only
- Cannot export specific tasks independently

**Severity:** 🟡 Medium

---

### 6. **Frontend Tool-Task Binding Decentralized** (Medium Priority)

**Location:** Each tool class
- `BBoxTool.ts:25`: `supportedTasks = ['detection', 'segmentation']`
- `ClassificationTool.ts:26`: `supportedTasks = ['classification']`
- etc.

**Issue:**
```typescript
// Tool classes define their own task support
export class BBoxTool extends BaseAnnotationTool {
  readonly supportedTasks = ['detection', 'segmentation'];
}

// No centralized registry of:
// - Which tasks exist
// - Which tools are available for each task
// - Whether project's task_types have available tools
```

**Impact:**
- No validation that project's task types have tools
- Cannot dynamically list available tasks
- Tool registry built at runtime via auto-registration
- Circular dependency potential (tool → registry → tool)

**Severity:** 🟡 Medium

---

### 7. **No_Object Special Case Handling** (Medium Priority)

**Location:** Multiple places
- `image_status_service.py:62-76`
- `annotations.py:33-40`
- `projects.py:592-596`

**Issue:**
```python
# Special case everywhere annotations are filtered
or_(
    Annotation.annotation_type.in_(annotation_types),
    and_(
        Annotation.annotation_type == 'no_object',
        Annotation.attributes['task_type'].astext == task_type
    )
)
```

**Impact:**
- Complex query every time annotations filtered by task
- JSON path filtering (`attributes['task_type']`) not indexed
- Performance degradation for large datasets
- Logic duplicated in 5+ locations

**Severity:** 🟡 Medium

---

### 8. **Legacy Class Storage Dual Structure** (Low Priority)

**Location:**
- `backend/app/db/models/labeler.py:38-41`

**Issue:**
```python
class AnnotationProject(LabelerBase):
    classes = Column(JSONB, default={})  # Legacy field
    task_classes = Column(JSONB, default={})  # Phase 2.9: Task-specific

# API must maintain both:
if not project.task_classes:
    project.task_classes = {}
project.task_classes['detection'] = dict(project.classes)  # Copy
```

**Impact:**
- Dual storage increases database size
- API must sync both fields
- Migration path unclear
- Confusing for developers (which field to use?)

**Severity:** 🟢 Low (but technical debt)

---

### 9. **Frontend-Backend Task Type Desynchronization Risk** (Medium Priority)

**Location:**
- `TopBar.tsx:93-94` (task switch without validation)
- `annotationStore.ts` (switchTask doesn't validate)

**Issue:**
```typescript
// User can switch to any task
switchTask('new_task');

// No check if:
// - Task exists in project
// - Task has tools available
// - Task has classes defined

// Only discover issue when trying to annotate
```

**Impact:**
- Poor user experience (delayed error feedback)
- Can end up in invalid UI state
- Race conditions between task switch and annotation operations
- No rollback if switch fails

**Severity:** 🟡 Medium

---

### 10. **Task-Specific Export Not Exposed in UI** (Low Priority)

**Location:**
- `TopBar.tsx` (ExportModal)
- Export endpoints support task_type, but UI doesn't expose it

**Issue:**
```typescript
// Export API supports task filtering:
POST /export?task_type=detection

// But UI always exports all tasks:
// - No task selector in export modal
// - Users cannot export detection annotations separately
```

**Impact:**
- Cannot export subset of tasks
- Large exports when only one task needed
- Workflow limitation for versioning specific tasks

**Severity:** 🟢 Low (feature gap, not bug)

---

### 11. **Image Status Tracking Query Overhead** (Low Priority)

**Location:**
- `image_status_service.py:62-76`

**Issue:**
```python
# For multi-task project with 4 tasks:
# - Must query status 4 times per image
# - Each query filters annotations with complex OR clause
# - No database-level aggregation

# On image list load (100 images, 4 tasks):
# - 400 status queries
# - Each with JSON path filtering
```

**Impact:**
- Slow page loads for large projects
- Database CPU spikes
- No caching strategy
- Scales poorly with task count

**Severity:** 🟢 Low (performance optimization)

---

## Proposed Solution Architecture

### Design Principles

1. **Plugin Architecture** - Tasks as independent, pluggable modules
2. **Single Responsibility** - Each task handles its own logic
3. **Open/Closed Principle** - Extend tasks without modifying core
4. **Dependency Inversion** - Depend on abstractions, not implementations
5. **Type Safety** - Use enums and strict typing throughout
6. **Configuration Over Code** - Task definitions in config files

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Task Registry (Core)                         │
├─────────────────────────────────────────────────────────────────┤
│ TaskType Enum                                                    │
│   ├── CLASSIFICATION = 'classification'                          │
│   ├── DETECTION = 'detection'                                    │
│   ├── SEGMENTATION = 'segmentation'                              │
│   └── GEOMETRY = 'geometry'                                      │
├─────────────────────────────────────────────────────────────────┤
│ TaskDefinition (Abstract Base)                                   │
│   ├── id: TaskType                                               │
│   ├── name: string                                               │
│   ├── description: string                                        │
│   ├── annotationTypes: AnnotationType[]                          │
│   ├── tools: Tool[]                                              │
│   ├── exportFormats: ExportFormat[]                              │
│   ├── validate(annotation): boolean                              │
│   ├── getExporter(format): Exporter                              │
│   └── getDefaultConfig(): TaskConfig                             │
└─────────────────────────────────────────────────────────────────┘
              ↓                    ↓                    ↓
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ DetectionTask    │  │SegmentationTask │  │ GeometryTask     │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ annotationTypes: │  │ annotationTypes: │  │ annotationTypes: │
│  - bbox          │  │  - polygon       │  │  - polyline      │
│  - rotated_bbox  │  │                  │  │  - circle        │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ tools:           │  │ tools:           │  │ tools:           │
│  - BBoxTool      │  │  - PolygonTool   │  │  - PolylineTool  │
│                  │  │  - BrushTool     │  │  - CircleTool    │
├──────────────────┤  ├──────────────────┤  ├──────────────────┤
│ exporters:       │  │ exporters:       │  │ exporters:       │
│  - COCO          │  │  - COCO          │  │  - DICE          │
│  - YOLO          │  │  - Mask COCO     │  │  - JSON          │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

### Component Design

#### 1. Backend: Task Definition System

```python
# backend/app/tasks/base.py
from abc import ABC, abstractmethod
from enum import Enum
from typing import List, Dict, Any, Optional

class TaskType(str, Enum):
    """Centralized task type enum"""
    CLASSIFICATION = "classification"
    DETECTION = "detection"
    SEGMENTATION = "segmentation"
    GEOMETRY = "geometry"
    KEYPOINT = "keypoint"
    LINE = "line"

class AnnotationType(str, Enum):
    """Centralized annotation type enum"""
    CLASSIFICATION = "classification"
    BBOX = "bbox"
    ROTATED_BBOX = "rotated_bbox"
    POLYGON = "polygon"
    POLYLINE = "polyline"
    CIRCLE = "circle"
    KEYPOINT = "keypoint"
    LINE = "line"
    NO_OBJECT = "no_object"

class TaskDefinition(ABC):
    """Abstract base for all task definitions"""

    @property
    @abstractmethod
    def task_type(self) -> TaskType:
        """Unique task identifier"""
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name"""
        pass

    @property
    @abstractmethod
    def annotation_types(self) -> List[AnnotationType]:
        """Annotation types this task supports"""
        pass

    @abstractmethod
    def get_default_config(self) -> Dict[str, Any]:
        """Default task configuration"""
        pass

    @abstractmethod
    def validate_annotation(self, annotation: 'Annotation') -> bool:
        """Validate annotation against task rules"""
        pass

    @abstractmethod
    def get_exporter(self, format: str) -> 'BaseExporter':
        """Get exporter for this task and format"""
        pass
```

#### 2. Backend: Task Registry

```python
# backend/app/tasks/registry.py
from typing import Dict, Optional, List
from .base import TaskType, TaskDefinition, AnnotationType

class TaskRegistry:
    """Centralized task registry (Singleton)"""

    _instance = None
    _tasks: Dict[TaskType, TaskDefinition] = {}

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def register(self, task: TaskDefinition) -> None:
        """Register a task definition"""
        self._tasks[task.task_type] = task

    def get(self, task_type: TaskType) -> Optional[TaskDefinition]:
        """Get task definition by type"""
        return self._tasks.get(task_type)

    def get_all(self) -> List[TaskDefinition]:
        """Get all registered tasks"""
        return list(self._tasks.values())

    def get_annotation_types_for_task(
        self,
        task_type: TaskType
    ) -> List[AnnotationType]:
        """Get annotation types for a task"""
        task = self.get(task_type)
        return task.annotation_types if task else []

    def get_task_for_annotation_type(
        self,
        annotation_type: AnnotationType
    ) -> Optional[TaskType]:
        """Reverse lookup: annotation type → task type"""
        for task in self._tasks.values():
            if annotation_type in task.annotation_types:
                return task.task_type
        return None

# Global registry instance
task_registry = TaskRegistry()
```

#### 3. Backend: Concrete Task Implementation Example

```python
# backend/app/tasks/detection.py
from .base import TaskDefinition, TaskType, AnnotationType
from .exporters import COCOExporter, YOLOExporter

class DetectionTask(TaskDefinition):
    """Object detection task definition"""

    @property
    def task_type(self) -> TaskType:
        return TaskType.DETECTION

    @property
    def name(self) -> str:
        return "Object Detection"

    @property
    def annotation_types(self) -> List[AnnotationType]:
        return [
            AnnotationType.BBOX,
            AnnotationType.ROTATED_BBOX,
        ]

    def get_default_config(self) -> Dict[str, Any]:
        return {
            "show_labels": True,
            "show_confidence": False,
            "min_bbox_size": 5,
            "allow_overlap": True,
        }

    def validate_annotation(self, annotation: 'Annotation') -> bool:
        """Validate detection annotation"""
        if annotation.annotation_type not in [
            AnnotationType.BBOX,
            AnnotationType.ROTATED_BBOX
        ]:
            return False

        # Check bbox has minimum size
        if annotation.annotation_type == AnnotationType.BBOX:
            bbox = annotation.geometry.get('bbox')
            if not bbox or len(bbox) != 4:
                return False
            _, _, w, h = bbox
            if w < 5 or h < 5:
                return False

        return True

    def get_exporter(self, format: str) -> 'BaseExporter':
        """Get exporter for detection task"""
        if format == 'coco':
            return COCOExporter()
        elif format == 'yolo':
            return YOLOExporter()
        else:
            raise ValueError(f"Unsupported format: {format}")
```

#### 4. Backend: Task-Aware Service Layer

```python
# backend/app/services/image_status_service.py (refactored)
from app.tasks.registry import task_registry
from app.tasks.base import TaskType, AnnotationType

async def update_image_status(
    db: Session,
    project_id: str,
    image_id: str,
    task_type: Optional[TaskType] = None,  # Now uses enum
) -> Optional[ImageAnnotationStatus]:
    """Update image status using task registry"""

    # Get annotation types for this task from registry
    if task_type:
        annotation_types = task_registry.get_annotation_types_for_task(task_type)

        # Build filter using task definition
        query = query.filter(
            or_(
                Annotation.annotation_type.in_([at.value for at in annotation_types]),
                and_(
                    Annotation.annotation_type == AnnotationType.NO_OBJECT.value,
                    Annotation.attributes['task_type'].astext == task_type.value
                )
            )
        )

    # Rest of logic unchanged...
```

#### 5. Frontend: Task Type Enum and Registry

```typescript
// frontend/lib/tasks/types.ts
export enum TaskType {
  CLASSIFICATION = 'classification',
  DETECTION = 'detection',
  SEGMENTATION = 'segmentation',
  GEOMETRY = 'geometry',
  KEYPOINT = 'keypoint',
  LINE = 'line',
}

export enum AnnotationType {
  CLASSIFICATION = 'classification',
  BBOX = 'bbox',
  ROTATED_BBOX = 'rotated_bbox',
  POLYGON = 'polygon',
  POLYLINE = 'polyline',
  CIRCLE = 'circle',
  KEYPOINT = 'keypoint',
  LINE = 'line',
  NO_OBJECT = 'no_object',
}

export interface TaskDefinition {
  id: TaskType;
  name: string;
  description: string;
  annotationTypes: AnnotationType[];
  tools: string[];  // Tool type IDs
  exportFormats: string[];
  defaultConfig: Record<string, any>;
}
```

```typescript
// frontend/lib/tasks/registry.ts
import { TaskType, TaskDefinition } from './types';

class TaskRegistry {
  private tasks: Map<TaskType, TaskDefinition> = new Map();

  register(task: TaskDefinition): void {
    this.tasks.set(task.id, task);
  }

  get(taskType: TaskType): TaskDefinition | undefined {
    return this.tasks.get(taskType);
  }

  getAll(): TaskDefinition[] {
    return Array.from(this.tasks.values());
  }

  getAnnotationTypesForTask(taskType: TaskType): AnnotationType[] {
    const task = this.get(taskType);
    return task ? task.annotationTypes : [];
  }

  getToolsForTask(taskType: TaskType): string[] {
    const task = this.get(taskType);
    return task ? task.tools : [];
  }

  getExportFormatsForTask(taskType: TaskType): string[] {
    const task = this.get(taskType);
    return task ? task.exportFormats : [];
  }

  getTaskForAnnotationType(annotationType: AnnotationType): TaskType | null {
    for (const task of this.tasks.values()) {
      if (task.annotationTypes.includes(annotationType)) {
        return task.id;
      }
    }
    return null;
  }
}

export const taskRegistry = new TaskRegistry();
```

#### 6. Frontend: Task Definition Example

```typescript
// frontend/lib/tasks/detection.ts
import { TaskType, AnnotationType, TaskDefinition } from './types';

export const detectionTask: TaskDefinition = {
  id: TaskType.DETECTION,
  name: 'Object Detection',
  description: 'Draw bounding boxes around objects',
  annotationTypes: [
    AnnotationType.BBOX,
    AnnotationType.ROTATED_BBOX,
  ],
  tools: ['bbox', 'rotated_bbox'],
  exportFormats: ['coco', 'yolo', 'voc'],
  defaultConfig: {
    showLabels: true,
    showConfidence: false,
    minBboxSize: 5,
  },
};
```

#### 7. Frontend: Task Registration (Initialization)

```typescript
// frontend/lib/tasks/index.ts
import { taskRegistry } from './registry';
import { detectionTask } from './detection';
import { segmentationTask } from './segmentation';
import { classificationTask } from './classification';
import { geometryTask } from './geometry';

// Register all tasks at app initialization
export function initializeTasks(): void {
  taskRegistry.register(detectionTask);
  taskRegistry.register(segmentationTask);
  taskRegistry.register(classificationTask);
  taskRegistry.register(geometryTask);
}

// Export for use throughout app
export { taskRegistry };
export * from './types';
```

#### 8. Frontend: Refactored Component Example

```typescript
// frontend/components/annotation/Canvas.tsx (simplified)
import { taskRegistry, TaskType } from '@/lib/tasks';

export default function Canvas() {
  const { currentTask } = useAnnotationStore();

  // Get task definition from registry
  const taskDef = currentTask
    ? taskRegistry.get(currentTask as TaskType)
    : null;

  // Get available tools for current task
  const availableTools = taskDef
    ? taskDef.tools.map(toolId => toolRegistry.get(toolId))
    : [];

  // Validate class requirement
  const hasClasses = getCurrentClasses() && Object.keys(getCurrentClasses()).length > 0;
  if (!hasClasses && taskDef) {
    toast.warning(`'${taskDef.name}' task requires classes. Please add classes first.`);
    return;
  }

  // Render tools dynamically
  return (
    <div className="tool-panel">
      {availableTools.map(tool => (
        <ToolButton key={tool.type} tool={tool} />
      ))}
    </div>
  );
}
```

---

## Database Schema Changes

### New Database Setup

**Approach:** Create a new database instance for the refactored application

```bash
# Create new database
createdb mvp_vision_ai_labeler_v2

# Update .env configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/mvp_vision_ai_labeler_v2
```

### Schema Optimizations

#### 1. **Annotations Table - Add task_type Column**

**Current Problem:** No direct task_type column, must infer from annotation_type or parse JSON

**Solution:**
```sql
ALTER TABLE annotations ADD COLUMN task_type VARCHAR(50) NOT NULL;
CREATE INDEX idx_annotations_task_type ON annotations(task_type);
CREATE INDEX idx_annotations_project_task ON annotations(project_id, task_type);
```

**Benefits:**
- Direct filtering by task type (no more complex OR queries)
- Indexed lookups (10x faster queries)
- No special case for `no_object` annotations
- Simpler query logic everywhere

#### 2. **Remove Legacy Classes Field**

**Current Problem:** Dual storage in `classes` and `task_classes`

**Solution:**
```sql
ALTER TABLE annotation_projects DROP COLUMN classes;
-- Keep only task_classes
```

**Benefits:**
- Single source of truth for class definitions
- Reduced storage size
- No synchronization logic needed

#### 3. **Optimize ImageAnnotationStatus Queries**

**Current Problem:** Separate status rows per task, requires 4 queries for 4-task project

**Solution:** Keep current structure but add compound index
```sql
CREATE INDEX idx_image_status_project_image_task
ON image_annotation_status(project_id, image_id, task_type);
```

**Benefits:**
- Faster bulk status queries
- Better query planner optimization

#### 4. **Add Task Type Enum Constraint**

**Solution:**
```sql
CREATE TYPE task_type_enum AS ENUM (
    'classification',
    'detection',
    'segmentation',
    'geometry',
    'keypoint',
    'line'
);

ALTER TABLE annotations
    ALTER COLUMN task_type TYPE task_type_enum
    USING task_type::task_type_enum;

ALTER TABLE image_annotation_status
    ALTER COLUMN task_type TYPE task_type_enum
    USING task_type::task_type_enum;

ALTER TABLE annotation_versions
    ALTER COLUMN task_type TYPE task_type_enum
    USING task_type::task_type_enum;
```

**Benefits:**
- Database-level validation
- Storage optimization (enums are stored as integers)
- Self-documenting schema

### Migration Strategy for Existing Data (If Needed)

If we need to migrate data from old DB to new DB:

```python
# scripts/migrate_to_new_schema.py
from old_db import get_old_db
from new_db import get_new_db
from app.tasks.registry import task_registry

old_db = get_old_db()
new_db = get_new_db()

# Migrate annotations with task_type inference
for ann in old_db.query(Annotation).all():
    # Infer task type from annotation type
    task_type = task_registry.get_task_for_annotation_type(
        ann.annotation_type
    )

    # Create in new DB with task_type
    new_ann = Annotation(
        **ann.__dict__,
        task_type=task_type.value  # Now explicit column
    )
    new_db.add(new_ann)

new_db.commit()
```

---

## Detailed Refactoring Plan

### Phase 1: Foundation & Database Setup (Days 1-3)

#### Goal
Create new database, centralized enums, and registries. Set up clean foundation.

#### Tasks

**Database Setup:**

1. **Create New Database Instance** (0.5 days)
   - Create new PostgreSQL database: `mvp_vision_ai_labeler_v2`
   - Run Alembic migrations to create fresh schema
   - Add optimized indexes and constraints
   - Add task_type enum to database
   - **Acceptance:** New database operational with optimized schema

**Backend:**

2. **Create Task Type Enums** (0.5 days)
   - File: `backend/app/tasks/__init__.py`
   - File: `backend/app/tasks/base.py`
   - Define `TaskType` and `AnnotationType` enums
   - **Acceptance:** Enums can be imported: `from app.tasks import TaskType`

3. **Create Task Definition Abstract Base** (0.5 days)
   - File: `backend/app/tasks/base.py`
   - Define `TaskDefinition` abstract class
   - Define interfaces for exporters, validators
   - **Acceptance:** Can subclass `TaskDefinition` successfully

4. **Create Task Registry** (0.5 days)
   - File: `backend/app/tasks/registry.py`
   - Implement singleton pattern
   - Add registration and lookup methods
   - **Acceptance:** Registry can register and retrieve tasks

5. **Implement Concrete Task Definitions** (1 day)
   - Files:
     - `backend/app/tasks/detection.py`
     - `backend/app/tasks/segmentation.py`
     - `backend/app/tasks/classification.py`
     - `backend/app/tasks/geometry.py`
   - Implement all abstract methods
   - **Acceptance:** All existing task types have definitions

**Frontend:**

6. **Create Task Type Enums & Registry** (0.5 days)
   - File: `frontend/lib/tasks/types.ts`
   - File: `frontend/lib/tasks/registry.ts`
   - Define enums and registry class
   - **Acceptance:** Registry functional

7. **Implement Task Definitions** (0.5 days)
   - Files for each task definition
   - **Acceptance:** All tasks defined and registered

**Milestone:** ✅ Clean foundation with new DB and registries

---

### Phase 2: Aggressive Backend Migration (Days 4-8)

#### Goal
Complete backend migration - break old code, implement clean architecture.

#### Tasks

1. **Update Database Models** (1 day)
   - File: `backend/app/db/models/labeler.py`
   - **BREAKING:** Remove `classes` column completely
   - **BREAKING:** Add `task_type` column to Annotation model
   - Update all model references
   - Create Alembic migration
   - **Fix errors immediately as they arise**
   - **Acceptance:** Models reflect new schema

2. **Migrate Annotation Endpoints** (1.5 days)
   - File: `backend/app/api/v1/endpoints/annotations.py`
   - **BREAKING:** Remove `get_task_type_from_annotation()` - use direct column
   - **BREAKING:** All annotation queries must include task_type
   - Use `TaskType` enum in signatures
   - Remove no_object special case handling
   - **Acceptance:** All CRUD operations work with new schema

3. **Migrate Image Status Service** (1.5 days)
   - File: `backend/app/services/image_status_service.py`
   - **BREAKING:** Delete `ANNOTATION_TYPE_TO_TASK` dict entirely
   - Use registry exclusively
   - Simplify queries (no more OR clauses for no_object)
   - **Acceptance:** Status queries 10x faster

4. **Migrate Export Services** (1 day)
   - Files: All export services
   - **BREAKING:** Remove all inline task mappings
   - Use task definitions for annotation type filtering
   - Consolidate common logic into base exporter
   - **Acceptance:** Exports work correctly

5. **Migrate Project Endpoints** (1 day)
   - File: `backend/app/api/v1/endpoints/projects.py`
   - **BREAKING:** Delete hardcoded `valid_task_types` list
   - Use registry for validation
   - Remove legacy class field handling
   - **Acceptance:** Project operations work

**Testing & Fixes:**

6. **Fix All Breaking Changes** (1 day)
   - Run test suite
   - Fix all errors immediately
   - Update tests to match new architecture
   - **Acceptance:** Test suite passes

**Milestone:** ✅ Backend completely refactored, no legacy code

---

### Phase 3: Aggressive Frontend Migration (Days 9-13)

#### Goal
Delete all conditional logic, implement clean registry-based rendering.

#### Tasks

1. **Update Annotation Store** (0.5 days)
   - File: `frontend/lib/stores/annotationStore.ts`
   - **BREAKING:** Change `currentTask: string` → `currentTask: TaskType | null`
   - **BREAKING:** Remove all string-based task handling
   - Add strict validation
   - **Acceptance:** Type-safe task switching

2. **Refactor Canvas Component - Complete Rewrite** (3 days)
   - File: `frontend/components/annotation/Canvas.tsx`
   - **BREAKING:** Delete ALL task conditionals (15+ locations)
   - Extract task-specific logic to plugins
   - Use registry for tool rendering
   - Use registry for validation
   - Target: Reduce from 3300 lines to <1800 lines
   - **Before:**
     ```typescript
     if (currentTask === 'classification') { ... }
     else if (currentTask === 'detection') { ... }
     else if (currentTask === 'segmentation') { ... }
     ```
   - **After:**
     ```typescript
     const taskDef = taskRegistry.get(currentTask);
     const tools = taskDef.tools;
     return tools.map(tool => <ToolButton tool={tool} />);
     ```
   - **Acceptance:** Canvas works with registry only

3. **Refactor All Other Components** (1 day)
   - Files: `TopBar.tsx`, `RightPanel.tsx`, `ExportModal.tsx`
   - **BREAKING:** Delete all hardcoded task strings
   - Use registry exclusively
   - **Acceptance:** All UI components use registry

4. **Update API Client** (0.5 days)
   - Files: `frontend/lib/api/*.ts`
   - **BREAKING:** All signatures use `TaskType` enum
   - **Acceptance:** Type-safe API calls

**Testing & Fixes:**

5. **Fix All Breaking Changes** (1 day)
   - Run all components in dev mode
   - Fix TypeScript errors
   - Fix runtime errors
   - **Acceptance:** App runs without errors

**Milestone:** ✅ Frontend completely refactored, ~1500 lines removed

---

### Phase 4: Testing & Polish (Days 14-15)

#### Goal
Comprehensive testing and final polish.

#### Tasks

1. **Comprehensive Testing** (1 day)
   - Unit tests for all task definitions
   - Integration tests for API workflows
   - E2E tests for annotation workflows
   - Performance benchmarks (status queries, exports)
   - **Acceptance:** All tests pass

2. **Code Cleanup** (0.5 days)
   - Remove any remaining TODOs
   - Clean up imports
   - Remove dead code
   - **Acceptance:** Clean codebase

3. **Documentation** (0.5 days)
   - Update architecture docs
   - Add "How to add a new task" guide
   - Document breaking changes
   - **Acceptance:** Docs reflect new architecture

**Milestone:** ✅ Refactoring complete, ready for review

---

## Migration Strategy (Simplified for Independent Branch)

### Approach

Since this refactoring is on an **independent branch**, the migration strategy is straightforward:

1. **Development Branch**
   - Work freely on `feature/task-type-refactoring` branch
   - Break everything, fix everything
   - New database instance for testing
   - No concerns about production

2. **Testing & QA**
   - Thorough testing on new branch
   - Fix all bugs before merge
   - Performance validation
   - User acceptance testing

3. **Merge Strategy**
   - When ready, create comprehensive PR
   - Review with team
   - Deploy to staging for final validation
   - **Cutover**: Deploy to production with brief downtime for DB migration
   - Communicate maintenance window to users

### Database Migration for Production Deployment

When merging to main and deploying:

```bash
# Option 1: Migrate existing database
# Run Alembic migrations
alembic upgrade head

# Migrate existing annotation data
python scripts/migrate_annotations_task_type.py

# Option 2: Fresh start (if acceptable)
# Create new database, re-label from scratch
createdb mvp_vision_ai_labeler_v2
alembic upgrade head
```

### Data Migration Script

```python
# scripts/migrate_annotations_task_type.py
from app.db.models.labeler import Annotation
from app.tasks.registry import task_registry
from app.core.database import get_labeler_db

db = next(get_labeler_db())

# Update all annotations with inferred task_type
annotations = db.query(Annotation).all()
for ann in annotations:
    # Infer from annotation type
    if ann.annotation_type == 'no_object':
        # Get from attributes
        task_type = ann.attributes.get('task_type')
    else:
        # Look up in registry
        task_type = task_registry.get_task_for_annotation_type(
            ann.annotation_type
        )

    if task_type:
        ann.task_type = task_type.value
    else:
        print(f"WARNING: Could not infer task_type for annotation {ann.id}")

db.commit()
print(f"Migrated {len(annotations)} annotations")
```

---

## Risk Assessment (Updated for Independent Branch)

### Approach Benefits

✅ **Low Risk** - Independent branch isolates changes
✅ **Thorough Testing** - Can test extensively before merge
✅ **Clean Implementation** - No compromises or workarounds
✅ **Easy Rollback** - Just don't merge the branch
✅ **Controlled Deployment** - Deploy when ready

### Potential Issues & Mitigation

#### 1. Database Migration Issues

**Risk:** Data loss or corruption during migration

**Mitigation:**
- Backup existing database before migration
- Test migration script on copy of production DB
- Validate data integrity after migration
- Keep old DB as fallback

#### 2. API Breaking Changes

**Risk:** Frontend-backend version mismatch during deployment

**Mitigation:**
- Deploy backend and frontend together
- Use feature flags if needed
- Test in staging environment first

#### 3. Performance Regressions

**Risk:** New queries slower than old ones

**Mitigation:**
- Benchmark before/after on development
- Add proper indexes during migration
- Monitor query performance in staging

#### 4. Missed Edge Cases

**Risk:** Some task-specific logic not captured in registry

**Mitigation:**
- Comprehensive test coverage
- Manual QA testing of all features
- Beta testing period before full release

### Rollback Strategy

Since this is an independent branch:

1. **Before Merge:** No rollback needed - just don't merge
2. **After Merge:** Revert the merge commit
3. **After Production Deploy:** Have backup DB, can restore and redeploy old version

**Recovery Time:** ~30 minutes with DB backup

---

## Testing Strategy

### Unit Tests

**Backend:**
```python
# tests/tasks/test_registry.py
def test_task_registration():
    registry = TaskRegistry()
    registry.register(DetectionTask())
    assert registry.get(TaskType.DETECTION) is not None

def test_annotation_type_lookup():
    registry = TaskRegistry()
    registry.register(DetectionTask())
    task = registry.get_task_for_annotation_type(AnnotationType.BBOX)
    assert task == TaskType.DETECTION

# tests/tasks/test_detection_task.py
def test_detection_validation():
    task = DetectionTask()
    annotation = Annotation(
        annotation_type=AnnotationType.BBOX,
        geometry={'bbox': [10, 10, 100, 100]}
    )
    assert task.validate_annotation(annotation) == True
```

**Frontend:**
```typescript
// __tests__/tasks/registry.test.ts
describe('TaskRegistry', () => {
  it('should register and retrieve tasks', () => {
    const registry = new TaskRegistry();
    registry.register(detectionTask);
    expect(registry.get(TaskType.DETECTION)).toBe(detectionTask);
  });

  it('should get tools for task', () => {
    const tools = registry.getToolsForTask(TaskType.DETECTION);
    expect(tools).toContain('bbox');
  });
});
```

### Integration Tests

```python
# tests/api/test_annotations_with_tasks.py
def test_create_annotation_task_type_detection():
    """Test annotation creation with detection task"""
    annotation_data = {
        "annotation_type": "bbox",
        "geometry": {"bbox": [10, 10, 100, 100]},
        "class_id": "class1",
    }
    response = client.post(f"/annotations", json=annotation_data)
    assert response.status_code == 200

    # Verify task type was inferred
    annotation = response.json()
    assert annotation['task_type'] == 'detection'

def test_image_status_task_filtering():
    """Test image status filtered by task type"""
    # Create annotations for multiple tasks
    create_annotation(image_id, annotation_type='bbox')  # detection
    create_annotation(image_id, annotation_type='polygon')  # segmentation

    # Get status for detection task only
    response = client.get(f"/projects/{project_id}/images/status?task_type=detection")
    statuses = response.json()['statuses']

    # Should only count detection annotations
    assert statuses[0]['total_annotations'] == 1
```

### End-to-End Tests

```typescript
// e2e/annotation-workflow.spec.ts
test('multi-task annotation workflow', async ({ page }) => {
  // Create project with multiple tasks
  await createProject({
    task_types: ['detection', 'segmentation'],
  });

  // Switch to detection task
  await page.click('[data-testid="task-switcher"]');
  await page.click('text=Object Detection');

  // Verify only detection tools visible
  await expect(page.locator('[data-testid="bbox-tool"]')).toBeVisible();
  await expect(page.locator('[data-testid="polygon-tool"]')).not.toBeVisible();

  // Draw bbox annotation
  await drawBbox(page, { x: 100, y: 100, w: 200, h: 200 });

  // Switch to segmentation task
  await page.click('[data-testid="task-switcher"]');
  await page.click('text=Segmentation');

  // Verify only segmentation tools visible
  await expect(page.locator('[data-testid="polygon-tool"]')).toBeVisible();
  await expect(page.locator('[data-testid="bbox-tool"]')).not.toBeVisible();

  // Verify bbox annotation not visible (task filtered)
  await expect(page.locator('[data-testid="annotation"]')).not.toBeVisible();
});
```

### Performance Tests

```python
# tests/performance/test_image_status_performance.py
def test_image_status_query_performance():
    """Benchmark image status queries before/after refactoring"""
    # Setup: project with 4 tasks, 1000 images, 10 annotations each
    setup_large_project()

    # Measure query time
    start = time.time()
    for image_id in image_ids:
        get_image_status(project_id, image_id, task_type='detection')
    end = time.time()

    # Should complete in under 5 seconds
    assert (end - start) < 5.0
```

---

## Timeline & Milestones (Aggressive 3-Week Plan)

### Week 1: Foundation & Backend (Days 1-8)

| Day | Tasks | Status |
|-----|-------|--------|
| 1-3 | **Phase 1:** New DB setup, enums, registries, task definitions | 🔲 Not Started |
| 4-8 | **Phase 2:** Backend migration (models, endpoints, services) | 🔲 Not Started |

**Week 1 Milestone:** ✅ Backend completely refactored, no legacy code

**Deliverables:**
- [ ] New database with optimized schema
- [ ] Task registry with all definitions
- [ ] All backend endpoints using registry
- [ ] Legacy ANNOTATION_TYPE_TO_TASK removed
- [ ] Integration tests passing

---

### Week 2: Frontend Refactoring (Days 9-13)

| Day | Tasks | Status |
|-----|-------|--------|
| 9-13 | **Phase 3:** Complete frontend rewrite (Canvas, components, store) | 🔲 Not Started |

**Week 2 Milestone:** ✅ Frontend completely refactored, ~1500 lines removed

**Deliverables:**
- [ ] Canvas.tsx reduced to <1800 lines
- [ ] All conditionals removed
- [ ] Registry-based rendering
- [ ] Type-safe task handling
- [ ] All components working

---

### Week 3: Testing & Polish (Days 14-15)

| Day | Tasks | Status |
|-----|-------|--------|
| 14-15 | **Phase 4:** Comprehensive testing, documentation, PR preparation | 🔲 Not Started |

**Week 3 Milestone:** ✅ Ready for review and merge

**Deliverables:**
- [ ] All tests passing (unit, integration, E2E)
- [ ] Performance benchmarks validated
- [ ] Documentation updated
- [ ] PR created for review
- [ ] Migration scripts ready

---

## Success Criteria

### Functional Requirements

- ✅ All existing functionality works identically
- ✅ Can add new task in ~30 minutes without touching core code
- ✅ Export supports task-specific filtering
- ✅ Type safety enforced (enums instead of strings)
- ✅ Database queries 10x faster (direct task_type column)

### Code Quality

- ✅ Canvas.tsx reduced to <1800 lines (-45%)
- ✅ Total codebase reduction: ~1500 lines (-31%)
- ✅ Zero hardcoded task conditionals
- ✅ All legacy code removed
- ✅ Test coverage ≥ 85%

### Performance

- ✅ Image status queries: <100ms (vs ~1s before)
- ✅ Export generation: Same or faster
- ✅ No performance regressions

### Developer Experience

- ✅ "Add new task" guide with examples
- ✅ Clear plugin architecture
- ✅ IDE autocomplete for task types
- ✅ Build-time type checking
- ✅ Single source of truth for task definitions

---

## Appendix A: File Structure After Refactoring

```
backend/
├── app/
│   ├── tasks/
│   │   ├── __init__.py
│   │   ├── base.py                    # TaskDefinition, TaskType enums
│   │   ├── registry.py                # TaskRegistry singleton
│   │   ├── detection.py               # DetectionTask implementation
│   │   ├── segmentation.py            # SegmentationTask implementation
│   │   ├── classification.py          # ClassificationTask implementation
│   │   ├── geometry.py                # GeometryTask implementation
│   │   └── exporters/
│   │       ├── base.py                # BaseExporter
│   │       ├── coco.py                # COCOExporter
│   │       ├── yolo.py                # YOLOExporter
│   │       └── dice.py                # DICEExporter
│   ├── services/
│   │   ├── image_status_service.py    # Uses task_registry
│   │   └── ...
│   └── api/v1/endpoints/
│       ├── annotations.py             # Uses TaskType enum
│       ├── projects.py                # Uses task_registry
│       └── export.py                  # Uses task definitions
│
└── tests/
    ├── tasks/
    │   ├── test_registry.py           # Registry unit tests
    │   ├── test_detection_task.py     # Task-specific tests
    │   └── ...
    └── api/
        └── test_annotations_with_tasks.py  # Integration tests

frontend/
├── lib/
│   ├── tasks/
│   │   ├── index.ts                   # Export all + initializeTasks()
│   │   ├── types.ts                   # TaskType, AnnotationType enums
│   │   ├── registry.ts                # TaskRegistry class
│   │   ├── detection.ts               # detectionTask definition
│   │   ├── segmentation.ts            # segmentationTask definition
│   │   ├── classification.ts          # classificationTask definition
│   │   └── geometry.ts                # geometryTask definition
│   ├── stores/
│   │   └── annotationStore.ts         # Uses TaskType enum
│   └── api/
│       └── *.ts                       # Uses TaskType in signatures
│
└── components/
    └── annotation/
        ├── Canvas.tsx                 # Refactored, uses registry
        ├── TopBar.tsx                 # Uses registry for task list
        └── RightPanel.tsx             # Uses registry for task name
```

---

## Appendix B: Code Size Comparison (Aggressive Refactoring)

### Before Refactoring

| File | Lines | Conditionals | Task Refs | Legacy Code |
|------|-------|--------------|-----------|-------------|
| `Canvas.tsx` | 3300 | 15+ | 25+ | Many |
| `image_status_service.py` | 305 | 8 | 12 | ANNOTATION_TYPE_TO_TASK |
| `dice_export_service.py` | 150 | 5 | 8 | Inline mappings |
| `annotations.py` (endpoints) | 400 | 10 | 15 | get_task_type_from_annotation |
| `projects.py` (endpoints) | 300 | 5 | 10 | valid_task_types list |
| **Total** | **4455** | **43+** | **70+** | - |

### After Refactoring

| Component | Lines | Conditionals | Task Refs | Notes |
|-----------|-------|--------------|-----------|-------|
| `Canvas.tsx` | 1800 | 0 | 3 | 45% reduction |
| `image_status_service.py` | 200 | 0 | 2 | Simplified queries |
| `dice_export_service.py` | 80 | 0 | 1 | Base class inherited |
| `annotations.py` | 300 | 0 | 3 | Direct column access |
| `projects.py` | 200 | 0 | 2 | Registry validation |
| **Core Total** | **2580** | **0** | **11** | - |
| | | | | |
| **New Infrastructure** | | | | |
| Task definitions (backend) | 600 | 0 | - | 4 task classes |
| Task definitions (frontend) | 200 | 0 | - | 4 task configs |
| Registry (backend + frontend) | 150 | 0 | - | Core system |
| **Infrastructure Total** | **950** | **0** | **0** | Well-structured |
| | | | | |
| **Grand Total** | **3530** | **0** | **11** | - |

### Impact Summary

**Code Reduction:**
- Core code: -1875 lines (-42%)
- New infrastructure: +950 lines (clean, maintainable)
- **Net reduction: -925 lines (-21%)**

**Complexity Reduction:**
- Conditionals: -43 (-100%) ✨
- Task string references: -59 (-84%)
- No legacy code remaining ✨

**Maintainability Gains:**
- Adding new task: 2 hours → 30 minutes
- Debugging task issues: Much easier (single location)
- Code review: Faster (clear structure)
- Onboarding: Better (self-documenting architecture)

---

## Appendix C: Example: Adding a New Task

After refactoring, adding a new task type is straightforward:

### Step 1: Define Backend Task (10 minutes)

```python
# backend/app/tasks/ocr.py
from .base import TaskDefinition, TaskType, AnnotationType

class OCRTask(TaskDefinition):
    @property
    def task_type(self) -> TaskType:
        return TaskType.OCR

    @property
    def name(self) -> str:
        return "Optical Character Recognition"

    @property
    def annotation_types(self) -> List[AnnotationType]:
        return [AnnotationType.TEXT_BOX, AnnotationType.TEXT_LINE]

    def get_default_config(self):
        return {"language": "en", "show_confidence": True}

    def validate_annotation(self, annotation):
        # Validate OCR annotations
        return True

    def get_exporter(self, format):
        return OCRExporter()
```

### Step 2: Register Backend Task (1 minute)

```python
# backend/app/tasks/__init__.py
from .ocr import OCRTask

# Auto-register at import time
task_registry.register(OCRTask())
```

### Step 3: Define Frontend Task (5 minutes)

```typescript
// frontend/lib/tasks/ocr.ts
export const ocrTask: TaskDefinition = {
  id: TaskType.OCR,
  name: 'OCR',
  description: 'Recognize and annotate text',
  annotationTypes: [AnnotationType.TEXT_BOX, AnnotationType.TEXT_LINE],
  tools: ['text_box', 'text_line'],
  exportFormats: ['json', 'csv'],
  defaultConfig: {
    language: 'en',
    showConfidence: true,
  },
};
```

### Step 4: Register Frontend Task (1 minute)

```typescript
// frontend/lib/tasks/index.ts
import { ocrTask } from './ocr';

export function initializeTasks() {
  // ... existing tasks
  taskRegistry.register(ocrTask);
}
```

### Step 5: Create Tools (varies)

Create `TextBoxTool` and `TextLineTool` classes (same as existing tools).

### Total Time: ~30 minutes

**No core code modifications needed!** ✨

---

## Appendix D: References

- [Plugin Architecture Pattern](https://en.wikipedia.org/wiki/Plug-in_(computing))
- [Registry Pattern](https://martinfowler.com/eaaCatalog/registry.html)
- [Open/Closed Principle](https://en.wikipedia.org/wiki/Open%E2%80%93closed_principle)
- [TypeScript Enums](https://www.typescriptlang.org/docs/handbook/enums.html)
- [Python Abstract Base Classes](https://docs.python.org/3/library/abc.html)

---

## Summary: Why Aggressive Refactoring?

This refactoring takes an **aggressive, no-compromise approach** for several key reasons:

### Benefits of Independent Branch Approach

1. **Clean Architecture from Day One**
   - No technical debt from compromises
   - No dual code paths or fallback routes
   - Single, correct implementation

2. **Database Optimization**
   - Add proper columns (task_type)
   - Remove legacy fields (classes)
   - Add performance indexes
   - Use database-level enums

3. **Complete Code Cleanup**
   - Delete ALL conditional logic (43+ locations)
   - Remove ALL legacy mappings
   - Reduce codebase by ~925 lines
   - Zero technical debt carried forward

4. **Faster Development**
   - No need to maintain backward compatibility
   - Fix errors immediately as they arise
   - No gradual migration complexity
   - Straightforward testing

5. **Better End Result**
   - Cleaner architecture
   - Better performance
   - More maintainable
   - Easier to understand

### Deployment Strategy

- Develop on independent branch
- Test thoroughly before merge
- Deploy with planned maintenance window
- Quick rollback available (DB backup + branch revert)

### Timeline Advantage

- **Gradual approach:** 4 weeks with compromise
- **Aggressive approach:** 3 weeks with clean result
- **Net benefit:** Faster + better quality

---

**Document Version:** 2.0 (Aggressive Refactoring)
**Last Updated:** 2025-11-20
**Approach:** Independent branch with breaking changes
**Next Review:** After PR merge
