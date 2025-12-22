"""
COCO Export Service - REFACTORED

Converts database annotations to COCO JSON format.
COCO format specification: https://cocodataset.org/#format-data

REFACTORING CHANGES:
- Use task_classes instead of legacy classes field
- Added task_type parameter for multi-task project support
- Direct task-specific class lookup (no fallbacks)
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.db.models.labeler import Dataset, Annotation, AnnotationProject, TextLabel
from app.core.config import settings

# Korea Standard Time (UTC+9)
KST = timezone(timedelta(hours=9))


def export_to_coco(
    db: Session,
    platform_db: Session,
    project_id: str,
    include_draft: bool = False,
    image_ids: Optional[List[str]] = None,
    task_type: Optional[str] = None,
    version: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Export annotations to COCO format.

    Args:
        db: Labeler database session
        platform_db: Platform database session
        project_id: Project ID to export
        include_draft: Include draft annotations (default: False, only confirmed)
        image_ids: List of image IDs to export (None = all images)
        task_type: Task type to export (detection, segmentation) - required for multi-task projects
        version: Version number (e.g., "v1.0", "v2.0")

    Returns:
        COCO format dictionary
    """
    # Get project
    project = db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).first()

    if not project:
        raise ValueError(f"Project {project_id} not found")

    # Get dataset from Labeler DB
    dataset = db.query(Dataset).filter(
        Dataset.id == project.dataset_id
    ).first()

    if not dataset:
        raise ValueError(f"Dataset {project.dataset_id} not found")

    # Build annotation query
    query = db.query(Annotation).filter(Annotation.project_id == project_id)

    # Filter by annotation state
    if not include_draft:
        query = query.filter(Annotation.annotation_state.in_(['confirmed', 'verified']))

    # Filter by image IDs if specified
    if image_ids:
        query = query.filter(Annotation.image_id.in_(image_ids))

    annotations = query.all()

    # Phase 19: Query text labels for export
    text_labels_query = db.query(TextLabel).filter(TextLabel.project_id == project_id)
    if image_ids:
        text_labels_query = text_labels_query.filter(TextLabel.image_id.in_(image_ids))
    text_labels = text_labels_query.all()

    # Extract unique image IDs from annotations
    # Sort to ensure consistent order (image_id is now file_path)
    unique_image_ids = sorted(list(set([ann.image_id for ann in annotations])))

    # REFACTORING: Get task-specific classes (task_classes only, no legacy fallback)
    # Legacy project.classes field has been removed
    if task_type and project.task_classes and task_type in project.task_classes:
        task_classes = project.task_classes[task_type]
    elif project.task_classes:
        # If task_type not specified, try to get first available task's classes
        task_classes = next(iter(project.task_classes.values())) if project.task_classes else {}
    else:
        task_classes = {}

    # Build class_id to COCO category ID mapping (1-based)
    class_id_to_category = {}
    if isinstance(task_classes, dict):
        sorted_classes = sorted(
            task_classes.items(),
            key=lambda x: (x[1].get("order", 0), x[0])
        )
        for idx, (class_id, class_info) in enumerate(sorted_classes, start=1):
            class_id_to_category[class_id] = idx

    # Phase 16.6: Add storage information for Platform integration
    storage_info = {
        "storage_type": dataset.storage_type if dataset else "s3",
        "bucket": settings.S3_BUCKET_DATASETS,
        "image_root": f"{dataset.storage_path}images/" if dataset and dataset.storage_path else f"datasets/{project.dataset_id}/images/",
    }

    # Build COCO structure
    coco_data = {
        "info": _build_info(project, dataset, version),
        "licenses": _build_licenses(),
        "images": _build_images(unique_image_ids),
        "annotations": _build_annotations(annotations, class_id_to_category),
        "categories": _build_categories(task_classes),
        "storage_info": storage_info,  # Phase 16.6: Image storage location
    }

    # Phase 19: Add text label sections (COCO extensions)
    if text_labels:
        captions, region_descriptions, vqa = _build_text_label_sections(
            text_labels, unique_image_ids, annotations
        )
        if captions:
            coco_data["captions"] = captions
        if region_descriptions:
            coco_data["region_descriptions"] = region_descriptions
        if vqa:
            coco_data["vqa"] = vqa

    return coco_data


