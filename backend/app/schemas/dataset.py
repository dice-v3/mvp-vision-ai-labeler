"""Dataset schemas."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel
from decimal import Decimal


class DatasetResponse(BaseModel):
    """Dataset information from Platform DB."""
    id: str
    name: str
    description: Optional[str] = None
    owner_id: int
    format: str
    source: str
    visibility: str
    labeled: bool
    num_items: int
    size_mb: Optional[Decimal] = None
    storage_path: Optional[str] = None
    tags: Optional[List[str]] = None
    created_at: datetime
    updated_at: datetime

    # Owner information (joined from User table)
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None
    owner_badge_color: Optional[str] = None

    class Config:
        from_attributes = True
