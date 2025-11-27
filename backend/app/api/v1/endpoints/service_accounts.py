"""
Service Account Management Endpoints (Phase 16 - Platform Integration)

Admin-only endpoints for managing service accounts.
Service accounts are used for service-to-service authentication (e.g., Platform training jobs).

Endpoints:
- POST   /api/v1/auth/service-accounts       - Create service account (returns API key once)
- GET    /api/v1/auth/service-accounts       - List all service accounts
- GET    /api/v1/auth/service-accounts/{id}  - Get specific service account
- PATCH  /api/v1/auth/service-accounts/{id}  - Update service account
- DELETE /api/v1/auth/service-accounts/{id}  - Delete service account

All endpoints require admin privileges.
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.core.database import get_labeler_db
from app.core.security import get_current_admin_user
from app.db.models.user import User
from app.schemas.service_account import (
    ServiceAccountCreate,
    ServiceAccountUpdate,
    ServiceAccountResponse,
    ServiceAccountWithKey,
    ServiceAccountListResponse,
)
from app.services import service_account_service
from app.services.audit_service import log_create, log_update, log_delete

router = APIRouter()


@router.post(
    "",
    response_model=ServiceAccountWithKey,
    status_code=status.HTTP_201_CREATED,
    tags=["Service Accounts"],
    summary="Create service account",
)
async def create_service_account(
    data: ServiceAccountCreate,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_labeler_db),
):
    """
    Create a new service account (admin only).

    The API key is only returned ONCE during creation.
    Store it securely - it cannot be retrieved later.

    Args:
        data: Service account creation data
        current_user: Current admin user
        db: Database session

    Returns:
        ServiceAccountWithKey containing the plaintext API key

    Raises:
        409: If service name already exists
    """
    # Check if service name already exists
    existing = service_account_service.get_service_account_by_name(db, data.service_name)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Service account with name '{data.service_name}' already exists",
        )

    # Create service account
    service_account, plaintext_key = service_account_service.create_service_account(
        db=db,
        service_name=data.service_name,
        scopes=data.scopes,
        created_by=current_user.id,
        expires_at=data.expires_at,
    )

    # Log creation
    await log_create(
        user_id=current_user.id,
        resource_type="service_account",
        resource_id=service_account.id,
        data={
            "service_name": service_account.service_name,
            "scopes": service_account.scopes,
            "expires_at": service_account.expires_at.isoformat() if service_account.expires_at else None,
        },
        request=request,
    )

    # Return with plaintext API key (only time it's available)
    return ServiceAccountWithKey(
        id=service_account.id,
        service_name=service_account.service_name,
        api_key=plaintext_key,  # Plaintext key - only shown once
        scopes=service_account.scopes,
        created_by=service_account.created_by,
        created_at=service_account.created_at,
        expires_at=service_account.expires_at,
        is_active=service_account.is_active,
    )


@router.get(
    "",
    response_model=ServiceAccountListResponse,
    tags=["Service Accounts"],
    summary="List service accounts",
)
async def list_service_accounts(
    skip: int = 0,
    limit: int = 100,
    include_inactive: bool = False,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_labeler_db),
):
    """
    List all service accounts (admin only).

    Args:
        skip: Number of records to skip (pagination)
        limit: Maximum number of records to return
        include_inactive: Include inactive service accounts
        current_user: Current admin user
        db: Database session

    Returns:
        List of service accounts (without API keys)
    """
    service_accounts, total = service_account_service.list_service_accounts(
        db=db,
        skip=skip,
        limit=limit,
        include_inactive=include_inactive,
    )

    return ServiceAccountListResponse(
        total=total,
        service_accounts=[
            ServiceAccountResponse.model_validate(sa) for sa in service_accounts
        ],
    )


@router.get(
    "/{service_id}",
    response_model=ServiceAccountResponse,
    tags=["Service Accounts"],
    summary="Get service account",
)
async def get_service_account(
    service_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_labeler_db),
):
    """
    Get specific service account by ID (admin only).

    Args:
        service_id: Service account ID
        current_user: Current admin user
        db: Database session

    Returns:
        Service account details (without API key)

    Raises:
        404: If service account not found
    """
    service_account = service_account_service.get_service_account(db, service_id)

    if not service_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service account '{service_id}' not found",
        )

    return ServiceAccountResponse.model_validate(service_account)


@router.patch(
    "/{service_id}",
    response_model=ServiceAccountResponse,
    tags=["Service Accounts"],
    summary="Update service account",
)
async def update_service_account(
    service_id: str,
    data: ServiceAccountUpdate,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_labeler_db),
):
    """
    Update service account settings (admin only).

    Can update scopes, expiration date, and active status.
    Cannot update API key - delete and recreate if needed.

    Args:
        service_id: Service account ID
        data: Update data
        current_user: Current admin user
        db: Database session

    Returns:
        Updated service account

    Raises:
        404: If service account not found
    """
    # Update service account
    service_account = service_account_service.update_service_account(
        db=db,
        service_id=service_id,
        scopes=data.scopes,
        expires_at=data.expires_at,
        is_active=data.is_active,
    )

    if not service_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service account '{service_id}' not found",
        )

    # Log update
    changes = {}
    if data.scopes is not None:
        changes["scopes"] = data.scopes
    if data.expires_at is not None:
        changes["expires_at"] = data.expires_at.isoformat() if data.expires_at else None
    if data.is_active is not None:
        changes["is_active"] = data.is_active

    await log_update(
        user_id=current_user.id,
        resource_type="service_account",
        resource_id=service_account.id,
        changes=changes,
        request=request,
    )

    return ServiceAccountResponse.model_validate(service_account)


@router.delete(
    "/{service_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Service Accounts"],
    summary="Delete service account",
)
async def delete_service_account(
    service_id: str,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_labeler_db),
):
    """
    Delete service account (admin only).

    This will immediately revoke access for all requests using this API key.

    Args:
        service_id: Service account ID
        current_user: Current admin user
        db: Database session

    Raises:
        404: If service account not found
    """
    # Get service account for logging before deletion
    service_account = service_account_service.get_service_account(db, service_id)
    if not service_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service account '{service_id}' not found",
        )

    # Delete service account
    deleted = service_account_service.delete_service_account(db, service_id)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Service account '{service_id}' not found",
        )

    # Log deletion
    await log_delete(
        user_id=current_user.id,
        resource_type="service_account",
        resource_id=service_id,
        data={
            "service_name": service_account.service_name,
            "scopes": service_account.scopes,
        },
        request=request,
    )

    return None
