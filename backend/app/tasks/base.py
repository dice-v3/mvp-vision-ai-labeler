"""
Task Type System - Base Definitions

This module defines the core abstractions for the task type system:
- TaskType and AnnotationType enums for type safety
- TaskDefinition abstract base class
- Base interfaces for exporters and validators

Architecture:
    All task types inherit from TaskDefinition and implement:
    - task_type: Unique identifier (TaskType enum)
    - name: Human-readable name
    - annotation_types: List of supported annotation types
    - get_default_config(): Default task configuration
    - validate_annotation(): Task-specific validation rules
    - get_exporter(): Get exporter for format

Usage:
    from app.tasks.base import TaskType, AnnotationType, TaskDefinition

    class DetectionTask(TaskDefinition):
        @property
        def task_type(self) -> TaskType:
            return TaskType.DETECTION
        # ... implement other abstract methods
"""

from abc import ABC, abstractmethod
from enum import Enum
from typing import List, Dict, Any, Optional


class TaskType(str, Enum):
    """
    Centralized task type enumeration.

    This enum defines all supported task types in the system.
    Using an enum ensures:
    - Type safety (no typos)
    - IDE autocomplete
    - Compile-time validation
    - Single source of truth

    Values:
        CLASSIFICATION: Image-level classification tasks
        DETECTION: Object detection with bounding boxes
        SEGMENTATION: Pixel-level segmentation with polygons
        GEOMETRY: Geometric shapes (polylines, circles)
        KEYPOINT: Keypoint/landmark detection
        LINE: Line annotation tasks
    """
    CLASSIFICATION = "classification"
    DETECTION = "detection"
    SEGMENTATION = "segmentation"
    GEOMETRY = "geometry"
    KEYPOINT = "keypoint"
    LINE = "line"


class AnnotationType(str, Enum):
    """
    Centralized annotation type enumeration.

    This enum defines all supported annotation types.
    Each annotation type belongs to one or more task types.

    Values:
        CLASSIFICATION: Image-level class label
        BBOX: Axis-aligned bounding box [x, y, w, h]
        ROTATED_BBOX: Rotated bounding box
        POLYGON: Multi-point polygon for segmentation
        POLYLINE: Multi-point line (geometry task)
        CIRCLE: Circle defined by center and radius
        KEYPOINT: Single point or skeleton
        LINE: Simple line between two points
        NO_OBJECT: Special marker for "no object present"
    """
    CLASSIFICATION = "classification"
    BBOX = "bbox"
    ROTATED_BBOX = "rotated_bbox"
    POLYGON = "polygon"
    POLYLINE = "polyline"
    CIRCLE = "circle"
    KEYPOINT = "keypoint"
    LINE = "line"
    NO_OBJECT = "no_object"


class TaskDefinition(ABC):
    """
    Abstract base class for all task type definitions.

    Each concrete task (Detection, Segmentation, etc.) must inherit from
    this class and implement all abstract methods.

    This design follows the Open/Closed Principle:
    - Open for extension (add new tasks by subclassing)
    - Closed for modification (core code doesn't change)

    Example:
        class DetectionTask(TaskDefinition):
            @property
            def task_type(self) -> TaskType:
                return TaskType.DETECTION

            @property
            def name(self) -> str:
                return "Object Detection"

            @property
            def annotation_types(self) -> List[AnnotationType]:
                return [AnnotationType.BBOX, AnnotationType.ROTATED_BBOX]

            # ... implement other methods
    """

    @property
    @abstractmethod
    def task_type(self) -> TaskType:
        """
        Unique task type identifier.

        Returns:
            TaskType enum value for this task
        """
        pass

    @property
    @abstractmethod
    def name(self) -> str:
        """
        Human-readable task name.

        Returns:
            Display name for this task (e.g., "Object Detection")
        """
        pass

    @property
    @abstractmethod
    def description(self) -> str:
        """
        Task description for documentation/UI.

        Returns:
            Brief description of what this task does
        """
        pass

    @property
    @abstractmethod
    def annotation_types(self) -> List[AnnotationType]:
        """
        List of annotation types this task supports.

        Returns:
            List of AnnotationType enums this task can handle

        Example:
            Detection task returns [AnnotationType.BBOX, AnnotationType.ROTATED_BBOX]
        """
        pass

    @abstractmethod
    def get_default_config(self) -> Dict[str, Any]:
        """
        Get default configuration for this task.

        Returns:
            Dictionary of default config values

        Example:
            {
                "show_labels": True,
                "show_confidence": False,
                "min_bbox_size": 5
            }
        """
        pass

    @abstractmethod
    def validate_annotation(self, annotation: Any) -> bool:
        """
        Validate an annotation against task-specific rules.

        Args:
            annotation: Annotation object to validate

        Returns:
            True if annotation is valid for this task, False otherwise

        Example:
            For detection task, validate that bbox has minimum size,
            coordinates are within image bounds, etc.
        """
        pass

    @abstractmethod
    def get_supported_export_formats(self) -> List[str]:
        """
        Get list of export formats this task supports.

        Returns:
            List of format identifiers (e.g., ['coco', 'yolo', 'voc'])
        """
        pass

    def __str__(self) -> str:
        """String representation for debugging."""
        return f"<{self.__class__.__name__}: {self.name}>"

    def __repr__(self) -> str:
        """Detailed representation for debugging."""
        return (
            f"{self.__class__.__name__}("
            f"task_type={self.task_type.value}, "
            f"annotation_types={[at.value for at in self.annotation_types]})"
        )


# Type aliases for convenience
TaskConfigDict = Dict[str, Any]
ExportFormatList = List[str]
