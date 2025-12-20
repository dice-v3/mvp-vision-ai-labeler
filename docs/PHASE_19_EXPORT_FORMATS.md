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

**Last Updated**: 2025-12-20
**Phase**: 19.5 - VLM Text Label Export Integration
