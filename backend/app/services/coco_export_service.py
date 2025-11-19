"""
COCO Export Service

Converts database annotations to COCO JSON format.
COCO format specification: https://cocodataset.org/#format-data
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.db.models.labeler import Annotation, AnnotationProject
from app.db.models.platform import Dataset


def export_to_coco(
    db: Session,
    platform_db: Session,
    project_id: str,
    include_draft: bool = False,
    image_ids: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Export annotations to COCO format.

    Args:
        db: Labeler database session
        platform_db: Platform database session
        project_id: Project ID to export
        include_draft: Include draft annotations (default: False, only confirmed)
        image_ids: List of image IDs to export (None = all images)

    Returns:
        COCO format dictionary
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

    # Extract unique image IDs from annotations
    unique_image_ids = list(set([ann.image_id for ann in annotations]))

    # Build COCO structure
    coco_data = {
        "info": _build_info(project, dataset),
        "licenses": _build_licenses(),
        "images": _build_images(unique_image_ids),
        "annotations": _build_annotations(annotations),
        "categories": _build_categories(project),
    }

    return coco_data


def _build_info(project: AnnotationProject, dataset: Dataset) -> Dict[str, Any]:
    """Build COCO info section."""
    return {
        "description": project.description or f"{project.name} - Annotations",
        "url": "",
        "version": "1.0",
        "year": datetime.utcnow().year,
        "contributor": "",
        "date_created": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
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


def _build_annotations(annotations: List[Annotation]) -> List[Dict[str, Any]]:
    """Build COCO annotations section."""
    coco_annotations = []

    # Create image_id to COCO image_id mapping
    unique_image_ids = list(set([ann.image_id for ann in annotations]))
    image_id_to_coco_id = {img_id: idx + 1 for idx, img_id in enumerate(unique_image_ids)}

    for annotation in annotations:
        # Skip non-bbox annotations for now (COCO primarily for object detection)
        if annotation.annotation_type != "bbox":
            continue

        # Extract bbox from geometry
        geometry = annotation.geometry
        if "x" not in geometry or "y" not in geometry or "width" not in geometry or "height" not in geometry:
            continue

        x = float(geometry["x"])
        y = float(geometry["y"])
        width = float(geometry["width"])
        height = float(geometry["height"])

        # COCO bbox format: [x, y, width, height]
        bbox = [x, y, width, height]

        # Calculate area
        area = width * height

        # Get COCO image ID
        coco_image_id = image_id_to_coco_id.get(annotation.image_id)

        coco_annotation = {
            "id": annotation.id,
            "image_id": coco_image_id,
            "category_id": _get_category_id(annotation.class_id),
            "bbox": bbox,
            "area": area,
            "segmentation": [],  # Empty for bbox annotations
            "iscrowd": 0,
        }

        coco_annotations.append(coco_annotation)

    return coco_annotations


def _build_categories(project: AnnotationProject) -> List[Dict[str, Any]]:
    """Build COCO categories section from project classes."""
    categories = []

    if isinstance(project.classes, dict):
        # Sort by order field, then by class_id as fallback
        sorted_classes = sorted(
            project.classes.items(),
            key=lambda x: (x[1].get("order", 0), x[0])
        )
        for idx, (class_id, class_info) in enumerate(sorted_classes, start=1):
            category = {
                "id": idx,
                "name": class_info.get("name", class_id),
                "supercategory": class_info.get("supercategory", "object"),
            }
            categories.append(category)
    elif isinstance(project.classes, list):
        # Legacy list format
        for idx, class_def in enumerate(project.classes, start=1):
            category = {
                "id": idx,
                "name": class_def.get("name", class_def.get("id", f"class_{idx}")),
                "supercategory": class_def.get("supercategory", "object"),
            }
            categories.append(category)

    return categories


def _get_category_id(class_id: Optional[str]) -> int:
    """
    Convert class_id to COCO category ID.

    This is a simplified version. In production, you should maintain
    a mapping of class_id to category_id.
    """
    # For now, use a hash-based approach (not ideal, but works for demo)
    # In production, you should:
    # 1. Build a class_id -> category_id mapping from project.classes
    # 2. Store this mapping when exporting
    if not class_id:
        return 1  # Default category

    # Simple hash to get a consistent ID
    # This is NOT production-ready - use proper mapping instead
    return hash(class_id) % 1000 + 1


def get_export_stats(coco_data: Dict[str, Any]) -> Dict[str, int]:
    """Get statistics about the COCO export."""
    return {
        "image_count": len(coco_data.get("images", [])),
        "annotation_count": len(coco_data.get("annotations", [])),
        "category_count": len(coco_data.get("categories", [])),
    }
