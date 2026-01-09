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


def serialize_text_labels_by_type(text_labels: List[TextLabel]) -> Dict[str, Any]:
    """
    Serialize TextLabel objects into type-separated sections.

    Follows COCO/DICE export format structure with separate sections for:
    - captions: Image-level captions and descriptions
    - region_descriptions: Region-level text annotations
    - vqa: Visual Question Answering pairs

    Args:
        text_labels: List of TextLabel model instances

    Returns:
        Dictionary with separated sections: {captions: [...], region_descriptions: [...], vqa: [...]}

    Note:
        With Keycloak authentication, user info is obtained from tokens.
        The labeled_by field uses user_id directly (Keycloak UUID).
    """
    captions = []
    region_descriptions = []
    vqa = []

    caption_id = 1
    region_desc_id = 1
    vqa_id = 1

    for label in text_labels:
        # Build metadata (DICE annotation format)
        # Note: With Keycloak, labeled_by stores user_id (UUID string)
        metadata = {
            "labeled_by": label.created_by,  # Keycloak user ID
            "labeled_at": to_kst_isoformat(label.created_at) if label.created_at else None,
            "source": "platform_labeler_v1.0"
        }

        # Merge with additional_metadata if exists
        if hasattr(label, 'additional_metadata') and label.additional_metadata:
            metadata.update(label.additional_metadata)

        # Image-level labels (caption, description, VQA)
        if label.annotation_id is None:
            if label.label_type in ["caption", "description"]:
                captions.append({
                    "id": caption_id,
                    "image_id": label.image_id,
                    "caption": label.text_content,
                    "label_type": label.label_type,
                    "language": label.language,
                    "confidence": label.confidence,
                    "metadata": metadata,
                })
                caption_id += 1
            elif label.label_type == "qa" and label.question:
                vqa.append({
                    "id": vqa_id,
                    "image_id": label.image_id,
                    "question": label.question,
                    "answer": label.text_content,
                    "language": label.language,
                    "confidence": label.confidence,
                    "metadata": metadata,
                })
                vqa_id += 1
        # Region-level labels
        else:
            region_descriptions.append({
                "id": region_desc_id,
                "image_id": label.image_id,
                "annotation_id": label.annotation_id,
                "phrase": label.text_content,
                "language": label.language,
                "confidence": label.confidence,
                "metadata": metadata,
            })
            region_desc_id += 1

    return {
        "captions": captions,
        "region_descriptions": region_descriptions,
        "vqa": vqa,
    }


def calculate_label_counts(text_labels_by_type: Dict[str, Any]) -> Tuple[int, int, int]:
    """
    Calculate counts for image-level and region-level labels.

    Args:
        text_labels_by_type: Dictionary with separated sections {captions, region_descriptions, vqa}

    Returns:
        Tuple of (total_count, image_level_count, region_level_count)
    """
    caption_count = len(text_labels_by_type.get("captions", []))
    vqa_count = len(text_labels_by_type.get("vqa", []))
    region_count = len(text_labels_by_type.get("region_descriptions", []))

    image_level_count = caption_count + vqa_count
    total_count = image_level_count + region_count

    return total_count, image_level_count, region_count


def publish_text_labels(
    labeler_db: Session,
    project_id: str,
    version: str,
    user_id: str,
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
        user_id: User ID who is publishing (Keycloak UUID)
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

    # 3. Serialize to JSON snapshot (type-separated structure)
    text_labels_snapshot = serialize_text_labels_by_type(text_labels)

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
    text_labels_snapshot: Dict[str, Any],
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
        text_labels_snapshot: Type-separated text labels {captions, region_descriptions, vqa}

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

    # Calculate statistics
    caption_count = len(text_labels_snapshot.get("captions", []))
    region_count = len(text_labels_snapshot.get("region_descriptions", []))
    vqa_count = len(text_labels_snapshot.get("vqa", []))
    total_count = caption_count + region_count + vqa_count

    # Prepare JSON content with DICE-compatible header and type-separated structure
    json_data = {
        "format_version": "1.0",
        "dataset_id": project.dataset_id,
        "dataset_name": dataset.name if dataset else project.name,
        "created_at": to_kst_isoformat(project.created_at) if project.created_at else to_kst_isoformat(datetime.utcnow()),
        "last_modified_at": to_kst_isoformat(datetime.utcnow()),
        "version": version,
        "storage_info": storage_info,
    }

    # Add type-separated sections
    if text_labels_snapshot.get("captions"):
        json_data["captions"] = text_labels_snapshot["captions"]
    if text_labels_snapshot.get("region_descriptions"):
        json_data["region_descriptions"] = text_labels_snapshot["region_descriptions"]
    if text_labels_snapshot.get("vqa"):
        json_data["vqa"] = text_labels_snapshot["vqa"]

    # Add statistics
    json_data["statistics"] = {
        "total_count": total_count,
        "caption_count": caption_count,
        "region_description_count": region_count,
        "vqa_count": vqa_count,
    }

    json_content = json.dumps(json_data, ensure_ascii=False, indent=2)

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
