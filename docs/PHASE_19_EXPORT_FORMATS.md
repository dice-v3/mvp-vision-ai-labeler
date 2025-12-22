# Phase 19 VLM Text Label Export Formats

## Overview

Phase 19.5 adds VLM (Vision-Language Model) text label support to all three export formats:
- **DICE**: Native platform format with JSONB structure
- **COCO**: Standard format with COCO extensions
- **YOLO**: Directory-based format with JSON files

## Text Label Types

### Image-Level Labels
- **caption**: Short image description (one-liner)
- **description**: Detailed image description (paragraph)
- **qa**: Visual Question Answering pairs (question + answer)

### Region-Level Labels
- **region_description**: Text description linked to specific annotation via `annotation_id`

## Export Format Specifications

### 1. DICE Format

**Structure**: JSON with text labels embedded in image and annotation objects

```json
{
  "project_info": { ... },
  "export_settings": { ... },
  "images": [
    {
      "id": "image001.jpg",
      "annotations": [
        {
          "annotation_id": "ann001",
          "class_id": "car",
          "geometry": { ... },
          "text_labels": [                    // ← Region-level labels
            {
              "text": "Red sedan parked near entrance",
              "language": "en",
              "label_type": "region_description",
              "confidence": 0.95
            }
          ]
        }
      ],
      "image_captions": [                     // ← Image-level captions/descriptions
        {
          "text": "Parking lot with multiple vehicles",
          "language": "en",
          "confidence": 0.92
        },
        {
          "text": "Outdoor parking area during daytime with clear weather",
          "language": "en",
          "label_type": "description",
          "confidence": 0.88
        }
      ],
      "vqa_pairs": [                          // ← Image-level VQA
        {
          "question": "How many cars are visible?",
          "answer": "Three cars are visible in the parking lot",
          "language": "en",
          "confidence": 0.85
        }
      ]
    }
  ]
}
```

**Key Points**:
- **Region-level labels**: Embedded in `annotation.text_labels[]`
- **Image-level captions**: In `image.image_captions[]`
- **Image-level VQA**: In `image.vqa_pairs[]`
- Only present if text labels exist (fields are optional)

---

### 2. COCO Format

**Structure**: JSON with COCO extensions as new top-level sections

```json
{
  "info": { ... },
  "licenses": [ ... ],
  "images": [ ... ],
  "annotations": [ ... ],
  "categories": [ ... ],
  "storage_info": { ... },

  // Phase 19 Extensions:
  "captions": [                               // ← Image-level captions/descriptions
    {
      "id": 1,
      "image_id": 123,
      "caption": "Parking lot with multiple vehicles",
      "language": "en",
      "label_type": "caption"
    },
    {
      "id": 2,
      "image_id": 123,
      "caption": "Outdoor parking area during daytime",
      "language": "en",
      "label_type": "description"
    }
  ],
  "region_descriptions": [                    // ← Region-level descriptions
    {
      "id": 1,
      "image_id": 123,
      "annotation_id": 456,                   // Links to COCO annotation ID
      "phrase": "Red sedan parked near entrance",
      "language": "en"
    }
  ],
  "vqa": [                                    // ← Visual Question Answering
    {
      "id": 1,
      "image_id": 123,
      "question": "How many cars are visible?",
      "answer": "Three cars are visible",
      "language": "en"
    }
  ]
}
```

**Key Points**:
- **Three new top-level sections**: `captions`, `region_descriptions`, `vqa`
- **COCO IDs**: All IDs are sequential integers (not UUIDs)
- **Image/Annotation linking**: Uses COCO's `image_id` and `annotation_id`
- Only present if text labels exist (sections are optional)
- Based on COCO-Captions and Visual Genome formats

---

### 3. YOLO Format

**Structure**: ZIP file with directories for labels and text annotations

```
annotations_yolo.zip
├── classes.txt                            # Class names (one per line)
│
├── labels/                                # Bounding box/polygon annotations (existing)
│   ├── train/good/001.txt
│   ├── train/good/002.txt
│   └── ...
│
├── captions/                              # ← Image-level captions (JSON)
│   ├── train/good/001.json
│   ├── train/good/002.json
│   └── ...
│
├── region_descriptions/                   # ← Region-level descriptions (JSON)
│   ├── train/good/001.json
│   └── ...
│
└── vqa/                                   # ← Visual Question Answering (JSON)
    ├── train/good/001.json
    └── ...
```

