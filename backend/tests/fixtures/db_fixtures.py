"""
Database fixtures for creating test data.

Provides factory fixtures for common database models like datasets,
projects, annotations, etc.
"""

import pytest
from datetime import datetime
from typing import Dict, Any
from sqlalchemy.orm import Session

from app.db.models.labeler import (
    Dataset,
    AnnotationProject,
    ProjectPermission,
    DatasetPermission,
    Annotation,
    ImageMetadata,
)


# =============================================================================
# Session Fixtures (imported from conftest.py)
# =============================================================================

@pytest.fixture
def platform_db_session():
    """
    Platform database session fixture.
    Implemented in conftest.py, re-exported here for convenience.
    """
    pass


@pytest.fixture
def labeler_db_session():
    """
    Labeler database session fixture.
    Implemented in conftest.py, re-exported here for convenience.
    """
    pass


# =============================================================================
# Test Data IDs
# =============================================================================

@pytest.fixture
def test_user_id() -> str:
    """Provide consistent test user ID."""
    return "test-user-id-12345678-1234-1234-1234-123456789abc"


@pytest.fixture
def test_dataset_id() -> str:
    """Provide consistent test dataset ID."""
    return "ds_test_001"


@pytest.fixture
def test_project_id() -> str:
    """Provide consistent test project ID."""
    return "proj_test_001"


# =============================================================================
# Dataset Fixtures
# =============================================================================

