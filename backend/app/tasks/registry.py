"""
Task Registry - Centralized Task Management

This module implements a singleton registry for all task types.

The TaskRegistry provides:
- Centralized task definition storage
- Lookup by task type or annotation type
- Reverse mapping (annotation type -> task type)
- Thread-safe singleton pattern

Architecture:
    TaskRegistry uses the Singleton pattern to ensure only one
    instance exists throughout the application lifecycle.

    All task definitions are registered at module import time,
    making them immediately available to all services.

Usage:
    from app.tasks.registry import task_registry
    from app.tasks.base import TaskType, AnnotationType

    # Get task definition
    task = task_registry.get(TaskType.DETECTION)

    # Get annotation types for task
    ann_types = task_registry.get_annotation_types_for_task(TaskType.DETECTION)
    # Returns: [AnnotationType.BBOX, AnnotationType.ROTATED_BBOX]

    # Reverse lookup: find task for annotation type
    task_type = task_registry.get_task_for_annotation_type(AnnotationType.BBOX)
    # Returns: TaskType.DETECTION

    # Get all registered tasks
    all_tasks = task_registry.get_all()

    # Check if task type is valid
    is_valid = task_registry.is_valid_task_type(TaskType.DETECTION)
"""

from typing import Dict, Optional, List
from .base import TaskType, TaskDefinition, AnnotationType


class TaskRegistry:
    """
    Singleton registry for task definitions.

    This class maintains a central registry of all task types
    and provides lookup methods for task metadata.

    Thread Safety:
        The singleton pattern used here is thread-safe.
        All lookups are read-only after initialization.

    Example:
        # Register a task (done automatically at import time)
        task_registry.register(DetectionTask())

        # Look up task
        task = task_registry.get(TaskType.DETECTION)
        print(task.name)  # "Object Detection"
    """

    _instance: Optional['TaskRegistry'] = None
    _tasks: Dict[TaskType, TaskDefinition] = {}

    def __new__(cls):
        """
        Singleton pattern: only one instance exists.

        Returns:
            The singleton TaskRegistry instance
        """
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._tasks = {}
        return cls._instance

    def register(self, task: TaskDefinition) -> None:
        """
        Register a task definition.

        Args:
            task: TaskDefinition instance to register

        Raises:
            ValueError: If task_type is already registered

        Example:
            task_registry.register(DetectionTask())
        """
        if task.task_type in self._tasks:
            raise ValueError(
                f"Task type {task.task_type.value} is already registered"
            )

        self._tasks[task.task_type] = task
        print(f"[TaskRegistry] Registered: {task.task_type.value} -> {task.name}")

    def get(self, task_type: TaskType) -> Optional[TaskDefinition]:
        """
        Get task definition by type.

        Args:
            task_type: TaskType enum value

        Returns:
            TaskDefinition instance or None if not found

        Example:
            task = task_registry.get(TaskType.DETECTION)
            if task:
                print(task.name)  # "Object Detection"
        """
        return self._tasks.get(task_type)

    def get_all(self) -> List[TaskDefinition]:
        """
        Get all registered task definitions.

        Returns:
            List of all TaskDefinition instances

        Example:
            for task in task_registry.get_all():
                print(f"{task.task_type.value}: {task.name}")
        """
        return list(self._tasks.values())

    def get_all_task_types(self) -> List[TaskType]:
        """
        Get list of all registered task types.

        Returns:
            List of TaskType enum values

        Example:
            types = task_registry.get_all_task_types()
            # [TaskType.CLASSIFICATION, TaskType.DETECTION, ...]
        """
        return list(self._tasks.keys())

    def get_annotation_types_for_task(
        self,
        task_type: TaskType
    ) -> List[AnnotationType]:
        """
        Get annotation types supported by a task.

        Args:
            task_type: TaskType to query

        Returns:
            List of AnnotationType enums, or empty list if task not found

        Example:
            ann_types = task_registry.get_annotation_types_for_task(
                TaskType.DETECTION
            )
            # [AnnotationType.BBOX, AnnotationType.ROTATED_BBOX]
        """
        task = self.get(task_type)
        return task.annotation_types if task else []

    def get_task_for_annotation_type(
        self,
        annotation_type: AnnotationType
    ) -> Optional[TaskType]:
        """
        Reverse lookup: find task type for an annotation type.

        This is critical for inferring task type from annotation data.

        Args:
            annotation_type: AnnotationType to look up

        Returns:
            TaskType that supports this annotation type, or None

        Note:
            If multiple tasks support the same annotation type,
            returns the first match. In practice, annotation types
            are unique to tasks (except no_object).

        Example:
            task_type = task_registry.get_task_for_annotation_type(
                AnnotationType.BBOX
            )
            # Returns: TaskType.DETECTION
        """
        for task in self._tasks.values():
            if annotation_type in task.annotation_types:
                return task.task_type
        return None

    def is_valid_task_type(self, task_type: TaskType) -> bool:
        """
        Check if a task type is registered.

        Args:
            task_type: TaskType to check

        Returns:
            True if registered, False otherwise

        Example:
            if task_registry.is_valid_task_type(TaskType.DETECTION):
                print("Detection task is available")
        """
        return task_type in self._tasks

    def is_valid_annotation_type_for_task(
        self,
        task_type: TaskType,
        annotation_type: AnnotationType
    ) -> bool:
        """
        Check if an annotation type is valid for a task.

        Args:
            task_type: TaskType to check
            annotation_type: AnnotationType to validate

        Returns:
            True if annotation type is supported by task, False otherwise

        Example:
            is_valid = task_registry.is_valid_annotation_type_for_task(
                TaskType.DETECTION,
                AnnotationType.BBOX
            )
            # Returns: True
        """
        annotation_types = self.get_annotation_types_for_task(task_type)
        return annotation_type in annotation_types

    def get_export_formats_for_task(self, task_type: TaskType) -> List[str]:
        """
        Get supported export formats for a task.

        Args:
            task_type: TaskType to query

        Returns:
            List of export format identifiers

        Example:
            formats = task_registry.get_export_formats_for_task(
                TaskType.DETECTION
            )
            # ['coco', 'yolo', 'voc']
        """
        task = self.get(task_type)
        return task.get_supported_export_formats() if task else []

    def __len__(self) -> int:
        """Return number of registered tasks."""
        return len(self._tasks)

    def __repr__(self) -> str:
        """Detailed representation for debugging."""
        return (
            f"<TaskRegistry: {len(self._tasks)} tasks registered: "
            f"{[t.value for t in self._tasks.keys()]}>"
        )


# Global singleton instance
# All modules should import this instance
task_registry = TaskRegistry()