**File Formats**:

**captions/train/good/001.json**:
```json
[
  {
    "text": "Parking lot with multiple vehicles",
    "language": "en",
    "label_type": "caption",
    "confidence": 0.92
  },
  {
    "text": "Outdoor parking area during daytime with clear weather",
    "language": "en",
    "label_type": "description",
    "confidence": 0.88
  }
]
```

**region_descriptions/train/good/001.json**:
```json
[
  {
    "annotation_id": "uuid-ann001",
    "class_id": "car",
    "text": "Red sedan parked near entrance",
    "language": "en",
    "confidence": 0.95
  },
  {
    "annotation_id": "uuid-ann002",
    "class_id": "car",
    "text": "Blue truck in the background",
    "language": "en",
    "confidence": 0.90
  }
]
```

**vqa/train/good/001.json**:
```json
[
  {
    "question": "How many cars are visible in this image?",
    "answer": "Three cars are visible in the parking lot",
    "language": "en",
    "confidence": 0.85
  }
]
```

**Key Points**:
- **Separate JSON files**: One per image (matching label file structure)
- **Same path structure**: Follows `labels/` directory structure
- **Array format**: Each JSON file contains array of text labels
- **annotation_id linking**: For region descriptions, includes annotation UUID
- Files only created if image has corresponding text labels

---

## Implementation Details

### Service Functions

```python
# DICE Export
def export_to_dice(...) -> Dict[str, Any]:
    # Returns: DICE JSON with embedded text labels

# COCO Export
def export_to_coco(...) -> Dict[str, Any]:
    # Returns: COCO JSON with extension sections

# YOLO Export
def export_to_yolo(...) -> Tuple[
    Dict[str, str],  # image_annotations (labels/*.txt)
    str,             # classes.txt
    Dict[str, str],  # captions files
    Dict[str, str],  # region_descriptions files
    Dict[str, str],  # vqa files
]:
    # Returns: Annotation strings + text label JSON strings
```

### Database Query Pattern

All services use the same text label query pattern:

```python
# Query text labels with same filtering as annotations
text_labels_query = db.query(TextLabel).filter(
    TextLabel.project_id == project_id
)
if image_ids:
    text_labels_query = text_labels_query.filter(
        TextLabel.image_id.in_(image_ids)
    )
text_labels = text_labels_query.all()
```

### Grouping Strategy

**Image-level vs Region-level**:
```python
for label in text_labels:
    if label.annotation_id is None:
        # Image-level label (caption, description, qa)
        text_labels_by_image[label.image_id].append(label)
    else:
        # Region-level label (region_description)
        text_labels_by_annotation[label.annotation_id].append(label)
```

---

## Usage Examples

### API Endpoints

```bash
# DICE Export
POST /api/v1/export/dice
{
  "project_id": "proj-123",
  "include_draft": false
}

# COCO Export
POST /api/v1/export/coco
{
  "project_id": "proj-123",
  "include_draft": false
}

# YOLO Export (returns ZIP file)
POST /api/v1/export/yolo
{
  "project_id": "proj-123",
  "include_draft": false
}
```

### Stats Returned

**DICE/COCO**:
```json
{
  "image_count": 100,
  "annotation_count": 450,
  "caption_count": 75,           // COCO only
  "region_description_count": 120,  // COCO only
  "vqa_count": 30                // COCO only
}
```

**YOLO**:
```json
{
  "image_count": 100,
  "annotation_count": 450,
  "class_count": 10
  // Note: Text label counts not in stats yet
}
```

---

## Testing Recommendations

### Manual Testing Steps

1. **Create text labels** via API or UI:
   ```bash
   POST /api/v1/projects/{project_id}/text-labels
   {
     "image_id": "train/good/001.png",
     "label_type": "caption",
     "text_content": "Test caption",
     "language": "en"
   }
   ```

2. **Export in each format**:
   - DICE: Check `image_captions`, `vqa_pairs`, `text_labels` fields
   - COCO: Check `captions`, `region_descriptions`, `vqa` sections
   - YOLO: Unzip and verify `captions/`, `region_descriptions/`, `vqa/` directories

3. **Verify linkage**:
   - Region descriptions should match annotation IDs
   - Image-level labels should match image IDs
   - All text content should be preserved

