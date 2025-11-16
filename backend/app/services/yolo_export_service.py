"""
YOLO Export Service

Converts database annotations to YOLO format.
YOLO format: One .txt file per image with annotations in format:
  class_id x_center y_center width height (all normalized 0-1)
"""

from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.db.models.labeler import Annotation, AnnotationProject


def export_to_yolo(
    db: Session,
    project_id: str,
    include_draft: bool = False,
    image_ids: Optional[List[str]] = None,
) -> Tuple[Dict[str, str], str]:
    """
    Export annotations to YOLO format.

    Args:
        db: Labeler database session
        project_id: Project ID to export
        include_draft: Include draft annotations (default: False, only confirmed)
        image_ids: List of image IDs to export (None = all images)

    Returns:
        Tuple of (image_annotations_dict, classes_txt)
        - image_annotations_dict: {image_id: "yolo format annotations"}
        - classes_txt: Class names in order
    """
    # Get project
    project = db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).first()

    if not project:
        raise ValueError(f"Project {project_id} not found")

    # Build annotation query
    query = db.query(Annotation).filter(Annotation.project_id == project_id)

    # Filter by annotation state
    if not include_draft:
        query = query.filter(Annotation.annotation_state.in_(['confirmed', 'verified']))

    # Filter by image IDs if specified
    if image_ids:
        query = query.filter(Annotation.image_id.in_(image_ids))

    annotations = query.all()

    # Build class_id to index mapping
    class_mapping = _build_class_mapping(project)

    # Group annotations by image
    image_annotations: Dict[str, List[str]] = {}

    for annotation in annotations:
        # Skip non-bbox annotations (YOLO is for object detection)
        if annotation.annotation_type != "bbox":
            continue

        # Get class index
        class_id = annotation.class_id
        if class_id not in class_mapping:
            continue  # Skip unknown classes

        class_idx = class_mapping[class_id]

        # Extract bbox from geometry
        geometry = annotation.geometry
        if "x" not in geometry or "y" not in geometry or "width" not in geometry or "height" not in geometry:
            continue

        # Convert to YOLO format (normalized center coordinates)
        yolo_bbox = _convert_to_yolo_bbox(
            x=float(geometry["x"]),
            y=float(geometry["y"]),
            width=float(geometry["width"]),
            height=float(geometry["height"]),
            image_width=float(geometry.get("image_width", 1920)),  # Default or from geometry
            image_height=float(geometry.get("image_height", 1080)),  # Default or from geometry
        )

        # Format: class_id x_center y_center width height
        yolo_line = f"{class_idx} {yolo_bbox[0]:.6f} {yolo_bbox[1]:.6f} {yolo_bbox[2]:.6f} {yolo_bbox[3]:.6f}"

        # Add to image annotations
        image_id = annotation.image_id
        if image_id not in image_annotations:
            image_annotations[image_id] = []
        image_annotations[image_id].append(yolo_line)

    # Convert lists to strings
    image_annotations_str = {
        img_id: "\n".join(lines)
        for img_id, lines in image_annotations.items()
    }

    # Build classes.txt
    classes_txt = _build_classes_txt(project, class_mapping)

    return image_annotations_str, classes_txt


def _build_class_mapping(project: AnnotationProject) -> Dict[str, int]:
    """
    Build class_id to index mapping.

    YOLO uses integer class IDs starting from 0.
    """
    class_mapping = {}

    # project.classes is a list of class definitions
    classes = project.classes if isinstance(project.classes, list) else []

    for idx, class_def in enumerate(classes):
        class_id = class_def.get("id")
        if class_id:
            class_mapping[class_id] = idx

    return class_mapping


def _convert_to_yolo_bbox(
    x: float,
    y: float,
    width: float,
    height: float,
    image_width: float,
    image_height: float,
) -> Tuple[float, float, float, float]:
    """
    Convert bbox from absolute coordinates to YOLO format (normalized center coordinates).

    Args:
        x: Left coordinate (absolute)
        y: Top coordinate (absolute)
        width: Width (absolute)
        height: Height (absolute)
        image_width: Image width
        image_height: Image height

    Returns:
        (x_center, y_center, width, height) all normalized to [0, 1]
    """
    # Calculate center
    x_center = x + width / 2
    y_center = y + height / 2

    # Normalize to [0, 1]
    x_center_norm = x_center / image_width
    y_center_norm = y_center / image_height
    width_norm = width / image_width
    height_norm = height / image_height

    # Clip to [0, 1] range
    x_center_norm = max(0.0, min(1.0, x_center_norm))
    y_center_norm = max(0.0, min(1.0, y_center_norm))
    width_norm = max(0.0, min(1.0, width_norm))
    height_norm = max(0.0, min(1.0, height_norm))

    return (x_center_norm, y_center_norm, width_norm, height_norm)


def _build_classes_txt(project: AnnotationProject, class_mapping: Dict[str, int]) -> str:
    """
    Build classes.txt content.

    Format: One class name per line, in order of class index.
    """
    classes = project.classes if isinstance(project.classes, list) else []

    # Create ordered list of class names
    class_names = [""] * len(class_mapping)
    for class_def in classes:
        class_id = class_def.get("id")
        class_name = class_def.get("name", class_id)
        if class_id in class_mapping:
            idx = class_mapping[class_id]
            class_names[idx] = class_name

    return "\n".join(class_names)


def get_export_stats(
    image_annotations: Dict[str, str],
    classes_txt: str
) -> Dict[str, int]:
    """Get statistics about the YOLO export."""
    total_annotations = sum(
        len(annotations.split("\n"))
        for annotations in image_annotations.values()
        if annotations
    )

    return {
        "image_count": len(image_annotations),
        "annotation_count": total_annotations,
        "class_count": len(classes_txt.split("\n")) if classes_txt else 0,
    }
