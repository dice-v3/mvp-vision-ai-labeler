# API Specification

**Date**: 2025-01-13
**Status**: Design
**Version**: 1.0
**Base URL**: `http://localhost:8001/api/v1` (dev) | `https://api-labeler.yourdomain.com/api/v1` (prod)

## Table of Contents

- [Overview](#overview)
- [Authentication](#authentication)
- [Common Schemas](#common-schemas)
- [Projects API](#projects-api)
- [Annotations API](#annotations-api)
- [Images API](#images-api)
- [Tasks API](#tasks-api)
- [Comments API](#comments-api)
- [Export API](#export-api)
- [AI Assist API](#ai-assist-api)
- [WebSocket API](#websocket-api)
- [Error Handling](#error-handling)

---

## Overview

The Labeler Backend API follows RESTful principles with the following conventions:

**HTTP Methods**:
- `GET` - Retrieve resources
- `POST` - Create resources
- `PUT` - Update entire resource
- `PATCH` - Partial update
- `DELETE` - Delete resource

**Response Format**:
- Success: `200 OK`, `201 Created`, `204 No Content`
- Client Error: `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`
- Server Error: `500 Internal Server Error`

**Content-Type**: `application/json`

**Rate Limiting**: 100 requests/minute per user

---

## Authentication

All API requests (except health checks) require JWT authentication.

### Headers

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Getting Token

**Option 1: Login via Platform** (Recommended)
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 86400,
  "user": {
    "id": 123,
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "user"
  }
}
```

**Option 2: Shared Token from Platform**
- User logs in to Platform
- Platform provides JWT token
- Labeler validates using shared `JWT_SECRET`

### Token Validation

```http
GET /api/v1/auth/me
Authorization: Bearer <token>
```

**Response**:
```json
{
  "user_id": 123,
  "email": "user@example.com",
  "role": "user",
  "exp": 1705174800
}
```

---

## Common Schemas

### Pagination

**Query Parameters**:
- `page` (integer, default: 1)
- `page_size` (integer, default: 20, max: 100)
- `sort_by` (string, e.g., "created_at")
- `order` (string, "asc" | "desc", default: "desc")

**Response Structure**:
```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "page_size": 20,
  "total_pages": 8
}
```

### Filtering

**Query Parameters**:
- `status` (string)
- `class_id` (integer)
- `annotator_id` (integer)
- `created_after` (ISO 8601 datetime)
- `created_before` (ISO 8601 datetime)

Example:
```http
GET /api/v1/projects?status=active&page=1&page_size=20
```

### Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": [
      {
        "field": "task_types",
        "message": "Must contain at least one task type"
      }
    ]
  }
}
```

---

## Datasets API

### Get or Create Project for Dataset

```http
GET /api/v1/datasets/{dataset_id}/project
```

**Description**: Returns the annotation project for a dataset, auto-creating it if it doesn't exist (1:1 relationship).

**Path Parameters**:
- `dataset_id` (string): Dataset ID

**Response** (200 OK):
```json
{
  "id": "proj_abc123",
  "name": "Pet Detection Project",
  "description": "Annotation project for Pet Images",
  "dataset_id": "dataset-xyz789",
  "dataset_name": "Pet Images",
  "owner_id": 123,
  "task_types": ["classification"],
  "task_config": {
    "classification": {
      "multi_label": false,
      "show_confidence": false
    }
  },
  "classes": {},
  "settings": {},
  "total_images": 1000,
  "annotated_images": 0,
  "total_annotations": 0,
  "status": "active",
  "created_at": "2025-11-13T10:00:00Z",
  "updated_at": "2025-11-13T10:00:00Z"
}
```

**Note**:
- Changed: 2025-11-13 - Implements 1:1 dataset:project relationship
- If project doesn't exist, creates automatically with default configuration
- Only one project per dataset (enforced by unique constraint)

---

## Projects API

### List Projects

```http
GET /api/v1/projects
```

**Query Parameters**:
- `status` (string): Filter by status ("active", "paused", "completed")
- `dataset_id` (string): Filter by dataset
- Standard pagination params

**Response**:
```json
{
  "items": [
    {
      "id": "project-abc123",
      "name": "Pet Detection Project",
      "description": "Annotate cats and dogs",
      "dataset_id": "dataset-xyz789",
      "dataset_name": "Pet Images",
      "task_types": ["classification", "detection"],
      "classes": [
        {"id": 0, "name": "cat", "color": "#FF5733", "parent_id": null},
        {"id": 1, "name": "dog", "color": "#33C3FF", "parent_id": null}
      ],
      "workflow_type": "simple",
      "enable_ai_assist": true,
      "stats": {
        "total_images": 1000,
        "annotated_images": 450,
        "reviewed_images": 200,
        "completion_percentage": 45
      },
      "status": "active",
      "owner": {
        "id": 123,
        "email": "user@example.com",
        "full_name": "John Doe"
      },
      "created_at": "2025-01-10T10:00:00Z",
      "updated_at": "2025-01-13T15:30:00Z"
    }
  ],
  "total": 15,
  "page": 1,
  "page_size": 20,
  "total_pages": 1
}
```

### Get Project

```http
GET /api/v1/projects/{project_id}
```

**Response**: Same as project object above, with additional `task_config`:

```json
{
  "id": "project-abc123",
  ...
  "task_config": {
    "detection": {
      "bbox_types": ["horizontal", "rotated"],
      "min_bbox_size": 10,
      "enable_attributes": true,
      "attributes": [
        {"name": "occluded", "type": "boolean", "default": false}
      ]
    },
    "segmentation": {
      "types": ["polygon", "mask"],
      "min_polygon_vertices": 3
    }
  }
}
```

### Create Project

```http
POST /api/v1/projects
Content-Type: application/json

{
  "name": "Pet Detection Project",
  "description": "Annotate cats and dogs",
  "dataset_id": "dataset-xyz789",
  "task_types": ["classification", "detection"],
  "task_config": {
    "classification": {
      "mode": "multi-label",
      "enable_group_labeling": true
    },
    "detection": {
      "bbox_types": ["horizontal", "rotated"],
      "min_bbox_size": 10,
      "enable_attributes": true,
      "attributes": [
        {"name": "occluded", "type": "boolean", "default": false},
        {"name": "truncated", "type": "boolean", "default": false}
      ]
    }
  },
  "classes": [
    {"id": 0, "name": "cat", "color": "#FF5733"},
    {"id": 1, "name": "dog", "color": "#33C3FF"}
  ],
  "workflow_type": "simple",
  "enable_ai_assist": true
}
```

**Response** (201 Created):
```json
{
  "id": "project-abc123",
  "name": "Pet Detection Project",
  ...
}
```

### Update Project

```http
PATCH /api/v1/projects/{project_id}
Content-Type: application/json

{
  "name": "Updated Project Name",
  "classes": [
    {"id": 0, "name": "cat", "color": "#FF5733"},
    {"id": 1, "name": "dog", "color": "#33C3FF"},
    {"id": 2, "name": "bird", "color": "#33FF57"}
  ]
}
```

**Response** (200 OK): Updated project object

### Delete Project

```http
DELETE /api/v1/projects/{project_id}
```

**Response** (204 No Content)

**Note**: Deletes all associated annotations, tasks, and comments.

---

## Annotations API

### List Annotations

```http
GET /api/v1/projects/{project_id}/annotations
```

**Query Parameters**:
- `image_id` (integer): Filter by image
- `class_id` (integer): Filter by class
- `annotation_type` (string): Filter by type ("bbox", "polygon", etc.)
- `annotator_id` (integer): Filter by annotator
- `annotation_status` (string): Filter by status ("pending", "approved", "rejected")
- Standard pagination params

**Response**:
```json
{
  "items": [
    {
      "id": 12345,
      "project_id": "project-abc123",
      "image_id": 1,
      "image_filename": "images/cat001.jpg",
      "annotation_type": "bbox",
      "class_id": 0,
      "class_name": "cat",
      "geometry": {
        "type": "bbox",
        "bbox": [100, 200, 300, 400],
        "area": 120000
      },
      "attributes": {
        "occluded": false,
        "truncated": false
      },
      "caption": null,
      "confidence": 1.0,
      "validated": true,
      "annotation_status": "approved",
      "annotator": {
        "id": 123,
        "email": "annotator@example.com",
        "full_name": "Jane Doe"
      },
      "reviewer": null,
      "created_at": "2025-01-13T10:00:00Z",
      "updated_at": "2025-01-13T10:05:00Z"
    }
  ],
  "total": 5000,
  "page": 1,
  "page_size": 50,
  "total_pages": 100
}
```

### Get Annotations for Image

```http
GET /api/v1/projects/{project_id}/images/{image_id}/annotations
```

**Response**: Array of annotation objects (no pagination)

```json
[
  {
    "id": 12345,
    "annotation_type": "bbox",
    "class_id": 0,
    "geometry": {...},
    ...
  },
  {
    "id": 12346,
    "annotation_type": "polygon",
    "class_id": 1,
    "geometry": {...},
    ...
  }
]
```

### Create Annotation

```http
POST /api/v1/projects/{project_id}/annotations
Content-Type: application/json

{
  "image_id": 1,
  "annotation_type": "bbox",
  "class_id": 0,
  "geometry": {
    "type": "bbox",
    "bbox": [100, 200, 300, 400]
  },
  "attributes": {
    "occluded": false,
    "truncated": false
  },
  "caption": "Main cat in focus"
}
```

**Annotation Type Examples**:

**1. Horizontal BBox**:
```json
{
  "annotation_type": "bbox",
  "class_id": 0,
  "geometry": {
    "type": "bbox",
    "bbox": [100, 200, 300, 400]  // [x, y, width, height]
  }
}
```

**2. Rotated BBox (OBB)**:
```json
{
  "annotation_type": "rotated_bbox",
  "class_id": 0,
  "geometry": {
    "type": "rotated_bbox",
    "cx": 250,
    "cy": 400,
    "width": 300,
    "height": 200,
    "angle": 45  // degrees
  }
}
```

**3. Polygon (Segmentation)**:
```json
{
  "annotation_type": "polygon",
  "class_id": 0,
  "geometry": {
    "type": "polygon",
    "points": [[100, 200], [150, 180], [200, 220], [180, 250]]
  }
}
```

**4. Straight Line**:
```json
{
  "annotation_type": "line",
  "class_id": 2,
  "geometry": {
    "type": "line",
    "p1": [100, 500],
    "p2": [800, 600],
    "width": 5
  }
}
```

**5. Polyline**:
```json
{
  "annotation_type": "polyline",
  "class_id": 2,
  "geometry": {
    "type": "polyline",
    "points": [[100, 500], [300, 520], [500, 540], [800, 600]],
    "width": 5,
    "closed": false
  }
}
```

**6. Circle/Arc**:
```json
{
  "annotation_type": "circle",
  "class_id": 3,
  "geometry": {
    "type": "circle",
    "center": [500, 500],
    "radius": 200,
    "start_angle": 0,
    "end_angle": 360
  }
}
```

**Response** (201 Created):
```json
{
  "id": 12347,
  "project_id": "project-abc123",
  "image_id": 1,
  ...
}
```

### Update Annotation

```http
PATCH /api/v1/projects/{project_id}/annotations/{annotation_id}
Content-Type: application/json

{
  "geometry": {
    "type": "bbox",
    "bbox": [105, 205, 295, 395]
  },
  "attributes": {
    "occluded": true
  }
}
```

**Response** (200 OK): Updated annotation object

### Delete Annotation

```http
DELETE /api/v1/projects/{project_id}/annotations/{annotation_id}
```

**Response** (204 No Content)

### Batch Create Annotations

```http
POST /api/v1/projects/{project_id}/annotations/batch
Content-Type: application/json

{
  "annotations": [
    {
      "image_id": 1,
      "annotation_type": "bbox",
      "class_id": 0,
      "geometry": {...}
    },
    {
      "image_id": 1,
      "annotation_type": "bbox",
      "class_id": 1,
      "geometry": {...}
    }
  ]
}
```

**Response** (201 Created):
```json
{
  "created": 2,
  "annotation_ids": [12348, 12349]
}
```

### Batch Delete Annotations

```http
DELETE /api/v1/projects/{project_id}/annotations/batch
Content-Type: application/json

{
  "annotation_ids": [12345, 12346, 12347]
}
```

**Response** (200 OK):
```json
{
  "deleted": 3
}
```

---

## Images API

### List Images

```http
GET /api/v1/projects/{project_id}/images
```

**Query Parameters**:
- `annotated` (boolean): Filter by annotation status
- `assigned_to` (integer): Filter images assigned to user
- Standard pagination params

**Response**:
```json
{
  "items": [
    {
      "id": 1,
      "filename": "images/cats/cat001.jpg",
      "width": 1920,
      "height": 1080,
      "size_bytes": 245678,
      "annotation_count": 3,
      "annotated": true,
      "reviewed": false,
      "annotator_id": 123,
      "group_id": null,
      "image_annotations": {
        "classes": [0, 1],
        "captions": [
          {
            "text": "A cat sitting on a couch",
            "source": "human"
          }
        ]
      },
      "created_at": "2025-01-10T10:00:00Z",
      "updated_at": "2025-01-13T15:30:00Z"
    }
  ],
  "total": 1000,
  "page": 1,
  "page_size": 50,
  "total_pages": 20
}
```

### Get Image

```http
GET /api/v1/projects/{project_id}/images/{image_id}
```

**Response**: Image object with annotations

```json
{
  "id": 1,
  "filename": "images/cats/cat001.jpg",
  "width": 1920,
  "height": 1080,
  "annotations": [
    {
      "id": 12345,
      "annotation_type": "bbox",
      ...
    }
  ],
  ...
}
```

### Get Image URL (Presigned)

```http
GET /api/v1/projects/{project_id}/images/{image_id}/url
```

**Query Parameters**:
- `expires_in` (integer, default: 3600): Expiration time in seconds

**Response**:
```json
{
  "url": "https://storage.example.com/datasets/xyz/images/cat001.jpg?signature=...",
  "expires_in": 3600,
  "expires_at": "2025-01-13T16:30:00Z"
}
```

### Update Image Annotations (Image-level)

```http
PATCH /api/v1/projects/{project_id}/images/{image_id}
Content-Type: application/json

{
  "image_annotations": {
    "classes": [0, 1],
    "captions": [
      {
        "text": "A fluffy cat and a small dog",
        "source": "human",
        "confidence": 1.0
      }
    ]
  }
}
```

**Response** (200 OK): Updated image object

---

## Tasks API

### List Tasks

```http
GET /api/v1/projects/{project_id}/tasks
```

**Query Parameters**:
- `assignee_id` (integer): Filter by assignee
- `status` (string): Filter by status
- Standard pagination params

**Response**:
```json
{
  "items": [
    {
      "id": 1,
      "project_id": "project-abc123",
      "task_name": "Annotate batch 1",
      "task_description": "First 100 images",
      "assignee": {
        "id": 456,
        "email": "annotator@example.com",
        "full_name": "Jane Doe"
      },
      "assigner": {
        "id": 123,
        "email": "manager@example.com",
        "full_name": "John Doe"
      },
      "image_ids": [1, 2, 3, ..., 100],
      "total_images": 100,
      "status": "in_progress",
      "progress": 45,
      "completion_percentage": 45,
      "assigned_at": "2025-01-10T10:00:00Z",
      "due_date": "2025-01-20T23:59:59Z",
      "started_at": "2025-01-11T09:00:00Z",
      "completed_at": null
    }
  ],
  "total": 10,
  "page": 1,
  "page_size": 20,
  "total_pages": 1
}
```

### Create Task

```http
POST /api/v1/projects/{project_id}/tasks
Content-Type: application/json

{
  "task_name": "Annotate batch 1",
  "task_description": "First 100 images",
  "assignee_id": 456,
  "image_ids": [1, 2, 3, ..., 100],
  "due_date": "2025-01-20T23:59:59Z"
}
```

**Response** (201 Created): Task object

### Update Task

```http
PATCH /api/v1/projects/{project_id}/tasks/{task_id}
Content-Type: application/json

{
  "status": "completed"
}
```

**Response** (200 OK): Updated task object

---

## Comments API

### List Comments

```http
GET /api/v1/projects/{project_id}/comments
```

**Query Parameters**:
- `image_id` (integer): Filter by image
- `annotation_id` (integer): Filter by annotation
- `resolved` (boolean): Filter by resolution status

**Response**:
```json
{
  "items": [
    {
      "id": 1,
      "project_id": "project-abc123",
      "image_id": 1,
      "annotation_id": null,
      "text": "This image has poor lighting",
      "comment_type": "issue",
      "parent_id": null,
      "thread_level": 0,
      "author": {
        "id": 123,
        "email": "user@example.com",
        "full_name": "John Doe"
      },
      "created_at": "2025-01-13T10:00:00Z",
      "edited": false,
      "resolved": false,
      "replies": [
        {
          "id": 2,
          "text": "Agreed, should we re-capture?",
          "parent_id": 1,
          "thread_level": 1,
          "author": {...},
          "created_at": "2025-01-13T10:05:00Z"
        }
      ]
    }
  ],
  "total": 50,
  "page": 1,
  "page_size": 20,
  "total_pages": 3
}
```

### Create Comment

```http
POST /api/v1/projects/{project_id}/comments
Content-Type: application/json

{
  "image_id": 1,
  "annotation_id": null,
  "text": "This image has poor lighting",
  "comment_type": "issue"
}
```

**Response** (201 Created): Comment object

### Resolve Comment

```http
PATCH /api/v1/projects/{project_id}/comments/{comment_id}/resolve
```

**Response** (200 OK):
```json
{
  "id": 1,
  "resolved": true,
  "resolved_by": 123,
  "resolved_at": "2025-01-13T11:00:00Z"
}
```

---

## Export API

### Export Annotations

```http
POST /api/v1/projects/{project_id}/export
Content-Type: application/json

{
  "format": "coco",  // "coco", "yolo", "pascal_voc", "custom"
  "include_images": false,
  "split": {
    "train": 0.8,
    "val": 0.1,
    "test": 0.1
  }
}
```

**Response** (202 Accepted):
```json
{
  "export_id": "export-abc123",
  "status": "processing",
  "created_at": "2025-01-13T12:00:00Z",
  "estimated_completion": "2025-01-13T12:05:00Z"
}
```

### Check Export Status

```http
GET /api/v1/projects/{project_id}/exports/{export_id}
```

**Response**:
```json
{
  "export_id": "export-abc123",
  "status": "completed",  // "processing", "completed", "failed"
  "format": "coco",
  "download_url": "https://storage.example.com/exports/export-abc123.zip?signature=...",
  "file_size_bytes": 12345678,
  "expires_at": "2025-01-14T12:00:00Z",
  "created_at": "2025-01-13T12:00:00Z",
  "completed_at": "2025-01-13T12:04:35Z"
}
```

### Create Snapshot

```http
POST /api/v1/projects/{project_id}/snapshots
Content-Type: application/json

{
  "version_tag": "v1",  // optional
  "description": "First complete version"
}
```

**Response** (201 Created):
```json
{
  "snapshot_id": "project-abc123-v1",
  "dataset_id": "dataset-xyz789",
  "snapshot_type": "manual",
  "version_tag": "v1",
  "storage_path": "datasets/xyz789/snapshots/project-abc123-v1.json",
  "status": "valid",
  "total_images": 1000,
  "total_annotations": 5432,
  "created_at": "2025-01-13T12:00:00Z"
}
```

---

## AI Assist API

### Auto-Segment (SAM)

```http
POST /api/v1/ai/segment
Content-Type: application/json

{
  "project_id": "project-abc123",
  "image_id": 1,
  "prompts": {
    "points": [
      {"x": 500, "y": 500, "type": "positive"},
      {"x": 600, "y": 600, "type": "negative"}
    ],
    "boxes": [
      {"bbox": [400, 400, 200, 200]}
    ]
  }
}
```

**Response** (200 OK):
```json
{
  "masks": [
    {
      "segmentation": {
        "size": [1080, 1920],
        "counts": "rle_encoded_mask..."
      },
      "area": 45000,
      "bbox": [450, 450, 150, 200],
      "confidence": 0.95
    }
  ],
  "inference_time_ms": 234
}
```

### Generate Caption (LLM)

```http
POST /api/v1/ai/caption
Content-Type: application/json

{
  "project_id": "project-abc123",
  "image_id": 1,
  "prompt_template": "Describe this object in detail"
}
```

**Response** (200 OK):
```json
{
  "caption": "A fluffy orange cat sitting on a blue couch",
  "confidence": 0.89,
  "model": "blip-2",
  "inference_time_ms": 567
}
```

---

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('ws://localhost:8001/ws');

// Send auth token
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'jwt_token_here'
  }));
};
```

### Subscribe to Project

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'project:project-abc123'
}));
```

### Events

**1. Annotation Created**:
```json
{
  "type": "annotation.created",
  "project_id": "project-abc123",
  "annotation": {
    "id": 12345,
    "image_id": 1,
    "annotator_id": 456,
    ...
  },
  "timestamp": "2025-01-13T12:00:00Z"
}
```

**2. Annotation Updated**:
```json
{
  "type": "annotation.updated",
  "project_id": "project-abc123",
  "annotation_id": 12345,
  "changes": {
    "geometry": {...},
    "attributes": {...}
  },
  "timestamp": "2025-01-13T12:01:00Z"
}
```

**3. User Activity**:
```json
{
  "type": "user.viewing",
  "project_id": "project-abc123",
  "user_id": 456,
  "image_id": 1,
  "timestamp": "2025-01-13T12:00:00Z"
}
```

---

## Error Handling

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | No permission for resource |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict (e.g., duplicate) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

### Example Error Responses

**Validation Error**:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid annotation geometry",
    "details": [
      {
        "field": "geometry.bbox",
        "message": "Bounding box must have 4 values [x, y, width, height]"
      }
    ]
  }
}
```

**Not Found**:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Project not found",
    "resource_type": "project",
    "resource_id": "project-abc123"
  }
}
```

---

## References

- [Platform Integration](./PLATFORM_INTEGRATION.md)
- [Database Schema](./DATABASE_SCHEMA.md)
- [Project Design](./PROJECT_DESIGN.md)

---

## Change Log

- **2025-11-13**: Added dataset:project auto-create endpoint
  - New endpoint: `GET /api/v1/datasets/{dataset_id}/project`
  - Implements 1:1 relationship (one project per dataset)
  - Auto-creates project with default configuration if not exists

---

**Last Updated**: 2025-11-13
**Status**: Implemented (partial)