### Automated Testing

```python
# Test DICE export
dice_data = export_to_dice(db, platform_db, project_id)
assert "image_captions" in dice_data["images"][0]
assert dice_data["images"][0]["image_captions"][0]["text"] == "Expected caption"

# Test COCO export
coco_data = export_to_coco(db, platform_db, project_id)
assert "captions" in coco_data
assert len(coco_data["captions"]) > 0

# Test YOLO export
_, _, captions, region_descs, vqa = export_to_yolo(db, project_id)
assert len(captions) > 0
import json
caption_data = json.loads(captions["train/good/001.png"])
assert caption_data[0]["text"] == "Expected caption"
```

---

## Migration Notes

### Backward Compatibility

- **Exports without text labels**: All fields are optional, won't break existing workflows
- **Legacy annotations**: Still exported normally
- **Format versions**: No changes to YOLO labels or COCO annotations structure

### Future Enhancements

- [ ] Add text label counts to YOLO export stats
- [ ] Support for multi-language exports (language filtering)
- [ ] Confidence threshold filtering for text labels
- [ ] Export text labels as separate downloadable files
- [ ] Support for OCR text labels (Phase 20?)

---

## Related Files

- `backend/app/services/dice_export_service.py` - DICE export implementation
- `backend/app/services/coco_export_service.py` - COCO export implementation
- `backend/app/services/yolo_export_service.py` - YOLO export implementation
- `backend/app/api/v1/endpoints/export.py` - Export API endpoints
- `backend/app/db/models/labeler.py` - TextLabel model definition
- `frontend/lib/api/textLabels.ts` - Frontend API client

---

## Phase 19.8: Text Label Versioning & Storage

### Versioning Strategy

**Problem**: Text labels need to be versioned alongside annotations to prevent data loss during publish workflow.

**Solution**: Independent text label versioning with dual storage strategy.

#### Version Management

- **Version Numbers**: Same as annotation versions (v1.0, v2.0, etc.)
- **Automatic Versioning**: Text labels automatically published when annotation versions are published
- **Manual Versioning**: Can also publish text labels independently via API
- **Immutable Snapshots**: Published versions are immutable (stored as JSONB snapshot)

#### Database Schema

```sql
CREATE TABLE text_label_versions (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(50) NOT NULL,
    version VARCHAR(20) NOT NULL,

    -- Immutable snapshot
    text_labels_snapshot JSONB NOT NULL,

    -- Metadata
    published_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    notes TEXT,

    -- Statistics (computed for performance)
    label_count INTEGER NOT NULL DEFAULT 0,
    image_level_count INTEGER NOT NULL DEFAULT 0,
    region_level_count INTEGER NOT NULL DEFAULT 0,

    UNIQUE(project_id, version)
);
```

---

### Dual Storage Strategy

**Architecture**: Text labels stored in TWO S3 buckets with different retention policies.

#### 1. Internal Storage (Version History)

**Purpose**: Full version history, rollback support, audit trail

**Path Structure**:
```
s3://internal-bucket/
└── projects/{project_id}/
    └── annotations/
        ├── classification/
        │   └── v1.0/annotations_classification.json
        ├── detection/
        │   ├── v1.0/annotations_detection.json
        │   ├── v7.0/annotations_detection.json
        │   └── v8.0/annotations_detection.json
        └── text_labels/
            ├── v1.0/text_labels.json    ← All versions kept
            ├── v2.0/text_labels.json
            └── v3.0/text_labels.json
```

**Retention**: Forever (all versions)

**Access**: Labeler application only

---

#### 2. External Storage (Trainer Access)

**Purpose**: Training data consumption by trainers

**Path Structure**:
```
s3://external-bucket/
└── datasets/{dataset_id}/
    ├── images/
    │   ├── img001.jpg
    │   └── img002.jpg
    └── annotations/
        ├── annotations_classification.json  (latest only)
        ├── annotations_detection.json       (latest only)
        ├── annotations_segmentation.json    (latest only)
        └── text_labels.json                 (latest only) ← Overwritten
```

**Retention**: Latest version only (overwrite on publish)

**Access**: Trainer applications

---

### Publish Workflow

**When user publishes annotation version v8.0:**

