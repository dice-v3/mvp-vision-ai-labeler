"""Annotation Import Service

Imports annotations from DICE format to Labeler DB.
"""

import logging
from typing import Dict, List
from datetime import datetime
from sqlalchemy.orm import Session

from app.db.models.labeler import Annotation, ImageAnnotationStatus
from app.db.models.platform import User

logger = logging.getLogger(__name__)


class ImportResult:
    """Result of annotation import operation."""

    def __init__(self, count: int = 0, errors: List[str] = None):
        self.count = count
        self.errors = errors or []


def import_annotations_to_db(
    labeler_db: Session,
    project_id: str,
    annotations_data: Dict,
    current_user: User
) -> ImportResult:
    """
    Import annotations from DICE format to Labeler DB.

    Args:
        labeler_db: Labeler database session
        project_id: Project ID
        annotations_data: DICE format annotation data
        current_user: Current user

    Returns:
        ImportResult with count and any errors
    """
    # Map image file_name to image_id
    image_mapping = {}
    for img in annotations_data.get('images', []):
        # Use file path as image_id (consistent with storage)
        file_path = img['file_name']
        image_mapping[str(img['id'])] = file_path

    imported_count = 0
    errors = []

    # Import annotations
    for ann_data in annotations_data.get('annotations', []):
        try:
            # Get image_id from mapping
            image_id_key = str(ann_data['image_id'])
            if image_id_key not in image_mapping:
                errors.append(f"Image ID {image_id_key} not found in mapping")
                continue

            image_id = image_mapping[image_id_key]

            # Determine annotation type
            annotation_type = 'bbox'
            geometry = {}

            if 'bbox' in ann_data:
                # Bounding box annotation
                bbox = ann_data['bbox']
                geometry = {
                    'x': bbox[0],
                    'y': bbox[1],
                    'width': bbox[2],
                    'height': bbox[3],
                }
                annotation_type = 'bbox'

            elif 'segmentation' in ann_data:
                # Polygon/segmentation annotation
                segmentation = ann_data['segmentation']
                if isinstance(segmentation, list) and len(segmentation) > 0:
                    # Convert to our format: list of [x, y] points
                    points = []
                    seg_data = segmentation[0]  # Take first polygon
                    for i in range(0, len(seg_data), 2):
                        if i + 1 < len(seg_data):
                            points.append([seg_data[i], seg_data[i + 1]])

                    geometry = {'points': points}
                    annotation_type = 'polygon'

            # Create annotation
            annotation = Annotation(
                project_id=project_id,
                image_id=image_id,
                class_id=str(ann_data['category_id']),
                annotation_type=annotation_type,
                geometry=geometry,
                annotation_state='confirmed',
                created_by=current_user["sub"],
                confirmed_by=current_user["sub"],
                confirmed_at=datetime.utcnow(),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )

            labeler_db.add(annotation)
            imported_count += 1

        except Exception as e:
            error_msg = f"Failed to import annotation {ann_data.get('id', 'unknown')}: {str(e)}"
            logger.error(error_msg)
            errors.append(error_msg)

    # Commit all annotations
    try:
        labeler_db.commit()
        logger.info(f"Imported {imported_count} annotations to project {project_id}")
    except Exception as e:
        labeler_db.rollback()
        logger.error(f"Failed to commit annotations: {e}")
        raise

    return ImportResult(count=imported_count, errors=errors)


def update_image_status(
    labeler_db: Session,
    project_id: str,
    image_ids: List[str],
    status: str = 'completed'
):
    """
    Update image annotation status after import.

    Args:
        labeler_db: Labeler database session
        project_id: Project ID
        image_ids: List of image IDs
        status: Status to set (default: 'completed')
    """
    for image_id in image_ids:
        # Check if status exists
        img_status = labeler_db.query(ImageAnnotationStatus).filter(
            ImageAnnotationStatus.project_id == project_id,
            ImageAnnotationStatus.image_id == image_id
        ).first()

        if img_status:
            # Update existing
            img_status.status = status
            img_status.updated_at = datetime.utcnow()
        else:
            # Create new
            img_status = ImageAnnotationStatus(
                project_id=project_id,
                image_id=image_id,
                status=status,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            labeler_db.add(img_status)

    labeler_db.commit()
    logger.info(f"Updated status for {len(image_ids)} images to {status}")
