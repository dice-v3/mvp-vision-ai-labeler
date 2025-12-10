"""Migrate existing annotations.json files to task-specific filenames in S3 storage."""

import boto3
from botocore.client import Config
from sqlalchemy import create_engine, text
from app.core.config import settings

# Create database engine
platform_engine = create_engine(settings.PLATFORM_DB_URL)

# Create S3 client
s3_client = boto3.client(
    's3',
    endpoint_url=settings.S3_ENDPOINT,
    aws_access_key_id=settings.S3_ACCESS_KEY,
    aws_secret_access_key=settings.S3_SECRET_KEY,
    region_name=settings.S3_REGION,
    config=Config(signature_version='s3v4')
)

print("=== S3 Storage Migration: annotations.json -> annotations_{task_type}.json ===\n")

with platform_engine.connect() as conn:
    # 1. Get all datasets with annotation_path
    result = conn.execute(text("""
        SELECT id, name, annotation_path, storage_path
        FROM datasets
        WHERE annotation_path IS NOT NULL AND annotation_path != ''
    """))
    datasets = result.fetchall()

    print(f"Found {len(datasets)} datasets with annotation files\n")

    migrated_count = 0
    skipped_count = 0
    error_count = 0

    for dataset in datasets:
        dataset_id, name, annotation_path, storage_path = dataset

        print(f"Dataset: {name} ({dataset_id})")
        print(f"  Current path: {annotation_path}")

        # Check if already migrated (contains task type in filename)
        if '_detection.json' in annotation_path or '_classification.json' in annotation_path or '_segmentation.json' in annotation_path:
            print(f"  [SKIP] Already migrated")
            skipped_count += 1
            continue

        # Determine task type (from fix_detection_migration.py, all existing projects are detection)
        task_type = 'detection'

        # Construct new path
        if annotation_path.endswith('annotations.json'):
            new_annotation_path = annotation_path.replace('annotations.json', f'annotations_{task_type}.json')
        else:
            # Fallback: append task type before .json
            new_annotation_path = annotation_path.replace('.json', f'_{task_type}.json')

        print(f"  New path: {new_annotation_path}")

        try:
            # Check if source file exists in S3
            try:
                s3_client.head_object(
                    Bucket=settings.S3_BUCKET_DATASETS,
                    Key=annotation_path
                )
            except Exception as e:
                print(f"  [ERROR] Source file not found in S3: {e}")
                error_count += 1
                continue

            # Copy file to new location
            copy_source = {
                'Bucket': settings.S3_BUCKET_DATASETS,
                'Key': annotation_path
            }
            s3_client.copy_object(
                CopySource=copy_source,
                Bucket=settings.S3_BUCKET_DATASETS,
                Key=new_annotation_path
            )
            print(f"  [OK] Copied to new location")

            # Update database
            conn.execute(text("""
                UPDATE datasets
                SET annotation_path = :new_path
                WHERE id = :dataset_id
            """), {"new_path": new_annotation_path, "dataset_id": dataset_id})

            conn.commit()
            print(f"  [OK] Updated database")

            # Delete old file
            s3_client.delete_object(
                Bucket=settings.S3_BUCKET_DATASETS,
                Key=annotation_path
            )
            print(f"  [OK] Deleted old file")

            migrated_count += 1

        except Exception as e:
            print(f"  [ERROR] Migration failed: {e}")
            error_count += 1
            conn.rollback()

        print()

print("\n=== Migration Summary ===")
print(f"Total datasets: {len(datasets)}")
print(f"Migrated: {migrated_count}")
print(f"Skipped (already migrated): {skipped_count}")
print(f"Errors: {error_count}")

if migrated_count > 0:
    print("\n[OK] Storage migration complete!")
    print("All annotations.json files have been renamed to annotations_detection.json")
else:
    print("\n[INFO] No files needed migration")
