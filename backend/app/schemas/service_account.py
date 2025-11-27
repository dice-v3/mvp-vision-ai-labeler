"""Service Account schemas for Phase 16 Platform Integration."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


class ServiceAccountCreate(BaseModel):
    """Schema for creating a new service account."""
    service_name: str = Field(..., min_length=3, max_length=100, description="Unique service name")
    scopes: List[str] = Field(..., min_items=1, description="List of scopes (e.g., datasets:read)")
    expires_at: Optional[datetime] = Field(None, description="Expiration date (None = no expiration)")

    @field_validator('scopes')
    @classmethod
    def validate_scopes(cls, v: List[str]) -> List[str]:
        """Validate that scopes are from allowed list."""
        allowed_scopes = {
            'datasets:read',      # Read dataset metadata
            'datasets:download',  # Generate download URLs
            'datasets:permissions' # Check permissions
        }
        invalid_scopes = set(v) - allowed_scopes
        if invalid_scopes:
            raise ValueError(f"Invalid scopes: {', '.join(invalid_scopes)}")
        return v


class ServiceAccountUpdate(BaseModel):
    """Schema for updating service account settings."""
    scopes: Optional[List[str]] = Field(None, description="Updated scopes")
    expires_at: Optional[datetime] = Field(None, description="Updated expiration date")
    is_active: Optional[bool] = Field(None, description="Active status")

    @field_validator('scopes')
    @classmethod
    def validate_scopes(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        """Validate that scopes are from allowed list."""
        if v is None:
            return v
        allowed_scopes = {
            'datasets:read',
            'datasets:download',
            'datasets:permissions'
        }
        invalid_scopes = set(v) - allowed_scopes
        if invalid_scopes:
            raise ValueError(f"Invalid scopes: {', '.join(invalid_scopes)}")
        return v


class ServiceAccountResponse(BaseModel):
    """Schema for service account information (without API key)."""
    id: str
    service_name: str
    scopes: List[str]
    created_by: int
    created_at: datetime
    expires_at: Optional[datetime]
    last_used_at: Optional[datetime]
    is_active: bool
    is_expired: bool  # Computed property

    class Config:
        from_attributes = True


class ServiceAccountWithKey(BaseModel):
    """Schema for service account with plaintext API key (only shown once at creation)."""
    id: str
    service_name: str
    api_key: str  # Plaintext API key - ONLY returned at creation time
    scopes: List[str]
    created_by: int
    created_at: datetime
    expires_at: Optional[datetime]
    is_active: bool

    class Config:
        from_attributes = True


class ServiceAccountListResponse(BaseModel):
    """Schema for list of service accounts."""
    total: int
    service_accounts: List[ServiceAccountResponse]
