"""
Phase 16.6 Task-Specific Statistics Test

Verifies that task_type parameter returns task-specific statistics,
not dataset-level statistics.
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.db.models.labeler import Dataset, AnnotationProject, AnnotationVersion
from app.api.v1.endpoints.platform_datasets import _dataset_to_platform_response

# Database connection
DATABASE_URL = "postgresql://labeler_user:labeler_password@localhost:5435/labeler"
engine = create_engine(DATABASE_URL, poolclass=NullPool)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def test_task_specific_statistics():
    """Test that task_type parameter returns correct statistics."""
    db = SessionLocal()

    try:
        print("=" * 80)
        print("Phase 16.6 Task-Specific Statistics Verification")
        print("=" * 80)
        print()

        # Get mvtec-ad dataset
        dataset = db.query(Dataset).filter(Dataset.id == 'ds_c75023ca76d7448b').first()
        if not dataset:
            print("[ERROR] mvtec-ad dataset not found")
            return 1

        print("Test 1: Dataset-level statistics (no task_type)")
        print("-" * 80)
        response_all = _dataset_to_platform_response(dataset, db=db, task_type=None)
        print(f"  Dataset name: {response_all.name}")
        print(f"  num_images: {response_all.num_images}")
        print(f"  annotation_path: {response_all.annotation_path}")
        print(f"  published_task_types: {response_all.published_task_types}")
        print()

        # Get detection task statistics
        project = db.query(AnnotationProject).filter(
            AnnotationProject.dataset_id == dataset.id
        ).first()

        if not project:
            print("[ERROR] Project not found for mvtec-ad")
            return 1

        latest_detection = (
            db.query(AnnotationVersion)
            .filter(
                AnnotationVersion.project_id == project.id,
                AnnotationVersion.task_type == 'detection',
            )
            .order_by(AnnotationVersion.created_at.desc())
            .first()
        )

        if not latest_detection:
            print("[ERROR] No detection versions found")
            return 1

        print("Expected detection statistics from AnnotationVersion:")
        print("-" * 80)
        print(f"  version_number: {latest_detection.version_number}")
        print(f"  image_count: {latest_detection.image_count}")
        print(f"  annotation_count: {latest_detection.annotation_count}")
        print(f"  export_path: {latest_detection.export_path}")
        print()

        print("Test 2: Task-specific statistics (task_type='detection')")
        print("-" * 80)
        response_detection = _dataset_to_platform_response(dataset, db=db, task_type='detection')
        print(f"  Dataset name: {response_detection.name}")
        print(f"  num_images: {response_detection.num_images}")
        print(f"  annotation_path: {response_detection.annotation_path}")
        print(f"  published_task_types: {response_detection.published_task_types}")
        print()

        print("Test 3: Non-existent task_type (task_type='segmentation')")
        print("-" * 80)
        response_seg = _dataset_to_platform_response(dataset, db=db, task_type='segmentation')
        print(f"  Dataset name: {response_seg.name}")
        print(f"  num_images: {response_seg.num_images} (should be dataset-level)")
        print(f"  annotation_path: {response_seg.annotation_path} (should be dataset-level)")
        print()

        # Validation
        print("=" * 80)
        print("Validation:")
        print("=" * 80)

        success = True

        # Check 1: task_type='detection' returns task-specific image count
        if response_detection.num_images == latest_detection.image_count:
            print(f"[OK] task_type='detection' returns task-specific num_images: {response_detection.num_images}")
        else:
            print(f"[FAIL] Expected {latest_detection.image_count}, got {response_detection.num_images}")
            success = False

        # Check 2: task_type='detection' returns task-specific annotation_path
        if response_detection.annotation_path == latest_detection.export_path:
            print(f"[OK] task_type='detection' returns task-specific annotation_path")
        else:
            print(f"[FAIL] Expected {latest_detection.export_path}, got {response_detection.annotation_path}")
            success = False

        # Check 3: No task_type returns dataset-level statistics
        if response_all.num_images == dataset.num_images:
            print(f"[OK] No task_type returns dataset-level num_images: {response_all.num_images}")
        else:
            print(f"[FAIL] Expected {dataset.num_images}, got {response_all.num_images}")
            success = False

        print()
        if success:
            print("[SUCCESS] All tests passed!")
            return 0
        else:
            print("[FAILED] Some tests failed")
            return 1

    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        db.close()

if __name__ == "__main__":
    exit_code = test_task_specific_statistics()
    sys.exit(exit_code)