@pytest.fixture
def test_dataset(labeler_db: Session, test_user_id: str, test_dataset_id: str) -> Dataset:
    """
    Create a test dataset in the database.

    Usage:
        def test_with_dataset(labeler_db, test_dataset):
            assert test_dataset.id == "ds_test_001"
            assert test_dataset.name == "Test Dataset"
    """
    dataset = Dataset(
        id=test_dataset_id,
        name="Test Dataset",
        description="A test dataset for unit tests",
        owner_id=test_user_id,
        storage_path="s3://datasets/test-dataset",
        storage_type="s3",
        format="images",
        labeled=False,
        num_images=10,
        num_classes=2,
        class_names='["person", "car"]',
        status="active",
        integrity_status="valid",
        visibility="private",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    labeler_db.add(dataset)
    labeler_db.commit()
    labeler_db.refresh(dataset)

    return dataset


@pytest.fixture
def create_dataset():
    """
    Factory fixture to create custom datasets.

    Usage:
        def test_custom_dataset(labeler_db, create_dataset):
            dataset = create_dataset(
                labeler_db,
                dataset_id="ds_custom",
                name="Custom Dataset",
                num_images=100,
            )
    """
    def _create_dataset(
        db: Session,
        dataset_id: str = "ds_custom",
        name: str = "Custom Dataset",
        owner_id: str = "test-user-id",
        num_images: int = 10,
        **kwargs
    ) -> Dataset:
        dataset = Dataset(
            id=dataset_id,
            name=name,
            owner_id=owner_id,
            storage_path=f"s3://datasets/{dataset_id}",
            storage_type="s3",
            format="images",
            num_images=num_images,
            status="active",
            integrity_status="valid",
            **kwargs
        )
        db.add(dataset)
        db.commit()
        db.refresh(dataset)
        return dataset

    return _create_dataset


# =============================================================================
# Project Fixtures
# =============================================================================

@pytest.fixture
def test_project(
    labeler_db: Session,
    test_dataset: Dataset,
    test_user_id: str,
    test_project_id: str,
) -> AnnotationProject:
    """
    Create a test annotation project in the database.

    Usage:
        def test_with_project(labeler_db, test_project):
            assert test_project.id == "proj_test_001"
            assert test_project.name == "Test Project"
    """
    project = AnnotationProject(
        id=test_project_id,
        name="Test Project",
        description="A test project for unit tests",
        dataset_id=test_dataset.id,
        owner_id=test_user_id,
        task_types=["detection"],
        task_config={"detection": {"show_labels": True}},
        task_classes={},
        settings={},
        total_images=test_dataset.num_images,
        status="active",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    labeler_db.add(project)
    labeler_db.commit()
    labeler_db.refresh(project)

    # Create owner permission
    permission = ProjectPermission(
        project_id=project.id,
        user_id=test_user_id,
        role="owner",
        granted_at=datetime.utcnow(),
        granted_by=test_user_id,
    )
    labeler_db.add(permission)
    labeler_db.commit()

    return project


@pytest.fixture
def create_project():
    """
    Factory fixture to create custom projects.

    Usage:
        def test_custom_project(labeler_db, create_project):
            project = create_project(
                labeler_db,
                project_id="proj_custom",
                name="Custom Project",
                task_types=["segmentation"],
                task_config={"segmentation": {"show_labels": True}},
            )
    """
    def _create_project(
        db: Session,
        project_id: str = "proj_custom",
        name: str = "Custom Project",
        dataset_id: str = "ds_test_001",
        owner_id: str = "test-user-id",
        task_types: list = None,
        task_config: dict = None,
        task_classes: dict = None,
        **kwargs
    ) -> AnnotationProject:
        if task_types is None:
            task_types = ["detection"]
        if task_config is None:
            task_config = {"detection": {"show_labels": True}}
        if task_classes is None:
            task_classes = {}

        project = AnnotationProject(
            id=project_id,
            name=name,
            dataset_id=dataset_id,
            owner_id=owner_id,
            task_types=task_types,
            task_config=task_config,
            task_classes=task_classes,
            settings={},
            total_images=10,
            status="active",
            **kwargs
        )
        db.add(project)
        db.commit()
        db.refresh(project)

        # Create owner permission
        permission = ProjectPermission(
            project_id=project.id,
            user_id=owner_id,
            role="owner",
            granted_at=datetime.utcnow(),
            granted_by=owner_id,
        )
        db.add(permission)
        db.commit()

        return project

    return _create_project


# =============================================================================
# Permission Fixtures
# =============================================================================

@pytest.fixture
def create_project_permission():
    """
    Factory fixture to create project permissions.

    Usage:
        def test_permissions(labeler_db, create_project_permission):
            permission = create_project_permission(
                labeler_db,
                project_id="proj_test_001",
                user_id="user-123",
                role="annotator",
            )
    """
    def _create_permission(
        db: Session,
        project_id: str,
        user_id: str,
        role: str = "viewer",
    ) -> ProjectPermission:
        permission = ProjectPermission(
            project_id=project_id,
            user_id=user_id,
            role=role,
            granted_at=datetime.utcnow(),
            granted_by="test-admin-id",
        )
        db.add(permission)
        db.commit()
        db.refresh(permission)
        return permission

    return _create_permission


@pytest.fixture
def create_dataset_permission():
    """
    Factory fixture to create dataset permissions.

    Usage:
        def test_dataset_access(labeler_db, create_dataset_permission):
            permission = create_dataset_permission(
                labeler_db,
                dataset_id="ds_test_001",
                user_id="user-123",
                role="member",
            )
    """
    def _create_permission(
        db: Session,
        dataset_id: str,
        user_id: str,
        role: str = "member",
    ) -> DatasetPermission:
        permission = DatasetPermission(
            dataset_id=dataset_id,
            user_id=user_id,
            role=role,
            granted_at=datetime.utcnow(),
        )
        db.add(permission)
        db.commit()
        db.refresh(permission)
        return permission

    return _create_permission


# =============================================================================
# Annotation Class Fixtures
# =============================================================================

@pytest.fixture
def create_annotation_class():
    """
    Factory fixture to add annotation classes to a project.

    Note: Classes are stored in task_classes JSONB field, not as separate models.

    Usage:
        def test_classes(labeler_db, create_annotation_class):
            cls_dict = create_annotation_class(
                labeler_db,
                project_id="proj_test_001",
                task_type="detection",
                name="person",
                color="#FF0000",
            )
    """
    def _create_class(
        db: Session,
        project_id: str,
        task_type: str = "detection",
        class_id: str = None,
        name: str = "test_class",
        color: str = "#FF0000",
        order: int = None,
        **kwargs
    ) -> Dict[str, Any]:
        if class_id is None:
            class_id = f"cls_{name}"

        # Get the project
        project = db.query(AnnotationProject).filter(AnnotationProject.id == project_id).first()
        if not project:
            raise ValueError(f"Project {project_id} not found")

        # Initialize task_classes if not exists
        if project.task_classes is None:
            project.task_classes = {}

        # Initialize task type if not exists
        if task_type not in project.task_classes:
            project.task_classes[task_type] = []

        # Determine order if not provided
        if order is None:
            order = len(project.task_classes[task_type])

        # Create class dict
        class_dict = {
            "id": class_id,
            "name": name,
            "color": color,
            "order": order,
            **kwargs
        }

        # Add to task_classes
        project.task_classes[task_type].append(class_dict)

        # Mark as modified for SQLAlchemy to detect change
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(project, "task_classes")

        db.commit()
        db.refresh(project)
        return class_dict

    return _create_class


# =============================================================================
# Annotation Fixtures
# =============================================================================

@pytest.fixture
def create_annotation():
    """
    Factory fixture to create annotations.

    Usage:
        def test_annotations(labeler_db, create_annotation):
            annotation = create_annotation(
                labeler_db,
                image_id="img_001",
                project_id="proj_test_001",
                annotation_type="bbox",
                geometry={"x": 100, "y": 100, "width": 200, "height": 200},
            )
    """
    def _create_annotation(
        db: Session,
        annotation_id: str = None,
        image_id: str = "img_test_001",
        project_id: str = "proj_test_001",
        user_id: str = "test-user-id",
        annotation_type: str = "bbox",
        geometry: dict = None,
        class_id: str = None,
        task_type: str = "detection",
        **kwargs
    ) -> Annotation:
        if annotation_id is None:
            import uuid
            annotation_id = f"ann_{uuid.uuid4().hex[:8]}"

        if geometry is None:
            geometry = {"x": 100, "y": 100, "width": 200, "height": 200}

        annotation = Annotation(
            id=annotation_id,
            image_id=image_id,
            project_id=project_id,
            created_by=user_id,
            annotation_type=annotation_type,
            geometry=geometry,
            class_id=class_id,
            task_type=task_type,
            version=1,
            is_confirmed=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            **kwargs
        )
        db.add(annotation)
        db.commit()
        db.refresh(annotation)
        return annotation

    return _create_annotation


# Export all fixtures
__all__ = [
    "platform_db_session",
    "labeler_db_session",
    "test_user_id",
    "test_dataset_id",
    "test_project_id",
    "test_dataset",
    "test_project",
    "create_dataset",
    "create_project",
    "create_project_permission",
    "create_dataset_permission",
    "create_annotation_class",
    "create_annotation",
]
