"""
Task Type System

This module implements a plugin-based architecture for task types.

Architecture:
- TaskType and AnnotationType enums for type safety
- TaskDefinition abstract base class
- TaskRegistry singleton for centralized management
- Concrete task implementations (Detection, Segmentation, Classification, Geometry)

Usage:
    from app.tasks import TaskType, AnnotationType, task_registry

    # Get task definition
    task = task_registry.get(TaskType.DETECTION)

    # Get annotation types for task
    ann_types = task_registry.get_annotation_types_for_task(TaskType.DETECTION)
    # Returns: [AnnotationType.BBOX, AnnotationType.ROTATED_BBOX]

    # Reverse lookup: annotation type -> task type
    task_type = task_registry.get_task_for_annotation_type(AnnotationType.BBOX)
    # Returns: TaskType.DETECTION

    # Get all registered tasks
    all_tasks = task_registry.get_all()

    # Validate task type
    is_valid = task_registry.is_valid_task_type(TaskType.DETECTION)
"""

# Import base classes and enums
from .base import (
    TaskType,
    AnnotationType,
    TaskDefinition,
    TaskConfigDict,
    ExportFormatList,
)

# Import registry
from .registry import TaskRegistry, task_registry

# Import concrete task implementations
from .detection import DetectionTask
from .segmentation import SegmentationTask
from .classification import ClassificationTask
from .geometry import GeometryTask


# Auto-register all tasks at module import time
def _register_all_tasks():
    """
    Register all task definitions with the registry.

    This function is called automatically when the module is imported.
    It ensures all task types are available immediately.
    """
    try:
        task_registry.register(ClassificationTask())
        task_registry.register(DetectionTask())
        task_registry.register(SegmentationTask())
        task_registry.register(GeometryTask())

        print(f"[Tasks] Successfully registered {len(task_registry)} task types")

    except Exception as e:
        print(f"[Tasks] ERROR: Failed to register tasks: {e}")
        raise


# Register tasks on module import
_register_all_tasks()


# Public API
__all__ = [
    # Enums
    'TaskType',
    'AnnotationType',

    # Base classes
    'TaskDefinition',
    'TaskConfigDict',
    'ExportFormatList',

    # Registry
    'TaskRegistry',
    'task_registry',

    # Concrete implementations
    'DetectionTask',
    'SegmentationTask',
    'ClassificationTask',
    'GeometryTask',
]
