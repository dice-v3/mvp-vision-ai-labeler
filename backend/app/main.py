"""
Vision AI Labeler - Backend API

Main FastAPI application entry point.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Backend API for Vision AI Labeler - Web-based annotation tool",
    docs_url="/docs",
    redoc_url="/redoc",
)


# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
