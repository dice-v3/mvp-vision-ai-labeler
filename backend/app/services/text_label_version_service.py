"""
Text Label Versioning Service - Phase 19.8

Handles text label versioning and publish workflow for VLM text labeling.

Features:
- Create immutable snapshots of text labels
- Version management (auto-increment, manual)
- Dual S3 storage strategy (Internal + External)
- Rollback and history support
"""

import json
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timezone, timedelta

from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.models.labeler import TextLabel, TextLabelVersion, AnnotationProject, Dataset
from app.core.storage import storage_client
from app.core.config import settings

logger = logging.getLogger(__name__)

# Korea Standard Time (UTC+9)
KST = timezone(timedelta(hours=9))


def to_kst_isoformat(dt: Optional[datetime]) -> Optional[str]:
    """Convert datetime to KST timezone and return ISO format string."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(KST).isoformat()


def serialize_text_labels(text_labels: List[TextLabel]) -> List[Dict[str, Any]]:
    """
    Serialize TextLabel objects to JSON-compatible dictionaries.

    Args:
        text_labels: List of TextLabel model instances

    Returns:
        List of dictionaries with text label data
    """
    serialized = []

    for label in text_labels:
        serialized.append({
            "id": label.id,
            "project_id": label.project_id,
            "image_id": label.image_id,
            "annotation_id": label.annotation_id,  # NULL for image-level
            "label_type": label.label_type,
            "text_content": label.text_content,
            "question": label.question,
            "language": label.language,
            "confidence": label.confidence,
            "metadata": label.additional_metadata if hasattr(label, 'additional_metadata') else {},
            "created_by": label.created_by,
            "updated_by": label.updated_by,
            "created_at": label.created_at.isoformat() if label.created_at else None,
            "updated_at": label.updated_at.isoformat() if label.updated_at else None,
        })

    return serialized


def calculate_label_counts(text_labels: List[Dict[str, Any]]) -> Tuple[int, int, int]:
    """
    Calculate counts for image-level and region-level labels.

    Args:
        text_labels: List of serialized text label dictionaries

    Returns:
        Tuple of (total_count, image_level_count, region_level_count)
    """
    total_count = len(text_labels)
    image_level_count = sum(1 for label in text_labels if label["annotation_id"] is None)
    region_level_count = total_count - image_level_count

    return total_count, image_level_count, region_level_count


def publish_text_labels(
    labeler_db: Session,
    project_id: str,
    version: str,
    user_id: int,
    notes: Optional[str] = None,
) -> TextLabelVersion:
    """
    Publish text labels by creating an immutable version snapshot.

    This function:
    1. Queries all current text labels for the project
    2. Serializes them to JSON snapshot
    3. Calculates statistics (label counts)
    4. Creates TextLabelVersion record
    5. Uploads to S3 (both Internal and External storage)

    Args:
        labeler_db: Labeler database session
        project_id: Project ID
        version: Version number (e.g., "v1.0", "v2.0")
        user_id: User ID who is publishing
        notes: Optional publish notes

    Returns:
        Created TextLabelVersion instance

    Raises:
        ValueError: If version already exists for this project
        Exception: If S3 upload fails
    """
    logger.info(f"[TextLabelVersion] Publishing text labels for project={project_id}, version={version}")

    # 1. Check if version already exists
    existing = labeler_db.query(TextLabelVersion).filter(
        TextLabelVersion.project_id == project_id,
        TextLabelVersion.version == version,
    ).first()

    if existing:
        raise ValueError(f"Text label version {version} already exists for project {project_id}")

    # 2. Query all current text labels for project
    text_labels_query = labeler_db.query(TextLabel).filter(
        TextLabel.project_id == project_id
    ).order_by(TextLabel.created_at.asc())

    text_labels = text_labels_query.all()
    logger.info(f"[TextLabelVersion] Found {len(text_labels)} text labels to publish")

    # 3. Serialize to JSON snapshot
    text_labels_snapshot = serialize_text_labels(text_labels)

    # 4. Calculate counts for query performance
    total_count, image_level_count, region_level_count = calculate_label_counts(text_labels_snapshot)
    logger.info(
        f"[TextLabelVersion] Label counts: total={total_count}, "
        f"image_level={image_level_count}, region_level={region_level_count}"
    )

    # 5. Create version record
    version_record = TextLabelVersion(
        project_id=project_id,
        version=version,
        text_labels_snapshot=text_labels_snapshot,
        notes=notes,
        published_by=user_id,
        created_at=datetime.utcnow(),
        label_count=total_count,
        image_level_count=image_level_count,
        region_level_count=region_level_count,
    )

    labeler_db.add(version_record)
    labeler_db.commit()
    labeler_db.refresh(version_record)

    logger.info(f"[TextLabelVersion] Created version record: id={version_record.id}")

    # 6. Upload to S3 (dual storage strategy)
    try:
        _upload_to_storage(labeler_db, project_id, version, text_labels_snapshot)
    except Exception as e:
        logger.error(f"[TextLabelVersion] S3 upload failed: {e}")
        # Rollback version creation
        labeler_db.delete(version_record)
        labeler_db.commit()
        raise

    logger.info(f"[TextLabelVersion] Successfully published text labels: project={project_id}, version={version}")

    return version_record


def _upload_to_storage(
    labeler_db: Session,
    project_id: str,
    version: str,
    text_labels_snapshot: List[Dict[str, Any]],
) -> Tuple[str, str]:
    """
    Upload text labels to both Internal and External S3 storage.

    Internal Storage (Version History):
    - Bucket: annotations
    - Key: exports/{project_id}/text_labels/{version}/text_labels.json
    - Retention: All versions forever
    - Purpose: Version history, rollback, audit

    External Storage (Trainer Access):
    - Bucket: training-datasets
    - Key: datasets/{dataset_id}/text_labels.json
    - Location: Same level as annotations_detection.json
    - Retention: Latest version only (overwrite)
    - Purpose: Training data consumption

    Args:
        labeler_db: Labeler database session
        project_id: Project ID
        version: Version number
        text_labels_snapshot: Serialized text labels

    Returns:
        Tuple of (internal_s3_key, external_s3_key)

    Raises:
        Exception: If upload fails
    """
    # Get project and dataset for header information
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).first()

    if not project:
        raise ValueError(f"Project {project_id} not found")

    dataset = labeler_db.query(Dataset).filter(
        Dataset.id == project.dataset_id
    ).first()

    # Build storage_info (same as DICE format)
    storage_info = {
        "storage_type": dataset.storage_type if dataset else "s3",
        "bucket": settings.S3_BUCKET_DATASETS,
        "image_root": f"{dataset.storage_path}images/" if dataset and dataset.storage_path else f"datasets/{project.dataset_id}/images/",
    }

    # Prepare JSON content with DICE-compatible header
    json_content = json.dumps(
        {
            "format_version": "1.0",
            "dataset_id": project.dataset_id,
            "dataset_name": dataset.name if dataset else project.name,
            "created_at": to_kst_isoformat(project.created_at) if project.created_at else to_kst_isoformat(datetime.utcnow()),
            "last_modified_at": to_kst_isoformat(datetime.utcnow()),
            "version": version,
            "storage_info": storage_info,
            "label_count": len(text_labels_snapshot),
            "text_labels": text_labels_snapshot,
        },
        ensure_ascii=False,
        indent=2,
    )

    # 1. Upload to Internal Storage (versioned)
    # Follow detection annotation path structure: exports/{project_id}/{task_type}/{version}/
    # For text labels, use "text_labels" as the task_type equivalent
    internal_key = f"exports/{project_id}/text_labels/{version}/text_labels.json"

    try:
        storage_client.s3_client.put_object(
            Bucket=storage_client.annotations_bucket,
            Key=internal_key,
            Body=json_content.encode('utf-8'),
            ContentType='application/json',
            Metadata={
                'project_id': project_id,
                'version': version,
                'uploaded_at': datetime.utcnow().isoformat()
            }
        )
        logger.info(f"[TextLabelVersion] Uploaded to Internal S3: {internal_key}")
    except Exception as e:
        logger.error(f"[TextLabelVersion] Failed to upload to Internal S3: {e}")
        raise

    # 2. Upload to External Storage (same level as annotations_detection.json)
    # Use dataset_id from project (already queried above)
    external_key = f"datasets/{project.dataset_id}/text_labels.json"

    try:
        storage_client.s3_client.put_object(
            Bucket=storage_client.datasets_bucket,
            Key=external_key,
            Body=json_content.encode('utf-8'),
            ContentType='application/json',
            Metadata={
                'project_id': project_id,
                'dataset_id': project.dataset_id,
                'version': version,
                'uploaded_at': datetime.utcnow().isoformat()
            }
        )
        logger.info(f"[TextLabelVersion] Uploaded to External S3: {external_key} (dataset_id={project.dataset_id})")
    except Exception as e:
        logger.error(f"[TextLabelVersion] Failed to upload to External S3: {e}")
        # Re-raise to catch the actual error
        raise

    return internal_key, external_key


def get_latest_version(labeler_db: Session, project_id: str) -> Optional[TextLabelVersion]:
    """
    Get the latest published text label version for a project.

    Args:
        labeler_db: Labeler database session
        project_id: Project ID

    Returns:
        Latest TextLabelVersion or None if no versions exist
    """
    return labeler_db.query(TextLabelVersion).filter(
        TextLabelVersion.project_id == project_id
    ).order_by(desc(TextLabelVersion.created_at)).first()


def get_version_by_number(
    labeler_db: Session,
    project_id: str,
    version: str,
) -> Optional[TextLabelVersion]:
    """
    Get a specific text label version by version number.

    Args:
        labeler_db: Labeler database session
        project_id: Project ID
        version: Version number (e.g., "v1.0")

    Returns:
        TextLabelVersion or None if not found
    """
    return labeler_db.query(TextLabelVersion).filter(
        TextLabelVersion.project_id == project_id,
        TextLabelVersion.version == version,
    ).first()


def list_versions(labeler_db: Session, project_id: str) -> List[TextLabelVersion]:
    """
    List all text label versions for a project, ordered by creation date (newest first).

    Args:
        labeler_db: Labeler database session
        project_id: Project ID

    Returns:
        List of TextLabelVersion instances
    """
    return labeler_db.query(TextLabelVersion).filter(
        TextLabelVersion.project_id == project_id
    ).order_by(desc(TextLabelVersion.created_at)).all()


def auto_generate_version_number(labeler_db: Session, project_id: str) -> str:
    """
    Auto-generate next version number for a project.

    Follows pattern: v1.0, v2.0, v3.0, ...

    Args:
        labeler_db: Labeler database session
        project_id: Project ID

    Returns:
        Next version number (e.g., "v2.0")
    """
    latest = get_latest_version(labeler_db, project_id)

    if not latest:
        return "v1.0"

    # Extract version number from "vX.0" format
    try:
        current_version = latest.version
        # Parse "v1.0" -> 1
        major_version = int(current_version.replace("v", "").split(".")[0])
        next_version = f"v{major_version + 1}.0"
        return next_version
    except Exception as e:
        logger.warning(f"Failed to parse version number: {e}. Defaulting to v1.0")
        return "v1.0"
