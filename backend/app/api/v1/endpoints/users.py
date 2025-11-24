"""
User Endpoints for Phase 8.2 - Invitation System

Endpoints for searching and retrieving user information from User DB.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.core.database import get_user_db, get_labeler_db
from app.core.security import get_current_user
from app.db.models.user import User
from app.db.models.labeler import ProjectPermission
from app.schemas.user import UserSearchResponse, UserSearchItem, UserInfoResponse

router = APIRouter()


@router.get("/search", response_model=UserSearchResponse, tags=["Users"])
async def search_users(
    q: str = Query(..., min_length=1, description="Search query (email or name)"),
    limit: int = Query(10, ge=1, le=50, description="Results per page"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    project_id: Optional[str] = Query(None, description="Filter out users already in this project"),
    user_db: Session = Depends(get_user_db),
    labeler_db: Session = Depends(get_labeler_db),
    current_user: User = Depends(get_current_user),
):
    """
    Search users by email or full name (Phase 8.2).

    - Searches User DB for matching users
    - Case-insensitive search on email and full_name
    - Optional: Filter out users already in a specific project
    - Returns paginated results with avatar/badge info
    """
    # Build base query
    query = user_db.query(User).filter(User.is_active == True)

    # Apply search filter (email or name)
    search_pattern = f"%{q}%"
    query = query.filter(
        (User.email.ilike(search_pattern)) |
        (User.full_name.ilike(search_pattern))
    )

    # Optional: Exclude users already in the project
    if project_id:
        # Get user IDs already in this project
        existing_user_ids = (
            labeler_db.query(ProjectPermission.user_id)
            .filter(ProjectPermission.project_id == project_id)
            .all()
        )
        existing_ids = [uid for (uid,) in existing_user_ids]

        if existing_ids:
            query = query.filter(User.id.notin_(existing_ids))

    # Get total count before pagination
    total = query.count()

    # Apply pagination and execute
    users = query.order_by(User.email).offset(offset).limit(limit).all()

    # Convert to response model
    user_items = [
        UserSearchItem(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            avatar_name=user.avatar_name,
            badge_color=user.badge_color,
            system_role=user.system_role,
        )
        for user in users
    ]

    return UserSearchResponse(
        users=user_items,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/{user_id}", response_model=UserInfoResponse, tags=["Users"])
async def get_user_info(
    user_id: int,
    user_db: Session = Depends(get_user_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get detailed user information by ID (Phase 8.2).

    - Retrieves user from User DB
    - Returns full user profile information
    - Requires authentication
    """
    user = user_db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserInfoResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        avatar_name=user.avatar_name,
        badge_color=user.badge_color,
        system_role=user.system_role,
        organization_id=user.organization_id,
        is_active=user.is_active,
        created_at=user.created_at.isoformat() if user.created_at else None,
    )