def _build_info(project: AnnotationProject, dataset: Dataset, version: Optional[str] = None) -> Dict[str, Any]:
    """Build COCO info section."""
    now_kst = datetime.now(KST)
    return {
        "description": project.description or f"{project.name} - Annotations",
        "url": "",
        "version": version or "1.0",
        "year": now_kst.year,
        "contributor": "",
        "date_created": now_kst.strftime("%Y-%m-%d %H:%M:%S"),
    }


def _build_licenses() -> List[Dict[str, Any]]:
    """Build COCO licenses section."""
    return [
        {
            "id": 1,
            "name": "Unknown License",
            "url": "",
        }
    ]


def _build_images(image_ids: List[str]) -> List[Dict[str, Any]]:
    """
    Build COCO images section.

    Note: We don't have width/height in the database yet, so we'll use placeholders.
    In production, you should fetch this from S3 metadata or store in DB.
    """
    images = []
    for idx, image_id in enumerate(image_ids, start=1):
        images.append({
            "id": idx,
            "file_name": image_id,  # Use image_id as file_name
            "width": 0,  # TODO: Get actual dimensions from S3 or DB
            "height": 0,  # TODO: Get actual dimensions from S3 or DB
            "license": 1,
            "flickr_url": "",
            "coco_url": "",
            "date_captured": "",
        })

    return images


def _build_annotations(
    annotations: List[Annotation],
    class_id_to_category: Dict[str, int] = None
) -> List[Dict[str, Any]]:
    """Build COCO annotations section.

    Args:
        annotations: List of annotation objects
        class_id_to_category: Mapping from DB class_id to COCO category ID (1-based)
    """
    coco_annotations = []

    # Create image_id to COCO image_id mapping
    # Sort to ensure consistent order (image_id is now file_path)
    unique_image_ids = sorted(list(set([ann.image_id for ann in annotations])))
    image_id_to_coco_id = {img_id: idx + 1 for idx, img_id in enumerate(unique_image_ids)}

    for annotation in annotations:
        # Skip non-bbox/polygon annotations (COCO for object detection & segmentation)
        if annotation.annotation_type not in ("bbox", "polygon"):
            continue

        # Extract geometry
        geometry = annotation.geometry

        # Get COCO image ID
        coco_image_id = image_id_to_coco_id.get(annotation.image_id)

        # Get category ID from mapping
        category_id = 1  # Default
        if class_id_to_category and annotation.class_id in class_id_to_category:
            category_id = class_id_to_category[annotation.class_id]
        elif annotation.class_id:
            # Fallback: try to parse as integer
            try:
                category_id = int(annotation.class_id)
            except (ValueError, TypeError):
                category_id = 1

        if annotation.annotation_type == "bbox":
            # Handle both formats:
            # Format 1: {'type': 'bbox', 'bbox': [x, y, w, h]} (from frontend)
            # Format 2: {'x': x, 'y': y, 'width': w, 'height': h} (legacy)
            if 'bbox' in geometry and isinstance(geometry['bbox'], list):
                bbox_arr = geometry['bbox']
                x = float(bbox_arr[0]) if len(bbox_arr) > 0 else 0
                y = float(bbox_arr[1]) if len(bbox_arr) > 1 else 0
                width = float(bbox_arr[2]) if len(bbox_arr) > 2 else 0
                height = float(bbox_arr[3]) if len(bbox_arr) > 3 else 0
            elif "x" in geometry and "y" in geometry and "width" in geometry and "height" in geometry:
                x = float(geometry["x"])
                y = float(geometry["y"])
                width = float(geometry["width"])
                height = float(geometry["height"])
            else:
                continue

            # COCO bbox format: [x, y, width, height]
            bbox = [x, y, width, height]

            # Calculate area
            area = width * height

            coco_annotation = {
                "id": annotation.id,
                "image_id": coco_image_id,
                "category_id": category_id,
                "bbox": bbox,
                "area": area,
                "segmentation": [],  # Empty for bbox annotations
                "iscrowd": 0,
            }

        elif annotation.annotation_type == "polygon":
            # Handle polygon for segmentation
            points = geometry.get('points', [])

            if not points or len(points) < 3:
                continue

            # Calculate polygon area using shoelace formula
            area = 0.0
            n = len(points)
            for i in range(n):
                j = (i + 1) % n
                area += points[i][0] * points[j][1]
                area -= points[j][0] * points[i][1]
            area = abs(area) / 2.0

            # Calculate bounding box from polygon points
            xs = [p[0] for p in points]
            ys = [p[1] for p in points]
            x_min, x_max = min(xs), max(xs)
            y_min, y_max = min(ys), max(ys)
            bbox = [x_min, y_min, x_max - x_min, y_max - y_min]

            # Flatten points for COCO segmentation format
            # COCO expects [x1, y1, x2, y2, ...]
            segmentation_flat = []
            for point in points:
                segmentation_flat.extend([float(point[0]), float(point[1])])

            coco_annotation = {
                "id": annotation.id,
                "image_id": coco_image_id,
                "category_id": category_id,
                "bbox": bbox,
                "area": area,
                "segmentation": [segmentation_flat],  # COCO format: list of polygons
                "iscrowd": 0,
            }

        coco_annotations.append(coco_annotation)

    return coco_annotations


