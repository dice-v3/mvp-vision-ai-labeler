

# ============================================================================
# Class Management Endpoints
# ============================================================================

@router.post("/{project_id}/classes", response_model=ClassResponse, tags=["Classes"], status_code=status.HTTP_201_CREATED)
async def add_class(
    project_id: str,
    class_data: ClassCreateRequest,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """
    Add a new class to a project.

    This is useful for:
    - Unlabeled datasets where classes need to be defined during annotation
    - Labeled datasets where additional classes need to be added

    - **class_id**: Unique class ID (e.g., '1', 'person', 'car')
    - **name**: Human-readable class name
    - **color**: Color in hex format (e.g., #FF5733)
    - **description**: Optional description
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

    # Check if class_id already exists
    if class_data.class_id in project.classes:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Class with ID '{class_data.class_id}' already exists",
        )

    # Add new class
    project.classes[class_data.class_id] = {
        "name": class_data.name,
        "color": class_data.color,
        "description": class_data.description,
        "image_count": 0,
        "bbox_count": 0,
    }

    # Mark as modified to trigger JSONB update
    labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).update(
        {
            "classes": project.classes,
            "updated_at": datetime.utcnow(),
            "last_updated_by": current_user.id,
        },
        synchronize_session=False
    )

    labeler_db.commit()
    labeler_db.refresh(project)

    return ClassResponse(
        class_id=class_data.class_id,
        name=class_data.name,
        color=class_data.color,
        description=class_data.description,
        image_count=0,
        bbox_count=0,
    )


@router.patch("/{project_id}/classes/{class_id}", response_model=ClassResponse, tags=["Classes"])
async def update_class(
    project_id: str,
    class_id: str,
    class_data: ClassUpdateRequest,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update an existing class.

    - **name**: New class name (optional)
    - **color**: New color (optional)
    - **description**: New description (optional)
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

    # Check if class exists
    if class_id not in project.classes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class '{class_id}' not found",
        )

    # Update class properties
    if class_data.name is not None:
        project.classes[class_id]["name"] = class_data.name
    if class_data.color is not None:
        project.classes[class_id]["color"] = class_data.color
    if class_data.description is not None:
        project.classes[class_id]["description"] = class_data.description

    # Mark as modified to trigger JSONB update
    labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).update(
        {
            "classes": project.classes,
            "updated_at": datetime.utcnow(),
            "last_updated_by": current_user.id,
        },
        synchronize_session=False
    )

    labeler_db.commit()
    labeler_db.refresh(project)

    updated_class = project.classes[class_id]
    return ClassResponse(
        class_id=class_id,
        name=updated_class["name"],
        color=updated_class["color"],
        description=updated_class.get("description"),
        image_count=updated_class.get("image_count", 0),
        bbox_count=updated_class.get("bbox_count", 0),
    )


@router.delete("/{project_id}/classes/{class_id}", tags=["Classes"], status_code=status.HTTP_204_NO_CONTENT)
async def delete_class(
    project_id: str,
    class_id: str,
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a class from a project.

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

    # Check if class exists
    if class_id not in project.classes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Class '{class_id}' not found",
        )

    # Check if there are annotations using this class
    annotation_count = labeler_db.query(func.count(Annotation.id)).filter(
        Annotation.project_id == project_id,
        Annotation.class_id == class_id,
    ).scalar()

    if annotation_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete class '{class_id}': {annotation_count} annotations are using this class",
        )

    # Remove class
    del project.classes[class_id]

    # Mark as modified to trigger JSONB update
    labeler_db.query(AnnotationProject).filter(
        AnnotationProject.id == project_id
    ).update(
        {
            "classes": project.classes,
            "updated_at": datetime.utcnow(),
            "last_updated_by": current_user.id,
        },
        synchronize_session=False
    )

    labeler_db.commit()

    return None
