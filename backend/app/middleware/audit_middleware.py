"""
Audit Middleware for Phase 15 - Admin Dashboard

Automatically logs all API requests and responses to the audit log.

Features:
- Request/response logging for all endpoints
- IP address and user agent capture
- Response time tracking
- Excludes health checks and static assets
- Async logging (non-blocking)
- Error handling (doesn't break application)

Usage:
```python
from app.middleware.audit_middleware import AuditMiddleware

app.add_middleware(AuditMiddleware)
```
"""

import time
from typing import Callable, Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.services.audit_service import log_action
from app.core.security import decode_access_token


# Paths to exclude from audit logging
EXCLUDED_PATHS = [
    "/health",
    "/healthz",
    "/metrics",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/favicon.ico",
]

# Path prefixes to exclude
EXCLUDED_PREFIXES = [
    "/static",
    "/assets",
]


class AuditMiddleware(BaseHTTPMiddleware):
    """
    Middleware to automatically log all API requests and responses.

    This middleware captures:
    - Request method and path
    - User ID (from JWT token)
    - IP address and user agent
    - Response status code
    - Request duration

    Logs are written asynchronously to avoid blocking requests.
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process the request and log it to the audit log.

        Args:
            request: FastAPI request object
            call_next: Next middleware in the chain

        Returns:
            Response from the next middleware/endpoint
        """
        # Skip excluded paths
        if self._should_skip_logging(request):
            return await call_next(request)

        # Record start time
        start_time = time.time()

        # Extract user ID from token (if available)
        user_id = await self._get_user_id(request)

        # Process request
        response = None
        error_message = None
        status = "success"

        try:
            response = await call_next(request)

            # Determine status based on response code
            if response.status_code >= 400:
                status = "failure" if response.status_code < 500 else "error"

        except Exception as e:
            # Log the error
            status = "error"
            error_message = str(e)
            raise  # Re-raise to not break the application

        finally:
            # Calculate request duration
            duration_ms = (time.time() - start_time) * 1000

            # Log the request (async, non-blocking)
            await self._log_request(
                request=request,
                user_id=user_id,
                status_code=response.status_code if response else 500,
                duration_ms=duration_ms,
                status=status,
                error_message=error_message,
            )

        return response

    def _should_skip_logging(self, request: Request) -> bool:
        """
        Check if the request path should be excluded from logging.

        Args:
            request: FastAPI request object

        Returns:
            True if the path should be skipped, False otherwise
        """
        path = request.url.path

        # Check exact matches
        if path in EXCLUDED_PATHS:
            return True

        # Check prefixes
        for prefix in EXCLUDED_PREFIXES:
            if path.startswith(prefix):
                return True

        return False

    async def _get_user_id(self, request: Request) -> Optional[int]:
        """
        Extract user ID from JWT token in request headers.

        Args:
            request: FastAPI request object

        Returns:
            User ID if token is valid, None otherwise
        """
        try:
            # Get Authorization header
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                return None

            # Extract token
            token = auth_header.replace("Bearer ", "")

            # Decode token to get payload
            payload = decode_access_token(token)

            # Extract user_id from payload
            user_id = payload.get("user_id")

            return user_id

        except Exception:
            # Token validation failed, return None
            return None

    async def _log_request(
        self,
        request: Request,
        user_id: Optional[int],
        status_code: int,
        duration_ms: float,
        status: str,
        error_message: Optional[str],
    ):
        """
        Log the request to the audit log (async).

        Args:
            request: FastAPI request object
            user_id: User ID (from token)
            status_code: HTTP status code
            duration_ms: Request duration in milliseconds
            status: Action status ('success', 'failure', 'error')
            error_message: Error message if status is error
        """
        try:
            # Prepare action name from method and path
            action = f"{request.method.lower()}_request"

            # Prepare resource type from path
            resource_type = self._extract_resource_type(request.url.path)

            # Prepare details
            details = {
                "method": request.method,
                "path": request.url.path,
                "query_params": dict(request.query_params),
                "status_code": status_code,
                "duration_ms": round(duration_ms, 2),
            }

            # Log the action
            await log_action(
                user_id=user_id,
                action=action,
                resource_type=resource_type,
                resource_id=None,
                details=details,
                request=request,
                status=status,
                error_message=error_message,
            )

        except Exception as e:
            # Don't let audit logging break the application
            # Just print to stderr
            import sys
            print(f"[AUDIT MIDDLEWARE ERROR] Failed to log request: {e}", file=sys.stderr)

    def _extract_resource_type(self, path: str) -> Optional[str]:
        """
        Extract resource type from request path.

        Examples:
            /api/v1/datasets/123 -> 'dataset'
            /api/v1/projects/456 -> 'project'
            /api/v1/annotations/789 -> 'annotation'

        Args:
            path: Request URL path

        Returns:
            Resource type or None
        """
        # Split path and find resource name
        parts = [p for p in path.split("/") if p]

        # Look for common resource types
        resource_keywords = [
            "datasets", "projects", "annotations", "users",
            "invitations", "permissions", "exports", "admin"
        ]

        for keyword in resource_keywords:
            if keyword in parts:
                # Return singular form
                return keyword.rstrip("s")

        return None
