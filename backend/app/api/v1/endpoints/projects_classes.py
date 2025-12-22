"""Class management endpoints for projects - REFACTORED.

REFACTORING CHANGES:
- Removed all references to legacy project.classes field
- All class operations now require task_type parameter
- Classes are task-specific (stored in project.task_classes[task_type])
- Simpler, more predictable API
"""

import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict, Any

from app.core.database import get_labeler_db
from app.core.security import get_current_user
# from app.db.models.user import User
from app.db.models.labeler import AnnotationProject, Annotation
from app.schemas.class_schema import ClassCreateRequest, ClassUpdateRequest, ClassReorderRequest, ClassResponse

router = APIRouter()


@router.post("/{project_id}/classes", response_model=ClassResponse, tags=["Classes"], status_code=status.HTTP_201_CREATED)
async def add_class(
    project_id: str,
    class_data: ClassCreateRequest,
    task_type: str = Query(..., description="Task type to add class to (e.g., 'detection', 'classification')"),
    labeler_db: Session = Depends(get_labeler_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Add a new class to a project's task.

    REFACTORED: Now requires task_type parameter (classes are task-specific).

    - **class_id**: Unique class ID (auto-generated if not provided)
    - **name**: Human-readable class name
    - **color**: Color in hex format (e.g., #FF5733)
    - **description**: Optional description
    - **task_type**: Required - Task type to add class to (e.g., 'detection', 'classification')
    """
    # Verify project exists
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found",
        )

    # Check ownership
    if project.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this project",
        )

    # Verify task_type exists in project
    if not project.task_types or task_type not in project.task_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Task type '{task_type}' not found in project. Available: {project.task_types}",
        )

    # Initialize task_classes if needed
    if not project.task_classes:
        project.task_classes = {}
    if task_type not in project.task_classes:
        project.task_classes[task_type] = {}

    task_classes = project.task_classes[task_type]

    # Auto-generate class_id if not provided
    class_id = class_data.class_id
    if not class_id:
        # Generate short UUID (first 8 characters)
        class_id = str(uuid.uuid4())[:8]
        # Ensure uniqueness
        while class_id in task_classes:
            class_id = str(uuid.uuid4())[:8]

    # Check if class_id already exists
    if class_id in task_classes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Class with ID '{class_id}' already exists in task '{task_type}'",
        )

    # Calculate order (add at end)
    existing_orders = [
        cls_info.get("order", 0)
        for cls_info in task_classes.values()
    ]
    new_order = max(existing_orders) + 1 if existing_orders else 0

    # Add new class with order
    class_info = {
        "name": class_data.name,
        "color": class_data.color,
        "description": class_data.description,
        "order": new_order,
        "image_count": 0,
        "bbox_count": 0,
    }

    # Add to task_classes
    project.task_classes[task_type][class_id] = class_info

    # Mark as modified to trigger JSONB update
    labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).update(
        {
            "task_classes": project.task_classes,
            "updated_at": datetime.utcnow(),
            "last_updated_by": current_user.id,
        },
        synchronize_session=False
    )

    labeler_db.commit()
    labeler_db.refresh(project)

    return ClassResponse(
        class_id=class_id,
        name=class_data.name,
        color=class_data.color,
        description=class_data.description,
        order=new_order,
        image_count=0,
        bbox_count=0,
    )


@router.patch("/{project_id}/classes/{class_id}", response_model=ClassResponse, tags=["Classes"])
async def update_class(
    project_id: str,
    class_id: str,
    class_data: ClassUpdateRequest,
    task_type: str = Query(..., description="Task type of the class"),
    labeler_db: Session = Depends(get_labeler_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Update an existing class in a task.

    REFACTORED: Now requires task_type parameter (classes are task-specific).

    - **name**: New class name (optional)
    - **color**: New color (optional)
    - **description**: New description (optional)
    - **task_type**: Required - Task type of the class
    """
    # Verify project exists
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found",
        )

    # Check ownership
    if project.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this project",
        )

    # Check if task_type and class exist
    if not project.task_classes or task_type not in project.task_classes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task type '{task_type}' not found in project",
        )

    if class_id not in project.task_classes[task_type]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class '{class_id}' not found in task '{task_type}'",
        )

    # Update class properties
    if class_data.name is not None:
        project.task_classes[task_type][class_id]["name"] = class_data.name
    if class_data.color is not None:
        project.task_classes[task_type][class_id]["color"] = class_data.color
    if class_data.description is not None:
        project.task_classes[task_type][class_id]["description"] = class_data.description
    if class_data.order is not None:
        project.task_classes[task_type][class_id]["order"] = class_data.order

    # Mark as modified to trigger JSONB update
    labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).update(
        {
            "task_classes": project.task_classes,
            "updated_at": datetime.utcnow(),
            "last_updated_by": current_user.id,
        },
        synchronize_session=False
    )

    labeler_db.commit()
    labeler_db.refresh(project)

    updated_class = project.task_classes[task_type][class_id]
    return ClassResponse(
        class_id=class_id,
        name=updated_class["name"],
        color=updated_class["color"],
        description=updated_class.get("description"),
        order=updated_class.get("order", 0),
        image_count=updated_class.get("image_count", 0),
        bbox_count=updated_class.get("bbox_count", 0),
    )


