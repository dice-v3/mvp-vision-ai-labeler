"""
Segmentation Task Definition

Pixel-level segmentation task for precise object boundaries.

Supported annotation types:
- POLYGON: Multi-point polygon for instance segmentation

Export formats:
- COCO: COCO segmentation format (RLE or polygon)
- Mask COCO: Binary masks in COCO format
- DICE: Universal format with polygon coordinates

Validation rules:
- Polygon must have at least 3 vertices
- Polygon must not exceed maximum vertex count (default: 1000)
- Vertices must be within image boundaries
- Polygon should be closed (first and last points can match)
"""

from typing import List, Dict, Any
from .base import TaskDefinition, TaskType, AnnotationType


class SegmentationTask(TaskDefinition):
    """
    Segmentation task definition.

    This task type handles polygon annotations for semantic and
    instance segmentation.

    Common use cases:
    - Precise object boundary delineation
    - Instance segmentation
    - Semantic segmentation
    - Medical image segmentation
    """

    @property
    def task_type(self) -> TaskType:
        """Returns TaskType.SEGMENTATION"""
        return TaskType.SEGMENTATION

    @property
    def name(self) -> str:
        """Human-readable task name"""
        return "Segmentation"

    @property
    def description(self) -> str:
        """Task description"""
        return (
            "Draw polygons around objects to create precise segmentation masks. "
            "Supports multi-point polygons for complex shapes."
        )

    @property
    def annotation_types(self) -> List[AnnotationType]:
        """Supported annotation types for segmentation"""
        return [
            AnnotationType.POLYGON,
        ]

    def get_default_config(self) -> Dict[str, Any]:
        """
        Default configuration for segmentation task.

        Returns:
            Dictionary with default settings:
            - show_labels: Display class labels
            - fill_opacity: Polygon fill transparency (0.0-1.0)
            - min_vertices: Minimum polygon vertices
            - max_vertices: Maximum polygon vertices
            - show_vertices: Display vertex markers
            - vertex_radius: Size of vertex markers (pixels)
            - allow_holes: Allow polygons with holes (future)
        """
        return {
            "show_labels": True,
            "fill_opacity": 0.3,
            "min_vertices": 3,
            "max_vertices": 1000,
            "show_vertices": True,
            "vertex_radius": 4,
            "allow_holes": False,
            "line_width": 2,
        }

    def validate_annotation(self, annotation: Any) -> bool:
        """
        Validate a segmentation annotation.

        Checks:
        1. Annotation type is POLYGON
        2. Polygon has valid geometry
        3. Number of vertices within allowed range
        4. All vertices have valid coordinates

        Args:
            annotation: Annotation object with geometry field

        Returns:
            True if valid, False otherwise
        """
        # Check annotation type
        if not hasattr(annotation, 'annotation_type'):
            return False

        if annotation.annotation_type != 'polygon':
            return False

        # Get geometry
        if not hasattr(annotation, 'geometry') or not annotation.geometry:
            return False

        geometry = annotation.geometry

        # Validate POLYGON
        if 'points' not in geometry:
            return False

        points = geometry['points']
        if not isinstance(points, list):
            return False

        # Check vertex count
        config = self.get_default_config()
        min_vertices = config['min_vertices']
        max_vertices = config['max_vertices']

        num_vertices = len(points)
        if num_vertices < min_vertices or num_vertices > max_vertices:
            return False

        # Validate each point
        for point in points:
            if not isinstance(point, (list, tuple)) or len(point) != 2:
                return False

            x, y = point
            if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
                return False

            # Coordinates should be non-negative
            if x < 0 or y < 0:
                return False

        return True

    def get_supported_export_formats(self) -> List[str]:
        """
        Export formats supported by segmentation task.

        Returns:
            List of format identifiers:
            - 'coco': COCO segmentation format
            - 'mask_coco': COCO with binary masks
            - 'dice': DICE universal format
        """
        return ['coco', 'mask_coco', 'dice']
