# Backend Testing Guide

This document provides comprehensive guidelines for writing and maintaining tests for the Vision AI Labeler backend API.

## Table of Contents

- [Overview](#overview)
- [Testing Stack](#testing-stack)
- [Running Tests](#running-tests)
- [Test Structure](#test-structure)
- [Testing Patterns](#testing-patterns)
- [Best Practices](#best-practices)
- [Common Scenarios](#common-scenarios)
- [Troubleshooting](#troubleshooting)

## Overview

The backend uses comprehensive API endpoint testing with:

- **1,000+ tests** across 17 API endpoint modules
- **70% coverage threshold** for API endpoints
- FastAPI TestClient with database fixtures
- Mock authentication (no real Keycloak needed)
- Automatic transaction rollback for test isolation

### Test Coverage

| Module | Tests | Coverage |
|--------|-------|----------|
| Auth endpoints | 12 | Authentication, token validation |
| User endpoints | 54 | User CRUD, search, permissions |
| Project endpoints | 85+ | Project CRUD, stats, images |
| Project permissions | 38 | RBAC, role management |
| Project classes | 48 | Class CRUD, reordering |
| Dataset endpoints | 94 | Dataset CRUD, images, stats |
| Platform datasets | 40 | Service-to-service API |
| Admin datasets | 41 | Admin dashboard, analytics |
| Annotations | 52 | CRUD, versioning, batch ops |
| Image locks | 60+ | Locking, expiration, heartbeat |
| Version diff | 60+ | Version comparison, conflicts |
| Export | 60+ | COCO/YOLO/DICE export |
| Invitations | 70+ | Create, accept, cancel |
| Admin stats | 48 | System metrics, analytics |
| Admin audit | 60+ | Audit logs, filtering |
| **Total** | **1,000+** | **Comprehensive** |

## Testing Stack

### Core Tools

- **[pytest](https://pytest.org/)** (v7.4+) - Python testing framework
- **[pytest-asyncio](https://pytest-asyncio.readthedocs.io/)** - Async test support
- **[FastAPI TestClient](https://fastapi.tiangolo.com/tutorial/testing/)** - HTTP client for testing
- **[SQLAlchemy](https://www.sqlalchemy.org/)** - Database ORM

### Coverage & Reporting

- **[pytest-cov](https://pytest-cov.readthedocs.io/)** - Coverage reporting
- **Coverage.py** - Code coverage measurement

## Running Tests

### Quick Start (SQLite - Limited)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pip install pytest pytest-asyncio pytest-cov

# Run all tests (some may be skipped)
pytest tests/

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/api/test_auth.py

# Run specific test
pytest tests/api/test_auth.py::TestGetCurrentUserInfo::test_get_me_with_valid_token
```

### Full Test Suite (PostgreSQL - Recommended)

**Important**: Some models use PostgreSQL ARRAY types. For complete test execution:

```bash
# Option 1: Docker (recommended)
docker run -d -p 5432:5432 \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=test_db \
  --name test_postgres \
  postgres:15

# Option 2: Existing PostgreSQL
export TEST_DATABASE_URL="postgresql://user:password@localhost:5432/test_db"

# Run all tests
pytest tests/

# Run with coverage
pytest tests/ --cov=app --cov-report=html
```

### Coverage Reports

After running with `--cov-report=html`, open `htmlcov/index.html` to view the detailed coverage report.

```bash
# Generate HTML coverage report
pytest tests/ --cov=app --cov-report=html

# Open report (macOS)
open htmlcov/index.html

# Open report (Linux)
xdg-open htmlcov/index.html
```

## Test Structure

### Directory Organization

```
backend/
├── app/
│   ├── api/              # API endpoints
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── projects.py
│   │   └── ...
│   ├── core/             # Core functionality
│   ├── db/               # Database models
│   └── services/         # Business logic
├── tests/
│   ├── conftest.py       # Pytest configuration & fixtures
│   ├── fixtures/         # Test fixtures
│   │   ├── __init__.py
│   │   ├── auth_fixtures.py
│   │   └── db_fixtures.py
│   ├── api/              # API endpoint tests
│   │   ├── test_auth.py
│   │   ├── test_users.py
│   │   ├── test_projects.py
│   │   └── ...
│   └── README.md         # Test documentation
└── pytest.ini            # Pytest configuration (optional)
```

### Test File Naming

- API tests: `test_<endpoint>.py` (e.g., `test_auth.py`)
- Service tests: `test_<service_name>.py`
- Utility tests: `test_<utility_name>.py`

## Testing Patterns

### 1. Basic API Test Pattern

```python
"""
Tests for <endpoint> endpoints.

Description of what this module tests.
"""

import pytest
from fastapi.testclient import TestClient


class TestEndpointName:
    """Test cases for <specific endpoint>."""

    def test_endpoint_success(self, authenticated_client, test_project):
        """
        Test endpoint with valid data.

        Should return 200 and correct response structure.
        """
        # Arrange
        endpoint = f"/api/v1/projects/{test_project.id}"

        # Act
        response = authenticated_client.get(endpoint)

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_project.id
        assert data["name"] == test_project.name
```

### 2. Testing Authentication

```python
def test_unauthenticated_access(self, client):
    """Test endpoint without authentication token."""
    response = client.get("/api/v1/protected-endpoint")

    assert response.status_code == 403
    assert "detail" in response.json()


def test_authenticated_access(self, authenticated_client):
    """Test endpoint with authentication."""
    response = authenticated_client.get("/api/v1/protected-endpoint")

    assert response.status_code == 200


def test_admin_only_access(self, authenticated_client, admin_client):
    """Test admin-only endpoint."""
    # Regular user denied
    response = authenticated_client.get("/api/v1/admin/stats")
    assert response.status_code == 403

    # Admin user allowed
    response = admin_client.get("/api/v1/admin/stats")
    assert response.status_code == 200
```

### 3. Testing with Database Fixtures

```python
def test_create_and_query(self, labeler_db, test_user_id):
    """Test database operations."""
    from app.db.models.labeler import Dataset

    # Create
    dataset = Dataset(
        id="ds_test",
        name="Test Dataset",
        owner_id=test_user_id,
        storage_path="s3://test",
        storage_type="s3",
        num_images=0,
    )
    labeler_db.add(dataset)
    labeler_db.commit()

    # Query
    result = labeler_db.query(Dataset).filter(
        Dataset.id == "ds_test"
    ).first()

    assert result is not None
    assert result.name == "Test Dataset"
```

### 4. Testing CRUD Operations

```python
class TestProjectCRUD:
    """Test project CRUD operations."""

    def test_create_project(self, authenticated_client, sample_project_data):
        """Test creating a new project."""
        response = authenticated_client.post(
            "/api/v1/projects",
            json=sample_project_data
        )

        assert response.status_code == 201
        data = response.json()
        assert data["name"] == sample_project_data["name"]
        assert "id" in data

    def test_get_project(self, authenticated_client, test_project):
        """Test retrieving a project."""
        response = authenticated_client.get(
            f"/api/v1/projects/{test_project.id}"
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == test_project.id

    def test_update_project(self, authenticated_client, test_project):
        """Test updating a project."""
        update_data = {"name": "Updated Name"}

        response = authenticated_client.patch(
            f"/api/v1/projects/{test_project.id}",
            json=update_data
        )

        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"

    def test_delete_project(self, authenticated_client, test_project):
        """Test deleting a project."""
        response = authenticated_client.delete(
            f"/api/v1/projects/{test_project.id}"
        )

        assert response.status_code == 204
```

### 5. Testing Permissions

```python
def test_permission_required(
    self,
    authenticated_client,
    labeler_db,
    create_project,
):
    """Test that users can't access projects without permission."""
    # Create project owned by different user
    other_project = create_project(
        labeler_db,
        project_id="proj_other",
        owner_id="other-user-id",
    )

    # Attempt to access should fail
    response = authenticated_client.get(
        f"/api/v1/projects/{other_project.id}"
    )
    assert response.status_code == 403


def test_role_based_access(
    self,
    labeler_db,
    test_project,
    create_project_permission,
    create_mock_user,
):
    """Test role-based access control."""
    from app.main import app
    from app.core.security import get_current_user

    # Create user with viewer role
    viewer = create_mock_user(
        user_id="viewer-123",
        roles=["user"],
    )
    create_project_permission(
        labeler_db,
        project_id=test_project.id,
        user_id="viewer-123",
        role="viewer",
    )

    # Mock authentication
    async def mock_viewer():
        return viewer

    app.dependency_overrides[get_current_user] = mock_viewer

    try:
        client = TestClient(app)

        # Viewer can read
        response = client.get(f"/api/v1/projects/{test_project.id}")
        assert response.status_code == 200

        # Viewer cannot update
        response = client.patch(
            f"/api/v1/projects/{test_project.id}",
            json={"name": "New Name"}
        )
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()
```

### 6. Testing Pagination

```python
def test_pagination(self, authenticated_client, labeler_db, create_project):
    """Test pagination parameters."""
    # Create multiple projects
    for i in range(15):
        create_project(
            labeler_db,
            project_id=f"proj_{i}",
            name=f"Project {i}",
        )

    # Test default pagination
    response = authenticated_client.get("/api/v1/projects")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) <= 100  # Default limit

    # Test custom pagination
    response = authenticated_client.get(
        "/api/v1/projects?skip=5&limit=5"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 5
```

### 7. Testing Error Handling

```python
def test_not_found_error(self, authenticated_client):
    """Test 404 error for non-existent resource."""
    response = authenticated_client.get(
        "/api/v1/projects/proj_nonexistent"
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data


def test_validation_error(self, authenticated_client):
    """Test 422 validation error."""
    invalid_data = {"name": ""}  # Empty name not allowed

    response = authenticated_client.post(
        "/api/v1/projects",
        json=invalid_data
    )

    assert response.status_code == 422
    data = response.json()
    assert "detail" in data
```

### 8. Testing with Mocks

```python
from unittest.mock import patch, MagicMock


def test_with_external_service_mock(self, authenticated_client, test_project):
    """Test with mocked external service."""
    with patch('app.services.storage.StorageClient') as mock_storage:
        # Configure mock
        mock_storage.return_value.upload.return_value = "s3://bucket/file"

        # Make request
        response = authenticated_client.post(
            f"/api/v1/projects/{test_project.id}/upload"
        )

        # Verify mock was called
        assert response.status_code == 200
        mock_storage.return_value.upload.assert_called_once()
```

## Best Practices

### 1. Test Organization

- **Group related tests** using classes
- **Use descriptive test names** that explain what is being tested
- **Follow AAA pattern**: Arrange, Act, Assert
- **One concept per test** - test one thing at a time

```python
class TestProjectPermissions:
    """Test project permission endpoints."""

    def test_list_permissions_success(self, authenticated_client, test_project):
        """
        Test listing project permissions with viewer role.

        Should return list of all project members with their roles.
        """
        # Arrange
        endpoint = f"/api/v1/projects/{test_project.id}/permissions"

        # Act
        response = authenticated_client.get(endpoint)

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert all("role" in member for member in data)
```

### 2. Fixture Management

- **Use fixtures for common setup**: Don't duplicate code
- **Keep fixtures focused**: One fixture, one purpose
- **Clean up automatically**: Fixtures handle cleanup
- **Leverage fixture scope**: Use appropriate scope (function/module/session)

```python
@pytest.fixture
def test_annotation(labeler_db, test_project, test_user_id):
    """Create a test annotation."""
    from app.db.models.labeler import Annotation

    annotation = Annotation(
        id="ann_test_001",
        project_id=test_project.id,
        image_id="img_001",
        created_by=test_user_id,
        annotations=[{
            "type": "bbox",
            "coordinates": {"x": 10, "y": 10, "width": 50, "height": 50}
        }]
    )
    labeler_db.add(annotation)
    labeler_db.commit()

    yield annotation

    # Cleanup happens automatically via transaction rollback
```

### 3. Database Testing

- **Use transaction rollback**: Each test starts with clean state
- **Don't rely on test order**: Tests should be independent
- **Test database constraints**: Verify unique constraints, foreign keys
- **Test edge cases**: NULL values, empty strings, large values

```python
def test_unique_constraint(self, labeler_db, test_dataset):
    """Test that duplicate IDs are rejected."""
    from app.db.models.labeler import Dataset
    from sqlalchemy.exc import IntegrityError

    duplicate = Dataset(
        id=test_dataset.id,  # Duplicate ID
        name="Duplicate",
        owner_id="user-123",
        storage_path="s3://test",
        storage_type="s3",
        num_images=0,
    )
    labeler_db.add(duplicate)

    with pytest.raises(IntegrityError):
        labeler_db.commit()
```

### 4. Testing Async Code

```python
import pytest


@pytest.mark.asyncio
async def test_async_operation():
    """Test asynchronous operation."""
    from app.services.async_service import process_data

    result = await process_data({"key": "value"})

    assert result["status"] == "success"
```

### 5. Parametrized Tests

Test multiple scenarios with one test function:

```python
@pytest.mark.parametrize("role,expected_status", [
    ("owner", 200),
    ("admin", 200),
    ("reviewer", 200),
    ("annotator", 403),
    ("viewer", 403),
])
def test_permission_by_role(
    self,
    role,
    expected_status,
    labeler_db,
    test_project,
    create_project_permission,
    create_mock_user,
):
    """Test access control for different roles."""
    from app.main import app
    from app.core.security import get_current_user

    user = create_mock_user(user_id=f"user-{role}")
    create_project_permission(
        labeler_db,
        project_id=test_project.id,
        user_id=user["sub"],
        role=role,
    )

    async def mock_user():
        return user

    app.dependency_overrides[get_current_user] = mock_user

    try:
        client = TestClient(app)
        response = client.patch(
            f"/api/v1/projects/{test_project.id}",
            json={"name": "Updated"}
        )
        assert response.status_code == expected_status
    finally:
        app.dependency_overrides.clear()
```

### 6. Test Data Management

- **Use factories** for creating test data
- **Make IDs descriptive**: `test_project.id = "proj_test_001"`
- **Keep data minimal**: Only create what's needed for the test
- **Use realistic values**: Test with data similar to production

```python
def create_test_annotation(
    project_id: str,
    image_id: str,
    annotation_type: str = "bbox",
    **kwargs
):
    """Factory function for test annotations."""
    defaults = {
        "type": annotation_type,
        "coordinates": {"x": 10, "y": 10, "width": 50, "height": 50},
        "class": "person",
        "confidence": 0.95,
    }
    defaults.update(kwargs)

    return {
        "project_id": project_id,
        "image_id": image_id,
        "annotation": defaults,
    }
```

## Common Scenarios

### Testing File Uploads

```python
from io import BytesIO


def test_file_upload(self, authenticated_client):
    """Test file upload endpoint."""
    file_content = b"fake image content"
    file = BytesIO(file_content)

    response = authenticated_client.post(
        "/api/v1/upload",
        files={"file": ("test.jpg", file, "image/jpeg")}
    )

    assert response.status_code == 200
    data = response.json()
    assert "url" in data
```

### Testing Batch Operations

```python
def test_batch_create(self, authenticated_client, test_project):
    """Test batch annotation creation."""
    annotations = [
        {"image_id": "img_001", "type": "bbox", ...},
        {"image_id": "img_002", "type": "bbox", ...},
        {"image_id": "img_003", "type": "bbox", ...},
    ]

    response = authenticated_client.post(
        f"/api/v1/projects/{test_project.id}/annotations/batch",
        json={"annotations": annotations}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["created"] == 3
    assert data["failed"] == 0
```

### Testing Filtering

```python
@pytest.mark.parametrize("filter_param,expected_count", [
    ("status=completed", 5),
    ("status=pending", 3),
    ("task_type=detection", 10),
    ("visibility=public", 7),
])
def test_filtering(
    self,
    filter_param,
    expected_count,
    authenticated_client,
    labeler_db,
    create_dataset,
):
    """Test dataset filtering."""
    # Create test datasets
    # ... setup code ...

    response = authenticated_client.get(
        f"/api/v1/datasets?{filter_param}"
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == expected_count
```

### Testing Optimistic Locking

```python
def test_version_conflict(
    self,
    authenticated_client,
    test_annotation,
):
    """Test optimistic locking with version conflict."""
    # First update succeeds
    response1 = authenticated_client.put(
        f"/api/v1/annotations/{test_annotation.id}",
        json={"version": 1, "data": "update 1"}
    )
    assert response1.status_code == 200

    # Second update with stale version fails
    response2 = authenticated_client.put(
        f"/api/v1/annotations/{test_annotation.id}",
        json={"version": 1, "data": "update 2"}  # Stale version
    )
    assert response2.status_code == 409  # Conflict
```

## Troubleshooting

### PostgreSQL ARRAY Type Errors

**Error**: "OperationalError: (sqlite3.OperationalError) no such table: ..."

**Cause**: SQLite doesn't support PostgreSQL ARRAY types used in some models:
- `Dataset.published_task_types`
- `AnnotationProject.task_types`
- `AnnotationTask.image_ids`

**Solution**: Use PostgreSQL for complete test execution (see [Running Tests](#running-tests))

### Fixture Not Found

**Error**: "fixture 'fixture_name' not found"

**Solution**:
1. Check fixture is defined in `conftest.py` or imported
2. Verify fixture scope is appropriate
3. Check for typos in fixture name

### Database Session Errors

**Error**: "Object is already attached to session"

**Solution**:
1. Use `labeler_db.merge(obj)` instead of `labeler_db.add(obj)`
2. Ensure proper session management
3. Clear session between tests with `labeler_db.rollback()`

### Mock Not Working

**Error**: Mock is not being called or wrong behavior

**Solution**:
1. Verify import path matches exactly
2. Use `patch` before the code that imports the module
3. Check mock is configured correctly
4. Use `mock.assert_called_once()` to debug

```python
# Verify mock calls
print(mock_function.call_count)
print(mock_function.call_args_list)
```

### Tests Interfering with Each Other

**Issue**: Tests pass individually but fail when run together

**Solution**:
1. Use `vi.clearAllMocks()` in `beforeEach`
2. Ensure database transactions rollback properly
3. Check for global state modifications
4. Use `--tb=short` to see where tests fail

```bash
pytest tests/api/ -vv --tb=short
```

## Available Fixtures

### Client Fixtures

- `client` - Basic TestClient
- `authenticated_client` - TestClient with regular user auth
- `admin_client` - TestClient with admin user auth

### Database Fixtures

- `labeler_db` - Labeler database session
- `platform_db` - Platform database session
- `test_user_id` - Test user ID constant

### Pre-created Data Fixtures

- `test_dataset` - Pre-created dataset
- `test_project` - Pre-created project
- `test_annotation` - Pre-created annotation

### Factory Fixtures

- `create_dataset` - Create custom dataset
- `create_project` - Create custom project
- `create_project_permission` - Create permission
- `create_annotation_class` - Create annotation class
- `create_annotation` - Create annotation

### Authentication Fixtures

- `mock_current_user` - Regular user data
- `mock_admin_user` - Admin user data
- `create_mock_user` - Create custom user

See [backend/tests/README.md](./tests/README.md) for detailed fixture documentation.

## Coverage Goals

| Area | Threshold | Target |
|------|-----------|--------|
| API Endpoints | 70% | 85%+ |
| Services | 70% | 80%+ |
| Utilities | 70% | 90%+ |

**Priority Areas**:
- ✅ All 15 API endpoint modules
- 🎯 Service layer business logic
- 🎯 Database models and relationships

## Additional Resources

- [FastAPI Testing Guide](https://fastapi.tiangolo.com/tutorial/testing/)
- [Pytest Documentation](https://docs.pytest.org/)
- [SQLAlchemy Testing](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html)
- [Backend Tests README](./tests/README.md)

## Contributing

When adding new features:

1. ✅ Write tests for new endpoints/services
2. ✅ Follow existing test patterns
3. ✅ Maintain 70%+ coverage
4. ✅ Run tests before committing: `pytest tests/`
5. ✅ Update this guide if introducing new patterns

---

**Last Updated**: 2026-01-04
**Test Count**: 1,000+ tests across 17 API modules
**Coverage**: 70%+ target for API endpoints
