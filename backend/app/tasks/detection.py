"""
Detection Task Definition

Object detection task for identifying and localizing objects with bounding boxes.

Supported annotation types:
- BBOX: Axis-aligned bounding box [x, y, width, height]
- ROTATED_BBOX: Rotated bounding box (future support)

Export formats:
- COCO: Microsoft COCO detection format
- YOLO: YOLO v5/v8 format (normalized coordinates)
- VOC: Pascal VOC XML format

Validation rules:
- Bounding box must have positive width and height
- Bounding box must be within image boundaries
- Minimum box size enforced (default: 5x5 pixels)
"""

from typing import List, Dict, Any
from .base import TaskDefinition, TaskType, AnnotationType


class DetectionTask(TaskDefinition):
    """
    Object detection task definition.

    This task type handles bounding box annotations for object detection.
    Commonly used for:
    - Object localization
    - Multi-class object detection
    - Instance counting
    """

    @property
    def task_type(self) -> TaskType:
        """Returns TaskType.DETECTION"""
        return TaskType.DETECTION

    @property
    def name(self) -> str:
        """Human-readable task name"""
        return "Object Detection"

    @property
    def description(self) -> str:
        """Task description"""
        return (
            "Draw bounding boxes around objects to detect and localize them. "
            "Supports axis-aligned and rotated bounding boxes."
        )

    @property
    def annotation_types(self) -> List[AnnotationType]:
        """Supported annotation types for detection"""
        return [
            AnnotationType.BBOX,
            AnnotationType.ROTATED_BBOX,
        ]

    def get_default_config(self) -> Dict[str, Any]:
        """
        Default configuration for detection task.

        Returns:
            Dictionary with default settings:
            - show_labels: Display class labels on boxes
            - show_confidence: Display confidence scores (for predictions)
            - min_bbox_size: Minimum bounding box dimension (pixels)
            - allow_overlap: Allow overlapping bounding boxes
            - bbox_color_mode: How to color boxes ('by_class' or 'random')
        """
        return {
            "show_labels": True,
            "show_confidence": False,
            "min_bbox_size": 5,
            "allow_overlap": True,
            "bbox_color_mode": "by_class",
            "line_width": 2,
        }

    def validate_annotation(self, annotation: Any) -> bool:
        """
        Validate a detection annotation.

        Checks:
        1. Annotation type is BBOX or ROTATED_BBOX
        2. Bounding box has valid geometry
        3. Box dimensions meet minimum size requirements
        4. Coordinates are non-negative

        Args:
            annotation: Annotation object with geometry field

        Returns:
            True if valid, False otherwise
        """
        # Check annotation type
        if not hasattr(annotation, 'annotation_type'):
            return False

        if annotation.annotation_type not in ['bbox', 'rotated_bbox']:
            return False

        # Get geometry
        if not hasattr(annotation, 'geometry') or not annotation.geometry:
            return False

        geometry = annotation.geometry

        # Validate BBOX
        if annotation.annotation_type == 'bbox':
            if 'bbox' not in geometry:
                return False

            bbox = geometry['bbox']
            if not isinstance(bbox, list) or len(bbox) != 4:
                return False

            x, y, w, h = bbox

            # Check non-negative coordinates
            if x < 0 or y < 0:
                return False

            # Check minimum size (from config)
            min_size = self.get_default_config()['min_bbox_size']
            if w < min_size or h < min_size:
                return False

            return True

        # Validate ROTATED_BBOX (future implementation)
        if annotation.annotation_type == 'rotated_bbox':
            # TODO: Implement rotated bbox validation
            return True

        return False

    def get_supported_export_formats(self) -> List[str]:
        """
        Export formats supported by detection task.

        Returns:
            List of format identifiers:
            - 'coco': Microsoft COCO JSON format
            - 'yolo': YOLO text format (one file per image)
            - 'voc': Pascal VOC XML format
            - 'dice': DICE universal format
        """
        return ['coco', 'yolo', 'voc', 'dice']
