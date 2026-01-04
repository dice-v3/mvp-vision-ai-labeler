# Backend API Tests

This directory contains comprehensive unit tests for all backend API endpoints.

## Overview

The test infrastructure provides:
- **FastAPI TestClient** fixtures with database overrides
- **Authentication mocks** for Keycloak token validation
- **Database fixtures** with automatic transaction rollback
- **Factory fixtures** for creating test data
- **Common utilities** for testing API endpoints

## Running Tests

### Quick Start (Limited - SQLite)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
pip install pytest pytest-asyncio pytest-cov

# Run tests (some will be skipped due to SQLite limitations)
pytest tests/

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/api/test_auth.py

# Run with coverage
pytest --cov=app --cov-report=html
```

### Full Test Suite (Recommended - PostgreSQL)

**Important**: Some models use PostgreSQL ARRAY types which are not supported in SQLite. For complete test execution, use PostgreSQL:

```bash
# Option 1: Use Docker (recommended)
docker run -d -p 5432:5432 \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=test_db \
  --name test_postgres \
  postgres:15

# Option 2: Use existing PostgreSQL instance
export TEST_DATABASE_URL="postgresql://user:password@localhost:5432/test_db"

# Then run all tests
pytest tests/

# Run with coverage
pytest tests/ --cov=app --cov-report=html
```

### Known Limitations with SQLite

The following models use PostgreSQL ARRAY types and will cause test setup to fail:

- `Dataset.published_task_types` - affects platform dataset tests
- `AnnotationProject.task_types` - affects project and class management tests
- `AnnotationTask.image_ids` - affects annotation task tests

**Workaround**: Tests will be automatically skipped if database setup fails due to type incompatibility.

## Test Structure

```
tests/
├── conftest.py                 # Main pytest configuration
├── fixtures/                   # Test fixtures
│   ├── __init__.py
│   ├── auth_fixtures.py       # Authentication mocks
│   └── db_fixtures.py         # Database test data factories
├── api/                       # API endpoint tests
│   ├── test_auth.py
│   ├── test_users.py
│   ├── test_projects.py
│   └── ...
└── test_fixtures_setup.py     # Fixture validation tests
```

## Available Fixtures

### Client Fixtures

#### `client`
Basic TestClient with database session overrides.

```python
def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
```

#### `authenticated_client`
TestClient with mocked authenticated user.

```python
def test_protected_endpoint(authenticated_client):
    response = authenticated_client.get("/api/v1/me")
    assert response.status_code == 200
```

#### `admin_client`
TestClient with mocked admin user.

```python
def test_admin_endpoint(admin_client):
    response = admin_client.get("/api/v1/admin/stats")
    assert response.status_code == 200
```

### Database Fixtures

#### `labeler_db` and `platform_db`
Database sessions with automatic transaction rollback.

```python
def test_create_dataset(labeler_db):
    dataset = Dataset(id="ds_test", name="Test")
    labeler_db.add(dataset)
    labeler_db.commit()

    # Automatically rolled back after test
```

#### `test_dataset`
Pre-created test dataset.

```python
def test_with_dataset(labeler_db, test_dataset):
    assert test_dataset.id == "ds_test_001"
    assert test_dataset.num_images == 10
```

#### `test_project`
Pre-created test project with owner permission.

```python
def test_with_project(labeler_db, test_project):
    assert test_project.id == "proj_test_001"
    assert test_project.task_type == "detection"
```

### Factory Fixtures

Create custom test data on demand:

#### `create_dataset`
```python
def test_custom_dataset(labeler_db, create_dataset):
    dataset = create_dataset(
        labeler_db,
        dataset_id="ds_custom",
        name="Custom Dataset",
        num_images=100,
    )
    assert dataset.num_images == 100
```

#### `create_project`
```python
def test_custom_project(labeler_db, create_project):
    project = create_project(
        labeler_db,
        project_id="proj_custom",
        name="Custom Project",
        task_type="segmentation",
    )
    assert project.task_type == "segmentation"
```

#### `create_project_permission`
```python
def test_permissions(labeler_db, test_project, create_project_permission):
    permission = create_project_permission(
        labeler_db,
        project_id=test_project.id,
        user_id="user-123",
        role="annotator",
    )
    assert permission.role == "annotator"
