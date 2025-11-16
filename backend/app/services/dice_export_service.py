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

from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.models.labeler import Annotation, AnnotationProject, ImageAnnotationStatus
from app.db.models.platform import Dataset, User


def export_to_dice(
    db: Session,
    platform_db: Session,
    project_id: str,
    include_draft: bool = False,
    image_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Export annotations to DICE format.

    Args:
        db: Labeler database session
        platform_db: Platform database session
        project_id: Project ID to export
        include_draft: Include draft annotations (default: False, only confirmed)
        image_ids: List of image IDs to export (None = all images)

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

    annotations = query.all()

    # Group annotations by image
    images_dict = {}
    for ann in annotations:
        if ann.image_id not in images_dict:
            images_dict[ann.image_id] = []
        images_dict[ann.image_id].append(ann)

    # Build DICE images array
    dice_images = []
    image_id_mapping = {}  # Map image_id to DICE numeric ID

    for idx, (image_id, image_annotations) in enumerate(images_dict.items(), start=1):
        image_id_mapping[image_id] = idx

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
            # Get reviewer info - check if confirmed_by exists in image status
            # If not, use the confirmed_by from the first confirmed annotation
            confirmed_by_id = None
            for ann in image_annotations:
                if ann.confirmed_by:
                    confirmed_by_id = ann.confirmed_by
                    break

            if confirmed_by_id:
                reviewed_by_user = platform_db.query(User).filter(
                    User.id == confirmed_by_id
                ).first()

        dice_image = {
            "id": idx,
            "file_name": image_id,
            "width": 0,  # TODO: Get from S3 metadata or store in DB
            "height": 0,
            "depth": 3,  # Assume RGB images
            "split": "train",  # TODO: Implement train/val/test split logic
            "annotations": [
                _convert_annotation_to_dice(ann, idx)
                for ann in image_annotations
            ],
            "metadata": {
                "labeled_by": labeled_by_user.email if labeled_by_user else None,
                "labeled_at": image_annotations[0].created_at.isoformat() if image_annotations else None,
                "reviewed_by": reviewed_by_user.email if reviewed_by_user else None,
                "reviewed_at": status.confirmed_at.isoformat() if status and status.confirmed_at else None,
                "source": "platform_labeler_v1.0"
            }
        }
        dice_images.append(dice_image)

    # Build final DICE data
    dice_data = {
        "format_version": "1.0",
        "dataset_id": project.dataset_id,
        "dataset_name": dataset.name if dataset else project.name,
        "task_type": _get_task_type(project),
        "created_at": project.created_at.isoformat() if project.created_at else datetime.utcnow().isoformat(),
        "last_modified_at": datetime.utcnow().isoformat(),
        "version": 1,  # TODO: Get actual version number
        "classes": _convert_classes_to_dice(project.classes),
        "images": dice_images,
        "statistics": _calculate_statistics(dice_images, project.classes)
    }

    return dice_data


def _convert_annotation_to_dice(ann: Annotation, image_dice_id: int) -> Dict[str, Any]:
    """Convert DB annotation to DICE annotation format."""
    if ann.annotation_type == 'bbox':
        geometry = ann.geometry
        x = float(geometry.get('x', 0))
        y = float(geometry.get('y', 0))
        width = float(geometry.get('width', 0))
        height = float(geometry.get('height', 0))

        return {
            "id": ann.id,
            "image_id": image_dice_id,  # Use DICE image ID
            "class_id": _parse_class_id(ann.class_id),
            "class_name": ann.class_name,
            "bbox": [x, y, width, height],
            "bbox_format": "xywh",
            "area": width * height,
            "iscrowd": 0,
            "attributes": ann.attributes or {}
        }
    elif ann.annotation_type == 'polygon':
        # TODO: Implement polygon support
        geometry = ann.geometry
        return {
            "id": ann.id,
            "image_id": image_dice_id,
            "class_id": _parse_class_id(ann.class_id),
            "class_name": ann.class_name,
            "segmentation": geometry.get('points', []),
            "area": 0,  # TODO: Calculate polygon area
            "iscrowd": 0,
            "attributes": ann.attributes or {}
        }
    elif ann.annotation_type == 'classification':
        # Image-level classification
        return {
            "id": ann.id,
            "image_id": image_dice_id,
            "class_id": _parse_class_id(ann.class_id),
            "class_name": ann.class_name,
            "attributes": ann.attributes or {}
        }
    else:
        # Generic fallback
        return {
            "id": ann.id,
            "image_id": image_dice_id,
            "class_id": _parse_class_id(ann.class_id),
            "class_name": ann.class_name,
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


def _convert_classes_to_dice(classes: List[Dict]) -> List[Dict]:
    """Convert project classes to DICE format."""
    if not classes:
        return []

    dice_classes = []
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
