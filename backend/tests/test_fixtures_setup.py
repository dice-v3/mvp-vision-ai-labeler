"""
Test to verify that the test fixtures are properly set up.

This is a smoke test to ensure all the basic fixtures work correctly.
"""

import pytest
from fastapi.testclient import TestClient


def test_client_fixture(client):
    """Test that the basic client fixture works."""
    assert client is not None
    assert isinstance(client, TestClient)


def test_authenticated_client_fixture(authenticated_client, mock_current_user):
    """Test that the authenticated client fixture works."""
    assert authenticated_client is not None
    assert mock_current_user["email"] == "test@example.com"
    assert mock_current_user["is_admin"] is False


def test_admin_client_fixture(admin_client, mock_admin_user):
    """Test that the admin client fixture works."""
    assert admin_client is not None
    assert mock_admin_user["is_admin"] is True
    assert "admin" in mock_admin_user["roles"]


def test_database_fixtures(labeler_db, platform_db):
    """Test that database fixtures are available."""
    assert labeler_db is not None
    assert platform_db is not None


def test_test_dataset_fixture(test_dataset, labeler_db):
    """Test that test_dataset fixture creates a dataset."""
    assert test_dataset is not None
    assert test_dataset.id == "ds_test_001"
    assert test_dataset.name == "Test Dataset"
    assert test_dataset.num_images == 10

    # Verify it's in the database
    from app.db.models.labeler import Dataset
    db_dataset = labeler_db.query(Dataset).filter(Dataset.id == test_dataset.id).first()
    assert db_dataset is not None
    assert db_dataset.name == test_dataset.name


def test_test_project_fixture(test_project, labeler_db):
    """Test that test_project fixture creates a project."""
    assert test_project is not None
    assert test_project.id == "proj_test_001"
    assert test_project.name == "Test Project"
    assert test_project.task_type == "detection"

    # Verify it's in the database
    from app.db.models.labeler import AnnotationProject
    db_project = (
        labeler_db.query(AnnotationProject)
        .filter(AnnotationProject.id == test_project.id)
        .first()
    )
    assert db_project is not None
    assert db_project.name == test_project.name


def test_health_endpoint(client):
    """Test the health endpoint to verify client is working."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


def test_root_endpoint(client):
    """Test the root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "name" in data
    assert "version" in data
    assert data["status"] == "running"