```

#### `create_annotation_class`
```python
def test_annotation_class(labeler_db, test_project, create_annotation_class):
    cls = create_annotation_class(
        labeler_db,
        project_id=test_project.id,
        name="person",
        color="#FF0000",
    )
    assert cls.name == "person"
```

#### `create_annotation`
```python
def test_annotation(labeler_db, create_annotation):
    annotation = create_annotation(
        labeler_db,
        image_id="img_001",
        project_id="proj_test_001",
        annotations_data=[
            {"type": "bbox", "coordinates": {...}}
        ],
    )
    assert len(annotation.annotations) == 1
```

### Authentication Fixtures

#### `mock_current_user`
Mock regular user data.

```python
def test_with_user(mock_current_user):
    assert mock_current_user["email"] == "test@example.com"
    assert mock_current_user["is_admin"] is False
```

#### `mock_admin_user`
Mock admin user data.

```python
def test_with_admin(mock_admin_user):
    assert mock_admin_user["is_admin"] is True
    assert "admin" in mock_admin_user["roles"]
```

#### `create_mock_user`
Factory for custom mock users.

```python
def test_custom_user(create_mock_user):
    user = create_mock_user(
        email="custom@example.com",
        roles=["annotator", "reviewer"],
    )
    assert user["email"] == "custom@example.com"
```

### Utility Fixtures

#### `test_headers`
Common test headers including auth token.

```python
def test_with_headers(client, test_headers):
    response = client.get("/api/v1/me", headers=test_headers)
```

#### `sample_annotation_data`
Sample annotation data for testing.

```python
def test_create_annotation(authenticated_client, sample_annotation_data):
    response = authenticated_client.post(
        "/api/v1/annotations",
        json=sample_annotation_data,
    )
```

#### `sample_project_data`
Sample project data for testing.

```python
def test_create_project(authenticated_client, sample_project_data):
    response = authenticated_client.post(
        "/api/v1/projects",
        json=sample_project_data,
    )
```

## Writing New Tests

### Basic Test Structure

```python
def test_endpoint_name(client):
    """Test description."""
    # Arrange
    # ... setup test data

    # Act
    response = client.get("/api/v1/endpoint")

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["field"] == "expected_value"
```

### Testing Authenticated Endpoints

```python
def test_authenticated_endpoint(authenticated_client, test_project):
    """Test endpoint requiring authentication."""
    response = authenticated_client.get(
        f"/api/v1/projects/{test_project.id}"
    )
    assert response.status_code == 200
```

### Testing Permission Checks

```python
def test_permission_denied(authenticated_client, create_project):
    """Test that users can't access projects they don't have permission for."""
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
```

### Testing Database Operations

```python
def test_create_and_query(labeler_db, test_user_id):
    """Test creating and querying database records."""
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
    result = labeler_db.query(Dataset).filter(Dataset.id == "ds_test").first()
    assert result is not None
    assert result.name == "Test Dataset"
```

## Best Practices

1. **Use fixtures** - Don't duplicate test setup code
2. **Test isolation** - Each test should be independent
3. **Clear naming** - Test names should describe what they test
4. **Arrange-Act-Assert** - Structure tests in three clear phases
5. **One assertion per concept** - Test one thing at a time
6. **Mock external services** - Don't depend on S3, Redis, etc.
7. **Clean up properly** - Fixtures handle cleanup automatically

## Coverage Goals

- **API Endpoints**: 70%+ code coverage
- **Core Business Logic**: 80%+ code coverage
- **Critical Paths**: 100% code coverage

## Troubleshooting

### Tests fail with "No module named 'app'"
Make sure you're running pytest from the `backend` directory.

### Database errors
The test infrastructure uses SQLite in-memory databases. Make sure your models are compatible with SQLite (some PostgreSQL-specific features may need mocking).

### Authentication errors
The test infrastructure mocks Keycloak authentication. If you're testing actual Keycloak integration, you'll need to set up a test Keycloak instance.

### Import errors
Make sure all dependencies are installed:
```bash
uv pip install -e ".[dev]"
# or
pip install -e ".[dev]"
```

## Related Documentation

- [FastAPI Testing Guide](https://fastapi.tiangolo.com/tutorial/testing/)
- [Pytest Documentation](https://docs.pytest.org/)
- [SQLAlchemy Testing](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html#joining-a-session-into-an-external-transaction-such-as-for-test-suites)
