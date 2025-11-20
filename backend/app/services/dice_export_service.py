"""
DICE Export Service

Converts database annotations to DICE (Dataset Interchange and Cataloging Engine) format.
DICE format is the native format used by the Vision AI Platform.

DICE Format Structure:
{
  "format_version": "1.0",
  "dataset_id": "...",
  "task_type": "object_detection",
  "classes": [...],
  "images": [
    {
      "id": 1,
      "file_name": "img_001.jpg",
      "annotations": [...],
      "metadata": {...}
    }
  ],
  "statistics": {...}
}
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
import json

# Korea Standard Time (UTC+9)
KST = timezone(timedelta(hours=9))


def to_kst_isoformat(dt: Optional[datetime]) -> Optional[str]:
    """Convert datetime to KST timezone and return ISO format string."""
    if dt is None:
        return None
    # Assume UTC if no timezone info
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(KST).isoformat()

from app.db.models.labeler import Annotation, AnnotationProject, ImageAnnotationStatus
from app.db.models.platform import Dataset, User
from app.core.storage import storage_client


def export_to_dice(
    db: Session,
    platform_db: Session,
    project_id: str,
    include_draft: bool = False,
    image_ids: Optional[List[str]] = None,
    task_type: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Export annotations to DICE format.

    Args:
        db: Labeler database session
        platform_db: Platform database session
        project_id: Project ID to export
        include_draft: Include draft annotations (default: False, only confirmed)
        image_ids: List of image IDs to export (None = all images)
        task_type: Task type to export (detection, classification, segmentation)

    Returns:
        DICE format dictionary
    """
    # Get project
    project = db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).first()

    if not project:
        raise ValueError(f"Project {project_id} not found")

    # Get dataset
    dataset = platform_db.query(Dataset).filter(
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

    # Filter by task_type (map to annotation_type)
    if task_type:
        from sqlalchemy import or_, and_

        # Map task_type to annotation_types (can be multiple)
        task_to_annotation_types = {
            'classification': ['classification'],
            'detection': ['bbox'],
            'object_detection': ['bbox'],  # Alternative name
            'segmentation': ['polygon'],
            'keypoints': ['keypoints'],
            'line': ['line'],
        }
        annotation_types = task_to_annotation_types.get(task_type, [task_type])

        # Include no_object annotations filtered by attributes.task_type
        query = query.filter(
            or_(
                Annotation.annotation_type.in_(annotation_types),
                and_(
                    Annotation.annotation_type == 'no_object',
                    Annotation.attributes['task_type'].astext == task_type
                )
            )
        )

    annotations = query.all()

    # Group annotations by image
    images_dict = {}
    for ann in annotations:
        if ann.image_id not in images_dict:
            images_dict[ann.image_id] = []
        images_dict[ann.image_id].append(ann)

    # Load image dimensions from Platform annotations file
    # Use provided task_type or fallback to first task type
    effective_task_type = task_type or (project.task_types[0] if project.task_types else 'detection')
    image_dimensions_map = _load_image_dimensions(dataset)

    # Sort by image_id (now file_path, so string sort)
    sorted_images = sorted(images_dict.items(), key=lambda x: x[0])
    image_id_mapping = {}  # Map image_id (file_path) to DICE numeric ID

    # Get task-specific classes
    # Use task_classes if available, otherwise fall back to project.classes
    if task_type and project.task_classes and task_type in project.task_classes:
        task_classes = project.task_classes[task_type]
    else:
        task_classes = project.classes

    # Build class_id to DICE index mapping
    # This maps the database class_id (dict key) to sequential DICE index (0, 1, 2...)
    class_id_to_dice_index = {}
    class_id_to_name = {}
    if isinstance(task_classes, dict):
        sorted_classes = sorted(
            task_classes.items(),
            key=lambda x: (x[1].get("order", 0), x[0])
        )
        for idx, (class_id, class_info) in enumerate(sorted_classes):
            class_id_to_dice_index[class_id] = idx
            class_id_to_name[class_id] = class_info.get('name', class_id)

    # Rebuild DICE images with correct class mapping
    dice_images_with_mapping = []
    for idx, (image_id, image_annotations) in enumerate(sorted_images):
        # Use sequential integer as DICE ID (for COCO/DICE format compatibility)
        # image_id is now file_path, so we generate sequential IDs
        dice_id = idx + 1

        image_id_mapping[image_id] = dice_id

        # Get image metadata from image_annotation_status
        status = db.query(ImageAnnotationStatus).filter(
            ImageAnnotationStatus.project_id == project_id,
            ImageAnnotationStatus.image_id == image_id
        ).first()

        # Get user information for metadata
        labeled_by_user = None
        reviewed_by_user = None

        if image_annotations:
            first_annotation = image_annotations[0]
            labeled_by_user = platform_db.query(User).filter(
                User.id == first_annotation.created_by
            ).first()

        if status and status.is_image_confirmed:
            confirmed_by_id = None
            for ann in image_annotations:
                if ann.confirmed_by:
                    confirmed_by_id = ann.confirmed_by
                    break

            if confirmed_by_id:
                reviewed_by_user = platform_db.query(User).filter(
                    User.id == confirmed_by_id
                ).first()

        # image_id is now file_path, so use it directly as file_name
        file_name = image_id

        # Get image dimensions from mapping if available
        image_info = image_dimensions_map.get(image_id, {})
        width = image_info.get('width', 0)
        height = image_info.get('height', 0)

        dice_image = {
            "id": dice_id,
            "file_name": file_name,
            "width": width,
            "height": height,
            "depth": 3,  # Assume RGB images
            "split": "train",  # TODO: Implement train/val/test split logic
            "annotations": [
                _convert_annotation_to_dice(ann, dice_id, class_id_to_dice_index, class_id_to_name)
                for ann in image_annotations
            ],
            "metadata": {
                "labeled_by": labeled_by_user.email if labeled_by_user else None,
                "labeled_at": to_kst_isoformat(image_annotations[0].created_at) if image_annotations else None,
                "reviewed_by": reviewed_by_user.email if reviewed_by_user else None,
                "reviewed_at": to_kst_isoformat(status.confirmed_at) if status and status.confirmed_at else None,
                "source": "platform_labeler_v1.0"
            }
        }
        dice_images_with_mapping.append(dice_image)

    # Map task_type to DICE task_type format
    dice_task_type_mapping = {
        "detection": "object_detection",
        "classification": "classification",
        "segmentation": "instance_segmentation",
        "keypoints": "keypoint_detection",
        "line": "line_detection",
    }
    dice_task_type = dice_task_type_mapping.get(effective_task_type, effective_task_type)

    # Build final DICE data
    dice_data = {
        "format_version": "1.0",
        "dataset_id": project.dataset_id,
        "dataset_name": dataset.name if dataset else project.name,
        "task_type": dice_task_type,
        "created_at": to_kst_isoformat(project.created_at) if project.created_at else to_kst_isoformat(datetime.utcnow()),
        "last_modified_at": to_kst_isoformat(datetime.utcnow()),
        "version": 1,  # TODO: Get actual version number
        "classes": _convert_classes_to_dice(task_classes),
        "images": dice_images_with_mapping,
        "statistics": _calculate_statistics(dice_images_with_mapping, task_classes)
    }

    return dice_data


def _convert_annotation_to_dice(
    ann: Annotation,
    image_dice_id: int,
    class_id_to_dice_index: Dict[str, int] = None,
    class_id_to_name: Dict[str, str] = None
) -> Dict[str, Any]:
    """Convert DB annotation to DICE annotation format.

    Args:
        ann: Database annotation object
        image_dice_id: DICE format image ID
        class_id_to_dice_index: Mapping from DB class_id to DICE sequential index
        class_id_to_name: Mapping from DB class_id to class name
    """
    # Get the correct DICE class_id and class_name using mappings
    dice_class_id = 0
    dice_class_name = ann.class_name or "unknown"

    if class_id_to_dice_index and ann.class_id in class_id_to_dice_index:
        dice_class_id = class_id_to_dice_index[ann.class_id]
    elif ann.class_id:
        # Fallback: try to parse as integer
        try:
            dice_class_id = int(ann.class_id)
        except (ValueError, TypeError):
            dice_class_id = 0

    if class_id_to_name and ann.class_id in class_id_to_name:
        dice_class_name = class_id_to_name[ann.class_id]

    if ann.annotation_type == 'bbox':
        geometry = ann.geometry

        # Handle both formats:
        # Format 1: {'type': 'bbox', 'bbox': [x, y, w, h]} (from frontend)
        # Format 2: {'x': x, 'y': y, 'width': w, 'height': h} (legacy)
        if 'bbox' in geometry and isinstance(geometry['bbox'], list):
            bbox = geometry['bbox']
            x = float(bbox[0]) if len(bbox) > 0 else 0
            y = float(bbox[1]) if len(bbox) > 1 else 0
            width = float(bbox[2]) if len(bbox) > 2 else 0
            height = float(bbox[3]) if len(bbox) > 3 else 0
        else:
            x = float(geometry.get('x', 0))
            y = float(geometry.get('y', 0))
            width = float(geometry.get('width', 0))
            height = float(geometry.get('height', 0))

        return {
            "id": ann.id,
            "image_id": image_dice_id,  # Use DICE image ID
            "class_id": dice_class_id,
            "class_name": dice_class_name,
            "bbox": [x, y, width, height],
            "bbox_format": "xywh",
            "area": width * height,
            "iscrowd": 0,
            "attributes": ann.attributes or {}
        }
    elif ann.annotation_type == 'polygon':
        geometry = ann.geometry
        points = geometry.get('points', [])

        # Calculate polygon area using shoelace formula
        area = 0.0
        n = len(points)
        if n >= 3:
            for i in range(n):
                j = (i + 1) % n
                area += points[i][0] * points[j][1]
                area -= points[j][0] * points[i][1]
            area = abs(area) / 2.0

        # Calculate bounding box from polygon points
        if points:
            xs = [p[0] for p in points]
            ys = [p[1] for p in points]
            x_min, x_max = min(xs), max(xs)
            y_min, y_max = min(ys), max(ys)
            bbox = [x_min, y_min, x_max - x_min, y_max - y_min]
        else:
            bbox = [0, 0, 0, 0]

        # Flatten points for COCO-style segmentation format
        # COCO expects [x1, y1, x2, y2, ...]
        segmentation_flat = []
        for point in points:
            segmentation_flat.extend(point)

        return {
            "id": ann.id,
            "image_id": image_dice_id,
            "class_id": dice_class_id,
            "class_name": dice_class_name,
            "segmentation": [segmentation_flat],  # COCO format: list of polygons
            "bbox": bbox,
            "bbox_format": "xywh",
            "area": area,
            "iscrowd": 0,
            "attributes": ann.attributes or {}
        }
    elif ann.annotation_type == 'classification':
        # Image-level classification
        return {
            "id": ann.id,
            "image_id": image_dice_id,
            "class_id": dice_class_id,
            "class_name": dice_class_name,
            "attributes": ann.attributes or {}
        }
    elif ann.annotation_type == 'no_object':
        # No object / background image marker
        return {
            "id": ann.id,
            "image_id": image_dice_id,
            "class_id": -1,  # Special ID for background
            "class_name": "__background__",
            "is_background": True,
            "attributes": ann.attributes or {}
        }
    else:
        # Generic fallback
        return {
            "id": ann.id,
            "image_id": image_dice_id,
            "class_id": dice_class_id,
            "class_name": dice_class_name,
            "type": ann.annotation_type,
            "geometry": ann.geometry,
            "attributes": ann.attributes or {}
        }


def _parse_class_id(class_id: Optional[str]) -> int:
    """
    Parse class_id to integer.

    In DICE format, class_id should be an integer.
    Our DB stores it as string, so we need to convert.
    """
    if class_id is None:
        return 0

    # Try to parse as integer
    try:
        return int(class_id)
    except (ValueError, TypeError):
        # If string, hash it to get a consistent integer
        # This is not ideal - ideally class_id should be integer in DB
        return hash(class_id) % 1000


def _convert_classes_to_dice(classes) -> List[Dict]:
    """Convert project classes to DICE format."""
    if not classes:
        return []

    dice_classes = []

    # Handle dict format (new): {class_id: {name, color, order, ...}}
    if isinstance(classes, dict):
        # Sort by order field, then by class_id as fallback
        sorted_classes = sorted(
            classes.items(),
            key=lambda x: (x[1].get("order", 0), x[0])
        )
        for idx, (class_id, class_info) in enumerate(sorted_classes):
            dice_class = {
                "id": idx,  # Use order-based index for DICE
                "name": class_info.get('name', class_id),
                "color": class_info.get('color', "#000000"),
                "supercategory": class_info.get('supercategory', 'object')
            }
            dice_classes.append(dice_class)
    # Handle list format (legacy): [{id, name, color, ...}, ...]
    elif isinstance(classes, list):
        for cls in classes:
            # Handle both dict and object formats
            if isinstance(cls, dict):
                class_id = cls.get('id')
                class_name = cls.get('name')
                color = cls.get('color')
                supercategory = cls.get('supercategory', 'object')
            else:
                class_id = getattr(cls, 'id', None)
                class_name = getattr(cls, 'name', None)
                color = getattr(cls, 'color', None)
                supercategory = getattr(cls, 'supercategory', 'object')

            dice_class = {
                "id": _parse_class_id(class_id),
                "name": class_name or str(class_id),
                "color": color or "#000000",
                "supercategory": supercategory
            }
            dice_classes.append(dice_class)

    return dice_classes


def _get_task_type(project: AnnotationProject) -> str:
    """Get task type from project."""
    if not project.task_types or len(project.task_types) == 0:
        return "object_detection"

    task_type = project.task_types[0]

    # Map our task types to DICE task types
    task_type_mapping = {
        "bbox": "object_detection",
        "polygon": "instance_segmentation",
        "classification": "classification",
        "rotated_bbox": "object_detection",
        "line": "line_detection",
        "open_vocab": "open_vocabulary_detection"
    }

    return task_type_mapping.get(task_type, task_type)


def _calculate_statistics(images: List[Dict], classes: List[Dict]) -> Dict:
    """Calculate dataset statistics."""
    if not images:
        return {
            "total_images": 0,
            "total_annotations": 0,
            "avg_annotations_per_image": 0,
            "class_distribution": {},
            "split_distribution": {}
        }

    total_annotations = sum(len(img['annotations']) for img in images)

    # Calculate class distribution
    class_distribution = {}
    for img in images:
        for ann in img['annotations']:
            class_name = ann.get('class_name', 'unknown')
            class_distribution[class_name] = class_distribution.get(class_name, 0) + 1

    # Calculate split distribution
    split_distribution = {}
    for img in images:
        split = img.get('split', 'train')
        split_distribution[split] = split_distribution.get(split, 0) + 1

    return {
        "total_images": len(images),
        "total_annotations": total_annotations,
        "avg_annotations_per_image": round(total_annotations / len(images), 2) if images else 0,
        "class_distribution": class_distribution,
        "split_distribution": split_distribution
    }


def get_export_stats(dice_data: Dict[str, Any]) -> Dict[str, int]:
    """Get statistics about the DICE export."""
    return {
        "image_count": len(dice_data.get("images", [])),
        "annotation_count": dice_data.get("statistics", {}).get("total_annotations", 0),
        "class_count": len(dice_data.get("classes", [])),
    }


def _load_image_dimensions(dataset: Dataset) -> Dict[str, Any]:
    """
    Load image dimensions from Platform annotations file.

    Args:
        dataset: Platform Dataset object

    Returns:
        Dictionary mapping file_path to {width, height}
    """
    mapping = {}

    # If dataset has no annotation_path, return empty mapping
    if not dataset or not dataset.annotation_path:
        return mapping

    try:
        # Download annotations file from S3
        annotation_data = storage_client.s3_client.get_object(
            Bucket=storage_client.datasets_bucket,
            Key=dataset.annotation_path
        )

        # Parse JSON
        content = annotation_data['Body'].read().decode('utf-8')
        annotations_json = json.loads(content)

        # Build mapping from images array
        # Now image_id is file_path, so map file_name to dimensions
        images = annotations_json.get('images', [])
        for img in images:
            file_name = img.get('file_name')

            if file_name:
                mapping[file_name] = {
                    'width': img.get('width', 0),
                    'height': img.get('height', 0)
                }

        return mapping

    except Exception as e:
        # If loading fails, log error and return empty mapping
        print(f"Warning: Failed to load image dimensions: {e}")
        return mapping
