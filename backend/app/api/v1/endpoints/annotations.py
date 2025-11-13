"""Annotation endpoints."""

from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import select, func, distinct

from app.core.database import get_platform_db, get_labeler_db
from app.core.security import get_current_user
from app.db.models.platform import User
from app.db.models.labeler import Annotation, AnnotationHistory, AnnotationProject
from app.schemas.annotation import (
    AnnotationCreate,
    AnnotationUpdate,
    AnnotationResponse,
    AnnotationHistoryResponse,
    AnnotationBatchCreate,
    AnnotationBatchResponse,
)

router = APIRouter()


async def create_history_entry(
    db: Session,
    annotation_id: int,
    project_id: str,
    action: str,
    previous_state: dict = None,
    new_state: dict = None,
    changed_by: int = None,
):
    """Create annotation history entry."""
    history = AnnotationHistory(
        annotation_id=annotation_id,
        project_id=project_id,
        action=action,
        previous_state=previous_state,
        new_state=new_state,
        changed_by=changed_by,
        timestamp=datetime.utcnow(),
    )
    db.add(history)
    db.flush()
    return history


async def update_project_stats(
    db: Session,
    project_id: str,
    user_id: int,
):
    """Update project statistics after annotation changes."""
    project = db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).first()

    if not project:
        return

    # Count total annotations
    total_annotations = db.query(func.count(Annotation.id)).filter(
        Annotation.project_id == project_id
    ).scalar()

    # Count unique annotated images
    annotated_images = db.query(func.count(distinct(Annotation.image_id))).filter(
        Annotation.project_id == project_id
    ).scalar()

    # Update project
    project.total_annotations = total_annotations
    project.annotated_images = annotated_images
    project.last_updated_by = user_id
    project.updated_at = datetime.utcnow()

    db.flush()


