"""
COCO Export Service

Converts database annotations to COCO JSON format.
COCO format specification: https://cocodataset.org/#format-data
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.db.models.labeler import Annotation, AnnotationProject
from app.db.models.platform import Dataset

# Korea Standard Time (UTC+9)
KST = timezone(timedelta(hours=9))


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
    # Sort to ensure consistent order (image_id is now file_path)
    unique_image_ids = sorted(list(set([ann.image_id for ann in annotations])))

    # Build class_id to COCO category ID mapping (1-based)
    class_id_to_category = {}
    if isinstance(project.classes, dict):
        sorted_classes = sorted(
            project.classes.items(),
            key=lambda x: (x[1].get("order", 0), x[0])
        )
        for idx, (class_id, class_info) in enumerate(sorted_classes, start=1):
            class_id_to_category[class_id] = idx

    # Build COCO structure
    coco_data = {
        "info": _build_info(project, dataset),
        "licenses": _build_licenses(),
        "images": _build_images(unique_image_ids),
        "annotations": _build_annotations(annotations, class_id_to_category),
        "categories": _build_categories(project),
    }

    return coco_data


def _build_info(project: AnnotationProject, dataset: Dataset) -> Dict[str, Any]:
    """Build COCO info section."""
    now_kst = datetime.now(KST)
    return {
        "description": project.description or f"{project.name} - Annotations",
        "url": "",
        "version": "1.0",
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


def get_export_stats(coco_data: Dict[str, Any]) -> Dict[str, int]:
    """Get statistics about the COCO export."""
    return {
        "image_count": len(coco_data.get("images", [])),
        "annotation_count": len(coco_data.get("annotations", [])),
        "category_count": len(coco_data.get("categories", [])),
    }