def _build_categories(task_classes: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Build COCO categories section from task classes.

    Args:
        task_classes: Task-specific classes dict from project.task_classes[task_type]
    """
    categories = []

    if isinstance(task_classes, dict):
        # Sort by order field, then by class_id as fallback
        sorted_classes = sorted(
            task_classes.items(),
            key=lambda x: (x[1].get("order", 0), x[0])
        )
        for idx, (class_id, class_info) in enumerate(sorted_classes, start=1):
            category = {
                "id": idx,
                "name": class_info.get("name", class_id),
                "supercategory": class_info.get("supercategory", "object"),
            }
            categories.append(category)

    return categories


def _build_text_label_sections(
    text_labels: List[TextLabel],
    image_ids: List[str],
    annotations: List[Annotation]
) -> tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Build COCO text label sections (Phase 19).

    Returns:
        Tuple of (captions, region_descriptions, vqa)
    """
    # Create image_id to index mapping
    image_id_to_idx = {image_id: idx + 1 for idx, image_id in enumerate(image_ids)}

    # Create annotation_id to COCO ann_id mapping
    ann_id_to_coco_id = {ann.id: idx + 1 for idx, ann in enumerate(annotations)}

    captions = []
    region_descriptions = []
    vqa = []

    caption_id = 1
    region_desc_id = 1
    vqa_id = 1

    for label in text_labels:
        image_idx = image_id_to_idx.get(label.image_id)
        if image_idx is None:
            continue  # Skip if image not in export

        # Image-level labels (caption, description, VQA)
        if label.annotation_id is None:
            if label.label_type in ["caption", "description"]:
                captions.append({
                    "id": caption_id,
                    "image_id": image_idx,
                    "caption": label.text_content,
                    "language": label.language,
                    "label_type": label.label_type,
                })
                caption_id += 1
            elif label.label_type == "qa" and label.question:
                vqa.append({
                    "id": vqa_id,
                    "image_id": image_idx,
                    "question": label.question,
                    "answer": label.text_content,
                    "language": label.language,
                })
                vqa_id += 1
        # Region-level labels
        else:
            coco_ann_id = ann_id_to_coco_id.get(label.annotation_id)
            if coco_ann_id:
                region_descriptions.append({
                    "id": region_desc_id,
                    "image_id": image_idx,
                    "annotation_id": coco_ann_id,
                    "phrase": label.text_content,
                    "language": label.language,
                })
                region_desc_id += 1

    return captions, region_descriptions, vqa


def get_export_stats(coco_data: Dict[str, Any]) -> Dict[str, int]:
    """Get statistics about the COCO export."""
    stats = {
        "image_count": len(coco_data.get("images", [])),
        "annotation_count": len(coco_data.get("annotations", [])),
        "category_count": len(coco_data.get("categories", [])),
    }

    # Phase 19: Add text label stats
    if "captions" in coco_data:
        stats["caption_count"] = len(coco_data["captions"])
    if "region_descriptions" in coco_data:
        stats["region_description_count"] = len(coco_data["region_descriptions"])
    if "vqa" in coco_data:
        stats["vqa_count"] = len(coco_data["vqa"])

    return stats