```
1. User clicks "Publish Version" (v8.0)
   ↓
2. Create AnnotationSnapshots (existing - Phase 12)
   → Store in annotation_snapshots table
   ↓
3. Create TextLabelVersion (NEW - Phase 19.8)
   → Query all current text labels for project
   → Serialize to JSONB snapshot
   → Create text_label_versions record (project_id, v8.0)
   ↓
4. Upload to Internal S3 (versioned)
   → projects/{project_id}/annotations/text_labels/v8.0/text_labels.json
   ↓
5. Upload to External S3 (latest, overwrite)
   → datasets/{dataset_id}/annotations/text_labels.json
   ↓
6. Return success
```

**No Data Loss**: Even if External S3 fails, Internal S3 has full history.

---

### API Endpoints

#### Publish Text Labels

```http
POST /api/v1/text-labels/project/{project_id}/versions/publish
```

**Request**:
```json
{
  "version": "v2.0",  // Optional, auto-generated if not provided
  "notes": "Added VQA pairs for training data"
}
```

**Response**:
```json
{
  "id": 123,
  "project_id": "proj-abc",
  "version": "v2.0",
  "published_at": "2025-12-21T10:00:00Z",
  "published_by": 5,
  "label_count": 150,
  "image_level_count": 50,
  "region_level_count": 100,
  "notes": "Added VQA pairs for training data",
  "published_by_name": "John Doe",
  "published_by_email": "john@example.com"
}
```

#### List Versions

```http
GET /api/v1/text-labels/project/{project_id}/versions
```

**Response**:
```json
{
  "versions": [
    {
      "id": 124,
      "version": "v3.0",
      "published_at": "2025-12-21T15:00:00Z",
      "label_count": 200,
      ...
    },
    {
      "id": 123,
      "version": "v2.0",
      "published_at": "2025-12-21T10:00:00Z",
      "label_count": 150,
      ...
    }
  ],
  "total": 2
}
```

#### Get Specific Version

```http
GET /api/v1/text-labels/project/{project_id}/versions/{version}
```

**Response**: Includes full `text_labels_snapshot` JSONB data

---

### Trainer Download Flow

**Recommended workflow for trainers:**

```python
import boto3
import json

def download_dataset(dataset_id):
    """Download dataset from External S3."""
    s3 = boto3.client('s3')
    bucket = 'external-bucket'

    # 1. Download annotations (DICE format)
    annotations_key = f'datasets/{dataset_id}/annotations/annotations_detection.json'
    annotations = json.loads(
        s3.get_object(Bucket=bucket, Key=annotations_key)['Body'].read()
    )

    # 2. Download text labels (Phase 19.8)
    text_labels_key = f'datasets/{dataset_id}/annotations/text_labels.json'
    try:
        text_labels = json.loads(
            s3.get_object(Bucket=bucket, Key=text_labels_key)['Body'].read()
        )
    except s3.exceptions.NoSuchKey:
        text_labels = None  # No text labels published yet

    # 3. Merge and convert to model-specific format
    dataset = merge_and_convert(annotations, text_labels, model='llava')

    return dataset
```

---

### Version Snapshot Structure

**text_labels.json** (stored in both Internal and External S3):

```json
{
  "version": "v2.0",
  "project_id": "proj-abc",
  "published_at": "2025-12-21T10:00:00Z",
  "label_count": 150,
  "text_labels": [
    {
      "id": 1,
      "image_id": "img001.jpg",
      "annotation_id": null,  // Image-level
      "label_type": "caption",
      "text_content": "A dog playing in the park",
      "question": null,
      "language": "en",
      "confidence": null,
      "created_at": "2025-12-20T14:30:00Z"
    },
    {
      "id": 2,
      "image_id": "img001.jpg",
      "annotation_id": 5,  // Region-level
      "label_type": "region_description",
      "text_content": "Golden retriever running",
      "language": "en",
      "created_at": "2025-12-20T14:35:00Z"
    }
    // ... all text labels at publish time
  ]
}
```

---

### Related Documentation

- `docs/PHASE_19_VLM_MODEL_COMPATIBILITY.md` - VLM model compatibility guide
- `backend/app/services/text_label_version_service.py` - Versioning service
- `backend/app/db/models/labeler.py:879-932` - TextLabelVersion model
- `backend/alembic/versions/20251221_1000_add_text_label_versions_table.py` - Migration

---

**Last Updated**: 2025-12-21
**Phase**: 19.8 - Text Label Versioning & Publish Integration
