"""
YOLO Export Service - REFACTORED

Converts database annotations to YOLO format.
YOLO format: One .txt file per image with annotations in format:
  class_id x_center y_center width height (all normalized 0-1)

REFACTORING CHANGES:
- Use task_classes instead of legacy classes field
- Added task_type parameter for multi-task project support
- Direct task-specific class lookup (no fallbacks)
"""

from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_
import json

from app.db.models.labeler import Annotation, AnnotationProject, TextLabel


def export_to_yolo(
    db: Session,
    project_id: str,
    include_draft: bool = False,
    image_ids: Optional[List[str]] = None,
    task_type: Optional[str] = None,
) -> Tuple[Dict[str, str], str, Dict[str, str], Dict[str, str], Dict[str, str]]:
    """
    Export annotations to YOLO format.

    Args:
        db: Labeler database session
        project_id: Project ID to export
        include_draft: Include draft annotations (default: False, only confirmed)
        image_ids: List of image IDs to export (None = all images)
        task_type: Task type to export (detection, segmentation) - required for multi-task projects

    Returns:
        Tuple of (image_annotations_dict, classes_txt, captions_files, region_descriptions_files, vqa_files)
        - image_annotations_dict: {image_id: "yolo format annotations"}
        - classes_txt: Class names in order
        - captions_files: {image_id: "json string of captions"} (Phase 19)
        - region_descriptions_files: {image_id: "json string of region descriptions"} (Phase 19)
        - vqa_files: {image_id: "json string of VQA pairs"} (Phase 19)
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

    # Phase 19: Query text labels for export
    text_labels_query = db.query(TextLabel).filter(TextLabel.project_id == project_id)
    if image_ids:
        text_labels_query = text_labels_query.filter(TextLabel.image_id.in_(image_ids))
    text_labels = text_labels_query.all()

    # REFACTORING: Get task-specific classes (task_classes only, no legacy fallback)
    # Legacy project.classes field has been removed
    if task_type and project.task_classes and task_type in project.task_classes:
        task_classes = project.task_classes[task_type]
    elif project.task_classes:
        # If task_type not specified, try to get first available task's classes
        task_classes = next(iter(project.task_classes.values())) if project.task_classes else {}
    else:
        task_classes = {}

    # Build class_id to index mapping
    class_mapping = _build_class_mapping(task_classes)

    # Track all unique image IDs (including no_object images)
    all_image_ids = set()

    # Group annotations by image
    image_annotations: Dict[str, List[str]] = {}

    for annotation in annotations:
        # Track all images including no_object
        all_image_ids.add(annotation.image_id)

        # Skip non-bbox/polygon annotations
        # no_object images will be included with empty annotation file
        if annotation.annotation_type not in ("bbox", "polygon"):
            continue

        # Get class index
        class_id = annotation.class_id
        if class_id not in class_mapping:
            continue  # Skip unknown classes

        class_idx = class_mapping[class_id]

        # Extract geometry
        geometry = annotation.geometry

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

            # Get image dimensions from geometry (required for normalization)
            img_width = float(geometry.get("image_width", 0))
            img_height = float(geometry.get("image_height", 0))

            # Skip if no valid dimensions
            if img_width <= 0 or img_height <= 0:
                continue

            # Convert to YOLO format (normalized center coordinates)
            yolo_bbox = _convert_to_yolo_bbox(
                x=x,
                y=y,
                width=width,
                height=height,
                image_width=img_width,
                image_height=img_height,
            )

            # Format: class_id x_center y_center width height
            yolo_line = f"{class_idx} {yolo_bbox[0]:.6f} {yolo_bbox[1]:.6f} {yolo_bbox[2]:.6f} {yolo_bbox[3]:.6f}"

        elif annotation.annotation_type == "polygon":
            # Handle polygon for YOLO-seg format
            points = geometry.get('points', [])

            if not points or len(points) < 3:
                continue

            # Get image dimensions from geometry (required for normalization)
            image_width = float(geometry.get("image_width", 0))
            image_height = float(geometry.get("image_height", 0))

            # Skip if no valid dimensions
            if image_width <= 0 or image_height <= 0:
                continue

            # Convert to YOLO-seg format: class_id x1 y1 x2 y2 x3 y3 ... (normalized)
            normalized_points = []
            for point in points:
                x_norm = max(0.0, min(1.0, float(point[0]) / image_width))
                y_norm = max(0.0, min(1.0, float(point[1]) / image_height))
                normalized_points.extend([f"{x_norm:.6f}", f"{y_norm:.6f}"])

            yolo_line = f"{class_idx} " + " ".join(normalized_points)

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

    # Include images with no_object (empty annotation file)
    # This ensures images marked as "no object" are included in export
    for img_id in all_image_ids:
        if img_id not in image_annotations_str:
            image_annotations_str[img_id] = ""  # Empty file for no_object images

    # Build classes.txt
    classes_txt = _build_classes_txt(task_classes, class_mapping)

    # Phase 19: Build text label files (JSON format)
    # Group text labels by image and annotation
    text_labels_by_image = {}  # image_id -> [text labels]
    text_labels_by_annotation = {}  # annotation_id -> [text labels]

    for label in text_labels:
        if label.annotation_id is None:
            # Image-level labels
            if label.image_id not in text_labels_by_image:
                text_labels_by_image[label.image_id] = []
            text_labels_by_image[label.image_id].append(label)
        else:
            # Region-level labels
            if label.annotation_id not in text_labels_by_annotation:
                text_labels_by_annotation[label.annotation_id] = []
            text_labels_by_annotation[label.annotation_id].append(label)

    # Build text label file structures
    captions_files = {}  # {image_id: json_string}
    region_descriptions_files = {}  # {image_id: json_string}
    vqa_files = {}  # {image_id: json_string}

    # Process image-level text labels
    for image_id, labels in text_labels_by_image.items():
        captions = []
        vqa_pairs = []

        for label in labels:
            if label.label_type in ["caption", "description"]:
                captions.append({
                    "text": label.text_content,
                    "language": label.language,
                    "label_type": label.label_type,
                    "confidence": label.confidence,
                })
            elif label.label_type == "qa" and label.question:
                vqa_pairs.append({
                    "question": label.question,
                    "answer": label.text_content,
                    "language": label.language,
                    "confidence": label.confidence,
                })

        if captions:
            captions_files[image_id] = json.dumps(captions, ensure_ascii=False, indent=2)
        if vqa_pairs:
            vqa_files[image_id] = json.dumps(vqa_pairs, ensure_ascii=False, indent=2)

    # Process region-level text labels (group by image)
    region_labels_by_image = {}
    for ann in annotations:
        if ann.id in text_labels_by_annotation:
            image_id = ann.image_id
            if image_id not in region_labels_by_image:
                region_labels_by_image[image_id] = []

            for label in text_labels_by_annotation[ann.id]:
                region_labels_by_image[image_id].append({
                    "annotation_id": str(ann.id),
                    "class_id": ann.class_id,
                    "text": label.text_content,
                    "language": label.language,
                    "confidence": label.confidence,
                })

    for image_id, region_labels in region_labels_by_image.items():
        region_descriptions_files[image_id] = json.dumps(region_labels, ensure_ascii=False, indent=2)

    return image_annotations_str, classes_txt, captions_files, region_descriptions_files, vqa_files


def _build_class_mapping(task_classes: Dict[str, Any]) -> Dict[str, int]:
    """
    Build class_id to index mapping from task classes.

    YOLO uses integer class IDs starting from 0.
    Classes are sorted by their 'order' field to ensure consistent export.

    Args:
        task_classes: Task-specific classes dict from project.task_classes[task_type]
    """
    class_mapping = {}

    if isinstance(task_classes, dict):
        # Sort by order field, then by class_id as fallback
        sorted_classes = sorted(
            task_classes.items(),
            key=lambda x: (x[1].get("order", 0), x[0])
        )
        for idx, (class_id, class_info) in enumerate(sorted_classes):
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


def _build_classes_txt(task_classes: Dict[str, Any], class_mapping: Dict[str, int]) -> str:
    """
    Build classes.txt content from task classes.

    Format: One class name per line, in order of class index.

    Args:
        task_classes: Task-specific classes dict from project.task_classes[task_type]
        class_mapping: Mapping from class_id to index
    """
    # Create ordered list of class names
    class_names = [""] * len(class_mapping)

    if isinstance(task_classes, dict):
        for class_id, class_info in task_classes.items():
            class_name = class_info.get("name", class_id)
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
