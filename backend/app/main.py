"""
Vision AI Labeler - Backend API

Main FastAPI application entry point.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware import Middleware
from starlette.datastructures import Headers, FormData
from starlette.requests import Request as StarletteRequest

from app.core.config import settings
from app.api.v1.router import api_router


# Custom Request class to increase multipart field limit
class CustomRequest(StarletteRequest):
    """Custom request class with increased multipart limits."""

    async def form(self) -> FormData:
        """Override form() to increase max_fields limit."""
        # Skip form parsing for non-multipart requests (like OPTIONS)
        content_type = self.headers.get("content-type", "")
        if not ("multipart/form-data" in content_type or "application/x-www-form-urlencoded" in content_type):
            return FormData()

        if not hasattr(self, "_form"):
            from starlette.formparsers import MultiPartParser

            # Increase max_fields from default 1000 to 50000
            # This allows uploading folders with up to 50000 files
            #
            # Batch upload (500 files per request) handles large uploads efficiently:
            # - 50000 files = 100 batches of 500 files each
            # - Each batch uploads independently with progress tracking
            # - Partial failures don't stop the entire upload
            multipart_parser = MultiPartParser(
                self.headers,
                self.stream(),
                max_files=1000,
                max_fields=50000  # Increased to support very large datasets
            )
            self._form = await multipart_parser.parse()
        return self._form


# Create FastAPI application with custom request class
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend API for Vision AI Labeler - Web-based annotation tool",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS Configuration - MUST be added BEFORE request class override
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,  # Cache preflight requests for 10 minutes
)

# Audit Middleware (Phase 15) - OPTIONAL
# Automatically logs all API requests and responses to audit_logs table
# WARNING: This generates high log volume. Consider enabling only in production
# or for specific compliance requirements.
#
# To enable, uncomment the following lines:
# from app.middleware.audit_middleware import AuditMiddleware
# app.add_middleware(AuditMiddleware)

# Override request class AFTER adding middleware
# CustomRequest now properly handles OPTIONS requests
# TEMPORARY: Disabled due to CORS conflict - investigating alternative solutions
# app.router.request_class = CustomRequest


# Include API routers
app.include_router(api_router, prefix="/api/v1")


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """API root endpoint."""
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "status": "running",
        "environment": settings.ENVIRONMENT,
        "docs": "/docs",
    }


# Health check endpoint
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint for monitoring."""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
    }


# Database connection test
@app.get("/health/db", tags=["Health"])
async def database_health():
    """Check database connectivity."""
    from sqlalchemy import text
    from app.core.database import platform_engine, labeler_engine

    try:
        # Test Platform DB connection
        with platform_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        platform_db_status = "connected"
    except Exception as e:
        platform_db_status = f"error: {str(e)}"

    try:
        # Test Labeler DB connection
        with labeler_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        labeler_db_status = "connected"
    except Exception as e:
        labeler_db_status = f"error: {str(e)}"

    return {
        "platform_db": platform_db_status,
        "labeler_db": labeler_db_status,
    }


# Exception handlers
@app.exception_handler(404)
async def not_found_handler(request, exc):
    """Handle 404 errors."""
    return JSONResponse(
        status_code=404,
        content={"detail": "Resource not found"},
    )


@app.exception_handler(500)
async def internal_error_handler(request, exc):
    """Handle 500 errors."""
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# Startup event
@app.on_event("startup")
async def startup_event():
    """Run on application startup."""
    print(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    print(f"Environment: {settings.ENVIRONMENT}")
    print(f"API Docs: http://{settings.API_HOST}:{settings.API_PORT}/docs")

    # Debug: Print actual database configuration
    print("=" * 60)
    print("DATABASE CONFIGURATION (loaded from .env)")
    print("=" * 60)
    print(f"User DB:    {settings.USER_DB_HOST}:{settings.USER_DB_PORT}/{settings.USER_DB_NAME}")
    print(f"Labeler DB: {settings.LABELER_DB_HOST}:{settings.LABELER_DB_PORT}/{settings.LABELER_DB_NAME}")
    print(f"Labeler DB URL: {settings.LABELER_DB_URL}")
    print("=" * 60)


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Run on application shutdown."""
    print(f"Shutting down {settings.APP_NAME}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=settings.API_RELOAD,
        workers=settings.API_WORKERS,
        log_level=settings.LOG_LEVEL.lower(),
    )
