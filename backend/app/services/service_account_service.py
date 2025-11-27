"""
Service Account Service for Phase 16 - Platform Integration

Provides service account management and authentication for service-to-service API access.
Service accounts authenticate using API keys with scope-based authorization.

Features:
- API key generation with secure random tokens
- bcrypt password hashing for API keys
- Scope-based authorization (datasets:read, datasets:download, datasets:permissions)
- Service account lifecycle management (create, update, deactivate, delete)
- Last-used timestamp tracking for monitoring

Usage:
```python
from app.services.service_account_service import create_service_account, verify_api_key

# Create service account (admin only)
service_account, plaintext_key = create_service_account(
    db=db,
    service_name="platform-training",
    scopes=["datasets:read", "datasets:download"],
    created_by=admin_user_id,
    expires_at=None  # No expiration
)
# plaintext_key is only available here - store securely!

# Verify API key during authentication
service_account = await verify_api_key(db, api_key="sa_abc123.xyz789...")
if service_account and service_account.has_scope("datasets:read"):
    # Allow access
```
"""

import secrets
from datetime import datetime
from typing import List, Optional, Tuple

from sqlalchemy.orm import Session
from passlib.context import CryptContext

from app.db.models.labeler import ServiceAccount

# Password hashing context for API keys
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# =============================================================================
# API Key Generation
# =============================================================================

def generate_api_key() -> str:
    """
    Generate a secure API key.

    Format: sa_{prefix}_{secret}
    - prefix: 16 random characters (for indexing/identification)
    - secret: 32 random characters (for authentication)

    Total length: ~54 characters

    Returns:
        Plaintext API key (e.g., "sa_abc123def456789_xyz789uvw456qrs123abc789def456")
    """
    prefix = secrets.token_urlsafe(12)  # ~16 chars
    secret = secrets.token_urlsafe(24)  # ~32 chars
    return f"sa_{prefix}_{secret}"


def hash_api_key(plaintext_key: str) -> str:
    """
    Hash API key using bcrypt.

    Args:
        plaintext_key: Plaintext API key

    Returns:
        Hashed API key
    """
    return pwd_context.hash(plaintext_key)


# =============================================================================
# Service Account CRUD
# =============================================================================

def create_service_account(
    db: Session,
    service_name: str,
    scopes: List[str],
    created_by: int,
    expires_at: Optional[datetime] = None,
) -> Tuple[ServiceAccount, str]:
    """
    Create a new service account with API key.

    Args:
        db: Database session
        service_name: Unique service name (e.g., "platform-training")
        scopes: List of scopes (e.g., ["datasets:read", "datasets:download"])
        created_by: User ID of admin creating the account
        expires_at: Optional expiration date

    Returns:
        Tuple of (ServiceAccount, plaintext_api_key)

    Note: The plaintext API key is only returned once at creation time.
    Store it securely - it cannot be retrieved later.
    """
    # Generate API key
    plaintext_key = generate_api_key()
    api_key_hash = hash_api_key(plaintext_key)

    # Generate ID from service name
    service_id = f"sa_{service_name.lower().replace(' ', '_').replace('-', '_')}"

    # Create service account
    service_account = ServiceAccount(
        id=service_id,
        service_name=service_name,
        api_key_hash=api_key_hash,
        scopes=scopes,
        created_by=created_by,
        created_at=datetime.utcnow(),
        expires_at=expires_at,
        is_active=True,
    )

    db.add(service_account)
    db.commit()
    db.refresh(service_account)

    return service_account, plaintext_key


def get_service_account(db: Session, service_id: str) -> Optional[ServiceAccount]:
    """
    Get service account by ID.

    Args:
        db: Database session
        service_id: Service account ID

    Returns:
        ServiceAccount or None
    """
    return db.query(ServiceAccount).filter(ServiceAccount.id == service_id).first()


def get_service_account_by_name(db: Session, service_name: str) -> Optional[ServiceAccount]:
    """
    Get service account by service name.

    Args:
        db: Database session
        service_name: Service name

    Returns:
        ServiceAccount or None
    """
    return db.query(ServiceAccount).filter(ServiceAccount.service_name == service_name).first()


def list_service_accounts(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    include_inactive: bool = False,
) -> Tuple[List[ServiceAccount], int]:
    """
    List service accounts with pagination.

    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        include_inactive: Include inactive accounts

    Returns:
        Tuple of (service_accounts, total_count)
    """
    query = db.query(ServiceAccount)

    if not include_inactive:
        query = query.filter(ServiceAccount.is_active == True)

    total = query.count()
    service_accounts = query.order_by(ServiceAccount.created_at.desc()).offset(skip).limit(limit).all()

    return service_accounts, total


def update_service_account(
    db: Session,
    service_id: str,
    scopes: Optional[List[str]] = None,
    expires_at: Optional[datetime] = None,
    is_active: Optional[bool] = None,
) -> Optional[ServiceAccount]:
    """
    Update service account settings.

    Args:
        db: Database session
        service_id: Service account ID
        scopes: Updated scopes
        expires_at: Updated expiration date
        is_active: Updated active status

    Returns:
        Updated ServiceAccount or None if not found
    """
    service_account = get_service_account(db, service_id)
    if not service_account:
        return None

    if scopes is not None:
        service_account.scopes = scopes
    if expires_at is not None:
        service_account.expires_at = expires_at
    if is_active is not None:
        service_account.is_active = is_active

    db.commit()
    db.refresh(service_account)

    return service_account


def delete_service_account(db: Session, service_id: str) -> bool:
    """
    Delete service account.

    Args:
        db: Database session
        service_id: Service account ID

    Returns:
        True if deleted, False if not found
    """
    service_account = get_service_account(db, service_id)
    if not service_account:
        return False

    db.delete(service_account)
    db.commit()

    return True


# =============================================================================
# Authentication & Authorization
# =============================================================================

def verify_api_key(db: Session, api_key: str) -> Optional[ServiceAccount]:
    """
    Verify API key and return service account.

    This function:
    1. Extracts the prefix from the API key for quick lookup
    2. Verifies the full API key using bcrypt
    3. Checks if account is active and not expired
    4. Updates last_used_at timestamp

    Args:
        db: Database session
        api_key: Plaintext API key (e.g., "sa_abc123_xyz789...")

    Returns:
        ServiceAccount if valid, None otherwise
    """
    # API key format: sa_{prefix}_{secret}
    if not api_key.startswith("sa_"):
        return None

    # Get all active service accounts
    # (In production, consider adding a prefix index for faster lookup)
    service_accounts = db.query(ServiceAccount).filter(
        ServiceAccount.is_active == True
    ).all()

    # Try to verify against each account
    for service_account in service_accounts:
        if service_account.verify_api_key(api_key):
            # Check expiration
            if service_account.is_expired:
                return None

            # Update last_used_at
            service_account.last_used_at = datetime.utcnow()
            db.commit()

            return service_account

    return None


def update_last_used(db: Session, service_id: str) -> None:
    """
    Update last_used_at timestamp for service account.

    Args:
        db: Database session
        service_id: Service account ID
    """
    service_account = get_service_account(db, service_id)
    if service_account:
        service_account.last_used_at = datetime.utcnow()
        db.commit()


# =============================================================================
# Authorization Helpers
# =============================================================================

def check_scope(service_account: ServiceAccount, required_scope: str) -> bool:
    """
    Check if service account has required scope.

    Args:
        service_account: ServiceAccount instance
        required_scope: Required scope (e.g., "datasets:read")

    Returns:
        True if has scope, False otherwise
    """
    return service_account.has_scope(required_scope)
