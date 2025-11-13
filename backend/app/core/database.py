"""
Database Connection Management

Manages connections to Platform DB (read-only) and Labeler DB (read-write).
"""

from sqlalchemy import create_engine, event, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool

from app.core.config import settings


# =============================================================================
# Platform Database (Read-Only)
# =============================================================================

platform_engine = create_engine(
    settings.PLATFORM_DB_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    poolclass=NullPool if settings.ENVIRONMENT == "test" else None,
)

PlatformSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=platform_engine,
)

PlatformBase = declarative_base()


# TODO: Implement read-only enforcement for Platform DB
# For now, we rely on application logic to prevent writes to Platform DB
# Future: Use PostgreSQL roles with read-only permissions


# =============================================================================
# Labeler Database (Read-Write)
# =============================================================================

labeler_engine = create_engine(
    settings.LABELER_DB_URL,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    poolclass=NullPool if settings.ENVIRONMENT == "test" else None,
)

LabelerSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=labeler_engine,
)

LabelerBase = declarative_base()


# =============================================================================
# Dependency Injection for FastAPI
# =============================================================================

def get_platform_db() -> Session:
    """
    Dependency for accessing Platform database (read-only).

    Usage:
        @app.get("/datasets")
        def get_datasets(db: Session = Depends(get_platform_db)):
            datasets = db.query(Dataset).all()
            return datasets
    """
    db = PlatformSessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_labeler_db() -> Session:
    """
    Dependency for accessing Labeler database (read-write).

    Usage:
        @app.post("/annotations")
        def create_annotation(db: Session = Depends(get_labeler_db)):
            annotation = Annotation(...)
            db.add(annotation)
            db.commit()
            return annotation
    """
    db = LabelerSessionLocal()
    try:
        yield db
    finally:
        db.close()
