"""
pytest configuration and fixtures for backend API tests.

This module provides:
- FastAPI TestClient fixtures
- Database session fixtures with transaction rollback
- Authentication mocks for Keycloak tokens
- Common test utilities
"""

import pytest
from typing import Generator, Dict, Any
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import get_platform_db, get_labeler_db, PlatformBase, LabelerBase
from app.core.config import settings

# Import fixtures from fixture modules
from backend.tests.fixtures.auth_fixtures import (
    mock_current_user,
    mock_admin_user,
    mock_keycloak_auth,
    override_get_current_user,
    override_get_admin_user,
)
from backend.tests.fixtures.db_fixtures import (
    platform_db_session,
    labeler_db_session,
    test_dataset,
    test_project,
    test_user_id,
    create_project,
    create_dataset,
)


# =============================================================================
# Test Database Engines
# =============================================================================

# Use in-memory SQLite for fast tests
# StaticPool keeps the same connection, so in-memory DB persists
TEST_PLATFORM_DATABASE_URL = "sqlite:///:memory:"
TEST_LABELER_DATABASE_URL = "sqlite:///:memory:"

platform_test_engine = create_engine(
    TEST_PLATFORM_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

labeler_test_engine = create_engine(
    TEST_LABELER_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

PlatformTestSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=platform_test_engine,
)

LabelerTestSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=labeler_test_engine,
)


# =============================================================================
# Database Session Fixtures
# =============================================================================

@pytest.fixture(scope="session", autouse=True)
def setup_test_databases():
    """
    Create all tables in test databases once per test session.

    This runs automatically before any tests.
    """
    # Create all tables
    PlatformBase.metadata.create_all(bind=platform_test_engine)
    LabelerBase.metadata.create_all(bind=labeler_test_engine)

    yield

    # Drop all tables after tests
    PlatformBase.metadata.drop_all(bind=platform_test_engine)
    LabelerBase.metadata.drop_all(bind=labeler_test_engine)


@pytest.fixture
def platform_db() -> Generator[Session, None, None]:
    """
    Provide a platform database session with automatic rollback.

    Each test gets a fresh database state via transaction rollback.
    """
    connection = platform_test_engine.connect()
    transaction = connection.begin()
    session = PlatformTestSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def labeler_db() -> Generator[Session, None, None]:
    """
    Provide a labeler database session with automatic rollback.

    Each test gets a fresh database state via transaction rollback.
    """
    connection = labeler_test_engine.connect()
    transaction = connection.begin()
    session = LabelerTestSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


# =============================================================================
# FastAPI TestClient Fixtures
# =============================================================================

@pytest.fixture
def client(platform_db: Session, labeler_db: Session) -> TestClient:
    """
    Provide FastAPI TestClient with database session overrides.

    Usage:
        def test_endpoint(client):
            response = client.get("/api/v1/health")
            assert response.status_code == 200
    """
    # Override database dependencies
    def override_platform_db():
        try:
            yield platform_db
        finally:
            pass

    def override_labeler_db():
        try:
            yield labeler_db
        finally:
            pass

    app.dependency_overrides[get_platform_db] = override_platform_db
    app.dependency_overrides[get_labeler_db] = override_labeler_db

    with TestClient(app) as test_client:
        yield test_client

    # Clear overrides
    app.dependency_overrides.clear()


@pytest.fixture
def authenticated_client(
    client: TestClient,
    mock_current_user: Dict[str, Any],
    override_get_current_user,
) -> TestClient:
    """
    Provide authenticated TestClient with mocked current user.

    Usage:
        def test_protected_endpoint(authenticated_client):
            response = authenticated_client.get("/api/v1/me")
            assert response.status_code == 200
    """
    return client


@pytest.fixture
def admin_client(
    client: TestClient,
    mock_admin_user: Dict[str, Any],
    override_get_admin_user,
) -> TestClient:
    """
    Provide authenticated TestClient with admin user.

    Usage:
        def test_admin_endpoint(admin_client):
            response = admin_client.get("/api/v1/admin/stats")
            assert response.status_code == 200
    """
    return client


# =============================================================================
# Common Test Utilities
# =============================================================================

@pytest.fixture
def test_headers() -> Dict[str, str]:
    """Provide common test headers."""
    return {
        "Content-Type": "application/json",
        "Authorization": "Bearer test-token-12345",
    }


@pytest.fixture
def sample_annotation_data() -> Dict[str, Any]:
    """Provide sample annotation data for testing."""
    return {
        "image_id": "img_test_001",
        "project_id": "proj_test_001",
        "annotations": [
            {
                "type": "bbox",
                "class_id": "cls_001",
                "coordinates": {"x": 100, "y": 100, "width": 200, "height": 200},
                "attributes": {},
            }
        ],
    }


@pytest.fixture
def sample_project_data() -> Dict[str, Any]:
    """Provide sample project data for testing."""
    return {
        "name": "Test Project",
        "description": "A test project for unit tests",
        "dataset_id": "ds_test_001",
        "task_type": "detection",
        "classes": [
            {
                "name": "person",
                "color": "#FF0000",
            },
            {
                "name": "car",
                "color": "#00FF00",
            },
        ],
    }


# Export all fixtures
__all__ = [
    "client",
    "authenticated_client",
    "admin_client",
    "platform_db",
    "labeler_db",
    "mock_current_user",
    "mock_admin_user",
    "test_headers",
    "sample_annotation_data",
    "sample_project_data",
    "test_dataset",
    "test_project",
    "test_user_id",
]
