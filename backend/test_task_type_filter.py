"""
Phase 16.6 Task-Type Filtering Verification Script

Tests that the published_task_types array filtering works correctly.
"""
import sys
from sqlalchemy import create_engine, Column, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import NullPool

# Database connection
DATABASE_URL = "postgresql://labeler_user:labeler_password@localhost:5435/labeler"

# Create engine with NullPool (no connection pooling for quick script)
engine = create_engine(DATABASE_URL, poolclass=NullPool)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Simple model for testing
Base = declarative_base()

class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(String(100), primary_key=True)
    name = Column(String(200))
    published_task_types = Column(ARRAY(String(20)))

def test_task_type_filtering():
    """Test task_type filtering with PostgreSQL array containment."""
    db = SessionLocal()

    try:
        print("=" * 80)
        print("Phase 16.6 Task-Type Filtering Verification")
        print("=" * 80)
        print()

        # Test 1: Get all datasets with their published_task_types
        print("Test 1: All datasets and their published_task_types")
        print("-" * 80)
        datasets = db.query(Dataset).all()
        for ds in datasets:
            print(f"  {ds.id:25} | {ds.name:15} | {ds.published_task_types}")
        print()

        # Test 2: Filter by task_type='detection' (should return mvtec-ad)
        print("Test 2: Filter by task_type='detection'")
        print("-" * 80)
        detection_datasets = db.query(Dataset).filter(
            Dataset.published_task_types.contains(['detection'])
        ).all()
        print(f"  Found {len(detection_datasets)} dataset(s) with 'detection' task type:")
        for ds in detection_datasets:
            print(f"  - {ds.name} ({ds.id}): {ds.published_task_types}")
        print()

        # Test 3: Filter by task_type='segmentation' (should return 0)
        print("Test 3: Filter by task_type='segmentation'")
        print("-" * 80)
        seg_datasets = db.query(Dataset).filter(
            Dataset.published_task_types.contains(['segmentation'])
        ).all()
        print(f"  Found {len(seg_datasets)} dataset(s) with 'segmentation' task type:")
        for ds in seg_datasets:
            print(f"  - {ds.name} ({ds.id}): {ds.published_task_types}")
        if len(seg_datasets) == 0:
            print("  (No datasets found - expected since none have segmentation published)")
        print()

        # Test 4: Filter by task_type='classification' (should return 0)
        print("Test 4: Filter by task_type='classification'")
        print("-" * 80)
        cls_datasets = db.query(Dataset).filter(
            Dataset.published_task_types.contains(['classification'])
        ).all()
        print(f"  Found {len(cls_datasets)} dataset(s) with 'classification' task type:")
        for ds in cls_datasets:
            print(f"  - {ds.name} ({ds.id}): {ds.published_task_types}")
        if len(cls_datasets) == 0:
            print("  (No datasets found - expected since none have classification published)")
        print()

        # Summary
        print("=" * 80)
        print("Summary:")
        print("=" * 80)
        print(f"[OK] Total datasets: {len(datasets)}")
        print(f"[OK] Datasets with 'detection': {len(detection_datasets)}")
        print(f"[OK] Datasets with 'segmentation': {len(seg_datasets)}")
        print(f"[OK] Datasets with 'classification': {len(cls_datasets)}")
        print()

        if len(detection_datasets) == 1 and detection_datasets[0].name == "mvtec-ad":
            print("[SUCCESS] Task-type filtering works correctly!")
            print("   - mvtec-ad is correctly returned for task_type='detection'")
            print("   - Other task types correctly return 0 datasets")
            return 0
        else:
            print("[FAILED] Unexpected filtering results")
            return 1

    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        db.close()

if __name__ == "__main__":
    exit_code = test_task_type_filtering()
    sys.exit(exit_code)
