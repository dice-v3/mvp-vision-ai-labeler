"""Authentication endpoints."""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import RedirectResponse
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_user_db
from app.core.security import verify_password, create_access_token, decode_service_token, get_current_user
from app.db.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserResponse

router = APIRouter()


@router.options("/login")
async def login_options():
    """Handle OPTIONS preflight request for login."""
    return Response(status_code=200)


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


@router.get("/sso", tags=["Authentication"])
async def sso_login(
    token: str,
    response: Response,
    db: Session = Depends(get_user_db),
):
    """
    SSO endpoint for Platform → Labeler integration.

    Phase 17: Validates service JWT from Platform and creates user session.

    Flow:
    1. Decode and validate service token (SERVICE_JWT_SECRET)
    2. Extract user info (user_id, email, full_name, system_role, badge_color)
    3. Find or create user in Shared User DB
    4. Update user info if already exists
    5. Create access token (user JWT, 24h expiry)
    6. Set HTTP-only cookie for session
    7. Redirect to /datasets page

    Args:
        token: Service JWT token from Platform (5min expiry)
        response: FastAPI Response for setting cookies
        db: Shared User Database session

    Returns:
        RedirectResponse to /datasets (HTTP 303)

    Raises:
        HTTPException 401: Invalid/expired token
        HTTPException 500: User creation failed

    Example:
        Platform redirects to: GET /api/v1/auth/sso?token=eyJ...
        Labeler creates session and redirects to: /datasets
    """
    try:
        # 1. Decode and validate service token
        payload = decode_service_token(token)

        # 2. Extract user information
        user_id = int(payload.get("user_id"))
        email = payload.get("email")
        full_name = payload.get("full_name", "")
        system_role = payload.get("system_role", "user")
        badge_color = payload.get("badge_color", "blue")

        # Validate required fields
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is required in service token"
            )

        # 3. Find or create user in Shared User DB
        user = db.query(User).filter(User.id == user_id).first()

        if not user:
            # User doesn't exist - create new user
            user = User(
                id=user_id,
                email=email,
                full_name=full_name,
                system_role=system_role,
                badge_color=badge_color,
                is_active=True,
                hashed_password="",  # No password for SSO users
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            # User exists - update info if changed
            user.full_name = full_name
            user.system_role = system_role
            user.badge_color = badge_color
            user.updated_at = datetime.utcnow()
            db.commit()

        # 4. Create session (access token)
        access_token = create_access_token(
            data={"user_id": user.id, "email": user.email}
        )

        # 5. Redirect to frontend with token as query parameter
        # Frontend will receive token and store it in localStorage
        redirect_url = f"{settings.FRONTEND_URL}/?sso_token={access_token}"
        return RedirectResponse(
            url=redirect_url,
            status_code=status.HTTP_303_SEE_OTHER
        )

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid service token: {str(e)}"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid token payload: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"SSO login failed: {str(e)}"
        )