@router.post("", response_model=AnnotationResponse, tags=["Annotations"])
async def create_annotation(
    annotation: AnnotationCreate,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create new annotation.

    - **project_id**: Project ID
    - **image_id**: Image ID
    - **annotation_type**: Type of annotation (classification, bbox, etc.)
    - **geometry**: Geometry data (flexible JSONB)
    - **class_id**: Class ID (optional)
    - **class_name**: Class name (optional)
    - **attributes**: Additional attributes (optional)
    - **confidence**: Confidence score 0-100 (optional)
    - **notes**: Notes (optional)
    """
    # Verify project exists
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == annotation.project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {annotation.project_id} not found",
        )

    # Create annotation
    new_annotation = Annotation(
        project_id=annotation.project_id,
        image_id=annotation.image_id,
        annotation_type=annotation.annotation_type,
        geometry=annotation.geometry,
        class_id=annotation.class_id,
        class_name=annotation.class_name,
        attributes=annotation.attributes or {},
        confidence=annotation.confidence,
        notes=annotation.notes,
        created_by=current_user.id,
        is_verified=False,
    )

    labeler_db.add(new_annotation)
    labeler_db.flush()

    # Create history entry
    await create_history_entry(
        db=labeler_db,
        annotation_id=new_annotation.id,
        project_id=annotation.project_id,
        action="create",
        new_state={
            "annotation_type": annotation.annotation_type,
            "geometry": annotation.geometry,
            "class_id": annotation.class_id,
            "class_name": annotation.class_name,
        },
        changed_by=current_user.id,
    )

    # Update project stats
    await update_project_stats(
        db=labeler_db,
        project_id=annotation.project_id,
        user_id=current_user.id,
    )

    labeler_db.commit()
    labeler_db.refresh(new_annotation)

    # Add user info
    response_dict = {
        **new_annotation.__dict__,
        "created_by_name": current_user.full_name,
    }

    return AnnotationResponse.model_validate(response_dict)


@router.get("/{annotation_id}", response_model=AnnotationResponse, tags=["Annotations"])
async def get_annotation(
    annotation_id: int,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """Get annotation by ID."""
    annotation = labeler_db.query(Annotation).filter(
        Annotation.id == annotation_id
    ).first()

    if not annotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Annotation {annotation_id} not found",
        )

    # Fetch user info
    created_by_name = None
    updated_by_name = None

    if annotation.created_by:
        user = platform_db.query(User).filter(User.id == annotation.created_by).first()
        if user:
            created_by_name = user.full_name

    if annotation.updated_by:
        user = platform_db.query(User).filter(User.id == annotation.updated_by).first()
        if user:
            updated_by_name = user.full_name

    response_dict = {
        **annotation.__dict__,
        "created_by_name": created_by_name,
        "updated_by_name": updated_by_name,
    }

    return AnnotationResponse.model_validate(response_dict)


@router.put("/{annotation_id}", response_model=AnnotationResponse, tags=["Annotations"])
async def update_annotation(
    annotation_id: int,
    update_data: AnnotationUpdate,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """Update annotation."""
    annotation = labeler_db.query(Annotation).filter(
        Annotation.id == annotation_id
    ).first()

    if not annotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Annotation {annotation_id} not found",
        )

    # Store previous state
    previous_state = {
        "geometry": annotation.geometry,
        "class_id": annotation.class_id,
        "class_name": annotation.class_name,
        "attributes": annotation.attributes,
        "confidence": annotation.confidence,
        "is_verified": annotation.is_verified,
        "notes": annotation.notes,
    }

    # Update fields
    update_dict = update_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(annotation, key, value)

    annotation.updated_by = current_user.id
    annotation.updated_at = datetime.utcnow()

    # Store new state
    new_state = {
        "geometry": annotation.geometry,
        "class_id": annotation.class_id,
        "class_name": annotation.class_name,
        "attributes": annotation.attributes,
        "confidence": annotation.confidence,
        "is_verified": annotation.is_verified,
        "notes": annotation.notes,
    }

    # Create history entry
    await create_history_entry(
        db=labeler_db,
        annotation_id=annotation_id,
        project_id=annotation.project_id,
        action="update",
        previous_state=previous_state,
        new_state=new_state,
        changed_by=current_user.id,
    )

    # Update project stats
    await update_project_stats(
        db=labeler_db,
        project_id=annotation.project_id,
        user_id=current_user.id,
    )

    labeler_db.commit()
    labeler_db.refresh(annotation)

    # Add user info
    updated_by_name = current_user.full_name
    created_by_name = None
    if annotation.created_by:
        user = platform_db.query(User).filter(User.id == annotation.created_by).first()
        if user:
            created_by_name = user.full_name

    response_dict = {
        **annotation.__dict__,
        "created_by_name": created_by_name,
        "updated_by_name": updated_by_name,
    }

    return AnnotationResponse.model_validate(response_dict)


@router.delete("/{annotation_id}", tags=["Annotations"])
async def delete_annotation(
    annotation_id: int,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """Delete annotation."""
    annotation = labeler_db.query(Annotation).filter(
        Annotation.id == annotation_id
    ).first()

    if not annotation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Annotation {annotation_id} not found",
        )

    project_id = annotation.project_id

    # Store state before deletion
    previous_state = {
        "annotation_type": annotation.annotation_type,
        "geometry": annotation.geometry,
        "class_id": annotation.class_id,
        "class_name": annotation.class_name,
        "image_id": annotation.image_id,
    }

    # Create history entry before deletion
    await create_history_entry(
        db=labeler_db,
        annotation_id=annotation_id,
        project_id=project_id,
        action="delete",
        previous_state=previous_state,
        changed_by=current_user.id,
    )

    # Delete annotation
    labeler_db.delete(annotation)

    # Update project stats
    await update_project_stats(
        db=labeler_db,
        project_id=project_id,
        user_id=current_user.id,
    )

    labeler_db.commit()

    return {"message": f"Annotation {annotation_id} deleted successfully"}


@router.get("/project/{project_id}", response_model=List[AnnotationResponse], tags=["Annotations"])
async def list_project_annotations(
    project_id: str,
    skip: int = 0,
    limit: int = 1000,
    image_id: Optional[str] = None,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    List annotations for a project.

    - **project_id**: Project ID
    - **skip**: Number of records to skip
    - **limit**: Maximum number of records to return
    - **image_id**: Filter by image ID (optional)
    """
    query = labeler_db.query(Annotation).filter(Annotation.project_id == project_id)

    if image_id:
        query = query.filter(Annotation.image_id == image_id)

    annotations = query.offset(skip).limit(min(limit, 1000)).all()

    # Fetch user info for all unique user IDs
    user_ids = set()
    for ann in annotations:
        if ann.created_by:
            user_ids.add(ann.created_by)
        if ann.updated_by:
            user_ids.add(ann.updated_by)

    users = {}
    if user_ids:
        user_results = platform_db.query(User).filter(User.id.in_(user_ids)).all()
        users = {u.id: u.full_name for u in user_results}

    # Build responses
    result = []
    for ann in annotations:
        response_dict = {
            **ann.__dict__,
            "created_by_name": users.get(ann.created_by),
            "updated_by_name": users.get(ann.updated_by),
        }
        result.append(AnnotationResponse.model_validate(response_dict))

    return result


@router.post("/batch", response_model=AnnotationBatchResponse, tags=["Annotations"])
async def batch_create_annotations(
    batch: AnnotationBatchCreate,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """
    Batch create annotations.

    Useful for importing existing annotations or bulk operations.
    """
    created_ids = []
    errors = []

    for idx, annotation_data in enumerate(batch.annotations):
        try:
            # Verify project exists
            project = labeler_db.query(AnnotationProject).filter(
                AnnotationProject.id == annotation_data.project_id
            ).first()

            if not project:
                errors.append(f"Index {idx}: Project {annotation_data.project_id} not found")
                continue

            # Create annotation
            new_annotation = Annotation(
                project_id=annotation_data.project_id,
                image_id=annotation_data.image_id,
                annotation_type=annotation_data.annotation_type,
                geometry=annotation_data.geometry,
                class_id=annotation_data.class_id,
                class_name=annotation_data.class_name,
                attributes=annotation_data.attributes or {},
                confidence=annotation_data.confidence,
                notes=annotation_data.notes,
                created_by=current_user.id,
                is_verified=False,
            )

            labeler_db.add(new_annotation)
            labeler_db.flush()

            # Create history entry
            await create_history_entry(
                db=labeler_db,
                annotation_id=new_annotation.id,
                project_id=annotation_data.project_id,
                action="create",
                new_state={
                    "annotation_type": annotation_data.annotation_type,
                    "geometry": annotation_data.geometry,
                    "class_id": annotation_data.class_id,
                },
                changed_by=current_user.id,
            )

            created_ids.append(new_annotation.id)

        except Exception as e:
            errors.append(f"Index {idx}: {str(e)}")

    # Update project stats for all affected projects
    affected_projects = set(ann.project_id for ann in batch.annotations)
    for project_id in affected_projects:
        await update_project_stats(
            db=labeler_db,
            project_id=project_id,
            user_id=current_user.id,
        )

    labeler_db.commit()

    return AnnotationBatchResponse(
        created=len(created_ids),
        failed=len(errors),
        annotation_ids=created_ids,
        errors=errors,
    )


@router.get("/history/project/{project_id}", response_model=List[AnnotationHistoryResponse], tags=["Annotation History"])
async def list_project_history(
    project_id: str,
    skip: int = 0,
    limit: int = 100,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get annotation history for a project.

    Returns recent annotation changes for activity timeline.

    - **project_id**: Project ID
    - **skip**: Number of records to skip
    - **limit**: Maximum number of records to return (max 100)
    """
    history_entries = (
        labeler_db.query(AnnotationHistory)
        .filter(AnnotationHistory.project_id == project_id)
        .order_by(AnnotationHistory.timestamp.desc())
        .offset(skip)
        .limit(min(limit, 100))
        .all()
    )

    # Fetch user info
    user_ids = set(h.changed_by for h in history_entries if h.changed_by)
    users = {}
    if user_ids:
        user_results = platform_db.query(User).filter(User.id.in_(user_ids)).all()
        users = {u.id: {"name": u.full_name, "email": u.email} for u in user_results}

    # Build responses
    result = []
    for history in history_entries:
        user_info = users.get(history.changed_by, {})
        response_dict = {
            **history.__dict__,
            "changed_by_name": user_info.get("name"),
            "changed_by_email": user_info.get("email"),
        }
        result.append(AnnotationHistoryResponse.model_validate(response_dict))

    return result


@router.get("/history/annotation/{annotation_id}", response_model=List[AnnotationHistoryResponse], tags=["Annotation History"])
async def list_annotation_history(
    annotation_id: int,
    labeler_db: Session = Depends(get_labeler_db),
    platform_db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get history for a specific annotation.

    Useful for seeing all changes made to a single annotation.

    - **annotation_id**: Annotation ID
    """
    history_entries = (
        labeler_db.query(AnnotationHistory)
        .filter(AnnotationHistory.annotation_id == annotation_id)
        .order_by(AnnotationHistory.timestamp.desc())
        .all()
    )

    # Fetch user info
    user_ids = set(h.changed_by for h in history_entries if h.changed_by)
    users = {}
    if user_ids:
        user_results = platform_db.query(User).filter(User.id.in_(user_ids)).all()
        users = {u.id: {"name": u.full_name, "email": u.email} for u in user_results}

    # Build responses
    result = []
    for history in history_entries:
        user_info = users.get(history.changed_by, {})
        response_dict = {
            **history.__dict__,
            "changed_by_name": user_info.get("name"),
            "changed_by_email": user_info.get("email"),
        }
        result.append(AnnotationHistoryResponse.model_validate(response_dict))

    return result
