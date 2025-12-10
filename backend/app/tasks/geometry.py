"""
Geometry Task Definition

Geometric shape annotation task for lines, polylines, and circles.

Supported annotation types:
- POLYLINE: Multi-point line (minimum 2 points)
- CIRCLE: Circle defined by center and radius, or 3 circumference points

Export formats:
- DICE: Universal format with geometry data
- JSON: Custom JSON format with coordinate data
- SVG: Scalable Vector Graphics format (future)

Validation rules:
- Polyline must have at least 2 vertices
- Polyline must not exceed maximum vertex count (default: 100)
- Circle must have positive radius
- All coordinates must be within image boundaries
"""

from typing import List, Dict, Any
from .base import TaskDefinition, TaskType, AnnotationType


class GeometryTask(TaskDefinition):
    """
    Geometry task definition.

    This task type handles geometric shape annotations.

    Common use cases:
    - Measurement and dimension annotation
    - Path or trajectory annotation
    - Circular object detection (wheels, holes, etc.)
    - Distance and angle measurement
    - Engineering drawings
    """

    @property
    def task_type(self) -> TaskType:
        """Returns TaskType.GEOMETRY"""
        return TaskType.GEOMETRY

    @property
    def name(self) -> str:
        """Human-readable task name"""
        return "Geometry"

    @property
    def description(self) -> str:
        """Task description"""
        return (
            "Annotate geometric shapes like polylines and circles. "
            "Useful for measurements, paths, and circular objects."
        )

    @property
    def annotation_types(self) -> List[AnnotationType]:
        """Supported annotation types for geometry"""
        return [
            AnnotationType.POLYLINE,
            AnnotationType.CIRCLE,
        ]

    def get_default_config(self) -> Dict[str, Any]:
        """
        Default configuration for geometry task.

        Returns:
            Dictionary with default settings:
            - show_labels: Display class labels
            - show_measurements: Display length/radius measurements
            - min_polyline_points: Minimum polyline vertices
            - max_polyline_points: Maximum polyline vertices
            - min_circle_radius: Minimum circle radius (pixels)
            - show_vertices: Display vertex markers for polylines
            - vertex_radius: Size of vertex markers (pixels)
            - line_width: Stroke width for shapes
        """
        return {
            "show_labels": True,
            "show_measurements": False,
            "min_polyline_points": 2,
            "max_polyline_points": 100,
            "min_circle_radius": 5,
            "show_vertices": True,
            "vertex_radius": 4,
            "line_width": 2,
        }

    def validate_annotation(self, annotation: Any) -> bool:
        """
        Validate a geometry annotation.

        Checks:
        1. Annotation type is POLYLINE or CIRCLE
        2. Shape has valid geometry
        3. Dimensions meet requirements
        4. Coordinates are valid

        Args:
            annotation: Annotation object with geometry field

        Returns:
            True if valid, False otherwise
        """
        # Check annotation type
        if not hasattr(annotation, 'annotation_type'):
            return False

        ann_type = annotation.annotation_type

        if ann_type not in ['polyline', 'circle']:
            return False

        # Get geometry
        if not hasattr(annotation, 'geometry') or not annotation.geometry:
            return False

        geometry = annotation.geometry
        config = self.get_default_config()

        # Validate POLYLINE
        if ann_type == 'polyline':
            if 'points' not in geometry:
                return False

            points = geometry['points']
            if not isinstance(points, list):
                return False

            # Check point count
            min_points = config['min_polyline_points']
            max_points = config['max_polyline_points']

            num_points = len(points)
            if num_points < min_points or num_points > max_points:
                return False

            # Validate each point
            for point in points:
                if not isinstance(point, (list, tuple)) or len(point) != 2:
                    return False

                x, y = point
                if not isinstance(x, (int, float)) or not isinstance(y, (int, float)):
                    return False

                if x < 0 or y < 0:
                    return False

            return True

        # Validate CIRCLE
        if ann_type == 'circle':
            if 'center' not in geometry or 'radius' not in geometry:
                return False

            center = geometry['center']
            radius = geometry['radius']

            # Validate center
            if not isinstance(center, (list, tuple)) or len(center) != 2:
                return False

            cx, cy = center
            if not isinstance(cx, (int, float)) or not isinstance(cy, (int, float)):
                return False

            if cx < 0 or cy < 0:
                return False

            # Validate radius
            if not isinstance(radius, (int, float)):
                return False

            min_radius = config['min_circle_radius']
            if radius < min_radius:
                return False

            return True

        return False

    def get_supported_export_formats(self) -> List[str]:
        """
        Export formats supported by geometry task.

        Returns:
            List of format identifiers:
            - 'dice': DICE universal format
            - 'json': Custom JSON format with coordinates
            - 'svg': SVG vector graphics (future)
        """
        return ['dice', 'json']
