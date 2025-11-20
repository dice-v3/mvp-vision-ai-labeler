"""
Task Type System - Phase 1

This module implements a plugin-based architecture for task types.

Architecture:
- TaskType and AnnotationType enums for type safety
- TaskDefinition abstract base class
- TaskRegistry singleton for centralized management
- Concrete task implementations (Detection, Segmentation, etc.)

Usage:
    from app.tasks import TaskType, task_registry

    # Get task definition
    task = task_registry.get(TaskType.DETECTION)

    # Get annotation types for task
    ann_types = task_registry.get_annotation_types_for_task(TaskType.DETECTION)

    # Reverse lookup: annotation type -> task type
    task_type = task_registry.get_task_for_annotation_type(AnnotationType.BBOX)
"""

# This file will be populated during Phase 1 implementation
# TODO: Import and export TaskType, AnnotationType, TaskRegistry, etc.
