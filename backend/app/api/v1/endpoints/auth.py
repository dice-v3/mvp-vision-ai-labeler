"""Authentication endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_user_db
from app.core.security import verify_password, create_access_token, get_current_user
from app.db.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse

router = APIRouter()


@router.post("/login", response_model=TokenResponse, tags=["Authentication"])
async def login(
    credentials: LoginRequest,
    db: Session = Depends(get_user_db),
):
    """
    Login with email and password.

    Phase 9: Authenticates against User database (PostgreSQL).
    Returns JWT access token for accessing protected endpoints.
    """
    # Find user by email
    user = db.query(User).filter(User.email == credentials.email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify password
    if not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    # Create access token
    access_token = create_access_token(
        data={"user_id": user.id, "email": user.email}
    )

    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=UserResponse, tags=["Authentication"])
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
):
    """
    Get current user information.

    Requires authentication.
    """
    return UserResponse.model_validate(current_user)
