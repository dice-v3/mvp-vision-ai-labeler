"""
Classification Task Definition

Image-level classification task for assigning class labels to entire images.

Supported annotation types:
- CLASSIFICATION: Single or multi-label image classification
- NO_OBJECT: Special marker for "no object present" or negative examples

Export formats:
- DICE: Universal format with image-level labels
- CSV: Simple CSV format (image_id, class_id, class_name)
- JSON: Custom JSON format

Validation rules:
- Must have at least one class label (or no_object marker)
- Class ID must exist in project's class definitions
- No geometric constraints (image-level labels)
"""

from typing import List, Dict, Any
from .base import TaskDefinition, TaskType, AnnotationType


class ClassificationTask(TaskDefinition):
    """
    Classification task definition.

    This task type handles image-level classification labels.

    Common use cases:
    - Single-label classification (one class per image)
    - Multi-label classification (multiple classes per image)
    - Quality assessment (good/bad, pass/fail)
    - Presence/absence detection
    """

    @property
    def task_type(self) -> TaskType:
        """Returns TaskType.CLASSIFICATION"""
        return TaskType.CLASSIFICATION

    @property
    def name(self) -> str:
        """Human-readable task name"""
        return "Classification"

    @property
    def description(self) -> str:
        """Task description"""
        return (
            "Assign class labels to entire images. "
            "Supports single-label and multi-label classification."
        )

    @property
    def annotation_types(self) -> List[AnnotationType]:
        """Supported annotation types for classification"""
        return [
            AnnotationType.CLASSIFICATION,
            AnnotationType.NO_OBJECT,
        ]

    def get_default_config(self) -> Dict[str, Any]:
        """
        Default configuration for classification task.

        Returns:
            Dictionary with default settings:
            - multi_label: Allow multiple labels per image
            - allow_no_object: Allow "no object" marker
            - require_confirmation: Require explicit confirmation
            - show_image_preview: Show image preview in label selector
        """
        return {
            "multi_label": False,
            "allow_no_object": True,
            "require_confirmation": True,
            "show_image_preview": True,
        }

    def validate_annotation(self, annotation: Any) -> bool:
        """
        Validate a classification annotation.

        Checks:
        1. Annotation type is CLASSIFICATION or NO_OBJECT
        2. Has required fields (class_id or no_object marker)
        3. No geometric data required

        Args:
            annotation: Annotation object

        Returns:
            True if valid, False otherwise
        """
        # Check annotation type
        if not hasattr(annotation, 'annotation_type'):
            return False

        ann_type = annotation.annotation_type

        if ann_type not in ['classification', 'no_object']:
            return False

        # For CLASSIFICATION: must have class_id
        if ann_type == 'classification':
            if not hasattr(annotation, 'class_id') or not annotation.class_id:
                return False

        # For NO_OBJECT: must have task_type in attributes
        if ann_type == 'no_object':
            if not hasattr(annotation, 'attributes') or not annotation.attributes:
                return False

            if 'task_type' not in annotation.attributes:
                return False

            if annotation.attributes['task_type'] != 'classification':
                return False

        return True

    def get_supported_export_formats(self) -> List[str]:
        """
        Export formats supported by classification task.

        Returns:
            List of format identifiers:
            - 'dice': DICE universal format
            - 'csv': Simple CSV format (image_id, class_name)
            - 'json': Custom JSON format
        """
        return ['dice', 'csv', 'json']
