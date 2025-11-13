"""Dataset endpoints (read-only from Platform DB)."""

from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.core.database import get_platform_db
from app.core.security import get_current_user
from app.db.models.platform import Dataset, User
from app.schemas.dataset import DatasetResponse

router = APIRouter()


@router.get("", response_model=List[DatasetResponse], tags=["Datasets"])
async def list_datasets(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get list of datasets from Platform database.

    - **skip**: Number of records to skip (pagination)
    - **limit**: Maximum number of records to return (max 100)
    """
    # Query datasets with owner information
    datasets = (
        db.query(
            Dataset,
            User.username.label("owner_name"),
            User.email.label("owner_email"),
            User.badge_color.label("owner_badge_color"),
        )
        .join(User, Dataset.owner_id == User.id)
        .offset(skip)
        .limit(min(limit, 100))
        .all()
    )

    # Convert to response format
    result = []
    for dataset, owner_name, owner_email, owner_badge_color in datasets:
        dataset_dict = {
            **dataset.__dict__,
            "owner_name": owner_name,
            "owner_email": owner_email,
            "owner_badge_color": owner_badge_color,
        }
        result.append(DatasetResponse.model_validate(dataset_dict))

    return result


@router.get("/{dataset_id}", response_model=DatasetResponse, tags=["Datasets"])
async def get_dataset(
    dataset_id: str,
    db: Session = Depends(get_platform_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get dataset by ID from Platform database.

    - **dataset_id**: Dataset ID
    """
    # Query dataset with owner information
    result = (
        db.query(
            Dataset,
            User.username.label("owner_name"),
            User.email.label("owner_email"),
            User.badge_color.label("owner_badge_color"),
        )
        .join(User, Dataset.owner_id == User.id)
        .filter(Dataset.id == dataset_id)
        .first()
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Dataset {dataset_id} not found",
        )

    dataset, owner_name, owner_email, owner_badge_color = result

    dataset_dict = {
        **dataset.__dict__,
        "owner_name": owner_name,
        "owner_email": owner_email,
        "owner_badge_color": owner_badge_color,
    }

    return DatasetResponse.model_validate(dataset_dict)
