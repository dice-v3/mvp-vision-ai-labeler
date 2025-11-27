"""Pydantic schemas for request/response validation."""

from app.schemas.auth import LoginRequest, TokenResponse, UserResponse
from app.schemas.dataset import DatasetResponse
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
)
from app.schemas.service_account import (
    ServiceAccountCreate,
    ServiceAccountUpdate,
    ServiceAccountResponse,
    ServiceAccountWithKey,
    ServiceAccountListResponse,
)

__all__ = [
    # Auth
    "LoginRequest",
    "TokenResponse",
    "UserResponse",
    # Dataset
    "DatasetResponse",
    # Project
    "ProjectCreate",
    "ProjectUpdate",
    "ProjectResponse",
    # Service Account
    "ServiceAccountCreate",
    "ServiceAccountUpdate",
    "ServiceAccountResponse",
    "ServiceAccountWithKey",
    "ServiceAccountListResponse",
]