@router.delete("/{project_id}/classes/{class_id}", tags=["Classes"], status_code=status.HTTP_204_NO_CONTENT)
async def delete_class(
    project_id: str,
    class_id: str,
    task_type: str = Query(..., description="Task type of the class"),
    labeler_db: Session = Depends(get_labeler_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Delete a class from a project's task.

    REFACTORED: Now requires task_type parameter (classes are task-specific).

    WARNING: This will NOT delete annotations associated with this class.
    Existing annotations will keep their class_id, but the class definition
    will be removed from the project.
    """
    # Verify project exists
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found",
        )

    # Check ownership
    if project.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this project",
        )

    # Check if task_type and class exist
    if not project.task_classes or task_type not in project.task_classes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task type '{task_type}' not found in project",
        )

    if class_id not in project.task_classes[task_type]:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class '{class_id}' not found in task '{task_type}'",
        )

    # Check if there are annotations using this class
    annotation_count = labeler_db.query(func.count(Annotation.id)).filter(
        Annotation.project_id == project_id,
        Annotation.class_id == class_id,
        Annotation.task_type == task_type,  # REFACTORED: Filter by task_type
    ).scalar()

    if annotation_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete class '{class_id}': {annotation_count} annotations are using this class",
        )

    # Remove class
    del project.task_classes[task_type][class_id]

    # Mark as modified to trigger JSONB update
    labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).update(
        {
            "task_classes": project.task_classes,
            "updated_at": datetime.utcnow(),
            "last_updated_by": current_user.id,
        },
        synchronize_session=False
    )

    labeler_db.commit()

    return None


@router.put("/{project_id}/classes/reorder", response_model=List[ClassResponse], tags=["Classes"])
async def reorder_classes(
    project_id: str,
    reorder_data: ClassReorderRequest,
    task_type: str = Query(..., description="Task type of the classes to reorder"),
    labeler_db: Session = Depends(get_labeler_db),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Reorder classes in a project's task.

    REFACTORED: Now requires task_type parameter (classes are task-specific).

    Provide a list of class_ids in the desired order.
    The order field of each class will be updated accordingly.
    """
    # Verify project exists
    project = labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).first()

    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project {project_id} not found",
        )

    # Check ownership
    if project.owner_id != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify this project",
        )

    # Check if task_type exists
    if not project.task_classes or task_type not in project.task_classes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task type '{task_type}' not found in project",
        )

    task_classes = project.task_classes[task_type]

    # Validate all class_ids exist
    for class_id in reorder_data.class_ids:
        if class_id not in task_classes:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Class '{class_id}' not found in task '{task_type}'",
            )

    # Update order for each class
    for idx, class_id in enumerate(reorder_data.class_ids):
        project.task_classes[task_type][class_id]["order"] = idx

    # Mark as modified to trigger JSONB update
    labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).update(
        {
            "task_classes": project.task_classes,
            "updated_at": datetime.utcnow(),
            "last_updated_by": current_user.id,
        },
        synchronize_session=False
    )

    labeler_db.commit()
    labeler_db.refresh(project)

    # Return classes in new order
    result = []
    for class_id in reorder_data.class_ids:
        cls = project.task_classes[task_type][class_id]
        result.append(ClassResponse(
            class_id=class_id,
            name=cls["name"],
            color=cls["color"],
            description=cls.get("description"),
            order=cls.get("order", 0),
            image_count=cls.get("image_count", 0),
            bbox_count=cls.get("bbox_count", 0),
        ))

    return result
