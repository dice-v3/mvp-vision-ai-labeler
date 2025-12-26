"""
Phase 16.6 Storage Info in Export Test

Verifies that annotation exports include storage_info for Platform integration.
"""
import json
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.services.dice_export_service import export_to_dice
from app.services.coco_export_service import export_to_coco

# Database connections
LABELER_DB_URL = "postgresql://labeler_user:labeler_password@localhost:5435/labeler"
PLATFORM_DB_URL = "postgresql://admin:devpass@localhost:5432/platform"
USER_DB_URL = "postgresql://admin:devpass@localhost:5433/users"

labeler_engine = create_engine(LABELER_DB_URL, poolclass=NullPool)
platform_engine = create_engine(PLATFORM_DB_URL, poolclass=NullPool)
user_engine = create_engine(USER_DB_URL, poolclass=NullPool)

LabelerSession = sessionmaker(autocommit=False, autoflush=False, bind=labeler_engine)
PlatformSession = sessionmaker(autocommit=False, autoflush=False, bind=platform_engine)
UserSession = sessionmaker(autocommit=False, autoflush=False, bind=user_engine)

def test_storage_info_in_exports():
    """Test that annotation exports include storage_info."""
    labeler_db = LabelerSession()
    platform_db = PlatformSession()
    user_db = UserSession()

    try:
        print("=" * 80)
        print("Phase 16.6 Storage Info in Annotation Export Test")
        print("=" * 80)
        print()

        project_id = "proj_026c67eeafb4"  # mvtec-ad detection project

        # Test 1: DICE format export
        print("Test 1: DICE format export")
        print("-" * 80)
        dice_data = export_to_dice(
            db=labeler_db,
            platform_db=platform_db,
            user_db=user_db,
            project_id=project_id,
            include_draft=False,
            image_ids=None,
            task_type='detection'
        )

        print(f"Dataset ID: {dice_data.get('dataset_id')}")
        print(f"Dataset Name: {dice_data.get('dataset_name')}")
        print(f"Task Type: {dice_data.get('task_type')}")
        print()

        if 'storage_info' in dice_data:
            print("[OK] storage_info found in DICE export:")
            print(f"  - storage_type: {dice_data['storage_info']['storage_type']}")
            print(f"  - bucket: {dice_data['storage_info']['bucket']}")
            print(f"  - image_root: {dice_data['storage_info']['image_root']}")
            print()

            # Verify image path construction
            if dice_data.get('images'):
                first_image = dice_data['images'][0]
                full_path = dice_data['storage_info']['image_root'] + first_image['file_name']
                print(f"Example image path construction:")
                print(f"  file_name: {first_image['file_name']}")
                print(f"  + image_root: {dice_data['storage_info']['image_root']}")
                print(f"  = full S3 key: {full_path}")
                print()
        else:
            print("[FAIL] storage_info NOT found in DICE export")
            return 1

        # Test 2: COCO format export
        print("Test 2: COCO format export")
        print("-" * 80)
        coco_data = export_to_coco(
            db=labeler_db,
            platform_db=platform_db,
            project_id=project_id,
            include_draft=False,
            image_ids=None,
            task_type='detection'
        )

        print(f"COCO Version: {coco_data.get('info', {}).get('version')}")
        print(f"Images count: {len(coco_data.get('images', []))}")
        print()

        if 'storage_info' in coco_data:
            print("[OK] storage_info found in COCO export:")
            print(f"  - storage_type: {coco_data['storage_info']['storage_type']}")
            print(f"  - bucket: {coco_data['storage_info']['bucket']}")
            print(f"  - image_root: {coco_data['storage_info']['image_root']}")
            print()

            # Verify image path construction
            if coco_data.get('images'):
                first_image = coco_data['images'][0]
                full_path = coco_data['storage_info']['image_root'] + first_image['file_name']
                print(f"Example image path construction:")
                print(f"  file_name: {first_image['file_name']}")
                print(f"  + image_root: {coco_data['storage_info']['image_root']}")
                print(f"  = full S3 key: {full_path}")
                print()
        else:
            print("[FAIL] storage_info NOT found in COCO export")
            return 1

        # Summary
        print("=" * 80)
        print("Summary:")
        print("=" * 80)
        print("[SUCCESS] All exports include storage_info")
        print()
        print("Platform team can now:")
        print("1. Parse annotation file (DICE or COCO)")
        print("2. Read storage_info section")
        print("3. Construct full S3 keys: image_root + file_name")
        print("4. Download images from the specified bucket")
        print()

        return 0

    except Exception as e:
        print(f"[ERROR] {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        labeler_db.close()
        platform_db.close()
        user_db.close()

if __name__ == "__main__":
    exit_code = test_storage_info_in_exports()
    sys.exit(exit_code)
